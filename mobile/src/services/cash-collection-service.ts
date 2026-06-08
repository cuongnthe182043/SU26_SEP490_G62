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
    receiptUrl?: string;
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

    create: (payload: CreateCollectionPayload): Promise<{ message: string; collection: CashCollection }> =>
        apiClient.post('/api/cash-collections', {
            amount:        payload.amount,
            paymentMethod: payload.paymentMethod ?? 'cash',
            shipmentId:    payload.shipmentId,
            notes:         payload.notes,
            receiptUrl:    payload.receiptUrl,
        }),
};
