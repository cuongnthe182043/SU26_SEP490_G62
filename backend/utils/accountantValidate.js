const { requireMoney, optionalMoney } = require('./money');


const err400 = (msg) => Object.assign(new Error(msg), { status: 400 });

const posInt = (val, label) => {
    const n = Number(val);
    if (!val && val !== 0 || !Number.isInteger(n) || n <= 0)
        throw err400(`${label} không hợp lệ.`);
    return n;
};

// Bảy ô tiền của kế toán đi qua hai hàm này: công nợ khai tay, các khoản thanh toán đơn
// hàng, tiền tài xế thu hộ. Trước đây cả hai dùng `Number()` trần, nên "500.000" —
// đúng cách người Việt gõ năm trăm nghìn — trở thành 500. Không có cảnh báo nào: khoản
// công nợ vẫn được tạo, chỉ là ít hơn thật một nghìn lần.
//
// Chuyển sang money.js để mọi ô tiền trong hệ thống hiểu số giống hệt nhau và trả về
// cùng một kiểu câu nhắc bằng tiếng Việt.
const posAmount = (val, label = 'Số tiền') => requireMoney(val, { field: label });

const nonNegAmount = (val, label = 'Số tiền') => optionalMoney(val, { field: label, allowZero: true }) ?? 0;

// Số không âm nhưng KHÔNG phải tiền (khối lượng hàng, quãng đường): cùng cách hiểu số
// "1.500" như ô tiền, nhưng được phép có phần lẻ — 12,5 km là số thật, không phải nhập sai.
const nonNegNumber = (val, label) => optionalMoney(val, { field: label, allowZero: true, wholeDong: false }) ?? 0;

const enumVal = (val, allowed, label) => {
    if (val !== undefined && val !== null && val !== '' && !allowed.includes(val))
        throw err400(`${label} không hợp lệ.`);
    return val || null;
};

const pageParams = (query) => ({
    page:  Math.max(1, parseInt(query.page)  || 1),
    limit: Math.min(100, Math.max(1, parseInt(query.limit) || 20)),
});

const phoneVN = (phone) => /^0\d{8,10}$/.test(phone);

const validMonth = (val, label = 'Tháng') => {
    const n = Number(val);
    if (!Number.isInteger(n) || n < 1 || n > 12) throw err400(`${label} không hợp lệ (1–12).`);
    return n;
};

const validYear = (val, label = 'Năm') => {
    const n = Number(val);
    if (!Number.isInteger(n) || n < 2020 || n > 2100) throw err400(`${label} không hợp lệ.`);
    return n;
};

// Ngày lọc gửi từ client (dateFrom/dateTo...). Rỗng/không gửi thì coi như không lọc.
// Không kiểm ở đây thì chuỗi rác đi thẳng xuống Postgres và nổ thành 500 "invalid
// input syntax for type date" — lỗi của người dùng nhưng bị báo thành lỗi máy chủ.
const validDate = (val, label = 'Ngày') => {
    if (val === undefined || val === null || val === '') return null;
    const s = String(val).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw err400(`${label} không hợp lệ (định dạng YYYY-MM-DD).`);
    const d = new Date(`${s}T00:00:00+07:00`);
    if (Number.isNaN(d.getTime())) throw err400(`${label} không hợp lệ.`);
    // Chặn ngày không tồn tại kiểu 2026-02-30 (Date tự dồn sang tháng sau)
    if (d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }) !== s) {
        throw err400(`${label} không hợp lệ.`);
    }
    return s;
};

// Ngày của một việc ĐÃ XẢY RA (ngày đơn, ngày chạy kế toán khai lại). Không được nằm
// sau hôm nay; hôm nay thì được — đơn chạy sáng nay tối nhập vào là chuyện thường.
//
// So theo ngày Việt Nam chứ không theo giờ máy chủ: server chạy UTC thì từ 0h đến 7h
// sáng giờ VN "hôm nay" của nó vẫn là hôm qua, và mọi đơn chạy trong ngày bị chặn oan.
//
// Vì sao phải chặn: đơn nhập tay được tạo thẳng ở trạng thái hoàn thành, nên ngày này
// là ngày GHI NHẬN DOANH THU. Một ô ngày gõ nhầm sang tương lai (hay đọc nhầm định dạng
// Excel kiểu Mỹ m/d/yy) đẩy doanh thu sang kỳ sau — KPI và bảng lương tháng này hụt đi
// mà không có lỗi nào báo ra. Trình đọc Excel đã chặn phía trình duyệt; đây là lớp chốt
// của máy chủ, cũng là lớp DUY NHẤT cho đơn nhập tay từ form.
const notFutureDate = (val, label = 'Ngày') => {
    const s = validDate(val, label);
    if (s === null) return null;
    const todayVN = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    if (s > todayVN) {
        throw err400(`${label} không được ở tương lai (sau ${todayVN}).`);
    }
    return s;
};

// Số tháng lùi lại cho các báo cáo dạng "N tháng gần đây"
const validMonthsBack = (val, fallback = 6, label = 'Số tháng') => {
    if (val === undefined || val === null || val === '') return fallback;
    const n = Number(val);
    if (!Number.isInteger(n) || n < 1 || n > 60) throw err400(`${label} không hợp lệ (1–60).`);
    return n;
};

// Tháng/năm là tham số LỌC không bắt buộc: không gửi thì lấy mặc định, gửi thì phải đúng
const optMonth = (val, fallback, label = 'Tháng') =>
    (val === undefined || val === null || val === '' ? fallback : validMonth(val, label));

const optYear = (val, fallback, label = 'Năm') =>
    (val === undefined || val === null || val === '' ? fallback : validYear(val, label));

const sendError = (res, err) => {
    const status = err.status || 500;
    if (status >= 500) {
        console.error('[Accountant]', err);
        return res.status(500).json({ error: 'Có lỗi xảy ra phía máy chủ. Vui lòng thử lại sau.' });
    }
    return res.status(status).json({ error: err.message });
};

module.exports = {
    posInt, posAmount, nonNegAmount, nonNegNumber, enumVal, pageParams, phoneVN,
    validMonth, validYear, validDate, notFutureDate, validMonthsBack, optMonth, optYear,
    sendError, err400,
};
