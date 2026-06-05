import { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Eye, EyeOff, HelpCircle } from "lucide-react-native";
import { Text, XStack, YStack } from "tamagui";

import { AppButton } from "@/components/app-button";
import { FormField } from "@/components/form-field";
import { KeyboardSafeScrollView } from "@/components/keyboard-safe-scroll-view";
import { useAuthSession } from "@/providers/auth-provider";
import { appTheme } from "@/theme/app-theme";
import { useRememberMe } from "@/hooks/use-remember-me";
import { useGoogleLogin, isGoogleAvailable } from "@/hooks/use-google-login";

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
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [showForgot, setShowForgot] = useState(false);

  const { error, isLoading, login } = useLogin();
  const { refreshSession } = useAuthSession();
  const { savedEmail, remember, setRemember, persist } = useRememberMe();

  // Pre-fill email từ Remember Me
  useEffect(() => {
    if (savedEmail) setEmail(savedEmail);
  }, [savedEmail]);

  const onLoginSuccess = async () => {
    try {
      await refreshSession();
    } catch (nextError) {
      setSessionError(nextError instanceof Error ? nextError.message : "Không thể tải phiên đăng nhập.");
      return false;
    }
    router.replace("/(tabs)");
    return true;
  };

  const { isLoading: googleLoading, error: googleError, signInWithGoogle } = useGoogleLogin(async (result) => {
    await persist(result.user.email, remember);
    await onLoginSuccess();
  });

  const canSubmit = useMemo(
    () => email.trim().length > 0 && password.length > 0,
    [email, password],
  );

  const handleSubmit = async () => {
    const nextErrors = validateLoginForm(email, password);
    setFormErrors(nextErrors);
    if (hasLoginErrors(nextErrors) || isLoading) return;
    setSessionError(null);
    const result = await login(email, password);
    if (result) {
      await persist(email, remember);
      setPassword("");
      await onLoginSuccess();
    }
  };

  return (
    <>
      <StatusBar style="dark" />
      <KeyboardSafeScrollView
        style={{ backgroundColor: appTheme.colors.background }}
        contentContainerStyle={{
          paddingHorizontal: appTheme.spacing.screenX,
          paddingTop: appTheme.spacing.screenTop,
          paddingBottom: appTheme.spacing.screenBottom,
        }}
        extraPadding={100}
      >
        <YStack gap="$0">

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

              {/* Remember Me + Forgot Password */}
              <XStack justifyContent="space-between" alignItems="center" marginTop="$1">
                <Pressable
                  onPress={() => setRemember(v => !v)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                  hitSlop={8}
                >
                  <View style={[
                    styles.checkbox,
                    remember && { backgroundColor: appTheme.colors.primary, borderColor: appTheme.colors.primary },
                  ]}>
                    {remember ? (
                      <Text fontSize={11} fontWeight="900" color="#fff">✓</Text>
                    ) : null}
                  </View>
                  <Text
                    fontSize={13}
                    fontFamily={appTheme.typography.fontFamily.regular}
                    color={appTheme.colors.textMuted}
                  >
                    Ghi nhớ đăng nhập
                  </Text>
                </Pressable>

                <Pressable onPress={() => setShowForgot(true)} hitSlop={8}>
                  <Text
                    fontSize={13}
                    fontFamily={appTheme.typography.fontFamily.medium}
                    color={appTheme.colors.primary}
                  >
                    Quên mật khẩu?
                  </Text>
                </Pressable>
              </XStack>

              {/* Error banner */}
              {(error ?? googleError ?? sessionError) ? (
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
                  <View style={{ width: 4, borderRadius: 2, alignSelf: "stretch", backgroundColor: appTheme.colors.danger, marginRight: 4 }} />
                  <Text flex={1} fontSize={13} lineHeight={19}
                    fontFamily={appTheme.typography.fontFamily.medium}
                    color={appTheme.colors.dangerText}>
                    {error ?? googleError ?? sessionError}
                  </Text>
                </XStack>
              ) : null}

              {/* Login button */}
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

              {/* Google Sign-In — chỉ hiện khi có native OAuth client ID */}
              {isGoogleAvailable ? (
                <>
                  <XStack alignItems="center" gap="$3" marginVertical="$1">
                    <View style={{ flex: 1, height: 1, backgroundColor: appTheme.colors.border }} />
                    <Text fontSize={12} color={appTheme.colors.textMuted}
                      fontFamily={appTheme.typography.fontFamily.regular}>
                      hoặc
                    </Text>
                    <View style={{ flex: 1, height: 1, backgroundColor: appTheme.colors.border }} />
                  </XStack>

                  <Pressable
                    onPress={signInWithGoogle}
                    disabled={googleLoading}
                    style={({ pressed }) => [
                      styles.googleBtn,
                      pressed && { opacity: 0.8 },
                      googleLoading && { opacity: 0.6 },
                    ]}
                  >
                    <View style={styles.googleIcon}>
                      <Text fontSize={15} fontWeight="900">G</Text>
                    </View>
                    <Text fontSize={14}
                      fontFamily={appTheme.typography.fontFamily.medium}
                      color={appTheme.colors.text}
                    >
                      {googleLoading ? 'Đang kết nối Google...' : 'Đăng nhập với Google'}
                    </Text>
                  </Pressable>
                </>
              ) : null}
            </YStack>
          </YStack>

          {/* ── Footer ── */}
          <YStack alignItems="center" gap="$1" marginTop={40}>
            <View style={{ width: 32, height: 1, backgroundColor: appTheme.colors.border, marginBottom: 12 }} />
            <Text fontSize={12} fontFamily={appTheme.typography.fontFamily.regular} color={appTheme.colors.textMuted}>
              Phiên bản nội bộ · Chỉ dành cho nhân viên
            </Text>
          </YStack>

        </YStack>
      </KeyboardSafeScrollView>

      {/* Forgot Password modal */}
      <Modal visible={showForgot} transparent animationType="fade" onRequestClose={() => setShowForgot(false)}>
        <Pressable style={styles.forgotBackdrop} onPress={() => setShowForgot(false)} />
        <View style={styles.forgotCard}>
          <View style={styles.forgotIconWrap}>
            <HelpCircle size={28} color={appTheme.colors.primary} />
          </View>
          <Text fontSize={18} fontFamily={appTheme.typography.fontFamily.bold} color={appTheme.colors.text}
            style={{ textAlign: 'center', marginBottom: 8 }}>
            Quên mật khẩu?
          </Text>
          <Text fontSize={14} fontFamily={appTheme.typography.fontFamily.regular}
            color={appTheme.colors.textMuted} style={{ textAlign: 'center', lineHeight: 22, marginBottom: 20 }}>
            Đây là hệ thống nội bộ.{"\n"}
            Vui lòng liên hệ quản trị viên để được đặt lại mật khẩu.
          </Text>
          <Pressable
            onPress={() => setShowForgot(false)}
            style={({ pressed }) => [styles.forgotBtn, pressed && { opacity: 0.8 }]}
          >
            <Text fontSize={14} fontFamily={appTheme.typography.fontFamily.bold} color="#fff">
              Đã hiểu
            </Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  checkbox: {
    width: 20, height: 20, borderRadius: 6,
    borderWidth: 1.5, borderColor: appTheme.colors.border,
    backgroundColor: appTheme.colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  googleBtn: {
    height: 54, borderRadius: appTheme.radius.md,
    borderWidth: 1.5, borderColor: appTheme.colors.border,
    backgroundColor: appTheme.colors.surface,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  googleIcon: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#e0e0e0',
    alignItems: 'center', justifyContent: 'center',
  },
  forgotBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  forgotCard: {
    position: 'absolute', left: 24, right: 24,
    top: '35%',
    backgroundColor: appTheme.colors.surface,
    borderRadius: appTheme.radius.xl,
    padding: 28, alignItems: 'center',
  },
  forgotIconWrap: {
    width: 60, height: 60, borderRadius: 20,
    backgroundColor: appTheme.colors.primarySoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  forgotBtn: {
    width: '100%', height: 48, borderRadius: appTheme.radius.md,
    backgroundColor: appTheme.colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
});
