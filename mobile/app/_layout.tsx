import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { TamaguiProvider } from 'tamagui';

import tamaguiConfig from '../tamagui.config';
import { AuthProvider } from '@/providers/auth-provider';
import { UIProvider } from '@/providers/ui-provider';

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
      <UIProvider>
        <AuthProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </AuthProvider>
      </UIProvider>
    </TamaguiProvider>
  );
}
