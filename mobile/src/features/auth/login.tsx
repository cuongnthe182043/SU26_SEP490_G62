import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Eye, EyeOff } from "lucide-react-native";
import { Text, XStack, YStack } from "tamagui";

import { AppButton } from "@/components/app-button";
import { FormField } from "@/components/form-field";
import { KeyboardSafeScrollView } from "@/components/keyboard-safe-scroll-view";
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
      setPassword("");
      router.replace("/(tabs)");
    }
  };

  return (
    <>
      <StatusBar style="dark" />
      <KeyboardSafeScrollView
        style={{ backgroundColor: appTheme.colors.background }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: appTheme.spacing.screenX,
          paddingTop: appTheme.spacing.screenTop,
          paddingBottom: appTheme.spacing.screenBottom,
        }}
      >
        <YStack flex={1} justifyContent="space-between">

          {/* ── Top section ── */}
          <YStack gap="$8">

            {/* Logo mark */}
            <YStack gap="$1">
              <XStack alignItems="center" gap="$3">
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 16,
                    backgroundColor: appTheme.colors.primary,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {/* Simple truck/delivery mark bằng View */}
                  <View
                    style={{
                      width: 24,
                      height: 16,
                      borderRadius: 3,
                      backgroundColor: appTheme.colors.surface,
                      opacity: 0.95,
                    }}
                  />
                </View>
                <YStack>
                  <Text
                    fontSize={15}
                    fontFamily={appTheme.typography.fontFamily.bold}
                    color={appTheme.colors.text}
                    letterSpacing={0.3}
                  >
                    G62 Delivery
                  </Text>
                  <Text
                    fontSize={12}
                    fontFamily={appTheme.typography.fontFamily.regular}
                    color={appTheme.colors.textMuted}
                  >
                    Hệ thống giao vận nội bộ
                  </Text>
                </YStack>
              </XStack>
            </YStack>

            {/* Heading */}
            <YStack gap="$2">
              <Text
                fontSize={32}
                lineHeight={38}
                fontFamily={appTheme.typography.fontFamily.bold}
                color={appTheme.colors.text}
                letterSpacing={-0.5}
              >
                Xin chào,{"\n"}đăng nhập để tiếp tục
              </Text>
              <Text
                fontSize={14}
                lineHeight={22}
                fontFamily={appTheme.typography.fontFamily.regular}
                color={appTheme.colors.textMuted}
              >
                Nhập thông tin tài khoản được cấp bởi quản trị viên
              </Text>
            </YStack>

            {/* Form */}
            <YStack gap="$4">
              <FormField
                label="Email"
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  if (formErrors.email)
                    setFormErrors((c) => ({ ...c, email: undefined }));
                }}
                placeholder="Nhập email công việc"
                keyboardType="email-address"
                autoCapitalize="none"
                error={formErrors.email}
              />

              <YStack>
                <FormField
                  label="Mật khẩu"
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    if (formErrors.password)
                      setFormErrors((c) => ({ ...c, password: undefined }));
                  }}
                  placeholder="Nhập mật khẩu"
                  secureTextEntry={!showPassword}
                  error={formErrors.password}
                  rightElement={
                    <Pressable
                      onPress={() => setShowPassword((c) => !c)}
                      hitSlop={10}
                      style={{
                        position: "absolute",
                        right: 16,
                        top: 38,
                        width: 32,
                        height: 32,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {showPassword ? (
                        <EyeOff size={19} color={appTheme.colors.textMuted} />
                      ) : (
                        <Eye size={19} color={appTheme.colors.textMuted} />
                      )}
                    </Pressable>
                  }
                />
              </YStack>

              {/* Error banner */}
              {error ? (
                <XStack
                  paddingHorizontal="$3"
                  paddingVertical="$3"
                  borderRadius={appTheme.radius.sm}
                  backgroundColor={appTheme.colors.dangerSoft}
                  borderWidth={1}
                  borderColor={appTheme.colors.dangerBorder}
                  gap="$2"
                  alignItems="flex-start"
                >
                  <View
                    style={{
                      width: 4,
                      borderRadius: 2,
                      alignSelf: "stretch",
                      backgroundColor: appTheme.colors.danger,
                      marginRight: 4,
                    }}
                  />
                  <Text
                    flex={1}
                    fontSize={13}
                    lineHeight={19}
                    fontFamily={appTheme.typography.fontFamily.medium}
                    color={appTheme.colors.dangerText}
                  >
                    {error}
                  </Text>
                </XStack>
              ) : null}

              <AppButton
                tone="primary"
                disabled={!canSubmit}
                opacity={!canSubmit ? 0.45 : 1}
                isLoading={isLoading}
                onPress={handleSubmit}
                marginTop="$2"
              >
                Đăng nhập
              </AppButton>
            </YStack>
          </YStack>

          {/* ── Footer ── */}
          <YStack alignItems="center" gap="$1" paddingTop="$6">
            <View
              style={{
                width: 32,
                height: 1,
                backgroundColor: appTheme.colors.border,
                marginBottom: 12,
              }}
            />
            <Text
              fontSize={12}
              fontFamily={appTheme.typography.fontFamily.regular}
              color={appTheme.colors.textMuted}
            >
              Phiên bản nội bộ · Chỉ dành cho nhân viên
            </Text>
          </YStack>

        </YStack>
      </KeyboardSafeScrollView>
    </>
  );
}