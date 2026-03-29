import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useQuery } from 'convex/react';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { api } from '@africonnect/convex/_generated/api';
import type { Id } from '@africonnect/convex/_generated/dataModel';
import { formatPrice, formatDate } from '@/lib/utils';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

export default function BusinessDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const business = useQuery(
    api.businesses.getBusiness,
    id ? { businessId: id as Id<'businesses'> } : 'skip'
  );

  // Get products from this business's owner
  const products = useQuery(
    api.products.marketplace,
    {}
  );

  // Filter products by this business (we need seller info)
  const businessProducts = products?.filter(
    (p) => p.sellerId === business?.ownerId
  ) || [];

  if (!business) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <Stack.Screen options={{ headerShown: true, title: 'Loading...' }} />
        <View className="flex-1 items-center justify-center">
          <View className="w-16 h-16 bg-gray-200 rounded-full animate-pulse" />
          <View className="w-48 h-6 bg-gray-200 rounded mt-4 animate-pulse" />
        </View>
      </SafeAreaView>
    );
  }

  const handleCall = () => {
    if (business.phone) {
      Linking.openURL(`tel:${business.phone}`);
    }
  };

  const handleWebsite = () => {
    if (business.website) {
      Linking.openURL(business.website);
    }
  };

  const handleEmail = () => {
    if (business.owner?.email) {
      Linking.openURL(`mailto:${business.owner.email}`);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '',
          headerTransparent: true,
        }}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header Banner */}
        <View className="h-40 bg-primary-500" />

        {/* Business Info Card */}
        <View className="bg-white mx-4 -mt-20 rounded-2xl shadow-sm overflow-hidden">
          <View className="p-4">
            <View className="flex-row items-start">
              <View className="w-20 h-20 bg-gray-100 rounded-2xl items-center justify-center">
                {business.logoUrl ? (
                  <Image
                    source={{ uri: business.logoUrl }}
                    className="w-full h-full rounded-2xl"
                  />
                ) : (
                  <FontAwesome name="building" size={32} color="#ec751a" />
                )}
              </View>
              <View className="flex-1 ml-4">
                <View className="flex-row items-center">
                  <Text className="text-xl font-bold text-gray-900 flex-1">
                    {business.name}
                  </Text>
                  {business.verificationStatus === 'verified' && (
                    <View className="bg-green-100 px-2 py-1 rounded-full flex-row items-center">
                      <FontAwesome name="check-circle" size={12} color="#22c55e" />
                      <Text className="text-green-700 text-xs ml-1">Verified</Text>
                    </View>
                  )}
                </View>
                <View className="flex-row items-center mt-1">
                  <FontAwesome name="map-marker" size={12} color="#9ca3af" />
                  <Text className="text-gray-500 ml-1">
                    {business.city ? `${business.city}, ` : ''}{business.country}
                  </Text>
                </View>
                <View className="flex-row items-center mt-1">
                  <FontAwesome name="tag" size={12} color="#9ca3af" />
                  <Text className="text-gray-500 ml-1">{business.category}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Contact Actions */}
          <View className="flex-row border-t border-gray-100">
            {business.phone && (
              <TouchableOpacity
                className="flex-1 py-3 flex-row items-center justify-center border-r border-gray-100"
                onPress={handleCall}
              >
                <FontAwesome name="phone" size={16} color="#ec751a" />
                <Text className="text-primary-600 font-medium ml-2">Call</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              className="flex-1 py-3 flex-row items-center justify-center border-r border-gray-100"
              onPress={handleEmail}
            >
              <FontAwesome name="envelope" size={16} color="#ec751a" />
              <Text className="text-primary-600 font-medium ml-2">Email</Text>
            </TouchableOpacity>
            {business.website && (
              <TouchableOpacity
                className="flex-1 py-3 flex-row items-center justify-center"
                onPress={handleWebsite}
              >
                <FontAwesome name="globe" size={16} color="#ec751a" />
                <Text className="text-primary-600 font-medium ml-2">Website</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Description */}
        {business.description && (
          <View className="mx-4 mt-4 bg-white rounded-xl p-4">
            <Text className="text-gray-900 font-semibold mb-2">About</Text>
            <Text className="text-gray-600 leading-6">{business.description}</Text>
          </View>
        )}

        {/* Business Details */}
        <View className="mx-4 mt-4 bg-white rounded-xl p-4">
          <Text className="text-gray-900 font-semibold mb-3">Contact Information</Text>

          {business.address && (
            <View className="flex-row items-center mb-3">
              <View className="w-10 h-10 bg-gray-100 rounded-lg items-center justify-center">
                <FontAwesome name="map-marker" size={16} color="#6b7280" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-gray-400 text-xs">Address</Text>
                <Text className="text-gray-900">{business.address}</Text>
              </View>
            </View>
          )}

          {business.phone && (
            <View className="flex-row items-center mb-3">
              <View className="w-10 h-10 bg-gray-100 rounded-lg items-center justify-center">
                <FontAwesome name="phone" size={16} color="#6b7280" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-gray-400 text-xs">Phone</Text>
                <Text className="text-gray-900">{business.phone}</Text>
              </View>
            </View>
          )}

          {business.owner?.email && (
            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-gray-100 rounded-lg items-center justify-center">
                <FontAwesome name="envelope" size={16} color="#6b7280" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-gray-400 text-xs">Email</Text>
                <Text className="text-gray-900">{business.owner.email}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Products from this Business */}
        {businessProducts.length > 0 && (
          <View className="mt-4">
            <View className="px-4 flex-row items-center justify-between mb-3">
              <Text className="text-lg font-bold text-gray-900">Products</Text>
              <Text className="text-gray-500">{businessProducts.length} items</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16 }}
            >
              {businessProducts.slice(0, 6).map((product) => (
                <TouchableOpacity
                  key={product._id}
                  className="mr-4 w-40"
                  onPress={() => router.push(`/product/${product._id}`)}
                >
                  {product.primaryImageUrl ? (
                    <Image
                      source={{ uri: product.primaryImageUrl }}
                      className="w-40 h-40 rounded-xl"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="w-40 h-40 bg-gray-100 rounded-xl items-center justify-center">
                      <FontAwesome name="cube" size={32} color="#d1d5db" />
                    </View>
                  )}
                  <Text className="text-gray-900 font-medium mt-2" numberOfLines={1}>
                    {product.name}
                  </Text>
                  <Text className="text-primary-600 font-bold">
                    {formatPrice(product.price)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Member Since */}
        <View className="px-4 py-6">
          <Text className="text-gray-400 text-center text-sm">
            Member since {formatDate(business.createdAt)}
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Contact Button */}
      <View className="px-4 py-4 bg-white border-t border-gray-100">
        <TouchableOpacity
          className="bg-primary-500 py-4 rounded-xl flex-row items-center justify-center"
          onPress={handleEmail}
        >
          <FontAwesome name="envelope" size={18} color="white" />
          <Text className="text-white font-semibold text-lg ml-2">
            Contact Business
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
