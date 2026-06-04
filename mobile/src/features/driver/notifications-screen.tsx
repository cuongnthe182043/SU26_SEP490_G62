import { useCallback, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Truck,
  AlertTriangle,
  CircleDollarSign,
  FileText,
  Info,
  X,
  PackageCheck,
} from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';

import { AppText } from '@/components/app-text';
import { PaginationBar } from '@/components/pagination-bar';
import { ScreenHeader } from '@/components/screen-header';
import { appTheme } from '@/theme/app-theme';
import { useNotifications } from '@/hooks/use-notifications';
import type { AppNotification } from '@/types/notification';

// ─── helpers ────────────────────────────────────────────────────────────────

function formatRelativeTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} giờ trước`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD} ngày trước`;
  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1)
    .toString()
    .padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;
}

type TypeConfig = {
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  color: string;
  bg: string;
  label: string;
};

const TYPE_CONFIG: Record<string, TypeConfig> = {
  TRIP_ASSIGNED: {
    Icon: PackageCheck,
    color: appTheme.colors.primary,
    bg: appTheme.colors.primarySoft,
    label: 'Nhận chuyến',
  },
  TRIP_QUEUED: {
    Icon: Truck,
    color: appTheme.colors.primary,
    bg: appTheme.colors.primarySoft,
    label: 'Chuyến tiếp theo',
  },
  TRIP_STATUS_UPDATED: {
    Icon: Truck,
    color: appTheme.colors.statusTransit,
    bg: appTheme.colors.statusTransitSoft,
    label: 'Cập nhật chuyến',
  },
  ORDER_COMPLETED: {
    Icon: CheckCheck,
    color: appTheme.colors.success,
    bg: appTheme.colors.successSoft,
    label: 'Hoàn thành đơn',
  },
  INCIDENT_REPORTED: {
    Icon: AlertTriangle,
    color: appTheme.colors.warning,
    bg: appTheme.colors.warningSoft,
    label: 'Sự cố',
  },
  INCIDENT_FEEDBACK: {
    Icon: AlertTriangle,
    color: appTheme.colors.statusPicking,
    bg: appTheme.colors.statusPickingSoft,
    label: 'Phản hồi sự cố',
  },
  ADVANCE_APPROVED: {
    Icon: CircleDollarSign,
    color: appTheme.colors.success,
    bg: appTheme.colors.successSoft,
    label: 'Ứng lương duyệt',
  },
  ADVANCE_REJECTED: {
    Icon: CircleDollarSign,
    color: appTheme.colors.danger,
    bg: appTheme.colors.dangerSoft,
    label: 'Ứng lương từ chối',
  },
  PAYSLIP_PUBLISHED: {
    Icon: FileText,
    color: appTheme.colors.statusReturning,
    bg: appTheme.colors.statusReturningSoft,
    label: 'Bảng lương',
  },
  SYSTEM_ALERT: {
    Icon: Info,
    color: appTheme.colors.textMuted,
    bg: appTheme.colors.surfaceSoft,
    label: 'Hệ thống',
  },
};

function getTypeConfig(type: string): TypeConfig {
  return TYPE_CONFIG[type] ?? TYPE_CONFIG.SYSTEM_ALERT;
}

// ─── Notification Card ───────────────────────────────────────────────────────

function NotificationCard({
  item,
  onPress,
}: {
  item: AppNotification;
  onPress: (item: AppNotification) => void;
}) {
  const cfg = getTypeConfig(item.type);
  const { Icon } = cfg;

  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({ pressed }) => ({
        opacity: pressed ? 0.85 : 1,
        borderRadius: appTheme.radius.lg,
        overflow: 'hidden',
      })}
    >
      <XStack
        gap={12}
        padding={14}
        borderRadius={appTheme.radius.lg}
        borderWidth={1}
        borderColor={item.is_read ? appTheme.colors.border : cfg.color + '40'}
        backgroundColor={item.is_read ? appTheme.colors.surface : cfg.bg}
      >
        <XStack
          width={44}
          height={44}
          borderRadius={16}
          alignItems="center"
          justifyContent="center"
          backgroundColor={item.is_read ? appTheme.colors.surfaceSoft : cfg.bg}
          style={{ borderWidth: 1, borderColor: cfg.color + '30' }}
        >
          <Icon size={20} color={cfg.color} strokeWidth={2} />
        </XStack>

        <YStack flex={1} gap={3}>
          <XStack alignItems="center" justifyContent="space-between" gap={8}>
            <Text
              flex={1}
              fontSize={14}
              fontWeight="800"
              color={item.is_read ? appTheme.colors.textMuted : appTheme.colors.text}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <XStack alignItems="center" gap={6}>
              {!item.is_read && (
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: cfg.color,
                  }}
                />
              )}
            </XStack>
          </XStack>

          <AppText
            variant="caption"
            tone="muted"
            numberOfLines={2}
            style={{ lineHeight: 18 }}
          >
            {item.message}
          </AppText>

          <XStack alignItems="center" justifyContent="space-between" marginTop={2}>
            <Text fontSize={11} color={appTheme.colors.textMuted}>
              {formatRelativeTime(item.created_at)}
            </Text>
            <Text fontSize={11} color={cfg.color} fontWeight="600">
              {cfg.label}
            </Text>
          </XStack>
        </YStack>
      </XStack>
    </Pressable>
  );
}

// ─── Detail Modal ────────────────────────────────────────────────────────────

function NotificationDetailModal({
  item,
  onClose,
}: {
  item: AppNotification | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  if (!item) return null;

  const cfg = getTypeConfig(item.type);
  const { Icon } = cfg;

  const fullTime = (() => {
    const d = new Date(item.created_at);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1)
      .toString()
      .padStart(2, '0')}/${d.getFullYear()} lúc ${d.getHours().toString().padStart(2, '0')}:${d
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;
  })();

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          justifyContent: 'flex-end',
        }}
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: appTheme.colors.background,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: 24,
            paddingBottom: insets.bottom + 24,
            paddingTop: 20,
          }}
        >
          {/* drag handle */}
          <View
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: appTheme.colors.border,
              alignSelf: 'center',
              marginBottom: 20,
            }}
          />

          {/* Close button */}
          <Pressable
            onPress={onClose}
            style={{
              position: 'absolute',
              top: 20,
              right: 20,
              width: 32,
              height: 32,
              borderRadius: 12,
              backgroundColor: appTheme.colors.surfaceSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} color={appTheme.colors.textMuted} />
          </Pressable>

          {/* Type icon + badge */}
          <XStack alignItems="center" gap={12} marginBottom={20}>
            <XStack
              width={52}
              height={52}
              borderRadius={18}
              alignItems="center"
              justifyContent="center"
              backgroundColor={cfg.bg}
              style={{ borderWidth: 1, borderColor: cfg.color + '30' }}
            >
              <Icon size={24} color={cfg.color} strokeWidth={2} />
            </XStack>
            <YStack gap={3}>
              <XStack
                paddingHorizontal={10}
                paddingVertical={3}
                borderRadius={99}
                backgroundColor={cfg.bg}
                style={{ borderWidth: 1, borderColor: cfg.color + '40', alignSelf: 'flex-start' }}
              >
                <Text fontSize={11} fontWeight="700" color={cfg.color}>
                  {cfg.label}
                </Text>
              </XStack>
              <Text fontSize={11} color={appTheme.colors.textMuted}>
                {fullTime}
              </Text>
            </YStack>
          </XStack>

          {/* Title */}
          <Text
            fontSize={18}
            fontWeight="900"
            color={appTheme.colors.text}
            marginBottom={10}
          >
            {item.title}
          </Text>

          {/* Message */}
          {item.message ? (
            <Text
              fontSize={14}
              color={appTheme.colors.textMuted}
              lineHeight={22}
              marginBottom={24}
            >
              {item.message}
            </Text>
          ) : null}

          {/* Read status */}
          <XStack
            padding={12}
            borderRadius={14}
            backgroundColor={appTheme.colors.surfaceSoft}
            alignItems="center"
            gap={8}
          >
            <Check size={14} color={appTheme.colors.success} />
            <Text fontSize={12} color={appTheme.colors.textMuted}>
              Đã đọc
            </Text>
          </XStack>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Filter Tabs ─────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'unread';

function FilterTabs({
  active,
  unreadCount,
  onChange,
}: {
  active: FilterTab;
  unreadCount: number;
  onChange: (tab: FilterTab) => void;
}) {
  return (
    <XStack gap={8}>
      {(['all', 'unread'] as FilterTab[]).map((tab) => {
        const isActive = active === tab;
        const label = tab === 'all' ? 'Tất cả' : `Chưa đọc${unreadCount > 0 ? ` (${unreadCount})` : ''}`;
        return (
          <Pressable key={tab} onPress={() => onChange(tab)}>
            <XStack
              paddingHorizontal={14}
              paddingVertical={7}
              borderRadius={99}
              backgroundColor={isActive ? appTheme.colors.primary : appTheme.colors.surfaceSoft}
              style={isActive ? {} : { borderWidth: 1, borderColor: appTheme.colors.border }}
            >
              <Text
                fontSize={13}
                fontWeight={isActive ? '800' : '500'}
                color={isActive ? '#fff' : appTheme.colors.textMuted}
              >
                {label}
              </Text>
            </XStack>
          </Pressable>
        );
      })}
    </XStack>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export function NotificationsScreen() {
  const {
    notifications, unreadCount, total, page, totalPages,
    isLoading, error, refresh, markAsRead, markAllAsRead, goToPage,
  } = useNotifications();

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [selectedItem, setSelectedItem] = useState<AppNotification | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const handleCardPress = useCallback(
    async (item: AppNotification) => {
      if (!item.is_read) {
        await markAsRead(item.id);
      }
      setSelectedItem({ ...item, is_read: true });
    },
    [markAsRead],
  );

  const displayed =
    activeTab === 'unread'
      ? notifications.filter((n) => !n.is_read)
      : notifications;

  const headerRight =
    unreadCount > 0 ? (
      <Pressable
        onPress={markAllAsRead}
        style={({ pressed }) => ({
          opacity: pressed ? 0.7 : 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 99,
          backgroundColor: appTheme.colors.primarySoft,
        })}
      >
        <CheckCheck size={13} color={appTheme.colors.primary} />
        <Text fontSize={12} fontWeight="700" color={appTheme.colors.primary}>
          Đọc tất cả
        </Text>
      </Pressable>
    ) : null;

  const handlePageChange = useCallback((p: number) => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    void goToPage(p);
  }, [goToPage]);

  return (
    <View style={{ flex: 1, backgroundColor: appTheme.colors.background }}>
      <ScreenHeader title="Thông báo" right={headerRight} />

      <ScrollView
        ref={scrollRef}
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
          paddingTop: 16,
          paddingBottom: appTheme.spacing.screenBottom,
          gap: 10,
        }}
      >
        {/* Filter tabs */}
        <FilterTabs
          active={activeTab}
          unreadCount={unreadCount}
          onChange={setActiveTab}
        />

        {/* Error */}
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

        {/* Empty state */}
        {!isLoading && displayed.length === 0 ? (
          <YStack
            flex={1}
            alignItems="center"
            justifyContent="center"
            paddingVertical={80}
            gap={12}
          >
            <YStack
              width={64}
              height={64}
              borderRadius={24}
              backgroundColor={appTheme.colors.surfaceSoft}
              alignItems="center"
              justifyContent="center"
            >
              {activeTab === 'unread' ? (
                <BellOff size={28} color={appTheme.colors.textMuted} />
              ) : (
                <Bell size={28} color={appTheme.colors.textMuted} />
              )}
            </YStack>
            <AppText variant="bodyStrong" tone="muted">
              {activeTab === 'unread' ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo'}
            </AppText>
            <AppText variant="caption" tone="muted">
              {activeTab === 'unread'
                ? 'Tất cả thông báo đã được đọc'
                : 'Thông báo sẽ xuất hiện tại đây'}
            </AppText>
          </YStack>
        ) : null}

        {/* List */}
        {displayed.map((item) => (
          <NotificationCard key={String(item.id)} item={item} onPress={handleCardPress} />
        ))}

        {/* Total label when no pagination needed */}
        {total > 0 && totalPages <= 1 ? (
          <AppText variant="caption" tone="muted" style={{ textAlign: 'center', paddingVertical: 8 }}>
            {total} thông báo
          </AppText>
        ) : null}
      </ScrollView>

      <PaginationBar
        page={page}
        totalPages={totalPages}
        total={total}
        totalLabel="thông báo"
        onPrev={() => handlePageChange(page - 1)}
        onNext={() => handlePageChange(page + 1)}
        onPage={handlePageChange}
        disabled={isLoading}
      />

      {/* Detail Modal */}
      <NotificationDetailModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </View>
  );
}
