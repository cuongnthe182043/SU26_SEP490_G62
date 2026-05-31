import { useMemo, useState } from 'react';
import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react-native';
import { ScrollView, Text, XStack, YStack } from 'tamagui';

import { AppButton } from '@/components/app-button';
import { FormField } from '@/components/form-field';
import { appTheme } from '@/theme/app-theme';

import { hasLoginErrors, type LoginFormErrors, validateLoginForm } from './login-validation';
import { useLogin } from './use-login';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState<LoginFormErrors>({});
  const { error, isLoading, login } = useLogin();

  const canSubmit = useMemo(() => email.trim().length > 0 && password.length > 0, [email, password]);

  const handleSubmit = async () => {
    const nextErrors = validateLoginForm(email, password);
    setFormErrors(nextErrors);

    if (hasLoginErrors(nextErrors) || isLoading) return;

    const result = await login(email, password);
    if (result) {
      setPassword('');
      router.replace('/driver-home');
    }
  };

  return (
    <>
      <StatusBar style="dark" />
      <ScrollView
        flex={1}
        backgroundColor={appTheme.colors.background}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: appTheme.spacing.screenX,
          paddingTop: appTheme.spacing.screenTop,
          paddingBottom: appTheme.spacing.screenBottom,
        }}
      >
        <YStack flex={1} justifyContent="space-between" gap="$6">
          <YStack gap="$6">
            <XStack alignItems="center" justifyContent="space-between">
              <XStack
                width={52}
                height={52}
                borderRadius={20}
                alignItems="center"
                justifyContent="center"
                backgroundColor={appTheme.colors.primary}
              >
                <LockKeyhole size={25} color={appTheme.colors.surface} />
              </XStack>

              <XStack
                alignItems="center"
                gap="$2"
                height={36}
                paddingHorizontal="$3"
                borderRadius={appTheme.radius.pill}
                backgroundColor={appTheme.colors.primarySoft}
              >
                <ShieldCheck size={15} color={appTheme.colors.primary} />
                <Text fontSize={12} fontWeight="900" color={appTheme.colors.primary}>
                  {'B\u1ea3o m\u1eadt'}
                </Text>
              </XStack>
            </XStack>

            <YStack gap="$3">
              <Text fontSize={38} lineHeight={44} fontWeight="900" color={appTheme.colors.text}>
                {'\u0110\u0103ng nh\u1eadp'}
              </Text>
              <Text fontSize={16} lineHeight={24} color={appTheme.colors.textMuted}>
                {'Truy c\u1eadp h\u1ec7 th\u1ed1ng giao v\u1eadn \u0111\u1ec3 theo d\u00f5i \u0111\u01a1n h\u00e0ng, \u0111i\u1ec1u ph\u1ed1i v\u00e0 x\u1eed l\u00fd c\u00f4ng vi\u1ec7c.'}
              </Text>
            </YStack>

            <YStack
              gap="$5"
              padding="$4"
              borderRadius={appTheme.radius.xl}
              backgroundColor={appTheme.colors.surfaceSoft}
              borderWidth={1}
              borderColor={appTheme.colors.border}
            >
              <XStack alignItems="center" gap="$2">
                <Mail size={17} color={appTheme.colors.primary} />
                <Text fontSize={13} fontWeight="900" color={appTheme.colors.primary}>
                  {'Th\u00f4ng tin t\u00e0i kho\u1ea3n'}
                </Text>
              </XStack>

              <FormField
                label="Email"
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  if (formErrors.email) setFormErrors((current) => ({ ...current, email: undefined }));
                }}
                placeholder={'Nh\u1eadp email'}
                keyboardType="email-address"
                autoCapitalize="none"
                error={formErrors.email}
              />

              <YStack position="relative">
                <FormField
                  label={'M\u1eadt kh\u1ea9u'}
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    if (formErrors.password) setFormErrors((current) => ({ ...current, password: undefined }));
                  }}
                  placeholder={'Nh\u1eadp m\u1eadt kh\u1ea9u'}
                  secureTextEntry={!showPassword}
                  error={formErrors.password}
                />
                <Pressable
                  onPress={() => setShowPassword((current) => !current)}
                  hitSlop={10}
                  style={{
                    position: 'absolute',
                    right: 14,
                    top: 38,
                    width: 30,
                    height: 30,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {showPassword ? (
                    <EyeOff size={20} color={appTheme.colors.textMuted} />
                  ) : (
                    <Eye size={20} color={appTheme.colors.textMuted} />
                  )}
                </Pressable>
              </YStack>

              {error ? (
                <YStack
                  padding="$3"
                  borderRadius={appTheme.radius.sm}
                  backgroundColor="#FEF2F2"
                  borderWidth={1}
                  borderColor="#FECACA"
                >
                  <Text selectable fontSize={13} lineHeight={19} fontWeight="700" color={appTheme.colors.danger}>
                    {error}
                  </Text>
                </YStack>
              ) : null}

              <AppButton disabled={!canSubmit || isLoading} opacity={!canSubmit ? 0.6 : 1} onPress={handleSubmit}>
                {isLoading ? '\u0110ang \u0111\u0103ng nh\u1eadp...' : '\u0110\u0103ng nh\u1eadp'}
              </AppButton>
            </YStack>
          </YStack>

          <YStack gap="$2" alignItems="center">
            <Text fontSize={12} color={appTheme.colors.textMuted}>
              G62 Delivery Platform
            </Text>
            <Text fontSize={12} color={appTheme.colors.textMuted}>
              {'Phi\u00ean b\u1ea3n mobile n\u1ed9i b\u1ed9'}
            </Text>
          </YStack>
        </YStack>
      </ScrollView>
    </>
  );
}
