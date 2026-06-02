import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Layers, MapPin, Package, Weight, XCircle } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';

import { AppText } from '@/components/app-text';
import { LifecycleActionButton } from '@/components/lifecycle-action-button';
import { PoolOrderDetailSkeleton } from '@/components/skeleton';
import { ScreenHeader } from '@/components/screen-header';
import { appTheme } from '@/theme/app-theme';
import { useActiveTrip } from '@/hooks/use-active-trip';
import { useClaimTrip } from '@/hooks/use-claim-trip';
import { usePoolOrderDetail } from '@/hooks/use-pool-order-detail';
import { useConfirm, useToast } from '@/providers/ui-provider';
import type { PoolShipment } from '@/types/trip';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtCurrency = (v: string | null) =>
    v ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(v)) : null;

const fmtWeight = (kg: string | null) => {
    if (!kg) return null;
    const n = parseFloat(kg);
    return n >= 1000 ? `${(n / 1000).toFixed(1)} tấn` : `${n} kg`;
};

// ─── Shipment leg card ────────────────────────────────────────────────────────

function LegCard({ leg, total }: { leg: PoolShipment; total: number }) {
    const isFirst = leg.shipment_index === 1;
    const isLast  = leg.shipment_index === total;

    return (
        <YStack
            borderRadius={appTheme.radius.lg}
            borderWidth={1}
            borderColor={appTheme.colors.border}
            backgroundColor={appTheme.colors.surface}
            overflow="hidden"
        >
            {/* Card header */}
            <XStack
                paddingHorizontal={14} paddingVertical={10}
                backgroundColor={appTheme.colors.surfaceSoft}
                alignItems="center" justifyContent="space-between"
            >
                <Text fontSize={13} fontWeight="900" color={appTheme.colors.text}>
                    Chuyến {leg.shipment_index} / {total}
                </Text>
                <XStack gap={6}>
                    {isFirst ? (
                        <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: appTheme.colors.successSoft }}>
                            <Text fontSize={9} fontWeight="900" color={appTheme.colors.success}>ĐẦU</Text>
                        </View>
                    ) : null}
                    {isLast ? (
                        <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: appTheme.colors.primarySoft }}>
                            <Text fontSize={9} fontWeight="900" color={appTheme.colors.primary}>CUỐI</Text>
                        </View>
                    ) : null}
                </XStack>
            </XStack>

            <YStack padding={14} gap={10}>
                {/* Route */}
                <XStack gap={10} alignItems="flex-start">
                    <XStack width={28} height={28} borderRadius={10}
                        backgroundColor={appTheme.colors.successSoft}
                        alignItems="center" justifyContent="center" marginTop={1}>
                        <MapPin size={13} color={appTheme.colors.success} />
                    </XStack>
                    <YStack flex={1} gap={1}>
                        <Text fontSize={10} fontWeight="700" color={appTheme.colors.textMuted}>LẤY HÀNG</Text>
                        <Text fontSize={13} color={appTheme.colors.text} lineHeight={18}>{leg.pickup_address}</Text>
                    </YStack>
                </XStack>

                <View style={{ width: 1.5, height: 10, backgroundColor: appTheme.colors.border, marginLeft: 13 }} />

                <XStack gap={10} alignItems="flex-start">
                    <XStack width={28} height={28} borderRadius={10}
                        backgroundColor={appTheme.colors.primarySoft}
                        alignItems="center" justifyContent="center" marginTop={1}>
                        <MapPin size={13} color={appTheme.colors.primary} />
                    </XStack>
                    <YStack flex={1} gap={1}>
                        <Text fontSize={10} fontWeight="700" color={appTheme.colors.textMuted}>GIAO HÀNG</Text>
                        <Text fontSize={13} color={appTheme.colors.text} lineHeight={18}>{leg.delivery_address}</Text>
                    </YStack>
                </XStack>

                {/* Meta row */}
                {(leg.cargo_weight_kg || leg.estimated_price) ? (
                    <XStack gap={16} paddingTop={2} flexWrap="wrap">
                        {leg.cargo_weight_kg ? (
                            <XStack alignItems="center" gap={5}>
                                <Weight size={12} color={appTheme.colors.textMuted} />
                                <Text fontSize={12} color={appTheme.colors.textMuted}>
                                    {fmtWeight(leg.cargo_weight_kg)}
                                </Text>
                            </XStack>
                        ) : null}
                        {leg.estimated_price ? (
                            <Text fontSize={12} fontWeight="800" color={appTheme.colors.primary}>
                                {fmtCurrency(leg.estimated_price)}
                            </Text>
                        ) : null}
                    </XStack>
                ) : null}

                {/* Notes */}
                {leg.notes ? (
                    <XStack padding={10} borderRadius={10}
                        backgroundColor={appTheme.colors.surfaceSoft}
                        borderWidth={1} borderColor={appTheme.colors.border}>
                        <Text fontSize={12} color={appTheme.colors.textMuted} flex={1}>{leg.notes}</Text>
                    </XStack>
                ) : null}
            </YStack>
        </YStack>
    );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PoolOrderDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const orderId = Number(id);

    const { data, isLoading, error } = usePoolOrderDetail(orderId);
    const { trip: activeTrip }       = useActiveTrip();
    const hasActiveTrip              = activeTrip !== null;

    const { showConfirm } = useConfirm();
    const { showToast }   = useToast();
    const { isLoading: isClaiming, claim } = useClaimTrip();

    const handleClaim = async () => {
        if (!data) return;
        if (hasActiveTrip) {
            showToast({ type: 'warning', message: 'Bạn đang có đơn hàng đang thực hiện' });
            return;
        }
        const ok = await showConfirm({
            title:        'Nhận đơn hàng',
            message:      `Đơn #${data.order.id} — ${data.order.total_legs} chuyến\n${data.shipments[0]?.pickup_address} → ${data.shipments[data.shipments.length - 1]?.delivery_address}`,
            confirmLabel: 'Nhận đơn hàng',
        });
        if (!ok) return;

        const result = await claim(orderId);
        if (result.ok) {
            showToast({ type: 'success', message: `Đơn hàng #${result.trip.order_id} đã được nhận!` });
            router.replace('/active-trip');
        } else if (result.alreadyClaimed) {
            showToast({ type: 'warning', message: 'Đơn hàng này đã được tài xế khác nhận' });
            router.back();
        } else {
            showToast({ type: 'error', message: result.message });
        }
    };

    // ── Loading ──────────────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <View style={{ flex: 1, backgroundColor: appTheme.colors.background }}>
                <ScreenHeader title={`Đơn #${orderId}`} showBack />
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingBottom: appTheme.spacing.screenBottom }}
                    scrollEnabled={false}
                >
                    <PoolOrderDetailSkeleton />
                </ScrollView>
            </View>
        );
    }

    // ── Error / not found ────────────────────────────────────────────────────
    if (error || !data) {
        return (
            <View style={{ flex: 1, backgroundColor: appTheme.colors.background }}>
                <ScreenHeader title={`Đơn #${orderId}`} showBack />
                <YStack flex={1} alignItems="center" justifyContent="center" padding={24} gap={12}>
                    <XCircle size={36} color={appTheme.colors.danger} />
                    <AppText variant="bodyStrong" tone="muted">
                        {error ?? 'Đơn hàng không còn khả dụng'}
                    </AppText>
                    <AppText variant="caption" tone="muted">
                        Đơn này có thể đã được tài xế khác nhận rồi
                    </AppText>
                </YStack>
            </View>
        );
    }

    const { order, shipments } = data;
    const totalPrice  = fmtCurrency(order.total_estimated_price);
    const totalWeight = fmtWeight(order.total_cargo_weight_kg);

    return (
        <View style={{ flex: 1, backgroundColor: appTheme.colors.background }}>
            <ScreenHeader title={`Đơn hàng #${order.id}`} showBack />

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{
                    paddingHorizontal: appTheme.spacing.screenX,
                    paddingTop: 16,
                    paddingBottom: 100,
                    gap: 14,
                }}
            >
                {/* ── Order summary ── */}
                <YStack
                    borderRadius={appTheme.radius.lg} borderWidth={1}
                    borderColor={appTheme.colors.border}
                    backgroundColor={appTheme.colors.surface}
                    overflow="hidden"
                >
                    <XStack paddingHorizontal={16} paddingVertical={11} backgroundColor={appTheme.colors.surfaceSoft}>
                        <Text fontSize={12} fontWeight="900" color={appTheme.colors.textMuted}>THÔNG TIN ĐƠN HÀNG</Text>
                    </XStack>

                    <YStack padding={16} gap={10}>
                        {/* Cargo name */}
                        <XStack alignItems="center" gap={10}>
                            <Package size={18} color={appTheme.colors.primary} />
                            <Text fontSize={16} fontWeight="900" color={appTheme.colors.text} flex={1}>
                                {order.cargo_name ?? 'Hàng hóa'}
                            </Text>
                        </XStack>

                        {/* Stats row */}
                        <XStack justifyContent="space-between" paddingTop={4}>
                            <YStack alignItems="center" flex={1} gap={3}>
                                <XStack alignItems="center" gap={5}>
                                    <Layers size={14} color={appTheme.colors.primary} />
                                    <Text fontSize={20} fontWeight="900" color={appTheme.colors.primary}>
                                        {order.total_legs}
                                    </Text>
                                </XStack>
                                <Text fontSize={11} color={appTheme.colors.textMuted}>Chuyến</Text>
                            </YStack>
                            <View style={{ width: 1, backgroundColor: appTheme.colors.border }} />
                            <YStack alignItems="center" flex={1} gap={3}>
                                <Text fontSize={14} fontWeight="900" color={appTheme.colors.text} numberOfLines={1} adjustsFontSizeToFit>
                                    {totalWeight ?? '—'}
                                </Text>
                                <Text fontSize={11} color={appTheme.colors.textMuted}>Tổng trọng lượng</Text>
                            </YStack>
                            <View style={{ width: 1, backgroundColor: appTheme.colors.border }} />
                            <YStack alignItems="center" flex={1} gap={3}>
                                <Text fontSize={13} fontWeight="900" color={appTheme.colors.text} numberOfLines={1} adjustsFontSizeToFit>
                                    {totalPrice ?? '—'}
                                </Text>
                                <Text fontSize={11} color={appTheme.colors.textMuted}>Tổng giá trị</Text>
                            </YStack>
                        </XStack>

                        {/* Payment type */}
                        {order.payment_type ? (
                            <XStack padding={10} borderRadius={10}
                                backgroundColor={appTheme.colors.surfaceSoft}
                                borderWidth={1} borderColor={appTheme.colors.border}
                                alignItems="center" justifyContent="space-between"
                            >
                                <Text fontSize={12} color={appTheme.colors.textMuted}>Thanh toán</Text>
                                <Text fontSize={12} fontWeight="800" color={appTheme.colors.text}>{order.payment_type}</Text>
                            </XStack>
                        ) : null}

                        {/* Notes */}
                        {order.notes ? (
                            <XStack padding={10} borderRadius={10}
                                backgroundColor={appTheme.colors.surfaceSoft}
                                borderWidth={1} borderColor={appTheme.colors.border}>
                                <Text fontSize={12} color={appTheme.colors.textMuted} flex={1}>{order.notes}</Text>
                            </XStack>
                        ) : null}
                    </YStack>
                </YStack>

                {/* ── Section title ── */}
                <Text fontSize={12} fontWeight="900" color={appTheme.colors.textMuted}>
                    CÁC CHUYẾN VẬN CHUYỂN ({shipments.length})
                </Text>

                {/* ── Leg cards ── */}
                {shipments.map((leg) => (
                    <LegCard key={leg.id} leg={leg} total={shipments.length} />
                ))}
            </ScrollView>

            {/* ── Sticky claim button ── */}
            <View style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                paddingHorizontal: appTheme.spacing.screenX,
                paddingBottom: appTheme.spacing.screenBottom,
                paddingTop: 12,
                backgroundColor: appTheme.colors.surface,
                borderTopWidth: 1,
                borderTopColor: appTheme.colors.border,
            }}>
                {hasActiveTrip ? (
                    <YStack gap={6}>
                        <LifecycleActionButton
                            label="Đang có đơn hàng khác"
                            tone="secondary"
                            onPress={() => {}}
                            disabled
                        />
                        <Text fontSize={11} color={appTheme.colors.textMuted} textAlign="center">
                            Hoàn thành đơn hiện tại trước khi nhận đơn mới
                        </Text>
                    </YStack>
                ) : (
                    <LifecycleActionButton
                        label={isClaiming ? 'Đang nhận...' : 'Nhận đơn hàng'}
                        tone="primary"
                        onPress={handleClaim}
                        isLoading={isClaiming}
                    />
                )}
            </View>
        </View>
    );
}
