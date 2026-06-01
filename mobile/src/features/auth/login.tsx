import { useMemo, useState } from "react";
import { Pressable } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react-native";
import { ScrollView, Text, XStack, YStack } from "tamagui";

import { AppButton } from "@/components/app-button";
import { FormField } from "@/components/form-field";
import { appTheme } from "@/theme/app-theme";

import {
  hasLoginErrors,
  type LoginFormErrors,
  validateLoginForm,
} from "./login-validation";
import { useLogin } from "./use-login";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState<LoginFormErrors>({});
  const { error, isLoading, login } = useLogin();
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(
    () => email.trim().length > 0 && password.length > 0,
    [email, password],
  );

const handleSubmit = async () => {
  const nextErrors = validateLoginForm(email, password);
  setFormErrors(nextErrors);

  if (hasLoginErrors(nextErrors) || isLoading) return;

  const result = await login(email, password);
  if (result) {
    setPassword('');
    router.replace('/(tabs)');
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
                <Text
                  fontSize={12}
                  fontWeight="900"
                  color={appTheme.colors.primary}
                >
                  Bảo mật
                </Text>
              </XStack>
            </XStack>

            <YStack gap="$3">
              <Text
                fontSize={38}
                lineHeight={44}
                fontWeight="900"
                color={appTheme.colors.text}
              >
                Đăng nhập
              </Text>
              <Text
                fontSize={16}
                lineHeight={24}
                color={appTheme.colors.textMuted}
              >
                Truy cập hệ thống giao vận để theo dõi đơn hàng và xử lý công
                việc
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
                <Text
                  fontSize={13}
                  fontWeight="900"
                  color={appTheme.colors.primary}
                >
                  Thông tin tài khoản
                </Text>
              </XStack>

              <FormField
                label="Email"
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  if (formErrors.email)
                    setFormErrors((current) => ({
                      ...current,
                      email: undefined,
                    }));
                }}
                placeholder={"Nhập email"}
                keyboardType="email-address"
                autoCapitalize="none"
                error={formErrors.email}
              />

              <YStack position="relative">
                <FormField
                  label={"Mật khẩu"}
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    if (formErrors.password)
                      setFormErrors((current) => ({
                        ...current,
                        password: undefined,
                      }));
                  }}
                  placeholder={"Nhập mật khẩu"}
                  secureTextEntry={!showPassword}
                  error={formErrors.password}
                />
                <Pressable
                  onPress={() => setShowPassword((current) => !current)}
                  hitSlop={10}
                  style={{
                    position: "absolute",
                    right: 14,
                    top: 38,
                    width: 30,
                    height: 30,
                    alignItems: "center",
                    justifyContent: "center",
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
                  backgroundColor={appTheme.colors.dangerSoft}
                  borderWidth={1}
                  borderColor={appTheme.colors.dangerBorder}
                >
                  <Text
                    selectable
                    fontSize={13}
                    lineHeight={19}
                    fontWeight="700"
                    color={appTheme.colors.danger}
                  >
                    {error}
                  </Text>
                </YStack>
              ) : null}

              <AppButton
                tone="primary"
                disabled={!canSubmit}
                opacity={!canSubmit ? 0.6 : 1}
                isLoading={isLoading}
                onPress={handleSubmit}
              >
                Đăng nhập
              </AppButton>
            </YStack>
          </YStack>

          <YStack gap="$2" alignItems="center">
            <Text fontSize={12} color={appTheme.colors.textMuted}>
              G62 Delivery Platform
            </Text>
            <Text fontSize={12} color={appTheme.colors.textMuted}>
              {"Phiên bản mobile nội bộ"}
            </Text>
          </YStack>
        </YStack>
      </ScrollView>
    </>
  );
}
