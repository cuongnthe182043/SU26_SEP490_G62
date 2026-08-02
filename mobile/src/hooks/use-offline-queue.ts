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
export function useOfflineQueue({ autoFlush = false }: { autoFlush?: boolean } = {}) {
    const { online, reconnectedAt } = useNetwork();
    const [items, setItems] = useState<QueueItem[]>([]);
    const [isFlushing, setIsFlushing] = useState(false);

    useEffect(() => offlineQueue.subscribe(setItems), []);

    const flush = useCallback(async () => {
        if (isFlushing || !online) return;
        setIsFlushing(true);
        try {
            const { succeeded } = await offlineQueue.flush();
            // Có việc gửi thành công → báo các màn hình tải lại dữ liệu.
            // SERVER LÀ NGUỒN SỰ THẬT: trạng thái sau khi tải lại mới là đúng, kể cả
            // khi khác với thứ tài xế đang thấy (điều phối có thể đã huỷ chuyến trong
            // lúc tài offline). Màn hình tự vẽ lại theo dữ liệu mới.
            if (succeeded > 0) appEvents.emit('offline-queue.flushed', { succeeded });
        } finally {
            setIsFlushing(false);
        }
    }, [isFlushing, online]);

    // Vừa có mạng trở lại → gửi ngay
    useEffect(() => {
        if (!autoFlush) return;
        if (reconnectedAt > 0) void flush();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reconnectedAt, autoFlush]);

    // Mở app mà đang có mạng và còn việc tồn → gửi nốt
    useEffect(() => {
        if (!autoFlush || !online) return;
        void offlineQueue.pendingCount().then((n) => { if (n > 0) void flush(); });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoFlush, online]);

    const pending = items.filter((i) => !i.failedPermanently);
    const failedItems    = items.filter((i) => i.failedPermanently);

    return {
        items,
        pending,
        failedItems,
        pendingCount: pending.length,
        failedCount: failedItems.length,
        isFlushing,
        flush,
        remove: offlineQueue.remove,
    };
}
