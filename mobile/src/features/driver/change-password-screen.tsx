import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Eye, EyeOff, Lock } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';

import { AppText }     from '@/components/app-text';
import { ScreenHeader } from '@/components/screen-header';
import { appTheme }    from '@/theme/app-theme';
import { profileService } from '@/services/profile-service';

export function ChangePasswordScreen() {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword,     setNewPassword]     = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent,     setShowCurrent]     = useState(false);
    const [showNew,         setShowNew]         = useState(false);
    const [isLoading,       setIsLoading]       = useState(false);
    const [error,           setError]           = useState<string | null>(null);

    const handleSubmit = async () => {
        setError(null);
        if (!currentPassword || !newPassword || !confirmPassword) {
            setError('Vui lòng điền đầy đủ thông tin');
            return;
        }
        if (newPassword.length < 6) {
            setError('Mật khẩu mới phải có ít nhất 6 ký tự');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Mật khẩu mới và xác nhận không khớp');
            return;
        }
        if (newPassword === currentPassword) {
            setError('Mật khẩu mới phải khác mật khẩu hiện tại');
            return;
        }
        setIsLoading(true);
        try {
            await profileService.changePassword(currentPassword, newPassword);
            Alert.alert('Thành công', 'Mật khẩu đã được đổi thành công.', [
                { text: 'OK', onPress: () => router.back() },
            ]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Không thể đổi mật khẩu');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: appTheme.colors.background }}>
            <ScreenHeader title="Đổi mật khẩu" showBack />

            <YStack padding={appTheme.spacing.screenX} gap={16} marginTop={8}>

                {/* Current password */}
                <PasswordField
                    label="Mật khẩu hiện tại"
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    show={showCurrent}
                    onToggle={() => setShowCurrent(v => !v)}
                />

                {/* New password */}
                <PasswordField
                    label="Mật khẩu mới (tối thiểu 6 ký tự)"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    show={showNew}
                    onToggle={() => setShowNew(v => !v)}
                />

                {/* Confirm */}
                <PasswordField
                    label="Xác nhận mật khẩu mới"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    show={showNew}
                    onToggle={() => setShowNew(v => !v)}
                />

                {error ? (
                    <XStack backgroundColor={appTheme.colors.dangerSoft}
                        borderRadius={appTheme.radius.md} padding={12}>
                        <AppText variant="caption" tone="danger">{error}</AppText>
                    </XStack>
                ) : null}

                <Pressable
                    onPress={handleSubmit}
                    disabled={isLoading}
                    style={{
                        backgroundColor: isLoading ? appTheme.colors.primaryMuted : appTheme.colors.primary,
                        borderRadius: appTheme.radius.md,
                        paddingVertical: 14,
                        alignItems: 'center',
                        marginTop: 8,
                    }}
                >
                    <Text fontSize={15} fontWeight="900" color="#fff">
                        {isLoading ? 'Đang xử lý...' : 'Đổi mật khẩu'}
                    </Text>
                </Pressable>
            </YStack>
        </View>
    );
}

function PasswordField({
    label, value, onChangeText, show, onToggle,
}: {
    label: string;
    value: string;
    onChangeText: (v: string) => void;
    show: boolean;
    onToggle: () => void;
}) {
    return (
        <YStack gap={6}>
            <Text fontSize={12} fontWeight="700" color={appTheme.colors.textMuted}>{label}</Text>
            <XStack
                borderWidth={1.5} borderColor={appTheme.colors.border}
                borderRadius={appTheme.radius.md}
                backgroundColor={appTheme.colors.surface}
                paddingHorizontal={12} paddingVertical={2}
                alignItems="center" gap={10}
            >
                <Lock size={16} color={appTheme.colors.textMuted} />
                <TextInput
                    value={value}
                    onChangeText={onChangeText}
                    secureTextEntry={!show}
                    placeholder="••••••••"
                    placeholderTextColor={appTheme.colors.textMuted}
                    style={{
                        flex: 1, fontSize: 15, color: appTheme.colors.text,
                        paddingVertical: 12,
                    }}
                />
                <Pressable onPress={onToggle} hitSlop={8}>
                    {show
                        ? <EyeOff size={18} color={appTheme.colors.textMuted} />
                        : <Eye size={18} color={appTheme.colors.textMuted} />}
                </Pressable>
            </XStack>
        </YStack>
    );
}
