import { apiClient } from '@/lib/api-client';

export type BillStatus = 'pending' | 'confirmed' | 'rejected' | 'converted';
export type BillPaymentMethod = 'cash' | 'bank_transfer';

export type Bill = {
    id: number;
    amount: string;
    payment_method: BillPaymentMethod;
    status: BillStatus;
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

export type BillSummary = {
    pending_count: string;
    pending_amount: string;
    confirmed_count: string;
    confirmed_amount: string;
    rejected_count: string;
    converted_count: string;
};

export type CreateBillPayload = {
    shipmentId: number;
    amount: number;
    receiptUri: string;
    paymentMethod?: BillPaymentMethod;
    notes?: string;
};

type Filters = {
    status?: BillStatus;
    shipmentId?: number;
    month?: number;
    year?: number;
};

export const billService = {
    getMyBills: (filters: Filters = {}): Promise<{ bills: Bill[] }> => {
        const params = new URLSearchParams();
        if (filters.status)     params.set('status',     filters.status);
        if (filters.shipmentId) params.set('shipmentId', String(filters.shipmentId));
        if (filters.month)      params.set('month',      String(filters.month));
        if (filters.year)       params.set('year',       String(filters.year));
        const q = params.toString() ? `?${params.toString()}` : '';
        return apiClient.get(`/api/bills/me${q}`);
    },

    getSummary: (): Promise<BillSummary> =>
        apiClient.get('/api/bills/summary'),

    getById: (id: number): Promise<{ bill: Bill }> =>
        apiClient.get(`/api/bills/${id}`),

    create: (payload: CreateBillPayload): Promise<{ message: string; bill: Bill }> => {
        const form = new FormData();
        form.append('shipmentId',   String(payload.shipmentId));
        form.append('amount',       String(payload.amount));
        form.append('paymentMethod', payload.paymentMethod ?? 'cash');
        if (payload.notes) form.append('notes', payload.notes);
        form.append('receipt', {
            uri:  payload.receiptUri,
            name: 'receipt.jpg',
            type: 'image/jpeg',
        } as unknown as Blob);
        return apiClient.postForm('/api/bills', form);
    },
};
