import type { GetProps } from 'tamagui';
import { Text } from 'tamagui';

import { appTheme } from '@/theme/app-theme';

type TextVariant = 'caption' | 'body' | 'bodyStrong' | 'sectionTitle' | 'title' | 'display';
type TextTone = 'default' | 'muted' | 'primary' | 'inverse' | 'danger' | 'success';

type AppTextProps = GetProps<typeof Text> & {
  variant?: TextVariant;
  tone?: TextTone;
};

const variantStyles: Record<TextVariant, Pick<AppTextProps, 'fontFamily' | 'fontSize' | 'lineHeight' | 'fontWeight'>> = {
  caption: {
    fontFamily: appTheme.typography.fontFamily.medium,
    fontSize: appTheme.typography.size.xs,
    lineHeight: appTheme.typography.lineHeight.xs,
    fontWeight: appTheme.typography.weight.medium,
  },
  body: {
    fontFamily: appTheme.typography.fontFamily.regular,
    fontSize: appTheme.typography.size.md,
    lineHeight: appTheme.typography.lineHeight.md,
    fontWeight: appTheme.typography.weight.regular,
  },
  bodyStrong: {
    fontFamily: appTheme.typography.fontFamily.semiBold,
    fontSize: appTheme.typography.size.md,
    lineHeight: appTheme.typography.lineHeight.md,
    fontWeight: appTheme.typography.weight.bold,
  },
  sectionTitle: {
    fontFamily: appTheme.typography.fontFamily.bold,
    fontSize: appTheme.typography.size.xl,
    lineHeight: appTheme.typography.lineHeight.lg,
    fontWeight: appTheme.typography.weight.black,
  },
  title: {
    fontFamily: appTheme.typography.fontFamily.bold,
    fontSize: appTheme.typography.size.title,
    lineHeight: appTheme.typography.lineHeight.title,
    fontWeight: appTheme.typography.weight.black,
  },
  display: {
    fontFamily: appTheme.typography.fontFamily.bold,
    fontSize: appTheme.typography.size.display,
    lineHeight: appTheme.typography.lineHeight.display,
    fontWeight: appTheme.typography.weight.black,
  },
};

const toneColors: Record<TextTone, string> = {
  default: appTheme.colors.text,
  muted: appTheme.colors.textMuted,
  primary: appTheme.colors.primary,
  inverse: appTheme.colors.surface,
  danger: appTheme.colors.danger,
  success: appTheme.colors.success,
};

export function AppText({ variant = 'body', tone = 'default', color, ...props }: AppTextProps) {
  return (
    <Text
      color={color ?? toneColors[tone]}
      {...variantStyles[variant]}
      {...props}
    />
  );
}
