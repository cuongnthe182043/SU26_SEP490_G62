import type { ButtonProps } from 'tamagui';
import { Button } from 'tamagui';

import { appTheme } from '@/theme/app-theme';

type AppButtonProps = ButtonProps & {
  tone?: 'primary' | 'secondary';
};

export function AppButton({ tone = 'primary', ...props }: AppButtonProps) {
  const isPrimary = tone === 'primary';

  return (
    <Button
      height={54}
      borderRadius={appTheme.radius.md}
      fontSize={16}
      fontWeight="700"
      backgroundColor={isPrimary ? appTheme.colors.primary : appTheme.colors.surface}
      color={isPrimary ? appTheme.colors.surface : appTheme.colors.primary}
      borderWidth={1}
      borderColor={isPrimary ? appTheme.colors.primary : appTheme.colors.primaryMuted}
      pressStyle={{
        scale: 0.98,
        backgroundColor: isPrimary ? appTheme.colors.primaryDark : appTheme.colors.primarySoft,
      }}
      {...props}
    />
  );
}
