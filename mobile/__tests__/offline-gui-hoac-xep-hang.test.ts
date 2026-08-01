import { guiHoacXepHang } from '@/lib/gui-hoac-xep-hang';
import { offlineQueue } from '@/lib/offline-queue';
import { ApiError } from '@/lib/api-error';

// ─────────────────────────────────────────────────────────────────────────────
// MỨC 2 — Quy tắc phân biệt "xếp hàng" và "báo lỗi"
//
// Đây là chỗ dễ sai nhất và hậu quả nặng nhất:
//   * Xếp hàng nhầm lỗi nghiệp vụ → app im lặng, tài tưởng xong, việc treo mãi
//   * Báo lỗi nhầm lỗi mạng       → mất ảnh vừa chụp ở hiện trường
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('@/services/token-storage', () => ({
    tokenStorage: {
        getToken:     jest.fn(() => Promise.resolve('t')),
        getCsrfToken: jest.fn(() => Promise.resolve('c')),
    },
}));
jest.mock('@/constants/api', () => ({ getApiBaseUrl: () => 'http://test' }));

const xepHangMau = {
    path: '/api/trips/1/complete',
    photoUri: 'file:///cache/anh.jpg',
    label: 'Xác nhận giao hàng chuyến #1',
};

describe('MỨC 2 — guiHoacXepHang', () => {
    beforeEach(async () => {
        jest.clearAllMocks();
        await offlineQueue.xoaTat();
    });

    it('G62-QUE-01: gửi được ngay → trả kết quả, KHÔNG đụng hàng đợi', async () => {
        const kq = await guiHoacXepHang(
            async () => ({ trip: { id: 1 } }),
            xepHangMau,
        );

        expect(kq).toEqual({ daGui: true, ketQua: { trip: { id: 1 } } });
        expect(await offlineQueue.soCho()).toBe(0);
    });

    it('G62-QUE-02: lỗi MẠNG (status 0) → cất vào hàng đợi, không ném lỗi ra màn hình', async () => {
        const kq = await guiHoacXepHang(
            async () => { throw new ApiError('Không có kết nối mạng', 0); },
            xepHangMau,
        );

        expect(kq).toEqual({ daGui: false, xepHang: true });
        expect(await offlineQueue.soCho()).toBe(1);
    });

    it('G62-QUE-03: lỗi NGHIỆP VỤ (422) → ném ra cho màn hình, TUYỆT ĐỐI không xếp hàng', async () => {
        // Gửi lại cũng hỏng y như vậy — xếp hàng chỉ làm tài tưởng đã xong
        await expect(
            guiHoacXepHang(
                async () => { throw new ApiError('Chuyến không ở trạng thái "arrived"', 422); },
                xepHangMau,
            ),
        ).rejects.toThrow('arrived');

        expect(await offlineQueue.soCho()).toBe(0);
    });

    it('G62-QUE-04: lỗi máy chủ (500) cũng ném ra, không xếp hàng', async () => {
        await expect(
            guiHoacXepHang(
                async () => { throw new ApiError('Lỗi máy chủ', 500); },
                xepHangMau,
            ),
        ).rejects.toThrow('Lỗi máy chủ');

        expect(await offlineQueue.soCho()).toBe(0);
    });

    it('G62-QUE-05: lỗi thường (không phải ApiError) cũng ném ra, không xếp hàng', async () => {
        await expect(
            guiHoacXepHang(
                async () => { throw new Error('Lỗi lập trình'); },
                xepHangMau,
            ),
        ).rejects.toThrow('Lỗi lập trình');

        expect(await offlineQueue.soCho()).toBe(0);
    });

    it('G62-QUE-06: khi xếp hàng, giữ đủ ảnh và nhãn mô tả cho tài xế đọc', async () => {
        await guiHoacXepHang(
            async () => { throw new ApiError('Không có kết nối mạng', 0); },
            { ...xepHangMau, fields: { shipmentId: '1' } },
        );

        const [item] = await offlineQueue.danhSach();
        expect(item.path).toBe('/api/trips/1/complete');
        expect(item.label).toBe('Xác nhận giao hàng chuyến #1');
        expect(item.photoUri).toContain('queue-photos');
        expect(item.fields.shipmentId).toBe('1');
    });
});
