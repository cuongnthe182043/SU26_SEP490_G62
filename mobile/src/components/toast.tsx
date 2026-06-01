import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react-native';
import { Text, XStack } from 'tamagui';

import { appTheme } from '@/theme/app-theme';
import type { ToastType } from '@/providers/ui-provider';

type ToastConfig = {
    bg: string;
    border: string;
    text: string;
    Icon: React.ComponentType<{ size: number; color: string }>;
    iconColor: string;
};

const CONFIGS: Record<ToastType, ToastConfig> = {
    success: {
        bg: appTheme.colors.successSoft,
        border: appTheme.colors.successBorder,
        text: appTheme.colors.successText,
        Icon: CheckCircle2,
        iconColor: appTheme.colors.success,
    },
    error: {
        bg: appTheme.colors.dangerSoft,
        border: appTheme.colors.dangerBorder,
        text: appTheme.colors.dangerText,
        Icon: XCircle,
        iconColor: appTheme.colors.danger,
    },
    warning: {
        bg: appTheme.colors.warningSoft,
        border: appTheme.colors.warningBorder,
        text: appTheme.colors.warningText,
        Icon: AlertTriangle,
        iconColor: appTheme.colors.warning,
    },
    info: {
        bg: appTheme.colors.primarySoft,
        border: appTheme.colors.primaryMuted,
        text: appTheme.colors.primary,
        Icon: Info,
        iconColor: appTheme.colors.primary,
    },
};

type Props = {
    toast: { type: ToastType; message: string; visible: boolean };
    onHide: () => void;
};

export function ToastOverlay({ toast, onHide }: Props) {
    const insets = useSafeAreaInsets();
    const translateY = useRef(new Animated.Value(-80)).current;
    const opacity    = useRef(new Animated.Value(0)).current;

    const cfg = CONFIGS[toast.type];

    useEffect(() => {
        if (toast.visible) {
            Animated.parallel([
                Animated.spring(translateY, {
                    toValue: 0,
                    useNativeDriver: true,
                    tension: 100,
                    friction: 10,
                }),
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(translateY, {
                    toValue: -80,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start(() => onHide());
        }
    }, [toast.visible]);

    return (
        <Animated.View
            style={[
                styles.container,
                { top: insets.top + 12, transform: [{ translateY }], opacity },
            ]}
            pointerEvents="box-none"
        >
            <Pressable onPress={onHide}>
                <XStack
                    alignItems="center"
                    gap={10}
                    paddingHorizontal={16}
                    paddingVertical={13}
                    borderRadius={appTheme.radius.lg}
                    borderWidth={1}
                    borderColor={cfg.border}
                    backgroundColor={cfg.bg}
                    style={styles.card}
                >
                    <cfg.Icon size={20} color={cfg.iconColor} />
                    <Text flex={1} fontSize={13} fontWeight="700" color={cfg.text} lineHeight={18}>
                        {toast.message}
                    </Text>
                </XStack>
            </Pressable>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 16,
        right: 16,
        zIndex: 9999,
    },
    card: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
    },
});
