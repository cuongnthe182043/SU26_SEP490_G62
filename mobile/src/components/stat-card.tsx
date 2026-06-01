import { YStack } from 'tamagui';

import { AppText } from '@/components/app-text';
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
      <AppText variant="sectionTitle" tone="primary">
        {value}
      </AppText>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
    </YStack>
  );
}
