import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUser, useAuth, useClerk } from '@clerk/clerk-expo';
import { useQuery } from 'convex/react';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { api } from '@africonnect/convex/_generated/api';
import { getInitials, capitalizeFirst } from '@/lib/utils';
import { useTheme } from '@/lib/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();
  const { isSignedIn } = useAuth();
  const { colors, isDark, theme, setTheme } = useTheme();
  
  const currentUser = useQuery(
    api.users.getCurrentUser,
    isSignedIn ? undefined : 'skip'
  );
  const myBusiness = useQuery(
    api.businesses.getMyBusiness,
    isSignedIn ? undefined : 'skip'
  );
  
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              console.error('Sign out error:', error);
            }
          },
        },
      ]
    );
  };

  const handleThemeChange = () => {
    Alert.alert(
      'Choose Theme',
      'Select your preferred theme',
      [
        { text: 'Light', onPress: () => setTheme('light') },
        { text: 'Dark', onPress: () => setTheme('dark') },
        { text: 'System', onPress: () => setTheme('system') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const getThemeLabel = () => {
    switch (theme) {
      case 'light': return 'Light';
      case 'dark': return 'Dark';
      case 'system': return 'System';
    }
  };

  const menuItems = [
    {
      id: 'account',
      title: 'Account Settings',
      items: [
        {
          icon: 'user',
          label: 'Edit Profile',
          onPress: () => Alert.alert('Coming Soon', 'Profile editing will be available soon'),
        },
        {
          icon: 'lock',
          label: 'Change Password',
          onPress: () => Alert.alert('Coming Soon', 'Password change will be available soon'),
        },
      ],
    },
    {
      id: 'business',
      title: 'Business',
      items: [
        {
          icon: 'building',
          label: myBusiness ? 'My Business' : 'Register Business',
          onPress: () => router.push('/(tabs)/business'),
        },
        ...(currentUser?.role === 'seller'
          ? [
              {
                icon: 'cube',
                label: 'My Products',
                onPress: () => router.push('/(tabs)/products'),
              },
            ]
          : []),
      ],
    },
    {
      id: 'preferences',
      title: 'Preferences',
      items: [
        {
          icon: 'moon-o',
          label: 'Theme',
          value: getThemeLabel(),
          onPress: handleThemeChange,
        },
        {
          icon: 'bell',
          label: 'Push Notifications',
          isSwitch: true,
          value: notificationsEnabled,
          onValueChange: setNotificationsEnabled,
        },
      ],
    },
    {
      id: 'support',
      title: 'Support',
      items: [
        {
          icon: 'question-circle',
          label: 'Help Center',
          onPress: () => Alert.alert('Help', 'Contact us at support@africonnect.com'),
        },
        {
          icon: 'file-text',
          label: 'Terms of Service',
          onPress: () => Alert.alert('Coming Soon', 'Terms page will be available soon'),
        },
        {
          icon: 'shield',
          label: 'Privacy Policy',
          onPress: () => Alert.alert('Coming Soon', 'Privacy page will be available soon'),
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={{ backgroundColor: colors.card }} className="px-4 py-6">
          <View className="flex-row items-center">
            <View 
              style={{ backgroundColor: isDark ? colors.muted : '#fef7f0' }}
              className="w-20 h-20 rounded-full items-center justify-center"
            >
              {currentUser?.imageUrl ? (
                <Image
                  source={{ uri: currentUser.imageUrl }}
                  className="w-20 h-20 rounded-full"
                />
              ) : (
                <Text style={{ color: colors.primary }} className="text-2xl font-bold">
                  {getInitials(currentUser?.name || clerkUser?.firstName || 'U')}
                </Text>
              )}
            </View>
            <View className="flex-1 ml-4">
              <Text style={{ color: colors.text }} className="text-xl font-bold">
                {currentUser?.name || clerkUser?.fullName || 'User'}
              </Text>
              <Text style={{ color: colors.textSecondary }}>
                {currentUser?.email || clerkUser?.emailAddresses[0]?.emailAddress}
              </Text>
              <View className="flex-row items-center mt-2">
                <View 
                  style={{ 
                    backgroundColor: currentUser?.role === 'seller' 
                      ? (isDark ? 'rgba(212, 145, 90, 0.2)' : '#fef7f0')
                      : currentUser?.role === 'admin'
                      ? (isDark ? 'rgba(168, 85, 247, 0.2)' : '#faf5ff')
                      : (isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff')
                  }}
                  className="px-3 py-1 rounded-full"
                >
                  <Text 
                    style={{ 
                      color: currentUser?.role === 'seller'
                        ? colors.primary
                        : currentUser?.role === 'admin'
                        ? '#a855f7'
                        : '#3b82f6'
                    }}
                    className="text-sm font-medium"
                  >
                    {capitalizeFirst(currentUser?.role || 'buyer')}
                  </Text>
                </View>
                {myBusiness?.verificationStatus === 'verified' && (
                  <View className="flex-row items-center ml-2">
                    <FontAwesome name="check-circle" size={14} color="#22c55e" />
                    <Text className="text-sm ml-1" style={{ color: '#22c55e' }}>Verified</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Business Card (if seller) */}
        {myBusiness && (
          <TouchableOpacity
            style={{ backgroundColor: colors.primary }}
            className="mx-4 mt-4 rounded-2xl p-4 flex-row items-center"
            onPress={() => router.push('/(tabs)/business')}
          >
            <View 
              style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
              className="w-14 h-14 rounded-xl items-center justify-center"
            >
              {myBusiness.logoUrl ? (
                <Image
                  source={{ uri: myBusiness.logoUrl }}
                  className="w-14 h-14 rounded-xl"
                />
              ) : (
                <FontAwesome name="building" size={24} color="white" />
              )}
            </View>
            <View className="flex-1 ml-4">
              <Text className="text-white font-bold text-lg">{myBusiness.name}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.8)' }}>{myBusiness.category}</Text>
            </View>
            <FontAwesome name="chevron-right" size={16} color="white" />
          </TouchableOpacity>
        )}

        {/* Menu Sections */}
        {menuItems.map((section) => (
          <View key={section.id} className="mt-6">
            <Text 
              style={{ color: colors.textSecondary }} 
              className="px-4 text-sm font-medium mb-2"
            >
              {section.title}
            </Text>
            <View 
              style={{ backgroundColor: colors.card, borderColor: colors.border }}
              className="mx-4 rounded-xl overflow-hidden border"
            >
              {section.items.map((item: any, index) => (
                <TouchableOpacity
                  key={item.label}
                  style={{ 
                    borderBottomColor: colors.border,
                    borderBottomWidth: index < section.items.length - 1 ? 1 : 0,
                  }}
                  className="flex-row items-center px-4 py-4"
                  onPress={item.onPress}
                  disabled={item.isSwitch}
                >
                  <View 
                    style={{ backgroundColor: isDark ? colors.muted : '#f5f5f4' }}
                    className="w-10 h-10 rounded-lg items-center justify-center"
                  >
                    <FontAwesome name={item.icon} size={18} color={colors.textSecondary} />
                  </View>
                  <Text style={{ color: colors.text }} className="flex-1 ml-3 font-medium">
                    {item.label}
                  </Text>
                  {item.isSwitch ? (
                    <Switch
                      value={item.value}
                      onValueChange={item.onValueChange}
                      trackColor={{ false: colors.border, true: colors.primary }}
                      thumbColor="white"
                    />
                  ) : item.value ? (
                    <View className="flex-row items-center">
                      <Text style={{ color: colors.textSecondary }} className="mr-2">
                        {item.value}
                      </Text>
                      <FontAwesome name="chevron-right" size={14} color={colors.mutedForeground} />
                    </View>
                  ) : (
                    <FontAwesome name="chevron-right" size={14} color={colors.mutedForeground} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Sign Out */}
        <View className="mx-4 mt-6 mb-8">
          <TouchableOpacity
            style={{ backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2' }}
            className="py-4 rounded-xl flex-row items-center justify-center"
            onPress={handleSignOut}
          >
            <FontAwesome name="sign-out" size={18} color={colors.error} />
            <Text style={{ color: colors.error }} className="font-semibold ml-2">Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* App Version */}
        <Text style={{ color: colors.mutedForeground }} className="text-center text-sm mb-6">
          AfriConnect v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
