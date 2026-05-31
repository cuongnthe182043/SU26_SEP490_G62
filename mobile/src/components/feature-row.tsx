import type { ReactNode } from 'react';
import { Text, XStack, YStack } from 'tamagui';

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
        <Text fontSize={15} fontWeight="700" color={appTheme.colors.text}>
          {title}
        </Text>
        <Text fontSize={13} lineHeight={19} color={appTheme.colors.textMuted}>
          {description}
        </Text>
      </YStack>
    </XStack>
  );
}
