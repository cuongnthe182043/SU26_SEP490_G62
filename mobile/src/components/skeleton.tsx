

import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import type { DimensionValue, ViewStyle } from 'react-native';
import { XStack, YStack } from 'tamagui';
import { appTheme } from '@/theme/app-theme';


const shimmerAnim = new Animated.Value(0);
let _shimmerStarted = false;

function ensureShimmer() {
    if (_shimmerStarted) return;
    _shimmerStarted = true;
    Animated.loop(
        Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 1100,
            easing: Easing.linear,
            useNativeDriver: true,
        }),
    ).start();
}


type BoxProps = {
    height: number;
    width?: DimensionValue;
    borderRadius?: number;
    style?: ViewStyle;
};

export function SkeletonBox({ height, width = '100%', borderRadius = 8, style }: BoxProps) {
    const [w, setW] = useState(0);

    useEffect(() => { ensureShimmer(); }, []);

    const translateX = shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-Math.max(w, 1), Math.max(w, 1)],
    });

    return (
        <View
            onLayout={e => setW(e.nativeEvent.layout.width)}
            style={[{ height, borderRadius, backgroundColor: '#E8EDF2', overflow: 'hidden', width }, style]}
        >
            {w > 0 && (
                <Animated.View
                    style={[
                        StyleSheet.absoluteFill,
                        {
                            width: '55%',
                            backgroundColor: 'rgba(255,255,255,0.58)',
                            transform: [{ translateX }, { skewX: '-20deg' }],
                        },
                    ]}
                />
            )}
        </View>
    );
}

// ─── SkeletonLine — convenience short alias ────────────────────────────────────

export function SkeletonLine({ width = '100%', height = 14, borderRadius = 6 }: {
    width?: DimensionValue;
    height?: number;
    borderRadius?: number;
}) {
    return <SkeletonBox height={height} width={width} borderRadius={borderRadius} />;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

const GAP = 8;  // default gap between skeleton rows

function SkelRow({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
    return (
        <View style={[{ flexDirection: 'row', alignItems: 'center', gap: GAP }, style]}>
            {children}
        </View>
    );
}

// ─── TripCardSkeleton — matches TripCard in the pool ─────────────────────────

export function TripCardSkeleton() {
    return (
        <YStack
            borderRadius={appTheme.radius.lg}
            borderWidth={1}
            borderColor={appTheme.colors.border}
            backgroundColor={appTheme.colors.surface}
            overflow="hidden"
            marginBottom={12}
        >
            {/* Header */}
            <XStack
                paddingHorizontal={14} paddingVertical={12}
                backgroundColor={appTheme.colors.surfaceSoft}
                alignItems="center" justifyContent="space-between"
            >
                <SkeletonLine width={90} height={13} />
                <SkeletonLine width={52} height={20} borderRadius={10} />
            </XStack>

            {/* Body */}
            <YStack padding={14} gap={10}>
                {/* Pickup */}
                <SkelRow>
                    <SkeletonBox width={10} height={10} borderRadius={5} />
                    <SkeletonLine width="80%" height={12} />
                </SkelRow>
                {/* Divider line */}
                <View style={{ width: 1.5, height: 10, backgroundColor: appTheme.colors.border, marginLeft: 4 }} />
                {/* Delivery */}
                <SkelRow>
                    <SkeletonBox width={10} height={10} borderRadius={3} />
                    <SkeletonLine width="65%" height={12} />
                </SkelRow>

                {/* Meta row */}
                <SkelRow style={{ marginTop: 4 }}>
                    <SkeletonLine width={70} height={11} />
                    <SkeletonLine width={80} height={11} />
                    <SkeletonLine width={90} height={11} />
                </SkelRow>

                {/* Claim button */}
                <SkeletonBox height={44} borderRadius={appTheme.radius.md} style={{ marginTop: 2 }} />
            </YStack>
        </YStack>
    );
}

// ─── TripPoolSkeleton — 4 cards stacked ──────────────────────────────────────

export function TripPoolSkeleton() {
    return (
        <YStack gap={0}>
            <TripCardSkeleton />
            <TripCardSkeleton />
            <TripCardSkeleton />
            <TripCardSkeleton />
        </YStack>
    );
}

// ─── OrderCardSkeleton — matches OrderCard in history ────────────────────────

export function OrderCardSkeleton() {
    return (
        <YStack
            borderRadius={appTheme.radius.lg}
            borderWidth={1}
            borderColor={appTheme.colors.border}
            backgroundColor={appTheme.colors.surface}
            overflow="hidden"
            marginBottom={10}
        >
            {/* Header */}
            <XStack
                paddingHorizontal={14} paddingVertical={11}
                backgroundColor={appTheme.colors.surfaceSoft}
                alignItems="center" justifyContent="space-between"
            >
                <SkelRow>
                    <SkeletonLine width={80} height={13} />
                    <SkeletonLine width={55} height={20} borderRadius={10} />
                </SkelRow>
                <SkelRow>
                    <SkeletonLine width={48} height={20} borderRadius={8} />
                    <SkeletonBox width={16} height={16} borderRadius={4} />
                </SkelRow>
            </XStack>

            {/* Body */}
            <YStack paddingHorizontal={14} paddingVertical={12} gap={10}>
                {/* Cargo */}
                <SkelRow>
                    <SkeletonBox width={14} height={14} borderRadius={4} />
                    <SkeletonLine width="60%" height={13} />
                </SkelRow>

                {/* Route */}
                <YStack gap={4}>
                    <SkelRow>
                        <SkeletonBox width={8} height={8} borderRadius={4} />
                        <SkeletonLine width="75%" height={12} />
                    </SkelRow>
                    <View style={{ width: 1.5, height: 10, backgroundColor: appTheme.colors.border, marginLeft: 3 }} />
                    <SkelRow>
                        <SkeletonBox width={8} height={8} borderRadius={2} />
                        <SkeletonLine width="60%" height={12} />
                    </SkelRow>
                </YStack>

                {/* Footer */}
                <SkelRow style={{ justifyContent: 'space-between' }}>
                    <SkeletonLine width={90} height={11} />
                    <SkeletonLine width={80} height={11} />
                </SkelRow>
            </YStack>
        </YStack>
    );
}

// ─── HistorySkeleton — 5 order cards ─────────────────────────────────────────

export function HistorySkeleton() {
    return (
        <YStack>
            {[0, 1, 2, 3, 4].map(i => <OrderCardSkeleton key={i} />)}
        </YStack>
    );
}

// ─── ActiveTripBannerSkeleton — matches the blue trip card on home ────────────

export function ActiveTripBannerSkeleton() {
    return (
        <YStack
            padding={20}
            borderRadius={appTheme.radius.xl}
            backgroundColor={appTheme.colors.surfaceSoft}
            borderWidth={1}
            borderColor={appTheme.colors.border}
            gap={14}
        >
            {/* Header row */}
            <SkelRow style={{ justifyContent: 'space-between' }}>
                <SkelRow>
                    <SkeletonBox width={48} height={48} borderRadius={18} />
                    <YStack gap={6}>
                        <SkeletonLine width={120} height={11} />
                        <SkeletonLine width={160} height={18} />
                    </YStack>
                </SkelRow>
                <SkeletonLine width={60} height={22} borderRadius={10} />
            </SkelRow>

            {/* Route row */}
            <SkelRow>
                <YStack flex={1} gap={5}>
                    <SkeletonLine width={50} height={10} />
                    <SkeletonLine width="90%" height={13} />
                </YStack>
                <YStack flex={1} gap={5}>
                    <SkeletonLine width={50} height={10} />
                    <SkeletonLine width="90%" height={13} />
                </YStack>
            </SkelRow>

            {/* Button */}
            <SkeletonBox height={42} borderRadius={appTheme.radius.md} />
        </YStack>
    );
}

// ─── StatRowSkeleton — 3 stat cards side by side ─────────────────────────────

export function StatRowSkeleton() {
    return (
        <XStack gap={12}>
            {[0, 1, 2].map(i => (
                <YStack
                    key={i}
                    flex={1}
                    padding={14}
                    borderRadius={appTheme.radius.md}
                    borderWidth={1}
                    borderColor={appTheme.colors.border}
                    backgroundColor={appTheme.colors.surface}
                    gap={8}
                >
                    <SkeletonLine width="70%" height={22} />
                    <SkeletonLine width="90%" height={11} />
                </YStack>
            ))}
        </XStack>
    );
}

// ─── SectionCardSkeleton — generic labeled section card ──────────────────────

function SectionCardSkeleton({ rows = 3 }: { rows?: number }) {
    return (
        <YStack
            borderRadius={appTheme.radius.lg}
            borderWidth={1}
            borderColor={appTheme.colors.border}
            backgroundColor={appTheme.colors.surface}
            overflow="hidden"
        >
            {/* Header */}
            <XStack paddingHorizontal={16} paddingVertical={11} backgroundColor={appTheme.colors.surfaceSoft}>
                <SkeletonLine width={90} height={11} />
            </XStack>
            <YStack padding={16} gap={12}>
                {Array.from({ length: rows }).map((_, i) => (
                    <SkelRow key={i} style={{ justifyContent: 'space-between' }}>
                        <SkeletonLine width="35%" height={13} />
                        <SkeletonLine width="45%" height={13} />
                    </SkelRow>
                ))}
            </YStack>
        </YStack>
    );
}

// ─── ActiveTripSkeleton — full active trip screen ────────────────────────────

export function ActiveTripSkeleton() {
    return (
        <YStack
            flex={1}
            paddingHorizontal={appTheme.spacing.screenX}
            paddingTop={16}
            gap={14}
        >
            {/* Status stepper */}
            <YStack
                padding={16}
                borderRadius={appTheme.radius.lg}
                borderWidth={1}
                borderColor={appTheme.colors.border}
                backgroundColor={appTheme.colors.surfaceSoft}
                gap={14}
            >
                <SkelRow style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    {[0, 1, 2, 3, 4, 5].map(i => (
                        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', flex: i < 5 ? 1 : 0 }}>
                            <SkeletonBox width={22} height={22} borderRadius={8} />
                            {i < 5 && <View style={{ flex: 1, height: 2, backgroundColor: appTheme.colors.border, marginHorizontal: 2 }} />}
                        </View>
                    ))}
                </SkelRow>
                <SkelRow style={{ justifyContent: 'center' }}>
                    <SkeletonLine width={180} height={12} />
                </SkelRow>
            </YStack>

            {/* Leg info line */}
            <SkeletonLine width={160} height={12} />

            {/* Route card */}
            <YStack
                borderRadius={appTheme.radius.lg}
                borderWidth={1}
                borderColor={appTheme.colors.border}
                backgroundColor={appTheme.colors.surface}
                overflow="hidden"
            >
                <XStack paddingHorizontal={16} paddingVertical={11} backgroundColor={appTheme.colors.surfaceSoft}>
                    <SkeletonLine width={80} height={11} />
                </XStack>
                <YStack padding={16} gap={10}>
                    <SkelRow>
                        <SkeletonBox width={28} height={28} borderRadius={10} />
                        <YStack flex={1} gap={4}>
                            <SkeletonLine width={50} height={10} />
                            <SkeletonLine width="85%" height={13} />
                        </YStack>
                    </SkelRow>
                    <View style={{ height: 1, backgroundColor: appTheme.colors.border, marginLeft: 36 }} />
                    <SkelRow>
                        <SkeletonBox width={28} height={28} borderRadius={10} />
                        <YStack flex={1} gap={4}>
                            <SkeletonLine width={50} height={10} />
                            <SkeletonLine width="70%" height={13} />
                        </YStack>
                    </SkelRow>
                </YStack>
            </YStack>

            {/* Cargo card */}
            <SectionCardSkeleton rows={3} />

            {/* Expenses card */}
            <SectionCardSkeleton rows={2} />

            {/* Action button */}
            <SkeletonBox height={50} borderRadius={appTheme.radius.md} />
        </YStack>
    );
}

// ─── ProfileSkeleton — profile tab ───────────────────────────────────────────

export function ProfileSkeleton() {
    return (
        <YStack>
            {/* Avatar section */}
            <YStack alignItems="center" paddingVertical={28} gap={12}>
                <SkeletonBox width={80} height={80} borderRadius={28} />
                <YStack alignItems="center" gap={8}>
                    <SkeletonLine width={140} height={16} />
                    <SkeletonLine width={180} height={12} />
                    <SkeletonLine width={60} height={22} borderRadius={appTheme.radius.pill} style={{ marginTop: 4 }} />
                </YStack>
            </YStack>

            {/* Menu section 1 */}
            <YStack
                marginHorizontal={appTheme.spacing.screenX}
                borderRadius={appTheme.radius.lg}
                borderWidth={1}
                borderColor={appTheme.colors.border}
                overflow="hidden"
                marginBottom={14}
            >
                <XStack paddingHorizontal={16} paddingVertical={10} backgroundColor={appTheme.colors.surfaceSoft}>
                    <SkeletonLine width={80} height={11} />
                </XStack>
                {[0, 1].map(i => (
                    <View key={i}>
                        <XStack paddingHorizontal={16} paddingVertical={16} alignItems="center" gap={12}>
                            <SkeletonBox width={36} height={36} borderRadius={12} />
                            <SkeletonLine width="50%" height={14} />
                            <View style={{ flex: 1 }} />
                            <SkeletonBox width={16} height={16} borderRadius={4} />
                        </XStack>
                        {i === 0 && <View style={{ height: 1, backgroundColor: appTheme.colors.border, marginLeft: 64 }} />}
                    </View>
                ))}
            </YStack>

            {/* Menu section 2 */}
            <YStack
                marginHorizontal={appTheme.spacing.screenX}
                borderRadius={appTheme.radius.lg}
                borderWidth={1}
                borderColor={appTheme.colors.border}
                overflow="hidden"
                marginBottom={14}
            >
                <XStack paddingHorizontal={16} paddingVertical={10} backgroundColor={appTheme.colors.surfaceSoft}>
                    <SkeletonLine width={70} height={11} />
                </XStack>
                <XStack paddingHorizontal={16} paddingVertical={16} alignItems="center" gap={12}>
                    <SkeletonBox width={36} height={36} borderRadius={12} />
                    <SkeletonLine width="40%" height={14} />
                    <View style={{ flex: 1 }} />
                    <SkeletonBox width={16} height={16} borderRadius={4} />
                </XStack>
            </YStack>
        </YStack>
    );
}

// ─── OrderDetailSkeleton — order/[id] screen ─────────────────────────────────

function ShipmentCardSkeleton() {
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
                justifyContent="space-between" alignItems="center"
            >
                <SkeletonLine width={80} height={13} />
                <SkelRow>
                    <SkeletonLine width={32} height={18} borderRadius={6} />
                    <SkeletonLine width={55} height={18} borderRadius={10} />
                </SkelRow>
            </XStack>

            <YStack padding={14} gap={12}>
                {/* Route */}
                <SkelRow>
                    <SkeletonBox width={28} height={28} borderRadius={10} />
                    <YStack flex={1} gap={4}>
                        <SkeletonLine width={40} height={10} />
                        <SkeletonLine width="80%" height={13} />
                    </YStack>
                </SkelRow>
                <View style={{ height: 1, backgroundColor: appTheme.colors.border, marginLeft: 36 }} />
                <SkelRow>
                    <SkeletonBox width={28} height={28} borderRadius={10} />
                    <YStack flex={1} gap={4}>
                        <SkeletonLine width={40} height={10} />
                        <SkeletonLine width="65%" height={13} />
                    </YStack>
                </SkelRow>

                {/* Meta */}
                <SkelRow style={{ marginTop: 4 }}>
                    <SkeletonLine width={90} height={12} />
                    <SkeletonLine width={80} height={12} />
                </SkelRow>

                {/* Timeline bar */}
                <SkelRow style={{ justifyContent: 'space-between', marginTop: 4 }}>
                    {[0, 1, 2, 3].map(i => (
                        <YStack key={i} alignItems="center" gap={4}>
                            <SkeletonBox width={22} height={22} borderRadius={8} />
                            <SkeletonLine width={40} height={9} />
                        </YStack>
                    ))}
                </SkelRow>
            </YStack>
        </YStack>
    );
}

export function OrderDetailSkeleton() {
    return (
        <YStack
            paddingHorizontal={appTheme.spacing.screenX}
            paddingTop={16}
            gap={14}
        >
            {/* Order summary card */}
            <YStack
                borderRadius={appTheme.radius.lg}
                borderWidth={1}
                borderColor={appTheme.colors.border}
                backgroundColor={appTheme.colors.surface}
                overflow="hidden"
            >
                <XStack paddingHorizontal={14} paddingVertical={10} backgroundColor={appTheme.colors.surfaceSoft}>
                    <SkeletonLine width={80} height={11} />
                </XStack>
                <YStack padding={14} gap={12}>
                    <SkeletonLine width="60%" height={20} />
                    <SkelRow style={{ justifyContent: 'space-around' }}>
                        {[0, 1, 2].map(i => (
                            <YStack key={i} alignItems="center" gap={5}>
                                <SkeletonLine width={50} height={18} />
                                <SkeletonLine width={60} height={11} />
                            </YStack>
                        ))}
                    </SkelRow>
                </YStack>
            </YStack>

            {/* Shipment cards */}
            <ShipmentCardSkeleton />
            <ShipmentCardSkeleton />
        </YStack>
    );
}

// ─── PoolOrderDetailSkeleton — pool-order/[id] screen ────────────────────────

export function PoolOrderDetailSkeleton() {
    return (
        <YStack
            paddingHorizontal={appTheme.spacing.screenX}
            paddingTop={16}
            gap={14}
        >
            {/* Order summary */}
            <YStack
                borderRadius={appTheme.radius.lg}
                borderWidth={1}
                borderColor={appTheme.colors.border}
                backgroundColor={appTheme.colors.surface}
                overflow="hidden"
            >
                <XStack paddingHorizontal={14} paddingVertical={10} backgroundColor={appTheme.colors.surfaceSoft}>
                    <SkeletonLine width={80} height={11} />
                </XStack>
                <YStack padding={14} gap={12}>
                    <SkeletonLine width="55%" height={20} />
                    <SkelRow style={{ justifyContent: 'space-around' }}>
                        {[0, 1, 2].map(i => (
                            <YStack key={i} alignItems="center" gap={5}>
                                <SkeletonLine width={50} height={18} />
                                <SkeletonLine width={60} height={11} />
                            </YStack>
                        ))}
                    </SkelRow>
                    <SkeletonLine width="40%" height={12} />
                </YStack>
            </YStack>

            {/* Leg cards */}
            {[0, 1].map(i => (
                <YStack
                    key={i}
                    borderRadius={appTheme.radius.lg}
                    borderWidth={1}
                    borderColor={appTheme.colors.border}
                    backgroundColor={appTheme.colors.surface}
                    overflow="hidden"
                >
                    <XStack
                        paddingHorizontal={14} paddingVertical={10}
                        backgroundColor={appTheme.colors.surfaceSoft}
                        justifyContent="space-between" alignItems="center"
                    >
                        <SkeletonLine width={80} height={13} />
                        <SkelRow>
                            <SkeletonLine width={32} height={18} borderRadius={6} />
                        </SkelRow>
                    </XStack>
                    <YStack padding={14} gap={10}>
                        <SkelRow>
                            <SkeletonBox width={28} height={28} borderRadius={10} />
                            <YStack flex={1} gap={4}>
                                <SkeletonLine width={40} height={10} />
                                <SkeletonLine width="80%" height={13} />
                            </YStack>
                        </SkelRow>
                        <View style={{ height: 1, backgroundColor: appTheme.colors.border, marginLeft: 36 }} />
                        <SkelRow>
                            <SkeletonBox width={28} height={28} borderRadius={10} />
                            <YStack flex={1} gap={4}>
                                <SkeletonLine width={40} height={10} />
                                <SkeletonLine width="65%" height={13} />
                            </YStack>
                        </SkelRow>
                        <SkelRow style={{ marginTop: 4 }}>
                            <SkeletonLine width={80} height={12} />
                            <SkeletonLine width={90} height={12} />
                        </SkelRow>
                    </YStack>
                </YStack>
            ))}

            {/* Bottom padding for sticky claim button */}
            <View style={{ height: 20 }} />
        </YStack>
    );
}
