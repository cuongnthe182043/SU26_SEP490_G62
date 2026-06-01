import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Camera, MapPin, Package, X } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';

import { AppText } from '@/components/app-text';
import { LifecycleActionButton } from '@/components/lifecycle-action-button';
import { ScreenHeader } from '@/components/screen-header';
import { TripStatusBadge } from '@/components/trip-status-badge';
import { appTheme } from '@/theme/app-theme';
import { useActiveTrip } from '@/hooks/use-active-trip';
import { useCompletionProof } from '@/hooks/use-completion-proof';
import { useTripLifecycle } from '@/hooks/use-trip-lifecycle';
import { useConfirm } from '@/providers/ui-provider';
import type { ActiveTrip, TripStatus } from '@/types/trip';
import { NEXT_ACTIONS } from '@/types/trip';

function InfoRow({ label, value }: { label: string; value: string | null }) {
    if (!value) return null;
    return (
        <XStack justifyContent="space-between" paddingVertical={6}>
            <Text fontSize={13} color={appTheme.colors.textMuted}>{label}</Text>
            <Text fontSize={13} fontWeight="800" color={appTheme.colors.text} flex={1} textAlign="right">
                {value}
            </Text>
        </XStack>
    );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <YStack
            borderRadius={appTheme.radius.lg}
            borderWidth={1}
            borderColor={appTheme.colors.border}
            backgroundColor={appTheme.colors.surface}
            overflow="hidden"
        >
            <XStack
                paddingHorizontal={16}
                paddingVertical={11}
                backgroundColor={appTheme.colors.surfaceSoft}
            >
                <Text fontSize={12} fontWeight="900" color={appTheme.colors.textMuted}>
                    {title.toUpperCase()}
                </Text>
            </XStack>
            <YStack padding={16} gap={2}>
                {children}
            </YStack>
        </YStack>
    );
}

function ActiveTripContent({ trip, refresh }: { trip: ActiveTrip; refresh: () => void }) {
    const { isLoading: lifecycleLoading, advance } = useTripLifecycle(() => refresh());
    const { isUploading, completeNoProof } = useCompletionProof(() => {
        refresh();
        router.replace('/(tabs)');
    });
    const { showConfirm } = useConfirm();

    const isWorking  = lifecycleLoading || isUploading;
    const nextAction = NEXT_ACTIONS[trip.status as TripStatus];

    const handleAdvance = () => {
        if (!nextAction) return;
        advance(trip.id, nextAction.nextStatus);
    };

    const handleCompleteArrived = async () => {
        if (trip.is_final_shipment) {
            router.push({ pathname: '/completion-proof', params: { tripId: String(trip.id) } });
        } else {
            const ok = await showConfirm({
                title: 'Hoàn thành chuyến',
                message: 'Xác nhận hoàn thành chuyến vận chuyển này?',
                confirmLabel: 'Hoàn thành',
            });
            if (ok) completeNoProof(trip.id);
        }
    };

    const handleMarkFailed = async () => {
        const ok = await showConfirm({
            title: 'Giao hàng thất bại',
            message: 'Xác nhận giao hàng không thành công?',
            confirmLabel: 'Xác nhận',
            danger: true,
        });
        if (ok) advance(trip.id, 'failed');
    };

    return (
        <View style={{ flex: 1, backgroundColor: appTheme.colors.background }}>
            <ScreenHeader
                title={`Chuyến #${trip.id}`}
                showBack
                right={<TripStatusBadge status={trip.status as TripStatus} />}
            />
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{
                    paddingHorizontal: appTheme.spacing.screenX,
                    paddingTop: 16,
                    paddingBottom: appTheme.spacing.screenBottom,
                    gap: 14,
                }}
            >
            {/* Shipment leg info */}
            <Text fontSize={12} color={appTheme.colors.textMuted} fontWeight="700">
                {trip.cargo_name ?? 'Hàng hóa'}  •  Leg {trip.shipment_index}/{trip.max_shipment_index}
            </Text>

            {/* Route */}
            <SectionCard title="Tuyến đường">
                <XStack gap={10} alignItems="flex-start">
                    <XStack
                        width={28} height={28} borderRadius={10}
                        backgroundColor={appTheme.colors.successSoft} alignItems="center" justifyContent="center" marginTop={1}
                    >
                        <MapPin size={13} color={appTheme.colors.success} />
                    </XStack>
                    <YStack flex={1}>
                        <Text fontSize={11} color={appTheme.colors.textMuted} fontWeight="700">ĐIỂM LẤY</Text>
                        <Text fontSize={13} color={appTheme.colors.text} lineHeight={18}>{trip.pickup_address}</Text>
                    </YStack>
                </XStack>
                <XStack height={1} backgroundColor={appTheme.colors.border} marginVertical={8} marginLeft={38} />
                <XStack gap={10} alignItems="flex-start">
                    <XStack
                        width={28} height={28} borderRadius={10}
                        backgroundColor={appTheme.colors.primarySoft} alignItems="center" justifyContent="center" marginTop={1}
                    >
                        <MapPin size={13} color={appTheme.colors.primary} />
                    </XStack>
                    <YStack flex={1}>
                        <Text fontSize={11} color={appTheme.colors.textMuted} fontWeight="700">ĐIỂM GIAO</Text>
                        <Text fontSize={13} color={appTheme.colors.text} lineHeight={18}>{trip.delivery_address}</Text>
                    </YStack>
                </XStack>
            </SectionCard>

            {/* Cargo info */}
            <SectionCard title="Hàng hóa">
                <InfoRow label="Tên hàng" value={trip.cargo_name} />
                <InfoRow label="Trọng lượng" value={trip.cargo_weight_kg ? `${trip.cargo_weight_kg} kg` : null} />
                <InfoRow
                    label="Giá trị"
                    value={trip.estimated_price
                        ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(trip.estimated_price))
                        : null}
                />
                {trip.notes ? <InfoRow label="Ghi chú" value={trip.notes} /> : null}
            </SectionCard>

            {/* Final shipment notice */}
            {trip.is_final_shipment ? (
                <XStack
                    padding={12} borderRadius={appTheme.radius.sm}
                    backgroundColor={appTheme.colors.primarySoft}
                    borderWidth={1} borderColor={appTheme.colors.primaryMuted}
                    gap={8} alignItems="center"
                >
                    <Package size={16} color={appTheme.colors.primary} />
                    <Text fontSize={12} fontWeight="800" color={appTheme.colors.primary} flex={1}>
                        Chuyến cuối — cần chụp ảnh xác nhận khi giao hàng
                    </Text>
                </XStack>
            ) : null}

            {/* Action buttons */}
            <YStack gap={10}>
                {nextAction && trip.status !== 'arrived' ? (
                    <LifecycleActionButton
                        label={nextAction.label}
                        tone={nextAction.tone}
                        onPress={handleAdvance}
                        isLoading={isWorking}
                    />
                ) : null}

                {trip.status === 'arrived' ? (
                    <>
                        <LifecycleActionButton
                            label={trip.is_final_shipment ? 'Chụp ảnh & Hoàn thành' : 'Hoàn thành giao hàng'}
                            tone="primary"
                            onPress={handleCompleteArrived}
                            isLoading={isWorking}
                            icon={trip.is_final_shipment ? <Camera size={17} color="#fff" /> : undefined}
                        />
                        <LifecycleActionButton
                            label="Giao hàng thất bại"
                            tone="danger"
                            onPress={handleMarkFailed}
                            isLoading={isWorking}
                            icon={<X size={16} color={appTheme.colors.danger} />}
                        />
                    </>
                ) : null}
            </YStack>
        </ScrollView>
        </View>
    );
}

export function ActiveTripScreen() {
    const { trip, isLoading, error, refresh } = useActiveTrip();

    if (isLoading) {
        return (
            <View style={{ flex: 1, backgroundColor: appTheme.colors.background }}>
                <ScreenHeader title="Chuyến hiện tại" showBack />
                <YStack flex={1} alignItems="center" justifyContent="center">
                    <AppText variant="body" tone="muted">Đang tải chuyến...</AppText>
                </YStack>
            </View>
        );
    }

    if (error || !trip) {
        return (
            <View style={{ flex: 1, backgroundColor: appTheme.colors.background }}>
                <ScreenHeader title="Chuyến hiện tại" showBack />
                <YStack flex={1} alignItems="center" justifyContent="center" gap={12} padding={24}>
                    <AppText variant="bodyStrong" tone="muted">
                        {error ?? 'Bạn chưa có chuyến nào đang hoạt động.'}
                    </AppText>
                    <AppText variant="caption" tone="primary" onPress={() => router.push('/trip-pool')}>
                        → Xem danh sách chuyến
                    </AppText>
                </YStack>
            </View>
        );
    }

    return (
        <>
            <StatusBar style="dark" />
            <ActiveTripContent trip={trip} refresh={refresh} />
        </>
    );
}
