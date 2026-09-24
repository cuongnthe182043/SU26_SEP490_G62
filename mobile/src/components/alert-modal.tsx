import { useEffect, useRef } from 'react';
// Modal THÔ của react-native, cố ý KHÔNG dùng AppModal: AppModal bọc con nó trong
// UIOverlaySlot, mà chính component này LÀ nội dung của slot — dùng AppModal ở đây là
// đệ quy. Đây là ngoại lệ duy nhất của quy ước "mọi nơi dùng AppModal".
import { Animated, Modal, Pressable, StyleSheet } from 'react-native';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';

import { appTheme } from '@/theme/app-theme';
import type { AlertOptions } from '@/providers/ui-provider';

type AlertType = NonNullable<AlertOptions['type']>;

type IconConfig = {
    Icon: React.ComponentType<{ size: number; color: string }>;
    iconColor: string;
    iconBg: string;
};

const ICON_CONFIGS: Record<AlertType, IconConfig> = {
    success: {
        Icon: CheckCircle2,
        iconColor: appTheme.colors.success,
        iconBg: appTheme.colors.successSoft,
    },
    error: {
        Icon: XCircle,
        iconColor: appTheme.colors.danger,
        iconBg: appTheme.colors.dangerSoft,
    },
    warning: {
        Icon: AlertTriangle,
        iconColor: appTheme.colors.warning,
        iconBg: appTheme.colors.warningSoft,
    },
    info: {
        Icon: Info,
        iconColor: appTheme.colors.primary,
        iconBg: appTheme.colors.primarySoft,
    },
};

type Props = {
    opts: AlertOptions & { visible: boolean };
    onClose: () => void;
};

export function AlertModal({ opts, onClose }: Props) {
    const backdropOpacity = useRef(new Animated.Value(0)).current;
    const scale           = useRef(new Animated.Value(0.88)).current;
    const opacity         = useRef(new Animated.Value(0)).current;

    const type = opts.type ?? 'info';
    const cfg = ICON_CONFIGS[type];

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

    // Hộp còn nhận chạm suốt 180ms chạy hiệu ứng đóng, nên bấm OK rồi chạm nền (hoặc
    // bấm Back) trong khoảng đó gọi onClose HAI lần. Hàng đợi ở UIProvider hiểu mỗi
    // lần gọi là "đóng một hộp", nên lần thừa sẽ nuốt luôn hộp đang xếp sau — thông
    // báo kế tiếp biến mất mà không ai thấy. Chốt cửa ngay lần đầu.
    const dismissedRef = useRef(false);

    const dismiss = () => {
        if (dismissedRef.current) return;
        dismissedRef.current = true;
        Animated.parallel([
            Animated.timing(backdropOpacity, {
                toValue: 0, duration: 180, useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 0, duration: 160, useNativeDriver: true,
            }),
        ]).start(() => onClose());
    };

    // Back của Android do chính Modal nhận qua onRequestClose — không cần BackHandler
    // riêng nữa, và như thế cũng hết cảnh hai lớp cùng giành phím Back.

    return (
        <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={dismiss}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
            <Animated.View style={[styles.card, { transform: [{ scale }], opacity }]}>
                {/* Icon */}
                <XStack justifyContent="center" marginBottom={16}>
                    <XStack
                        width={56} height={56} borderRadius={20}
                        backgroundColor={cfg.iconBg}
                        alignItems="center" justifyContent="center"
                    >
                        <cfg.Icon size={28} color={cfg.iconColor} />
                    </XStack>
                </XStack>

                <YStack gap={6} alignItems="center" marginBottom={24}>
                    <Text fontSize={17} fontWeight="900" color={appTheme.colors.text} textAlign="center">
                        {opts.title}
                    </Text>
                    {opts.message ? (
                        <Text fontSize={14} lineHeight={20} color={appTheme.colors.textMuted} textAlign="center">
                            {opts.message}
                        </Text>
                    ) : null}
                </YStack>

                <Pressable
                    onPress={dismiss}
                    style={({ pressed }) => [
                        styles.btn,
                        { backgroundColor: pressed ? appTheme.colors.primaryDark : appTheme.colors.primary },
                    ]}
                >
                    <Text fontSize={14} fontWeight="900" color={appTheme.colors.surface}>
                        {opts.okLabel ?? 'OK'}
                    </Text>
                </Pressable>
            </Animated.View>
        </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    // Nằm TRONG một <Modal> native, nên absoluteFillObject phủ đúng cửa sổ Modal —
    // tức đúng màn hình — bất kể cây View của app bên ngoài trông như thế nào.
    //
    // Trước đây hộp này là View thường vẽ ở gốc app và tin rằng `position: absolute`
    // sẽ phủ kín màn hình. Trên Expo Go/iOS thì không: ảnh chụp cho thấy nền mờ chỉ
    // chiếm dải ~476px dưới cùng còn <Stack> chiếm 1570px phía trên — cộng lại vừa
    // đúng chiều cao màn hình, tức lớp phủ đang được xếp TRONG LUỒNG như một View
    // thường và chia chỗ với Stack. Không có giá trị style nào chữa được chuyện đó;
    // chỉ có cửa sổ riêng của Modal mới thoát hẳn khỏi layout của cha.
    //
    // Modal cũng làm luôn việc mà elevation từng phải gánh (nổi trên thanh tab) và
    // việc của BackHandler (phím Back), nên cả hai đã bỏ khỏi đây.
    backdrop: {
        ...StyleSheet.absoluteFillObject,
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
        height: 48,
        borderRadius: appTheme.radius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
