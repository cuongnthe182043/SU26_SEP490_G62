import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { tripService } from '@/services/trip-service';
import { offlineCache } from '@/lib/offline-cache';
import { ApiError } from '@/lib/api-error';
import type { ActiveTrip } from '@/types/trip';

type State = {
    trip: ActiveTrip | null;
    isLoading: boolean;
    error: string | null;
    /** Đang hiện dữ liệu đệm vì không gọi được server */
    ngoaiTuyen: boolean;
    /** Mốc lưu đệm — null khi dữ liệu vừa lấy từ server */
    luuLuc: number | null;
};

const KHOA = 'active-trip';

/**
 * Quyết định làm gì khi gọi server hỏng. Tách ra hàm thuần để kiểm thử được —
 * renderHook không chạy với React 19 nên logic nằm trong hook thì không test nổi.
 *
 * Phân biệt bắt buộc:
 *   'ngoai-tuyen' — mất mạng VÀ có dữ liệu đệm → hiện dữ liệu cũ kèm mốc thời gian
 *   'bao-loi'     — mọi trường hợp còn lại
 *
 * Lỗi server (403/500) mà hiện dữ liệu đệm kèm chữ "ngoại tuyến" là nói dối người
 * dùng: dữ liệu vẫn tải được, chỉ là tài khoản không có quyền hoặc server hỏng.
 */
export function quyetDinhKhiLoi(err: unknown, coDem: boolean): 'ngoai-tuyen' | 'bao-loi' {
    const laLoiMang = err instanceof ApiError && err.status === 0;
    return laLoiMang && coDem ? 'ngoai-tuyen' : 'bao-loi';
}

/**
 * Chuyến đang chạy — có đệm để dùng khi mất sóng.
 *
 * Đây là màn hình quan trọng nhất lúc offline: tài xế cần địa chỉ điểm giao, tên và
 * số điện thoại người nhận, hàng hoá gì. Mất mạng mà màn trắng thì tài đứng giữa
 * đường không biết đi đâu.
 */
export function useActiveTrip() {
    const [state, setState] = useState<State>({
        trip: null, isLoading: true, error: null, ngoaiTuyen: false, luuLuc: null,
    });

    const conSong = useRef(true);
    useEffect(() => () => { conSong.current = false; }, []);

    const fetch = useCallback(async () => {
        // Dựng từ đệm trước để không có màn trắng
        const cache = await offlineCache.doc<ActiveTrip | null>(KHOA);
        if (cache && conSong.current) {
            setState((s) => (s.trip ? s : {
                trip: cache.data, isLoading: false, error: null,
                ngoaiTuyen: true, luuLuc: cache.luuLuc,
            }));
        }

        setState((s) => ({ ...s, isLoading: s.trip === null && !cache, error: null }));
        try {
            const { trip } = await tripService.getActiveTrip();
            if (!conSong.current) return;
            setState({ trip, isLoading: false, error: null, ngoaiTuyen: false, luuLuc: null });
            await offlineCache.ghi(KHOA, trip);
        } catch (err) {
            if (!conSong.current) return;

            // Mất mạng mà có dữ liệu đệm → giữ nguyên màn hình, chỉ đánh dấu ngoại tuyến.
            // Lỗi khác (403/500) thì phải báo thật, không được giả vờ là dữ liệu cũ.
            if (quyetDinhKhiLoi(err, Boolean(cache)) === 'ngoai-tuyen' && cache) {
                setState((s) => ({
                    ...s,
                    trip: s.trip ?? cache.data,
                    isLoading: false,
                    error: null,
                    ngoaiTuyen: true,
                    luuLuc: cache.luuLuc,
                }));
                return;
            }
            const message = err instanceof Error ? err.message : 'Không thể tải chuyến';
            setState((s) => ({ ...s, isLoading: false, error: message, ngoaiTuyen: false }));
        }
    }, []);

    // Refresh mỗi khi màn hình được focus
    useFocusEffect(useCallback(() => { fetch(); }, [fetch]));

    return { ...state, refresh: fetch };
}
