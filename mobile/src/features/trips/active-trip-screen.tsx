import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCameraPermissions } from 'expo-camera';
import {
    AlertTriangle, ChevronDown, ChevronUp,
    CheckCircle, MapPin, Package,
    PlusCircle, RotateCcw, X, XCircle,
} from 'lucide-react-native';
import { Image } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';

import { AppText }             from '@/components/app-text';
import { LifecycleActionButton } from '@/components/lifecycle-action-button';
import { ScreenHeader }        from '@/components/screen-header';
import { TripStatusBadge }     from '@/components/trip-status-badge';
import { ActiveTripSkeleton }  from '@/components/skeleton';
import { appTheme }            from '@/theme/app-theme';
import { useActiveTrip }       from '@/hooks/use-active-trip';
import { useCompletionProof }  from '@/hooks/use-completion-proof';
import { useReleaseTrip }      from '@/hooks/use-release-trip';
import { useShipmentExpenses } from '@/hooks/use-shipment-expenses';
import { useTripLifecycle }    from '@/hooks/use-trip-lifecycle';
import { useToast, useAppAlert, useConfirm } from '@/providers/ui-provider';
import type { ActiveTrip, Expense, TripStatus } from '@/types/trip';
import { EXPENSE_TYPE_LABEL, NEXT_ACTIONS } from '@/types/trip';

import { CameraModal }     from './components/camera-modal';
import { ExpenseFormModal } from './components/expense-form-modal';
import { PhotoCaptureCard } from './components/photo-capture-card';
import { ReasonModal }     from './components/reason-modal';
import { StatusStepper, STATUS_ACCENT, STATUS_BANNER } from './components/status-stepper';

// Toast message shown after each lifecycle transition
const STATUS_ADVANCE_TOAST: Partial<Record<TripStatus, string>> = {
    picking:   'Đang di chuyển đến điểm lấy hàng',
    loaded:    'Đã lấy hàng xong — chuẩn bị xuất phát',
    transit:   'Đang vận chuyển hàng đến điểm giao',
    arrived:   'Đã đến điểm giao — tiến hành giao hàng',
    failed:    'Ghi nhận giao thất bại — cần hoàn hàng về điểm lấy',
    returning: 'Đang hoàn hàng về điểm lấy',
};

// ─── Constants ────────────────────────────────────────────────────────────────

const EXPENSE_ALLOWED_STATUSES: TripStatus[] = [
    'claimed', 'picking', 'loaded', 'transit', 'arrived', 'failed', 'returning',
];

const fmt = (v: string | number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(v));

// ─── Collapsible section ──────────────────────────────────────────────────────

function CollapsibleSection({
    label,
    badge,
    defaultOpen = false,
    children,
}: {
    label: string;
    badge?: string;
    defaultOpen?: boolean;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <YStack
            borderRadius={appTheme.radius.lg} borderWidth={1}
            borderColor={appTheme.colors.border} backgroundColor={appTheme.colors.surface}
            overflow="hidden"
        >
            <Pressable onPress={() => setOpen(v => !v)}>
                <XStack
                    paddingHorizontal={16} paddingVertical={12}
                    backgroundColor={appTheme.colors.surfaceSoft}
                    alignItems="center" justifyContent="space-between"
                >
                    <XStack alignItems="center" gap={8}>
                        <Text fontSize={12} fontWeight="900" color={appTheme.colors.textMuted}>
                            {label.toUpperCase()}
                        </Text>
                        {badge ? (
                            <View style={s.badge}>
                                <Text fontSize={10} fontWeight="700" color={appTheme.colors.primary}>{badge}</Text>
                            </View>
                        ) : null}
                    </XStack>
                    {open
                        ? <ChevronUp size={15} color={appTheme.colors.textMuted} />
                        : <ChevronDown size={15} color={appTheme.colors.textMuted} />}
                </XStack>
            </Pressable>
            {open ? (
                <YStack padding={14} gap={8}>{children}</YStack>
            ) : null}
        </YStack>
    );
}

// ─── Compact route row ────────────────────────────────────────────────────────

function RouteRow({ pickup, delivery, isReturning }: {
    pickup: string;
    delivery: string;
    isReturning?: boolean;
}) {
    return (
        <YStack
            borderRadius={appTheme.radius.lg} borderWidth={1}
            borderColor={appTheme.colors.border} backgroundColor={appTheme.colors.surface}
            paddingHorizontal={14} paddingVertical={12} gap={8}
        >
            <XStack alignItems="flex-start" gap={10}>
                <View style={[s.routeDot, { backgroundColor: appTheme.colors.successSoft, borderColor: appTheme.colors.success }]}>
                    <MapPin size={11} color={appTheme.colors.success} />
                </View>
                <YStack flex={1}>
                    <Text fontSize={10} fontWeight="700" color={appTheme.colors.textMuted}>
                        {isReturning ? 'ĐIỂM TRẢ HÀNG VỀ' : 'ĐIỂM LẤY'}
                    </Text>
                    <Text fontSize={13} color={appTheme.colors.text} lineHeight={18} numberOfLines={2}>
                        {pickup}
                    </Text>
                </YStack>
            </XStack>

            {!isReturning ? (
                <>
                    <View style={s.routeLine} />
                    <XStack alignItems="flex-start" gap={10}>
                        <View style={[s.routeDot, { backgroundColor: appTheme.colors.primarySoft, borderColor: appTheme.colors.primary }]}>
                            <MapPin size={11} color={appTheme.colors.primary} />
                        </View>
                        <YStack flex={1}>
                            <Text fontSize={10} fontWeight="700" color={appTheme.colors.textMuted}>ĐIỂM GIAO</Text>
                            <Text fontSize={13} color={appTheme.colors.text} lineHeight={18} numberOfLines={2}>
                                {delivery}
                            </Text>
                        </YStack>
                    </XStack>
                </>
            ) : null}
        </YStack>
    );
}

// ─── Inline expense list ──────────────────────────────────────────────────────

function ExpenseInlineList({ expenses, canAdd, onAdd }: {
    expenses: Expense[];
    canAdd: boolean;
    onAdd: () => void;
}) {
    if (expenses.length === 0 && !canAdd) {
        return <Text fontSize={12} color={appTheme.colors.textMuted}>Chưa có chi phí nào</Text>;
    }
    const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

    return (
        <YStack gap={10}>
            {expenses.map((e) => (
                <YStack key={e.id} gap={6}>
                    <XStack justifyContent="space-between" alignItems="center">
                        <Text fontSize={13} color={appTheme.colors.text}>{EXPENSE_TYPE_LABEL[e.expense_type]}</Text>
                        <Text fontSize={13} fontWeight="800" color={appTheme.colors.primary}>{fmt(e.amount)}</Text>
                    </XStack>
                    {e.description ? (
                        <Text fontSize={11} color={appTheme.colors.textMuted}>{e.description}</Text>
                    ) : null}
                    {e.receipt_urls.length > 0 ? (
                        <XStack gap={6} flexWrap="wrap">
                            {e.receipt_urls.map((url, i) => (
                                <Image
                                    key={i}
                                    source={{ uri: url }}
                                    style={s.receiptThumb}
                                    resizeMode="cover"
                                />
                            ))}
                        </XStack>
                    ) : null}
                </YStack>
            ))}
            {expenses.length > 1 ? (
                <XStack justifyContent="space-between" paddingTop={6}
                    borderTopWidth={1} borderTopColor={appTheme.colors.border}>
                    <Text fontSize={12} fontWeight="700" color={appTheme.colors.textMuted}>Tổng</Text>
                    <Text fontSize={13} fontWeight="900" color={appTheme.colors.text}>{fmt(total)}</Text>
                </XStack>
            ) : null}
            {canAdd ? (
                <Pressable onPress={onAdd} style={s.addExpenseBtn}>
                    <PlusCircle size={14} color={appTheme.colors.primary} />
                    <Text fontSize={12} fontWeight="700" color={appTheme.colors.primary}>Thêm chi phí</Text>
                </Pressable>
            ) : null}
        </YStack>
    );
}

// ─── Active trip content ──────────────────────────────────────────────────────

function ActiveTripContent({ trip, refresh }: { trip: ActiveTrip; refresh: () => void }) {
    const { showToast }   = useToast();
    const { showAlert }   = useAppAlert();
    const { showConfirm } = useConfirm();

    const { isLoading: lifecycleLoading, advance } = useTripLifecycle((updatedTrip) => {
        const msg = STATUS_ADVANCE_TOAST[updatedTrip.status as TripStatus];
        if (msg) showToast({ type: 'success', message: msg, duration: 2500 });
        refresh();
    });

    const [permission, requestPermission] = useCameraPermissions();

    const [receiptUri,   setReceiptUri]   = useState<string | null>(null);
    const [proofUri,     setProofUri]     = useState<string | null>(null);
    const [cameraTarget, setCameraTarget] = useState<'receipt' | 'proof' | null>(null);
    const [showRelease,  setShowRelease]  = useState(false);
    const [showExpense,  setShowExpense]  = useState(false);

    const { isUploading, error: proofError, completeWithProof } = useCompletionProof(async () => {
        await showAlert({
            type: 'success',
            title: 'Hoàn thành chuyến!',
            message: 'Chuyến đã được xác nhận giao hàng thành công.',
            okLabel: 'Tuyệt vời!',
        });
        router.back();
    });
    const { isLoading: releaseLoading, releaseTrip }            = useReleaseTrip(() => router.back());
    const { expenses, load: loadExpenses }                      = useShipmentExpenses(trip.id);

    useEffect(() => { void loadExpenses(); }, [loadExpenses]);

    const isWorking     = lifecycleLoading || isUploading || releaseLoading;
    const nextAction    = NEXT_ACTIONS[trip.status as TripStatus];
    const accent        = STATUS_ACCENT[trip.status as TripStatus];
    const banner        = STATUS_BANNER[trip.status as TripStatus];
    const isArrived     = trip.status === 'arrived';
    const isReturning   = trip.status === 'returning';
    const isReleasable  = trip.status === 'claimed' || trip.status === 'picking';
    const canAddExpense = EXPENSE_ALLOWED_STATUSES.includes(trip.status as TripStatus);
    const allPhotosDone = isArrived && !!receiptUri && (!trip.is_final_shipment || !!proofUri);

    const openCamera = async (target: 'receipt' | 'proof') => {
        if (!permission?.granted) {
            const res = await requestPermission();
            if (!res.granted) {
                Alert.alert('Cần quyền camera', 'Vui lòng cấp quyền camera trong cài đặt.');
                return;
            }
        }
        setCameraTarget(target);
    };

    const handleMarkFailed = async () => {
        const ok = await showConfirm({
            title:        'Xác nhận giao thất bại?',
            message:      'Không thể giao hàng cho khách? Bạn sẽ cần hoàn hàng về điểm lấy ban đầu.',
            confirmLabel: 'Xác nhận thất bại',
            cancelLabel:  'Hủy',
            danger:       true,
        });
        if (!ok) return;
        await advance(trip.id, 'failed');
    };

    const expenseBadge = expenses.length > 0
        ? `${expenses.length} khoản · ${fmt(expenses.reduce((s, e) => s + Number(e.amount), 0))}`
        : undefined;

    return (
        <View style={{ flex: 1, backgroundColor: appTheme.colors.background }}>
            <ScreenHeader
                title={`Đơn #${trip.order_id} · ${trip.shipment_index}/${trip.max_shipment_index}`}
                showBack
                right={<TripStatusBadge status={trip.status as TripStatus} />}
            />

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{
                    paddingHorizontal: appTheme.spacing.screenX,
                    paddingTop: 14,
                    paddingBottom: appTheme.spacing.screenBottom + 16,
                    gap: 10,
                }}
                showsVerticalScrollIndicator={false}
            >
                {/* ── Status card ── */}
                <YStack
                    padding={14} borderRadius={appTheme.radius.lg} gap={12}
                    borderWidth={1}
                    borderColor={accent?.border ?? appTheme.colors.border}
                    backgroundColor={accent?.bg ?? appTheme.colors.surfaceSoft}
                >
                    <StatusStepper status={trip.status as TripStatus} />
                    {banner ? (
                        <XStack gap={8} alignItems="center" paddingTop={4}
                            borderTopWidth={1} borderTopColor={accent?.border ?? appTheme.colors.border}>
                            {banner.icon}
                            <Text fontSize={12} fontWeight="800"
                                color={accent?.text ?? appTheme.colors.text} flex={1}>
                                {banner.text}
                            </Text>
                        </XStack>
                    ) : null}
                </YStack>

                {/* ── Route ── */}
                <RouteRow
                    pickup={trip.pickup_address}
                    delivery={trip.delivery_address}
                    isReturning={isReturning}
                />

                {/* ── Cargo details (collapsible) ── */}
                <CollapsibleSection
                    label="Hàng hóa"
                    badge={trip.cargo_name ?? undefined}
                >
                    {trip.cargo_name ? (
                        <XStack justifyContent="space-between">
                            <Text fontSize={12} color={appTheme.colors.textMuted}>Tên hàng</Text>
                            <Text fontSize={12} fontWeight="700" color={appTheme.colors.text}>{trip.cargo_name}</Text>
                        </XStack>
                    ) : null}
                    {trip.cargo_weight_kg ? (
                        <XStack justifyContent="space-between">
                            <Text fontSize={12} color={appTheme.colors.textMuted}>Trọng lượng</Text>
                            <Text fontSize={12} fontWeight="700" color={appTheme.colors.text}>{trip.cargo_weight_kg} kg</Text>
                        </XStack>
                    ) : null}
                    {trip.estimated_price ? (
                        <XStack justifyContent="space-between">
                            <Text fontSize={12} color={appTheme.colors.textMuted}>Giá trị</Text>
                            <Text fontSize={12} fontWeight="700" color={appTheme.colors.text}>
                                {fmt(trip.estimated_price)}
                            </Text>
                        </XStack>
                    ) : null}
                    {trip.notes ? (
                        <XStack justifyContent="space-between" alignItems="flex-start" gap={12}>
                            <Text fontSize={12} color={appTheme.colors.textMuted}>Ghi chú</Text>
                            <Text fontSize={12} fontWeight="700" color={appTheme.colors.text}
                                flex={1} textAlign="right" numberOfLines={3}>{trip.notes}</Text>
                        </XStack>
                    ) : null}
                    {trip.is_final_shipment ? (
                        <XStack gap={6} alignItems="center" paddingTop={4}
                            borderTopWidth={1} borderTopColor={appTheme.colors.border}>
                            <Package size={12} color={appTheme.colors.primary} />
                            <Text fontSize={11} fontWeight="700" color={appTheme.colors.primary}>
                                Chuyến cuối của đơn hàng
                            </Text>
                        </XStack>
                    ) : null}
                </CollapsibleSection>

                {/* ── Expenses (collapsible) ── */}
                <CollapsibleSection label="Chi phí phát sinh" badge={expenseBadge}>
                    <ExpenseInlineList
                        expenses={expenses}
                        canAdd={canAddExpense}
                        onAdd={() => setShowExpense(true)}
                    />
                </CollapsibleSection>

                {/* ── Photo section (ARRIVED only) ── */}
                {isArrived ? (
                    <YStack
                        borderRadius={appTheme.radius.lg} borderWidth={1}
                        borderColor={appTheme.colors.successSoft}
                        backgroundColor={appTheme.colors.surface}
                        padding={14} gap={10}
                    >
                        <Text fontSize={12} fontWeight="900" color={appTheme.colors.textMuted}>
                            ẢNH XÁC NHẬN GIAO HÀNG
                        </Text>
                        <PhotoCaptureCard
                            label="Ảnh biên lai"
                            sublabel="Biên lai / chữ ký khách nhận"
                            uri={receiptUri}
                            required
                            onCapture={() => openCamera('receipt')}
                            onDelete={() => setReceiptUri(null)}
                        />
                        {trip.is_final_shipment ? (
                            <PhotoCaptureCard
                                label="Ảnh xác nhận hoàn thành"
                                sublabel="Hàng đã giao tại điểm cuối"
                                uri={proofUri}
                                required
                                onCapture={() => openCamera('proof')}
                                onDelete={() => setProofUri(null)}
                            />
                        ) : null}
                        {proofError ? (
                            <AppText variant="caption" tone="danger">{proofError}</AppText>
                        ) : null}
                    </YStack>
                ) : null}

                {/* ── Primary action ── */}
                {nextAction && !isArrived ? (
                    <LifecycleActionButton
                        label={nextAction.label}
                        tone={nextAction.tone}
                        onPress={() => advance(trip.id, nextAction.nextStatus)}
                        isLoading={isWorking}
                    />
                ) : null}

                {isArrived ? (
                    <LifecycleActionButton
                        label={isUploading ? 'Đang tải ảnh...' : 'Hoàn thành chuyến'}
                        tone="primary"
                        onPress={() => { if (receiptUri) completeWithProof(trip.id, receiptUri, proofUri ?? undefined); }}
                        isLoading={isUploading}
                        disabled={!allPhotosDone}
                        icon={<CheckCircle size={17} color={allPhotosDone ? '#fff' : appTheme.colors.textMuted} />}
                    />
                ) : null}

                {/* ── Secondary actions row ── */}
                <XStack gap={8}>
                    {isArrived ? (
                        <Pressable style={[s.secondaryBtn, s.dangerBtn]} onPress={handleMarkFailed}>
                            <XCircle size={14} color={appTheme.colors.danger} />
                            <Text fontSize={12} fontWeight="700" color={appTheme.colors.danger}>Thất bại</Text>
                        </Pressable>
                    ) : null}

                    {isReleasable ? (
                        <Pressable style={[s.secondaryBtn, s.dangerBtn]} onPress={() => setShowRelease(true)}>
                            <X size={14} color={appTheme.colors.danger} />
                            <Text fontSize={12} fontWeight="700" color={appTheme.colors.danger}>Hủy chuyến</Text>
                        </Pressable>
                    ) : null}

                    <Pressable
                        style={[s.secondaryBtn, s.warnBtn, { flex: 1 }]}
                        onPress={() => router.push({ pathname: '/report-incident', params: { shipmentId: String(trip.id) } })}
                    >
                        <AlertTriangle size={14} color={appTheme.colors.warningText} />
                        <Text fontSize={12} fontWeight="700" color={appTheme.colors.warningText}>Báo sự cố</Text>
                    </Pressable>
                </XStack>
            </ScrollView>

            {/* ── Modals ── */}
            <CameraModal
                visible={cameraTarget !== null}
                label={cameraTarget === 'receipt' ? 'Chụp ảnh biên lai' : 'Chụp ảnh xác nhận'}
                onCapture={(uri) => {
                    if (cameraTarget === 'receipt') setReceiptUri(uri);
                    else if (cameraTarget === 'proof') setProofUri(uri);
                    setCameraTarget(null);
                }}
                onClose={() => setCameraTarget(null)}
            />

            <ReasonModal
                visible={showRelease}
                title="Hủy chuyến"
                description="Xác nhận hủy chuyến này? Đơn hàng sẽ được trả về pool để tài xế khác nhận."
                placeholder="Lý do hủy (tùy chọn)..."
                confirmLabel="Xác nhận hủy chuyến"
                confirmDanger
                onConfirm={(reason) => { setShowRelease(false); releaseTrip(trip.id, reason || undefined); }}
                onClose={() => setShowRelease(false)}
            />

            <ExpenseFormModal
                visible={showExpense}
                shipmentId={trip.id}
                onClose={() => setShowExpense(false)}
                onSuccess={() => { setShowExpense(false); void loadExpenses(); }}
            />
        </View>
    );
}

// ─── Screen shell ─────────────────────────────────────────────────────────────

export function ActiveTripScreen() {
    const { trip, isLoading, error, refresh } = useActiveTrip();

    if (isLoading) {
        return (
            <View style={{ flex: 1, backgroundColor: appTheme.colors.background }}>
                <ScreenHeader title="Chuyến hiện tại" showBack />
                <ScrollView style={{ flex: 1 }} scrollEnabled={false}
                    contentContainerStyle={{ paddingBottom: appTheme.spacing.screenBottom }}>
                    <ActiveTripSkeleton />
                </ScrollView>
            </View>
        );
    }

    if (error || !trip) {
        return (
            <View style={{ flex: 1, backgroundColor: appTheme.colors.background }}>
                <ScreenHeader title="Chuyến hiện tại" showBack />
                <YStack flex={1} alignItems="center" justifyContent="center" gap={12} padding={24}>
                    <AppText variant="bodyStrong" tone="muted">
                        {error ?? 'Bạn chưa có chuyến nào đang hoạt động.'}
                    </AppText>
                    <AppText variant="caption" tone="primary" onPress={() => router.push('/trip-pool')}>
                        → Xem danh sách chuyến
                    </AppText>
                </YStack>
            </View>
        );
    }

    return (
        <>
            <StatusBar style="dark" />
            <ActiveTripContent trip={trip} refresh={refresh} />
        </>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    // Collapsible badge
    badge: {
        paddingHorizontal: 8, paddingVertical: 2,
        borderRadius: appTheme.radius.pill,
        backgroundColor: appTheme.colors.primarySoft,
        borderWidth: 1, borderColor: appTheme.colors.primaryMuted,
    },

    // Route dots
    routeDot: {
        width: 26, height: 26, borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center', justifyContent: 'center',
        marginTop: 1,
    },
    routeLine: {
        height: 1,
        backgroundColor: appTheme.colors.border,
        marginLeft: 36,
    },

    // Expense receipt thumbnail
    receiptThumb: { width: 52, height: 52, borderRadius: 8 },

    // Expense add button
    addExpenseBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingVertical: 8, paddingHorizontal: 12,
        borderRadius: 10, alignSelf: 'flex-start',
        borderWidth: 1, borderStyle: 'dashed',
        borderColor: appTheme.colors.primaryMuted,
        backgroundColor: appTheme.colors.primarySoft,
    },

    // Secondary action buttons
    secondaryBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
        paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12,
        borderWidth: 1.5,
    },
    dangerBtn: {
        borderColor: appTheme.colors.dangerBorder,
        backgroundColor: appTheme.colors.dangerSoft,
    },
    warnBtn: {
        borderColor: appTheme.colors.warningBorder,
        backgroundColor: appTheme.colors.warningSoft,
    },
});
