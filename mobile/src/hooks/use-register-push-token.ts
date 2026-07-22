import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { profileService } from '@/services/profile-service';
import { useAuthSession } from '@/providers/auth-provider';

// Không set handler này thì notification đến lúc app đang mở sẽ không hiện gì cả
// (mặc định expo-notifications im lặng khi app foreground).
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList:   true,
        shouldPlaySound:  true,
        shouldSetBadge:   false,
    }),
});

// Đăng ký Expo push token lên backend sau khi đăng nhập, để nhận thông báo cả khi
// app đang đóng/khoá máy (khác với kênh WebSocket chỉ hoạt động lúc app đang mở).
// Dùng getExpoPushTokenAsync (KHÔNG phải getDevicePushTokenAsync): Expo Push Service
// tự route sang FCM (Android) và APNs (iOS) bằng credential trong EAS → chạy được cả
// hai nền tảng. Im lặng bỏ qua mọi lỗi — đây là tính năng phụ, không được phép làm
// crash hay chặn luồng chính của app.
export function useRegisterPushToken() {
    const { status } = useAuthSession();
    const registeredRef = useRef(false);

    useEffect(() => {
        if (status !== 'authenticated' || registeredRef.current) return;
        registeredRef.current = true;

        (async () => {
            try {
                if (!Device.isDevice) return; // simulator/emulator không có push token thật

                const { status: existing } = await Notifications.getPermissionsAsync();
                let finalStatus = existing;
                if (existing !== 'granted') {
                    const { status: requested } = await Notifications.requestPermissionsAsync();
                    finalStatus = requested;
                }
                if (finalStatus !== 'granted') return;

                if (Platform.OS === 'android') {
                    await Notifications.setNotificationChannelAsync('default', {
                        name: 'Mặc định',
                        importance: Notifications.AndroidImportance.HIGH,
                    });
                }

                // projectId (EAS) bắt buộc để lấy đúng Expo push token trong bản build.
                const projectId =
                    Constants?.expoConfig?.extra?.eas?.projectId ??
                    (Constants as { easConfig?: { projectId?: string } })?.easConfig?.projectId;

                const { data: token } = await Notifications.getExpoPushTokenAsync(
                    projectId ? { projectId } : undefined,
                );
                if (!token) return;

                await profileService.registerDeviceToken(token, Platform.OS === 'ios' ? 'ios' : 'android');
            } catch {
                // Chưa cấu hình Firebase/APNs, hoặc thiết bị/emulator không hỗ trợ push — bỏ qua.
            }
        })();
    }, [status]);
}
