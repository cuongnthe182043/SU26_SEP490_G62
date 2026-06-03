import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCameraPermissions } from 'expo-camera';
import {
    AlertTriangle, CheckCircle, History,
    MapPin, Package, RotateCcw, X, XCircle,
} from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';

import { AppText } from '@/components/app-text';
import { LifecycleActionButton } from '@/components/lifecycle-action-button';
import { ScreenHeader } from '@/components/screen-header';
import { TripStatusBadge } from '@/components/trip-status-badge';
import { ActiveTripSkeleton } from '@/components/skeleton';
import { appTheme } from '@/theme/app-theme';
import { useActiveTrip } from '@/hooks/use-active-trip';
import { useCompletionProof } from '@/hooks/use-completion-proof';
import { useReleaseTrip } from '@/hooks/use-release-trip';
import { useShipmentExpenses } from '@/hooks/use-shipment-expenses';
import { useTripLifecycle } from '@/hooks/use-trip-lifecycle';
import type { ActiveTrip, TripStatus } from '@/types/trip';
import { NEXT_ACTIONS } from '@/types/trip';

import { CameraModal }      from './components/camera-modal';
import { ExpenseFormModal }  from './components/expense-form-modal';
import { ExpenseSection }    from './components/expense-section';
import { PhotoCaptureCard }  from './components/photo-capture-card';
import { ReasonModal }       from './components/reason-modal';
import { StatusStepper, STATUS_ACCENT, STATUS_BANNER } from './components/status-stepper';

// ─── Allowed statuses for expense reporting ───────────────────────────────────

const EXPENSE_ALLOWED_STATUSES: TripStatus[] = [
    'claimed', 'picking', 'loaded', 'transit', 'arrived', 'failed', 'returning',
];

// ─── Small helper components ──────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string | null }) {
    if (!value) return null;
    return (
        <XStack justifyContent="space-between" paddingVertical={6}>
            <Text fontSize={13} color={appTheme.colors.textMuted}>{label}</Text>
            <Text fontSize={13} fontWeight="800" color={appTheme.colors.text} flex={1} textAlign="right">
                {value}
            </Text>
        </XStack>
    );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <YStack
            borderRadius={appTheme.radius.lg} borderWidth={1}
            borderColor={appTheme.colors.border} backgroundColor={appTheme.colors.surface}
            overflow="hidden"
        >
            <XStack paddingHorizontal={16} paddingVertical={11} backgroundColor={appTheme.colors.surfaceSoft}>
                <Text fontSize={12} fontWeight="900" color={appTheme.colors.textMuted}>
                    {title.toUpperCase()}
                </Text>
            </XStack>
            <YStack padding={16} gap={2}>{children}</YStack>
        </YStack>
    );
}

// ─── Active trip content ──────────────────────────────────────────────────────

function ActiveTripContent({ trip, refresh }: { trip: ActiveTrip; refresh: () => void }) {
    const { isLoading: lifecycleLoading, advance } = useTripLifecycle(() => refresh());
    const [permission, requestPermission] = useCameraPermissions();

    const [receiptUri,   setReceiptUri]   = useState<string | null>(null);
    const [proofUri,     setProofUri]     = useState<string | null>(null);
    const [cameraTarget, setCameraTarget] = useState<'receipt' | 'proof' | null>(null);
    const [showRelease,  setShowRelease]  = useState(false);
    const [showExpense,  setShowExpense]  = useState(false);

    const { isUploading, error: proofError, completeWithProof } = useCompletionProof(() => router.back());
    const { isLoading: releaseLoading, releaseTrip }            = useReleaseTrip(() => router.back());
    const { expenses, load: loadExpenses }                      = useShipmentExpenses(trip.id);

    useEffect(() => { void loadExpenses(); }, [loadExpenses]);

    const isWorking     = lifecycleLoading || isUploading || releaseLoading;
    const nextAction    = NEXT_ACTIONS[trip.status as TripStatus];
    const accent        = STATUS_ACCENT[trip.status as TripStatus];
    const banner        = STATUS_BANNER[trip.status as TripStatus];
    const isArrived     = trip.status === 'arrived';
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

    const handleMarkFailed = () => {
        Alert.alert(
            'Xác nhận giao thất bại',
            'Không thể giao hàng cho khách? Bạn sẽ cần hoàn hàng về điểm lấy ban đầu.',
            [
                { text: 'Hủy', style: 'cancel' },
                { text: 'Xác nhận', style: 'destructive', onPress: () => advance(trip.id, 'failed') },
            ],
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: appTheme.colors.background }}>
            <ScreenHeader
                title={`Đơn #${trip.order_id} — Chuyến ${trip.shipment_index}/${trip.max_shipment_index}`}
                showBack
                right={<TripStatusBadge status={trip.status as TripStatus} />}
            />

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{
                    paddingHorizontal: appTheme.spacing.screenX,
                    paddingTop: 16,
                    paddingBottom: appTheme.spacing.screenBottom,
                    gap: 14,
                }}
            >
                {/* ── Status stepper ── */}
                <YStack
                    padding={16} borderRadius={appTheme.radius.lg} gap={14}
                    borderWidth={1}
                    borderColor={accent?.border ?? appTheme.colors.border}
                    backgroundColor={accent?.bg ?? appTheme.colors.surfaceSoft}
                >
                    <StatusStepper status={trip.status as TripStatus} />
                    {banner ? (
                        <XStack
                            gap={8} alignItems="center" paddingTop={4}
                            borderTopWidth={1} borderTopColor={accent?.border ?? appTheme.colors.border}
                        >
                            {banner.icon}
                            <Text fontSize={12} fontWeight="800" color={accent?.text ?? appTheme.colors.text} flex={1}>
                                {banner.text}
                            </Text>
                        </XStack>
                    ) : null}
                </YStack>

                {/* ── Leg info ── */}
                <Text fontSize={12} color={appTheme.colors.textMuted} fontWeight="700">
                    {trip.cargo_name ?? 'Hàng hóa'}  •  Chuyến {trip.shipment_index} / {trip.max_shipment_index}
                </Text>

                {/* ── Route ── */}
                <SectionCard title="Tuyến đường">
                    <XStack gap={10} alignItems="flex-start">
                        <XStack width={28} height={28} borderRadius={10}
                            backgroundColor={appTheme.colors.successSoft}
                            alignItems="center" justifyContent="center" marginTop={1}>
                            <MapPin size={13} color={appTheme.colors.success} />
                        </XStack>
                        <YStack flex={1}>
                            <Text fontSize={11} color={appTheme.colors.textMuted} fontWeight="700">ĐIỂM LẤY</Text>
                            <Text fontSize={13} color={appTheme.colors.text} lineHeight={18}>{trip.pickup_address}</Text>
                        </YStack>
                    </XStack>
                    <XStack height={1} backgroundColor={appTheme.colors.border} marginVertical={8} marginLeft={38} />
                    <XStack gap={10} alignItems="flex-start">
                        <XStack width={28} height={28} borderRadius={10}
                            backgroundColor={appTheme.colors.primarySoft}
                            alignItems="center" justifyContent="center" marginTop={1}>
                            <MapPin size={13} color={appTheme.colors.primary} />
                        </XStack>
                        <YStack flex={1}>
                            <Text fontSize={11} color={appTheme.colors.textMuted} fontWeight="700">ĐIỂM GIAO</Text>
                            <Text fontSize={13} color={appTheme.colors.text} lineHeight={18}>{trip.delivery_address}</Text>
                        </YStack>
                    </XStack>
                </SectionCard>

                {/* ── Cargo ── */}
                <SectionCard title="Hàng hóa">
                    <InfoRow label="Tên hàng"    value={trip.cargo_name} />
                    <InfoRow label="Trọng lượng" value={trip.cargo_weight_kg ? `${trip.cargo_weight_kg} kg` : null} />
                    <InfoRow
                        label="Giá trị"
                        value={trip.estimated_price
                            ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })
                                .format(Number(trip.estimated_price))
                            : null}
                    />
                    {trip.notes ? <InfoRow label="Ghi chú" value={trip.notes} /> : null}
                </SectionCard>

                {/* ── Expenses ── */}
                <ExpenseSection
                    expenses={expenses}
                    canAdd={canAddExpense}
                    onAdd={() => setShowExpense(true)}
                />

                {/* ── Final shipment badge ── */}
                {trip.is_final_shipment ? (
                    <XStack padding={12} borderRadius={appTheme.radius.sm}
                        backgroundColor={appTheme.colors.primarySoft}
                        borderWidth={1} borderColor={appTheme.colors.primaryMuted}
                        gap={8} alignItems="center"
                    >
                        <Package size={16} color={appTheme.colors.primary} />
                        <Text fontSize={12} fontWeight="800" color={appTheme.colors.primary} flex={1}>
                            Chuyến cuối — cần thêm ảnh xác nhận hoàn thành đơn hàng
                        </Text>
                    </XStack>
                ) : null}

                {/* ── Returning banner ── */}
                {trip.status === 'returning' ? (
                    <YStack padding={14} borderRadius={appTheme.radius.lg} gap={6}
                        borderWidth={1} borderColor={appTheme.colors.border}
                        backgroundColor={appTheme.colors.surfaceSoft}
                    >
                        <XStack gap={8} alignItems="center">
                            <RotateCcw size={14} color={appTheme.colors.textMuted} />
                            <Text fontSize={12} fontWeight="700" color={appTheme.colors.textMuted}>Điểm trả hàng về:</Text>
                        </XStack>
                        <Text fontSize={13} color={appTheme.colors.text} lineHeight={18}>{trip.pickup_address}</Text>
                    </YStack>
                ) : null}

                {/* ── Photo section (ARRIVED only) ── */}
                {isArrived ? (
                    <YStack gap={10}>
                        <Text fontSize={13} fontWeight="900" color={appTheme.colors.text}>Ảnh xác nhận giao hàng</Text>
                        <PhotoCaptureCard
                            label="Ảnh biên lai"
                            sublabel="Biên lai / chữ ký khách nhận hàng"
                            uri={receiptUri}
                            required
                            onCapture={() => openCamera('receipt')}
                            onDelete={() => setReceiptUri(null)}
                        />
                        {trip.is_final_shipment ? (
                            <PhotoCaptureCard
                                label="Ảnh xác nhận hoàn thành"
                                sublabel="Hàng hóa đã giao tại điểm giao cuối"
                                uri={proofUri}
                                required
                                onCapture={() => openCamera('proof')}
                                onDelete={() => setProofUri(null)}
                            />
                        ) : null}
                        {proofError ? (
                            <XStack padding={10} borderRadius={appTheme.radius.sm}
                                backgroundColor={appTheme.colors.dangerSoft}
                                borderWidth={1} borderColor={appTheme.colors.dangerBorder}
                            >
                                <Text fontSize={12} color={appTheme.colors.danger} flex={1}>{proofError}</Text>
                            </XStack>
                        ) : null}
                    </YStack>
                ) : null}

                {/* ── Action buttons ── */}
                <YStack gap={10}>
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
                            icon={<CheckCircle size={17} color={allPhotosDone ? appTheme.colors.surface : appTheme.colors.textMuted} />}
                        />
                    ) : null}

                    {isArrived ? (
                        <LifecycleActionButton
                            label="Không thể giao hàng"
                            tone="danger"
                            onPress={handleMarkFailed}
                            isLoading={lifecycleLoading}
                            icon={<XCircle size={16} color={appTheme.colors.danger} />}
                        />
                    ) : null}

                    {isReleasable ? (
                        <LifecycleActionButton
                            label="Hủy chuyến"
                            tone="danger"
                            onPress={() => setShowRelease(true)}
                            isLoading={releaseLoading}
                            icon={<X size={16} color={appTheme.colors.danger} />}
                        />
                    ) : null}

                    {/* Incident buttons */}
                    <XStack gap={8}>
                        <Pressable
                            style={s.incidentBtn}
                            onPress={() => router.push({ pathname: '/report-incident', params: { shipmentId: String(trip.id) } })}
                        >
                            <AlertTriangle size={15} color={appTheme.colors.warningText} />
                            <Text fontSize={13} fontWeight="700" color={appTheme.colors.warningText}>Báo sự cố</Text>
                        </Pressable>
                        <Pressable style={s.historyBtn} onPress={() => router.push('/incident-history')}>
                            <History size={15} color={appTheme.colors.textMuted} />
                            <Text fontSize={13} fontWeight="700" color={appTheme.colors.textMuted}>Lịch sử</Text>
                        </Pressable>
                    </XStack>
                </YStack>
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
                placeholder="Lý do hủy (tùy chọn, ví dụ: xe hỏng đột xuất...)"
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
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: appTheme.spacing.screenBottom }} scrollEnabled={false}>
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
    incidentBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        paddingVertical: 11, borderRadius: 12,
        borderWidth: 1.5, borderColor: appTheme.colors.warningBorder,
        backgroundColor: appTheme.colors.warningSoft,
    },
    historyBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        paddingVertical: 11, paddingHorizontal: 16, borderRadius: 12,
        borderWidth: 1.5, borderColor: appTheme.colors.border,
        backgroundColor: appTheme.colors.surfaceSoft,
    },
});
