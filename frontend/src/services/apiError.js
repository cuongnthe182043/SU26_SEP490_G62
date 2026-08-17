/**
 * Phân loại lỗi tầng mạng của fetch() thành thông điệp người dùng đọc được, đồng thời
 * giữ đủ dấu vết để lập trình viên/tester debug.
 *
 * Vì sao cần: fetch() chỉ ném đúng một câu `TypeError: Failed to fetch` cho MỌI sự cố
 * trước khi có HTTP response — máy chủ chưa chạy, sai VITE_API_BASE_URL, CORS bị chặn,
 * máy mất mạng, DNS hỏng, chứng chỉ TLS sai. Câu đó lọt thẳng vào toast khiến người dùng
 * không biết phải làm gì, còn người sửa lỗi không biết request nào hỏng và đang gọi đi đâu.
 *
 * Trình duyệt CỐ TÌNH không nói rõ nguyên nhân (chống dò quét mạng nội bộ), nên ta không
 * thể phân biệt chính xác. Cách xử lý: tách được cái gì chắc chắn thì tách (offline, huỷ
 * request, timeout), phần còn lại nêu các nguyên nhân thường gặp theo thứ tự khả năng.
 */

export const API_ERROR_KIND = {
    OFFLINE: 'offline',       // trình duyệt báo mất mạng
    UNREACHABLE: 'unreachable', // không chạm được máy chủ (chưa chạy / sai URL / CORS / TLS)
    TIMEOUT: 'timeout',
    ABORTED: 'aborted',       // do chính app huỷ (đổi màn, gõ tiếp ô tìm kiếm) — không phải lỗi
    BAD_RESPONSE: 'bad_response', // có phản hồi nhưng nội dung không dùng được
};

const isAbort = (err) => err?.name === 'AbortError' || err?.code === 20;
const isTimeout = (err) => err?.name === 'TimeoutError';
const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

/** Rút gọn thân phản hồi để không đổ nguyên trang HTML lỗi của nginx vào toast. */
export function summarizeBody(payload, max = 200) {
    if (payload == null) return '';
    const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const trimmed = text.trim();
    if (!trimmed) return '';
    // Trang lỗi của proxy/gateway là HTML: với người dùng nó vô nghĩa, chỉ giữ <title>.
    if (/^\s*<(!doctype|html|head|body)/i.test(trimmed)) {
        const title = trimmed.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
        return title ? `trang lỗi HTML: ${title}` : 'trang lỗi HTML';
    }
    return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

/**
 * Lấy thông điệp DÙNG ĐƯỢC từ thân phản hồi lỗi. Trả '' khi thân phản hồi không phải lời
 * nhắn cho người dùng (trang HTML của proxy, body rỗng) để call site rơi về câu mặc định.
 */
export function pickServerMessage(payload) {
    if (payload && typeof payload === 'object') {
        return String(payload.error || payload.message || '').trim();
    }
    if (typeof payload !== 'string') return '';
    const summary = summarizeBody(payload);
    return summary.startsWith('trang lỗi HTML') ? '' : summary;
}

/**
 * Tạo Error đã phân loại cho sự cố xảy ra TRƯỚC khi có HTTP response.
 * Trả về Error với: message (cho người dùng), kind, status=0, và các trường debug.
 */
export function toNetworkError(cause, { method = 'GET', path = '', url = '', baseUrl = '', elapsedMs = null } = {}) {
    const upperMethod = String(method).toUpperCase();
    let kind;
    let message;

    if (isAbort(cause)) {
        kind = API_ERROR_KIND.ABORTED;
        message = 'Yêu cầu đã bị huỷ.';
    } else if (isTimeout(cause)) {
        kind = API_ERROR_KIND.TIMEOUT;
        message = 'Máy chủ phản hồi quá lâu. Vui lòng thử lại.';
    } else if (isOffline()) {
        kind = API_ERROR_KIND.OFFLINE;
        message = 'Thiết bị đang mất kết nối mạng. Kiểm tra Wi-Fi hoặc 4G rồi thử lại.';
    } else {
        kind = API_ERROR_KIND.UNREACHABLE;
        message = `Không kết nối được máy chủ (${baseUrl || url || 'không rõ địa chỉ'}). `
            + 'Máy chủ có thể chưa khởi động, sai địa chỉ cấu hình, hoặc bị chặn bởi CORS/tường lửa.';
    }

    const error = new Error(message);
    error.name = 'ApiNetworkError';
    error.kind = kind;
    error.status = 0;           // 0 = chưa từng có HTTP response, phân biệt với 4xx/5xx
    error.isNetworkError = true;
    error.isAborted = kind === API_ERROR_KIND.ABORTED;
    error.method = upperMethod;
    error.path = path;
    error.url = url;
    error.baseUrl = baseUrl;
    error.elapsedMs = elapsedMs;
    error.cause = cause;
    // Một dòng dán thẳng vào bug report được
    error.debug = [
        `[${kind}] ${upperMethod} ${path || url}`,
        url && url !== path ? `→ ${url}` : '',
        elapsedMs != null ? `(${elapsedMs}ms)` : '',
        cause ? `| ${cause.name || 'Error'}: ${cause.message}` : '',
    ].filter(Boolean).join(' ');

    return error;
}

/** Lỗi khi ĐÃ có phản hồi nhưng thân phản hồi không đọc được (JSON hỏng, HTML từ proxy...). */
export function toBadResponseError(cause, { method = 'GET', path = '', url = '', status = 0 } = {}) {
    const error = new Error(
        `Máy chủ trả về dữ liệu không đọc được${status ? ` (HTTP ${status})` : ''}. `
        + 'Thường do proxy/gateway trả trang lỗi thay vì dữ liệu — thử lại sau ít phút.',
    );
    error.name = 'ApiBadResponseError';
    error.kind = API_ERROR_KIND.BAD_RESPONSE;
    error.status = status;
    error.isNetworkError = true;
    error.method = String(method).toUpperCase();
    error.path = path;
    error.url = url;
    error.cause = cause;
    error.debug = `[bad_response] ${error.method} ${path} → HTTP ${status} | ${cause?.name || 'Error'}: ${cause?.message || ''}`;
    return error;
}

/**
 * Ghi log gọn cho devtools. Toast chỉ nói cho người dùng biết phải làm gì; chi tiết để
 * lần ra lỗi (URL thật, mã lỗi gốc, thời gian chờ) nằm ở đây.
 */
export function logApiFailure(error) {
    if (error?.isAborted) return;   // app tự huỷ request là chuyện bình thường
    if (typeof console === 'undefined') return;
    console.error(
        `%c[API] ${error?.debug || error?.message || 'unknown failure'}`,
        'color:#e11d48;font-weight:600',
        { error, cause: error?.cause },
    );
}

/** Cho phép call site bỏ qua toast khi request bị chính app huỷ. */
export const isAbortError = (err) => Boolean(err?.isAborted) || isAbort(err);
