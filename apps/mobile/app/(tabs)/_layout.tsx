import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import { useQuery } from 'convex/react';
import { useAuth } from '@clerk/clerk-expo';

import { useTheme } from '@/lib/theme';
import { api } from '@africonnect/convex/_generated/api';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={24} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const { colors, isDark } = useTheme();
  const { isSignedIn } = useAuth();
  
  // Get user from Convex to check role - only when signed in
  const convexUser = useQuery(
    api.users.getCurrentUser,
    isSignedIn ? undefined : 'skip'
  );
  const isSeller = convexUser?.role === 'seller';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.tabIconDefault,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => <TabBarIcon name="search" color={color} />,
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'My Products',
          tabBarIcon: ({ color }) => <TabBarIcon name="cube" color={color} />,
          href: isSeller ? '/(tabs)/products' : null, // Hide for buyers
        }}
      />
      <Tabs.Screen
        name="business"
        options={{
          title: 'Business',
          tabBarIcon: ({ color }) => <TabBarIcon name="building" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <TabBarIcon name="user" color={color} />,
        }}
      />
    </Tabs>
  );
}
