import { useCallback, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AlertTriangle, Inbox } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';

import { AppText }             from '@/components/app-text';
import { PaginationBar }       from '@/components/pagination-bar';
import { ScreenHeader }        from '@/components/screen-header';
import { TripPoolSkeleton }    from '@/components/skeleton';
import { TripCard }            from '@/components/trip-card';
import { VehicleGroupFilter }  from '@/components/vehicle-group-filter';
import { appTheme }            from '@/theme/app-theme';
import type { TripPoolItem }   from '@/types/trip';
import { useActiveTrip }       from '@/hooks/use-active-trip';
import { useClaimTrip }        from '@/hooks/use-claim-trip';
import { useTripPool }         from '@/hooks/use-trip-pool';
import { useConfirm, useToast } from '@/providers/ui-provider';

// ─── Screen ───────────────────────────────────────────────────────────────────

export function TripPoolScreen() {
    const {
        trips,
        vehicleGroups,
        total,
        page,
        totalPages,
        groupFilter,
        setGroupFilter,
        isLoading,
        refresh,
        goToPage,
        removeShipment,
    } = useTripPool();

    const { trip: activeTrip } = useActiveTrip();
    const hasActiveTrip        = activeTrip !== null;

    const [claimingId, setClaimingId] = useState<number | null>(null);
    const scrollRef = useRef<ScrollView>(null);
    const { showConfirm } = useConfirm();
    const { showToast }   = useToast();
    const { claim }       = useClaimTrip();

    const handleClaim = useCallback(
        async (trip: TripPoolItem) => {
            if (hasActiveTrip) {
                showToast({ type: 'warning', message: 'Bạn đang có chuyến đang thực hiện' });
                return;
            }
            if (claimingId !== null) return;

            const ok = await showConfirm({
                title:        'Nhận chuyến',
                message:      `Đơn #${trip.order_id} — Chuyến ${trip.shipment_index}/${trip.total_order_legs}\n${trip.pickup_address} → ${trip.delivery_address}`,
                confirmLabel: 'Nhận chuyến',
            });
            if (!ok) return;

            removeShipment(trip.shipment_id);
            setClaimingId(trip.shipment_id);

            const result = await claim(trip.shipment_id);
            setClaimingId(null);

            if (result.ok) {
                showToast({ type: 'success', message: `Đã nhận chuyến ${trip.shipment_index} của đơn #${trip.order_id}` });
                router.replace('/active-trip');
            } else if (result.sameOrder) {
                showToast({ type: 'warning', message: result.message });
                refresh(false);
            } else if (result.alreadyClaimed) {
                showToast({ type: 'warning', message: 'Chuyến này đã được tài xế khác nhận' });
                refresh(false);
            } else {
                showToast({ type: 'error', message: result.message });
                refresh(false);
            }
        },
        [hasActiveTrip, claimingId, claim, removeShipment, refresh, showConfirm, showToast],
    );

    const paginationDisabled = isLoading || claimingId !== null;
    const handlePageChange = useCallback((nextPage: number) => {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
        goToPage(nextPage);
    }, [goToPage]);

    return (
        <View style={{ flex: 1, backgroundColor: appTheme.colors.background }}>
            <StatusBar style="dark" />
            <ScreenHeader title="Đơn hàng có sẵn" showBack />

            {/* Vehicle group filter */}
            <View style={{ paddingTop: 12, paddingBottom: 4 }}>
                <VehicleGroupFilter
                    groups={vehicleGroups}
                    selected={groupFilter}
                    onSelect={setGroupFilter}
                />
            </View>

            <ScrollView
                ref={scrollRef}
                style={{ flex: 1 }}
                contentContainerStyle={{
                    paddingHorizontal: appTheme.spacing.screenX,
                    paddingTop: 10,
                    paddingBottom: appTheme.spacing.screenBottom,
                    gap: 14,
                }}
                refreshControl={
                    <RefreshControl
                        refreshing={isLoading}
                        onRefresh={() => refresh(true)}
                        tintColor={appTheme.colors.primary}
                    />
                }
            >
                {/* Count label */}
                {!isLoading || trips.length > 0 ? (
                    <AppText variant="caption" tone="muted">
                        {total > 0 ? `${total} đơn · trang ${page}/${totalPages}` : ''}
                    </AppText>
                ) : null}

                {/* Active trip warning */}
                {hasActiveTrip ? (
                    <XStack
                        padding={12} borderRadius={appTheme.radius.sm}
                        backgroundColor={appTheme.colors.warningSoft}
                        borderWidth={1} borderColor={appTheme.colors.warningBorder}
                        gap={8} alignItems="center"
                    >
                        <AlertTriangle size={16} color={appTheme.colors.warningText} />
                        <YStack flex={1}>
                            <Text fontSize={12} fontWeight="900" color={appTheme.colors.warningText}>
                                Bạn đang có chuyến đang thực hiện
                            </Text>
                            <Text fontSize={11} color={appTheme.colors.warningTextMuted}>
                                Hoàn thành chuyến hiện tại trước khi nhận chuyến mới
                            </Text>
                        </YStack>
                    </XStack>
                ) : null}

                {/* Skeleton */}
                {isLoading && trips.length === 0 ? <TripPoolSkeleton /> : null}

                {/* Empty state */}
                {!isLoading && trips.length === 0 ? (
                    <YStack alignItems="center" justifyContent="center" paddingVertical={64} gap={12}>
                        <XStack
                            width={64} height={64} borderRadius={24}
                            backgroundColor={appTheme.colors.surfaceSoft}
                            alignItems="center" justifyContent="center"
                        >
                            <Inbox size={30} color={appTheme.colors.textMuted} />
                        </XStack>
                        <YStack alignItems="center" gap={4}>
                            <AppText variant="bodyStrong" tone="muted">
                                {groupFilter ? 'Không có đơn cho nhóm xe này' : 'Chưa có chuyến nào'}
                            </AppText>
                            <AppText variant="caption" tone="muted">Kéo để làm mới danh sách</AppText>
                        </YStack>
                    </YStack>
                ) : null}

                {/* Trip cards */}
                {trips.map((trip) => (
                    <TripCard
                        key={trip.shipment_id}
                        trip={trip}
                        onPress={() => router.push(`/pool-order/${trip.shipment_id}`)}
                        onClaim={() => handleClaim(trip)}
                        isClaimLoading={claimingId === trip.shipment_id}
                        claimDisabled={hasActiveTrip || claimingId !== null}
                    />
                ))}

                <PaginationBar
                    page={page}
                    totalPages={totalPages}
                    total={total}
                    totalLabel="đơn"
                    onPrev={() => handlePageChange(page - 1)}
                    onNext={() => handlePageChange(page + 1)}
                    onPage={handlePageChange}
                    disabled={paginationDisabled}
                />
            </ScrollView>

            {/* Pagination bar — fixed at bottom */}
        </View>
    );
}

