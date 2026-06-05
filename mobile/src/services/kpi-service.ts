import { apiClient } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type KpiRecord = {
    id: number;
    month: number;
    year: number;
    completed_shipments: number;
    total_revenue: string;
    late_deliveries: number;
    incident_count: number;
    major_incident_count: number;
    critical_incident_count: number;
    on_time_rate: string;
    vehicle_group_name: string;
};

export type LeaderboardRow = {
    driver_id: number;
    driver_name: string;
    completed_shipments: number;
    total_revenue: string;
    on_time_rate: string;
    incident_count: number;
    revenue_rank: number;
    trips_rank: number;
    is_me: boolean;
};

export type LeaderboardResponse = {
    vehicle_group_name: string;
    month: number;
    year: number;
    leaderboard: LeaderboardRow[];
};

// ─── Service ──────────────────────────────────────────────────────────────────

export const kpiService = {
    // Driver: xem KPI cá nhân (tất cả tháng hoặc lọc theo tháng/năm)
    getMyKPI: (params?: { month?: number; year?: number }): Promise<{ kpi: KpiRecord[] }> => {
        const q = new URLSearchParams();
        if (params?.month) q.set('month', String(params.month));
        if (params?.year)  q.set('year',  String(params.year));
        return apiClient.get(`/api/kpi/me${q.toString() ? `?${q}` : ''}`);
    },

    // Driver: xem leaderboard nhóm xe của mình
    getLeaderboard: (params?: { month?: number; year?: number }): Promise<LeaderboardResponse> => {
        const q = new URLSearchParams();
        if (params?.month) q.set('month', String(params.month));
        if (params?.year)  q.set('year',  String(params.year));
        return apiClient.get(`/api/kpi/leaderboard${q.toString() ? `?${q}` : ''}`);
    },
};
