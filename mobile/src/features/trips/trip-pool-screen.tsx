import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AlertTriangle, Inbox, RefreshCcw } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';

import { AppText } from '@/components/app-text';
import { ScreenHeader } from '@/components/screen-header';
import { TripCard } from '@/components/trip-card';
import { appTheme } from '@/theme/app-theme';
import type { TripPoolItem } from '@/types/trip';
import { useActiveTrip } from '@/hooks/use-active-trip';
import { useClaimTrip } from '@/hooks/use-claim-trip';
import { useTripPool } from '@/hooks/use-trip-pool';
import { useConfirm, useToast } from '@/providers/ui-provider';

export function TripPoolScreen() {
    const { trips, isLoading, refresh } = useTripPool();
    const { trip: activeTrip } = useActiveTrip();
    const hasActiveTrip = activeTrip !== null;

    const [claimingId, setClaimingId] = useState<number | null>(null);
    const { showConfirm } = useConfirm();
    const { showToast }   = useToast();

    const { claim } = useClaimTrip((trip) => {
        showToast({ type: 'success', message: `Chuyến #${trip.id} đã được gán cho bạn!` });
        refresh();
        setClaimingId(null);
        router.push('/active-trip');
    });

    const handleClaim = useCallback(
        async (trip: TripPoolItem) => {
            if (hasActiveTrip) {
                showToast({ type: 'warning', message: 'Bạn đang có chuyến đang hoạt động' });
                return;
            }
            const ok = await showConfirm({
                title: 'Nhận chuyến',
                message: `Chuyến #${trip.id}\n${trip.pickup_address} → ${trip.delivery_address}`,
                confirmLabel: 'Nhận chuyến',
            });
            if (!ok) return;
            setClaimingId(trip.id);
            const result = await claim(trip.id);
            if (!result) setClaimingId(null);
        },
        [hasActiveTrip, claim],
    );

    return (
        <View style={{ flex: 1, backgroundColor: appTheme.colors.background }}>
            <StatusBar style="dark" />
            <ScreenHeader title="Chuyến có sẵn" showBack />
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{
                    paddingHorizontal: appTheme.spacing.screenX,
                    paddingTop: 16,
                    paddingBottom: appTheme.spacing.screenBottom,
                    gap: 14,
                }}
                refreshControl={
                    <RefreshControl
                        refreshing={isLoading}
                        onRefresh={refresh}
                        tintColor={appTheme.colors.primary}
                    />
                }
            >
                {/* Trip count */}
                <AppText variant="caption" tone="muted">
                    {trips.length} chuyến phù hợp nhóm xe của bạn
                </AppText>

                {/* Active trip warning */}
                {hasActiveTrip ? (
                    <XStack
                        padding={12}
                        borderRadius={appTheme.radius.sm}
                        backgroundColor={appTheme.colors.warningSoft}
                        borderWidth={1}
                        borderColor={appTheme.colors.warningBorder}
                        gap={8}
                        alignItems="center"
                    >
                        <AlertTriangle size={16} color={appTheme.colors.warningText} />
                        <YStack flex={1}>
                            <Text fontSize={12} fontWeight="900" color={appTheme.colors.warningText}>
                                Bạn đang có chuyến hoạt động
                            </Text>
                            <Text fontSize={11} color={appTheme.colors.warningTextMuted}>
                                Hoàn thành chuyến hiện tại để nhận chuyến mới
                            </Text>
                        </YStack>
                    </XStack>
                ) : null}

                {/* Empty state */}
                {!isLoading && trips.length === 0 ? (
                    <YStack alignItems="center" justifyContent="center" paddingVertical={64} gap={12}>
                        <XStack
                            width={64}
                            height={64}
                            borderRadius={24}
                            backgroundColor={appTheme.colors.surfaceSoft}
                            alignItems="center"
                            justifyContent="center"
                        >
                            <Inbox size={30} color={appTheme.colors.textMuted} />
                        </XStack>
                        <YStack alignItems="center" gap={4}>
                            <AppText variant="bodyStrong" tone="muted">Chưa có chuyến nào</AppText>
                            <AppText variant="caption" tone="muted">Kéo để làm mới danh sách</AppText>
                        </YStack>
                    </YStack>
                ) : null}

                {/* Trip list */}
                {trips.map((trip) => (
                    <TripCard
                        key={trip.id}
                        trip={trip}
                        onClaim={() => handleClaim(trip)}
                        isClaimLoading={claimingId === trip.id}
                        claimDisabled={hasActiveTrip}
                    />
                ))}
            </ScrollView>
        </View>
    );
}
