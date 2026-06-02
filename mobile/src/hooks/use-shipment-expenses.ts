import { useCallback, useState } from 'react';
import { tripService } from '@/services/trip-service';
import type { Expense, ExpenseType } from '@/types/trip';

export function useShipmentExpenses(shipmentId: number) {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [isLoading, setLoading] = useState(false);
    const [isSubmitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await tripService.getShipmentExpenses(shipmentId);
            setExpenses(res.expenses);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Không thể tải chi phí');
        } finally {
            setLoading(false);
        }
    }, [shipmentId]);

    const addExpense = useCallback(async (data: {
        expenseType: ExpenseType;
        amount: string;
        description: string;
        receiptUri: string;
    }): Promise<boolean> => {
        setSubmitting(true);
        setError(null);
        try {
            const formData = new FormData();
            formData.append('shipmentId', String(shipmentId));
            formData.append('expenseType', data.expenseType);
            formData.append('amount', data.amount);
            if (data.description.trim()) {
                formData.append('description', data.description.trim());
            }

            const filename = data.receiptUri.split('/').pop() ?? 'receipt.jpg';
            const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg';
            const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
            formData.append('receipt', {
                uri: data.receiptUri,
                name: filename,
                type: mimeMap[ext] ?? 'image/jpeg',
            } as unknown as Blob);

            const res = await tripService.createExpense(formData);
            setExpenses(res.expenses);
            return true;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Không thể thêm chi phí');
            return false;
        } finally {
            setSubmitting(false);
        }
    }, [shipmentId]);

    return { expenses, isLoading, isSubmitting, error, load, addExpense };
}
