/**
 * GIAI ĐOẠN 1 của dây chuyền đọc hóa đơn: LẤY ẢNH VỀ VÀ CHUẨN BỊ.
 *
 * Tách khỏi receiptVisionExtractor vì cùng một tấm ảnh phục vụ HAI kênh đọc: Gemini và
 * Tesseract. Hai kênh dùng CHUNG một biến thể, tải MỘT lần.
 *
 * Trước đây Tesseract có biến thể riêng: 2000px, xám hoá, tăng tương phản, làm nét trên
 * Cloudinary. Đo lại (21/9, bộ ảnh hóa đơn dựng giả mô phỏng ảnh chụp tay: bóng đổ, nhiễu,
 * mờ, mộc đỏ đè lên số) thì biến thể đó còn làm Tesseract đọc KÉM đi — tăng tương phản toàn
 * cục và làm nét khuếch đại cả nhiễu lẫn mép bóng đổ, còn xám hoá thì Tesseract vốn tự làm.
 * Thứ thật sự cứu ảnh chụp tay là nhị phân hoá THÍCH NGHI theo từng vùng, và Tesseract có
 * sẵn bước đó (xem THRESHOLDING trong receiptOcrScanner):
 *
 *   biến thể riêng 2000px + ngưỡng toàn cục (cũ)   38/71 số tiền tìm thấy
 *   biến thể riêng 2000px + ngưỡng thích nghi      49/71
 *   ảnh chung 1600px      + ngưỡng thích nghi      57/71
 *
 * Bỏ biến thể riêng thì mỗi lượt quét bớt một lượt tải ảnh — lại là tệp nặng nhất, nén ít
 * nhất, gấp 2-9 lần ảnh cho model — bớt một ảnh dẫn xuất Cloudinary phải sinh (và tính vào
 * hạn mức), và Tesseract quét ảnh ít điểm ảnh hơn.
 *
 * Việc biến đổi ảnh đẩy hết sang Cloudinary (nơi ảnh vốn đã nằm sẵn) thay vì xử lý
 * bằng thư viện trong tiến trình Node: `sharp`/OpenCV là binding native, phải biên
 * dịch theo nền tảng, làm container phình và hay vỡ lúc deploy — trong khi Cloudinary
 * đã làm đúng những phép này ở tầng CDN, có cache, và không tốn CPU của backend.
 *
 * KHÔNG có thư viện nào ở đây cả: đo kích thước ảnh đọc thẳng từ header của file
 * (JPEG/PNG/WEBP/GIF). Chỉ cần vài chục byte đầu, không phải giải nén ảnh.
 */

const crypto = require('crypto');

// ─── Biến thể ảnh ────────────────────────────────────────────────────────────

const CLOUDINARY_MARKER = '/image/upload/';

/**
 * Biến thể duy nhất, dùng chung cho Gemini và Tesseract. TUYỆT ĐỐI KHÔNG đổi chuỗi này
 * nếu không có lý do đủ lớn.
 *
 * `image_sha256` — khoá dùng để chặn nộp lại đúng một tấm ảnh — được băm trên chính
 * bytes của biến thể này. Đổi tham số biến đổi là đổi bytes, là đổi băm: mọi bản ghi
 * đã có trong `receipt_extractions` sẽ không bao giờ khớp với ảnh đọc sau này nữa, và
 * lớp chống dùng lại hóa đơn âm thầm mất tác dụng mà không có lỗi nào bật lên.
 *
 * Cũng vì vậy mà ĐỪNG thêm lại một biến thể riêng cho OCR để "cho Tesseract ảnh to hơn":
 * đã đo, 1600px không phải chỗ nghẽn — xem ghi chú đầu file.
 */
const VISION_TRANSFORM = 'w_1600,c_limit,q_auto:good';

/**
 * Chèn chuỗi biến đổi vào URL Cloudinary. URL không phải Cloudinary thì trả nguyên si
 * — không ép định dạng, không dựng proxy: ảnh ngoài vẫn đọc được, chỉ là không được
 * hưởng bước tiền xử lý.
 */
const buildVariantUrl = (url, transform) => {
    if (typeof url !== 'string' || !url.includes(CLOUDINARY_MARKER)) return url;
    return url.replace(CLOUDINARY_MARKER, `${CLOUDINARY_MARKER}${transform}/`);
};

const visionUrl = (url) => buildVariantUrl(url, VISION_TRANSFORM);

// ─── Đo ảnh từ header ────────────────────────────────────────────────────────

const ascii = (buffer, from, to) => buffer.subarray(from, to).toString('latin1');

/**
 * JPEG không ghi kích thước ở một chỗ cố định: phải đi lần lượt qua các marker cho
 * tới khối SOF (Start Of Frame) — khối duy nhất chứa chiều cao/rộng thật.
 *
 * Bỏ qua đúng ba nhóm marker KHÔNG có phần độ dài đi kèm (SOI, TEM, RSTn); cộng nhầm
 * độ dài cho chúng thì con trỏ nhảy vào giữa dữ liệu và mọi thứ sau đó là rác.
 */
const probeJpeg = (buffer) => {
    let offset = 2;
    while (offset + 9 < buffer.length) {
        if (buffer[offset] !== 0xff) { offset += 1; continue; }
        const marker = buffer[offset + 1];
        // Chuẩn JPEG cho phép chèn byte đệm 0xFF trước một marker. Không bỏ qua chúng
        // thì 0xFF bị hiểu là mã marker, hai byte kế tiếp bị hiểu là độ dài khối, và con
        // trỏ nhảy lệch vào giữa dữ liệu ảnh.
        if (marker === 0xff) { offset += 1; continue; }
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue; }
        if (marker === 0xd9 || marker === 0xda) break;

        const length = buffer.readUInt16BE(offset + 2);
        if (length < 2) break;

        // SOF0..SOF15 trừ DHT (c4), JPG (c8) và DAC (cc) — ba mã này nằm xen trong dải
        // nhưng không phải khối ảnh.
        const isSOF = marker >= 0xc0 && marker <= 0xcf
            && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
        if (isSOF && offset + 9 <= buffer.length) {
            return { format: 'jpeg', height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
        }
        offset += 2 + length;
    }
    return { format: 'jpeg', width: null, height: null };
};

const probeWebp = (buffer) => {
    const chunk = ascii(buffer, 12, 16);
    if (chunk === 'VP8X' && buffer.length >= 30) {
        return {
            format: 'webp',
            width: 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16)),
            height: 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16)),
        };
    }
    if (chunk === 'VP8 ' && buffer.length >= 30
        && buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a) {
        return {
            format: 'webp',
            width: buffer.readUInt16LE(26) & 0x3fff,
            height: buffer.readUInt16LE(28) & 0x3fff,
        };
    }
    if (chunk === 'VP8L' && buffer.length >= 25 && buffer[20] === 0x2f) {
        const bits = buffer.readUInt32LE(21);
        return { format: 'webp', width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    return { format: 'webp', width: null, height: null };
};

/**
 * Kích thước và định dạng thật của ảnh, đọc từ vài chục byte đầu file.
 *
 * Cần con số này để biết ảnh có ĐỦ ĐỘ PHÂN GIẢI để đọc chữ hay không — hỏi trước khi
 * tiêu một lần gọi model và cả chục giây OCR cho một tấm ảnh 200px chắc chắn vô vọng.
 *
 * Định dạng lạ (HEIC gửi thẳng, tệp hỏng) trả về null: KHÔNG chặn, vì không đo được
 * không có nghĩa là ảnh xấu — chỉ là bước kiểm tra này không có ý kiến gì.
 */
const probeImage = (buffer) => {
    if (!Buffer.isBuffer(buffer) || buffer.length < 16) return null;

    if (buffer.readUInt32BE(0) === 0x89504e47 && buffer.length >= 24) {
        return { format: 'png', width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }
    if (ascii(buffer, 0, 3) === 'GIF') {
        return { format: 'gif', width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
    }
    if (ascii(buffer, 0, 4) === 'RIFF' && ascii(buffer, 8, 12) === 'WEBP') {
        return probeWebp(buffer);
    }
    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
        return probeJpeg(buffer);
    }
    return null;
};

// ─── Chấm chất lượng ảnh ─────────────────────────────────────────────────────

const QUALITY = {
    // Dưới mức này thì một dòng chữ trên hóa đơn chỉ còn vài pixel chiều cao — không
    // model nào đọc được, và cũng không cần model nào để biết điều đó.
    MIN_LONG_EDGE: 480,
    // Trên ngưỡng chặn nhưng vẫn thấp: đọc được nhưng dễ sai số. Cảnh báo để người
    // duyệt biết mà nhìn kỹ, chứ không bắt tài xế chụp lại.
    WARN_LONG_EDGE: 900,
    // Ảnh vài KB gần như luôn là ảnh trắng, ảnh lỗi hoặc placeholder.
    MIN_BYTES: 6 * 1024,
    MAX_BYTES: 10 * 1024 * 1024,
    // Phần dư cho metadata (EXIF, ICC profile, thumbnail nhúng) khi thử xem kích thước
    // đọc từ header có khớp với độ nặng của tệp không.
    HEADER_SLACK_BYTES: 256 * 1024,
};

const reason = (code, severity, message, detail) => ({ code, severity, message, ...(detail ? { detail } : {}) });

/**
 * Phán quyết về CHẤT LƯỢNG ẢNH, tách hẳn khỏi phán quyết về nội dung hóa đơn.
 *
 * Chỉ chặn những gì người gửi sửa được ngay bằng cách chụp lại. Mọi thứ khác là cảnh
 * báo — nguyên tắc xuyên suốt của cả tính năng: không đổ sự cố kỹ thuật lên đầu tài
 * xế, nhưng cũng không để khoản đó lọt khỏi tầm mắt người duyệt.
 */
const assessImage = ({ bytes, width, height } = {}) => {
    const reasons = [];

    if (Number.isFinite(bytes) && bytes > 0 && bytes < QUALITY.MIN_BYTES) {
        reasons.push(reason('IMAGE_SUSPICIOUSLY_SMALL_FILE', 'warning',
            'Tệp ảnh rất nhẹ, nhiều khả năng là ảnh trắng hoặc ảnh lỗi. Người duyệt vui lòng mở ảnh xem trực tiếp.',
            { bytes }));
    }

    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return reasons;
    }

    // Kích thước đo từ header là thứ duy nhất ở giai đoạn này đủ quyền CHẶN tài xế, nên
    // nó phải qua được một phép thử vật lý trước: một tấm ảnh không thể nặng hơn dữ liệu
    // điểm ảnh thô của chính nó. 8 byte/điểm là trần của PNG 16-bit RGBA không nén, cộng
    // phần dư cho metadata. Header đọc ra 300×400 mà tệp nặng 2MB nghĩa là ĐỌC SAI HEADER
    // chứ không phải ảnh nhỏ — khi đó im lặng, vì chặn oan tệ hơn bỏ sót một cảnh báo.
    if (Number.isFinite(bytes) && bytes > width * height * 8 + QUALITY.HEADER_SLACK_BYTES) {
        return reasons;
    }

    const longEdge = Math.max(width, height);
    if (longEdge < QUALITY.MIN_LONG_EDGE) {
        reasons.push(reason('IMAGE_TOO_SMALL', 'error',
            `Ảnh quá nhỏ (${width}×${height}) nên không đọc được chữ trên hóa đơn. `
            + 'Vui lòng chụp lại gần hơn và gửi ảnh gốc, không gửi ảnh đã bị thu nhỏ.',
            { width, height }));
    } else if (longEdge < QUALITY.WARN_LONG_EDGE) {
        reasons.push(reason('IMAGE_LOW_RESOLUTION', 'warning',
            `Ảnh có độ phân giải thấp (${width}×${height}), kết quả đọc có thể sai số. `
            + 'Người duyệt vui lòng đối chiếu lại với ảnh gốc.',
            { width, height }));
    }

    return reasons;
};

// ─── Tải ảnh ─────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 15_000;

const fail = (code, message) => Object.assign(new Error(message), { code });

/**
 * Tải một biến thể về bộ nhớ.
 *
 * Kiểm tra content-type TRƯỚC khi đọc body: một tệp PDF hay video vài trăm MB nếu để
 * đọc hết rồi mới chê thì đã tốn hết băng thông rồi mới biết là vô ích.
 */
const fetchVariant = async (url) => {
    let response;
    try {
        response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    } catch (err) {
        throw fail('FETCH_FAILED', `Không tải được ảnh (${err.message})`);
    }

    if (!response.ok) throw fail('FETCH_FAILED', `Không tải được ảnh (HTTP ${response.status})`);

    const mimeType = (response.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
    if (!mimeType.startsWith('image/')) {
        response.body?.cancel?.().catch?.(() => {});
        throw fail('NOT_AN_IMAGE', `Tệp tải về không phải ảnh (${mimeType})`);
    }

    // Kiểm tra kích thước khai báo TRƯỚC khi đọc body. Kiểm sau `arrayBuffer()` thì cả
    // tệp đã nằm trong bộ nhớ rồi mới bị chê là quá lớn.
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > QUALITY.MAX_BYTES) {
        response.body?.cancel?.().catch?.(() => {});
        throw fail('IMAGE_TOO_LARGE', 'Ảnh quá lớn');
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0) throw fail('FETCH_FAILED', 'Ảnh rỗng');
    if (buffer.length > QUALITY.MAX_BYTES) throw fail('IMAGE_TOO_LARGE', 'Ảnh quá lớn');

    return { buffer, mimeType };
};

/**
 * Điểm vào của giai đoạn 1: từ một URL ra đủ thứ hai giai đoạn sau cần.
 *
 * Chỉ MỘT lượt tải: `vision.buffer` là ảnh Gemini đọc, và cũng là ảnh Tesseract quét.
 *
 * @param {string} imageUrl
 * @returns {Promise<{ok: boolean, code?: string, error?: string, vision?: object, quality?: object}>}
 */
const loadImage = async (imageUrl) => {
    let vision;
    try {
        vision = await fetchVariant(visionUrl(imageUrl));
    } catch (err) {
        return { ok: false, code: err.code ?? 'FETCH_FAILED', error: err.message };
    }

    const probed = probeImage(vision.buffer) ?? { format: null, width: null, height: null };
    const quality = {
        bytes: vision.buffer.length,
        width: probed.width,
        height: probed.height,
        format: probed.format,
        reasons: assessImage({ bytes: vision.buffer.length, width: probed.width, height: probed.height }),
    };

    const visionPart = {
        buffer: vision.buffer,
        base64: vision.buffer.toString('base64'),
        mimeType: vision.mimeType,
        // Băm trên biến thể chuẩn — xem ghi chú ở VISION_TRANSFORM về việc vì sao
        // chuỗi biến đổi đó không được đổi.
        sha256: crypto.createHash('sha256').update(vision.buffer).digest('hex'),
        bytes: vision.buffer.length,
    };

    return { ok: true, vision: visionPart, quality };
};

module.exports = {
    VISION_TRANSFORM,
    QUALITY,
    buildVariantUrl,
    visionUrl,
    probeImage,
    assessImage,
    fetchVariant,
    loadImage,
};
