import { quyetDinhKhiLoi } from '@/hooks/use-active-trip';
import { offlineCache } from '@/lib/offline-cache';
import { ApiError } from '@/lib/api-error';

// ─────────────────────────────────────────────────────────────────────────────
// MỨC 3 — Màn chuyến dùng được khi mất sóng
//
// Đây là màn hình quan trọng nhất lúc offline: tài xế cần địa chỉ điểm giao và số
// điện thoại người nhận NGAY tại hiện trường. Màn trắng = tài đứng giữa đường.
//
// GHI CHÚ: renderHook của @testing-library/react-native chưa chạy được với React 19
// (xem __tests__/use-home-summary.test.ts), nên logic quyết định được tách thành hàm
// thuần `quyetDinhKhiLoi` và kiểm thử trực tiếp ở đây.
// ─────────────────────────────────────────────────────────────────────────────

const CHUYEN = {
    id: 55,
    order_id: 900,
    status: 'transit',
    delivery_address: 'KCN Sóng Thần, Bình Dương',
    receiver_phone: '0912345678',
};

describe('MỨC 3 — Quy tắc dùng dữ liệu đệm cho màn chuyến', () => {
    beforeEach(async () => {
        jest.clearAllMocks();
        await offlineCache.xoaTat();
    });

    it('G62-AT-01: mất mạng VÀ có đệm → dùng dữ liệu đệm, đánh dấu ngoại tuyến', () => {
        const loiMang = new ApiError('Không có kết nối mạng', 0);

        expect(quyetDinhKhiLoi(loiMang, true)).toBe('ngoai-tuyen');
    });

    it('G62-AT-02: mất mạng nhưng CHƯA có đệm → phải báo lỗi, không có gì để hiện', () => {
        const loiMang = new ApiError('Không có kết nối mạng', 0);

        expect(quyetDinhKhiLoi(loiMang, false)).toBe('bao-loi');
    });

    it('G62-AT-03: lỗi 403 dù CÓ đệm vẫn phải báo lỗi — không được giả vờ ngoại tuyến', () => {
        // Dữ liệu vẫn tải được, chỉ là tài khoản không có quyền. Hiện dữ liệu cũ kèm
        // chữ "ngoại tuyến" trong trường hợp này là nói dối người dùng.
        const loiQuyen = new ApiError('Quyền hạn không đủ', 403);

        expect(quyetDinhKhiLoi(loiQuyen, true)).toBe('bao-loi');
    });

    it('G62-AT-04: lỗi 500 dù có đệm vẫn báo lỗi', () => {
        expect(quyetDinhKhiLoi(new ApiError('Lỗi máy chủ', 500), true)).toBe('bao-loi');
    });

    it('G62-AT-05: lỗi 401 (hết phiên) dù có đệm vẫn báo lỗi để app cho đăng nhập lại', () => {
        expect(quyetDinhKhiLoi(new ApiError('Phiên hết hạn', 401), true)).toBe('bao-loi');
    });

    it('G62-AT-06: lỗi thường (không phải ApiError) → báo lỗi', () => {
        expect(quyetDinhKhiLoi(new Error('Lỗi lập trình'), true)).toBe('bao-loi');
    });

    it('G62-AT-07: đệm giữ đủ thông tin tài xế cần ở hiện trường', async () => {
        await offlineCache.ghi('active-trip', CHUYEN);

        const ban = await offlineCache.doc<typeof CHUYEN>('active-trip');

        // Ba thứ tài xế cần ngay khi không có mạng
        expect(ban?.data.delivery_address).toBe('KCN Sóng Thần, Bình Dương');
        expect(ban?.data.receiver_phone).toBe('0912345678');
        expect(ban?.data.status).toBe('transit');
    });

    it('G62-AT-08: server báo không còn chuyến → đệm phải ghi null, không giữ chuyến cũ', async () => {
        // Điều phối huỷ chuyến trong lúc tài offline — server là nguồn sự thật
        await offlineCache.ghi('active-trip', CHUYEN);
        await offlineCache.ghi('active-trip', null);

        const ban = await offlineCache.doc<typeof CHUYEN | null>('active-trip');
        expect(ban?.data).toBeNull();
    });
});
