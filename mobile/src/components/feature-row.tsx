import type { ReactNode } from 'react';
import { XStack, YStack } from 'tamagui';

import { AppText } from '@/components/app-text';
import { appTheme } from '@/theme/app-theme';

type FeatureRowProps = {
  icon: ReactNode;
  title: string;
  description: string;
};

export function FeatureRow({ icon, title, description }: FeatureRowProps) {
  return (
    <XStack
      alignItems="center"
      gap="$3"
      padding="$3"
      borderRadius={appTheme.radius.md}
      backgroundColor={appTheme.colors.surface}
      borderWidth={1}
      borderColor={appTheme.colors.border}
    >
      <XStack
        width={46}
        height={46}
        borderRadius={appTheme.radius.sm}
        alignItems="center"
        justifyContent="center"
        backgroundColor={appTheme.colors.primarySoft}
      >
        {icon}
      </XStack>

      <YStack flex={1} gap="$1">
        <AppText variant="bodyStrong">
          {title}
        </AppText>
        <AppText variant="caption" tone="muted">
          {description}
        </AppText>
      </YStack>
    </XStack>
  );
}
