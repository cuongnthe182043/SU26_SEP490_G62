import AsyncStorage from '@react-native-async-storage/async-storage';

import { offlineCache, nhanThoiDiem } from '@/lib/offline-cache';

// ─────────────────────────────────────────────────────────────────────────────
// MỨC 3 — Bộ nhớ đệm dữ liệu đọc
//
// Cho phép tài xế xem được chuyến (địa chỉ, người nhận, hàng hoá) khi mất sóng.
// Yêu cầu quan trọng: LUÔN kèm mốc thời gian, và đăng xuất phải xoá sạch.
// ─────────────────────────────────────────────────────────────────────────────

describe('MỨC 3 — Bộ nhớ đệm offline', () => {
    beforeEach(async () => {
        jest.clearAllMocks();
        await offlineCache.xoaTat();
    });

    it('G62-CACHE-01: ghi rồi đọc lại đúng dữ liệu', async () => {
        await offlineCache.ghi('active-trip', { id: 7, dia_chi: 'Quận 1' });

        const ban = await offlineCache.doc<{ id: number; dia_chi: string }>('active-trip');

        expect(ban?.data.id).toBe(7);
        expect(ban?.data.dia_chi).toBe('Quận 1');
    });

    it('G62-CACHE-02: luôn kèm mốc thời gian để màn hình nói rõ "số liệu lúc ..."', async () => {
        const truoc = Date.now();
        await offlineCache.ghi('k', { a: 1 });

        const ban = await offlineCache.doc<{ a: number }>('k');

        expect(typeof ban?.luuLuc).toBe('number');
        expect(ban!.luuLuc).toBeGreaterThanOrEqual(truoc);
    });

    it('G62-CACHE-03: chưa có gì trong đệm → trả null, không ném lỗi', async () => {
        expect(await offlineCache.doc('chua-co-bao-gio')).toBeNull();
    });

    it('G62-CACHE-04: dữ liệu lưu bị hỏng → trả null thay vì làm sập app', async () => {
        await AsyncStorage.setItem('cache_v1:hong', 'khong-phai-json{{{');

        expect(await offlineCache.doc('hong')).toBeNull();
    });

    it('G62-CACHE-05: bản ghi thiếu mốc thời gian bị coi là không hợp lệ', async () => {
        await AsyncStorage.setItem('cache_v1:thieu', JSON.stringify({ data: { a: 1 } }));

        expect(await offlineCache.doc('thieu')).toBeNull();
    });

    it('G62-CACHE-06: ghi đè khoá cũ, không nhân đôi bản ghi', async () => {
        await offlineCache.ghi('k', { v: 'cu' });
        await offlineCache.ghi('k', { v: 'moi' });

        const ban = await offlineCache.doc<{ v: string }>('k');
        expect(ban?.data.v).toBe('moi');
    });

    it('G62-CACHE-07: xoá một khoá cụ thể', async () => {
        await offlineCache.ghi('a', 1);
        await offlineCache.ghi('b', 2);

        await offlineCache.xoa('a');

        expect(await offlineCache.doc('a')).toBeNull();
        expect(await offlineCache.doc('b')).not.toBeNull();
    });

    it('G62-CACHE-08: đăng xuất → xoá SẠCH đệm, không để lộ dữ liệu cho người dùng sau', async () => {
        await offlineCache.ghi('active-trip', { id: 1 });
        await offlineCache.ghi('payroll', { luong: 9000000 });

        await offlineCache.xoaTat();

        expect(await offlineCache.doc('active-trip')).toBeNull();
        expect(await offlineCache.doc('payroll')).toBeNull();
    });

    it('G62-CACHE-09: xoá sạch chỉ đụng khoá của đệm, KHÔNG xoá dữ liệu khác trong máy', async () => {
        await AsyncStorage.setItem('offline_queue_v1', '[{"id":"x"}]');
        await offlineCache.ghi('active-trip', { id: 1 });

        await offlineCache.xoaTat();

        // Hàng đợi là kho riêng, xoá đệm không được đụng vào
        expect(await AsyncStorage.getItem('offline_queue_v1')).toBe('[{"id":"x"}]');
    });

    it('G62-CACHE-10: nhãn thời điểm trong ngày hiện "HH:MM hôm nay"', () => {
        const nhan = nhanThoiDiem(Date.now());
        expect(nhan).toContain('hôm nay');
        expect(nhan).toMatch(/\d{2}:\d{2}/);
    });

    it('G62-CACHE-11: nhãn thời điểm ngày khác hiện kèm ngày/tháng', () => {
        const homQua = Date.now() - 36 * 60 * 60 * 1000;
        const nhan = nhanThoiDiem(homQua);
        expect(nhan).not.toContain('hôm nay');
        // Không ràng buộc dấu phân cách: Intl trả "30/07" hay "30-07" tuỳ bản ICU của
        // máy chạy, cả hai đều đọc được — chỉ cần có đủ ngày và tháng.
        expect(nhan).toMatch(/\d{2}[/-]\d{2}/);
    });
});
