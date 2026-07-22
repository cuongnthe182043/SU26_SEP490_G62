const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// Kho tri thức cho câu hỏi QUY TRÌNH / NGHIỆP VỤ (phần "vector RAG" nhẹ).
//
// Tài liệu nguồn là spec nghiệp vụ (business-spec.md). Vì chỉ có 1 tài liệu vừa
// phải, ta KHÔNG cần pgvector/embeddings — chỉ chia theo mục (## heading) rồi tìm
// bằng chấm điểm từ khoá (BM25-lite). Đủ tốt để trả lời "driver cuối đơn cash làm
// gì", "quy trình bảo dưỡng"... Có thể nâng lên embeddings sau nếu tài liệu phình.
// ─────────────────────────────────────────────────────────────────────────────

const DOC_PATH = path.join(__dirname, '..', 'data', 'business-spec.md');

let chunks = null; // [{ heading, text, tokens: Set<string> }]

const VN_STOP = new Set([
    'và', 'là', 'của', 'các', 'khi', 'cho', 'với', 'một', 'này', 'thì', 'được',
    'có', 'không', 'ở', 'từ', 'đến', 'theo', 'trong', 'ra', 'vào', 'gì', 'nào',
    'the', 'a', 'an', 'of', 'to', 'in', 'is', 'for',
]);

const tokenize = (text) =>
    String(text)
        .toLowerCase()
        .replace(/[^a-z0-9à-ỹ_]+/gi, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 1 && !VN_STOP.has(t));

const loadChunks = () => {
    if (chunks) return chunks;
    let raw = '';
    try {
        raw = fs.readFileSync(DOC_PATH, 'utf8');
    } catch {
        chunks = [];
        return chunks;
    }

    // Chia theo heading cấp 1-2 (# hoặc ##).
    const parts = raw.split(/\n(?=#{1,2}\s)/);
    chunks = parts
        .map((block) => {
            const firstLine = block.split('\n', 1)[0] || '';
            const heading = firstLine.replace(/^#+\s*/, '').trim();
            const text = block.trim();
            return { heading, text, tokens: new Set(tokenize(block)) };
        })
        .filter((c) => c.text.length > 40);
    return chunks;
};

/**
 * Tìm các mục tài liệu liên quan tới câu hỏi.
 * @param {string} query
 * @param {number} [topK]
 * @returns {Array<{ heading: string, text: string, score: number }>}
 */
const search = (query, topK = 3) => {
    const all = loadChunks();
    if (all.length === 0) return [];

    const qTokens = tokenize(query);
    if (qTokens.length === 0) return [];

    const scored = all.map((chunk) => {
        let score = 0;
        for (const qt of qTokens) {
            if (chunk.tokens.has(qt)) score += 1;
            // thưởng khi từ khoá nằm ngay trong tiêu đề mục
            if (chunk.heading.toLowerCase().includes(qt)) score += 2;
        }
        return { heading: chunk.heading, text: chunk.text, score };
    });

    return scored
        .filter((c) => c.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
};

module.exports = { search, _reload: () => { chunks = null; } };
