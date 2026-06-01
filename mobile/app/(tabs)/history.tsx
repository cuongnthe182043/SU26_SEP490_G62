import { ScrollView, View } from 'react-native';
import { ClipboardList } from 'lucide-react-native';
import { YStack } from 'tamagui';

import { ScreenHeader } from '@/components/screen-header';
import { AppText } from '@/components/app-text';
import { appTheme } from '@/theme/app-theme';

export default function HistoryTab() {
    return (
        <View style={{ flex: 1, backgroundColor: appTheme.colors.background }}>
            <ScreenHeader title="Lịch sử chuyến" />
            <ScrollView
                contentContainerStyle={{
                    flexGrow: 1,
                    paddingHorizontal: appTheme.spacing.screenX,
                    paddingTop: 24,
                    paddingBottom: appTheme.spacing.screenBottom,
                }}
            >
                <YStack flex={1} alignItems="center" justifyContent="center" paddingVertical={80} gap={12}>
                    <YStack
                        width={64}
                        height={64}
                        borderRadius={24}
                        backgroundColor={appTheme.colors.surfaceSoft}
                        alignItems="center"
                        justifyContent="center"
                    >
                        <ClipboardList size={28} color={appTheme.colors.textMuted} />
                    </YStack>
                    <AppText variant="bodyStrong" tone="muted">Chưa có lịch sử</AppText>
                    <AppText variant="caption" tone="muted">Các chuyến đã hoàn thành sẽ hiện ở đây</AppText>
                </YStack>
            </ScrollView>
        </View>
    );
}
