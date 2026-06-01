import { Pressable } from 'react-native';
import { Text, XStack } from 'tamagui';
import { appTheme } from '@/theme/app-theme';

type Tone = 'primary' | 'secondary' | 'danger';

type Props = {
    label: string;
    onPress: () => void;
    isLoading?: boolean;
    disabled?: boolean;
    tone?: Tone;
    icon?: React.ReactNode;
};

const TONE_COLORS: Record<Tone, { bg: string; bgPress: string; text: string; border: string }> = {
    primary: {
        bg: appTheme.colors.primary,
        bgPress: appTheme.colors.primaryDark,
        text: '#fff',
        border: appTheme.colors.primary,
    },
    secondary: {
        bg: appTheme.colors.surface,
        bgPress: appTheme.colors.primarySoft,
        text: appTheme.colors.primary,
        border: appTheme.colors.primaryMuted,
    },
    danger: {
        bg: appTheme.colors.dangerSoft,
        bgPress: appTheme.colors.dangerBorder,
        text: appTheme.colors.danger,
        border: appTheme.colors.dangerBorder,
    },
};

export function LifecycleActionButton({ label, onPress, isLoading, disabled, tone = 'primary', icon }: Props) {
    const colors = TONE_COLORS[tone];
    const isDisabled = disabled || isLoading;

    return (
        <Pressable
            onPress={isDisabled ? undefined : onPress}
            style={({ pressed }) => ({
                height: 52,
                borderRadius: appTheme.radius.md,
                backgroundColor: isDisabled
                    ? appTheme.colors.border
                    : pressed
                        ? colors.bgPress
                        : colors.bg,
                borderWidth: 1,
                borderColor: isDisabled ? appTheme.colors.border : colors.border,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isDisabled ? 0.7 : 1,
            })}
        >
            <XStack alignItems="center" gap={8}>
                {icon}
                <Text
                    fontSize={14}
                    fontWeight="900"
                    color={isDisabled ? appTheme.colors.textMuted : colors.text}
                >
                    {isLoading ? 'Đang xử lý...' : label}
                </Text>
            </XStack>
        </Pressable>
    );
}
