import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Modal,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { useAuth } from '@clerk/clerk-expo';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { api } from '@/convex/_generated/api';
import { formatPrice } from '@/lib/utils';
import { useTheme } from '@/lib/theme';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

type SortOption = 'newest' | 'price_asc' | 'price_desc';

export default function SearchScreen() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { colors, isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [selectedCountry, setSelectedCountry] = useState<string | undefined>();
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const categories = useQuery(
    api.products.getProductCategories,
    isSignedIn ? undefined : 'skip'
  );
  const countries = useQuery(
    api.products.getProductCountries,
    isSignedIn ? undefined : 'skip'
  );
  const products = useQuery(
    api.products.marketplace,
    isSignedIn ? {
      search: searchQuery || undefined,
      category: selectedCategory,
      country: selectedCountry,
      sortBy,
    } : 'skip'
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const clearFilters = () => {
    setSelectedCategory(undefined);
    setSelectedCountry(undefined);
    setSortBy('newest');
    setSearchQuery('');
  };

  const activeFiltersCount = [selectedCategory, selectedCountry, sortBy !== 'newest'].filter(Boolean).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Search Header */}
      <View style={{ backgroundColor: colors.card, borderBottomColor: colors.border, borderBottomWidth: 1 }} className="px-4 py-3">
        <View className="flex-row items-center">
          <View style={{ backgroundColor: colors.input }} className="flex-1 flex-row items-center rounded-xl px-4 py-3">
            <FontAwesome name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              style={{ color: colors.text }}
              className="flex-1 ml-3"
              placeholder="Search products..."
              placeholderTextColor={colors.mutedForeground}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <FontAwesome name="times-circle" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            className="ml-3 relative"
            onPress={() => setShowFilters(true)}
          >
            <View style={{ backgroundColor: isDark ? 'rgba(212, 145, 90, 0.15)' : '#fef7f0' }} className="w-12 h-12 rounded-xl items-center justify-center">
              <FontAwesome name="sliders" size={18} color={colors.primary} />
            </View>
            {activeFiltersCount > 0 && (
              <View style={{ backgroundColor: colors.primary }} className="absolute -top-1 -right-1 w-5 h-5 rounded-full items-center justify-center">
                <Text style={{ color: colors.primaryForeground }} className="text-xs font-bold">
                  {activeFiltersCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Active Filters */}
        {activeFiltersCount > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-3"
          >
            {selectedCategory && (
              <TouchableOpacity
                style={{ backgroundColor: isDark ? 'rgba(212, 145, 90, 0.15)' : '#fef7f0' }}
                className="flex-row items-center rounded-full px-3 py-1.5 mr-2"
                onPress={() => setSelectedCategory(undefined)}
              >
                <Text style={{ color: colors.primary }} className="text-sm">{selectedCategory}</Text>
                <FontAwesome name="times" size={12} color={colors.primary} style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            )}
            {selectedCountry && (
              <TouchableOpacity
                style={{ backgroundColor: isDark ? 'rgba(212, 145, 90, 0.15)' : '#fef7f0' }}
                className="flex-row items-center rounded-full px-3 py-1.5 mr-2"
                onPress={() => setSelectedCountry(undefined)}
              >
                <Text style={{ color: colors.primary }} className="text-sm">{selectedCountry}</Text>
                <FontAwesome name="times" size={12} color={colors.primary} style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={{ backgroundColor: colors.muted }}
              className="flex-row items-center rounded-full px-3 py-1.5"
              onPress={clearFilters}
            >
              <Text style={{ color: colors.mutedForeground }} className="text-sm">Clear all</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>

      {/* Results */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={{ paddingTop: 16 }}
      >
        {/* Results count */}
        <View className="px-4 mb-4">
          <Text style={{ color: colors.mutedForeground }}>
            {products?.length ?? 0} products found
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
          <View className="items-center justify-center py-16">
            <FontAwesome name="search" size={48} color={colors.mutedForeground} />
            <Text style={{ color: colors.mutedForeground }} className="mt-4 text-center text-lg">
              No products found
            </Text>
            <Text style={{ color: colors.mutedForeground }} className="mt-1 text-center">
              Try adjusting your search or filters
            </Text>
            {activeFiltersCount > 0 && (
              <TouchableOpacity
                style={{ backgroundColor: colors.primary }}
                className="mt-4 px-6 py-3 rounded-xl"
                onPress={clearFilters}
              >
                <Text style={{ color: colors.primaryForeground }} className="font-medium">Clear Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View className="px-4 flex-row flex-wrap justify-between">
            {products.map((product) => (
              <TouchableOpacity
                key={product._id}
                className="mb-4"
                style={{ width: CARD_WIDTH }}
                onPress={() => router.push(`/product/${product._id}`)}
              >
                <View style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }} className="rounded-2xl overflow-hidden shadow-sm">
                  {product.primaryImageUrl ? (
                    <Image
                      source={{ uri: product.primaryImageUrl }}
                      className="w-full h-36"
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={{ backgroundColor: colors.muted }} className="w-full h-36 items-center justify-center">
                      <FontAwesome name="image" size={32} color={colors.mutedForeground} />
                    </View>
                  )}
                  <View className="p-3">
                    <Text style={{ color: colors.text }} className="font-medium text-sm" numberOfLines={1}>
                      {product.name}
                    </Text>
                    <Text style={{ color: colors.mutedForeground }} className="text-xs mt-1" numberOfLines={1}>
                      {product.category || 'Uncategorized'}
                    </Text>
                    <View className="flex-row items-center justify-between mt-2">
                      <Text style={{ color: colors.primary }} className="font-bold">
                        {formatPrice(product.price)}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View className="h-6" />
      </ScrollView>

      {/* Filters Modal */}
      <Modal
        visible={showFilters}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFilters(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.card }}>
          <View style={{ borderBottomColor: colors.border, borderBottomWidth: 1 }} className="flex-row items-center justify-between px-4 py-4">
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <FontAwesome name="times" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={{ color: colors.text }} className="text-lg font-bold">Filters</Text>
            <TouchableOpacity onPress={clearFilters}>
              <Text style={{ color: colors.primary }} className="font-medium">Reset</Text>
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 px-4 py-4">
            {/* Sort By */}
            <View className="mb-6">
              <Text style={{ color: colors.text }} className="font-semibold mb-3">Sort By</Text>
              {[
                { value: 'newest', label: 'Newest First' },
                { value: 'price_asc', label: 'Price: Low to High' },
                { value: 'price_desc', label: 'Price: High to Low' },
              ].map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={{ 
                    backgroundColor: sortBy === option.value 
                      ? (isDark ? 'rgba(212, 145, 90, 0.15)' : '#fef7f0')
                      : colors.muted 
                  }}
                  className="flex-row items-center justify-between py-3 px-4 rounded-xl mb-2"
                  onPress={() => setSortBy(option.value as SortOption)}
                >
                  <Text
                    style={{ 
                      color: sortBy === option.value ? colors.primary : colors.text 
                    }}
                    className={sortBy === option.value ? 'font-medium' : ''}
                  >
                    {option.label}
                  </Text>
                  {sortBy === option.value && (
                    <FontAwesome name="check" size={16} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Categories */}
            <View className="mb-6">
              <Text style={{ color: colors.text }} className="font-semibold mb-3">Category</Text>
              <View className="flex-row flex-wrap">
                {categories?.map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={{ 
                      backgroundColor: selectedCategory === category 
                        ? colors.primary 
                        : colors.muted 
                    }}
                    className="px-4 py-2 rounded-full mr-2 mb-2"
                    onPress={() =>
                      setSelectedCategory(
                        selectedCategory === category ? undefined : category
                      )
                    }
                  >
                    <Text
                      style={{ 
                        color: selectedCategory === category 
                          ? colors.primaryForeground 
                          : colors.text 
                      }}
                      className={selectedCategory === category ? 'font-medium' : ''}
                    >
                      {category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Countries */}
            <View className="mb-6">
              <Text style={{ color: colors.text }} className="font-semibold mb-3">Country</Text>
              <View className="flex-row flex-wrap">
                {countries?.map((country) => (
                  <TouchableOpacity
                    key={country}
                    style={{ 
                      backgroundColor: selectedCountry === country 
                        ? colors.primary 
                        : colors.muted 
                    }}
                    className="px-4 py-2 rounded-full mr-2 mb-2"
                    onPress={() =>
                      setSelectedCountry(
                        selectedCountry === country ? undefined : country
                      )
                    }
                  >
                    <Text
                      style={{ 
                        color: selectedCountry === country 
                          ? colors.primaryForeground 
                          : colors.text 
                      }}
                      className={selectedCountry === country ? 'font-medium' : ''}
                    >
                      {country}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Apply Button */}
          <View style={{ borderTopColor: colors.border, borderTopWidth: 1 }} className="px-4 py-4">
            <TouchableOpacity
              style={{ backgroundColor: colors.primary }}
              className="py-4 rounded-xl"
              onPress={() => setShowFilters(false)}
            >
              <Text style={{ color: colors.primaryForeground }} className="text-center font-semibold text-lg">
                Apply Filters
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
