import { useEffect, useState } from 'react';
import {
    ActivityIndicator, Pressable, RefreshControl,
    ScrollView, StyleSheet, View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';

import { AppText }      from '@/components/app-text';
import { ScreenHeader } from '@/components/screen-header';
import { appTheme }     from '@/theme/app-theme';
import { useDebt, useDebtPayments } from '@/hooks/use-debt';
import type { DriverDebt, DebtPayment } from '@/services/debt-service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtMoney = (val: string | number) => {
    const n = Number(val);
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M₫`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K₫`;
    return `${n}₫`;
};

const fmtMoneyFull = (val: string | number) =>
    Number(val).toLocaleString('vi-VN') + '₫';

const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

const METHOD_LABEL: Record<string, string> = {
    cash:          'Tiền mặt',
    bank_transfer: 'Chuyển khoản',
    offset:        'Bù trừ',
};

const DEBT_LABEL: Record<string, { label: string; bg: string; text: string; border: string }> = {
    unpaid:  { label: 'Chưa trả',   bg: appTheme.colors.dangerSoft,  text: appTheme.colors.dangerText,  border: appTheme.colors.dangerBorder },
    partial: { label: 'Trả 1 phần', bg: appTheme.colors.warningSoft, text: appTheme.colors.warningText, border: appTheme.colors.warningBorder },
    overdue: { label: 'Quá hạn',    bg: appTheme.colors.dangerSoft,  text: appTheme.colors.danger,      border: appTheme.colors.dangerBorder },
    paid:    { label: 'Đã trả đủ',  bg: appTheme.colors.successSoft, text: appTheme.colors.successText, border: appTheme.colors.successBorder },
};

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({ summary }: { summary: NonNullable<ReturnType<typeof useDebt>['summary']> }) {
    const hasDebt = Number(summary.total_remaining) > 0;

    return (
        <YStack
            padding={20} borderRadius={appTheme.radius.xl}
            backgroundColor={hasDebt ? appTheme.colors.dangerSoft : appTheme.colors.successSoft}
            borderWidth={1.5}
            borderColor={hasDebt ? appTheme.colors.dangerBorder : appTheme.colors.successBorder}
            gap={12}
        >
            <YStack>
                <Text fontSize={12} color={appTheme.colors.textMuted}>Tổng công nợ còn lại</Text>
                <Text
                    fontSize={26} fontWeight="900" lineHeight={32}
                    color={hasDebt ? appTheme.colors.dangerText : appTheme.colors.successText}
                >
                    {fmtMoneyFull(summary.total_remaining)}
                </Text>
            </YStack>

            {Number(summary.overdue_remaining) > 0 ? (
                <XStack gap={6} alignItems="center"
                    padding={10} borderRadius={appTheme.radius.sm}
                    backgroundColor={appTheme.colors.dangerSoft}
                    borderWidth={1} borderColor={appTheme.colors.dangerBorder}
                >
                    <AlertTriangle size={13} color={appTheme.colors.danger} />
                    <Text fontSize={12} color={appTheme.colors.dangerText} fontWeight="700">
                        Quá hạn: {fmtMoney(summary.overdue_remaining)}
                    </Text>
                </XStack>
            ) : null}

            {!hasDebt ? (
                <Text fontSize={13} color={appTheme.colors.successText} fontWeight="700" textAlign="center">
                    Không có công nợ — Xuất sắc!
                </Text>
            ) : null}

            <Text fontSize={11} color={appTheme.colors.textMuted} fontStyle="italic">
                Công nợ do kế toán tạo. Để báo thu hộ tiền khách, dùng chức năng "Thu hộ".
            </Text>
        </YStack>
    );
}

// ─── Payment row ──────────────────────────────────────────────────────────────

function PaymentRow({ p }: { p: DebtPayment }) {
    return (
        <XStack
            padding={10} borderRadius={appTheme.radius.sm}
            backgroundColor={appTheme.colors.surfaceSoft}
            borderWidth={1} borderColor={appTheme.colors.border}
            alignItems="center" gap={10}
        >
            <YStack flex={1}>
                <Text fontSize={12} fontWeight="700" color={appTheme.colors.successText}>
                    {METHOD_LABEL[p.payment_method] ?? p.payment_method}
                </Text>
                <Text fontSize={11} color={appTheme.colors.textMuted}>{fmtDate(p.paid_at)}</Text>
                {p.notes ? (
                    <Text fontSize={11} color={appTheme.colors.textMuted} numberOfLines={1}>{p.notes}</Text>
                ) : null}
            </YStack>
            <Text fontSize={13} fontWeight="900" color={appTheme.colors.successText}>
                {fmtMoney(p.amount)}
            </Text>
        </XStack>
    );
}

// ─── Debt card ────────────────────────────────────────────────────────────────

function DebtCard({ debt }: { debt: DriverDebt }) {
    const [expanded, setExpanded] = useState(false);
    const { payments, isLoading, reload } = useDebtPayments(debt.id);
    const badge = DEBT_LABEL[debt.status] ?? DEBT_LABEL.unpaid;

    const handleExpand = () => {
        if (!expanded) reload();
        setExpanded((v) => !v);
    };

    return (
        <YStack
            borderRadius={appTheme.radius.lg}
            borderWidth={1} borderColor={badge.border}
            backgroundColor={appTheme.colors.surface}
            overflow="hidden"
        >
            <Pressable onPress={handleExpand}>
                <XStack padding={16} gap={12} alignItems="flex-start">
                    <YStack flex={1} gap={4}>
                        <XStack gap={8} alignItems="center">
                            <Text fontSize={14} fontWeight="900" color={appTheme.colors.text} flex={1} numberOfLines={1}>
                                {debt.cargo_name ?? (debt.trip_code ? `Chuyến ${debt.trip_code}` : `Công nợ #${debt.id}`)}
                            </Text>
                            <XStack
                                paddingHorizontal={8} paddingVertical={3}
                                borderRadius={appTheme.radius.pill}
                                backgroundColor={badge.bg}
                                borderWidth={1} borderColor={badge.border}
                            >
                                <Text fontSize={10} fontWeight="700" color={badge.text}>{badge.label}</Text>
                            </XStack>
                        </XStack>

                        <XStack gap={16}>
                            <YStack>
                                <Text fontSize={10} color={appTheme.colors.textMuted}>Tổng nợ</Text>
                                <Text fontSize={13} fontWeight="700" color={appTheme.colors.text}>
                                    {fmtMoney(debt.total_amount)}
                                </Text>
                            </YStack>
                            <YStack>
                                <Text fontSize={10} color={appTheme.colors.textMuted}>Đã trả</Text>
                                <Text fontSize={13} fontWeight="700" color={appTheme.colors.successText}>
                                    {fmtMoney(debt.paid_amount)}
                                </Text>
                            </YStack>
                            <YStack>
                                <Text fontSize={10} color={appTheme.colors.textMuted}>Còn lại</Text>
                                <Text fontSize={13} fontWeight="900" color={appTheme.colors.dangerText}>
                                    {fmtMoney(debt.remaining)}
                                </Text>
                            </YStack>
                        </XStack>

                        {debt.due_date ? (
                            <Text fontSize={11} color={appTheme.colors.textMuted}>
                                Hạn: {new Date(debt.due_date).toLocaleDateString('vi-VN')}
                            </Text>
                        ) : null}
                    </YStack>

                    {expanded
                        ? <ChevronUp size={16} color={appTheme.colors.textMuted} />
                        : <ChevronDown size={16} color={appTheme.colors.textMuted} />
                    }
                </XStack>
            </Pressable>

            {expanded ? (
                <YStack
                    padding={16} paddingTop={0} gap={8}
                    borderTopWidth={1} borderTopColor={appTheme.colors.border}
                >
                    <Text fontSize={11} fontWeight="700" color={appTheme.colors.textMuted}>
                        Lịch sử thanh toán (kế toán ghi nhận)
                    </Text>
                    {isLoading ? (
                        <ActivityIndicator color={appTheme.colors.primary} size="small" style={{ marginVertical: 8 }} />
                    ) : payments.length > 0 ? (
                        <YStack gap={6}>
                            {payments.map((p) => <PaymentRow key={p.id} p={p} />)}
                        </YStack>
                    ) : (
                        <Text fontSize={12} color={appTheme.colors.textMuted} textAlign="center" paddingVertical={8}>
                            Chưa có lần thanh toán nào
                        </Text>
                    )}
                </YStack>
            ) : null}
        </YStack>
    );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function DebtScreen() {
    const { debts, summary, isLoading, error, reload } = useDebt();

    useEffect(() => { reload(); }, [reload]);

    const openDebts = debts.filter((d) => d.status !== 'paid');
    const paidDebts = debts.filter((d) => d.status === 'paid');

    return (
        <View style={{ flex: 1, backgroundColor: appTheme.colors.background }}>
            <StatusBar style="dark" />
            <ScreenHeader title="Công nợ của tôi" showBack />

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={s.content}
                refreshControl={
                    <RefreshControl
                        refreshing={isLoading}
                        onRefresh={reload}
                        tintColor={appTheme.colors.primary}
                    />
                }
                showsVerticalScrollIndicator={false}
            >
                {summary ? <SummaryCard summary={summary} /> : null}

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

                {isLoading && debts.length === 0 ? (
                    <YStack alignItems="center" paddingVertical={40} gap={12}>
                        <ActivityIndicator color={appTheme.colors.primary} />
                        <AppText variant="caption" tone="muted">Đang tải công nợ...</AppText>
                    </YStack>
                ) : null}

                {!isLoading && openDebts.length === 0 && !error ? (
                    <YStack
                        padding={32} borderRadius={appTheme.radius.lg}
                        backgroundColor={appTheme.colors.successSoft}
                        borderWidth={1} borderColor={appTheme.colors.successBorder}
                        alignItems="center" gap={10}
                    >
                        <CheckCircle2 size={36} color={appTheme.colors.success} />
                        <AppText variant="bodyStrong" tone="muted">Không có công nợ</AppText>
                    </YStack>
                ) : (
                    <YStack gap={10}>
                        {openDebts.length > 0 ? (
                            <Text fontSize={15} fontWeight="900" color={appTheme.colors.text}>
                                Đang có ({openDebts.length})
                            </Text>
                        ) : null}
                        {openDebts.map((d) => <DebtCard key={d.id} debt={d} />)}
                    </YStack>
                )}

                {paidDebts.length > 0 ? (
                    <YStack gap={10}>
                        <Text fontSize={15} fontWeight="900" color={appTheme.colors.textMuted}>
                            Đã trả ({paidDebts.length})
                        </Text>
                        {paidDebts.map((d) => <DebtCard key={d.id} debt={d} />)}
                    </YStack>
                ) : null}
            </ScrollView>
        </View>
    );
}

const s = StyleSheet.create({
    content: {
        paddingHorizontal: appTheme.spacing.screenX,
        paddingTop: 16,
        paddingBottom: appTheme.spacing.screenBottom + 20,
        gap: 14,
    },
});
