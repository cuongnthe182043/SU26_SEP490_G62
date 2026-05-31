import type { ReactNode } from 'react';
import { Input, YStack } from 'tamagui';

import { AppText } from '@/components/app-text';
import { appTheme } from '@/theme/app-theme';

type FormFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  error?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  rightElement?: ReactNode;
};

export function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'none',
  rightElement,
}: FormFieldProps) {
  return (
    <YStack gap="$2">
      <AppText variant="caption">
        {label}
      </AppText>
      <Input
        height={54}
        borderRadius={appTheme.radius.md}
        borderColor={error ? appTheme.colors.danger : appTheme.colors.border}
        backgroundColor={appTheme.colors.surface}
        color={appTheme.colors.text}
        fontFamily={appTheme.typography.fontFamily.regular}
        placeholder={placeholder}
        placeholderTextColor={appTheme.colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        paddingRight={rightElement ? 48 : undefined}
        focusStyle={{
          borderColor: appTheme.colors.primary,
        }}
      />
      {error ? (
        <AppText selectable variant="caption" tone="danger">
          {error}
        </AppText>
      ) : null}
      {rightElement}
    </YStack>
  );
}
