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

const KEY_PREFIX = 'cache_v1:';

export type CachedRecord<T> = {
    data: T;
    savedAt: number;
};

export const offlineCache = {
    async read<T>(key: string): Promise<CachedRecord<T> | null> {
        try {
            const raw = await AsyncStorage.getItem(KEY_PREFIX + key);
            if (!raw) return null;
            const parsed = JSON.parse(raw) as CachedRecord<T>;
            if (!parsed || typeof parsed.savedAt !== 'number') return null;
            return parsed;
        } catch {
            return null;
        }
    },

    async write<T>(key: string, data: T): Promise<void> {
        const ban: CachedRecord<T> = { data, savedAt: Date.now() };
        await AsyncStorage.setItem(KEY_PREFIX + key, JSON.stringify(ban)).catch(() => {});
    },

    async remove(key: string): Promise<void> {
        await AsyncStorage.removeItem(KEY_PREFIX + key).catch(() => {});
    },

    /** Xoá toàn bộ cache — gọi khi đăng xuất */
    async clear(): Promise<void> {
        try {
            const keys = await AsyncStorage.getAllKeys();
            const ourKeys = keys.filter((k) => k.startsWith(KEY_PREFIX));
            if (ourKeys.length > 0) await AsyncStorage.multiRemove(ourKeys);
        } catch {
            // Không xoá được cache không phải lỗi chặn đăng xuất
        }
    },
};

/** "14:05 hôm nay" / "14:05 30/07" — cho nhãn "số liệu lúc ..." */
export function formatCachedAt(savedAt: number): string {
    const d = new Date(savedAt);
    const hhmm = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const homNay = new Date().toDateString() === d.toDateString();
    if (homNay) return `${hhmm} hôm nay`;
    return `${hhmm} ${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`;
}

export default offlineCache;
