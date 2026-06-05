import { Pressable, ScrollView } from 'react-native';
import { Text, XStack } from 'tamagui';

import { appTheme } from '@/theme/app-theme';
import type { VehicleGroup } from '@/types/trip';

type Props = {
    groups: VehicleGroup[];
    selected: number | null;
    onSelect: (id: number | null) => void;
};

function Chip({
    label,
    selected,
    onPress,
}: {
    label: string;
    selected: boolean;
    onPress: () => void;
}) {
    return (
        <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <XStack
                paddingHorizontal={13}
                paddingVertical={7}
                borderRadius={appTheme.radius.pill}
                borderWidth={1.5}
                borderColor={selected ? appTheme.colors.primary : appTheme.colors.border}
                backgroundColor={selected ? appTheme.colors.primary : appTheme.colors.surface}
            >
                <Text
                    fontSize={12}
                    fontWeight="800"
                    color={selected ? appTheme.colors.surface : appTheme.colors.text}
                >
                    {label}
                </Text>
            </XStack>
        </Pressable>
    );
}

export function VehicleGroupFilter({ groups, selected, onSelect }: Props) {
    if (!groups || groups.length === 0) return null;
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{
                gap: 8,
                paddingHorizontal: appTheme.spacing.screenX,
                paddingVertical: 2,
            }}
        >
            <Chip label="Tất cả" selected={selected === null} onPress={() => onSelect(null)} />
            {groups.map((g) => (
                <Chip
                    key={g.id}
                    label={g.name}
                    selected={selected === g.id}
                    onPress={() => onSelect(g.id)}
                />
            ))}
        </ScrollView>
    );
}
