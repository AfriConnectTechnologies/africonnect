import { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  FlatList,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useQuery } from 'convex/react';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { formatPrice, formatDate } from '@/lib/utils';

const { width } = Dimensions.get('window');

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const product = useQuery(
    api.products.getProductWithImages,
    id ? { id: id as Id<'products'> } : 'skip'
  );

  const relatedProducts = useQuery(
    api.products.getRelatedProducts,
    id ? { productId: id as Id<'products'>, limit: 4 } : 'skip'
  );

  const handleShare = async () => {
    if (!product) return;
    try {
      await Share.share({
        message: `Check out ${product.name} on AfriConnect - ${formatPrice(product.price)}`,
        title: product.name,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  if (!product) {
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

  const images = product.images?.length ? product.images : [{ url: null }];

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setActiveImageIndex(viewableItems[0].index || 0);
    }
  }).current;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '',
          headerTransparent: true,
          headerRight: () => (
            <TouchableOpacity
              onPress={handleShare}
              className="w-10 h-10 bg-white/90 rounded-full items-center justify-center mr-2"
            >
              <FontAwesome name="share" size={18} color="#374151" />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Image Gallery */}
        <View className="relative">
          <FlatList
            ref={flatListRef}
            data={images}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
            renderItem={({ item }) =>
              item.url ? (
                <Image
                  source={{ uri: item.url }}
                  style={{ width, height: width }}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={{ width, height: width }}
                  className="bg-gray-100 items-center justify-center"
                >
                  <FontAwesome name="image" size={64} color="#d1d5db" />
                </View>
              )
            }
            keyExtractor={(_, index) => index.toString()}
          />

          {/* Image Indicators */}
          {images.length > 1 && (
            <View className="absolute bottom-4 left-0 right-0 flex-row justify-center">
              {images.map((_, index) => (
                <View
                  key={index}
                  className={`w-2 h-2 rounded-full mx-1 ${
                    index === activeImageIndex ? 'bg-primary-500' : 'bg-white/60'
                  }`}
                />
              ))}
            </View>
          )}
        </View>

        {/* Product Info */}
        <View className="px-4 pt-4 pb-6">
          {/* Category & Country */}
          <View className="flex-row items-center mb-2">
            {product.category && (
              <View className="bg-primary-50 px-3 py-1 rounded-full mr-2">
                <Text className="text-primary-600 text-sm">{product.category}</Text>
              </View>
            )}
            {product.country && (
              <View className="bg-gray-100 px-3 py-1 rounded-full">
                <Text className="text-gray-600 text-sm">{product.country}</Text>
              </View>
            )}
          </View>

          {/* Title & Price */}
          <Text className="text-2xl font-bold text-gray-900">{product.name}</Text>
          <Text className="text-3xl font-bold text-primary-600 mt-2">
            {formatPrice(product.price)}
          </Text>

          {/* Quick Info */}
          <View className="flex-row items-center mt-4 py-3 border-t border-b border-gray-100">
            <View className="flex-1 items-center">
              <Text className="text-gray-400 text-xs">Stock</Text>
              <Text className="text-gray-900 font-semibold mt-1">
                {product.quantity} units
              </Text>
            </View>
            <View className="w-px h-8 bg-gray-200" />
            <View className="flex-1 items-center">
              <Text className="text-gray-400 text-xs">Min. Order</Text>
              <Text className="text-gray-900 font-semibold mt-1">
                {product.minOrderQuantity || 1} units
              </Text>
            </View>
            <View className="w-px h-8 bg-gray-200" />
            <View className="flex-1 items-center">
              <Text className="text-gray-400 text-xs">Status</Text>
              <Text
                className={`font-semibold mt-1 ${
                  product.status === 'active' ? 'text-green-600' : 'text-gray-400'
                }`}
              >
                {product.status === 'active' ? 'Available' : 'Unavailable'}
              </Text>
            </View>
          </View>

          {/* Description */}
          {product.description && (
            <View className="mt-4">
              <Text className="text-gray-900 font-semibold mb-2">Description</Text>
              <Text className="text-gray-600 leading-6">{product.description}</Text>
            </View>
          )}

          {/* Specifications */}
          {product.specifications && (
            <View className="mt-4">
              <Text className="text-gray-900 font-semibold mb-2">Specifications</Text>
              <View className="bg-gray-50 rounded-xl p-4">
                {(() => {
                  try {
                    const specs = JSON.parse(product.specifications);
                    return Object.entries(specs).map(([key, value]) => (
                      <View
                        key={key}
                        className="flex-row justify-between py-2 border-b border-gray-200 last:border-0"
                      >
                        <Text className="text-gray-500">{key}</Text>
                        <Text className="text-gray-900 font-medium">{String(value)}</Text>
                      </View>
                    ));
                  } catch {
                    return <Text className="text-gray-600">{product.specifications}</Text>;
                  }
                })()}
              </View>
            </View>
          )}

          {/* Tags */}
          {product.tags && product.tags.length > 0 && (
            <View className="mt-4">
              <Text className="text-gray-900 font-semibold mb-2">Tags</Text>
              <View className="flex-row flex-wrap">
                {product.tags.map((tag, index) => (
                  <View key={index} className="bg-gray-100 px-3 py-1 rounded-full mr-2 mb-2">
                    <Text className="text-gray-600 text-sm">{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Seller Info */}
          {product.business && (
            <TouchableOpacity
              className="mt-6 bg-gray-50 rounded-2xl p-4 flex-row items-center"
              onPress={() => router.push(`/business/${product.business?._id}`)}
            >
              {product.business.logoUrl ? (
                <Image
                  source={{ uri: product.business.logoUrl }}
                  className="w-14 h-14 rounded-xl"
                />
              ) : (
                <View className="w-14 h-14 bg-primary-100 rounded-xl items-center justify-center">
                  <FontAwesome name="building" size={24} color="#ec751a" />
                </View>
              )}
              <View className="flex-1 ml-4">
                <Text className="text-gray-900 font-semibold">{product.business.name}</Text>
                <View className="flex-row items-center mt-1">
                  <FontAwesome name="map-marker" size={12} color="#9ca3af" />
                  <Text className="text-gray-500 text-sm ml-1">{product.business.country}</Text>
                  {product.business.verificationStatus === 'verified' && (
                    <View className="flex-row items-center ml-3">
                      <FontAwesome name="check-circle" size={12} color="#22c55e" />
                      <Text className="text-green-600 text-sm ml-1">Verified</Text>
                    </View>
                  )}
                </View>
              </View>
              <FontAwesome name="chevron-right" size={16} color="#9ca3af" />
            </TouchableOpacity>
          )}

          {/* Related Products */}
          {relatedProducts && relatedProducts.length > 0 && (
            <View className="mt-6">
              <Text className="text-lg font-bold text-gray-900 mb-4">
                Related Products
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {relatedProducts.map((item) => (
                  <TouchableOpacity
                    key={item._id}
                    className="mr-4 w-36"
                    onPress={() => router.push(`/product/${item._id}`)}
                  >
                    {item.primaryImageUrl ? (
                      <Image
                        source={{ uri: item.primaryImageUrl }}
                        className="w-36 h-36 rounded-xl"
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="w-36 h-36 bg-gray-100 rounded-xl items-center justify-center">
                        <FontAwesome name="image" size={24} color="#d1d5db" />
                      </View>
                    )}
                    <Text className="text-gray-900 font-medium mt-2" numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text className="text-primary-600 font-semibold">
                      {formatPrice(item.price)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Posted Date */}
          <Text className="text-gray-400 text-sm mt-6 text-center">
            Posted on {formatDate(product.createdAt)}
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Action */}
      <View className="px-4 py-4 bg-white border-t border-gray-100">
        <TouchableOpacity
          className="bg-primary-500 py-4 rounded-xl flex-row items-center justify-center"
          onPress={() => {
            if (product.business) {
              router.push(`/business/${product.business._id}`);
            }
          }}
        >
          <FontAwesome name="envelope" size={18} color="white" />
          <Text className="text-white font-semibold text-lg ml-2">
            Contact Seller
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
