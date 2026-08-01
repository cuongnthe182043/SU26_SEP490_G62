import { useCallback, useEffect, useState } from 'react';

import { offlineQueue, type QueueItem } from '@/lib/offline-queue';
import { useNetwork } from '@/providers/network-provider';
import { appEvents } from '@/lib/app-events';

/**
 * Theo dõi hàng đợi offline và tự gửi khi có mạng trở lại.
 *
 * Dùng ở tầng gốc (một lần duy nhất) để chạy nền, và dùng lại ở màn hình nào cần
 * hiển thị số việc đang chờ.
 */
export function useOfflineQueue({ tuGui = false }: { tuGui?: boolean } = {}) {
    const { online, vuaOnlineLai } = useNetwork();
    const [items, setItems] = useState<QueueItem[]>([]);
    const [dangGui, setDangGui] = useState(false);

    useEffect(() => offlineQueue.theoDoi(setItems), []);

    const xuLy = useCallback(async () => {
        if (dangGui || !online) return;
        setDangGui(true);
        try {
            const { thanhCong } = await offlineQueue.xuLy();
            // Có việc gửi thành công → báo các màn hình tải lại dữ liệu.
            // SERVER LÀ NGUỒN SỰ THẬT: trạng thái sau khi tải lại mới là đúng, kể cả
            // khi khác với thứ tài xế đang thấy (điều phối có thể đã huỷ chuyến trong
            // lúc tài offline). Màn hình tự vẽ lại theo dữ liệu mới.
            if (thanhCong > 0) appEvents.emit('offline-queue.flushed', { thanhCong });
        } finally {
            setDangGui(false);
        }
    }, [dangGui, online]);

    // Vừa có mạng trở lại → gửi ngay
    useEffect(() => {
        if (!tuGui) return;
        if (vuaOnlineLai > 0) void xuLy();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vuaOnlineLai, tuGui]);

    // Mở app mà đang có mạng và còn việc tồn → gửi nốt
    useEffect(() => {
        if (!tuGui || !online) return;
        void offlineQueue.soCho().then((n) => { if (n > 0) void xuLy(); });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tuGui, online]);

    const dangCho = items.filter((i) => !i.failedPermanently);
    const hong    = items.filter((i) => i.failedPermanently);

    return {
        items,
        dangCho,
        hong,
        soCho: dangCho.length,
        soHong: hong.length,
        dangGui,
        xuLy,
        xoa: offlineQueue.xoa,
    };
}
