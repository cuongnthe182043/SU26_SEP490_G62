import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
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

    const dismiss = () => {
        Animated.parallel([
            Animated.timing(backdropOpacity, {
                toValue: 0, duration: 180, useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 0, duration: 160, useNativeDriver: true,
            }),
        ]).start(() => onClose());
    };

    return (
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
    );
}

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9998,
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
