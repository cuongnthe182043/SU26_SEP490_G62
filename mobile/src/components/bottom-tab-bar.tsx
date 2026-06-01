import { useEffect, useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Bell, ClipboardList, Home, User } from 'lucide-react-native';

import { appTheme } from '@/theme/app-theme';
import { AppText } from './app-text';

type TabConfig = {
    key: string;
    label: string;
    Icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
};

const TABS: TabConfig[] = [
    { key: 'index',         label: 'Trang chủ',  Icon: Home },
    { key: 'notifications', label: 'Thông báo',  Icon: Bell },
    { key: 'history',       label: 'Lịch sử',    Icon: ClipboardList },
    { key: 'profile',       label: 'Cài đặt',    Icon: User },
];

const TAB_HEIGHT = 68;

function TabItem({
    config,
    isActive,
    onPress,
}: {
    config: TabConfig;
    isActive: boolean;
    onPress: () => void;
}) {
    const scale = useRef(new Animated.Value(isActive ? 1 : 0.92)).current;
    const pillOpacity = useRef(new Animated.Value(isActive ? 1 : 0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.spring(scale, {
                toValue: isActive ? 1 : 0.92,
                useNativeDriver: true,
                tension: 120,
                friction: 8,
            }),
            Animated.timing(pillOpacity, {
                toValue: isActive ? 1 : 0,
                duration: 180,
                useNativeDriver: true,
            }),
        ]).start();
    }, [isActive]);

    const { Icon } = config;
    const iconColor = isActive ? appTheme.colors.primary : appTheme.colors.textMuted;
    const labelColor = isActive ? appTheme.colors.primary : appTheme.colors.textMuted;

    return (
        <Pressable
            onPress={onPress}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 4 }}
        >
            <Animated.View style={{ transform: [{ scale }], alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                    <Animated.View
                        style={{
                            position: 'absolute',
                            width: 48,
                            height: 30,
                            borderRadius: 15,
                            backgroundColor: appTheme.colors.primarySoft,
                            opacity: pillOpacity,
                        }}
                    />
                    <Icon size={24} color={iconColor} strokeWidth={isActive ? 2.5 : 2} />
                </View>
            </Animated.View>

            <AppText
                variant="caption"
                style={{ fontSize: 12, color: labelColor, fontWeight: isActive ? '900' : '700' }}
            >
                {config.label}
            </AppText>
        </Pressable>
    );
}

export function BottomTabBar({ state, navigation }: BottomTabBarProps) {
    const insets = useSafeAreaInsets();

    return (
        <View
            style={{
                height: TAB_HEIGHT + insets.bottom,
                paddingBottom: insets.bottom,
                backgroundColor: appTheme.colors.background,
                flexDirection: 'row',
                borderTopWidth: 1,
                borderTopColor: appTheme.colors.border,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -2 },
                shadowOpacity: 0.06,
                shadowRadius: 8,
                elevation: 10,
            }}
        >
            {TABS.map((tab, index) => (
                <TabItem
                    key={tab.key}
                    config={tab}
                    isActive={state.index === index}
                    onPress={() => {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: state.routes[index]?.key,
                            canPreventDefault: true,
                        });
                        if (!event.defaultPrevented) {
                            navigation.navigate(state.routes[index]?.name);
                        }
                    }}
                />
            ))}
        </View>
    );
}
