import { useCallback, useEffect, useRef } from 'react';
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

/**
 * Kết cục của một lần thử đăng ký. Có kiểu riêng vì nó là thứ DUY NHẤT phân biệt được
 * các nguyên nhân hỏng — mà mọi nguyên nhân đều dẫn tới cùng một triệu chứng ngoài đời
 * ("tài xế không nhận được thông báo") và cùng một dòng log ở backend.
 */
export type PushRegistrationOutcome =
    | 'ok'
    | 'simulator'           // emulator/simulator không có push token thật — không sửa được
    | 'permission-denied'   // chưa cấp quyền thông báo (Android 13+ cần POST_NOTIFICATIONS)
    | 'token-unavailable'   // getExpoPushTokenAsync ném lỗi: chạy Expo Go, thiếu credential FCM trong EAS...
    | 'upload-failed';      // lấy được token nhưng POST lên backend hỏng

let lastOutcome: PushRegistrationOutcome | null = null;
/** Cho màn hình hồ sơ/debug đọc ra để hiển thị, thay vì bắt người ta đoán. */
export const getPushRegistrationOutcome = () => lastOutcome;

// 'simulator' là kết cục VĨNH VIỄN — thử lại bao nhiêu lần cũng vậy, chỉ tốn pin.
// Mọi kết cục khác đều có thể tự khỏi: người dùng vào Cài đặt bật quyền, mạng có lại,
// backend hết lỗi. Nên phải thử lại, và mốc thử lại tự nhiên nhất là lúc mở lại app.
const isRetryable = (outcome: PushRegistrationOutcome | null) =>
    outcome !== 'ok' && outcome !== 'simulator';

const ghiNhan = (outcome: PushRegistrationOutcome, chiTiet?: unknown) => {
    lastOutcome = outcome;
    if (outcome === 'ok') {
        console.log('[push-reg] đăng ký thiết bị thành công');
        return;
    }
    // console.warn chứ không phải nuốt: đây là dòng duy nhất cho biết vì sao cả hệ
    // thống push im lặng. Nó hiện trong `npx expo start` và trong logcat của máy thật.
    console.warn(`[push-reg] KHÔNG đăng ký được push — lý do: ${outcome}`, chiTiet ?? '');
};

// Đăng ký Expo push token lên backend sau khi đăng nhập, để nhận thông báo cả khi
// app đang đóng/khoá máy (khác với kênh WebSocket chỉ hoạt động lúc app đang mở).
// Dùng getExpoPushTokenAsync (KHÔNG phải getDevicePushTokenAsync): Expo Push Service
// tự route sang FCM (Android) và APNs (iOS) bằng credential trong EAS → chạy được cả
// hai nền tảng.
//
// KHÔNG nuốt lỗi nữa. Bản trước bọc toàn bộ thân hàm trong `catch {}` rỗng và có BA cửa
// `return` trống, nên khi `device_tokens` rỗng sạch trên production thì không có cách
// nào biết nó chết ở cửa nào — quyền, token, hay lời gọi API. Hỏng vẫn không được phép
// làm sập app (đây là tính năng phụ), nhưng hỏng phải NÓI RA.
export function useRegisterPushToken() {
    const { status } = useAuthSession();
    const dangChayRef = useRef(false);

    const thuDangKy = useCallback(async () => {
        // Chốt cửa đồng bộ: AppState và effect có thể gọi gần như cùng lúc.
        if (dangChayRef.current || !isRetryable(lastOutcome)) return;
        dangChayRef.current = true;

        try {
            if (!Device.isDevice) {
                ghiNhan('simulator');
                return;
            }

            const { status: existing } = await Notifications.getPermissionsAsync();
            let finalStatus = existing;
            if (existing !== 'granted') {
                const { status: requested } = await Notifications.requestPermissionsAsync();
                finalStatus = requested;
            }
            if (finalStatus !== 'granted') {
                ghiNhan('permission-denied', { finalStatus });
                return;
            }

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

            let token: string | undefined;
            try {
                const res = await Notifications.getExpoPushTokenAsync(
                    projectId ? { projectId } : undefined,
                );
                token = res?.data;
            } catch (err) {
                // Hay gặp nhất: đang chạy trong Expo Go (SDK 53+ bỏ hỗ trợ push từ xa
                // trên Android), hoặc project EAS chưa nạp credential FCM/APNs.
                ghiNhan('token-unavailable', { message: (err as Error)?.message, projectId });
                return;
            }
            if (!token) {
                ghiNhan('token-unavailable', { message: 'Expo trả về token rỗng', projectId });
                return;
            }

            try {
                await profileService.registerDeviceToken(
                    token, Platform.OS === 'ios' ? 'ios' : 'android',
                );
            } catch (err) {
                ghiNhan('upload-failed', { message: (err as Error)?.message });
                return;
            }

            ghiNhan('ok');
        } catch (err) {
            // Lưới cuối: không nhánh nào ở trên được phép ném ra ngoài làm sập app.
            ghiNhan('token-unavailable', { message: (err as Error)?.message });
        } finally {
            dangChayRef.current = false;
        }
    }, []);

    useEffect(() => {
        if (status !== 'authenticated') return;
        void thuDangKy();
    }, [status, thuDangKy]);

    // Thử lại khi quay về app. Bản trước đặt cờ "đã đăng ký" TRƯỚC khi chạy async và
    // không bao giờ gỡ, nên một lần hỏng là máy đó câm cho tới khi khởi động lại app —
    // kể cả khi người dùng vừa vào Cài đặt bật quyền thông báo xong quay ra.
    useEffect(() => {
        if (status !== 'authenticated') return;
        const sub = AppState.addEventListener('change', (next) => {
            if (next === 'active') void thuDangKy();
        });
        return () => sub.remove();
    }, [status, thuDangKy]);
}
