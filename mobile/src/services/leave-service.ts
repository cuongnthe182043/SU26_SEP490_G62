import { apiClient } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LeaveType = 'paid' | 'unpaid';

export type LeaveRequest = {
    id: number;
    leave_date: string;        // YYYY-MM-DD
    leave_type: LeaveType;
    reason: string | null;
    status: 'approved' | 'rejected';
    created_at: string;
};

export type AttendanceSummary = {
    total_leaves: string;
    unpaid_days: string;
    paid_days: string;
    working_days: number;
};

// ─── Service ──────────────────────────────────────────────────────────────────

export const leaveService = {
    getMyLeaves: (params?: { month?: number; year?: number }): Promise<{ leaves: LeaveRequest[] }> => {
        const q = new URLSearchParams();
        if (params?.month) q.set('month', String(params.month));
        if (params?.year)  q.set('year',  String(params.year));
        return apiClient.get(`/api/leave/me${q.toString() ? `?${q}` : ''}`);
    },

    getSummary: (month: number, year: number): Promise<AttendanceSummary> =>
        apiClient.get(`/api/leave/summary?month=${month}&year=${year}`),

    create: (payload: {
        leaveDate: string;
        leaveType: LeaveType;
        reason?: string;
    }): Promise<{ message: string; leave: LeaveRequest }> =>
        apiClient.post('/api/leave', payload),

    delete: (id: number): Promise<{ message: string }> =>
        apiClient.delete(`/api/leave/${id}`),
};
