import { useEffect, useState } from 'react';
import {
    ActivityIndicator, Pressable, RefreshControl,
    ScrollView, StyleSheet, View,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
    AlertTriangle, Award, ChevronLeft, ChevronRight,
    Clock, TrendingUp, Trophy, Truck,
} from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';

import { AppText }    from '@/components/app-text';
import { ScreenHeader } from '@/components/screen-header';
import { appTheme }   from '@/theme/app-theme';
import { useKpi }     from '@/hooks/use-kpi';
import type { KpiRecord } from '@/services/kpi-service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
    '', 'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4',
    'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8',
    'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
];

const fmtRevenue = (val: string | number) => {
    const n = Number(val);
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
    return String(n);
};

const fmtRate = (val: string | number) => `${Number(val).toFixed(1)}%`;

// ─── Month navigator ──────────────────────────────────────────────────────────

function MonthNav({
    month, year,
    onPrev, onNext,
}: {
    month: number; year: number;
    onPrev: () => void; onNext: () => void;
}) {
    const now = new Date();
    const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();

    return (
        <XStack
            alignItems="center" justifyContent="space-between"
            padding={16}
            backgroundColor={appTheme.colors.surface}
            borderRadius={appTheme.radius.lg}
            borderWidth={1} borderColor={appTheme.colors.border}
        >
            <Pressable onPress={onPrev} hitSlop={12} style={s.navBtn}>
                <ChevronLeft size={20} color={appTheme.colors.primary} />
            </Pressable>

            <YStack alignItems="center" gap={2}>
                <Text fontSize={18} fontWeight="900" color={appTheme.colors.text}>
                    {MONTH_NAMES[month]} / {year}
                </Text>
                {isCurrentMonth ? (
                    <View style={s.currentBadge}>
                        <Text fontSize={10} fontWeight="700" color={appTheme.colors.primary}>
                            Tháng hiện tại
                        </Text>
                    </View>
                ) : null}
            </YStack>

            <Pressable
                onPress={onNext}
                hitSlop={12}
                style={[s.navBtn, isCurrentMonth && { opacity: 0.3 }]}
                disabled={isCurrentMonth}
            >
                <ChevronRight size={20} color={appTheme.colors.primary} />
            </Pressable>
        </XStack>
    );
}

// ─── KPI stat card ────────────────────────────────────────────────────────────

function StatCard({
    icon, label, value, sub, color,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    sub?: string;
    color: string;
}) {
    return (
        <YStack
            flex={1} padding={16} gap={10}
            backgroundColor={appTheme.colors.surface}
            borderRadius={appTheme.radius.lg}
            borderWidth={1} borderColor={appTheme.colors.border}
        >
            <XStack
                width={38} height={38} borderRadius={12}
                backgroundColor={color + '22'}
                alignItems="center" justifyContent="center"
            >
                {icon}
            </XStack>
            <YStack gap={2}>
                <Text fontSize={22} fontWeight="900" color={appTheme.colors.text}>{value}</Text>
                <Text fontSize={12} fontWeight="700" color={appTheme.colors.textMuted}>{label}</Text>
                {sub ? <Text fontSize={11} color={appTheme.colors.textMuted}>{sub}</Text> : null}
            </YStack>
        </YStack>
    );
}

// ─── No data placeholder ──────────────────────────────────────────────────────

function EmptyMonth({ month, year }: { month: number; year: number }) {
    return (
        <YStack
            padding={32} borderRadius={appTheme.radius.lg}
            backgroundColor={appTheme.colors.surface}
            borderWidth={1} borderColor={appTheme.colors.border}
            alignItems="center" gap={12}
        >
            <XStack
                width={56} height={56} borderRadius={20}
                backgroundColor={appTheme.colors.surfaceSoft}
                alignItems="center" justifyContent="center"
            >
                <Truck size={26} color={appTheme.colors.textMuted} />
            </XStack>
            <AppText variant="bodyStrong" tone="muted">
                Chưa có dữ liệu
            </AppText>
            <AppText variant="caption" tone="muted">
                Chưa có KPI nào được ghi nhận cho {MONTH_NAMES[month]}/{year}
            </AppText>
        </YStack>
    );
}

// ─── KPI Detail Card ──────────────────────────────────────────────────────────

function KpiDetailCard({ record }: { record: KpiRecord }) {
    const onTimeRate = Number(record.on_time_rate);
    const onTimeColor = onTimeRate >= 90
        ? appTheme.colors.success
        : onTimeRate >= 70
            ? appTheme.colors.warning
            : appTheme.colors.danger;

    return (
        <YStack gap={16}>
            {/* Row 1: Chuyến + Doanh thu */}
            <XStack gap={12}>
                <StatCard
                    icon={<Truck size={18} color={appTheme.colors.primary} />}
                    label="Chuyến hoàn thành"
                    value={String(record.completed_shipments)}
                    sub={record.late_deliveries > 0 ? `${record.late_deliveries} chuyến trễ` : 'Không trễ chuyến nào'}
                    color={appTheme.colors.primary}
                />
                <StatCard
                    icon={<TrendingUp size={18} color={appTheme.colors.success} />}
                    label="Doanh thu thực tế"
                    value={fmtRevenue(record.total_revenue)}
                    sub="Không tính phí trung gian"
                    color={appTheme.colors.success}
                />
            </XStack>

            {/* Row 2: Đúng giờ + Sự cố */}
            <XStack gap={12}>
                <StatCard
                    icon={<Clock size={18} color={onTimeColor} />}
                    label="Tỷ lệ đúng giờ"
                    value={fmtRate(record.on_time_rate)}
                    color={onTimeColor}
                />
                <StatCard
                    icon={<AlertTriangle size={18} color={record.incident_count > 0 ? appTheme.colors.danger : appTheme.colors.success} />}
                    label="Sự cố"
                    value={String(record.incident_count)}
                    sub={record.critical_incident_count > 0
                        ? `${record.critical_incident_count} khẩn cấp`
                        : record.major_incident_count > 0
                            ? `${record.major_incident_count} nghiêm trọng`
                            : 'Không có sự cố nghiêm trọng'}
                    color={record.incident_count > 0 ? appTheme.colors.danger : appTheme.colors.success}
                />
            </XStack>

            {/* On-time rate bar */}
            <YStack
                padding={16}
                backgroundColor={appTheme.colors.surface}
                borderRadius={appTheme.radius.lg}
                borderWidth={1} borderColor={appTheme.colors.border}
                gap={10}
            >
                <XStack justifyContent="space-between" alignItems="center">
                    <Text fontSize={13} fontWeight="700" color={appTheme.colors.text}>
                        Tỷ lệ đúng giờ
                    </Text>
                    <Text fontSize={14} fontWeight="900" color={onTimeColor}>
                        {fmtRate(record.on_time_rate)}
                    </Text>
                </XStack>
                <View style={s.barTrack}>
                    <View style={[
                        s.barFill,
                        {
                            width: `${Math.min(onTimeRate, 100)}%` as any,
                            backgroundColor: onTimeColor,
                        },
                    ]} />
                </View>
                <XStack justifyContent="space-between">
                    <Text fontSize={11} color={appTheme.colors.textMuted}>
                        {record.completed_shipments - record.late_deliveries} chuyến đúng giờ
                    </Text>
                    <Text fontSize={11} color={appTheme.colors.textMuted}>
                        / {record.completed_shipments} tổng chuyến
                    </Text>
                </XStack>
            </YStack>

            {/* Nhóm xe */}
            <XStack
                padding={12} borderRadius={appTheme.radius.md}
                backgroundColor={appTheme.colors.surfaceSoft}
                borderWidth={1} borderColor={appTheme.colors.border}
                alignItems="center" gap={8}
            >
                <Truck size={14} color={appTheme.colors.textMuted} />
                <Text fontSize={12} color={appTheme.colors.textMuted}>
                    Nhóm xe: <Text fontWeight="700" color={appTheme.colors.text}>{record.vehicle_group_name}</Text>
                </Text>
            </XStack>
        </YStack>
    );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function KpiScreen() {
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year,  setYear]  = useState(now.getFullYear());

    const { records, isLoading, error, reload } = useKpi(month, year);

    useEffect(() => { reload(); }, [reload]);

    const record = records[0] ?? null;

    const goToPrev = () => {
        if (month === 1) { setMonth(12); setYear((y) => y - 1); }
        else setMonth((m) => m - 1);
    };

    const goToNext = () => {
        const now = new Date();
        if (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1)) return;
        if (month === 12) { setMonth(1); setYear((y) => y + 1); }
        else setMonth((m) => m + 1);
    };

    return (
        <View style={{ flex: 1, backgroundColor: appTheme.colors.background }}>
            <StatusBar style="dark" />
            <ScreenHeader
                title="KPI của tôi"
                showBack
                right={
                    <Pressable
                        onPress={() => router.push({ pathname: '/leaderboard', params: { month: String(month), year: String(year) } })}
                        style={s.rankBtn}
                        hitSlop={10}
                    >
                        <Trophy size={14} color={appTheme.colors.primary} />
                        <Text fontSize={12} fontWeight="700" color={appTheme.colors.primary}>
                            Xếp hạng
                        </Text>
                    </Pressable>
                }
            />

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{
                    paddingHorizontal: appTheme.spacing.screenX,
                    paddingTop: 16,
                    paddingBottom: appTheme.spacing.screenBottom + 20,
                    gap: 16,
                }}
                refreshControl={
                    <RefreshControl refreshing={isLoading} onRefresh={reload} tintColor={appTheme.colors.primary} />
                }
                showsVerticalScrollIndicator={false}
            >
                {/* Month navigator */}
                <MonthNav month={month} year={year} onPrev={goToPrev} onNext={goToNext} />

                {/* Error */}
                {error ? (
                    <XStack
                        padding={14} borderRadius={appTheme.radius.md}
                        backgroundColor={appTheme.colors.dangerSoft}
                        borderWidth={1} borderColor={appTheme.colors.dangerBorder}
                        gap={8} alignItems="center"
                    >
                        <AlertTriangle size={15} color={appTheme.colors.danger} />
                        <AppText variant="caption" tone="danger" flex={1}>{error}</AppText>
                    </XStack>
                ) : null}

                {/* Loading */}
                {isLoading ? (
                    <YStack alignItems="center" paddingVertical={40} gap={12}>
                        <ActivityIndicator color={appTheme.colors.primary} />
                        <AppText variant="caption" tone="muted">Đang tải KPI...</AppText>
                    </YStack>
                ) : null}

                {/* KPI data */}
                {!isLoading && !error ? (
                    record
                        ? <KpiDetailCard record={record} />
                        : <EmptyMonth month={month} year={year} />
                ) : null}

                {/* Leaderboard CTA */}
                {!isLoading && record ? (
                    <Pressable
                        style={s.leaderboardCta}
                        onPress={() => router.push({ pathname: '/leaderboard', params: { month: String(month), year: String(year) } })}
                    >
                        <Award size={18} color={appTheme.colors.primary} />
                        <YStack flex={1} gap={2}>
                            <Text fontSize={14} fontWeight="900" color={appTheme.colors.primary}>
                                Xem bảng xếp hạng tháng {month}/{year}
                            </Text>
                            <Text fontSize={12} color={appTheme.colors.textMuted}>
                                So sánh trong nhóm xe {record.vehicle_group_name}
                            </Text>
                        </YStack>
                        <ChevronRight size={16} color={appTheme.colors.primary} />
                    </Pressable>
                ) : null}
            </ScrollView>
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    navBtn: {
        width: 36, height: 36, borderRadius: 12,
        backgroundColor: appTheme.colors.primarySoft,
        alignItems: 'center', justifyContent: 'center',
    },
    currentBadge: {
        paddingHorizontal: 8, paddingVertical: 2,
        borderRadius: appTheme.radius.pill,
        backgroundColor: appTheme.colors.primarySoft,
        borderWidth: 1, borderColor: appTheme.colors.primaryMuted,
    },
    rankBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
    },
    barTrack: {
        height: 8, borderRadius: 4,
        backgroundColor: appTheme.colors.surfaceSoft,
        overflow: 'hidden',
    },
    barFill: {
        height: '100%', borderRadius: 4,
    },
    leaderboardCta: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        padding: 16,
        backgroundColor: appTheme.colors.primarySoft,
        borderRadius: appTheme.radius.lg,
        borderWidth: 1.5, borderColor: appTheme.colors.primaryMuted,
    },
});
