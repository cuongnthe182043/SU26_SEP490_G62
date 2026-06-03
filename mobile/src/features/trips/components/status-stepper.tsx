import { View } from 'react-native';
import { CheckCircle } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';

import { appTheme } from '@/theme/app-theme';
import type { TripStatus } from '@/types/trip';

// ─── Constants (exported for use in active-trip-screen) ──────────────────────

const MAIN_FLOW: TripStatus[]      = ['claimed', 'picking', 'loaded', 'transit', 'arrived', 'completed'];
const RETURN_FLOW: TripStatus[]    = ['failed', 'returning', 'completed'];
const CANCELLED_FLOW: TripStatus[] = ['claimed', 'picking', 'loaded', 'transit', 'arrived', 'cancelled'];

export const STATUS_ACCENT: Partial<Record<TripStatus, { bg: string; text: string; border: string }>> = {
    claimed:   { bg: appTheme.colors.primarySoft,  text: appTheme.colors.primary,     border: appTheme.colors.primaryMuted },
    picking:   { bg: appTheme.colors.warningSoft,  text: appTheme.colors.warningText, border: appTheme.colors.warningBorder },
    loaded:    { bg: appTheme.colors.warningSoft,  text: appTheme.colors.warningText, border: appTheme.colors.warningBorder },
    transit:   { bg: appTheme.colors.primarySoft,  text: appTheme.colors.primary,     border: appTheme.colors.primaryMuted },
    arrived:   { bg: appTheme.colors.successSoft,  text: appTheme.colors.success,     border: '#a7f3d0' },
    completed: { bg: appTheme.colors.successSoft,  text: appTheme.colors.success,     border: '#a7f3d0' },
    failed:    { bg: '#fee2e2',                    text: appTheme.colors.danger,      border: '#fca5a5' },
    returning: { bg: appTheme.colors.surfaceSoft,  text: appTheme.colors.textMuted,   border: appTheme.colors.border },
    cancelled: { bg: '#f3f4f6',                    text: appTheme.colors.textMuted,   border: appTheme.colors.border },
};

export const STATUS_BANNER: Partial<Record<TripStatus, { icon: React.ReactNode; text: string }>> = {
    claimed:   { icon: <CheckCircle size={14} color={appTheme.colors.primary} />,     text: 'Di chuyển đến điểm lấy hàng' },
    picking:   { icon: <CheckCircle size={14} color={appTheme.colors.warningText} />, text: 'Đang bốc xếp hàng lên xe' },
    loaded:    { icon: <CheckCircle size={14} color={appTheme.colors.warningText} />, text: 'Hàng đã lên xe — sẵn sàng khởi hành' },
    transit:   { icon: <CheckCircle size={14} color={appTheme.colors.primary} />,     text: 'Đang vận chuyển đến điểm giao' },
    arrived:   { icon: <CheckCircle size={14} color={appTheme.colors.success} />,     text: 'Đã đến — chụp ảnh biên lai rồi hoàn thành' },
    failed:    { icon: <CheckCircle size={14} color={appTheme.colors.danger} />,      text: 'Giao hàng thất bại — bắt đầu hoàn hàng về' },
    returning: { icon: <CheckCircle size={14} color={appTheme.colors.textMuted} />,   text: 'Đang hoàn hàng về điểm lấy hàng ban đầu' },
};

const STEP_LABEL: Partial<Record<TripStatus, string>> = {
    claimed: 'Đã nhận', picking: 'Lấy hàng', loaded: 'Đã chất',
    transit: 'Vận chuyển', arrived: 'Đã đến', completed: 'Hoàn thành',
    failed: 'Thất bại', returning: 'Hoàn hàng', cancelled: 'Đã hủy',
};

// ─── Component ────────────────────────────────────────────────────────────────

type Props = { status: TripStatus };

export function StatusStepper({ status }: Props) {
    const isCancelled = status === 'cancelled';
    const isReturn    = status === 'failed' || status === 'returning';
    const flow        = isCancelled ? CANCELLED_FLOW : isReturn ? RETURN_FLOW : MAIN_FLOW;
    const curIdx      = flow.indexOf(status);

    return (
        <XStack alignItems="center">
            {flow.map((s, i) => {
                const isPast    = i < curIdx;
                const isCurrent = i === curIdx;
                const isLast    = i === flow.length - 1;
                const dotColor  = isPast
                    ? appTheme.colors.success
                    : isCurrent
                        ? (STATUS_ACCENT[s]?.text ?? appTheme.colors.primary)
                        : appTheme.colors.border;

                return (
                    <XStack key={s} flex={isLast ? 0 : 1} alignItems="center">
                        <YStack alignItems="center" gap={4}>
                            <View style={{
                                width: isCurrent ? 26 : 18, height: isCurrent ? 26 : 18,
                                borderRadius: 8,
                                backgroundColor: isPast
                                    ? appTheme.colors.success
                                    : isCurrent ? dotColor : appTheme.colors.surfaceSoft,
                                borderWidth: 1.5, borderColor: dotColor,
                                alignItems: 'center', justifyContent: 'center',
                            }}>
                                {isPast
                                    ? <CheckCircle size={11} color="#fff" />
                                    : isCurrent
                                        ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />
                                        : null}
                            </View>
                            <Text
                                fontSize={9}
                                fontWeight={isCurrent ? '900' : '600'}
                                color={isPast ? appTheme.colors.success : isCurrent ? dotColor : appTheme.colors.textMuted}
                                style={{ width: 54, textAlign: 'center' }}
                                numberOfLines={1}
                            >
                                {STEP_LABEL[s]}
                            </Text>
                        </YStack>
                        {!isLast ? (
                            <View style={{
                                flex: 1, height: 2, marginBottom: 16,
                                backgroundColor: isPast ? appTheme.colors.success : appTheme.colors.border,
                            }} />
                        ) : null}
                    </XStack>
                );
            })}
        </XStack>
    );
}
