import { WifiOff } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, XStack } from 'tamagui';

import { useNetwork } from '@/providers/network-provider';
import { appTheme } from '@/theme/app-theme';

/**
 * Dải cảnh báo mất mạng, ghim trên cùng màn hình.
 *
 * Đặt ở tầng gốc nên mọi màn hình đều có, tài xế không phải bấm thử mới biết mình
 * đang offline. Chỉ hiện khi thật sự mất mạng nên bình thường không chiếm chỗ.
 */
export function OfflineBanner() {
    const { online } = useNetwork();
    const insets = useSafeAreaInsets();

    if (online) return null;

    return (
        <XStack
            position="absolute"
            top={0}
            left={0}
            right={0}
            zIndex={9999}
            paddingTop={insets.top + 6}
            paddingBottom={8}
            paddingHorizontal={16}
            gap={8}
            alignItems="center"
            justifyContent="center"
            backgroundColor={appTheme.colors.dangerText}
        >
            <WifiOff size={14} color="#FFFFFF" />
            <Text fontSize={12} fontWeight="700" color="#FFFFFF">
                Mất kết nối mạng — thao tác sẽ không gửi được
            </Text>
        </XStack>
    );
}

export default OfflineBanner;
