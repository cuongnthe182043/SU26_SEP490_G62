import { CloudUpload, RefreshCw } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, XStack } from 'tamagui';

import { useOfflineQueue } from '@/hooks/use-offline-queue';
import { useNetwork } from '@/providers/network-provider';
import { appTheme } from '@/theme/app-theme';

/**
 * Dải hiển thị số thao tác đang chờ gửi, kèm việc TỰ GỬI khi có mạng.
 *
 * Đặt một lần ở tầng gốc: vừa là nơi chạy nền của hàng đợi (autoFlush = true), vừa cho
 * tài xế thấy rõ "việc của mình chưa lên server" thay vì tưởng đã xong.
 * Nằm dưới OfflineBanner nên lúc mất mạng cả hai cùng hiện, không đè nhau.
 */
export function QueueBanner() {
    const { online } = useNetwork();
    const { pendingCount, failedCount, isFlushing, flush } = useOfflineQueue({ autoFlush: true });
    const insets = useSafeAreaInsets();

    if (pendingCount === 0 && failedCount === 0) return null;

    // Mất mạng thì OfflineBanner đã chiếm chỗ trên cùng — đẩy dải này xuống dưới nó
    const top = online ? insets.top + 6 : insets.top + 36;

    const text = isFlushing
        ? `Đang gửi ${pendingCount} thao tác...`
        : failedCount > 0 && pendingCount === 0
            ? `${failedCount} thao tác gửi lỗi — chạm để thử lại`
            : `${pendingCount} thao tác chờ gửi${failedCount > 0 ? ` · ${failedCount} lỗi` : ''}`;

    return (
        <Pressable
            onPress={() => { if (online && !isFlushing) void flush(); }}
            style={{
                position: 'absolute',
                top,
                left: 0,
                right: 0,
                zIndex: 9998,
            }}
        >
            <XStack
                paddingVertical={7}
                paddingHorizontal={16}
                gap={8}
                alignItems="center"
                justifyContent="center"
                backgroundColor={failedCount > 0 ? appTheme.colors.warning : appTheme.colors.primary}
            >
                {isFlushing
                    ? <RefreshCw size={13} color="#FFFFFF" />
                    : <CloudUpload size={13} color="#FFFFFF" />}
                <Text fontSize={12} fontWeight="700" color="#FFFFFF">
                    {text}
                </Text>
            </XStack>
        </Pressable>
    );
}

export default QueueBanner;
