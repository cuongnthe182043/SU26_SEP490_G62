import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { TamaguiProvider } from 'tamagui';

import tamaguiConfig from '../tamagui.config';
import { AuthProvider } from '@/providers/auth-provider';
import { NetworkProvider } from '@/providers/network-provider';
import { NotificationsProvider } from '@/providers/notifications-provider';
import { UIProvider } from '@/providers/ui-provider';
import { OfflineBanner } from '@/components/offline-banner';
import { QueueBanner } from '@/components/queue-banner';
import { useRegisterPushToken } from '@/hooks/use-register-push-token';

// Đăng ký push token (FCM/APNs) sau khi đăng nhập — tách component riêng vì hook
// cần đọc useAuthSession(), phải render bên trong <AuthProvider>.
function PushTokenRegistrar() {
  useRegisterPushToken();
  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    GoogleSansRegular: require('../assets/fonts/Google_Sans/static/GoogleSans-Regular.ttf'),
    GoogleSansMedium: require('../assets/fonts/Google_Sans/static/GoogleSans-Medium.ttf'),
    GoogleSansSemiBold: require('../assets/fonts/Google_Sans/static/GoogleSans-SemiBold.ttf'),
    GoogleSansBold: require('../assets/fonts/Google_Sans/static/GoogleSans-Bold.ttf'),
  });

  if (!fontsLoaded) return null;

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      {/* NetworkProvider bọc ngoài cùng để mọi màn hình và cả api-client đều biết
          trạng thái mạng; OfflineBanner ghim đè lên trên toàn bộ Stack. */}
      <NetworkProvider>
        <UIProvider>
          <AuthProvider>
            <PushTokenRegistrar />
            <NotificationsProvider>
              <Stack screenOptions={{ headerShown: false }} />
              <OfflineBanner />
              <QueueBanner />
            </NotificationsProvider>
          </AuthProvider>
        </UIProvider>
      </NetworkProvider>
    </TamaguiProvider>
  );
}
