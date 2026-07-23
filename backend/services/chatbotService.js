const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
const sqlRunner = require('../repositories/chatbotSqlRunner');
const knowledge = require('./chatbotKnowledge');

// Dùng Google Gemini (có free tier — aistudio.google.com). Đổi model qua env
// CHATBOT_MODEL (mặc định gemini-2.0-flash — Gemini 2.0 Flash nhanh & thông minh hơn).
// Chỉ file này phụ thuộc nhà cung cấp — lớp bảo mật SQL, view, phân quyền, FE dùng
// chung không đổi.
const MODEL = process.env.CHATBOT_MODEL || 'gemini-2.0-flash';
const MAX_ITERATIONS = 6; // chặn vòng lặp tool vô hạn

let genAI = null;
const getClient = () => {
    if (!process.env.GEMINI_API_KEY) {
        throw Object.assign(new Error('Chatbot chưa được cấu hình (thiếu GEMINI_API_KEY).'), { statusCode: 503 });
    }
    if (!genAI) genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    return genAI;
};

const isChatbotEnabled = () => Boolean(process.env.GEMINI_API_KEY);

// Nhận diện lỗi rate-limit (429/quota) của Gemini để trả lời thân thiện thay vì 500.
const isRateLimit = (err) => {
    const msg = String(err?.message || '');
    return err?.status === 429 || /\b429\b|too many requests|resource_exhausted|quota/i.test(msg);
};
const extractRetrySeconds = (err) => {
    const m = String(err?.message || '').match(/retry in ([\d.]+)\s*s/i);
    return m ? Math.ceil(Number(m[1])) : null;
};

const ROLE_LABEL = {
    admin: 'Quản trị/Manager', manager: 'Manager', accountant: 'Kế toán',
    coordinator: 'Điều phối', driver: 'Tài xế',
};

const buildSystemPrompt = (role, schema) => {
    const today = new Date().toISOString().slice(0, 10);
    const driverNote = role === 'driver'
        ? '\n- Bạn đang phục vụ một TÀI XẾ. Các view v_chatbot_my_* đã TỰ ĐỘNG lọc đúng dữ liệu của tài xế này — cứ SELECT bình thường, KHÔNG được thêm điều kiện driver_id.'
        : '';

    return `Bạn là trợ lý dữ liệu của một hệ thống quản lý vận tải (logistics), trả lời bằng TIẾNG VIỆT, ngắn gọn, chính xác.

Hôm nay: ${today}. Người hỏi có vai trò: ${ROLE_LABEL[role] || role}.

Bạn có 2 công cụ:
1. run_sql — chạy một câu SELECT (PostgreSQL) để lấy SỐ LIỆU thật. Dùng cho câu hỏi về doanh thu, công nợ, KPI, chuyến, lương, sự cố, đơn hàng...
2. search_docs — tra tài liệu nghiệp vụ. Dùng cho câu hỏi về QUY TRÌNH/CHÍNH SÁCH (VD: "tài xế cuối đơn cash làm gì", "quy trình bảo dưỡng").

Quy tắc dùng run_sql:
- CHỈ được dùng đúng các view dưới đây, KHÔNG được dùng bảng nào khác.
- Chỉ SELECT (đọc). Không INSERT/UPDATE/DELETE/DDL.
- Cú pháp PostgreSQL. Tiền tệ tính bằng VND.
- Câu hỏi theo thời gian: dùng cột thời gian phù hợp (created_at, completed_at, occurred_at, expense_date, hoặc month/year).
- Nếu run_sql trả lỗi, đọc lỗi và sửa lại câu SQL rồi thử lại.${driverNote}

Các view được phép (tên_view(cột kiểu, ...)):
${schema}

Cách trả lời:
- LÀM GỌN: ưu tiên lấy đủ số liệu bằng 1 câu SQL duy nhất (dùng GROUP BY / aggregate) rồi trả lời ngay, tránh chạy nhiều câu run_sql nối tiếp.
- Cần số liệu → gọi run_sql trước, rồi diễn giải kết quả bằng tiếng Việt (con số cụ thể, tiền có dấu phân cách).
- Câu hỏi quy trình → gọi search_docs rồi tóm tắt.
- KHÔNG bịa số liệu. Không có dữ liệu / không đủ quyền thì nói thẳng.
- Không lộ câu SQL trong câu trả lời trừ khi được hỏi. Trả lời như một trợ lý thân thiện.`;
};

const FUNCTION_DECLARATIONS = [
    {
        name: 'run_sql',
        description: 'Chạy một câu SELECT PostgreSQL trên các view được phép để lấy số liệu thật. Trả về tối đa 200 dòng.',
        parameters: {
            type: SchemaType.OBJECT,
            properties: {
                query: { type: SchemaType.STRING, description: 'Một câu SELECT PostgreSQL duy nhất.' },
            },
            required: ['query'],
        },
    },
    {
        name: 'search_docs',
        description: 'Tra tài liệu nghiệp vụ/quy trình để trả lời câu hỏi về cách hệ thống hoạt động (không phải số liệu).',
        parameters: {
            type: SchemaType.OBJECT,
            properties: {
                query: { type: SchemaType.STRING, description: 'Từ khoá/câu hỏi cần tra trong tài liệu.' },
            },
            required: ['query'],
        },
    },
];

// Thực thi 1 function call của Gemini → trả object cho functionResponse.
const executeTool = async (name, args, { role, actorId }, trace) => {
    try {
        if (name === 'run_sql') {
            const sql = args?.query || '';
            const { rows, truncated } = await sqlRunner.runReadOnlyQuery(sql, { role, actorId });
            trace.sql.push(sql);
            return { row_count: rows.length, truncated, rows };
        }
        if (name === 'search_docs') {
            const hits = knowledge.search(args?.query || '', 3);
            trace.docs.push(...hits.map((h) => h.heading));
            if (hits.length === 0) return { text: 'Không tìm thấy mục tài liệu phù hợp.' };
            return { text: hits.map((h) => h.text).join('\n\n---\n\n').slice(0, 6000) };
        }
        return { error: `Tool không hỗ trợ: ${name}` };
    } catch (err) {
        // Lỗi tool (VD SQL sai) → báo lại cho model để tự sửa, KHÔNG throw.
        return { error: err.message };
    }
};

// Map lịch sử FE ([{role:'user'|'assistant', content}]) → Content của Gemini
// (role 'user' | 'model'), đảm bảo bắt đầu bằng 'user'.
const toGeminiHistory = (history) => {
    const mapped = history
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-6)
        .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
    while (mapped.length && mapped[0].role === 'model') mapped.shift();
    return mapped;
};

/**
 * Hỏi chatbot.
 * @param {{ role: string, actorId: number|string, question: string, history?: Array }} args
 * @returns {Promise<{ answer: string, sql: string[], docs: string[] }>}
 */
const ask = async ({ role, actorId, question, history = [] }) => {
    const q = String(question || '').trim();
    if (!q) throw Object.assign(new Error('Câu hỏi trống.'), { statusCode: 400 });
    if (q.length > 2000) throw Object.assign(new Error('Câu hỏi quá dài (tối đa 2000 ký tự).'), { statusCode: 400 });
    if (sqlRunner.getAllowedViews(role).length === 0) {
        throw Object.assign(new Error('Vai trò này chưa được bật chatbot.'), { statusCode: 403 });
    }

    const client = getClient();
    const schema = await sqlRunner.getSchemaForRole(role);
    const model = client.getGenerativeModel({
        model: MODEL,
        systemInstruction: buildSystemPrompt(role, schema),
        tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
    });

    // Gọi generateContent thủ công (không dùng startChat) để tự kiểm soát role —
    // function response phải nằm trong turn role 'user' (Gemini 3 từ chối role 'function').
    const contents = [...toGeminiHistory(history), { role: 'user', parts: [{ text: q }] }];
    const trace = { sql: [], docs: [] };

    let answer = '';
    try {
        let result = await model.generateContent({ contents });

        for (let i = 0; i < MAX_ITERATIONS; i += 1) {
            const calls = result.response.functionCalls();
            if (!calls || calls.length === 0) break;

            // Echo lại turn của model (chứa functionCall) rồi thêm turn 'user' chứa kết quả.
            const modelContent = result.response.candidates?.[0]?.content;
            if (modelContent) contents.push(modelContent);

            const responseParts = [];
            for (const call of calls) {
                const output = await executeTool(call.name, call.args, { role, actorId }, trace);
                responseParts.push({ functionResponse: { name: call.name, response: output } });
            }
            contents.push({ role: 'user', parts: responseParts });

            result = await model.generateContent({ contents });
        }

        try { answer = result.response.text().trim(); } catch { answer = ''; }
    } catch (err) {
        // Rate-limit (free tier) → trả lời nhẹ nhàng, KHÔNG ném 500.
        if (isRateLimit(err)) {
            const secs = extractRetrySeconds(err);
            return {
                answer: `Em đang bận xử lý (bản miễn phí giới hạn 5 câu/phút). Anh/chị chờ ${secs ? `khoảng ${secs} giây` : 'một chút'} rồi hỏi lại giúp em nhé. 🙏`,
                sql: trace.sql,
                docs: trace.docs,
            };
        }
        throw err;
    }

    return {
        answer: answer || 'Xin lỗi, tôi chưa trả lời được câu này.',
        sql: trace.sql,
        docs: trace.docs,
    };
};

module.exports = { ask, isChatbotEnabled };
