import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';

import { AppButton } from '@/components/app-button';
import { AppText }   from '@/components/app-text';
import { appTheme }  from '@/theme/app-theme';

type Props = {
    visible: boolean;
    title: string;
    description?: string;
    placeholder: string;
    required?: boolean;
    confirmLabel: string;
    confirmDanger?: boolean;
    onConfirm: (reason: string) => void;
    onClose: () => void;
};

export function ReasonModal({
    visible,
    title,
    description,
    placeholder,
    required,
    confirmLabel,
    confirmDanger,
    onConfirm,
    onClose,
}: Props) {
    const [text, setText] = useState('');
    const canConfirm = !required || text.trim().length > 0;

    const handleClose = () => {
        setText('');
        onClose();
    };

    const handleConfirm = () => {
        if (!canConfirm) return;
        const value = text.trim();
        setText('');
        onConfirm(value);
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
            <KeyboardAvoidingView
                style={s.overlay}
                behavior={Platform.OS === 'ios' ? 'position' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView
                    contentContainerStyle={s.scrollContainer}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={s.card}>
                        <YStack gap={12}>
                            <Text fontSize={16} fontWeight="900" color={appTheme.colors.text}>{title}</Text>
                            {description ? (
                                <Text fontSize={13} color={appTheme.colors.textMuted} lineHeight={18}>{description}</Text>
                            ) : null}
                            <TextInput
                                style={[s.input, {
                                    borderColor: required && !canConfirm
                                        ? appTheme.colors.danger
                                        : appTheme.colors.border,
                                }]}
                                value={text}
                                onChangeText={setText}
                                placeholder={placeholder}
                                placeholderTextColor={appTheme.colors.textMuted}
                                multiline
                                numberOfLines={3}
                                textAlignVertical="top"
                            />
                            {required && !canConfirm ? (
                                <AppText variant="caption" tone="danger">Vui lòng nhập lý do</AppText>
                            ) : null}
                            <XStack gap={10}>
                                <Pressable style={[s.btn, s.cancelBtn]} onPress={handleClose}>
                                    <Text fontSize={14} fontWeight="700" color={appTheme.colors.textMuted}>Hủy</Text>
                                </Pressable>
                                <AppButton
                                    flex={1}
                                    tone="primary"
                                    disabled={!canConfirm}
                                    onPress={handleConfirm}
                                    height={50}
                                    backgroundColor={confirmDanger ? appTheme.colors.danger : appTheme.colors.primary}
                                    borderColor={confirmDanger ? appTheme.colors.danger : appTheme.colors.primary}
                                >
                                    {confirmLabel}
                                </AppButton>
                            </XStack>
                        </YStack>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const s = StyleSheet.create({
    overlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end', alignItems: 'center',
        padding: 24,
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'flex-end',
        paddingTop: 20,
    },
    card: {
        width: '100%', maxHeight: '80%', backgroundColor: '#fff',
        borderRadius: 18, padding: 22,
        shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, elevation: 12,
    },
    input: {
        borderWidth: 1.5, borderRadius: 10,
        padding: 12, fontSize: 13,
        minHeight: 80, color: '#111',
        fontFamily: 'System',
    },
    btn: {
        flex: 1, paddingVertical: 13, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center',
    },
    cancelBtn: { backgroundColor: '#f3f4f6' },
});
