import { useEffect, useState } from 'react';
import {
    ActivityIndicator, Alert, KeyboardAvoidingView, Modal,
    Platform, Pressable, RefreshControl, ScrollView,
    StyleSheet, TextInput, View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
    AlertTriangle, Banknote, CheckCircle2, ChevronDown,
    ChevronUp, Clock, XCircle,
} from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';

import { AppText }     from '@/components/app-text';
import { AppButton }   from '@/components/app-button';
import { ScreenHeader } from '@/components/screen-header';
import { appTheme }    from '@/theme/app-theme';
import { useDebt, useDebtPayments, useRemitDebt } from '@/hooks/use-debt';
import type { DriverDebt, DebtPayment, PaymentMethod } from '@/services/debt-service';

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

const DEBT_LABEL: Record<string, { label: string; bg: string; text: string; border: string }> = {
    unpaid:  { label: 'Chưa nộp',  bg: appTheme.colors.dangerSoft,  text: appTheme.colors.dangerText,  border: appTheme.colors.dangerBorder },
    partial: { label: 'Nộp 1 phần', bg: appTheme.colors.warningSoft, text: appTheme.colors.warningText, border: appTheme.colors.warningBorder },
    overdue: { label: 'Quá hạn',   bg: appTheme.colors.dangerSoft,  text: appTheme.colors.danger,      border: appTheme.colors.dangerBorder },
    paid:    { label: 'Đã nộp đủ', bg: appTheme.colors.successSoft, text: appTheme.colors.successText, border: appTheme.colors.successBorder },
};

const PAYMENT_STATUS: Record<string, { label: string; icon: JSX.Element; color: string }> = {
    pending:   {
        label: 'Chờ xác nhận',
        icon: <Clock size={12} color={appTheme.colors.warning} />,
        color: appTheme.colors.warningText,
    },
    confirmed: {
        label: 'Đã xác nhận',
        icon: <CheckCircle2 size={12} color={appTheme.colors.success} />,
        color: appTheme.colors.successText,
    },
    rejected: {
        label: 'Bị từ chối',
        icon: <XCircle size={12} color={appTheme.colors.danger} />,
        color: appTheme.colors.dangerText,
    },
};

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({ summary }: { summary: NonNullable<ReturnType<typeof useDebt>['summary']> }) {
    const hasDebt    = Number(summary.total_remaining) > 0;
    const hasPending = Number(summary.total_pending) > 0;

    return (
        <YStack
            padding={20} borderRadius={appTheme.radius.xl}
            backgroundColor={hasDebt ? appTheme.colors.dangerSoft : appTheme.colors.successSoft}
            borderWidth={1.5}
            borderColor={hasDebt ? appTheme.colors.dangerBorder : appTheme.colors.successBorder}
            gap={14}
        >
            <XStack alignItems="center" gap={10}>
                <XStack
                    width={44} height={44} borderRadius={16}
                    backgroundColor={hasDebt ? appTheme.colors.danger + '22' : appTheme.colors.success + '22'}
                    alignItems="center" justifyContent="center"
                >
                    <Banknote size={22} color={hasDebt ? appTheme.colors.danger : appTheme.colors.success} />
                </XStack>
                <YStack flex={1}>
                    <Text fontSize={12} color={appTheme.colors.textMuted}>Tổng tiền còn nợ</Text>
                    <Text
                        fontSize={26} fontWeight="900" lineHeight={32}
                        color={hasDebt ? appTheme.colors.dangerText : appTheme.colors.successText}
                    >
                        {fmtMoneyFull(summary.total_remaining)}
                    </Text>
                </YStack>
            </XStack>

            {(hasPending || Number(summary.overdue_remaining) > 0) ? (
                <XStack gap={12}>
                    {hasPending ? (
                        <XStack flex={1} gap={6} alignItems="center"
                            padding={10} borderRadius={appTheme.radius.sm}
                            backgroundColor={appTheme.colors.warningSoft}
                            borderWidth={1} borderColor={appTheme.colors.warningBorder}
                        >
                            <Clock size={13} color={appTheme.colors.warning} />
                            <YStack flex={1}>
                                <Text fontSize={10} color={appTheme.colors.warningText}>Đang chờ xác nhận</Text>
                                <Text fontSize={13} fontWeight="900" color={appTheme.colors.warningText}>
                                    {fmtMoney(summary.total_pending)}
                                </Text>
                            </YStack>
                        </XStack>
                    ) : null}
                    {Number(summary.overdue_remaining) > 0 ? (
                        <XStack flex={1} gap={6} alignItems="center"
                            padding={10} borderRadius={appTheme.radius.sm}
                            backgroundColor={appTheme.colors.dangerSoft}
                            borderWidth={1} borderColor={appTheme.colors.dangerBorder}
                        >
                            <AlertTriangle size={13} color={appTheme.colors.danger} />
                            <YStack flex={1}>
                                <Text fontSize={10} color={appTheme.colors.dangerText}>Quá hạn</Text>
                                <Text fontSize={13} fontWeight="900" color={appTheme.colors.dangerText}>
                                    {fmtMoney(summary.overdue_remaining)}
                                </Text>
                            </YStack>
                        </XStack>
                    ) : null}
                </XStack>
            ) : null}

            {!hasDebt ? (
                <Text fontSize={13} color={appTheme.colors.successText} fontWeight="700" textAlign="center">
                    Không có công nợ — Xuất sắc!
                </Text>
            ) : null}
        </YStack>
    );
}

// ─── Payment history row ──────────────────────────────────────────────────────

function PaymentRow({ p }: { p: DebtPayment }) {
    const s = PAYMENT_STATUS[p.status];
    return (
        <XStack
            padding={10} borderRadius={appTheme.radius.sm}
            backgroundColor={appTheme.colors.surfaceSoft}
            borderWidth={1} borderColor={appTheme.colors.border}
            alignItems="center" gap={10}
        >
            {s.icon}
            <YStack flex={1}>
                <Text fontSize={12} fontWeight="700" color={s.color}>{s.label}</Text>
                <Text fontSize={11} color={appTheme.colors.textMuted}>{fmtDate(p.paid_at)}</Text>
                {p.notes ? <Text fontSize={11} color={appTheme.colors.textMuted} numberOfLines={1}>{p.notes}</Text> : null}
            </YStack>
            <Text fontSize={13} fontWeight="900" color={appTheme.colors.text}>
                {fmtMoney(p.amount)}
            </Text>
        </XStack>
    );
}

// ─── Debt card ────────────────────────────────────────────────────────────────

function DebtCard({
    debt, onRemit,
}: {
    debt: DriverDebt;
    onRemit: (debt: DriverDebt) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const { payments, isLoading, reload } = useDebtPayments(debt.id);

    const badge = DEBT_LABEL[debt.status] ?? DEBT_LABEL.unpaid;
    const netRemaining = Number(debt.net_remaining);
    const hasPending   = Number(debt.pending_amount) > 0;
    const canRemit     = debt.status !== 'paid' && netRemaining > 0;

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
            {/* Header row */}
            <Pressable onPress={handleExpand}>
                <XStack padding={16} gap={12} alignItems="flex-start">
                    <YStack flex={1} gap={4}>
                        <XStack gap={8} alignItems="center" flexWrap="wrap">
                            <Text fontSize={14} fontWeight="900" color={appTheme.colors.text} flex={1} numberOfLines={1}>
                                {debt.cargo_name ?? `Khoản nợ #${debt.id}`}
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

                        <XStack gap={16} flexWrap="wrap">
                            <YStack>
                                <Text fontSize={10} color={appTheme.colors.textMuted}>Tổng nợ</Text>
                                <Text fontSize={13} fontWeight="700" color={appTheme.colors.text}>
                                    {fmtMoney(debt.total_amount)}
                                </Text>
                            </YStack>
                            <YStack>
                                <Text fontSize={10} color={appTheme.colors.textMuted}>Đã xác nhận</Text>
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

                        {hasPending ? (
                            <XStack gap={5} alignItems="center">
                                <Clock size={11} color={appTheme.colors.warning} />
                                <Text fontSize={11} color={appTheme.colors.warningText}>
                                    Đang chờ xác nhận: {fmtMoney(debt.pending_amount)}
                                </Text>
                            </XStack>
                        ) : null}
                    </YStack>

                    {expanded
                        ? <ChevronUp size={16} color={appTheme.colors.textMuted} />
                        : <ChevronDown size={16} color={appTheme.colors.textMuted} />
                    }
                </XStack>
            </Pressable>

            {/* Expanded: payment history + remit button */}
            {expanded ? (
                <YStack
                    padding={16} paddingTop={0} gap={10}
                    borderTopWidth={1} borderTopColor={appTheme.colors.border}
                >
                    {canRemit ? (
                        <AppButton
                            tone="primary"
                            onPress={() => onRemit(debt)}
                        >
                            Báo nộp tiền — {fmtMoney(netRemaining)} còn lại
                        </AppButton>
                    ) : null}

                    {isLoading ? (
                        <ActivityIndicator color={appTheme.colors.primary} size="small" style={{ marginVertical: 8 }} />
                    ) : payments.length > 0 ? (
                        <YStack gap={6}>
                            <Text fontSize={11} fontWeight="700" color={appTheme.colors.textMuted}>
                                Lịch sử nộp tiền
                            </Text>
                            {payments.map((p) => <PaymentRow key={p.id} p={p} />)}
                        </YStack>
                    ) : (
                        <Text fontSize={12} color={appTheme.colors.textMuted} textAlign="center" paddingVertical={8}>
                            Chưa có lịch sử nộp tiền
                        </Text>
                    )}
                </YStack>
            ) : null}
        </YStack>
    );
}

// ─── Remit modal ──────────────────────────────────────────────────────────────

const METHODS: { value: PaymentMethod; label: string }[] = [
    { value: 'cash',          label: 'Tiền mặt' },
    { value: 'bank_transfer', label: 'Chuyển khoản' },
];

function RemitModal({
    debt, onClose, onSuccess,
}: {
    debt: DriverDebt;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const netRemaining = Number(debt.net_remaining);
    const [amount, setAmount] = useState(String(Math.floor(netRemaining)));
    const [method, setMethod] = useState<PaymentMethod>('cash');
    const [notes,  setNotes]  = useState('');
    const { isSubmitting, error, submit } = useRemitDebt();

    const handleSubmit = async () => {
        const n = Number(amount.replace(/[^0-9]/g, ''));
        if (!n || n <= 0) {
            Alert.alert('Lỗi', 'Vui lòng nhập số tiền hợp lệ');
            return;
        }
        if (n > netRemaining) {
            Alert.alert('Lỗi', `Số tiền không được vượt quá ${fmtMoneyFull(netRemaining)}`);
            return;
        }
        const ok = await submit(debt.id, { amount: n, paymentMethod: method, notes: notes.trim() || undefined });
        if (ok) {
            Alert.alert('Thành công', 'Đã báo nộp tiền. Kế toán sẽ xác nhận sớm.', [
                { text: 'Đóng', onPress: onSuccess },
            ]);
        }
    };

    return (
        <Modal visible animationType="slide" transparent onRequestClose={onClose}>
            <KeyboardAvoidingView
                style={s.modalOverlay}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <Pressable style={s.modalBackdrop} onPress={onClose} />
                <View style={s.modalSheet}>
                    {/* Handle */}
                    <View style={s.handle} />

                    <Text fontSize={17} fontWeight="900" color={appTheme.colors.text} marginBottom={4}>
                        Báo nộp tiền
                    </Text>
                    <Text fontSize={13} color={appTheme.colors.textMuted} marginBottom={18}>
                        {debt.cargo_name ?? `Khoản nợ #${debt.id}`}
                        {'  ·  Cần nộp: '}{fmtMoneyFull(netRemaining)}
                    </Text>

                    {/* Amount */}
                    <Text fontSize={13} fontWeight="700" color={appTheme.colors.text} marginBottom={6}>
                        Số tiền nộp (₫)
                    </Text>
                    <TextInput
                        style={s.input}
                        value={amount}
                        onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))}
                        keyboardType="numeric"
                        placeholder="Nhập số tiền..."
                        placeholderTextColor={appTheme.colors.textMuted}
                    />

                    {/* Method */}
                    <Text fontSize={13} fontWeight="700" color={appTheme.colors.text} marginBottom={6} marginTop={14}>
                        Hình thức
                    </Text>
                    <XStack gap={10} marginBottom={14}>
                        {METHODS.map((m) => (
                            <Pressable
                                key={m.value}
                                style={[s.methodBtn, method === m.value && s.methodBtnActive]}
                                onPress={() => setMethod(m.value)}
                            >
                                <Text
                                    fontSize={13} fontWeight="700"
                                    color={method === m.value ? appTheme.colors.primary : appTheme.colors.textMuted}
                                >
                                    {m.label}
                                </Text>
                            </Pressable>
                        ))}
                    </XStack>

                    {/* Notes */}
                    <Text fontSize={13} fontWeight="700" color={appTheme.colors.text} marginBottom={6}>
                        Ghi chú (không bắt buộc)
                    </Text>
                    <TextInput
                        style={[s.input, { height: 72, textAlignVertical: 'top' }]}
                        value={notes}
                        onChangeText={setNotes}
                        placeholder="Nộp tại văn phòng, số biên lai..."
                        placeholderTextColor={appTheme.colors.textMuted}
                        multiline
                    />

                    {error ? (
                        <Text fontSize={12} color={appTheme.colors.danger} marginTop={8}>
                            {error}
                        </Text>
                    ) : null}

                    <XStack gap={10} marginTop={20}>
                        <Pressable style={[s.actionBtn, s.cancelBtn]} onPress={onClose}>
                            <Text fontSize={14} fontWeight="700" color={appTheme.colors.textMuted}>Huỷ</Text>
                        </Pressable>
                        <Pressable
                            style={[s.actionBtn, s.confirmBtn, isSubmitting && { opacity: 0.6 }]}
                            onPress={handleSubmit}
                            disabled={isSubmitting}
                        >
                            {isSubmitting
                                ? <ActivityIndicator color="#fff" size="small" />
                                : <Text fontSize={14} fontWeight="900" color="#fff">Xác nhận báo nộp</Text>
                            }
                        </Pressable>
                    </XStack>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function DebtScreen() {
    const { debts, summary, isLoading, error, reload } = useDebt();
    const [remitTarget, setRemitTarget] = useState<DriverDebt | null>(null);

    useEffect(() => { reload(); }, [reload]);

    const openDebts = debts.filter((d) => d.status !== 'paid');
    const paidDebts = debts.filter((d) => d.status === 'paid');

    const handleRemitSuccess = () => {
        setRemitTarget(null);
        reload();
    };

    return (
        <View style={{ flex: 1, backgroundColor: appTheme.colors.background }}>
            <StatusBar style="dark" />
            <ScreenHeader title="Công nợ của tôi" showBack />

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{
                    paddingHorizontal: appTheme.spacing.screenX,
                    paddingTop: 16,
                    paddingBottom: appTheme.spacing.screenBottom + 20,
                    gap: 14,
                }}
                refreshControl={
                    <RefreshControl
                        refreshing={isLoading}
                        onRefresh={reload}
                        tintColor={appTheme.colors.primary}
                    />
                }
                showsVerticalScrollIndicator={false}
            >
                {/* Summary */}
                {summary ? <SummaryCard summary={summary} /> : null}

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

                {/* Loading skeleton */}
                {isLoading && debts.length === 0 ? (
                    <YStack alignItems="center" paddingVertical={40} gap={12}>
                        <ActivityIndicator color={appTheme.colors.primary} />
                        <AppText variant="caption" tone="muted">Đang tải công nợ...</AppText>
                    </YStack>
                ) : null}

                {/* Open debts */}
                {!isLoading && openDebts.length === 0 && !error ? (
                    <YStack
                        padding={32} borderRadius={appTheme.radius.lg}
                        backgroundColor={appTheme.colors.successSoft}
                        borderWidth={1} borderColor={appTheme.colors.successBorder}
                        alignItems="center" gap={10}
                    >
                        <CheckCircle2 size={36} color={appTheme.colors.success} />
                        <AppText variant="bodyStrong" tone="muted">Không có công nợ</AppText>
                        <AppText variant="caption" tone="muted">Bạn không có khoản nợ nào cần nộp</AppText>
                    </YStack>
                ) : (
                    <YStack gap={10}>
                        {openDebts.length > 0 ? (
                            <Text fontSize={15} fontWeight="900" color={appTheme.colors.text}>
                                Cần nộp ({openDebts.length})
                            </Text>
                        ) : null}
                        {openDebts.map((d) => (
                            <DebtCard key={d.id} debt={d} onRemit={setRemitTarget} />
                        ))}
                    </YStack>
                )}

                {/* Paid debts (collapsed section) */}
                {paidDebts.length > 0 ? (
                    <YStack gap={10}>
                        <Text fontSize={15} fontWeight="900" color={appTheme.colors.textMuted}>
                            Đã nộp đủ ({paidDebts.length})
                        </Text>
                        {paidDebts.map((d) => (
                            <DebtCard key={d.id} debt={d} onRemit={setRemitTarget} />
                        ))}
                    </YStack>
                ) : null}
            </ScrollView>

            {/* Remit modal */}
            {remitTarget ? (
                <RemitModal
                    debt={remitTarget}
                    onClose={() => setRemitTarget(null)}
                    onSuccess={handleRemitSuccess}
                />
            ) : null}
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    modalSheet: {
        backgroundColor: appTheme.colors.background,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 24,
        paddingTop: 12,
    },
    handle: {
        width: 40, height: 4, borderRadius: 2,
        backgroundColor: appTheme.colors.border,
        alignSelf: 'center',
        marginBottom: 20,
    },
    input: {
        borderWidth: 1.5, borderColor: appTheme.colors.border,
        borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
        fontSize: 15, color: appTheme.colors.text,
        backgroundColor: appTheme.colors.surfaceSoft,
    },
    methodBtn: {
        flex: 1, paddingVertical: 10, borderRadius: 14,
        borderWidth: 1.5, borderColor: appTheme.colors.border,
        alignItems: 'center',
        backgroundColor: appTheme.colors.surfaceSoft,
    },
    methodBtnActive: {
        borderColor: appTheme.colors.primaryMuted,
        backgroundColor: appTheme.colors.primarySoft,
    },
    actionBtn: {
        flex: 1, paddingVertical: 14, borderRadius: 16,
        alignItems: 'center', justifyContent: 'center',
    },
    cancelBtn: {
        backgroundColor: appTheme.colors.surfaceSoft,
        borderWidth: 1, borderColor: appTheme.colors.border,
    },
    confirmBtn: {
        backgroundColor: appTheme.colors.primary,
    },
});
