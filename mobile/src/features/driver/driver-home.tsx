import { Banknote, Bell, CalendarOff, ChevronRight, DollarSign, HandCoins, MapPin, Package, PackageCheck, Trophy, Truck } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { ScrollView, Text, XStack, YStack } from 'tamagui';

import { AppButton } from '@/components/app-button';
import { ActiveTripBannerSkeleton, StatRowSkeleton } from '@/components/skeleton';
import { StatCard } from '@/components/stat-card';
import { TripStatusBadge } from '@/components/trip-status-badge';
import { appTheme } from '@/theme/app-theme';
import { useActiveTrip } from '@/hooks/use-active-trip';
import { useProfile } from '@/hooks/use-profile';
import { useTripStats } from '@/hooks/use-trip-stats';
import type { TripStatus } from '@/types/trip';

// ─── Active trip banner ───────────────────────────────────────────────────────

function ActiveTripBanner({ onPress }: { onPress: () => void }) {
    const { trip, isLoading } = useActiveTrip();

    if (isLoading) {
        return <ActiveTripBannerSkeleton />;
    }

    if (!trip) {
        return (
            <Pressable onPress={() => router.push('/trip-pool')} style={{ borderRadius: appTheme.radius.xl }}>
                <YStack
                    padding="$5"
                    borderRadius={appTheme.radius.xl}
                    borderWidth={1.5}
                    borderColor={appTheme.colors.border}
                    borderStyle="dashed"
                    alignItems="center"
                    justifyContent="center"
                    gap="$2"
                    minHeight={100}
                >
                    <XStack
                        width={48} height={48} borderRadius={18}
                        backgroundColor={appTheme.colors.primarySoft}
                        alignItems="center" justifyContent="center"
                    >
                        <Package size={24} color={appTheme.colors.primary} />
                    </XStack>
                    <Text fontSize={14} fontWeight="900" color={appTheme.colors.primary}>
                        Chưa có chuyến — Nhận chuyến ngay
                    </Text>
                    <Text fontSize={12} color={appTheme.colors.textMuted}>
                        Xem danh sách chuyến phù hợp với xe của bạn
                    </Text>
                </YStack>
            </Pressable>
        );
    }

    return (
        <Pressable onPress={onPress} style={{ borderRadius: appTheme.radius.xl }}>
            <YStack
                gap="$4"
                padding="$5"
                borderRadius={appTheme.radius.xl}
                backgroundColor={appTheme.colors.primary}
                overflow="hidden"
            >
                <XStack
                    position="absolute" right={-36} top={-40}
                    width={132} height={132} borderRadius={66}
                    backgroundColor="rgba(255,255,255,0.12)"
                />

                <XStack alignItems="center" justifyContent="space-between">
                    <XStack alignItems="center" gap="$3" flex={1}>
                        <XStack
                            width={48} height={48} borderRadius={18}
                            alignItems="center" justifyContent="center"
                            backgroundColor="rgba(255,255,255,0.18)"
                        >
                            <Truck size={24} color={appTheme.colors.surface} />
                        </XStack>
                        <YStack flex={1} gap={2}>
                            <Text fontSize={12} fontWeight="900" color="rgba(255,255,255,0.75)">
                                ĐƠN #{trip.order_id} — CHUYẾN {trip.shipment_index}/{trip.max_shipment_index}
                            </Text>
                            <Text fontSize={18} fontWeight="900" color={appTheme.colors.surface} lineHeight={24}>
                                {trip.cargo_name ?? 'Hàng hóa'}
                            </Text>
                        </YStack>
                    </XStack>
                    <TripStatusBadge status={trip.status as TripStatus} />
                </XStack>

                <XStack gap="$3">
                    <YStack flex={1} gap={2}>
                        <Text fontSize={11} color="rgba(255,255,255,0.65)">ĐIỂM LẤY</Text>
                        <Text fontSize={13} fontWeight="800" color={appTheme.colors.surface} numberOfLines={1}>
                            {trip.pickup_address}
                        </Text>
                    </YStack>
                    <YStack flex={1} gap={2}>
                        <Text fontSize={11} color="rgba(255,255,255,0.65)">ĐIỂM GIAO</Text>
                        <Text fontSize={13} fontWeight="800" color={appTheme.colors.surface} numberOfLines={1}>
                            {trip.delivery_address}
                        </Text>
                    </YStack>
                </XStack>

                <AppButton tone="secondary" onPress={onPress}>
                    Xem chi tiết chuyến
                </AppButton>
            </YStack>
        </Pressable>
    );
}

// ─── Home screen ──────────────────────────────────────────────────────────────

export function DriverHomeScreen() {
    const insets = useSafeAreaInsets();
    const { profile, isLoading: profileLoading } = useProfile();
    const { stats } = useTripStats();

    const displayName = profileLoading
        ? '...'
        : (profile?.full_name ?? 'Tài xế');

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
                    paddingTop: insets.top + 16,
                    paddingBottom: appTheme.spacing.screenBottom,
                    gap: 20,
                }}
            >
                {/* Greeting */}
                <XStack alignItems="center" justifyContent="space-between">
                    <YStack gap={2}>
                        <Text fontSize={14} color={appTheme.colors.textMuted}>Xin chào</Text>
                        <Text fontSize={26} lineHeight={32} fontWeight="900" color={appTheme.colors.text}>
                            {displayName}
                        </Text>
                    </YStack>
                    <XStack
                        width={46} height={46} borderRadius={18}
                        alignItems="center" justifyContent="center"
                        backgroundColor={appTheme.colors.primarySoft}
                    >
                        <Bell size={21} color={appTheme.colors.primary} />
                    </XStack>
                </XStack>

                {/* Active trip banner */}
                <ActiveTripBanner onPress={() => router.push('/active-trip')} />

                {/* Quick stats */}
                {stats ? (
                    <XStack gap="$3" flexWrap="wrap">
                        <StatCard value={String(stats.today_total)}     label="Chuyến hôm nay" />
                        <StatCard value={String(stats.today_completed)}  label="Hoàn thành" />
                        <StatCard value={String(stats.month_completed)}  label="HT tháng này" />
                    </XStack>
                ) : (
                    <StatRowSkeleton />
                )}

                {/* Quick actions */}
                <YStack gap={10}>
                    <Text fontSize={16} fontWeight="900" color={appTheme.colors.text}>
                        Thao tác nhanh
                    </Text>

                    <Pressable onPress={() => router.push('/trip-pool')}>
                        <XStack
                            alignItems="center" padding="$4"
                            borderRadius={appTheme.radius.lg}
                            borderWidth={1} borderColor={appTheme.colors.border}
                            backgroundColor={appTheme.colors.surface} gap="$3"
                        >
                            <XStack
                                width={44} height={44} borderRadius={16}
                                backgroundColor={appTheme.colors.primarySoft}
                                alignItems="center" justifyContent="center"
                            >
                                <PackageCheck size={22} color={appTheme.colors.primary} />
                            </XStack>
                            <YStack flex={1}>
                                <Text fontSize={15} fontWeight="900" color={appTheme.colors.text}>
                                    Danh sách chuyến
                                </Text>
                                <Text fontSize={12} color={appTheme.colors.textMuted}>
                                    Xem và nhận chuyến phù hợp nhóm xe
                                </Text>
                            </YStack>
                            <ChevronRight size={18} color={appTheme.colors.textMuted} />
                        </XStack>
                    </Pressable>

                    {/* <Pressable onPress={() => router.push('/active-trip')}>
                        <XStack
                            alignItems="center" padding="$4"
                            borderRadius={appTheme.radius.lg}
                            borderWidth={1} borderColor={appTheme.colors.border}
                            backgroundColor={appTheme.colors.surface} gap="$3"
                        >
                            <XStack
                                width={44} height={44} borderRadius={16}
                                backgroundColor={appTheme.colors.successSoft}
                                alignItems="center" justifyContent="center"
                            >
                                <MapPin size={22} color={appTheme.colors.success} />
                            </XStack>
                            <YStack flex={1}>
                                <Text fontSize={15} fontWeight="900" color={appTheme.colors.text}>
                                    Chuyến hiện tại
                                </Text>
                                <Text fontSize={12} color={appTheme.colors.textMuted}>
                                    Quản lý và cập nhật trạng thái chuyến
                                </Text>
                            </YStack>
                            <ChevronRight size={18} color={appTheme.colors.textMuted} />
                        </XStack>
                    </Pressable> */}

                    <Pressable onPress={() => router.push('/kpi')}>
                        <XStack
                            alignItems="center" padding="$4"
                            borderRadius={appTheme.radius.lg}
                            borderWidth={1} borderColor={appTheme.colors.border}
                            backgroundColor={appTheme.colors.surface} gap="$3"
                        >
                            <XStack
                                width={44} height={44} borderRadius={16}
                                backgroundColor='#FEF9C3'
                                alignItems="center" justifyContent="center"
                            >
                                <Trophy size={22} color='#CA8A04' />
                            </XStack>
                            <YStack flex={1}>
                                <Text fontSize={15} fontWeight="900" color={appTheme.colors.text}>
                                    KPI & Xếp hạng
                                </Text>
                                <Text fontSize={12} color={appTheme.colors.textMuted}>
                                    Theo dõi hiệu suất và bảng xếp hạng
                                </Text>
                            </YStack>
                            <ChevronRight size={18} color={appTheme.colors.textMuted} />
                        </XStack>
                    </Pressable>

                    <Pressable onPress={() => router.push('/bill')}>
                        <XStack
                            alignItems="center" padding="$4"
                            borderRadius={appTheme.radius.lg}
                            borderWidth={1} borderColor={appTheme.colors.border}
                            backgroundColor={appTheme.colors.surface} gap="$3"
                        >
                            <XStack
                                width={44} height={44} borderRadius={16}
                                backgroundColor={appTheme.colors.primarySoft}
                                alignItems="center" justifyContent="center"
                            >
                                <HandCoins size={22} color={appTheme.colors.primary} />
                            </XStack>
                            <YStack flex={1}>
                                <Text fontSize={15} fontWeight="900" color={appTheme.colors.text}>
                                    Bill thu hộ
                                </Text>
                                <Text fontSize={12} color={appTheme.colors.textMuted}>
                                    Tạo bill báo thu tiền khách — chờ kế toán xác nhận
                                </Text>
                            </YStack>
                            <ChevronRight size={18} color={appTheme.colors.textMuted} />
                        </XStack>
                    </Pressable>

                    <Pressable onPress={() => router.push('/debt')}>
                        <XStack
                            alignItems="center" padding="$4"
                            borderRadius={appTheme.radius.lg}
                            borderWidth={1} borderColor={appTheme.colors.border}
                            backgroundColor={appTheme.colors.surface} gap="$3"
                        >
                            <XStack
                                width={44} height={44} borderRadius={16}
                                backgroundColor={appTheme.colors.dangerSoft}
                                alignItems="center" justifyContent="center"
                            >
                                <Banknote size={22} color={appTheme.colors.danger} />
                            </XStack>
                            <YStack flex={1}>
                                <Text fontSize={15} fontWeight="900" color={appTheme.colors.text}>
                                    Công nợ
                                </Text>
                                <Text fontSize={12} color={appTheme.colors.textMuted}>
                                    Xem công nợ do kế toán tạo
                                </Text>
                            </YStack>
                            <ChevronRight size={18} color={appTheme.colors.textMuted} />
                        </XStack>
                    </Pressable>

                    <Pressable onPress={() => router.push('/payroll')}>
                        <XStack
                            alignItems="center" padding="$4"
                            borderRadius={appTheme.radius.lg}
                            borderWidth={1} borderColor={appTheme.colors.border}
                            backgroundColor={appTheme.colors.surface} gap="$3"
                        >
                            <XStack
                                width={44} height={44} borderRadius={16}
                                backgroundColor={appTheme.colors.successSoft}
                                alignItems="center" justifyContent="center"
                            >
                                <DollarSign size={22} color={appTheme.colors.success} />
                            </XStack>
                            <YStack flex={1}>
                                <Text fontSize={15} fontWeight="900" color={appTheme.colors.text}>
                                    Lương & Ứng lương
                                </Text>
                                <Text fontSize={12} color={appTheme.colors.textMuted}>
                                    Xem lương ước tính và yêu cầu ứng
                                </Text>
                            </YStack>
                            <ChevronRight size={18} color={appTheme.colors.textMuted} />
                        </XStack>
                    </Pressable>

                    <Pressable onPress={() => router.push('/leave')}>
                        <XStack
                            alignItems="center" padding="$4"
                            borderRadius={appTheme.radius.lg}
                            borderWidth={1} borderColor={appTheme.colors.border}
                            backgroundColor={appTheme.colors.surface} gap="$3"
                        >
                            <XStack
                                width={44} height={44} borderRadius={16}
                                backgroundColor={appTheme.colors.warningSoft}
                                alignItems="center" justifyContent="center"
                            >
                                <CalendarOff size={22} color={appTheme.colors.warning} />
                            </XStack>
                            <YStack flex={1}>
                                <Text fontSize={15} fontWeight="900" color={appTheme.colors.text}>
                                    Đăng ký nghỉ
                                </Text>
                                <Text fontSize={12} color={appTheme.colors.textMuted}>
                                    Xem ngày công và đăng ký nghỉ phép
                                </Text>
                            </YStack>
                            <ChevronRight size={18} color={appTheme.colors.textMuted} />
                        </XStack>
                    </Pressable>
                </YStack>
            </ScrollView>
        </>
    );
}
