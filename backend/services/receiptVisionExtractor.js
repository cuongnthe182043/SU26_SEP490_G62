/**
 * Trích xuất hóa đơn thành JSON có cấu trúc bằng vision model.
 *
 * Vì sao không dùng Tesseract nữa: Tesseract trả về một chuỗi text PHẲNG, mất sạch
 * cấu trúc bảng. Từ chuỗi "Nhớt Castrol 1 450.000 450.000 Lọc dầu 2 85.000 170.000"
 * không có cách nào biết đâu là số lượng, đâu là đơn giá, đâu là thành tiền — mà đó
 * đúng là ba con số cần có để kiểm tra "tổng các khoản theo số lượng". Mọi regex viết
 * thêm chỉ là đoán mò trên một cấu trúc đã bị phá vỡ.
 *
 * File này là nơi DUY NHẤT phụ thuộc nhà cung cấp AI. Nó chỉ trả về "trên giấy viết
 * gì" — mọi phán quyết đúng/sai nằm ở receiptChecks.js.
 *
 * Dùng Gemini vì nó có free tier và SDK đã nằm sẵn trong dự án. Sau khi bỏ chatbot thì
 * đây là chỗ DUY NHẤT gọi AI, nên đổi nhà cung cấp chỉ phải sửa đúng file này — phần
 * chấm luật, lưu vết và giao diện duyệt không đụng tới. Đổi model qua env
 * RECEIPT_VISION_MODEL.
 */

const crypto = require('crypto');
const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
const taxonomy = require('./receiptTaxonomy');

// GHIM phiên bản, không dùng alias kiểu `-latest`. Alias tự đổi sang model mới khi
// Google chuyển hướng, nghĩa là hành vi đọc hóa đơn thay đổi mà không ai deploy gì —
// và cột prompt_version dùng để so độ chính xác giữa các phiên bản sẽ mất ý nghĩa.
// Đổi model là một quyết định có chủ đích, đi kèm một vòng đo lại.
const MODEL = process.env.RECEIPT_VISION_MODEL || 'gemini-3.6-flash';

// Đo thực tế trên máy chủ Google: 503 "high demand" xảy ra thường xuyên và hỏng NGAY
// (dưới 1 giây) chứ không treo. Không thử lại thì mỗi đợt quá tải là một loạt hóa đơn
// rơi vào "cần người xem" — người duyệt thấy tính năng như đang hỏng.
//
// Cố ý KHÔNG thử lại khi TIMEOUT: đã chờ hết 30 giây một lần thì lần hai cũng vậy, chỉ
// tổ bắt tài xế đứng chờ thêm mà cơ hội thành công không tăng.
const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 700;

// Đổi số này mỗi khi sửa prompt. Lưu vào receipt_extractions để so được độ chính xác
// giữa các phiên bản prompt — không có nó thì không biết một thay đổi làm tốt lên hay
// tệ đi.
const PROMPT_VERSION = 'v1';

const FETCH_TIMEOUT_MS = 15_000;
// Đo thực tế trên 7 ảnh hóa đơn: phản hồi THÀNH CÔNG mất từ 2 đến 24 giây (phần lớn
// độ trễ là xếp hàng phía Google chứ không phải xử lý ảnh). Cắt ở 30 giây là chặt tay
// đúng phần đuôi của phân phối và biến những lần đọc lẽ ra thành công thành "cần người
// xem" — đẩy việc sang cho người duyệt một cách vô ích.
const MODEL_TIMEOUT_MS = 45_000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

let genAI = null;
const getClient = () => {
    if (!genAI) genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    return genAI;
};

const isVisionEnabled = () => Boolean(process.env.GEMINI_API_KEY);

// ─── Tải ảnh ─────────────────────────────────────────────────────────────────

/**
 * Ảnh chụp từ điện thoại thường 4–8MB, thừa xa mức cần để đọc chữ trên hóa đơn.
 * Nhờ Cloudinary thu nhỏ ngay lúc tải giúp cắt cả băng thông lẫn token đầu vào.
 * Không ép định dạng — để Cloudinary tự chọn, tránh hỏng với file không phải ảnh.
 */
const optimizeCloudinaryUrl = (url) => {
    const marker = '/image/upload/';
    if (typeof url !== 'string' || !url.includes(marker)) return url;
    return url.replace(marker, `${marker}w_1600,c_limit,q_auto:good/`);
};

const fetchImage = async (imageUrl) => {
    const response = await fetch(optimizeCloudinaryUrl(imageUrl), {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
        throw Object.assign(new Error(`Không tải được ảnh (HTTP ${response.status})`), { code: 'FETCH_FAILED' });
    }

    const contentType = (response.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
    if (!contentType.startsWith('image/')) {
        throw Object.assign(new Error(`Tệp tải về không phải ảnh (${contentType})`), { code: 'NOT_AN_IMAGE' });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0) {
        throw Object.assign(new Error('Ảnh rỗng'), { code: 'FETCH_FAILED' });
    }
    if (buffer.length > MAX_IMAGE_BYTES) {
        throw Object.assign(new Error('Ảnh quá lớn'), { code: 'IMAGE_TOO_LARGE' });
    }

    return {
        base64: buffer.toString('base64'),
        mimeType: contentType,
        // Băm nội dung ảnh để giai đoạn 2 chặn được việc nộp lại đúng một tấm ảnh.
        // Tính ở đây vì đã có sẵn buffer trong tay, không tốn thêm lần tải nào.
        sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
    };
};

// ─── Lược đồ đầu ra ──────────────────────────────────────────────────────────

const nullableString = { type: SchemaType.STRING, nullable: true };
const nullableNumber = { type: SchemaType.NUMBER, nullable: true };

const RESPONSE_SCHEMA = {
    type: SchemaType.OBJECT,
    properties: {
        is_document: { type: SchemaType.BOOLEAN },
        doc_type: {
            type: SchemaType.STRING,
            enum: ['invoice', 'receipt', 'quote', 'handwritten', 'screenshot', 'other'],
            format: 'enum',
        },
        vendor: {
            type: SchemaType.OBJECT,
            properties: {
                name: nullableString,
                tax_code: nullableString,
                address: nullableString,
                phone: nullableString,
            },
        },
        invoice_no: nullableString,
        issued_date: nullableString,
        vehicle_plate: nullableString,
        currency: nullableString,
        line_items: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    raw_name: { type: SchemaType.STRING },
                    quantity: nullableNumber,
                    unit: nullableString,
                    unit_price: nullableNumber,
                    line_total: nullableNumber,
                    category: {
                        type: SchemaType.STRING,
                        enum: [...taxonomy.ALL_CATEGORIES, 'unknown'],
                        format: 'enum',
                    },
                },
                required: ['raw_name'],
            },
        },
        subtotal: nullableNumber,
        discount: nullableNumber,
        vat_rate: nullableNumber,
        vat_amount: nullableNumber,
        total: nullableNumber,
        unreadable_fields: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    },
    required: ['is_document', 'doc_type', 'line_items'],
};

// ─── Prompt ──────────────────────────────────────────────────────────────────

const CATEGORY_GUIDE = taxonomy.DEFAULT_TAXONOMY
    .map((entry) => `  - ${entry.category} (${entry.group === taxonomy.MAINTENANCE ? 'thuộc bảo dưỡng' : 'KHÔNG thuộc bảo dưỡng'}): ${entry.label}`)
    .join('\n');

const SYSTEM_PROMPT = `Bạn là bộ đọc chứng từ. Nhiệm vụ DUY NHẤT của bạn là chép lại chính xác những gì IN TRÊN ẢNH thành JSON.

HAI QUY TẮC TUYỆT ĐỐI:

1. CHỈ ĐỌC, KHÔNG SUY DIỄN.
   Trường nào không nhìn thấy rõ thì trả null và ghi tên trường đó vào unreadable_fields.
   Đoán một con số mờ thành số cụ thể còn TỆ HƠN việc nói "không đọc được", vì nó tạo
   ra sự tự tin giả. Thà để null.

2. TUYỆT ĐỐI KHÔNG TỰ TÍNH TOÁN.
   line_total phải là con số IN TRÊN GIẤY ở cột thành tiền, KHÔNG PHẢI kết quả bạn nhân
   quantity với unit_price. Nếu cột thành tiền bị mờ hoặc không có, để line_total = null.
   Tương tự với subtotal, vat_amount, total: chỉ chép số in sẵn, không cộng trừ gì cả.
   Hệ thống sẽ tự kiểm tra phép tính — nếu bạn tự tính thì việc kiểm tra đó thành vô nghĩa
   và hóa đơn bị sửa số sẽ lọt qua.

CÁC TRƯỜNG KHÁC:

- is_document: true nếu ảnh có một chứng từ giấy (hóa đơn, phiếu thu, biên nhận).
  false nếu là ảnh phong cảnh, ảnh xe, ảnh bảng giá treo tường, giấy trắng, ảnh mờ không đọc được.
- doc_type:
    invoice     — hóa đơn in (hóa đơn GTGT, hóa đơn bán hàng)
    receipt     — phiếu thu, biên nhận, bill in từ máy tính tiền
    quote       — BÁO GIÁ, dự toán (có chữ "báo giá", "dự toán", chưa thanh toán)
    handwritten — chứng từ viết tay
    screenshot  — ảnh chụp màn hình điện thoại/máy tính (chuyển khoản, tin nhắn, app)
    other       — giấy tờ khác không phải chứng từ mua bán
- issued_date: định dạng YYYY-MM-DD. Không thấy ngày thì null.
- vehicle_plate: biển số xe nếu hóa đơn có ghi (garage thường ghi). Không có thì null.
- quantity: số lượng in ở cột số lượng. Không có cột đó thì null (KHÔNG mặc định là 1).
- vat_rate: chỉ con số phần trăm, ví dụ 10 (không phải "10%" hay 0.1).
- Mọi số tiền là số nguyên VND, không dấu chấm phẩy: "1.320.000" -> 1320000.

PHÂN LOẠI TỪNG DÒNG (trường category):
Chọn một mã trong danh sách sau cho mỗi dòng hàng. Không chắc thì chọn "unknown" —
đoán bừa còn hại hơn.
${CATEGORY_GUIDE}
  - unknown: không xác định được

Chỉ trả JSON đúng lược đồ, không thêm lời giải thích nào.`;

// ─── Chuẩn hoá kết quả ───────────────────────────────────────────────────────

const toNumber = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Ép kiểu và làm sạch JSON model trả về trước khi đưa vào tầng kiểm tra.
 *
 * Tầng kiểm tra phải được nhận dữ liệu đã sạch: nó là nơi ra phán quyết nên không
 * được vừa phải phòng thủ kiểu dữ liệu vừa phải lo nghiệp vụ.
 */
const normalizeExtraction = (raw) => {
    const unreadable = new Set(
        Array.isArray(raw?.unreadable_fields) ? raw.unreadable_fields.filter((f) => typeof f === 'string') : [],
    );

    let issuedDate = typeof raw?.issued_date === 'string' && ISO_DATE.test(raw.issued_date.trim())
        ? raw.issued_date.trim()
        : null;
    if (!issuedDate && raw?.issued_date) unreadable.add('issued_date');

    const lineItems = (Array.isArray(raw?.line_items) ? raw.line_items : []).map((item) => {
        // Mã hạng mục lạ (model bịa ra hoặc "unknown") coi như không phân loại được.
        const category = taxonomy.groupOfCategory(item?.category) ? item.category : null;
        return {
            raw_name: typeof item?.raw_name === 'string' ? item.raw_name.trim() : null,
            quantity: toNumber(item?.quantity),
            unit: typeof item?.unit === 'string' ? item.unit.trim() : null,
            unit_price: toNumber(item?.unit_price),
            line_total: toNumber(item?.line_total),
            category,
        };
    }).filter((item) => item.raw_name);

    return {
        is_document: raw?.is_document === true,
        doc_type: typeof raw?.doc_type === 'string' ? raw.doc_type : 'other',
        vendor: {
            name: raw?.vendor?.name ?? null,
            tax_code: raw?.vendor?.tax_code ?? null,
            address: raw?.vendor?.address ?? null,
            phone: raw?.vendor?.phone ?? null,
        },
        invoice_no: raw?.invoice_no ?? null,
        issued_date: issuedDate,
        vehicle_plate: raw?.vehicle_plate ?? null,
        currency: raw?.currency ?? 'VND',
        line_items: lineItems,
        subtotal: toNumber(raw?.subtotal),
        discount: toNumber(raw?.discount),
        vat_rate: toNumber(raw?.vat_rate),
        vat_amount: toNumber(raw?.vat_amount),
        total: toNumber(raw?.total),
        unreadable_fields: [...unreadable],
    };
};

// ─── Điểm vào ────────────────────────────────────────────────────────────────

/**
 * Phân loại lỗi gọi model: mã để lưu vết, và có đáng thử lại không.
 *
 * Tách thành hàm thuần để test được quyết định thử-lại mà không cần gọi mạng thật.
 */
const classifyError = (err) => {
    if (err?.code === 'TIMEOUT') return { code: 'TIMEOUT', retryable: false };

    const status = Number(err?.status);
    const message = String(err?.message ?? '');

    if (status === 429 || /\b429\b|quota|resource_exhausted|too many requests/i.test(message)) {
        return { code: 'RATE_LIMIT', retryable: true };
    }
    if (status === 503 || status === 500 || /\b50[03]\b|unavailable|high demand|overloaded/i.test(message)) {
        return { code: 'SERVICE_UNAVAILABLE', retryable: true };
    }
    // Lỗi mạng chập chờn — đáng thử lại. 4xx còn lại (model không tồn tại, khoá sai,
    // lược đồ không hợp lệ) là lỗi cấu hình, thử lại bao nhiêu lần cũng vậy.
    if (!status && /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|socket hang up/i.test(message)) {
        return { code: 'NETWORK', retryable: true };
    }
    return { code: 'MODEL_ERROR', retryable: false };
};

const sleep = (ms) => new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    if (typeof timer.unref === 'function') timer.unref();
});

/** Lùi theo cấp số nhân kèm nhiễu ngẫu nhiên, tránh mọi instance thử lại cùng lúc. */
const backoffDelay = (attempt) => Math.round(RETRY_BASE_MS * (2 ** attempt) * (0.5 + Math.random()));

const withTimeout = (promise, ms, label) => Promise.race([
    promise,
    new Promise((_, reject) => {
        const timer = setTimeout(() => reject(Object.assign(new Error(label), { code: 'TIMEOUT' })), ms);
        if (typeof timer.unref === 'function') timer.unref();
    }),
]);

/**
 * Đọc một ảnh hóa đơn thành JSON có cấu trúc.
 *
 * KHÔNG ném lỗi ra ngoài: mọi sự cố đều trả về { ok: false, code }. Nơi gọi quyết định
 * xử lý thế nào — và theo thiết kế thì sự cố phải thành `needs_review` chứ không phải
 * `passed`, vì "cho qua vì hạ tầng lỗi" nghĩa là không còn ai nhìn lại khoản đó nữa.
 *
 * @param {string} imageUrl
 * @returns {Promise<{ok: boolean, extraction?: object, error?: string, code?: string, meta: object}>}
 */
const extractReceipt = async (imageUrl) => {
    const startedAt = Date.now();
    const meta = {
        provider: 'google',
        model: MODEL,
        prompt_version: PROMPT_VERSION,
        image_sha256: null,
        latency_ms: 0,
    };

    if (!isVisionEnabled()) {
        return { ok: false, code: 'NOT_CONFIGURED', error: 'Chưa cấu hình GEMINI_API_KEY cho việc đọc hóa đơn.', meta };
    }

    let image;
    try {
        image = await fetchImage(imageUrl);
        meta.image_sha256 = image.sha256;
    } catch (err) {
        meta.latency_ms = Date.now() - startedAt;
        return { ok: false, code: err.code || 'FETCH_FAILED', error: err.message, meta };
    }

    const model = getClient().getGenerativeModel({
        model: MODEL,
        systemInstruction: SYSTEM_PROMPT,
        generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
            // Đọc chứng từ là việc chép lại, không phải việc sáng tạo.
            temperature: 0,
        },
    });

    const request = {
        contents: [{
            role: 'user',
            parts: [
                { inlineData: { data: image.base64, mimeType: image.mimeType } },
                { text: 'Đọc chứng từ trong ảnh này và trả JSON đúng lược đồ.' },
            ],
        }],
    };

    let last = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
        try {
            const result = await withTimeout(
                model.generateContent(request),
                MODEL_TIMEOUT_MS,
                'Quá thời gian đọc hóa đơn',
            );
            meta.latency_ms = Date.now() - startedAt;
            meta.attempts = attempt + 1;

            let parsed;
            try {
                parsed = JSON.parse(result.response.text());
            } catch {
                return { ok: false, code: 'BAD_JSON', error: 'Kết quả đọc hóa đơn không đúng định dạng.', meta };
            }
            return { ok: true, extraction: normalizeExtraction(parsed), raw: parsed, meta };
        } catch (err) {
            last = { ...classifyError(err), message: err.message };
            if (!last.retryable || attempt === MAX_ATTEMPTS - 1) break;
            await sleep(backoffDelay(attempt));
        }
    }

    meta.latency_ms = Date.now() - startedAt;
    meta.attempts = MAX_ATTEMPTS;
    return { ok: false, code: last?.code ?? 'MODEL_ERROR', error: last?.message ?? 'Không đọc được hóa đơn', meta };
};

module.exports = {
    PROMPT_VERSION,
    RESPONSE_SCHEMA,
    SYSTEM_PROMPT,
    isVisionEnabled,
    classifyError,
    optimizeCloudinaryUrl,
    normalizeExtraction,
    extractReceipt,
};
