import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import type { ButtonProps } from 'tamagui';
import { Button, XStack } from 'tamagui';

import { AppText } from '@/components/app-text';
import { appTheme } from '@/theme/app-theme';

type AppButtonProps = ButtonProps & {
  tone?: 'primary' | 'secondary';
  isLoading?: boolean;
};

export function AppButton({
  tone = 'primary',
  isLoading = false,
  disabled,
  children,
  ...props
}: AppButtonProps) {
  const isPrimary = tone === 'primary';
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isLoading) {
      spinValue.setValue(0);
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 700,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ).start();
    } else {
      spinValue.stopAnimation();
      spinValue.setValue(0);
    }
  }, [isLoading]);

  const rotate = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const spinnerColor = isPrimary ? appTheme.colors.surface : appTheme.colors.primary;
  const textColor = isPrimary ? appTheme.colors.surface : appTheme.colors.primary;

  return (
    <Button
      height={54}
      borderRadius={appTheme.radius.md}
      backgroundColor={isPrimary ? appTheme.colors.primary : appTheme.colors.surface}
      borderWidth={1}
      borderColor={isPrimary ? appTheme.colors.primary : appTheme.colors.primaryMuted}
      pressStyle={
        isLoading
          ? {}
          : {
              scale: 0.98,
              backgroundColor: isPrimary
                ? appTheme.colors.primaryDark
                : appTheme.colors.primarySoft,
            }
      }
      disabled={isLoading || disabled}
      opacity={1}
      {...props}
    >
      <XStack alignItems="center" justifyContent="center" gap={10}>
        {isLoading && (
          <Animated.View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              borderWidth: 2.5,
              borderColor: 'transparent',
              borderTopColor: spinnerColor,
              borderRightColor: spinnerColor,
              transform: [{ rotate }],
            }}
          />
        )}
        <AppText variant="bodyStrong" color={textColor}>
          {children}
        </AppText>
      </XStack>
    </Button>
  );
}
