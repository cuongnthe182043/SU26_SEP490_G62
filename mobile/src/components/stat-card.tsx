import { Text, YStack } from 'tamagui';

import { appTheme } from '@/theme/app-theme';

type StatCardProps = {
  value: string;
  label: string;
};

export function StatCard({ value, label }: StatCardProps) {
  return (
    <YStack
      flex={1}
      minWidth={98}
      gap="$1"
      padding="$3"
      borderRadius={appTheme.radius.md}
      backgroundColor={appTheme.colors.surface}
      borderWidth={1}
      borderColor={appTheme.colors.border}
    >
      <Text fontSize={21} fontWeight="900" color={appTheme.colors.primary}>
        {value}
      </Text>
      <Text fontSize={12} lineHeight={16} color={appTheme.colors.textMuted}>
        {label}
      </Text>
    </YStack>
  );
}
