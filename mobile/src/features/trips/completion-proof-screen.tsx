import { useCallback, useRef, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { StatusBar } from 'expo-status-bar';
import { Camera, CheckCircle, ChevronLeft, X } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';

import { AppText } from '@/components/app-text';
import { appTheme } from '@/theme/app-theme';
import { useCompletionProof } from '@/hooks/use-completion-proof';

// ─── Types ────────────────────────────────────────────────────────────────────

type Slot = 'receipt' | 'proof';

const SLOT_LABEL: Record<Slot, string> = {
    receipt: 'Biên lai',
    proof:   'Xác nhận',
};

const SLOT_GUIDE: Record<Slot, string> = {
    receipt: 'Chụp biên lai / chữ ký khách nhận hàng',
    proof:   'Chụp hàng hóa đã giao tại điểm giao cuối',
};

// ─── Thumbnail slot ───────────────────────────────────────────────────────────

function ThumbSlot({
    label,
    uri,
    active,
    onPress,
    onDelete,
}: {
    label: string;
    uri: string | null;
    active: boolean;
    onPress: () => void;
    onDelete: () => void;
}) {
    return (
        <Pressable onPress={onPress} style={[styles.slot, active && styles.slotActive]}>
            {uri ? (
                <>
                    <Image source={{ uri }} style={styles.slotImg} resizeMode="cover" />
                    {/* Delete button */}
                    <Pressable onPress={onDelete} hitSlop={4} style={styles.slotDelete}>
                        <X size={10} color="#fff" />
                    </Pressable>
                    {/* Done badge */}
                    <View style={styles.slotDone}>
                        <CheckCircle size={12} color="#fff" />
                    </View>
                </>
            ) : (
                <YStack flex={1} alignItems="center" justifyContent="center" gap={2}>
                    <Camera size={18} color={active ? appTheme.colors.primary : 'rgba(255,255,255,0.45)'} />
                    <Text fontSize={9} fontWeight="700"
                        color={active ? appTheme.colors.primary : 'rgba(255,255,255,0.45)'}
                        numberOfLines={1}
                    >
                        {label}
                    </Text>
                </YStack>
            )}
            {/* Active ring label below */}
            {active ? (
                <View style={styles.slotActiveLabel}>
                    <Text fontSize={8} fontWeight="900" color={appTheme.colors.primary}>
                        {uri ? 'ĐÃ CHỤP' : 'ĐANG CHỤP'}
                    </Text>
                </View>
            ) : null}
        </Pressable>
    );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function CompletionProofScreen() {
    const { tripId, isFinal: isFinalParam } = useLocalSearchParams<{ tripId: string; isFinal: string }>();
    const tripIdNum = Number(tripId);
    const isFinal   = isFinalParam === '1';

    const [receiptUri, setReceiptUri] = useState<string | null>(null);
    const [proofUri,   setProofUri]   = useState<string | null>(null);
    // activeSlot = which slot the shutter targets
    const [activeSlot, setActiveSlot] = useState<Slot>('receipt');

    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<CameraView>(null);

    const { isUploading, error, completeWithProof } = useCompletionProof(() => {
        router.replace('/(tabs)');
    });

    const slots: Slot[] = isFinal ? ['receipt', 'proof'] : ['receipt'];
    const currentUri     = activeSlot === 'receipt' ? receiptUri : proofUri;

    // Auto-advance activeSlot to first empty slot
    const resolveActiveSlot = useCallback((newReceiptUri: string | null, newProofUri: string | null) => {
        if (!newReceiptUri) { setActiveSlot('receipt'); return; }
        if (isFinal && !newProofUri) { setActiveSlot('proof'); return; }
        // all filled — stay on current
    }, [isFinal]);

    const takePicture = useCallback(async () => {
        if (!cameraRef.current) return;
        try {
            const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
            if (!photo?.uri) return;
            if (activeSlot === 'receipt') {
                setReceiptUri(photo.uri);
                resolveActiveSlot(photo.uri, proofUri);
            } else {
                setProofUri(photo.uri);
                resolveActiveSlot(receiptUri, photo.uri);
            }
        } catch {
            Alert.alert('Lỗi', 'Không thể chụp ảnh, vui lòng thử lại.');
        }
    }, [activeSlot, receiptUri, proofUri, resolveActiveSlot]);

    const handleDelete = useCallback((slot: Slot) => {
        if (slot === 'receipt') {
            setReceiptUri(null);
            setActiveSlot('receipt');
        } else {
            setProofUri(null);
            setActiveSlot('proof');
        }
    }, []);

    const handleConfirm = useCallback(() => {
        if (!receiptUri) return;
        completeWithProof(tripIdNum, receiptUri, proofUri ?? undefined);
    }, [receiptUri, proofUri, tripIdNum, completeWithProof]);

    const allDone = isFinal ? (!!receiptUri && !!proofUri) : !!receiptUri;

    // ── Permission screens ───────────────────────────────────────────────────

    if (!permission) {
        return (
            <YStack flex={1} backgroundColor="#000" alignItems="center" justifyContent="center">
                <AppText variant="body" tone="inverse">Đang kiểm tra quyền camera...</AppText>
            </YStack>
        );
    }

    if (!permission.granted) {
        return (
            <YStack flex={1} backgroundColor={appTheme.colors.background} alignItems="center" justifyContent="center" padding={24} gap={16}>
                <AppText variant="bodyStrong">Cần quyền truy cập camera</AppText>
                <AppText variant="body" tone="muted" textAlign="center">
                    Ứng dụng cần quyền camera để chụp ảnh xác nhận giao hàng
                </AppText>
                <Pressable
                    onPress={requestPermission}
                    style={{ backgroundColor: appTheme.colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: appTheme.radius.md }}
                >
                    <Text color="#fff" fontWeight="900" fontSize={14}>Cấp quyền</Text>
                </Pressable>
            </YStack>
        );
    }

    // ── Camera layout ────────────────────────────────────────────────────────

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            {/* Camera — always live, never unmounts */}
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

            {/* Corner frame guides — visible when active slot is empty */}
            {!currentUri ? (
                <View style={styles.frameContainer} pointerEvents="none">
                    <View style={[styles.corner, styles.cornerTL]} />
                    <View style={[styles.corner, styles.cornerTR]} />
                    <View style={[styles.corner, styles.cornerBL]} />
                    <View style={[styles.corner, styles.cornerBR]} />
                </View>
            ) : null}

            {/* Top bar */}
            <View style={styles.topBar}>
                <XStack paddingHorizontal={20} paddingTop={56} paddingBottom={14} alignItems="center" gap={12}>
                    <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}>
                        <ChevronLeft size={20} color="#fff" />
                    </Pressable>
                    <YStack flex={1} gap={2}>
                        <Text fontSize={15} fontWeight="900" color="#fff">
                            {SLOT_GUIDE[activeSlot]}
                        </Text>
                        <Text fontSize={11} color="rgba(255,255,255,0.65)">Chuyến #{tripId}</Text>
                    </YStack>
                </XStack>
            </View>

            {/* Bottom panel — overlaid on camera */}
            <View style={styles.bottomPanel}>
                {/* Thumbnail strip */}
                <XStack paddingHorizontal={20} gap={10} alignItems="flex-end">
                    {slots.map((slot) => (
                        <ThumbSlot
                            key={slot}
                            label={SLOT_LABEL[slot]}
                            uri={slot === 'receipt' ? receiptUri : proofUri}
                            active={activeSlot === slot}
                            onPress={() => setActiveSlot(slot)}
                            onDelete={() => handleDelete(slot)}
                        />
                    ))}

                    {/* Right side: confirm button (grows to fill) */}
                    <View style={{ flex: 1 }} />
                    {allDone ? (
                        <Pressable
                            onPress={handleConfirm}
                            disabled={isUploading}
                            style={[styles.confirmBtn, isUploading && { opacity: 0.7 }]}
                        >
                            <CheckCircle size={16} color="#fff" />
                            <Text fontSize={13} fontWeight="900" color="#fff">
                                {isUploading ? 'Đang tải...' : 'Hoàn thành'}
                            </Text>
                        </Pressable>
                    ) : null}
                </XStack>

                {/* Error */}
                {error ? (
                    <View style={styles.errorBar}>
                        <Text fontSize={12} color="#fff">{error}</Text>
                    </View>
                ) : null}

                {/* Guide + Shutter */}
                <YStack alignItems="center" gap={12} paddingBottom={44} paddingTop={16}>
                    <Text style={styles.guideText}>
                        {currentUri
                            ? `${SLOT_LABEL[activeSlot]} đã chụp — nhấn nút dưới để chụp lại`
                            : SLOT_GUIDE[activeSlot]}
                    </Text>
                    <Pressable onPress={takePicture} style={styles.shutterBtn}>
                        <View style={styles.shutterInner}>
                            <Camera size={28} color={appTheme.colors.primary} />
                        </View>
                    </Pressable>
                    {isFinal ? (
                        <Text style={styles.stepHint}>
                            {slots.map(s =>
                                (s === 'receipt' ? receiptUri : proofUri) ? `✓ ${SLOT_LABEL[s]}` : `○ ${SLOT_LABEL[s]}`
                            ).join('   ')}
                        </Text>
                    ) : null}
                </YStack>
            </View>
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const C  = 28;
const CT = 3;
const SLOT_SIZE = 72;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },

    // Frame guides
    frameContainer: {
        position: 'absolute', top: '22%', left: '10%', right: '10%', bottom: '28%',
    },
    corner:    { position: 'absolute', width: C, height: C, borderColor: 'rgba(255,255,255,0.9)' },
    cornerTL:  { top: 0, left: 0, borderTopWidth: CT, borderLeftWidth: CT, borderTopLeftRadius: 4 },
    cornerTR:  { top: 0, right: 0, borderTopWidth: CT, borderRightWidth: CT, borderTopRightRadius: 4 },
    cornerBL:  { bottom: 0, left: 0, borderBottomWidth: CT, borderLeftWidth: CT, borderBottomLeftRadius: 4 },
    cornerBR:  { bottom: 0, right: 0, borderBottomWidth: CT, borderRightWidth: CT, borderBottomRightRadius: 4 },

    // Top bar
    topBar: {
        position: 'absolute', top: 0, left: 0, right: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    iconBtn: {
        width: 40, height: 40, borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.18)',
        alignItems: 'center', justifyContent: 'center',
    },

    // Bottom panel
    bottomPanel: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingTop: 14,
        gap: 0,
    },

    // Thumbnail slots
    slot: {
        width: SLOT_SIZE, height: SLOT_SIZE,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
        overflow: 'visible',
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    slotActive: {
        borderColor: appTheme.colors.primary,
        borderWidth: 2.5,
    },
    slotImg: {
        width: '100%', height: '100%',
        borderRadius: 10,
    },
    slotDelete: {
        position: 'absolute', top: -6, right: -6,
        width: 20, height: 20, borderRadius: 10,
        backgroundColor: appTheme.colors.danger,
        alignItems: 'center', justifyContent: 'center',
        zIndex: 10,
    },
    slotDone: {
        position: 'absolute', bottom: 4, right: 4,
        width: 18, height: 18, borderRadius: 9,
        backgroundColor: appTheme.colors.success,
        alignItems: 'center', justifyContent: 'center',
    },
    slotActiveLabel: {
        position: 'absolute', bottom: -16, left: 0, right: 0,
        alignItems: 'center',
    },

    // Confirm button (beside thumbnails)
    confirmBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: appTheme.colors.primary,
        paddingHorizontal: 14, paddingVertical: 10,
        borderRadius: appTheme.radius.md,
        alignSelf: 'flex-end',
        marginBottom: 4,
    },

    // Error
    errorBar: {
        marginHorizontal: 20, marginTop: 10,
        padding: 10, borderRadius: 10,
        backgroundColor: appTheme.colors.danger,
    },

    // Shutter area
    guideText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.8)',
        fontWeight: '600',
        textAlign: 'center',
        paddingHorizontal: 24,
    },
    shutterBtn: {
        width: 76, height: 76, borderRadius: 38,
        backgroundColor: '#fff',
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
    },
    shutterInner: {
        width: 62, height: 62, borderRadius: 31,
        backgroundColor: '#fff',
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: appTheme.colors.primaryMuted,
    },
    stepHint: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.65)',
        fontWeight: '700',
        letterSpacing: 0.5,
    },
});
