import { apiClient } from '@/lib/api-client';

export type DebtStatus = 'unpaid' | 'partial' | 'paid' | 'overdue';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'offset';
export type RepaymentStatus = 'pending' | 'confirmed' | 'rejected';

export type DebtPayment = {
    id: number;
    amount: string;
    payment_method: PaymentMethod;
    status: RepaymentStatus;
    receipt_url: string | null;
    reject_reason: string | null;
    paid_at: string;
    confirmed_at: string | null;
    notes: string | null;
};

export type DriverDebt = {
    id: number;
    total_amount: string;
    paid_amount: string;
    remaining: string;
    status: DebtStatus;
    due_date: string | null;
    notes: string | null;
    created_at: string;
    shipment_id: number | null;
    trip_code: string | null;
    order_id: number | null;
    cargo_name: string | null;
};

export type DebtSummary = {
    open_count: string;
    total_remaining: string;
    overdue_remaining: string;
};

export type SubmitRepaymentPayload = {
    amount: number;
    receiptUri: string;
    paymentMethod?: PaymentMethod;
    notes?: string;
};

export const debtService = {
    getMyDebts: (status?: DebtStatus): Promise<{ debts: DriverDebt[] }> => {
        const q = status ? `?status=${status}` : '';
        return apiClient.get(`/api/debts/me${q}`);
    },

    getSummary: (): Promise<DebtSummary> =>
        apiClient.get('/api/debts/summary'),

    getPayments: (debtId: number): Promise<{ payments: DebtPayment[] }> =>
        apiClient.get(`/api/debts/${debtId}/payments`),

    submitRepayment: (debtId: number, payload: SubmitRepaymentPayload): Promise<{ message: string; payment: DebtPayment }> => {
        const form = new FormData();
        form.append('amount', String(payload.amount));
        form.append('paymentMethod', payload.paymentMethod ?? 'cash');
        if (payload.notes) form.append('notes', payload.notes);
        form.append('receipt', {
            uri:  payload.receiptUri,
            name: 'repayment.jpg',
            type: 'image/jpeg',
        } as unknown as Blob);
        return apiClient.postForm(`/api/debts/${debtId}/repayments`, form);
    },

    cancelRepayment: (paymentId: number): Promise<{ message: string }> =>
        apiClient.delete(`/api/debts/repayments/${paymentId}`),
};
