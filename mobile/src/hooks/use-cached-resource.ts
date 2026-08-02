import { useCallback, useEffect, useRef, useState } from 'react';

import { offlineCache } from '@/lib/offline-cache';
import { ApiError } from '@/lib/api-error';

/**
 * Hook đọc dữ liệu có đệm: hiện dữ liệu cũ ngay lập tức rồi tải mới ở nền.
 *
 * Hành vi:
 *   1. Mở màn hình → đọc cache, hiện ngay (không có màn trắng, không spinner)
 *   2. Song song gọi API; thành công thì thay dữ liệu và ghi đè cache
 *   3. API hỏng vì MẠNG mà đã có cache → giữ dữ liệu cũ, bật cờ `ngoaiTuyen`
 *      để màn hình hiện nhãn "số liệu lúc HH:MM"
 *   4. API hỏng vì mạng mà CHƯA có cache → báo lỗi như trước
 *   5. API hỏng vì lý do khác (4xx/5xx) → báo lỗi, KHÔNG giả vờ là dữ liệu ngoại tuyến
 *
 * Phân biệt (3) và (5) rất quan trọng: server trả 403 mà hiện dữ liệu cache kèm chữ
 * "ngoại tuyến" là nói dối người dùng.
 */

type KetQua<T> = {
    data: T | null;
    isLoading: boolean;
    error: string | null;
    /** Đang hiện dữ liệu từ cache vì không gọi được server */
    ngoaiTuyen: boolean;
    /** Mốc lưu cache, null nếu dữ liệu vừa lấy từ server */
    savedAt: number | null;
    refresh: () => Promise<void>;
};

export function useCachedResource<T>(
    key: string,
    taiVe: () => Promise<T>,
    { tuTai = true }: { tuTai?: boolean } = {},
): KetQua<T> {
    const [data, setData]           = useState<T | null>(null);
    const [isLoading, setLoading]   = useState(true);
    const [error, setError]         = useState<string | null>(null);
    const [ngoaiTuyen, setNgoai]    = useState(false);
    const [savedAt, setLuuLuc]       = useState<number | null>(null);

    // taiVe thường là hàm inline, đổi mỗi lần render — giữ trong ref để useCallback
    // bên dưới không phải phụ thuộc vào nó (nếu không sẽ tải lại vô hạn).
    const inFlightRef = useRef(taiVe);
    inFlightRef.current = taiVe;

    const conSong = useRef(true);
    useEffect(() => () => { conSong.current = false; }, []);

    const refresh = useCallback(async () => {
        // Bước 1 — dựng từ cache trước để có gì đó hiện ngay
        const cache = await offlineCache.read<T>(key);
        if (cache && conSong.current) {
            setData(cache.data);
            setLuuLuc(cache.savedAt);
            setLoading(false);
        }

        // Bước 2 — gọi server
        try {
            const fresh = await inFlightRef.current();
            if (!conSong.current) return;
            setData(fresh);
            setError(null);
            setNgoai(false);
            setLuuLuc(null);
            setLoading(false);
            await offlineCache.write(key, fresh);
        } catch (err) {
            if (!conSong.current) return;
            const isNetworkError = err instanceof ApiError && err.status === 0;

            if (isNetworkError && cache) {
                // Có dữ liệu cũ để dùng — không coi là lỗi
                setNgoai(true);
                setError(null);
            } else {
                setError(err instanceof Error ? err.message : 'Không tải được dữ liệu');
                setNgoai(false);
            }
            setLoading(false);
        }
    }, [key]);

    useEffect(() => {
        if (tuTai) void refresh();
    }, [tuTai, refresh]);

    return { data, isLoading, error, ngoaiTuyen, savedAt, refresh };
}
