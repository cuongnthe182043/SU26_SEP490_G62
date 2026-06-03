import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, type ViewStyle } from 'react-native';

type Props = {
    children: ReactNode;
    contentContainerStyle?: ViewStyle;
    style?: ViewStyle;
    /** Extra bottom padding khi bàn phím hiện — mặc định 40 */
    extraPadding?: number;
};

/**
 * Wrapper thay thế ScrollView cho các màn hình có input.
 * Tự xử lý keyboard tránh che nội dung trên cả iOS và Android.
 */
export function KeyboardSafeScrollView({
    children,
    contentContainerStyle,
    style,
    extraPadding = 40,
}: Props) {
    return (
        <KeyboardAvoidingView
            style={[styles.flex, style]}
            behavior="padding"
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
            <ScrollView
                style={styles.flex}
                contentContainerStyle={[
                    { paddingBottom: extraPadding },
                    contentContainerStyle,
                ]}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
            >
                {children}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
});
