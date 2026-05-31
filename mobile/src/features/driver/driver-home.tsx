import { Bell, CalendarClock, CheckCircle2, ChevronRight, MapPin, Navigation, PackageCheck, Route, Truck } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, Text, XStack, YStack } from 'tamagui';

import { AppButton } from '@/components/app-button';
import { StatCard } from '@/components/stat-card';
import { appTheme } from '@/theme/app-theme';

const todayJobs = [
  {
    id: 'DH-2401',
    title: 'Giao hàng Quận 1',
    address: '12 Nguyễn Huệ, Bến Nghé',
    time: '09:30',
    status: 'Đang chờ nhận',
  },
  {
    id: 'DH-2402',
    title: 'Lấy hàng Quận 3',
    address: '45 Võ Văn Tần, Phường 6',
    time: '11:00',
    status: 'Sắp tới',
  },
];

export function DriverHomeScreen() {
  return (
    <>
      <StatusBar style="dark" />
      <ScrollView
        flex={1}
        backgroundColor={appTheme.colors.background}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: appTheme.spacing.screenX,
          paddingTop: appTheme.spacing.screenTop,
          paddingBottom: appTheme.spacing.screenBottom,
          gap: 22,
        }}
      >
        <XStack alignItems="center" justifyContent="space-between">
          <YStack gap="$1">
            <Text fontSize={14} color={appTheme.colors.textMuted}>
              Xin chào
            </Text>
            <Text fontSize={26} lineHeight={32} fontWeight="900" color={appTheme.colors.text}>
              Tài xế G62
            </Text>
          </YStack>

          <XStack
            width={46}
            height={46}
            borderRadius={18}
            alignItems="center"
            justifyContent="center"
            backgroundColor={appTheme.colors.primarySoft}
          >
            <Bell size={21} color={appTheme.colors.primary} />
          </XStack>
        </XStack>

        <YStack
          gap="$5"
          padding="$5"
          borderRadius={appTheme.radius.xl}
          backgroundColor={appTheme.colors.primary}
          overflow="hidden"
        >
          <XStack
            position="absolute"
            right={-36}
            top={-40}
            width={132}
            height={132}
            borderRadius={66}
            backgroundColor="rgba(255,255,255,0.16)"
          />
          <XStack alignItems="center" gap="$3">
            <XStack
              width={52}
              height={52}
              borderRadius={20}
              alignItems="center"
              justifyContent="center"
              backgroundColor="rgba(255,255,255,0.18)"
            >
              <Truck size={27} color={appTheme.colors.surface} />
            </XStack>
            <YStack flex={1} gap="$1">
              <Text fontSize={13} fontWeight="900" color="rgba(255,255,255,0.82)">
                Ca làm hôm nay
              </Text>
              <Text fontSize={24} lineHeight={30} fontWeight="900" color={appTheme.colors.surface}>
                2 chuyến cần xử lý
              </Text>
            </YStack>
          </XStack>

          <XStack gap="$3">
            <YStack flex={1} gap="$1">
              <Text fontSize={12} color="rgba(255,255,255,0.72)">
                Điểm tiếp theo
              </Text>
              <Text fontSize={15} fontWeight="800" color={appTheme.colors.surface}>
                Quận 1, TP.HCM
              </Text>
            </YStack>
            <YStack flex={1} gap="$1">
              <Text fontSize={12} color="rgba(255,255,255,0.72)">
                Dự kiến
              </Text>
              <Text fontSize={15} fontWeight="800" color={appTheme.colors.surface}>
                09:30
              </Text>
            </YStack>
          </XStack>

          <AppButton tone="secondary" iconAfter={Navigation}>
            Bắt đầu điều hướng
          </AppButton>
        </YStack>

        <XStack gap="$3" flexWrap="wrap">
          <StatCard value="2" label="Đơn hôm nay" />
          <StatCard value="0" label="Đơn trễ" />
          <StatCard value="96%" label="Hoàn thành" />
        </XStack>

        <YStack gap="$3">
          <XStack alignItems="center" justifyContent="space-between">
            <Text fontSize={18} fontWeight="900" color={appTheme.colors.text}>
              Lịch giao hàng
            </Text>
            <XStack alignItems="center" gap="$1">
              <CalendarClock size={15} color={appTheme.colors.primary} />
              <Text fontSize={13} fontWeight="800" color={appTheme.colors.primary}>
                Hôm nay
              </Text>
            </XStack>
          </XStack>

          {todayJobs.map((job) => (
            <XStack
              key={job.id}
              alignItems="center"
              gap="$3"
              padding="$4"
              borderRadius={appTheme.radius.lg}
              backgroundColor={appTheme.colors.surface}
              borderWidth={1}
              borderColor={appTheme.colors.border}
            >
              <XStack
                width={48}
                height={48}
                borderRadius={18}
                alignItems="center"
                justifyContent="center"
                backgroundColor={appTheme.colors.primarySoft}
              >
                <PackageCheck size={22} color={appTheme.colors.primary} />
              </XStack>

              <YStack flex={1} gap="$1">
                <XStack alignItems="center" justifyContent="space-between">
                  <Text fontSize={15} fontWeight="900" color={appTheme.colors.text}>
                    {job.title}
                  </Text>
                  <Text fontSize={12} fontWeight="900" color={appTheme.colors.primary}>
                    {job.time}
                  </Text>
                </XStack>
                <XStack alignItems="center" gap="$1.5">
                  <MapPin size={13} color={appTheme.colors.textMuted} />
                  <Text flex={1} fontSize={13} lineHeight={18} color={appTheme.colors.textMuted}>
                    {job.address}
                  </Text>
                </XStack>
                <Text fontSize={12} fontWeight="800" color={appTheme.colors.success}>
                  {job.status}
                </Text>
              </YStack>

              <ChevronRight size={18} color={appTheme.colors.textMuted} />
            </XStack>
          ))}
        </YStack>

        <XStack gap="$3">
          <XStack
            flex={1}
            alignItems="center"
            gap="$3"
            padding="$4"
            borderRadius={appTheme.radius.lg}
            backgroundColor={appTheme.colors.primarySoft}
          >
            <Route size={22} color={appTheme.colors.primary} />
            <YStack flex={1}>
              <Text fontSize={13} fontWeight="900" color={appTheme.colors.text}>
                Tuyến đường
              </Text>
              <Text fontSize={12} color={appTheme.colors.textMuted}>
                Xem lộ trình
              </Text>
            </YStack>
          </XStack>

          <XStack
            flex={1}
            alignItems="center"
            gap="$3"
            padding="$4"
            borderRadius={appTheme.radius.lg}
            backgroundColor={appTheme.colors.primarySoft}
          >
            <CheckCircle2 size={22} color={appTheme.colors.primary} />
            <YStack flex={1}>
              <Text fontSize={13} fontWeight="900" color={appTheme.colors.text}>
                Hoàn tất
              </Text>
              <Text fontSize={12} color={appTheme.colors.textMuted}>
                Báo cáo nhanh
              </Text>
            </YStack>
          </XStack>
        </XStack>
      </ScrollView>
    </>
  );
}
