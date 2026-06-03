import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
    AlertTriangle, Camera, CheckCircle, ChevronDown,
    MapPin, Package, PlusCircle, RotateCcw, Trash2, X, XCircle,
} from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';

import { AppText } from '@/components/app-text';
import { LifecycleActionButton } from '@/components/lifecycle-action-button';
import { ScreenHeader } from '@/components/screen-header';
import { TripStatusBadge } from '@/components/trip-status-badge';
import { appTheme } from '@/theme/app-theme';
import { useActiveTrip } from '@/hooks/use-active-trip';
import { useCompletionProof } from '@/hooks/use-completion-proof';
import { useReleaseTrip } from '@/hooks/use-release-trip';
import { useShipmentExpenses } from '@/hooks/use-shipment-expenses';
import { useTripLifecycle } from '@/hooks/use-trip-lifecycle';
import { tripService } from '@/services/trip-service';
import { ActiveTripSkeleton } from '@/components/skeleton';
import type { ActiveTrip, Expense, ExpenseType, TripStatus } from '@/types/trip';
import { EXPENSE_TYPE_LABEL, NEXT_ACTIONS } from '@/types/trip';

// States where driver can add expenses
const EXPENSE_ALLOWED_STATUSES: TripStatus[] = [
    'claimed', 'picking', 'loaded', 'transit', 'arrived', 'failed', 'returning',
];

const EXPENSE_TYPES: ExpenseType[] = ['fuel', 'toll', 'parking', 'repair', 'other'];

// ─── Expense form modal ───────────────────────────────────────────────────────

function ExpenseFormModal({
    visible,
    shipmentId,
    onClose,
    onSuccess,
}: {
    visible: boolean;
    shipmentId: number;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [expenseType, setExpenseType] = useState<ExpenseType>('fuel');
    const [amount, setAmount]           = useState('');
    const [description, setDescription] = useState('');
    const [receiptUri, setReceiptUri]   = useState<string | null>(null);
    const [showCamera, setShowCamera]   = useState(false);
    const [showTypePicker, setShowTypePicker] = useState(false);
    const [isSubmitting, setSubmitting] = useState(false);
    const [formError, setFormError]     = useState<string | null>(null);

    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<CameraView>(null);

    const reset = () => {
        setExpenseType('fuel');
        setAmount('');
        setDescription('');
        setReceiptUri(null);
        setShowCamera(false);
        setShowTypePicker(false);
        setFormError(null);
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    const openCamera = async () => {
        if (!permission?.granted) {
            const res = await requestPermission();
            if (!res.granted) {
                Alert.alert('Cần quyền camera', 'Vui lòng cấp quyền camera trong cài đặt.');
                return;
            }
        }
        setShowCamera(true);
    };

    const handleCapture = async () => {
        if (!cameraRef.current) return;
        try {
            const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
            if (photo?.uri) {
                setReceiptUri(photo.uri);
                setShowCamera(false);
            }
        } catch {
            Alert.alert('Lỗi', 'Không thể chụp ảnh, vui lòng thử lại.');
        }
    };

    const handleSubmit = async () => {
        if (!receiptUri) { setFormError('Vui lòng chụp ảnh biên lai'); return; }
        const amt = Number(amount.replace(/[^0-9]/g, ''));
        if (!amt || amt <= 0) { setFormError('Số tiền phải lớn hơn 0'); return; }

        setFormError(null);
        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('shipmentId', String(shipmentId));
            formData.append('expenseType', expenseType);
            formData.append('amount', String(amt));
            if (description.trim()) formData.append('description', description.trim());

            const filename = receiptUri.split('/').pop() ?? 'receipt.jpg';
            const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg';
            const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
            formData.append('receipt', { uri: receiptUri, name: filename, type: mimeMap[ext] ?? 'image/jpeg' } as unknown as Blob);

            await tripService.createExpense(formData);
            reset();
            onSuccess();
        } catch (err) {
            setFormError(err instanceof Error ? err.message : 'Không thể thêm chi phí');
        } finally {
            setSubmitting(false);
        }
    };

    // Camera modal (full-screen) rendered inside form modal
    if (showCamera) {
        return (
            <Modal visible animationType="slide" statusBarTranslucent onRequestClose={() => setShowCamera(false)}>
                <View style={cam.container}>
                    <StatusBar style="light" />
                    <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
                    <View style={cam.frame} pointerEvents="none">
                        <View style={[cam.corner, cam.TL]} /><View style={[cam.corner, cam.TR]} />
                        <View style={[cam.corner, cam.BL]} /><View style={[cam.corner, cam.BR]} />
                    </View>
                    <View style={cam.topBar}>
                        <XStack paddingHorizontal={20} paddingTop={56} paddingBottom={14} alignItems="center" gap={12}>
                            <Pressable onPress={() => setShowCamera(false)} hitSlop={12} style={cam.iconBtn}>
                                <X size={20} color="#fff" />
                            </Pressable>
                            <Text fontSize={15} fontWeight="900" color="#fff">Chụp ảnh biên lai</Text>
                        </XStack>
                    </View>
                    <View style={cam.shutterBar}>
                        <Text style={cam.guide}>Đảm bảo ảnh rõ nét trước khi chụp</Text>
                        <Pressable onPress={handleCapture} style={cam.shutter}>
                            <View style={cam.shutterInner}><Camera size={28} color={appTheme.colors.primary} /></View>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        );
    }

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
            <View style={ef.overlay}>
                <View style={ef.sheet}>
                    {/* Header */}
                    <XStack justifyContent="space-between" alignItems="center" marginBottom={20}>
                        <Text fontSize={16} fontWeight="900" color={appTheme.colors.text}>Thêm chi phí phát sinh</Text>
                        <Pressable onPress={handleClose} hitSlop={10}><X size={20} color={appTheme.colors.textMuted} /></Pressable>
                    </XStack>

                    {/* Expense type */}
                    <YStack gap={6} marginBottom={14}>
                        <Text fontSize={12} fontWeight="700" color={appTheme.colors.textMuted}>LOẠI CHI PHÍ</Text>
                        <Pressable onPress={() => setShowTypePicker(v => !v)} style={ef.select}>
                            <Text fontSize={14} color={appTheme.colors.text} fontWeight="700">{EXPENSE_TYPE_LABEL[expenseType]}</Text>
                            <ChevronDown size={16} color={appTheme.colors.textMuted} />
                        </Pressable>
                        {showTypePicker ? (
                            <YStack borderRadius={10} borderWidth={1} borderColor={appTheme.colors.border} overflow="hidden">
                                {EXPENSE_TYPES.map((t) => (
                                    <Pressable
                                        key={t}
                                        onPress={() => { setExpenseType(t); setShowTypePicker(false); }}
                                        style={[ef.typeOption, t === expenseType && ef.typeOptionActive]}
                                    >
                                        <Text fontSize={14} fontWeight={t === expenseType ? '900' : '600'}
                                            color={t === expenseType ? appTheme.colors.primary : appTheme.colors.text}>
                                            {EXPENSE_TYPE_LABEL[t]}
                                        </Text>
                                        {t === expenseType ? <CheckCircle size={16} color={appTheme.colors.primary} /> : null}
                                    </Pressable>
                                ))}
                            </YStack>
                        ) : null}
                    </YStack>

                    {/* Amount */}
                    <YStack gap={6} marginBottom={14}>
                        <Text fontSize={12} fontWeight="700" color={appTheme.colors.textMuted}>SỐ TIỀN (VNĐ)</Text>
                        <TextInput
                            style={ef.input}
                            value={amount}
                            onChangeText={setAmount}
                            placeholder="Ví dụ: 150000"
                            placeholderTextColor={appTheme.colors.textMuted}
                            keyboardType="numeric"
                        />
                    </YStack>

                    {/* Description */}
                    <YStack gap={6} marginBottom={14}>
                        <Text fontSize={12} fontWeight="700" color={appTheme.colors.textMuted}>GHI CHÚ (tùy chọn)</Text>
                        <TextInput
                            style={[ef.input, { minHeight: 60, textAlignVertical: 'top' }]}
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Mô tả chi phí..."
                            placeholderTextColor={appTheme.colors.textMuted}
                            multiline
                            numberOfLines={2}
                        />
                    </YStack>

                    {/* Receipt photo */}
                    <YStack gap={6} marginBottom={16}>
                        <XStack alignItems="center" gap={6}>
                            <Text fontSize={12} fontWeight="700" color={appTheme.colors.textMuted}>ẢNH BIÊN LAI</Text>
                            <View style={styles.requiredBadge}>
                                <Text fontSize={9} fontWeight="900" color={appTheme.colors.danger}>BẮT BUỘC</Text>
                            </View>
                        </XStack>
                        {receiptUri ? (
                            <XStack borderRadius={10} borderWidth={1} borderColor={appTheme.colors.border}
                                overflow="hidden" alignItems="center" backgroundColor={appTheme.colors.surface}>
                                <Image source={{ uri: receiptUri }} style={{ width: 80, height: 80 }} resizeMode="cover" />
                                <YStack flex={1} paddingHorizontal={12} gap={4}>
                                    <XStack alignItems="center" gap={6}>
                                        <View style={styles.doneDot} />
                                        <Text fontSize={13} fontWeight="700" color={appTheme.colors.success}>Đã chụp biên lai</Text>
                                    </XStack>
                                    <Pressable onPress={openCamera} style={styles.retakeRow}>
                                        <Camera size={12} color={appTheme.colors.primary} />
                                        <Text fontSize={11} color={appTheme.colors.primary} fontWeight="700">Chụp lại</Text>
                                    </Pressable>
                                </YStack>
                                <Pressable onPress={() => setReceiptUri(null)} hitSlop={8} style={styles.deleteBtn}>
                                    <Trash2 size={18} color={appTheme.colors.danger} />
                                </Pressable>
                            </XStack>
                        ) : (
                            <Pressable onPress={openCamera} style={ef.captureBtn}>
                                <Camera size={20} color={appTheme.colors.primary} />
                                <Text fontSize={13} fontWeight="700" color={appTheme.colors.primary}>Chụp ảnh biên lai</Text>
                            </Pressable>
                        )}
                    </YStack>

                    {/* Error */}
                    {formError ? (
                        <XStack padding={10} borderRadius={8} backgroundColor={appTheme.colors.dangerSoft}
                            borderWidth={1} borderColor={appTheme.colors.dangerBorder} marginBottom={12}>
                            <Text fontSize={12} color={appTheme.colors.danger} flex={1}>{formError}</Text>
                        </XStack>
                    ) : null}

                    {/* Submit */}
                    <XStack gap={10}>
                        <Pressable style={[rm.btn, rm.cancelBtn]} onPress={handleClose}>
                            <Text fontSize={14} fontWeight="700" color={appTheme.colors.textMuted}>Hủy</Text>
                        </Pressable>
                        <Pressable
                            style={[rm.btn, rm.confirmBtn, { backgroundColor: appTheme.colors.primary }, isSubmitting && { opacity: 0.6 }]}
                            onPress={handleSubmit}
                            disabled={isSubmitting}
                        >
                            <Text fontSize={14} fontWeight="900" color="#fff">
                                {isSubmitting ? 'Đang lưu...' : 'Lưu chi phí'}
                            </Text>
                        </Pressable>
                    </XStack>
                </View>
            </View>
        </Modal>
    );
}

// ─── Expense list section ─────────────────────────────────────────────────────

function ExpenseSection({
    expenses,
    canAdd,
    onAdd,
}: {
    expenses: Expense[];
    canAdd: boolean;
    onAdd: () => void;
}) {
    const fmt = (v: string) =>
        new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(v));

    const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

    return (
        <YStack borderRadius={appTheme.radius.lg} borderWidth={1} borderColor={appTheme.colors.border}
            backgroundColor={appTheme.colors.surface} overflow="hidden">
            {/* Header */}
            <XStack paddingHorizontal={16} paddingVertical={11} backgroundColor={appTheme.colors.surfaceSoft}
                justifyContent="space-between" alignItems="center">
                <Text fontSize={12} fontWeight="900" color={appTheme.colors.textMuted}>CHI PHÍ PHÁT SINH</Text>
                {expenses.length > 0 ? (
                    <Text fontSize={12} fontWeight="700" color={appTheme.colors.text}>{fmt(String(total))}</Text>
                ) : null}
            </XStack>

            <YStack padding={14} gap={10}>
                {expenses.length === 0 ? (
                    <Text fontSize={13} color={appTheme.colors.textMuted} textAlign="center" paddingVertical={4}>
                        Chưa có chi phí nào
                    </Text>
                ) : (
                    expenses.map((e) => (
                        <XStack key={e.id} gap={10} alignItems="flex-start">
                            <YStack flex={1} gap={2}>
                                <XStack alignItems="center" gap={6}>
                                    <Text fontSize={13} fontWeight="800" color={appTheme.colors.text}>
                                        {EXPENSE_TYPE_LABEL[e.expense_type]}
                                    </Text>
                                    <Text fontSize={13} fontWeight="900" color={appTheme.colors.primary}>
                                        {fmt(e.amount)}
                                    </Text>
                                </XStack>
                                {e.description ? (
                                    <Text fontSize={11} color={appTheme.colors.textMuted}>{e.description}</Text>
                                ) : null}
                                {e.receipt_urls.length > 0 ? (
                                    <XStack gap={6} marginTop={4} flexWrap="wrap">
                                        {e.receipt_urls.map((url, i) => (
                                            <Image key={i} source={{ uri: url }} style={{ width: 56, height: 56, borderRadius: 8 }} resizeMode="cover" />
                                        ))}
                                    </XStack>
                                ) : null}
                            </YStack>
                        </XStack>
                    ))
                )}

                {canAdd ? (
                    <Pressable onPress={onAdd} style={ef.addBtn}>
                        <PlusCircle size={16} color={appTheme.colors.primary} />
                        <Text fontSize={13} fontWeight="700" color={appTheme.colors.primary}>Thêm chi phí</Text>
                    </Pressable>
                ) : null}
            </YStack>
        </YStack>
    );
}

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
    cancelled: { bg: '#f3f4f6',                    text: appTheme.colors.textMuted,   border: appTheme.colors.border },
};

const STATUS_BANNER: Partial<Record<TripStatus, { icon: React.ReactNode; text: string }>> = {
    claimed:   { icon: <MapPin size={14} color={appTheme.colors.primary} />,       text: 'Di chuyển đến điểm lấy hàng' },
    picking:   { icon: <Package size={14} color={appTheme.colors.warningText} />,  text: 'Đang bốc xếp hàng lên xe' },
    loaded:    { icon: <Package size={14} color={appTheme.colors.warningText} />,  text: 'Hàng đã lên xe — sẵn sàng khởi hành' },
    transit:   { icon: <MapPin size={14} color={appTheme.colors.primary} />,       text: 'Đang vận chuyển đến điểm giao' },
    arrived:   { icon: <CheckCircle size={14} color={appTheme.colors.success} />,  text: 'Đã đến — chụp ảnh biên lai rồi hoàn thành' },
    failed:    { icon: <AlertTriangle size={14} color={appTheme.colors.danger} />, text: 'Giao hàng thất bại — bắt đầu hoàn hàng về' },
    returning: { icon: <RotateCcw size={14} color={appTheme.colors.textMuted} />,  text: 'Đang hoàn hàng về điểm lấy hàng ban đầu' },
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

    // Reason modal — only for early release (claimed/picking)
    const [showReleaseModal, setShowReleaseModal] = useState(false);

    // Expense form modal
    const [showExpenseForm, setShowExpenseForm] = useState(false);

    const { isUploading, error: proofError, completeWithProof } = useCompletionProof(() => {
        router.replace('/(tabs)');
    });

    const { isLoading: releaseLoading, releaseTrip } = useReleaseTrip(() => router.replace('/(tabs)'));

    // Expenses
    const { expenses, load: loadExpenses } = useShipmentExpenses(trip.id);
    useEffect(() => { void loadExpenses(); }, [loadExpenses]);

    const isWorking    = lifecycleLoading || isUploading || releaseLoading;
    const nextAction   = NEXT_ACTIONS[trip.status as TripStatus];
    const accent       = STATUS_ACCENT[trip.status as TripStatus];
    const banner       = STATUS_BANNER[trip.status as TripStatus];
    const isArrived    = trip.status === 'arrived';
    const isReleasable = trip.status === 'claimed' || trip.status === 'picking';
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

    const handleAdvance = () => {
        if (!nextAction) return;
        advance(trip.id, nextAction.nextStatus);
    };

    const handleComplete = () => {
        if (!receiptUri) return;
        completeWithProof(trip.id, receiptUri, proofUri ?? undefined);
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

                {/* ── Expenses ── */}
                <ExpenseSection
                    expenses={expenses}
                    canAdd={canAddExpense}
                    onAdd={() => setShowExpenseForm(true)}
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

                {/* ── RETURNING: guidance banner showing where to return ── */}
                {trip.status === 'returning' ? (
                    <YStack
                        padding={14} borderRadius={appTheme.radius.lg} gap={6}
                        borderWidth={1} borderColor={appTheme.colors.border}
                        backgroundColor={appTheme.colors.surfaceSoft}
                    >
                        <XStack gap={8} alignItems="center">
                            <RotateCcw size={14} color={appTheme.colors.textMuted} />
                            <Text fontSize={12} fontWeight="700" color={appTheme.colors.textMuted}>
                                Điểm trả hàng về:
                            </Text>
                        </XStack>
                        <Text fontSize={13} color={appTheme.colors.text} lineHeight={18}>
                            {trip.pickup_address}
                        </Text>
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
                    {/* Normal lifecycle advance (skip for ARRIVED) */}
                    {nextAction && !isArrived ? (
                        <LifecycleActionButton
                            label={nextAction.label}
                            tone={nextAction.tone}
                            onPress={handleAdvance}
                            isLoading={isWorking}
                        />
                    ) : null}

                    {/* ARRIVED: complete trip (requires photo) */}
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

                    {/* ARRIVED: mark failed → FAILED → RETURNING → COMPLETED */}
                    {isArrived ? (
                        <LifecycleActionButton
                            label="Không thể giao hàng"
                            tone="danger"
                            onPress={handleMarkFailed}
                            isLoading={lifecycleLoading}
                            icon={<XCircle size={16} color={appTheme.colors.danger} />}
                        />
                    ) : null}

                    {/* CLAIMED / PICKING: early release → all legs back to pool */}
                    {isReleasable ? (
                        <LifecycleActionButton
                            label="Hủy chuyến"
                            tone="danger"
                            onPress={() => setShowReleaseModal(true)}
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

            {/* ── Release trip modal (CLAIMED / PICKING only) ── */}
            <ReasonModal
                visible={showReleaseModal}
                title="Hủy chuyến"
                description="Xác nhận hủy chuyến này? Đơn hàng sẽ được trả về pool để tài xế khác nhận."
                placeholder="Lý do hủy (tùy chọn, ví dụ: xe hỏng đột xuất...)"
                confirmLabel="Xác nhận hủy chuyến"
                confirmDanger
                onConfirm={(reason) => {
                    setShowReleaseModal(false);
                    releaseTrip(trip.id, reason || undefined);
                }}
                onClose={() => setShowReleaseModal(false)}
            />

            {/* ── Expense form modal ── */}
            <ExpenseFormModal
                visible={showExpenseForm}
                shipmentId={trip.id}
                onClose={() => setShowExpenseForm(false)}
                onSuccess={() => {
                    setShowExpenseForm(false);
                    void loadExpenses();
                }}
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
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingBottom: appTheme.spacing.screenBottom }}
                    scrollEnabled={false}
                >
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

const ef = StyleSheet.create({
    overlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 24, paddingBottom: 40,
    },
    select: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        borderWidth: 1.5, borderColor: appTheme.colors.border, borderRadius: 10,
        paddingHorizontal: 14, paddingVertical: 12,
        backgroundColor: appTheme.colors.surface,
    },
    typeOption: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 14, paddingVertical: 12,
        backgroundColor: appTheme.colors.surface,
        borderBottomWidth: 1, borderBottomColor: appTheme.colors.border,
    },
    typeOptionActive: {
        backgroundColor: appTheme.colors.primarySoft,
    },
    input: {
        borderWidth: 1.5, borderRadius: 10,
        paddingHorizontal: 14, paddingVertical: 12,
        fontSize: 14, color: appTheme.colors.text,
        borderColor: appTheme.colors.border,
        backgroundColor: appTheme.colors.surface,
    },
    captureBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        padding: 14, borderRadius: 10,
        borderWidth: 1.5, borderStyle: 'dashed', borderColor: appTheme.colors.primaryMuted,
        backgroundColor: appTheme.colors.primarySoft,
        justifyContent: 'center',
    },
    addBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, paddingVertical: 10,
        borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed',
        borderColor: appTheme.colors.primaryMuted, backgroundColor: appTheme.colors.primarySoft,
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
