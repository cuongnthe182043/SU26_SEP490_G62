import { apiClient } from '@/lib/api-client';

export type CollectionStatus = 'pending' | 'confirmed' | 'rejected' | 'converted';
export type CollectionPaymentMethod = 'cash' | 'bank_transfer';

export type CashCollection = {
    id: number;
    amount: string;
    payment_method: CollectionPaymentMethod;
    status: CollectionStatus;
    notes: string | null;
    receipt_url: string | null;
    collected_at: string;
    confirmed_at: string | null;
    reject_reason: string | null;
    debt_id: number | null;
    shipment_id: number | null;
    trip_code: string | null;
    cargo_name: string | null;
};

export type CollectionSummary = {
    pending_count: string;
    pending_amount: string;
    confirmed_count: string;
    confirmed_amount: string;
    rejected_count: string;
    converted_count: string;
};

export type CreateCollectionPayload = {
    amount: number;
    paymentMethod?: CollectionPaymentMethod;
    shipmentId?: number;
    notes?: string;
    receiptUri: string;  // BR-018: ảnh biên lai bắt buộc, chụp realtime
};

type Filters = {
    status?: CollectionStatus;
    shipmentId?: number;
    month?: number;
    year?: number;
};

export const cashCollectionService = {
    getMyCollections: (filters: Filters = {}): Promise<{ collections: CashCollection[] }> => {
        const params = new URLSearchParams();
        if (filters.status)     params.set('status',     filters.status);
        if (filters.shipmentId) params.set('shipmentId', String(filters.shipmentId));
        if (filters.month)      params.set('month',      String(filters.month));
        if (filters.year)       params.set('year',       String(filters.year));
        const q = params.toString() ? `?${params.toString()}` : '';
        return apiClient.get(`/api/cash-collections/me${q}`);
    },

    getSummary: (): Promise<CollectionSummary> =>
        apiClient.get('/api/cash-collections/summary'),

    getById: (id: number): Promise<{ collection: CashCollection }> =>
        apiClient.get(`/api/cash-collections/${id}`),

    create: (payload: CreateCollectionPayload): Promise<{ message: string; collection: CashCollection }> => {
        const formData = new FormData();
        formData.append('amount',        String(payload.amount));
        formData.append('paymentMethod', payload.paymentMethod ?? 'cash');
        if (payload.shipmentId) formData.append('shipmentId', String(payload.shipmentId));
        if (payload.notes?.trim()) formData.append('notes', payload.notes.trim());

        const filename = payload.receiptUri.split('/').pop() ?? 'receipt.jpg';
        const ext      = filename.split('.').pop()?.toLowerCase() ?? 'jpg';
        const mimeMap: Record<string, string> = {
            jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
        };
        formData.append('receipt', {
            uri:  payload.receiptUri,
            name: filename,
            type: mimeMap[ext] ?? 'image/jpeg',
        } as unknown as Blob);

        return apiClient.postForm('/api/cash-collections', formData);
    },
};
