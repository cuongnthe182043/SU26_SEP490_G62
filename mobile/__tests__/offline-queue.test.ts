import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import { offlineQueue } from '@/lib/offline-queue';

// ─────────────────────────────────────────────────────────────────────────────
// MỨC 2 — Hàng đợi thao tác offline
//
// Đây là nơi giữ ảnh tài xế chụp ở hiện trường khi mất sóng. Sai ở đây nghĩa là
// mất ảnh (không chụp lại được) hoặc gửi trùng (sinh dữ liệu thừa, sai tiền).
// ─────────────────────────────────────────────────────────────────────────────

const mockFS = FileSystem as jest.Mocked<typeof FileSystem>;

// tokenStorage đọc SecureStore — trả token giả để hàm gửi chạy được
jest.mock('@/services/token-storage', () => ({
    tokenStorage: {
        getToken:     jest.fn(() => Promise.resolve('token-gia')),
        getCsrfToken: jest.fn(() => Promise.resolve('csrf-gia')),
    },
}));

jest.mock('@/constants/api', () => ({ getApiBaseUrl: () => 'http://test' }));

const dapUng = (status: number, body: unknown = {}) => ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
}) as unknown as Response;

describe('MỨC 2 — Hàng đợi offline', () => {
    beforeEach(async () => {
        jest.clearAllMocks();
        await offlineQueue.clear();
        (global as unknown as { fetch: jest.Mock }).fetch = jest.fn();
    });

    it('G62-OFF-01: thêm việc vào hàng đợi và đếm được số việc đang chờ', async () => {
        await offlineQueue.enqueue({ path: '/api/trips/1/complete', label: 'Giao hàng #1' });
        await offlineQueue.enqueue({ path: '/api/trips/2/complete', label: 'Giao hàng #2' });

        expect(await offlineQueue.pendingCount()).toBe(2);
    });

    it('G62-OFF-02: ảnh được COPY sang thư mục riêng của app, không dùng đường dẫn cache gốc', async () => {
        // Ảnh expo-camera nằm trong cache — hệ điều hành có quyền dọn bất cứ lúc nào
        const item = await offlineQueue.enqueue({
            path: '/api/trips/1/complete',
            photoUri: 'file:///cache/anh-tam.jpg',
            label: 'Giao hàng #1',
        });

        expect(mockFS.makeDirectoryAsync).toHaveBeenCalled();
        expect(mockFS.copyAsync).toHaveBeenCalledWith(
            expect.objectContaining({ from: 'file:///cache/anh-tam.jpg' }),
        );
        expect(item.photoUri).toContain('file:///doc/queue-photos/');
        expect(item.photoUri).not.toBe('file:///cache/anh-tam.jpg');
    });

    it('G62-OFF-03: gửi thành công → xoá khỏi hàng đợi và xoá file ảnh', async () => {
        (global.fetch as jest.Mock).mockResolvedValue(dapUng(200));
        await offlineQueue.enqueue({
            path: '/api/trips/1/complete', photoUri: 'file:///cache/a.jpg', label: 'Giao hàng #1',
        });

        const kq = await offlineQueue.flush();

        expect(kq.succeeded).toBe(1);
        expect(await offlineQueue.pendingCount()).toBe(0);
        expect(mockFS.deleteAsync).toHaveBeenCalled();
    });

    it('G62-OFF-04: gửi TUẦN TỰ theo đúng thứ tự đưa vào — lấy hàng phải trước giao hàng', async () => {
        const goi: string[] = [];
        (global.fetch as jest.Mock).mockImplementation((url: string) => {
            goi.push(url);
            return Promise.resolve(dapUng(200));
        });

        await offlineQueue.enqueue({ path: '/api/trips/1/start-transit', label: 'Lấy hàng' });
        await offlineQueue.enqueue({ path: '/api/trips/1/complete',      label: 'Giao hàng' });

        await offlineQueue.flush();

        expect(goi).toEqual([
            'http://test/api/trips/1/start-transit',
            'http://test/api/trips/1/complete',
        ]);
    });

    it('G62-OFF-05: lỗi MẠNG → giữ lại trong hàng đợi, tăng số lần thử, KHÔNG đánh hỏng', async () => {
        (global.fetch as jest.Mock).mockRejectedValue(new Error('Network request failed'));
        await offlineQueue.enqueue({ path: '/api/trips/1/complete', label: 'Giao hàng #1' });

        await offlineQueue.flush();

        const items = await offlineQueue.list();
        expect(items).toHaveLength(1);
        expect(items[0].attempts).toBe(1);
        expect(items[0].failedPermanently).toBe(false);
    });

    it('G62-OFF-06: lỗi mạng ở việc đầu → DỪNG luôn, không đốt lượt thử của các việc sau', async () => {
        (global.fetch as jest.Mock).mockRejectedValue(new Error('Network request failed'));
        await offlineQueue.enqueue({ path: '/api/trips/1/complete', label: 'Việc 1' });
        await offlineQueue.enqueue({ path: '/api/trips/2/complete', label: 'Việc 2' });

        await offlineQueue.flush();

        const items = await offlineQueue.list();
        expect(items[0].attempts).toBe(1);
        expect(items[1].attempts).toBe(0);   // chưa đụng tới
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('G62-OFF-07: lỗi NGHIỆP VỤ 4xx → đánh hỏng hẳn, không thử lại vô ích', async () => {
        (global.fetch as jest.Mock).mockResolvedValue(
            dapUng(422, { error: 'Chuyến không ở trạng thái "arrived"' }),
        );
        await offlineQueue.enqueue({ path: '/api/trips/1/complete', label: 'Giao hàng #1' });

        await offlineQueue.flush();

        const items = await offlineQueue.list();
        expect(items[0].failedPermanently).toBe(true);
        expect(items[0].lastError).toContain('arrived');
        expect(await offlineQueue.pendingCount()).toBe(0);   // không còn nằm chờ
    });

    it('G62-OFF-08: 409 coi như THÀNH CÔNG — việc đã gửi được lần trước, chỉ mất phản hồi', async () => {
        (global.fetch as jest.Mock).mockResolvedValue(
            dapUng(409, { error: 'Chuyến này đã được tài xế khác nhận' }),
        );
        await offlineQueue.enqueue({ path: '/api/trips/1/complete', label: 'Giao hàng #1' });

        const kq = await offlineQueue.flush();

        expect(kq.succeeded).toBe(1);
        expect(await offlineQueue.list()).toHaveLength(0);
    });

    it('G62-OFF-09: lỗi 5xx vẫn được thử lại (không đánh hỏng)', async () => {
        (global.fetch as jest.Mock).mockResolvedValue(dapUng(500, { error: 'Lỗi máy chủ' }));
        await offlineQueue.enqueue({ path: '/api/trips/1/complete', label: 'Giao hàng #1' });

        await offlineQueue.flush();

        const items = await offlineQueue.list();
        expect(items[0].failedPermanently).toBe(false);
    });

    it('G62-OFF-10: quá 5 lần thử → tự đánh hỏng, không quay vòng mãi', async () => {
        (global.fetch as jest.Mock).mockRejectedValue(new Error('Network request failed'));
        await offlineQueue.enqueue({ path: '/api/trips/1/complete', label: 'Giao hàng #1' });

        for (let i = 0; i < 5; i += 1) await offlineQueue.flush();

        const items = await offlineQueue.list();
        expect(items[0].attempts).toBe(5);
        expect(items[0].failedPermanently).toBe(true);
    });

    it('G62-OFF-11: gửi kèm ĐỦ các trường text và ảnh trong multipart', async () => {
        let form: FormData | null = null;
        (global.fetch as jest.Mock).mockImplementation((_u: string, init: RequestInit) => {
            form = init.body as FormData;
            return Promise.resolve(dapUng(200));
        });

        await offlineQueue.enqueue({
            path: '/api/expenses',
            photoUri: 'file:///cache/bill.jpg',
            photoField: 'receipt',
            fields: { shipmentId: '55', amount: '150000', clientRequestId: 'exp-abc' },
            label: 'Khai chi phí',
        });
        await offlineQueue.flush();

        expect(form).not.toBeNull();
        expect((form as unknown as FormData).get('shipmentId')).toBe('55');
        expect((form as unknown as FormData).get('amount')).toBe('150000');
        expect((form as unknown as FormData).get('clientRequestId')).toBe('exp-abc');
        expect((form as unknown as FormData).get('receipt')).toBeTruthy();
    });

    it('G62-OFF-12: gắn Authorization và X-CSRF-Token khi gửi lại', async () => {
        let headers: Record<string, string> = {};
        (global.fetch as jest.Mock).mockImplementation((_u: string, init: RequestInit) => {
            headers = init.headers as Record<string, string>;
            return Promise.resolve(dapUng(200));
        });

        await offlineQueue.enqueue({ path: '/api/trips/1/complete', label: 'Giao hàng' });
        await offlineQueue.flush();

        expect(headers.Authorization).toBe('Bearer token-gia');
        expect(headers['X-CSRF-Token']).toBe('csrf-gia');
    });

    it('G62-OFF-13: dữ liệu hàng đợi được lưu bền, không mất khi khởi động lại app', async () => {
        await offlineQueue.enqueue({ path: '/api/trips/1/complete', label: 'Giao hàng #1' });

        // Mô phỏng mở lại app: đọc thẳng từ kho lưu trữ
        const raw = await AsyncStorage.getItem('offline_queue_v1');
        expect(raw).toBeTruthy();
        expect(JSON.parse(raw as string)).toHaveLength(1);
    });

    it('G62-OFF-14: đăng xuất → xoá sạch hàng đợi và file ảnh của người dùng cũ', async () => {
        await offlineQueue.enqueue({
            path: '/api/trips/1/complete', photoUri: 'file:///cache/a.jpg', label: 'Giao hàng',
        });

        await offlineQueue.clear();

        expect(await offlineQueue.list()).toHaveLength(0);
        expect(mockFS.deleteAsync).toHaveBeenCalled();
    });

    it('G62-OFF-15: xoá một việc cụ thể cũng xoá file ảnh kèm theo', async () => {
        const item = await offlineQueue.enqueue({
            path: '/api/trips/1/complete', photoUri: 'file:///cache/a.jpg', label: 'Giao hàng',
        });

        await offlineQueue.remove(item.id);

        expect(await offlineQueue.list()).toHaveLength(0);
        expect(mockFS.deleteAsync).toHaveBeenCalledWith(item.photoUri, { idempotent: true });
    });
});
