import type { ReactNode } from 'react';
import { Input, XStack, YStack } from 'tamagui';

import { AppText } from '@/components/app-text';
import { appTheme } from '@/theme/app-theme';

type FormFieldProps = {
  label: string;
  labelIcon?: ReactNode;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  error?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'number-pad' | 'numeric';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  rightElement?: ReactNode;
  maxLength?: number;
  editable?: boolean;
};

export function FormField({
  label,
  labelIcon,
  value,
  onChangeText,
  placeholder,
  error,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'none',
  rightElement,
  maxLength,
  editable = true,
}: FormFieldProps) {
  return (
    <YStack gap="$2">
      <XStack alignItems="center" gap={6}>
        {labelIcon}
        <AppText variant="caption">{label}</AppText>
      </XStack>
      <Input
        height={54}
        borderRadius={appTheme.radius.md}
        borderColor={error ? appTheme.colors.danger : appTheme.colors.border}
        backgroundColor={editable ? appTheme.colors.surface : appTheme.colors.surfaceSoft}
        color={editable ? appTheme.colors.text : appTheme.colors.textMuted}
        fontFamily={appTheme.typography.fontFamily.regular}
        placeholder={placeholder}
        placeholderTextColor={appTheme.colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        maxLength={maxLength}
        editable={editable}
        paddingRight={rightElement ? 48 : undefined}
        focusStyle={editable ? { borderColor: appTheme.colors.primary } : {}}
      />
      {error ? (
        <AppText selectable variant="caption" tone="danger">{error}</AppText>
      ) : null}
      {rightElement}
    </YStack>
  );
}
