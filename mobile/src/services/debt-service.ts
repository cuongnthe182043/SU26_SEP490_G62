import { apiClient } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DebtStatus = 'unpaid' | 'partial' | 'paid' | 'overdue';
export type PaymentStatus = 'pending' | 'confirmed' | 'rejected';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'offset';

export type DebtPayment = {
    id: number;
    amount: string;
    payment_method: PaymentMethod;
    status: PaymentStatus;
    paid_at: string;
    notes: string | null;
};

export type DriverDebt = {
    id: number;
    total_amount: string;
    paid_amount: string;
    remaining: string;
    pending_amount: string;   // đã báo, chờ kế toán xác nhận
    net_remaining: string;    // còn cần báo nộp (remaining - pending)
    status: DebtStatus;
    due_date: string | null;
    notes: string | null;
    created_at: string;
    shipment_id: number | null;
    order_id: number | null;
    cargo_name: string | null;
};

export type DebtSummary = {
    open_count: string;
    total_remaining: string;   // tổng tiền còn nợ (chưa xác nhận)
    overdue_remaining: string;
    total_pending: string;     // tổng đang chờ kế toán xác nhận
};

export type RemitPayload = {
    amount: number;
    paymentMethod?: PaymentMethod;
    notes?: string;
};

// ─── Service ──────────────────────────────────────────────────────────────────

export const debtService = {
    getMyDebts: (status?: DebtStatus): Promise<{ debts: DriverDebt[] }> => {
        const q = status ? `?status=${status}` : '';
        return apiClient.get(`/api/debts/me${q}`);
    },

    getSummary: (): Promise<DebtSummary> =>
        apiClient.get('/api/debts/summary'),

    getPayments: (debtId: number): Promise<{ payments: DebtPayment[] }> =>
        apiClient.get(`/api/debts/${debtId}/payments`),

    remit: (
        debtId: number,
        payload: RemitPayload,
    ): Promise<{ message: string; payment: DebtPayment }> =>
        apiClient.post(`/api/debts/${debtId}/remit`, {
            amount: payload.amount,
            paymentMethod: payload.paymentMethod ?? 'cash',
            notes: payload.notes,
        }),
};
