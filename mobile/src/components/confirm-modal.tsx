import { useEffect, useRef } from 'react';
import { Animated, BackHandler, Pressable, StyleSheet } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';

import { appTheme } from '@/theme/app-theme';
import type { ConfirmOptions } from '@/providers/ui-provider';

type Props = {
    opts: ConfirmOptions & { visible: boolean };
    onResult: (result: boolean) => void;
};

export function ConfirmModal({ opts, onResult }: Props) {
    const backdropOpacity = useRef(new Animated.Value(0)).current;
    const scale           = useRef(new Animated.Value(0.88)).current;
    const opacity         = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(backdropOpacity, {
                toValue: 1, duration: 220, useNativeDriver: true,
            }),
            Animated.spring(scale, {
                toValue: 1, tension: 120, friction: 8, useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 1, duration: 200, useNativeDriver: true,
            }),
        ]).start();
    }, []);

    // Xem alert-modal.tsx: chạm thêm lần nữa trong lúc hiệu ứng đóng còn chạy sẽ
    // báo cho hàng đợi đóng thêm một hộp — và ở đây còn tệ hơn, "Huỷ" bấm nhầm sau
    // "Xác nhận" sẽ trả kết quả cho hộp xếp sau. Chỉ lần bấm đầu tiên được tính.
    const dismissedRef = useRef(false);

    const dismiss = (result: boolean) => {
        if (dismissedRef.current) return;
        dismissedRef.current = true;
        Animated.parallel([
            Animated.timing(backdropOpacity, {
                toValue: 0, duration: 180, useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 0, duration: 160, useNativeDriver: true,
            }),
        ]).start(() => onResult(result));
    };

    // Hộp là View chứ không phải native Modal, nên nút Back của Android không tự đóng nó:
    // Back sẽ đưa màn hình bên dưới lùi đi mà hộp vẫn đè lên, bấm "Xác nhận" lúc đó là chạy
    // việc của màn đã đóng. Back = Huỷ. (Nằm trong một Modal thì Modal đó nhận Back trước.)
    useEffect(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            dismiss(false);
            return true;
        });
        return () => sub.remove();
    }, []);

    return (
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => dismiss(false)} />
            <Animated.View style={[styles.card, { transform: [{ scale }], opacity }]}>
                <YStack gap={8} marginBottom={20}>
                    <Text fontSize={17} fontWeight="900" color={appTheme.colors.text}>
                        {opts.title}
                    </Text>
                    {opts.message ? (
                        <Text fontSize={14} lineHeight={20} color={appTheme.colors.textMuted}>
                            {opts.message}
                        </Text>
                    ) : null}
                </YStack>

                <XStack gap={10}>
                    <Pressable
                        onPress={() => dismiss(false)}
                        style={({ pressed }) => [
                            styles.btn,
                            {
                                backgroundColor: pressed
                                    ? appTheme.colors.surfaceSoft
                                    : appTheme.colors.surface,
                                borderColor: appTheme.colors.border,
                            },
                        ]}
                    >
                        <Text fontSize={14} fontWeight="800" color={appTheme.colors.textMuted}>
                            {opts.cancelLabel ?? 'Hủy'}
                        </Text>
                    </Pressable>

                    <Pressable
                        onPress={() => dismiss(true)}
                        style={({ pressed }) => [
                            styles.btn,
                            {
                                backgroundColor: opts.danger
                                    ? pressed ? '#B91C1C' : appTheme.colors.danger
                                    : pressed ? appTheme.colors.primaryDark : appTheme.colors.primary,
                                borderColor: 'transparent',
                            },
                        ]}
                    >
                        <Text fontSize={14} fontWeight="900" color={appTheme.colors.surface}>
                            {opts.confirmLabel ?? 'Xác nhận'}
                        </Text>
                    </Pressable>
                </XStack>
            </Animated.View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9998,
        // Xem alert-modal.tsx / appTheme.overlayElevation. Ở hộp xác nhận thì hậu quả
        // nặng hơn: bấm được thanh tab trong lúc hộp đang chờ trả lời nghĩa là màn hình
        // bên dưới đổi mất, rồi "Xác nhận" chạy việc của màn đã rời đi.
        elevation: appTheme.overlayElevation,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    card: {
        width: '100%',
        backgroundColor: appTheme.colors.surface,
        borderRadius: appTheme.radius.xl,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 12,
    },
    btn: {
        flex: 1,
        height: 48,
        borderRadius: appTheme.radius.md,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
