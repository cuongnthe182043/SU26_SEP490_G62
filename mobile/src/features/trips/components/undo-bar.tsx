import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Undo2 } from 'lucide-react-native';
import { XStack, YStack } from 'tamagui';

import { AppText }  from '@/components/app-text';
import { appTheme } from '@/theme/app-theme';
import type { ActiveTrip } from '@/types/trip';

/**
 * Thanh "Hoàn tác" cho bước vừa bấm.
 *
 * Chỉ hiện khi SERVER nói là được (trip.can_undo) và còn hạn (trip.undo_expires_at).
 * App không tự tính cửa sổ: máy tài xế lệch giờ là chuyện thường, mà tự cộng 90 giây
 * vào đồng hồ máy thì lệch bao nhiêu sai bấy nhiêu — nút hiện lúc đã hết hạn (bấm vào
 * báo lỗi) hoặc biến mất lúc còn hạn. Mốc hết hạn do server chốt, app chỉ trừ ra số
 * giây còn lại nên chỉ phụ thuộc vào TỐC ĐỘ đồng hồ máy, không phụ thuộc nó chỉnh đúng.
 */
export function UndoBar({ trip, onUndo, isWorking }: {
    trip: ActiveTrip;
    onUndo: () => void;
    isWorking?: boolean;
}) {
    const expiresAt = trip.undo_expires_at ? new Date(trip.undo_expires_at).getTime() : null;
    const [conLai, setConLai] = useState(() =>
        expiresAt ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)) : 0);

    useEffect(() => {
        if (!expiresAt) return;
        setConLai(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
        const t = setInterval(() => {
            setConLai(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
        }, 1000);
        return () => clearInterval(t);
    }, [expiresAt]);

    if (!trip.can_undo || !expiresAt || conLai <= 0) return null;

    return (
        <YStack style={s.wrap}>
            <XStack alignItems="center" gap={10}>
                <YStack flex={1} gap={2}>
                    <AppText style={s.title}>Vừa bấm nhầm?</AppText>
                    <AppText style={s.hint}>
                        Còn {conLai} giây để quay lại bước trước
                    </AppText>
                </YStack>
                <Pressable
                    style={[s.btn, isWorking && s.btnMo]}
                    onPress={onUndo}
                    disabled={isWorking}
                    // Vùng bấm rộng hơn nút một chút: đây là nút để SỬA một cú bấm nhầm,
                    // bắt bấm chính xác nữa thì hỏng mục đích.
                    hitSlop={10}
                >
                    <Undo2 size={16} color={appTheme.colors.warningText} />
                    <AppText style={s.btnChu}>
                        {isWorking ? 'Đang lùi...' : 'Hoàn tác'}
                    </AppText>
                </Pressable>
            </XStack>
        </YStack>
    );
}

const s = StyleSheet.create({
    wrap: {
        borderRadius: appTheme.radius.lg,
        borderWidth: 1.5,
        borderColor: appTheme.colors.warningBorder,
        backgroundColor: appTheme.colors.warningSoft,
        padding: 12,
    },
    title: { fontSize: 14, fontWeight: '700', color: appTheme.colors.warningText },
    hint:  { fontSize: 12, color: appTheme.colors.textMuted },
    btn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingVertical: 9, paddingHorizontal: 14,
        borderRadius: 12, borderWidth: 1.5,
        borderColor: appTheme.colors.warningBorder,
        backgroundColor: appTheme.colors.surface,
    },
    btnMo: { opacity: 0.5 },
    btnChu: { fontSize: 13, fontWeight: '700', color: appTheme.colors.warningText },
});
