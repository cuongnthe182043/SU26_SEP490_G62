import { ApiError } from '@/lib/api-error';
import { offlineQueue } from '@/lib/offline-queue';

/**
 * Gửi một thao tác có ảnh; nếu hỏng vì MẠNG thì đưa vào hàng đợi thay vì báo lỗi.
 *
 * Dùng chung cho mọi thao tác vòng đời chuyến. Quy tắc phân biệt lỗi:
 *   * ApiError với status = 0 → lỗi mạng / hết giờ chờ  → xếp hàng, coi như đã nhận
 *   * mọi lỗi khác (4xx, 5xx) → server đã trả lời và từ chối → ném ra cho màn hình
 *     hiển thị, KHÔNG xếp hàng (gửi lại cũng hỏng y như vậy)
 *
 * Trả về:
 *   { sent: true, result }        — gửi thẳng thành công
 *   { sent: false, queued: true } — mất mạng, đã cất vào hàng đợi
 */
export type SendOrQueueResult<T> =
    | { sent: true; result: T }
    | { sent: false; queued: true };

export async function sendOrQueue<T>(
    guiNgay: () => Promise<T>,
    queued: {
        path: string;
        method?: 'POST' | 'PATCH';
        fields?: Record<string, string>;
        photoUri?: string | null;
        photoField?: string;
        label: string;
    },
): Promise<SendOrQueueResult<T>> {
    try {
        const result = await guiNgay();
        return { sent: true, result };
    } catch (err) {
        const isNetworkError = err instanceof ApiError && err.status === 0;
        if (!isNetworkError) throw err;

        await offlineQueue.enqueue(queued);
        return { sent: false, queued: true };
    }
}
