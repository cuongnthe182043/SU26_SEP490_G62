import { apiClient } from '@/lib/api-client';

export type DebtStatus = 'unpaid' | 'partial' | 'paid' | 'overdue';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'offset';

export type DebtPayment = {
    id: number;
    amount: string;
    payment_method: PaymentMethod;
    paid_at: string;
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

export const debtService = {
    getMyDebts: (status?: DebtStatus): Promise<{ debts: DriverDebt[] }> => {
        const q = status ? `?status=${status}` : '';
        return apiClient.get(`/api/debts/me${q}`);
    },

    getSummary: (): Promise<DebtSummary> =>
        apiClient.get('/api/debts/summary'),

    getPayments: (debtId: number): Promise<{ payments: DebtPayment[] }> =>
        apiClient.get(`/api/debts/${debtId}/payments`),
};
