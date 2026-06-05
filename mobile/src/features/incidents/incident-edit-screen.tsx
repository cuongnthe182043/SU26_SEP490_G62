import { useCallback, useState } from 'react';
import {
    ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
    Pressable, ScrollView, StyleSheet, TextInput, View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { AlertTriangle, MapPin } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';

import { AppButton } from '@/components/app-button';
import { AppText }   from '@/components/app-text';
import { ScreenHeader } from '@/components/screen-header';
import { appTheme } from '@/theme/app-theme';
import { useUpdateIncident } from '@/hooks/use-update-incident';
import { useToast } from '@/providers/ui-provider';
import { incidentService } from '@/services/incident-service';
import { INCIDENT_SEVERITY_LABEL, INCIDENT_TYPE_LABEL } from '@/types/incident';
import type { Incident, IncidentSeverity } from '@/types/incident';

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVERITIES: IncidentSeverity[] = ['low', 'medium', 'high', 'critical'];

const SEVERITY_COLOR: Record<IncidentSeverity, string> = {
    low:      appTheme.colors.success,
    medium:   appTheme.colors.warning,
    high:     appTheme.colors.danger,
    critical: '#7C3AED',
};

// ─── Main screen ──────────────────────────────────────────────────────────────

export function IncidentEditScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const incidentId = Number(id);
    const { showToast } = useToast();

    const [incident,          setIncident]          = useState<Incident | null>(null);
    const [isLoadingDetail,   setIsLoadingDetail]   = useState(true);
    const [loadError,         setLoadError]         = useState<string | null>(null);

    // Editable fields
    const [severity,          setSeverity]          = useState<IncidentSeverity>('medium');
    const [description,       setDescription]       = useState('');
    const [location,          setLocation]          = useState('');
    const [isGettingLocation, setIsGettingLocation] = useState(false);

    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const { isSubmitting, error, update, clearError } = useUpdateIncident((updated) => {
        showToast({ type: 'success', message: 'Đã cập nhật sự cố thành công.' });
        router.back();
    });

    const load = useCallback(async () => {
        if (!incidentId) return;
        setIsLoadingDetail(true);
        setLoadError(null);
        try {
            const { incident: data } = await incidentService.getIncidentDetail(incidentId);
            setIncident(data);
            setSeverity(data.severity_level);
            setDescription(data.description);
            setLocation(data.location ?? '');
        } catch (err) {
            setLoadError(err instanceof Error ? err.message : 'Không thể tải sự cố');
        } finally {
            setIsLoadingDetail(false);
        }
    }, [incidentId]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    // ── GPS location ──
    const handleGetLocation = async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Cần quyền vị trí', 'Vui lòng cấp quyền vị trí trong cài đặt.');
            return;
        }
        setIsGettingLocation(true);
        try {
            const loc = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            const [geocode] = await Location.reverseGeocodeAsync(loc.coords).catch(() => [null]);
            if (geocode) {
                const parts = [geocode.street, geocode.district, geocode.city].filter(Boolean);
                setLocation(parts.join(', ') || `${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)}`);
            } else {
                setLocation(`${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)}`);
            }
        } catch {
            Alert.alert('Lỗi', 'Không thể lấy vị trí. Vui lòng nhập thủ công.');
        } finally {
            setIsGettingLocation(false);
        }
    };

    // ── Validation ──
    const validate = (): boolean => {
        const errors: Record<string, string> = {};
        if (!description.trim()) {
            errors.description = 'Mô tả sự cố là bắt buộc';
        } else if (description.trim().length < 10) {
            errors.description = 'Mô tả phải có ít nhất 10 ký tự';
        }
        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // ── Submit ──
    const handleSave = async () => {
        if (!validate()) return;
        await update(incidentId, {
            severityLevel: severity,
            description:   description.trim(),
            location:      location.trim() || null,
        });
    };

    // ── Loading state ──
    if (isLoadingDetail) {
        return (
            <View style={{ flex: 1, backgroundColor: appTheme.colors.background }}>
                <StatusBar style="dark" />
                <ScreenHeader title="Chỉnh sửa sự cố" showBack />
                <YStack flex={1} alignItems="center" justifyContent="center" gap={12}>
                    <ActivityIndicator color={appTheme.colors.primary} />
                    <AppText variant="caption" tone="muted">Đang tải...</AppText>
                </YStack>
            </View>
        );
    }

    if (loadError || !incident) {
        return (
            <View style={{ flex: 1, backgroundColor: appTheme.colors.background }}>
                <StatusBar style="dark" />
                <ScreenHeader title="Chỉnh sửa sự cố" showBack />
                <YStack flex={1} alignItems="center" justifyContent="center" padding={24} gap={12}>
                    <AlertTriangle size={32} color={appTheme.colors.danger} />
                    <AppText variant="bodyStrong" tone="danger">{loadError ?? 'Không thể tải sự cố'}</AppText>
                </YStack>
            </View>
        );
    }

    if (incident.status !== 'open') {
        return (
            <View style={{ flex: 1, backgroundColor: appTheme.colors.background }}>
                <StatusBar style="dark" />
                <ScreenHeader title="Chỉnh sửa sự cố" showBack />
                <YStack flex={1} alignItems="center" justifyContent="center" padding={24} gap={12}>
                    <AlertTriangle size={32} color={appTheme.colors.warning} />
                    <AppText variant="bodyStrong" tone="muted">Không thể chỉnh sửa</AppText>
                    <AppText variant="caption" tone="muted">
                        Sự cố đang ở trạng thái "{INCIDENT_SEVERITY_LABEL[incident.severity_level]}" và không thể thay đổi.
                    </AppText>
                </YStack>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: appTheme.colors.background }}>
            <StatusBar style="dark" />
            <ScreenHeader title="Chỉnh sửa sự cố" showBack />

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{
                        paddingHorizontal: appTheme.spacing.screenX,
                        paddingTop: 20,
                        paddingBottom: appTheme.spacing.screenBottom + 60,
                        gap: 22,
                    }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* ── Type (read-only) ── */}
                    <YStack
                        padding={14} borderRadius={14}
                        backgroundColor={appTheme.colors.surfaceSoft}
                        borderWidth={1} borderColor={appTheme.colors.border}
                        gap={4}
                    >
                        <Text fontSize={11} fontWeight="700" color={appTheme.colors.textMuted}>
                            LOẠI SỰ CỐ (KHÔNG THỂ THAY ĐỔI)
                        </Text>
                        <Text fontSize={15} fontWeight="900" color={appTheme.colors.text}>
                            {INCIDENT_TYPE_LABEL[incident.incident_type]}
                        </Text>
                        <Text fontSize={11} color={appTheme.colors.textMuted}>
                            Chuyến #{incident.shipment_id}
                        </Text>
                    </YStack>

                    {/* ── Severity ── */}
                    <YStack gap={8}>
                        <Text fontSize={12} fontWeight="700" color={appTheme.colors.textMuted}>
                            MỨC ĐỘ NGHIÊM TRỌNG
                        </Text>
                        <XStack gap={8}>
                            {SEVERITIES.map((sv) => {
                                const active = sv === severity;
                                const color  = SEVERITY_COLOR[sv];
                                return (
                                    <Pressable
                                        key={sv}
                                        onPress={() => { setSeverity(sv); clearError(); }}
                                        style={[
                                            s.severityPill,
                                            {
                                                flex: 1,
                                                backgroundColor: active ? color : appTheme.colors.surfaceSoft,
                                                borderColor: active ? color : appTheme.colors.border,
                                            },
                                        ]}
                                    >
                                        <Text
                                            fontSize={11}
                                            fontWeight="900"
                                            color={active ? '#fff' : appTheme.colors.textMuted}
                                            textAlign="center"
                                        >
                                            {INCIDENT_SEVERITY_LABEL[sv]}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </XStack>
                    </YStack>

                    {/* ── Description ── */}
                    <YStack gap={6}>
                        <XStack alignItems="center" gap={6}>
                            <Text fontSize={12} fontWeight="700" color={appTheme.colors.textMuted}>
                                MÔ TẢ SỰ CỐ
                            </Text>
                            <View style={s.requiredBadge}>
                                <Text fontSize={9} fontWeight="900" color={appTheme.colors.danger}>BẮT BUỘC</Text>
                            </View>
                        </XStack>
                        <TextInput
                            style={[
                                s.input,
                                s.multiline,
                                fieldErrors.description ? { borderColor: appTheme.colors.danger } : {},
                            ]}
                            value={description}
                            onChangeText={(t) => {
                                setDescription(t);
                                if (fieldErrors.description) setFieldErrors((e) => ({ ...e, description: '' }));
                                clearError();
                            }}
                            placeholder="Mô tả chi tiết sự cố (tối thiểu 10 ký tự)..."
                            placeholderTextColor={appTheme.colors.textMuted}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                            maxLength={500}
                        />
                        {fieldErrors.description ? (
                            <Text fontSize={11} color={appTheme.colors.danger}>{fieldErrors.description}</Text>
                        ) : (
                            <Text fontSize={11} color={appTheme.colors.textMuted} textAlign="right">
                                {description.length}/500
                            </Text>
                        )}
                    </YStack>

                    {/* ── Location with GPS ── */}
                    <YStack gap={6}>
                        <XStack alignItems="center" justifyContent="space-between">
                            <XStack alignItems="center" gap={6}>
                                <Text fontSize={12} fontWeight="700" color={appTheme.colors.textMuted}>
                                    VỊ TRÍ
                                </Text>
                                <View style={s.optionalBadge}>
                                    <Text fontSize={9} fontWeight="700" color={appTheme.colors.textMuted}>TUỲ CHỌN</Text>
                                </View>
                            </XStack>
                            <Pressable
                                onPress={handleGetLocation}
                                disabled={isGettingLocation}
                                style={s.gpsBtn}
                                hitSlop={8}
                            >
                                {isGettingLocation ? (
                                    <ActivityIndicator size={13} color={appTheme.colors.primary} />
                                ) : (
                                    <MapPin size={13} color={appTheme.colors.primary} />
                                )}
                                <Text fontSize={11} fontWeight="700" color={appTheme.colors.primary}>
                                    {isGettingLocation ? 'Đang lấy...' : 'Lấy vị trí'}
                                </Text>
                            </Pressable>
                        </XStack>
                        <TextInput
                            style={s.input}
                            value={location}
                            onChangeText={(t) => { setLocation(t); clearError(); }}
                            placeholder="Ví dụ: Đường Nguyễn Văn Linh, Q.7, TP.HCM"
                            placeholderTextColor={appTheme.colors.textMuted}
                            maxLength={200}
                        />
                    </YStack>

                    {/* ── API error ── */}
                    {error ? (
                        <XStack
                            padding={12} borderRadius={10}
                            backgroundColor={appTheme.colors.dangerSoft}
                            borderWidth={1} borderColor={appTheme.colors.dangerBorder}
                            gap={8} alignItems="center"
                        >
                            <AlertTriangle size={14} color={appTheme.colors.danger} />
                            <AppText variant="caption" tone="danger" flex={1}>{error}</AppText>
                        </XStack>
                    ) : null}

                    {/* ── Actions ── */}
                    <XStack gap={10}>
                        <Pressable style={[s.btn, s.cancelBtn]} onPress={() => router.back()}>
                            <Text fontSize={14} fontWeight="700" color={appTheme.colors.textMuted}>Hủy</Text>
                        </Pressable>
                        <AppButton
                            flex={1}
                            tone="primary"
                            isLoading={isSubmitting}
                            onPress={handleSave}
                            height={52}
                        >
                            Lưu thay đổi
                        </AppButton>
                    </XStack>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    severityPill: {
        paddingVertical: 10, borderRadius: 10, borderWidth: 1.5,
        alignItems: 'center', justifyContent: 'center',
    },
    input: {
        borderWidth: 1.5, borderRadius: 12, borderColor: appTheme.colors.border,
        paddingHorizontal: 14, paddingVertical: 12,
        fontSize: 14, color: appTheme.colors.text,
        backgroundColor: appTheme.colors.surface,
    },
    multiline: {
        minHeight: 100, textAlignVertical: 'top',
    },
    requiredBadge: {
        paddingHorizontal: 6, paddingVertical: 2,
        borderRadius: 6, backgroundColor: '#fee2e2',
    },
    optionalBadge: {
        paddingHorizontal: 6, paddingVertical: 2,
        borderRadius: 6, backgroundColor: appTheme.colors.surfaceSoft,
        borderWidth: 1, borderColor: appTheme.colors.border,
    },
    gpsBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 10, paddingVertical: 5,
        borderRadius: appTheme.radius.pill,
        borderWidth: 1, borderColor: appTheme.colors.primaryMuted,
        backgroundColor: appTheme.colors.primarySoft,
    },
    btn: {
        flex: 1, paddingVertical: 14, borderRadius: 14,
        alignItems: 'center', justifyContent: 'center',
    },
    cancelBtn: { backgroundColor: appTheme.colors.surfaceSoft },
});
