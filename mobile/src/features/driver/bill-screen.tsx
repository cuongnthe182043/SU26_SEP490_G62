import { useEffect, useState } from 'react';
import {
    ActivityIndicator, Alert, KeyboardAvoidingView, Modal,
    Platform, Pressable, RefreshControl, ScrollView,
    StyleSheet, TextInput, View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AlertTriangle, CheckCircle2, Clock, Plus, RotateCcw, XCircle } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';

import { AppText }      from '@/components/app-text';
import { ScreenHeader } from '@/components/screen-header';
import { appTheme }     from '@/theme/app-theme';
import { useBill, useCreateBill } from '@/hooks/use-bill';
import type { Bill, BillPaymentMethod } from '@/services/bill-service';

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
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

const STATUS_CONFIG = {
    pending: {
        label: 'Chờ xác nhận',
        icon: (s: number) => <Clock size={s} color={appTheme.colors.warning} />,
        bg: appTheme.colors.warningSoft, text: appTheme.colors.warningText, border: appTheme.colors.warningBorder,
    },
    confirmed: {
        label: 'Đã xác nhận',
        icon: (s: number) => <CheckCircle2 size={s} color={appTheme.colors.success} />,
        bg: appTheme.colors.successSoft, text: appTheme.colors.successText, border: appTheme.colors.successBorder,
    },
    rejected: {
        label: 'Bị từ chối',
        icon: (s: number) => <XCircle size={s} color={appTheme.colors.danger} />,
        bg: appTheme.colors.dangerSoft, text: appTheme.colors.dangerText, border: appTheme.colors.dangerBorder,
    },
    converted: {
        label: 'Chuyển thành công nợ',
        icon: (s: number) => <RotateCcw size={s} color={appTheme.colors.textMuted} />,
        bg: appTheme.colors.surfaceSoft, text: appTheme.colors.textMuted, border: appTheme.colors.border,
    },
} as const;

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({ summary }: { summary: NonNullable<ReturnType<typeof useBill>['summary']> }) {
    const hasPending  = Number(summary.pending_count) > 0;
    const hasRejected = Number(summary.rejected_count) > 0;

    return (
        <YStack gap={10}>
            <YStack
                padding={18} borderRadius={appTheme.radius.xl}
                backgroundColor={hasPending ? appTheme.colors.warningSoft : appTheme.colors.surfaceSoft}
                borderWidth={1.5}
                borderColor={hasPending ? appTheme.colors.warningBorder : appTheme.colors.border}
            >
                <Text fontSize={11} color={appTheme.colors.textMuted} marginBottom={2}>
                    Đang chờ xác nhận — chưa tính công nợ
                </Text>
                <Text fontSize={24} fontWeight="900"
                    color={hasPending ? appTheme.colors.warningText : appTheme.colors.textMuted}
                >
                    {fmtMoneyFull(summary.pending_amount)}
                </Text>
                <Text fontSize={11} color={appTheme.colors.textMuted}>
                    {summary.pending_count} bill chờ xác nhận
                </Text>
            </YStack>

            <XStack gap={10}>
                <YStack flex={1} padding={14} borderRadius={appTheme.radius.lg}
                    backgroundColor={appTheme.colors.successSoft}
                    borderWidth={1} borderColor={appTheme.colors.successBorder}
                >
                    <Text fontSize={10} color={appTheme.colors.textMuted}>Đã xác nhận</Text>
                    <Text fontSize={16} fontWeight="900" color={appTheme.colors.successText}>
                        {fmtMoney(summary.confirmed_amount)}
                    </Text>
                    <Text fontSize={10} color={appTheme.colors.textMuted}>{summary.confirmed_count} bill</Text>
                </YStack>

                {hasRejected ? (
                    <YStack flex={1} padding={14} borderRadius={appTheme.radius.lg}
                        backgroundColor={appTheme.colors.dangerSoft}
                        borderWidth={1} borderColor={appTheme.colors.dangerBorder}
                    >
                        <Text fontSize={10} color={appTheme.colors.textMuted}>Bị từ chối</Text>
                        <Text fontSize={16} fontWeight="900" color={appTheme.colors.dangerText}>
                            {summary.rejected_count} bill
                        </Text>
                        <Text fontSize={10} color={appTheme.colors.dangerText}>Cần xử lý lại</Text>
                    </YStack>
                ) : null}
            </XStack>
        </YStack>
    );
}

// ─── Bill card ────────────────────────────────────────────────────────────────

function BillCard({ item }: { item: Bill }) {
    const cfg = STATUS_CONFIG[item.status];

    return (
        <YStack
            padding={16} borderRadius={appTheme.radius.lg}
            borderWidth={1} borderColor={cfg.border}
            backgroundColor={appTheme.colors.surface}
            gap={8}
        >
            <XStack alignItems="center" justifyContent="space-between">
                <Text fontSize={16} fontWeight="900" color={appTheme.colors.text}>
                    {fmtMoneyFull(item.amount)}
                </Text>
                <XStack gap={5} alignItems="center"
                    paddingHorizontal={8} paddingVertical={4}
                    borderRadius={appTheme.radius.pill}
                    backgroundColor={cfg.bg}
                    borderWidth={1} borderColor={cfg.border}
                >
                    {cfg.icon(11)}
                    <Text fontSize={10} fontWeight="700" color={cfg.text}>{cfg.label}</Text>
                </XStack>
            </XStack>

            <XStack gap={16}>
                <YStack>
                    <Text fontSize={10} color={appTheme.colors.textMuted}>Hình thức</Text>
                    <Text fontSize={12} fontWeight="700" color={appTheme.colors.text}>
                        {item.payment_method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
                    </Text>
                </YStack>
                <YStack>
                    <Text fontSize={10} color={appTheme.colors.textMuted}>Thời gian</Text>
                    <Text fontSize={12} fontWeight="700" color={appTheme.colors.text}>
                        {fmtDate(item.collected_at)}
                    </Text>
                </YStack>
            </XStack>

            {item.trip_code ? (
                <Text fontSize={11} color={appTheme.colors.textMuted}>
                    Chuyến: {item.trip_code}{item.cargo_name ? ` — ${item.cargo_name}` : ''}
                </Text>
            ) : null}

            {item.notes ? (
                <Text fontSize={11} color={appTheme.colors.textMuted} numberOfLines={2}>{item.notes}</Text>
            ) : null}

            {item.status === 'rejected' && item.reject_reason ? (
                <XStack gap={6} alignItems="flex-start"
                    padding={8} borderRadius={appTheme.radius.sm}
                    backgroundColor={appTheme.colors.dangerSoft}
                >
                    <XCircle size={12} color={appTheme.colors.danger} style={{ marginTop: 1 }} />
                    <Text fontSize={11} color={appTheme.colors.dangerText} flex={1}>
                        Lý do từ chối: {item.reject_reason}
                    </Text>
                </XStack>
            ) : null}

            {item.status === 'confirmed' && item.confirmed_at ? (
                <Text fontSize={11} color={appTheme.colors.successText}>
                    Xác nhận lúc: {fmtDate(item.confirmed_at)}
                </Text>
            ) : null}
        </YStack>
    );
}

// ─── Create modal ─────────────────────────────────────────────────────────────

const METHODS: { value: BillPaymentMethod; label: string }[] = [
    { value: 'cash',          label: 'Tiền mặt' },
    { value: 'bank_transfer', label: 'Chuyển khoản' },
];

function CreateModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState<BillPaymentMethod>('cash');
    const [notes,  setNotes]  = useState('');
    const { isSubmitting, error, submit } = useCreateBill();

    const handleSubmit = async () => {
        const n = Number(amount.replace(/[^0-9]/g, ''));
        if (!n || n <= 0) { Alert.alert('Lỗi', 'Vui lòng nhập số tiền hợp lệ'); return; }
        const ok = await submit({ amount: n, paymentMethod: method, notes: notes.trim() || undefined });
        if (ok) {
            Alert.alert('Thành công', 'Đã tạo bill. Kế toán sẽ xác nhận sớm.', [
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
                    <View style={s.handle} />

                    <Text fontSize={17} fontWeight="900" color={appTheme.colors.text} marginBottom={4}>
                        Tạo bill thu hộ
                    </Text>
                    <Text fontSize={13} color={appTheme.colors.textMuted} marginBottom={20}>
                        Kế toán sẽ xác nhận. Trong lúc chờ không tính là công nợ.
                    </Text>

                    <Text fontSize={13} fontWeight="700" color={appTheme.colors.text} marginBottom={6}>
                        Số tiền thu hộ (₫)
                    </Text>
                    <TextInput
                        style={s.input}
                        value={amount}
                        onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))}
                        keyboardType="numeric"
                        placeholder="Nhập số tiền khách trả..."
                        placeholderTextColor={appTheme.colors.textMuted}
                    />

                    <Text fontSize={13} fontWeight="700" color={appTheme.colors.text} marginBottom={6} marginTop={14}>
                        Khách thanh toán bằng
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

                    <Text fontSize={13} fontWeight="700" color={appTheme.colors.text} marginBottom={6}>
                        Ghi chú (không bắt buộc)
                    </Text>
                    <TextInput
                        style={[s.input, { height: 72, textAlignVertical: 'top' }]}
                        value={notes}
                        onChangeText={setNotes}
                        placeholder="Tên khách, số hóa đơn, ghi chú thêm..."
                        placeholderTextColor={appTheme.colors.textMuted}
                        multiline
                    />

                    {error ? (
                        <Text fontSize={12} color={appTheme.colors.danger} marginTop={8}>{error}</Text>
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
                                : <Text fontSize={14} fontWeight="900" color="#fff">Tạo bill</Text>
                            }
                        </Pressable>
                    </XStack>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function BillScreen() {
    const { bills, summary, isLoading, error, reload } = useBill();
    const [showCreate, setShowCreate] = useState(false);

    useEffect(() => { reload(); }, [reload]);

    const pending   = bills.filter((b) => b.status === 'pending');
    const rejected  = bills.filter((b) => b.status === 'rejected');
    const confirmed = bills.filter((b) => b.status === 'confirmed');
    const converted = bills.filter((b) => b.status === 'converted');

    const handleSuccess = () => { setShowCreate(false); reload(); };

    return (
        <View style={{ flex: 1, backgroundColor: appTheme.colors.background }}>
            <StatusBar style="dark" />
            <ScreenHeader title="Thu hộ tiền (Bill)" showBack />

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={s.content}
                refreshControl={
                    <RefreshControl refreshing={isLoading} onRefresh={reload} tintColor={appTheme.colors.primary} />
                }
                showsVerticalScrollIndicator={false}
            >
                {summary ? <SummaryCard summary={summary} /> : null}

                {error ? (
                    <XStack padding={14} borderRadius={appTheme.radius.md}
                        backgroundColor={appTheme.colors.dangerSoft}
                        borderWidth={1} borderColor={appTheme.colors.dangerBorder}
                        gap={8} alignItems="center"
                    >
                        <AlertTriangle size={15} color={appTheme.colors.danger} />
                        <AppText variant="caption" tone="danger" flex={1}>{error}</AppText>
                    </XStack>
                ) : null}

                {isLoading && bills.length === 0 ? (
                    <YStack alignItems="center" paddingVertical={40} gap={12}>
                        <ActivityIndicator color={appTheme.colors.primary} />
                        <AppText variant="caption" tone="muted">Đang tải...</AppText>
                    </YStack>
                ) : null}

                {pending.length > 0 ? (
                    <YStack gap={8}>
                        <Text fontSize={14} fontWeight="900" color={appTheme.colors.warningText}>
                            Chờ xác nhận ({pending.length})
                        </Text>
                        {pending.map((b) => <BillCard key={b.id} item={b} />)}
                    </YStack>
                ) : null}

                {rejected.length > 0 ? (
                    <YStack gap={8}>
                        <Text fontSize={14} fontWeight="900" color={appTheme.colors.dangerText}>
                            Bị từ chối — cần xử lý ({rejected.length})
                        </Text>
                        {rejected.map((b) => <BillCard key={b.id} item={b} />)}
                    </YStack>
                ) : null}

                {confirmed.length > 0 ? (
                    <YStack gap={8}>
                        <Text fontSize={14} fontWeight="900" color={appTheme.colors.successText}>
                            Đã xác nhận ({confirmed.length})
                        </Text>
                        {confirmed.map((b) => <BillCard key={b.id} item={b} />)}
                    </YStack>
                ) : null}

                {converted.length > 0 ? (
                    <YStack gap={8}>
                        <Text fontSize={14} fontWeight="900" color={appTheme.colors.textMuted}>
                            Đã chuyển thành công nợ ({converted.length})
                        </Text>
                        {converted.map((b) => <BillCard key={b.id} item={b} />)}
                    </YStack>
                ) : null}

                {!isLoading && bills.length === 0 && !error ? (
                    <YStack padding={32} borderRadius={appTheme.radius.lg}
                        backgroundColor={appTheme.colors.surfaceSoft}
                        borderWidth={1} borderColor={appTheme.colors.border}
                        alignItems="center" gap={10}
                    >
                        <AppText variant="bodyStrong" tone="muted">Chưa có bill nào</AppText>
                        <AppText variant="caption" tone="muted">Nhấn "Tạo bill" để bắt đầu</AppText>
                    </YStack>
                ) : null}
            </ScrollView>

            <Pressable style={s.fab} onPress={() => setShowCreate(true)}>
                <Plus size={22} color="#fff" />
                <Text fontSize={14} fontWeight="900" color="#fff">Tạo bill</Text>
            </Pressable>

            {showCreate ? (
                <CreateModal onClose={() => setShowCreate(false)} onSuccess={handleSuccess} />
            ) : null}
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    content: {
        paddingHorizontal: appTheme.spacing.screenX,
        paddingTop: 16,
        paddingBottom: appTheme.spacing.screenBottom + 80,
        gap: 16,
    },
    fab: {
        position: 'absolute',
        bottom: appTheme.spacing.screenBottom + 16,
        right: appTheme.spacing.screenX,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: appTheme.colors.primary,
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
        elevation: 6,
    },
    modalOverlay: { flex: 1, justifyContent: 'flex-end' },
    modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
    modalSheet: {
        backgroundColor: appTheme.colors.background,
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        padding: 24, paddingTop: 12,
    },
    handle: {
        width: 40, height: 4, borderRadius: 2,
        backgroundColor: appTheme.colors.border,
        alignSelf: 'center', marginBottom: 20,
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
        alignItems: 'center', backgroundColor: appTheme.colors.surfaceSoft,
    },
    methodBtnActive: {
        borderColor: appTheme.colors.primaryMuted,
        backgroundColor: appTheme.colors.primarySoft,
    },
    actionBtn: { flex: 1, paddingVertical: 14, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    cancelBtn: { backgroundColor: appTheme.colors.surfaceSoft, borderWidth: 1, borderColor: appTheme.colors.border },
    confirmBtn: { backgroundColor: appTheme.colors.primary },
});
