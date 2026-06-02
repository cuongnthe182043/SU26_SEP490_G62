import { RefreshControl, ScrollView, View } from 'react-native';
import { Bell, CircleAlert, PackageCheck } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';

import { AppText } from '@/components/app-text';
import { ScreenHeader } from '@/components/screen-header';
import { appTheme } from '@/theme/app-theme';
import { useNotifications } from '@/hooks/use-notifications';
import type { AppNotification } from '@/types/notification';

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1)
    .toString()
    .padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;
}

function NotificationCard({ item }: { item: AppNotification }) {
  const isTrip = item.type === 'TRIP_ASSIGNED' || item.type === 'TRIP_QUEUED';

  return (
    <XStack
      gap={12}
      padding={14}
      borderRadius={appTheme.radius.lg}
      borderWidth={1}
      borderColor={item.is_read ? appTheme.colors.border : appTheme.colors.primaryMuted}
      backgroundColor={item.is_read ? appTheme.colors.surface : appTheme.colors.primarySoft}
    >
      <XStack
        width={42}
        height={42}
        borderRadius={15}
        alignItems="center"
        justifyContent="center"
        backgroundColor={item.is_read ? appTheme.colors.surfaceSoft : appTheme.colors.surface}
      >
        {isTrip ? (
          <PackageCheck size={21} color={appTheme.colors.primary} />
        ) : (
          <CircleAlert size={21} color={appTheme.colors.warning} />
        )}
      </XStack>

      <YStack flex={1} gap={4}>
        <XStack alignItems="center" justifyContent="space-between" gap={10}>
          <Text flex={1} fontSize={14} fontWeight="900" color={appTheme.colors.text}>
            {item.title}
          </Text>
          {!item.is_read ? (
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: appTheme.colors.primary,
              }}
            />
          ) : null}
        </XStack>

        <AppText variant="caption" tone="muted">
          {item.message}
        </AppText>

        <Text fontSize={11} color={appTheme.colors.textMuted}>
          {formatTime(item.created_at)}
        </Text>
      </YStack>
    </XStack>
  );
}

export default function NotificationsTab() {
  const { notifications, unreadCount, isLoading, error, refresh } = useNotifications();

  return (
    <View style={{ flex: 1, backgroundColor: appTheme.colors.background }}>
      <ScreenHeader title="Thông báo" />
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => refresh(true)}
            tintColor={appTheme.colors.primary}
          />
        }
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: appTheme.spacing.screenX,
          paddingTop: 18,
          paddingBottom: appTheme.spacing.screenBottom,
          gap: 12,
        }}
      >
        {unreadCount > 0 ? (
          <AppText variant="caption" tone="muted">
            {unreadCount} thông báo chưa đọc
          </AppText>
        ) : null}

        {error ? (
          <YStack
            padding={14}
            borderRadius={appTheme.radius.md}
            borderWidth={1}
            borderColor={appTheme.colors.dangerBorder}
            backgroundColor={appTheme.colors.dangerSoft}
          >
            <AppText variant="caption" tone="danger">
              {error}
            </AppText>
          </YStack>
        ) : null}

        {!isLoading && notifications.length === 0 ? (
          <YStack flex={1} alignItems="center" justifyContent="center" paddingVertical={80} gap={12}>
            <YStack
              width={64}
              height={64}
              borderRadius={24}
              backgroundColor={appTheme.colors.surfaceSoft}
              alignItems="center"
              justifyContent="center"
            >
              <Bell size={28} color={appTheme.colors.textMuted} />
            </YStack>
            <AppText variant="bodyStrong" tone="muted">Chưa có thông báo</AppText>
            <AppText variant="caption" tone="muted">Thông báo sẽ xuất hiện tại đây</AppText>
          </YStack>
        ) : null}

        {notifications.map((item) => (
          <NotificationCard key={String(item.id)} item={item} />
        ))}
      </ScrollView>
    </View>
  );
}
