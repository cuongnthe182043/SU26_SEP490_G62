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
 *   { daGui: true, ketQua }        — gửi thẳng thành công
 *   { daGui: false, xepHang: true } — mất mạng, đã cất vào hàng đợi
 */
export type KetQuaGuiHoacXepHang<T> =
    | { daGui: true; ketQua: T }
    | { daGui: false; xepHang: true };

export async function guiHoacXepHang<T>(
    guiNgay: () => Promise<T>,
    xepHang: {
        path: string;
        method?: 'POST' | 'PATCH';
        fields?: Record<string, string>;
        photoUri?: string | null;
        photoField?: string;
        label: string;
    },
): Promise<KetQuaGuiHoacXepHang<T>> {
    try {
        const ketQua = await guiNgay();
        return { daGui: true, ketQua };
    } catch (err) {
        const laLoiMang = err instanceof ApiError && err.status === 0;
        if (!laLoiMang) throw err;

        await offlineQueue.them(xepHang);
        return { daGui: false, xepHang: true };
    }
}
