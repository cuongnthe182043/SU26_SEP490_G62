import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';

import { authService } from '@/services/auth-service';
import type { LoginResponse } from '@/types/auth';

WebBrowser.maybeCompleteAuthSession();

// Native client IDs PHẢI là loại iOS/Android trong Google Console
// KHÔNG dùng chung với web client ID (sẽ bị lỗi 400: invalid_request)
const IOS_CLIENT_ID     = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID     ?? '';
const ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '';
const WEB_CLIENT_ID     = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID          ?? '';

// Chỉ available khi có đúng loại client ID cho platform đang chạy
export const isGoogleAvailable =
    Platform.OS === 'ios'     ? (!!IOS_CLIENT_ID     && IOS_CLIENT_ID     !== WEB_CLIENT_ID) :
    Platform.OS === 'android' ? (!!ANDROID_CLIENT_ID && ANDROID_CLIENT_ID !== WEB_CLIENT_ID) :
    !!WEB_CLIENT_ID;

type State = { isLoading: boolean; error: string | null };

export function useGoogleLogin(onSuccess?: (result: LoginResponse) => void) {
    const [state, setState] = useState<State>({ isLoading: false, error: null });

    const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
        webClientId:     WEB_CLIENT_ID     || undefined,
        iosClientId:     IOS_CLIENT_ID     || undefined,
        androidClientId: ANDROID_CLIENT_ID || undefined,
    });

    useEffect(() => {
        if (response?.type !== 'success') return;
        const idToken = response.params?.id_token;
        if (!idToken) {
            setState({ isLoading: false, error: 'Không lấy được thông tin Google' });
            return;
        }
        setState({ isLoading: true, error: null });
        authService.loginWithGoogle(idToken)
            .then((result) => {
                setState({ isLoading: false, error: null });
                onSuccess?.(result);
            })
            .catch((err) => {
                setState({
                    isLoading: false,
                    error: err instanceof Error ? err.message : 'Đăng nhập Google thất bại',
                });
            });
    }, [response]);

    const signInWithGoogle = () => {
        setState({ isLoading: true, error: null });
        promptAsync().catch(() =>
            setState({ isLoading: false, error: 'Không thể mở Google Sign-In' }),
        );
    };

    const clearError = () => setState(s => ({ ...s, error: null }));

    return {
        isLoading: state.isLoading || !request,
        error: state.error,
        signInWithGoogle,
        clearError,
    };
}
