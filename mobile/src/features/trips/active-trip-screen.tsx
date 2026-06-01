import { useRef, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
    AlertTriangle, Camera, CheckCircle,
    MapPin, Package, RotateCcw, Trash2, X, XCircle,
} from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';

import { AppText } from '@/components/app-text';
import { LifecycleActionButton } from '@/components/lifecycle-action-button';
import { ScreenHeader } from '@/components/screen-header';
import { TripStatusBadge } from '@/components/trip-status-badge';
import { appTheme } from '@/theme/app-theme';
import { useActiveTrip } from '@/hooks/use-active-trip';
import { useCancelDelivery } from '@/hooks/use-cancel-delivery';
import { useCompletionProof } from '@/hooks/use-completion-proof';
import { useReleaseTrip } from '@/hooks/use-release-trip';
import { useTripLifecycle } from '@/hooks/use-trip-lifecycle';
import type { ActiveTrip, TripStatus } from '@/types/trip';
import { NEXT_ACTIONS } from '@/types/trip';

// ─── Status progress stepper ─────────────────────────────────────────────────

const MAIN_FLOW: TripStatus[]      = ['claimed', 'picking', 'loaded', 'transit', 'arrived', 'completed'];
const RETURN_FLOW: TripStatus[]    = ['failed', 'returning', 'completed'];
const CANCELLED_FLOW: TripStatus[] = ['claimed', 'picking', 'loaded', 'transit', 'arrived', 'cancelled'];

const STEP_LABEL: Partial<Record<TripStatus, string>> = {
    claimed: 'Đã nhận', picking: 'Lấy hàng', loaded: 'Đã chất',
    transit: 'Vận chuyển', arrived: 'Đã đến', completed: 'Hoàn thành',
    failed: 'Thất bại', returning: 'Hoàn hàng', cancelled: 'Đã hủy',
};

const STATUS_ACCENT: Partial<Record<TripStatus, { bg: string; text: string; border: string }>> = {
    claimed:   { bg: appTheme.colors.primarySoft,  text: appTheme.colors.primary,     border: appTheme.colors.primaryMuted },
    picking:   { bg: appTheme.colors.warningSoft,  text: appTheme.colors.warningText, border: appTheme.colors.warningBorder },
    loaded:    { bg: appTheme.colors.warningSoft,  text: appTheme.colors.warningText, border: appTheme.colors.warningBorder },
    transit:   { bg: appTheme.colors.primarySoft,  text: appTheme.colors.primary,     border: appTheme.colors.primaryMuted },
    arrived:   { bg: appTheme.colors.successSoft,  text: appTheme.colors.success,     border: '#a7f3d0' },
    completed: { bg: appTheme.colors.successSoft,  text: appTheme.colors.success,     border: '#a7f3d0' },
    failed:    { bg: '#fee2e2',                    text: appTheme.colors.danger,      border: '#fca5a5' },
    returning: { bg: appTheme.colors.surfaceSoft,  text: appTheme.colors.textMuted,   border: appTheme.colors.border },
    cancelled: { bg: '#fff7ed',                    text: '#c2410c',                   border: '#fed7aa' },
};

const STATUS_BANNER: Partial<Record<TripStatus, { icon: React.ReactNode; text: string }>> = {
    claimed:   { icon: <MapPin size={14} color={appTheme.colors.primary} />,      text: 'Di chuyển đến điểm lấy hàng' },
    picking:   { icon: <Package size={14} color={appTheme.colors.warningText} />, text: 'Đang bốc xếp hàng lên xe' },
    loaded:    { icon: <Package size={14} color={appTheme.colors.warningText} />, text: 'Hàng đã lên xe — sẵn sàng khởi hành' },
    transit:   { icon: <MapPin size={14} color={appTheme.colors.primary} />,      text: 'Đang vận chuyển đến điểm giao' },
    arrived:   { icon: <CheckCircle size={14} color={appTheme.colors.success} />, text: 'Đã đến — chụp ảnh biên lai rồi hoàn thành' },
    failed:    { icon: <AlertTriangle size={14} color={appTheme.colors.danger} />, text: 'Giao hàng thất bại — bắt đầu hoàn hàng' },
    returning: { icon: <MapPin size={14} color={appTheme.colors.textMuted} />,    text: 'Đang hoàn hàng về điểm lấy' },
    cancelled: { icon: <RotateCcw size={14} color="#c2410c" />,                   text: 'Không thể giao — Trả hàng về điểm lấy hàng ban đầu' },
};

function StatusStepper({ status }: { status: TripStatus }) {
    const isCancelled = status === 'cancelled';
    const isReturn    = status === 'failed' || status === 'returning';
    const flow        = isCancelled ? CANCELLED_FLOW : isReturn ? RETURN_FLOW : MAIN_FLOW;
    const curIdx      = flow.indexOf(status);

    return (
        <XStack alignItems="center">
            {flow.map((s, i) => {
                const isPast    = i < curIdx;
                const isCurrent = i === curIdx;
                const isLast    = i === flow.length - 1;
                const dotColor  = isPast
                    ? appTheme.colors.success
                    : isCurrent
                        ? (STATUS_ACCENT[s]?.text ?? appTheme.colors.primary)
                        : appTheme.colors.border;

                return (
                    <XStack key={s} flex={isLast ? 0 : 1} alignItems="center">
                        <YStack alignItems="center" gap={4}>
                            <View style={{
                                width: isCurrent ? 26 : 18, height: isCurrent ? 26 : 18,
                                borderRadius: 8,
                                backgroundColor: isPast ? appTheme.colors.success : isCurrent ? dotColor : appTheme.colors.surfaceSoft,
                                borderWidth: 1.5, borderColor: dotColor,
                                alignItems: 'center', justifyContent: 'center',
                            }}>
                                {isPast ? <CheckCircle size={11} color="#fff" /> : isCurrent ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} /> : null}
                            </View>
                            <Text
                                fontSize={9} fontWeight={isCurrent ? '900' : '600'}
                                color={isPast ? appTheme.colors.success : isCurrent ? dotColor : appTheme.colors.textMuted}
                                style={{ width: 54, textAlign: 'center' }}
                                numberOfLines={1}
                            >
                                {STEP_LABEL[s]}
                            </Text>
                        </YStack>
                        {!isLast ? (
                            <View style={{ flex: 1, height: 2, marginBottom: 16, backgroundColor: isPast ? appTheme.colors.success : appTheme.colors.border }} />
                        ) : null}
                    </XStack>
                );
            })}
        </XStack>
    );
}

// ─── Reason input modal ───────────────────────────────────────────────────────

function ReasonModal({
    visible,
    title,
    description,
    placeholder,
    required,
    confirmLabel,
    confirmDanger,
    onConfirm,
    onClose,
}: {
    visible: boolean;
    title: string;
    description?: string;
    placeholder: string;
    required?: boolean;
    confirmLabel: string;
    confirmDanger?: boolean;
    onConfirm: (reason: string) => void;
    onClose: () => void;
}) {
    const [text, setText] = useState('');
    const canConfirm = !required || text.trim().length > 0;

    const handleClose = () => {
        setText('');
        onClose();
    };
    const handleConfirm = () => {
        if (!canConfirm) return;
        const value = text.trim();
        setText('');
        onConfirm(value);
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
            <View style={rm.overlay}>
                <View style={rm.card}>
                    <YStack gap={12}>
                        <Text fontSize={16} fontWeight="900" color={appTheme.colors.text}>{title}</Text>
                        {description ? (
                            <Text fontSize={13} color={appTheme.colors.textMuted} lineHeight={18}>{description}</Text>
                        ) : null}
                        <TextInput
                            style={[rm.input, { borderColor: required && !canConfirm ? appTheme.colors.danger : appTheme.colors.border }]}
                            value={text}
                            onChangeText={setText}
                            placeholder={placeholder}
                            placeholderTextColor={appTheme.colors.textMuted}
                            multiline
                            numberOfLines={3}
                            textAlignVertical="top"
                        />
                        {required && !canConfirm ? (
                            <Text fontSize={11} color={appTheme.colors.danger}>Vui lòng nhập lý do</Text>
                        ) : null}
                        <XStack gap={10}>
                            <Pressable style={[rm.btn, rm.cancelBtn]} onPress={handleClose}>
                                <Text fontSize={14} fontWeight="700" color={appTheme.colors.textMuted}>Hủy</Text>
                            </Pressable>
                            <Pressable
                                style={[rm.btn, rm.confirmBtn, { backgroundColor: confirmDanger ? appTheme.colors.danger : appTheme.colors.primary }, !canConfirm && { opacity: 0.4 }]}
                                onPress={handleConfirm}
                                disabled={!canConfirm}
                            >
                                <Text fontSize={14} fontWeight="900" color="#fff">{confirmLabel}</Text>
                            </Pressable>
                        </XStack>
                    </YStack>
                </View>
            </View>
        </Modal>
    );
}

// ─── Camera modal ─────────────────────────────────────────────────────────────

function CameraModal({
    visible,
    label,
    onCapture,
    onClose,
}: {
    visible: boolean;
    label: string;
    onCapture: (uri: string) => void;
    onClose: () => void;
}) {
    const cameraRef = useRef<CameraView>(null);

    const handleShutter = async () => {
        if (!cameraRef.current) return;
        try {
            const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
            if (photo?.uri) {
                onCapture(photo.uri);
            }
        } catch {
            Alert.alert('Lỗi', 'Không thể chụp ảnh, vui lòng thử lại.');
        }
    };

    return (
        <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
            <View style={cam.container}>
                <StatusBar style="light" />
                <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

                {/* Corner guides */}
                <View style={cam.frame} pointerEvents="none">
                    <View style={[cam.corner, cam.TL]} /><View style={[cam.corner, cam.TR]} />
                    <View style={[cam.corner, cam.BL]} /><View style={[cam.corner, cam.BR]} />
                </View>

                {/* Top bar */}
                <View style={cam.topBar}>
                    <XStack paddingHorizontal={20} paddingTop={56} paddingBottom={14} alignItems="center" gap={12}>
                        <Pressable onPress={onClose} hitSlop={12} style={cam.iconBtn}>
                            <X size={20} color="#fff" />
                        </Pressable>
                        <Text fontSize={15} fontWeight="900" color="#fff">{label}</Text>
                    </XStack>
                </View>

                {/* Shutter */}
                <View style={cam.shutterBar}>
                    <Text style={cam.guide}>Đảm bảo ảnh rõ nét trước khi chụp</Text>
                    <Pressable onPress={handleShutter} style={cam.shutter}>
                        <View style={cam.shutterInner}>
                            <Camera size={28} color={appTheme.colors.primary} />
                        </View>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

// ─── Photo capture card ───────────────────────────────────────────────────────

function PhotoCaptureCard({
    label,
    sublabel,
    uri,
    required,
    onCapture,
    onDelete,
}: {
    label: string;
    sublabel: string;
    uri: string | null;
    required?: boolean;
    onCapture: () => void;
    onDelete: () => void;
}) {
    if (uri) {
        return (
            <XStack
                borderRadius={appTheme.radius.md}
                borderWidth={1}
                borderColor={appTheme.colors.successSoft}
                backgroundColor={appTheme.colors.surface}
                overflow="hidden"
                alignItems="center"
            >
                <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
                <YStack flex={1} paddingHorizontal={12} paddingVertical={10} gap={3}>
                    <XStack alignItems="center" gap={6}>
                        <View style={styles.doneDot} />
                        <Text fontSize={13} fontWeight="900" color={appTheme.colors.text}>{label}</Text>
                    </XStack>
                    <Text fontSize={11} color={appTheme.colors.textMuted} numberOfLines={1}>{sublabel}</Text>
                    <Pressable onPress={onCapture} hitSlop={6} style={styles.retakeRow}>
                        <Camera size={12} color={appTheme.colors.primary} />
                        <Text fontSize={11} color={appTheme.colors.primary} fontWeight="700">Chụp lại</Text>
                    </Pressable>
                </YStack>
                <Pressable onPress={onDelete} hitSlop={8} style={styles.deleteBtn}>
                    <Trash2 size={18} color={appTheme.colors.danger} />
                </Pressable>
            </XStack>
        );
    }

    return (
        <Pressable onPress={onCapture} style={styles.emptyCard}>
            <XStack
                borderRadius={appTheme.radius.md}
                borderWidth={1.5}
                borderStyle="dashed"
                borderColor={appTheme.colors.border}
                backgroundColor={appTheme.colors.surfaceSoft}
                padding={14}
                alignItems="center"
                gap={12}
            >
                <XStack
                    width={44} height={44} borderRadius={14}
                    backgroundColor={appTheme.colors.primarySoft}
                    alignItems="center" justifyContent="center"
                >
                    <Camera size={22} color={appTheme.colors.primary} />
                </XStack>
                <YStack flex={1} gap={2}>
                    <XStack alignItems="center" gap={6}>
                        <Text fontSize={13} fontWeight="900" color={appTheme.colors.text}>{label}</Text>
                        {required ? (
                            <View style={styles.requiredBadge}>
                                <Text fontSize={9} fontWeight="900" color={appTheme.colors.danger}>BẮT BUỘC</Text>
                            </View>
                        ) : null}
                    </XStack>
                    <Text fontSize={11} color={appTheme.colors.textMuted}>{sublabel}</Text>
                </YStack>
                <Text fontSize={12} fontWeight="900" color={appTheme.colors.primary}>Chụp</Text>
            </XStack>
        </Pressable>
    );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string | null }) {
    if (!value) return null;
    return (
        <XStack justifyContent="space-between" paddingVertical={6}>
            <Text fontSize={13} color={appTheme.colors.textMuted}>{label}</Text>
            <Text fontSize={13} fontWeight="800" color={appTheme.colors.text} flex={1} textAlign="right">{value}</Text>
        </XStack>
    );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <YStack borderRadius={appTheme.radius.lg} borderWidth={1} borderColor={appTheme.colors.border} backgroundColor={appTheme.colors.surface} overflow="hidden">
            <XStack paddingHorizontal={16} paddingVertical={11} backgroundColor={appTheme.colors.surfaceSoft}>
                <Text fontSize={12} fontWeight="900" color={appTheme.colors.textMuted}>{title.toUpperCase()}</Text>
            </XStack>
            <YStack padding={16} gap={2}>{children}</YStack>
        </YStack>
    );
}

// ─── Main content ─────────────────────────────────────────────────────────────

function ActiveTripContent({ trip, refresh }: { trip: ActiveTrip; refresh: () => void }) {
    const { isLoading: lifecycleLoading, advance } = useTripLifecycle(() => refresh());
    const [permission, requestPermission] = useCameraPermissions();

    // Photo state
    const [receiptUri, setReceiptUri]     = useState<string | null>(null);
    const [proofUri,   setProofUri]       = useState<string | null>(null);
    const [cameraTarget, setCameraTarget] = useState<'receipt' | 'proof' | null>(null);

    // Reason modal state
    const [reasonModal, setReasonModal] = useState<'cancel-delivery' | 'release-trip' | null>(null);

    const { isUploading, error: proofError, completeWithProof } = useCompletionProof(() => {
        router.replace('/(tabs)');
    });

    const { isLoading: cancelLoading, cancelDelivery } = useCancelDelivery(() => refresh());
    const { isLoading: releaseLoading, releaseTrip }   = useReleaseTrip(() => router.replace('/(tabs)'));

    const isWorking    = lifecycleLoading || isUploading || cancelLoading || releaseLoading;
    const nextAction   = NEXT_ACTIONS[trip.status as TripStatus];
    const accent       = STATUS_ACCENT[trip.status as TripStatus];
    const banner       = STATUS_BANNER[trip.status as TripStatus];
    const isArrived    = trip.status === 'arrived';
    const isCancelled  = trip.status === 'cancelled';
    const isReleasable = trip.status === 'claimed' || trip.status === 'picking';

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

    const handleAdvance = () => {
        if (!nextAction) return;
        advance(trip.id, nextAction.nextStatus);
    };

    const handleComplete = () => {
        if (!receiptUri) return;
        completeWithProof(trip.id, receiptUri, proofUri ?? undefined);
    };

    const handleConfirmReturn = () => {
        advance(trip.id, 'completed');
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
                {/* ── Status progress ── */}
                <YStack
                    padding={16} borderRadius={appTheme.radius.lg} gap={14}
                    borderWidth={1}
                    borderColor={accent?.border ?? appTheme.colors.border}
                    backgroundColor={accent?.bg ?? appTheme.colors.surfaceSoft}
                >
                    <StatusStepper status={trip.status as TripStatus} />
                    {banner ? (
                        <XStack gap={8} alignItems="center" paddingTop={4}
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
                        <XStack width={28} height={28} borderRadius={10} backgroundColor={appTheme.colors.successSoft} alignItems="center" justifyContent="center" marginTop={1}>
                            <MapPin size={13} color={appTheme.colors.success} />
                        </XStack>
                        <YStack flex={1}>
                            <Text fontSize={11} color={appTheme.colors.textMuted} fontWeight="700">ĐIỂM LẤY</Text>
                            <Text fontSize={13} color={appTheme.colors.text} lineHeight={18}>{trip.pickup_address}</Text>
                        </YStack>
                    </XStack>
                    <XStack height={1} backgroundColor={appTheme.colors.border} marginVertical={8} marginLeft={38} />
                    <XStack gap={10} alignItems="flex-start">
                        <XStack width={28} height={28} borderRadius={10} backgroundColor={appTheme.colors.primarySoft} alignItems="center" justifyContent="center" marginTop={1}>
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
                    <InfoRow label="Tên hàng" value={trip.cargo_name} />
                    <InfoRow label="Trọng lượng" value={trip.cargo_weight_kg ? `${trip.cargo_weight_kg} kg` : null} />
                    <InfoRow
                        label="Giá trị"
                        value={trip.estimated_price
                            ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(trip.estimated_price))
                            : null}
                    />
                    {trip.notes ? <InfoRow label="Ghi chú" value={trip.notes} /> : null}
                </SectionCard>

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

                {/* ── CANCELLED: return guidance banner ── */}
                {isCancelled ? (
                    <YStack
                        padding={14} borderRadius={appTheme.radius.lg} gap={10}
                        borderWidth={1.5} borderColor="#fed7aa"
                        backgroundColor="#fff7ed"
                    >
                        <XStack gap={10} alignItems="flex-start">
                            <XStack width={36} height={36} borderRadius={12}
                                backgroundColor="#ffedd5"
                                alignItems="center" justifyContent="center"
                            >
                                <RotateCcw size={18} color="#c2410c" />
                            </XStack>
                            <YStack flex={1} gap={3}>
                                <Text fontSize={14} fontWeight="900" color="#c2410c">Cần trả hàng về</Text>
                                <Text fontSize={12} color="#92400e" lineHeight={17}>
                                    Đơn hàng không thể giao được. Vui lòng chở hàng quay lại điểm lấy hàng ban đầu và xác nhận sau khi đã trả xong.
                                </Text>
                                <Text fontSize={12} fontWeight="700" color="#78350f" marginTop={4}>
                                    Điểm lấy (trả hàng về): {trip.pickup_address}
                                </Text>
                            </YStack>
                        </XStack>
                    </YStack>
                ) : null}

                {/* ── Photo section (only when ARRIVED) ── */}
                {isArrived ? (
                    <YStack gap={10}>
                        <Text fontSize={13} fontWeight="900" color={appTheme.colors.text}>
                            Ảnh xác nhận giao hàng
                        </Text>

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
                    {/* Normal lifecycle advance (skip for arrived and cancelled) */}
                    {nextAction && !isArrived && !isCancelled ? (
                        <LifecycleActionButton
                            label={nextAction.label}
                            tone={nextAction.tone}
                            onPress={handleAdvance}
                            isLoading={isWorking}
                        />
                    ) : null}

                    {/* ARRIVED: complete button */}
                    {isArrived ? (
                        <LifecycleActionButton
                            label={isUploading ? 'Đang tải ảnh...' : 'Hoàn thành chuyến'}
                            tone="primary"
                            onPress={handleComplete}
                            isLoading={isUploading}
                            disabled={!allPhotosDone}
                            icon={<CheckCircle size={17} color={allPhotosDone ? appTheme.colors.surface : appTheme.colors.textMuted} />}
                        />
                    ) : null}

                    {/* ARRIVED: cannot deliver → reason required → CANCELLED */}
                    {isArrived ? (
                        <LifecycleActionButton
                            label="Không thể giao hàng"
                            tone="danger"
                            onPress={() => setReasonModal('cancel-delivery')}
                            isLoading={cancelLoading}
                            icon={<XCircle size={16} color={appTheme.colors.danger} />}
                        />
                    ) : null}

                    {/* CANCELLED: confirm goods returned to pickup */}
                    {isCancelled ? (
                        <LifecycleActionButton
                            label="Xác nhận đã trả hàng về"
                            tone="secondary"
                            onPress={handleConfirmReturn}
                            isLoading={lifecycleLoading}
                            icon={<CheckCircle size={16} color={appTheme.colors.textMuted} />}
                        />
                    ) : null}

                    {/* CLAIMED / PICKING: early release → all legs back to pool */}
                    {isReleasable ? (
                        <LifecycleActionButton
                            label="Hủy chuyến"
                            tone="danger"
                            onPress={() => setReasonModal('release-trip')}
                            isLoading={releaseLoading}
                            icon={<X size={16} color={appTheme.colors.danger} />}
                        />
                    ) : null}
                </YStack>
            </ScrollView>

            {/* ── Camera modal ── */}
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

            {/* ── Reason modals ── */}
            <ReasonModal
                visible={reasonModal === 'cancel-delivery'}
                title="Không thể giao hàng"
                description="Vui lòng cho biết lý do không thể giao hàng. Lý do này sẽ được ghi nhận vào hệ thống."
                placeholder="Ví dụ: Khách hàng không có mặt, không liên lạc được..."
                required
                confirmLabel="Xác nhận không giao được"
                confirmDanger
                onConfirm={(reason) => {
                    setReasonModal(null);
                    cancelDelivery(trip.id, reason);
                }}
                onClose={() => setReasonModal(null)}
            />

            <ReasonModal
                visible={reasonModal === 'release-trip'}
                title="Hủy chuyến"
                description="Xác nhận hủy chuyến này? Đơn hàng sẽ được trả về pool để tài xế khác nhận."
                placeholder="Lý do hủy (tùy chọn, ví dụ: xe hỏng đột xuất...)"
                confirmLabel="Xác nhận hủy chuyến"
                confirmDanger
                onConfirm={(reason) => {
                    setReasonModal(null);
                    releaseTrip(trip.id, reason || undefined);
                }}
                onClose={() => setReasonModal(null)}
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
                <YStack flex={1} alignItems="center" justifyContent="center">
                    <AppText variant="body" tone="muted">Đang tải chuyến...</AppText>
                </YStack>
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

const C  = 28;
const CT = 3;

const styles = StyleSheet.create({
    thumb:    { width: 80, height: 80 },
    doneDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: appTheme.colors.success },
    retakeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    deleteBtn: { paddingHorizontal: 14, paddingVertical: 12 },
    emptyCard: { borderRadius: appTheme.radius.md },
    requiredBadge: {
        paddingHorizontal: 6, paddingVertical: 2,
        borderRadius: 6, backgroundColor: '#fee2e2',
    },
});

const rm = StyleSheet.create({
    overlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center', alignItems: 'center',
        padding: 24,
    },
    card: {
        width: '100%', backgroundColor: '#fff',
        borderRadius: 18, padding: 22,
        shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, elevation: 12,
    },
    input: {
        borderWidth: 1.5, borderRadius: 10,
        padding: 12, fontSize: 13,
        minHeight: 80, color: '#111',
        fontFamily: 'System',
    },
    btn: {
        flex: 1, paddingVertical: 13, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center',
    },
    cancelBtn: {
        backgroundColor: '#f3f4f6',
    },
    confirmBtn: {
        backgroundColor: '#ef4444',
    },
});

const cam = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    topBar: {
        position: 'absolute', top: 0, left: 0, right: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    iconBtn: {
        width: 40, height: 40, borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.18)',
        alignItems: 'center', justifyContent: 'center',
    },
    frame: { position: 'absolute', top: '24%', left: '10%', right: '10%', bottom: '26%' },
    corner: { position: 'absolute', width: C, height: C, borderColor: 'rgba(255,255,255,0.9)' },
    TL: { top: 0, left: 0, borderTopWidth: CT, borderLeftWidth: CT, borderTopLeftRadius: 4 },
    TR: { top: 0, right: 0, borderTopWidth: CT, borderRightWidth: CT, borderTopRightRadius: 4 },
    BL: { bottom: 0, left: 0, borderBottomWidth: CT, borderLeftWidth: CT, borderBottomLeftRadius: 4 },
    BR: { bottom: 0, right: 0, borderBottomWidth: CT, borderRightWidth: CT, borderBottomRightRadius: 4 },
    shutterBar: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingBottom: 52, paddingTop: 24,
        alignItems: 'center', gap: 18,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    guide: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
    shutter: {
        width: 76, height: 76, borderRadius: 38, backgroundColor: '#fff',
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
    },
    shutterInner: {
        width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff',
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: appTheme.colors.primaryMuted,
    },
});
