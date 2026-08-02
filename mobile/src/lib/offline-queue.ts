import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import { getApiBaseUrl } from '@/constants/api';
import { tokenStorage } from '@/services/token-storage';

/**
 * Hàng đợi thao tác offline cho tài xế.
 *
 * Vì sao cần: tài xế đứng ở hiện trường, chụp xong ảnh giao hàng thì mất sóng. Trước
 * đây ảnh mất luôn — mà hiện trường đã dọn, khách đã đi, không chụp lại được. Hàng đợi
 * giữ lại thao tác (kèm ảnh) và tự gửi khi có mạng.
 *
 * Phạm vi: CHỈ các thao tác có ảnh hoặc đổi trạng thái chuyến. Không dùng cho request
 * đọc (đọc thì cứ tải lại khi có mạng là xong).
 *
 * An toàn khi gửi lại: backend đã chặn trùng ở mọi luồng trong danh sách —
 * máy trạng thái chặn (nhận chuyến, lấy hàng, giao hàng, hoàn hàng, xác nhận thu tiền),
 * riêng khai chi phí dùng clientRequestId. Không có hai lớp đó thì hàng đợi này sẽ
 * sinh dữ liệu trùng mỗi lần thử lại.
 */

const KEY_QUEUE = 'offline_queue_v1';
const PHOTO_DIR = `${FileSystem.documentDirectory}queue-photos/`;
const MAX_ATTEMPTS = 5;

export type QueueItem = {
    id: string;
    createdAt: number;
    /** Đường dẫn API, ví dụ '/api/trips/123/complete' */
    path: string;
    method: 'POST' | 'PATCH';
    /** Các trường text gửi kèm (multipart) */
    fields: Record<string, string>;
    /** Ảnh đã COPY vào thư mục riêng của app — null nếu thao tác không có ảnh */
    photoUri: string | null;
    /** Tên field của ảnh trong multipart: 'proof' | 'receipt' ... */
    photoField: string;
    /** Mô tả cho tài xế đọc, ví dụ "Xác nhận giao hàng chuyến #123" */
    label: string;
    attempts: number;
    lastError: string | null;
    /** true khi server từ chối vì lý do nghiệp vụ — không thử lại nữa, chờ tài xử lý */
    failedPermanently: boolean;
};

type Listener = (items: QueueItem[]) => void;
const listeners = new Set<Listener>();
let cache: QueueItem[] | null = null;

const makeId = () =>
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

async function doc(): Promise<QueueItem[]> {
    if (cache) return cache;
    try {
        const raw = await AsyncStorage.getItem(KEY_QUEUE);
        cache = raw ? (JSON.parse(raw) as QueueItem[]) : [];
    } catch {
        cache = [];
    }
    return cache;
}

async function ghi(items: QueueItem[]): Promise<void> {
    cache = items;
    await AsyncStorage.setItem(KEY_QUEUE, JSON.stringify(items)).catch(() => {});
    listeners.forEach((fn) => fn(items));
}

/**
 * Copy ảnh sang thư mục riêng của app.
 * Ảnh do expo-camera chụp nằm trong thư mục cache — hệ điều hành có quyền dọn bất cứ
 * lúc nào khi máy thiếu bộ nhớ. Nằm trong hàng đợi vài giờ mà bị dọn thì mất trắng.
 */
async function persistPhoto(uri: string, id: string): Promise<string> {
    await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true }).catch(() => {});
    const ext = uri.split('.').pop()?.split('?')[0] || 'jpg';
    const dest = `${PHOTO_DIR}${id}.${ext}`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
}

async function deletePhoto(uri: string | null): Promise<void> {
    if (!uri || !uri.startsWith(PHOTO_DIR)) return;
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
}

// ─── API công khai ────────────────────────────────────────────────────────────

export const offlineQueue = {
    /** Đưa một thao tác vào hàng đợi. Trả về item đã tạo. */
    async enqueue(input: {
        path: string;
        method?: 'POST' | 'PATCH';
        fields?: Record<string, string>;
        photoUri?: string | null;
        photoField?: string;
        label: string;
    }): Promise<QueueItem> {
        const id = makeId();
        const photoUri = input.photoUri ? await persistPhoto(input.photoUri, id) : null;

        const item: QueueItem = {
            id,
            createdAt: Date.now(),
            path: input.path,
            method: input.method ?? 'POST',
            fields: input.fields ?? {},
            photoUri,
            photoField: input.photoField ?? 'proof',
            label: input.label,
            attempts: 0,
            lastError: null,
            failedPermanently: false,
        };

        const items = await doc();
        await ghi([...items, item]);
        return item;
    },

    async list(): Promise<QueueItem[]> {
        return [...(await doc())];
    },

    /** Số việc còn chờ gửi (không tính việc đã hỏng hẳn) */
    async pendingCount(): Promise<number> {
        return (await doc()).filter((i) => !i.failedPermanently).length;
    },

    async remove(id: string): Promise<void> {
        const items = await doc();
        const item = items.find((i) => i.id === id);
        await deletePhoto(item?.photoUri ?? null);
        await ghi(items.filter((i) => i.id !== id));
    },

    subscribe(fn: Listener): () => void {
        listeners.add(fn);
        void doc().then(fn);
        return () => listeners.delete(fn);
    },

    /**
     * Gửi lần lượt các việc đang chờ. Gọi khi có mạng trở lại.
     * Gửi TUẦN TỰ chứ không song song: các thao tác trên cùng một chuyến phụ thuộc
     * thứ tự (lấy hàng phải trước giao hàng), gửi song song sẽ hỏng máy trạng thái.
     */
    async flush(): Promise<{ succeeded: number; failed: number }> {
        const items = (await doc()).filter((i) => !i.failedPermanently);
        let succeeded = 0;
        let failed = 0;

        for (const item of items) {
            const result = await sendItem(item);

            if (result === 'ok') {
                await offlineQueue.remove(item.id);
                succeeded += 1;
                continue;
            }

            failed += 1;
            const current = await doc();
            const updated = current.map((i) => {
                if (i.id !== item.id) return i;
                const attemptCount = i.attempts + 1;
                return {
                    ...i,
                    attempts: attemptCount,
                    lastError: result.errorText,
                    // Server từ chối vì nghiệp vụ (4xx) thì gửi lại bao nhiêu lần cũng
                    // hỏng — dừng lại để tài xế xem và tự xử, đừng quay vòng vô ích.
                    failedPermanently: result.permanent || attemptCount >= MAX_ATTEMPTS,
                };
            });
            await ghi(updated);

            // Lỗi mạng thì các việc sau cũng sẽ lỗi — dừng luôn, đợi lần sau
            if (!result.permanent) break;
        }

        return { succeeded, failed };
    },

    /** Dọn sạch — chỉ dùng khi đăng xuất */
    async clear(): Promise<void> {
        const items = await doc();
        await Promise.all(items.map((i) => deletePhoto(i.photoUri)));
        await ghi([]);
    },
};

// ─── Gửi một item ─────────────────────────────────────────────────────────────

type KetQuaGui = 'ok' | { errorText: string; permanent: boolean };

async function sendItem(item: QueueItem): Promise<KetQuaGui> {
    const token = await tokenStorage.getToken();
    const csrf = await tokenStorage.getCsrfToken();

    const form = new FormData();
    for (const [k, v] of Object.entries(item.fields)) form.append(k, v);
    if (item.photoUri) {
        const fileName = item.photoUri.split('/').pop() ?? 'photo.jpg';
        form.append(item.photoField, {
            uri: item.photoUri,
            name: fileName,
            type: 'image/jpeg',
        } as unknown as Blob);
    }

    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (csrf) headers['X-CSRF-Token'] = csrf;

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 90_000);
        let res: Response;
        try {
            res = await fetch(`${getApiBaseUrl()}${item.path}`, {
                method: item.method,
                headers,
                body: form,
                signal: controller.signal,
            });
        } finally {
            clearTimeout(timer);
        }

        if (res.ok) return 'ok';

        const payload = await res.json().catch(() => null);
        const errorText = (payload as { error?: string })?.error ?? `Lỗi ${res.status}`;

        // 409 = trạng thái đã đổi rồi (thường là chính việc này đã gửi thành công ở
        // lần trước nhưng phản hồi không về tới máy) → coi như xong, đừng giữ lại.
        if (res.status === 409) return 'ok';

        // 5xx và 401 còn cơ hội thử lại; 4xx khác là lỗi nghiệp vụ, giữ nguyên chờ tài xử.
        const permanent = res.status >= 400 && res.status < 500 && res.status !== 401;
        return { errorText, permanent };
    } catch (err) {
        return {
            errorText: err instanceof Error ? err.message : 'Không gửi được',
            permanent: false,
        };
    }
}

export default offlineQueue;
