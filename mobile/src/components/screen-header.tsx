import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Text, XStack } from 'tamagui';

import { appTheme } from '@/theme/app-theme';

type Props = {
    title: string;
    showBack?: boolean;
    right?: React.ReactNode;
};

export function ScreenHeader({ title, showBack = false, right }: Props) {
    const insets = useSafeAreaInsets();

    return (
        <View
            style={{
                backgroundColor: appTheme.colors.background,
                paddingTop: insets.top,
                borderBottomWidth: 1,
                borderBottomColor: appTheme.colors.border,
            }}
        >
            <XStack
                height={52}
                alignItems="center"
                paddingHorizontal={16}
                gap={8}
            >
                {showBack ? (
                    <Pressable
                        onPress={() => router.back()}
                        hitSlop={12}
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: 12,
                            backgroundColor: appTheme.colors.surfaceSoft,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <ChevronLeft size={20} color={appTheme.colors.text} />
                    </Pressable>
                ) : null}

                <Text
                    flex={1}
                    fontSize={17}
                    fontWeight="900"
                    color={appTheme.colors.text}
                    numberOfLines={1}
                >
                    {title}
                </Text>

                {right ? (
                    <View style={{ alignItems: 'flex-end' }}>{right}</View>
                ) : null}
            </XStack>
        </View>
    );
}
