import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Camera, Trash2 } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';

import { appTheme } from '@/theme/app-theme';

type Props = {
    label: string;
    sublabel: string;
    uri: string | null;
    required?: boolean;
    onCapture: () => void;
    onDelete: () => void;
};

export function PhotoCaptureCard({ label, sublabel, uri, required, onCapture, onDelete }: Props) {
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
                <Image source={{ uri }} style={s.thumb} resizeMode="cover" />
                <YStack flex={1} paddingHorizontal={12} paddingVertical={10} gap={3}>
                    <XStack alignItems="center" gap={6}>
                        <View style={s.doneDot} />
                        <Text flex={1} fontSize={13} fontWeight="900" color={appTheme.colors.text} numberOfLines={2}>
                            {label}
                        </Text>
                    </XStack>
                    <Text fontSize={11} color={appTheme.colors.textMuted} numberOfLines={2}>{sublabel}</Text>
                    <Pressable onPress={onCapture} hitSlop={6} style={s.retakeRow}>
                        <Camera size={12} color={appTheme.colors.primary} />
                        <Text fontSize={11} color={appTheme.colors.primary} fontWeight="700">Chụp lại</Text>
                    </Pressable>
                </YStack>
                <Pressable onPress={onDelete} hitSlop={8} style={s.deleteBtn}>
                    <Trash2 size={18} color={appTheme.colors.danger} />
                </Pressable>
            </XStack>
        );
    }

    return (
        <Pressable onPress={onCapture} style={{ borderRadius: appTheme.radius.md }}>
            <XStack
                borderRadius={appTheme.radius.md}
                borderWidth={1.5}
                borderStyle="dashed"
                borderColor={appTheme.colors.border}
                backgroundColor={appTheme.colors.surfaceSoft}
                padding={14}
                alignItems="flex-start"
                gap={12}
            >
                <XStack
                    width={44} height={44} borderRadius={14}
                    backgroundColor={appTheme.colors.primarySoft}
                    alignItems="center" justifyContent="center"
                >
                    <Camera size={22} color={appTheme.colors.primary} />
                </XStack>
                <YStack flex={1} gap={8}>
                    <XStack alignItems="center" gap={6} flexWrap="wrap">
                        <Text flexShrink={1} fontSize={13} fontWeight="900" color={appTheme.colors.text}>{label}</Text>
                        {required ? (
                            <View style={s.requiredBadge}>
                                <Text fontSize={9} fontWeight="900" color={appTheme.colors.danger}>BẮT BUỘC</Text>
                            </View>
                        ) : null}
                    </XStack>
                    <Text fontSize={11} color={appTheme.colors.textMuted}>{sublabel}</Text>
                    <Pressable onPress={onCapture} hitSlop={6} style={s.captureBtn}>
                        <Camera size={12} color={appTheme.colors.primary} />
                        <Text fontSize={11} fontWeight="900" color={appTheme.colors.primary}>Chụp</Text>
                    </Pressable>
                </YStack>
            </XStack>
        </Pressable>
    );
}

const s = StyleSheet.create({
    thumb: { width: 80, height: 80 },
    doneDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: appTheme.colors.success },
    retakeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    deleteBtn: { paddingHorizontal: 14, paddingVertical: 12 },
    captureBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: appTheme.colors.primarySoft,
    },
    requiredBadge: {
        paddingHorizontal: 6, paddingVertical: 2,
        borderRadius: 6, backgroundColor: '#fee2e2',
    },
});
