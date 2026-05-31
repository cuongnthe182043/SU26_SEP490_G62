import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ArrowRight, BellRing, Clock3, MapPinned, ShieldCheck, Sparkles, Truck } from 'lucide-react-native';
import { ScrollView, Text, XStack, YStack } from 'tamagui';

import { AppButton } from '@/components/app-button';
import { FeatureRow } from '@/components/feature-row';
import { StatCard } from '@/components/stat-card';
import { appTheme } from '@/theme/app-theme';

const features = [
  {
    title: 'Theo dõi đơn theo thời gian thực',
    description: 'Cập nhật trạng thái giao hàng, vị trí tài xế và tiến độ xử lý trên một màn hình.',
    icon: <MapPinned size={22} color={appTheme.colors.primary} />,
  },
  {
    title: 'Vận hành mượt cho nhiều vai trò',
    description: 'Khách hàng, cửa hàng và tài xế thao tác rõ ràng trong cùng một ứng dụng.',
    icon: <Truck size={22} color={appTheme.colors.primary} />,
  },
  {
    title: 'Dữ liệu rõ ràng và an toàn',
    description: 'Đơn hàng, thanh toán và lịch sử giao dịch được tổ chức để dễ kiểm tra.',
    icon: <ShieldCheck size={22} color={appTheme.colors.primary} />,
  },
];

export function LandingScreen() {
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(22)).current;
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 620,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slide, {
        toValue: 0,
        duration: 620,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [fade, float, slide]);

  const floatingOffset = float.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });

  return (
    <>
      <StatusBar style="dark" />
      <ScrollView
        flex={1}
        backgroundColor={appTheme.colors.background}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: appTheme.spacing.screenX,
          paddingTop: appTheme.spacing.screenTop,
          paddingBottom: appTheme.spacing.screenBottom,
          gap: 22,
        }}
      >
        <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
        <YStack gap="$5">
          <XStack alignItems="center" justifyContent="space-between">
            <XStack alignItems="center" gap="$2">
              <XStack
                width={46}
                height={46}
                borderRadius={18}
                alignItems="center"
                justifyContent="center"
                backgroundColor={appTheme.colors.primary}
              >
                <Truck size={22} color={appTheme.colors.surface} />
              </XStack>
              <YStack>
                <Text fontSize={17} fontWeight="900" color={appTheme.colors.text}>
                  G62 Mobile
                </Text>
                <Text fontSize={12} color={appTheme.colors.textMuted}>
                  Nền tảng giao vận
                </Text>
              </YStack>
            </XStack>

            <XStack
              alignItems="center"
              gap="$1.5"
              paddingHorizontal="$3"
              height={34}
              borderRadius={appTheme.radius.pill}
              backgroundColor={appTheme.colors.primarySoft}
            >
              <Clock3 size={14} color={appTheme.colors.primary} />
              <Text fontSize={12} fontWeight="800" color={appTheme.colors.primary}>
                Đang hoạt động
              </Text>
            </XStack>
          </XStack>

          <YStack
            gap="$5"
            padding="$5"
            borderRadius={appTheme.radius.xl}
            backgroundColor={appTheme.colors.primary}
            borderWidth={1}
            borderColor={appTheme.colors.primaryMuted}
            overflow="hidden"
          >
            <Animated.View
              style={{
                position: 'absolute',
                right: -38,
                top: -34,
                width: 132,
                height: 132,
                borderRadius: 66,
                backgroundColor: 'rgba(255,255,255,0.18)',
                transform: [{ translateY: floatingOffset }],
              }}
            />
            <Animated.View
              style={{
                position: 'absolute',
                left: -28,
                bottom: 24,
                width: 76,
                height: 76,
                borderRadius: 38,
                backgroundColor: 'rgba(255,255,255,0.14)',
                transform: [{ translateY: floatingOffset }],
              }}
            />

            <YStack gap="$3">
              <XStack
                alignItems="center"
                alignSelf="flex-start"
                gap="$2"
                paddingHorizontal="$3"
                height={34}
                borderRadius={appTheme.radius.pill}
                backgroundColor="rgba(255,255,255,0.18)"
              >
                <Sparkles size={15} color={appTheme.colors.surface} />
                <Text fontSize={12} fontWeight="900" color={appTheme.colors.surface}>
                  Ứng dụng giao vận SEP490
                </Text>
              </XStack>
              <Text fontSize={39} lineHeight={45} fontWeight="900" color={appTheme.colors.surface}>
                Quản lý giao hàng mượt mà hơn mỗi ngày
              </Text>
              <Text fontSize={16} lineHeight={25} color="rgba(255,255,255,0.82)">
                Theo dõi đơn hàng, điều phối tài xế và quản lý giao dịch trong một trải nghiệm gọn, rõ và đẹp.
              </Text>
            </YStack>

            <XStack gap="$3" flexWrap="wrap">
              <StatCard value="24/7" label="Theo dõi vận hành" />
              <StatCard value="3+" label="Vai trò sử dụng" />
              <StatCard value="1" label="Nền tảng đồng bộ" />
            </XStack>

            <YStack gap="$3">
              <AppButton iconAfter={ArrowRight}>Bắt đầu ngay</AppButton>
              <AppButton variant="secondary">Đăng nhập tài khoản</AppButton>
            </YStack>
          </YStack>

          <XStack
            alignItems="center"
            gap="$3"
            padding="$4"
            borderRadius={appTheme.radius.lg}
            backgroundColor={appTheme.colors.primarySoft}
            borderWidth={1}
            borderColor={appTheme.colors.primaryMuted}
          >
            <XStack
              width={46}
              height={46}
              borderRadius={appTheme.radius.sm}
              alignItems="center"
              justifyContent="center"
              backgroundColor={appTheme.colors.surface}
            >
              <BellRing size={21} color={appTheme.colors.primary} />
            </XStack>
            <YStack flex={1} gap="$1">
              <Text fontSize={15} fontWeight="800" color={appTheme.colors.text}>
                Cập nhật tức thì
              </Text>
              <Text fontSize={13} lineHeight={19} color={appTheme.colors.textMuted}>
                Mỗi thay đổi về đơn hàng đều được hiển thị rõ ràng để đội vận hành phản ứng nhanh.
              </Text>
            </YStack>
          </XStack>

          <YStack gap="$3">
            {features.map((feature) => (
              <FeatureRow
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
              />
            ))}
          </YStack>
        </YStack>
        </Animated.View>
      </ScrollView>
    </>
  );
}
