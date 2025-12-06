import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#006848',
        tabBarInactiveTintColor: '#666',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 2,
          borderTopColor: '#e0e0e0',
          paddingTop: 10,
          paddingBottom: Platform.OS === 'ios' ? 25 : 10,
          height: Platform.OS === 'ios' ? 90 : 70,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.15,
          shadowRadius: 10,
          elevation: 15,
        },
        tabBarLabelStyle: {
          fontSize: 13,
          fontWeight: '700',
          marginTop: 2,
          marginBottom: 2,
        },
        tabBarIconStyle: {
          marginTop: 4,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol size={focused ? 30 : 26} name="house.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="realtime"
        options={{
          title: 'Ask AI',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol size={focused ? 30 : 26} name="message.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol size={focused ? 30 : 26} name="paperplane.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol size={focused ? 30 : 26} name="person.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
