import { View, Text, ScrollView, TouchableOpacity, Image, RefreshControl, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation } from 'convex/react';
import { useUser, useAuth } from '@clerk/clerk-expo';
import { useCallback, useEffect, useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { api } from '@/convex/_generated/api';
import { formatPrice } from '@/lib/utils';
import { useTheme } from '@/lib/theme';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

const CATEGORIES = [
  { id: 'all', name: 'All', icon: 'th-large' },
  { id: 'Electronics', name: 'Electronics', icon: 'laptop' },
  { id: 'Fashion', name: 'Fashion', icon: 'shopping-bag' },
  { id: 'Agriculture', name: 'Agriculture', icon: 'leaf' },
  { id: 'Machinery', name: 'Machinery', icon: 'cog' },
  { id: 'Raw Materials', name: 'Raw Materials', icon: 'cube' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const { isSignedIn } = useAuth();
  const { colors, isDark } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const ensureUser = useMutation(api.users.ensureUser);
  
  // Only run queries when signed in
  const currentUser = useQuery(
    api.users.getCurrentUser,
    isSignedIn ? undefined : 'skip'
  );
  const products = useQuery(
    api.products.marketplace,
    isSignedIn ? { category: selectedCategory === 'all' ? undefined : selectedCategory } : 'skip'
  );

  // Ensure user exists in Convex when they sign in
  useEffect(() => {
    if (isSignedIn && clerkUser && !currentUser) {
      ensureUser();
    }
  }, [isSignedIn, clerkUser, currentUser]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const renderProductCard = ({ item }: { item: any }) => (
    <TouchableOpacity
      className="mb-4"
      style={{ width: CARD_WIDTH }}
      onPress={() => router.push(`/product/${item._id}`)}
    >
      <View 
        style={{ backgroundColor: colors.card, borderColor: colors.border }}
        className="rounded-2xl overflow-hidden border"
      >
        {item.primaryImageUrl ? (
          <Image
            source={{ uri: item.primaryImageUrl }}
            className="w-full h-36"
            resizeMode="cover"
          />
        ) : (
          <View 
            style={{ backgroundColor: isDark ? colors.muted : '#f3f4f6' }}
            className="w-full h-36 items-center justify-center"
          >
            <FontAwesome name="image" size={32} color={colors.mutedForeground} />
          </View>
        )}
        <View className="p-3">
          <Text style={{ color: colors.text }} className="font-medium text-sm" numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={{ color: colors.textSecondary }} className="text-xs mt-1" numberOfLines={1}>
            {item.category || 'Uncategorized'}
          </Text>
          <View className="flex-row items-center justify-between mt-2">
            <Text style={{ color: colors.primary }} className="font-bold">
              {formatPrice(item.price)}
            </Text>
            {item.country && (
              <Text style={{ color: colors.mutedForeground }} className="text-xs">
                {item.country}
              </Text>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ backgroundColor: colors.card }} className="px-4 pt-2 pb-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text style={{ color: colors.textSecondary }} className="text-sm">Welcome back,</Text>
            <Text style={{ color: colors.text }} className="text-xl font-bold">
              {currentUser?.name || clerkUser?.firstName || 'User'}
            </Text>
          </View>
          <TouchableOpacity 
            style={{ backgroundColor: isDark ? colors.muted : '#fef7f0' }}
            className="w-12 h-12 rounded-full items-center justify-center"
            onPress={() => router.push('/(tabs)/profile')}
          >
            {currentUser?.imageUrl ? (
              <Image
                source={{ uri: currentUser.imageUrl }}
                className="w-12 h-12 rounded-full"
              />
            ) : (
              <Text style={{ color: colors.primary }} className="font-bold text-lg">
                {(currentUser?.name || clerkUser?.firstName || 'U')[0].toUpperCase()}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <TouchableOpacity
          style={{ backgroundColor: isDark ? colors.muted : '#f5f5f4' }}
          className="mt-4 flex-row items-center rounded-xl px-4 py-3"
          onPress={() => router.push('/(tabs)/search')}
        >
          <FontAwesome name="search" size={16} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground }} className="ml-3">Search products...</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Categories */}
        <View className="py-4">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
          >
            {CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={{
                  backgroundColor: selectedCategory === category.id ? colors.primary : colors.card,
                  borderColor: selectedCategory === category.id ? colors.primary : colors.border,
                }}
                className="mr-3 px-4 py-3 rounded-xl flex-row items-center border"
                onPress={() => setSelectedCategory(category.id)}
              >
                <FontAwesome
                  name={category.icon as any}
                  size={14}
                  color={selectedCategory === category.id ? '#fff' : colors.textSecondary}
                />
                <Text
                  style={{
                    color: selectedCategory === category.id ? '#fff' : colors.text,
                  }}
                  className="ml-2 font-medium"
                >
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Products Header */}
        <View className="px-4 flex-row items-center justify-between mb-3">
          <Text style={{ color: colors.text }} className="text-lg font-bold">
            {selectedCategory === 'all' ? 'All Products' : selectedCategory}
          </Text>
          <Text style={{ color: colors.textSecondary }} className="text-sm">
            {products?.length || 0} items
          </Text>
        </View>

        {/* Products Grid */}
        {!products ? (
          <View className="px-4 flex-row flex-wrap justify-between">
            {[1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={{ backgroundColor: colors.muted, width: CARD_WIDTH, height: 200 }}
                className="mb-4 rounded-2xl"
              />
            ))}
          </View>
        ) : products.length === 0 ? (
          <View className="items-center justify-center py-12">
            <FontAwesome name="inbox" size={48} color={colors.mutedForeground} />
            <Text style={{ color: colors.mutedForeground }} className="mt-4 text-center">
              No products found{'\n'}in this category
            </Text>
          </View>
        ) : (
          <View className="px-4 flex-row flex-wrap justify-between">
            {products.map((product) => (
              <View key={product._id}>
                {renderProductCard({ item: product })}
              </View>
            ))}
          </View>
        )}

        <View className="h-6" />
      </ScrollView>
    </SafeAreaView>
  );
}
