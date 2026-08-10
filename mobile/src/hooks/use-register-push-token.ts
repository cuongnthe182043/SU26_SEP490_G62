import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { isRealtimeConnected } from '@/lib/realtime-status';
import { profileService } from '@/services/profile-service';
import { useAuthSession } from '@/providers/auth-provider';

// Không set handler này thì notification đến lúc app đang mở sẽ không hiện gì cả
// (mặc định expo-notifications im lặng khi app foreground).
//
// Mỗi thông báo được gửi theo CẢ HAI đường: WebSocket (app đang mở) và push (mọi lúc).
// Nếu app đang mở mà kênh realtime còn sống thì toast trong app đã hiện rồi — hiện
// thêm banner hệ thống nữa là một thông báo báo hai lần. Chỉ tắt banner đúng trường
// hợp đó; realtime chết (đang trong lúc nối lại, mất sóng...) thì vẫn phải hiện,
// nếu không tài xế mất thông báo mà không hay biết.
//
// shouldShowList luôn bật: thông báo vẫn nằm trong khay hệ thống để xem lại được.
Notifications.setNotificationHandler({
    handleNotification: async () => {
        const daHienToastTrongApp = AppState.currentState === 'active' && isRealtimeConnected();
        return {
            shouldShowBanner: !daHienToastTrongApp,
            shouldShowList:   true,
            shouldPlaySound:  !daHienToastTrongApp,
            shouldSetBadge:   false,
        };
    },
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
