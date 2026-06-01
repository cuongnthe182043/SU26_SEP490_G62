import { Tabs } from 'expo-router';
import { BottomTabBar } from '@/components/bottom-tab-bar';

export default function TabLayout() {
    return (
        <Tabs
            tabBar={(props) => <BottomTabBar {...props} />}
            screenOptions={{ headerShown: false }}
        >
            <Tabs.Screen name="index" />
            <Tabs.Screen name="notifications" />
            <Tabs.Screen name="history" />
            <Tabs.Screen name="profile" />
        </Tabs>
    );
}
