import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Bộ nhớ đệm dữ liệu đọc, để app dùng được khi mất mạng.
 *
 * Vì sao cần: tài xế chạy qua vùng lõm sóng, mở app ra là màn hình trắng hoặc báo
 * lỗi — không xem được địa chỉ điểm giao, số điện thoại người nhận, hàng hoá gì.
 * Đó là thông tin phải có ngay tại hiện trường, không chờ có mạng được.
 *
 * Nguyên tắc:
 *   * Chỉ đệm dữ liệu ĐỌC. Dữ liệu ghi đi qua offline-queue.
 *   * Luôn kèm mốc thời gian để màn hình nói rõ "số liệu lúc HH:MM", tránh tài xế
 *     tưởng đang xem dữ liệu mới nhất.
 *   * Đệm theo TÀI XẾ: đăng xuất là xoá sạch, không để lộ dữ liệu người này cho người khác.
 */

const TIEN_TO = 'cache_v1:';

export type BanGhiCache<T> = {
    data: T;
    luuLuc: number;
};

export const offlineCache = {
    async doc<T>(khoa: string): Promise<BanGhiCache<T> | null> {
        try {
            const raw = await AsyncStorage.getItem(TIEN_TO + khoa);
            if (!raw) return null;
            const parsed = JSON.parse(raw) as BanGhiCache<T>;
            if (!parsed || typeof parsed.luuLuc !== 'number') return null;
            return parsed;
        } catch {
            return null;
        }
    },

    async ghi<T>(khoa: string, data: T): Promise<void> {
        const ban: BanGhiCache<T> = { data, luuLuc: Date.now() };
        await AsyncStorage.setItem(TIEN_TO + khoa, JSON.stringify(ban)).catch(() => {});
    },

    async xoa(khoa: string): Promise<void> {
        await AsyncStorage.removeItem(TIEN_TO + khoa).catch(() => {});
    },

    /** Xoá toàn bộ cache — gọi khi đăng xuất */
    async xoaTat(): Promise<void> {
        try {
            const keys = await AsyncStorage.getAllKeys();
            const cua_ta = keys.filter((k) => k.startsWith(TIEN_TO));
            if (cua_ta.length > 0) await AsyncStorage.multiRemove(cua_ta);
        } catch {
            // Không xoá được cache không phải lỗi chặn đăng xuất
        }
    },
};

/** "14:05 hôm nay" / "14:05 30/07" — cho nhãn "số liệu lúc ..." */
export function nhanThoiDiem(luuLuc: number): string {
    const d = new Date(luuLuc);
    const gio = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const homNay = new Date().toDateString() === d.toDateString();
    if (homNay) return `${gio} hôm nay`;
    return `${gio} ${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`;
}

export default offlineCache;
