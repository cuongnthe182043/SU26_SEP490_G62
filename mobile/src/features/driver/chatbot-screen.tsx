import { useEffect, useRef, useState, useCallback } from 'react';
import {
    ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform,
    Pressable, ScrollView, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Send } from 'lucide-react-native';
import { Text } from 'tamagui';

import { GeminiSpark } from '@/components/gemini-spark';
import { ScreenHeader } from '@/components/screen-header';
import { appTheme } from '@/theme/app-theme';
import { ApiError } from '@/lib/api-error';
import { chatbotService, type ChatMessage } from '@/services/chatbot-service';

const GREETING: ChatMessage = {
    role: 'assistant',
    content:
        'Chào bạn 👋 Mình là trợ lý dữ liệu. Bạn có thể hỏi mình về KPI, lương, công nợ, chuyến của bạn, hoặc quy trình nghiệp vụ.',
};

const SUGGESTIONS = [
    'KPI tháng này của tôi thế nào?',
    'Tôi còn nợ công ty bao nhiêu?',
    'Lương gần nhất của tôi là bao nhiêu?',
];

export function ChatbotScreen() {
    const insets = useSafeAreaInsets();
    const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [keyboardShown, setKeyboardShown] = useState(false);
    const scrollRef = useRef<ScrollView>(null);

    useEffect(() => {
        const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
        return () => clearTimeout(t);
    }, [messages, loading]);

    // Theo dõi bàn phím: khi hiện thì bỏ padding đáy (home indicator) để tránh
    // khoảng trống lớn giữa ô nhập và bàn phím.
    useEffect(() => {
        const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
        const s = Keyboard.addListener(showEvt, () => setKeyboardShown(true));
        const h = Keyboard.addListener(hideEvt, () => setKeyboardShown(false));
        return () => { s.remove(); h.remove(); };
    }, []);

    const send = useCallback(async (text?: string) => {
        const q = String(text ?? input).trim();
        if (!q || loading) return;
        setInput('');

        const next = [...messages, { role: 'user', content: q } as ChatMessage];
        setMessages(next);
        setLoading(true);

        const history = next
            .filter((m) => m !== GREETING)
            .slice(-6)
            .slice(0, -1);

        try {
            const res = await chatbotService.ask(q, history);
            setMessages((prev) => [...prev, { role: 'assistant', content: res?.answer || 'Xin lỗi, mình chưa trả lời được.' }]);
        } catch (err) {
            const msg =
                err instanceof ApiError && err.status === 403
                    ? 'Tài khoản của bạn chưa được bật trợ lý này.'
                    : err instanceof ApiError && err.status === 503
                        ? 'Trợ lý chưa được cấu hình. Vui lòng báo quản trị viên.'
                        : 'Có lỗi khi xử lý. Bạn thử lại giúp mình nhé.';
            setMessages((prev) => [...prev, { role: 'assistant', content: msg }]);
        } finally {
            setLoading(false);
        }
    }, [input, loading, messages]);

    return (
        <View style={{ flex: 1, backgroundColor: appTheme.colors.surfaceSoft }}>
            <StatusBar style="dark" />
            <ScreenHeader title="Trợ lý AI" showBack />

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={0}
            >
                <ScrollView
                    ref={scrollRef}
                    style={{ flex: 1 }}
                    contentContainerStyle={{ padding: 16, gap: 12 }}
                    keyboardShouldPersistTaps="handled"
                >
                    {messages.map((m, i) => (
                        <View
                            key={i}
                            style={{
                                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                                maxWidth: '86%',
                            }}
                        >
                            {m.role === 'assistant' && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                                    <GeminiSpark size={13} />
                                    <Text fontSize={11} color={appTheme.colors.textMuted}>Trợ lý</Text>
                                </View>
                            )}
                            <View
                                style={{
                                    backgroundColor: m.role === 'user' ? appTheme.colors.primary : appTheme.colors.surface,
                                    borderWidth: m.role === 'user' ? 0 : 1,
                                    borderColor: appTheme.colors.border,
                                    borderRadius: 16,
                                    borderBottomRightRadius: m.role === 'user' ? 4 : 16,
                                    borderBottomLeftRadius: m.role === 'user' ? 16 : 4,
                                    paddingHorizontal: 14,
                                    paddingVertical: 10,
                                }}
                            >
                                <Text
                                    fontSize={14}
                                    lineHeight={20}
                                    color={m.role === 'user' ? '#fff' : appTheme.colors.text}
                                >
                                    {m.content}
                                </Text>
                            </View>
                        </View>
                    ))}

                    {messages.length === 1 && (
                        <View style={{ gap: 8, marginTop: 4 }}>
                            {SUGGESTIONS.map((sug) => (
                                <Pressable
                                    key={sug}
                                    onPress={() => send(sug)}
                                    style={{
                                        backgroundColor: appTheme.colors.primarySoft,
                                        borderWidth: 1,
                                        borderColor: appTheme.colors.primaryMuted,
                                        borderRadius: 12,
                                        paddingHorizontal: 14,
                                        paddingVertical: 11,
                                    }}
                                >
                                    <Text fontSize={13} color={appTheme.colors.primaryDark}>{sug}</Text>
                                </Pressable>
                            ))}
                        </View>
                    )}

                    {loading && (
                        <View
                            style={{
                                alignSelf: 'flex-start',
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 8,
                                backgroundColor: appTheme.colors.surface,
                                borderWidth: 1,
                                borderColor: appTheme.colors.border,
                                borderRadius: 16,
                                paddingHorizontal: 14,
                                paddingVertical: 11,
                            }}
                        >
                            <ActivityIndicator size="small" color={appTheme.colors.primary} />
                            <Text fontSize={13} color={appTheme.colors.textMuted}>Đang phân tích...</Text>
                        </View>
                    )}
                </ScrollView>

                {/* Ô nhập */}
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'flex-end',
                        gap: 8,
                        paddingHorizontal: 12,
                        paddingTop: 10,
                        paddingBottom: keyboardShown ? 10 : Math.max(insets.bottom, 10),
                        borderTopWidth: 1,
                        borderTopColor: appTheme.colors.border,
                        backgroundColor: appTheme.colors.surface,
                    }}
                >
                    <TextInput
                        value={input}
                        onChangeText={setInput}
                        placeholder="Nhập câu hỏi..."
                        placeholderTextColor={appTheme.colors.textMuted}
                        multiline
                        editable={!loading}
                        style={{
                            flex: 1,
                            maxHeight: 110,
                            minHeight: 42,
                            backgroundColor: appTheme.colors.surfaceSoft,
                            borderWidth: 1,
                            borderColor: appTheme.colors.border,
                            borderRadius: 14,
                            paddingHorizontal: 14,
                            paddingTop: 10,
                            paddingBottom: 10,
                            fontSize: 14,
                            color: appTheme.colors.text,
                        }}
                    />
                    <Pressable
                        onPress={() => send()}
                        disabled={loading || !input.trim()}
                        style={{
                            width: 42,
                            height: 42,
                            borderRadius: 14,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: loading || !input.trim() ? appTheme.colors.primaryMuted : appTheme.colors.primary,
                        }}
                    >
                        <Send size={19} color="#fff" />
                    </Pressable>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}
