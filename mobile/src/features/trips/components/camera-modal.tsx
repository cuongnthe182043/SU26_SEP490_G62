import { useRef } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CameraView } from 'expo-camera';
import { Camera, X } from 'lucide-react-native';
import { Text, XStack } from 'tamagui';

import { appTheme } from '@/theme/app-theme';

type Props = {
    visible: boolean;
    label: string;
    onCapture: (uri: string) => void;
    onClose: () => void;
};

const C  = 28;
const CT = 3;

export function CameraModal({ visible, label, onCapture, onClose }: Props) {
    const cameraRef = useRef<CameraView>(null);

    const handleShutter = async () => {
        if (!cameraRef.current) return;
        try {
            const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
            if (photo?.uri) onCapture(photo.uri);
        } catch {
            Alert.alert('Lỗi', 'Không thể chụp ảnh, vui lòng thử lại.');
        }
    };

    return (
        <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
            <View style={s.container}>
                <StatusBar style="light" />
                <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

                {/* Corner guides */}
                <View style={s.frame} pointerEvents="none">
                    <View style={[s.corner, s.TL]} /><View style={[s.corner, s.TR]} />
                    <View style={[s.corner, s.BL]} /><View style={[s.corner, s.BR]} />
                </View>

                {/* Top bar */}
                <View style={s.topBar}>
                    <XStack paddingHorizontal={20} paddingTop={56} paddingBottom={14} alignItems="center" gap={12}>
                        <Pressable onPress={onClose} hitSlop={12} style={s.iconBtn}>
                            <X size={20} color="#fff" />
                        </Pressable>
                        <Text fontSize={15} fontWeight="900" color="#fff">{label}</Text>
                    </XStack>
                </View>

                {/* Shutter */}
                <View style={s.shutterBar}>
                    <Text style={s.guide}>Đảm bảo ảnh rõ nét trước khi chụp</Text>
                    <Pressable onPress={handleShutter} style={s.shutter}>
                        <View style={s.shutterInner}>
                            <Camera size={28} color={appTheme.colors.primary} />
                        </View>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

const s = StyleSheet.create({
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
