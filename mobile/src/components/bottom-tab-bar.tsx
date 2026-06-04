import { useEffect, useRef } from "react";
import { Animated, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { HouseLine, BellSimple, Clock, GearSix } from "phosphor-react-native";
import { appTheme } from "@/theme/app-theme";
import { AppText } from "./app-text";
import { useNotifications } from "@/hooks/use-notifications";

type TabConfig = {
  key: string;
  label: string;
  Icon: React.ComponentType<{
    size?: number;
    color?: string;
    weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone";
  }>;
};

const TABS: TabConfig[] = [
  { key: "index", label: "Trang chủ", Icon: HouseLine },
  { key: "notifications", label: "Thông báo", Icon: BellSimple },
  { key: "history", label: "Lịch sử", Icon: Clock },
  { key: "profile", label: "Cài đặt", Icon: GearSix },
];

const TAB_HEIGHT = 68;

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  const label = count > 99 ? "99+" : String(count);
  return (
    <View
      style={{
        position: "absolute",
        top: -4,
        right: -6,
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: appTheme.colors.danger,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 3,
        borderWidth: 1.5,
        borderColor: appTheme.colors.background,
      }}
    >
      <AppText
        style={{
          fontSize: 9,
          fontWeight: "700",
          color: "#fff",
          lineHeight: 13,
        }}
      >
        {label}
      </AppText>
    </View>
  );
}

function TabItem({
  config,
  isActive,
  onPress,
  badge,
}: {
  config: TabConfig;
  isActive: boolean;
  onPress: () => void;
  badge?: number;
}) {
  const scale = useRef(new Animated.Value(isActive ? 1 : 0.94)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: isActive ? 1 : 0.94,
      useNativeDriver: true,
      tension: 100,
      friction: 10,
    }).start();
  }, [isActive]);

  const { Icon } = config;
  const iconColor = isActive
    ? appTheme.colors.primary
    : appTheme.colors.textMuted;
  const labelColor = isActive
    ? appTheme.colors.primary
    : appTheme.colors.textMuted;

  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 8,
        gap: 5,
      }}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <View style={{ position: "relative" }}>
          <Icon
            size={isActive ? 28 : 24}
            color={iconColor}
            weight={isActive ? "fill" : "regular"}
          />
          {badge !== undefined && <UnreadBadge count={badge} />}
        </View>
      </Animated.View>

      <AppText
        variant="caption"
        style={{
          fontSize: 12,
          color: labelColor,
          fontWeight: isActive ? "700" : "400",
        }}
      >
        {config.label}
      </AppText>
    </Pressable>
  );
}

export function BottomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { unreadCount } = useNotifications();

  return (
    <View
      style={{
        height: TAB_HEIGHT + insets.bottom,
        paddingBottom: insets.bottom,
        backgroundColor: appTheme.colors.background,
        flexDirection: "row",
        borderTopWidth: 1,
        borderTopColor: appTheme.colors.border,
        shadowColor: "#000",
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
          badge={tab.key === "notifications" ? unreadCount : undefined}
          onPress={() => {
            const event = navigation.emit({
              type: "tabPress",
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
