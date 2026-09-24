import { useEffect, useRef } from 'react';
// Modal THÔ, không phải AppModal — xem ghi chú ở alert-modal.tsx (AppModal bọc
// UIOverlaySlot, mà component này chính là nội dung của slot).
import { Animated, Modal, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';

import { appTheme } from '@/theme/app-theme';
import type { ConfirmOptions } from '@/providers/ui-provider';

type Props = {
    opts: ConfirmOptions & { visible: boolean };
    onResult: (result: boolean) => void;
};

export function ConfirmModal({ opts, onResult }: Props) {
    // Kích thước tường minh cho lớp nền — xem ghi chú ở styles.backdrop của alert-modal.tsx.
    const { width, height } = useWindowDimensions();
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

    // Back = Huỷ, do chính Modal nhận qua onRequestClose. Quan trọng vì nếu không, Back
    // đưa màn hình bên dưới lùi đi mà hộp vẫn đè lên, rồi bấm "Xác nhận" là chạy việc
    // của màn đã đóng.
    return (
        <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={() => dismiss(false)}>
        <Animated.View style={[styles.backdrop, { width, height, opacity: backdropOpacity }]}>
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
        </Modal>
    );
}

const styles = StyleSheet.create({
    // width/height gắn lúc render từ useWindowDimensions — xem ghi chú dài ở
    // alert-modal.tsx về việc vì sao không dựa vào absoluteFill.
    backdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
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
