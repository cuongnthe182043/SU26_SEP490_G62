import { useCallback, useRef, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { StatusBar } from 'expo-status-bar';
import { Camera, CheckCircle, ChevronLeft, RefreshCcw, X } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';

import { AppText } from '@/components/app-text';
import { appTheme } from '@/theme/app-theme';
import { useCompletionProof } from '@/hooks/use-completion-proof';

export function CompletionProofScreen() {
    const { tripId } = useLocalSearchParams<{ tripId: string }>();
    const tripIdNum = Number(tripId);

    const [permission, requestPermission] = useCameraPermissions();
    const [capturedUri, setCapturedUri] = useState<string | null>(null);
    const cameraRef = useRef<CameraView>(null);

    const { isUploading, error, completeWithProof } = useCompletionProof(() => {
        router.replace('/(tabs)');
    });

    const takePicture = useCallback(async () => {
        if (!cameraRef.current) return;
        try {
            const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
            if (photo?.uri) setCapturedUri(photo.uri);
        } catch {
            Alert.alert('Lỗi', 'Không thể chụp ảnh, vui lòng thử lại.');
        }
    }, []);

    const handleConfirm = useCallback(async () => {
        if (!capturedUri) return;
        await completeWithProof(tripIdNum, capturedUri);
    }, [capturedUri, tripIdNum, completeWithProof]);

    const handleRetake = useCallback(() => setCapturedUri(null), []);

    // Permission not yet determined
    if (!permission) {
        return (
            <YStack flex={1} backgroundColor="#000" alignItems="center" justifyContent="center">
                <AppText variant="body" tone="inverse">Đang kiểm tra quyền camera...</AppText>
            </YStack>
        );
    }

    // Permission denied
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

    // ─── Preview captured photo ───────────────────────────────────────────────
    if (capturedUri) {
        return (
            <View style={styles.container}>
                <StatusBar style="light" />
                <Image source={{ uri: capturedUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />

                {/* Top bar */}
                <View style={styles.topBar}>
                    <XStack paddingHorizontal={20} paddingTop={56} paddingBottom={16} justifyContent="space-between" alignItems="center">
                        <Pressable onPress={handleRetake} hitSlop={12} style={styles.iconBtn}>
                            <X size={20} color="#fff" />
                        </Pressable>
                        <YStack alignItems="center" gap={2}>
                            <Text fontSize={13} fontWeight="900" color="#fff">Xem lại ảnh</Text>
                            <Text fontSize={11} color="rgba(255,255,255,0.7)">Chuyến #{tripId}</Text>
                        </YStack>
                        <View style={{ width: 40 }} />
                    </XStack>
                </View>

                {/* Bottom actions */}
                <View style={styles.bottomSheet}>
                    {error ? (
                        <XStack marginHorizontal={20} marginBottom={12} padding={12} borderRadius={12} backgroundColor="rgba(220,38,38,0.9)">
                            <Text fontSize={12} color="#fff" flex={1}>{error}</Text>
                        </XStack>
                    ) : null}
                    <XStack paddingHorizontal={20} paddingBottom={40} gap={12}>
                        <Pressable onPress={handleRetake} style={[styles.actionBtn, styles.secondaryBtn]}>
                            <RefreshCcw size={18} color={appTheme.colors.primary} />
                            <Text fontSize={14} fontWeight="900" color={appTheme.colors.primary}>Chụp lại</Text>
                        </Pressable>
                        <Pressable
                            onPress={handleConfirm}
                            disabled={isUploading}
                            style={[styles.actionBtn, styles.primaryBtn, { opacity: isUploading ? 0.7 : 1 }]}
                        >
                            <CheckCircle size={18} color="#fff" />
                            <Text fontSize={14} fontWeight="900" color="#fff">
                                {isUploading ? 'Đang tải...' : 'Xác nhận & Hoàn thành'}
                            </Text>
                        </Pressable>
                    </XStack>
                </View>
            </View>
        );
    }

    // ─── Camera viewfinder ────────────────────────────────────────────────────
    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

            {/* Top bar */}
            <View style={styles.topBar}>
                <XStack paddingHorizontal={20} paddingTop={56} paddingBottom={16} alignItems="center" gap={12}>
                    <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}>
                        <ChevronLeft size={20} color="#fff" />
                    </Pressable>
                    <YStack flex={1}>
                        <Text fontSize={15} fontWeight="900" color="#fff">Chụp ảnh xác nhận</Text>
                        <Text fontSize={11} color="rgba(255,255,255,0.7)">Chuyến #{tripId} — đặt hàng vào khung</Text>
                    </YStack>
                </XStack>
            </View>

            {/* Guide frame corners */}
            <View style={styles.frameContainer} pointerEvents="none">
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
            </View>

            {/* Shutter button */}
            <View style={styles.shutterBar}>
                <Text style={styles.guideText}>Đảm bảo ảnh rõ nét và đủ hàng hóa</Text>
                <Pressable onPress={takePicture} style={styles.shutterBtn}>
                    <View style={styles.shutterInner}>
                        <Camera size={28} color={appTheme.colors.primary} />
                    </View>
                </Pressable>
            </View>
        </View>
    );
}

const C = 28; // corner size
const CT = 3;  // corner thickness

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    topBar: {
        position: 'absolute', top: 0, left: 0, right: 0,
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    iconBtn: {
        width: 40, height: 40, borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center', justifyContent: 'center',
    },
    frameContainer: {
        position: 'absolute', top: '25%', left: '10%', right: '10%', bottom: '25%',
    },
    corner: { position: 'absolute', width: C, height: C, borderColor: '#fff' },
    cornerTL: { top: 0, left: 0, borderTopWidth: CT, borderLeftWidth: CT, borderTopLeftRadius: 4 },
    cornerTR: { top: 0, right: 0, borderTopWidth: CT, borderRightWidth: CT, borderTopRightRadius: 4 },
    cornerBL: { bottom: 0, left: 0, borderBottomWidth: CT, borderLeftWidth: CT, borderBottomLeftRadius: 4 },
    cornerBR: { bottom: 0, right: 0, borderBottomWidth: CT, borderRightWidth: CT, borderBottomRightRadius: 4 },
    shutterBar: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingBottom: 48, paddingTop: 24,
        alignItems: 'center', gap: 20,
        backgroundColor: 'rgba(0,0,0,0.35)',
    },
    guideText: { fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: '600' },
    shutterBtn: {
        width: 76, height: 76, borderRadius: 38,
        backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
        shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, elevation: 6,
    },
    shutterInner: {
        width: 62, height: 62, borderRadius: 31,
        backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: appTheme.colors.primaryMuted,
    },
    bottomSheet: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    actionBtn: {
        flex: 1, height: 52, borderRadius: appTheme.radius.md,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    },
    primaryBtn: { backgroundColor: appTheme.colors.primary },
    secondaryBtn: { backgroundColor: 'rgba(255,255,255,0.92)' },
});
