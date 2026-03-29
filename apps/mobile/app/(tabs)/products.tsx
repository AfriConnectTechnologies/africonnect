import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation } from 'convex/react';
import { useAuth } from '@clerk/clerk-expo';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as ImagePicker from 'expo-image-picker';

import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { formatPrice } from '@/lib/utils';

const CATEGORIES = [
  'Electronics',
  'Fashion',
  'Agriculture',
  'Machinery',
  'Raw Materials',
  'Food & Beverages',
  'Health & Beauty',
  'Other',
];

const COUNTRIES = [
  'Ethiopia',
  'Kenya',
  'Nigeria',
  'South Africa',
  'Tanzania',
  'Uganda',
  'Ghana',
  'Rwanda',
  'Other',
];

type ProductFormData = {
  name: string;
  description: string;
  price: string;
  quantity: string;
  category: string;
  country: string;
  minOrderQuantity: string;
};

export default function ProductsScreen() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    description: '',
    price: '',
    quantity: '',
    category: '',
    country: '',
    minOrderQuantity: '1',
  });
  const [loading, setLoading] = useState(false);

  const currentUser = useQuery(
    api.users.getCurrentUser,
    isSignedIn ? undefined : 'skip'
  );
  const products = useQuery(
    api.products.list,
    isSignedIn && currentUser?._id ? { sellerId: currentUser._id } : 'skip'
  );

  const createProduct = useMutation(api.products.create);
  const updateProduct = useMutation(api.products.update);
  const deleteProduct = useMutation(api.products.remove);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      quantity: '',
      category: '',
      country: '',
      minOrderQuantity: '1',
    });
    setEditingProduct(null);
  };

  const openEditModal = (product: any) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      quantity: product.quantity.toString(),
      category: product.category || '',
      country: product.country || '',
      minOrderQuantity: (product.minOrderQuantity || 1).toString(),
    });
    setShowAddModal(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.price || !formData.quantity) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      if (editingProduct) {
        await updateProduct({
          id: editingProduct._id,
          name: formData.name,
          description: formData.description || undefined,
          price: parseFloat(formData.price),
          quantity: parseInt(formData.quantity),
          category: formData.category || undefined,
          country: formData.country || undefined,
          minOrderQuantity: parseInt(formData.minOrderQuantity) || undefined,
        });
        Alert.alert('Success', 'Product updated successfully');
      } else {
        await createProduct({
          name: formData.name,
          description: formData.description || undefined,
          price: parseFloat(formData.price),
          quantity: parseInt(formData.quantity),
          category: formData.category || undefined,
          country: formData.country || undefined,
          minOrderQuantity: parseInt(formData.minOrderQuantity) || undefined,
          status: 'active',
        });
        Alert.alert('Success', 'Product created successfully');
      }
      setShowAddModal(false);
      resetForm();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (product: any) => {
    Alert.alert(
      'Delete Product',
      `Are you sure you want to delete "${product.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteProduct({ id: product._id });
              Alert.alert('Success', 'Product deleted');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete product');
            }
          },
        },
      ]
    );
  };

  const toggleStatus = async (product: any) => {
    try {
      await updateProduct({
        id: product._id,
        status: product.status === 'active' ? 'inactive' : 'active',
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update status');
    }
  };

  if (currentUser?.role !== 'seller') {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-20 h-20 bg-primary-100 rounded-full items-center justify-center mb-4">
            <FontAwesome name="store" size={36} color="#ec751a" />
          </View>
          <Text className="text-xl font-bold text-gray-900 text-center">
            Become a Seller
          </Text>
          <Text className="text-gray-500 text-center mt-2">
            Register your business to start selling products on AfriConnect
          </Text>
          <TouchableOpacity
            className="mt-6 bg-primary-500 px-8 py-4 rounded-xl"
            onPress={() => router.push('/(tabs)/business')}
          >
            <Text className="text-white font-semibold">Register Business</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-4 py-4 bg-white border-b border-gray-100">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-gray-900">My Products</Text>
          <TouchableOpacity
            className="bg-primary-500 px-4 py-2 rounded-xl flex-row items-center"
            onPress={() => {
              resetForm();
              setShowAddModal(true);
            }}
          >
            <FontAwesome name="plus" size={14} color="white" />
            <Text className="text-white font-medium ml-2">Add</Text>
          </TouchableOpacity>
        </View>
        <Text className="text-gray-500 mt-1">
          {products?.length || 0} products listed
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{ padding: 16 }}
      >
        {!products ? (
          // Loading skeleton
          [1, 2, 3].map((i) => (
            <View
              key={i}
              className="bg-gray-200 rounded-2xl h-24 mb-4 animate-pulse"
            />
          ))
        ) : products.length === 0 ? (
          <View className="items-center justify-center py-16">
            <FontAwesome name="cube" size={48} color="#d1d5db" />
            <Text className="text-gray-400 mt-4 text-center text-lg">
              No products yet
            </Text>
            <Text className="text-gray-400 mt-1 text-center">
              Add your first product to start selling
            </Text>
          </View>
        ) : (
          products.map((product) => (
            <View
              key={product._id}
              className="bg-white rounded-2xl mb-4 overflow-hidden border border-gray-100"
            >
              <View className="flex-row p-4">
                <View className="w-20 h-20 bg-gray-100 rounded-xl items-center justify-center">
                  <FontAwesome name="cube" size={24} color="#d1d5db" />
                </View>
                <View className="flex-1 ml-4">
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1">
                      <Text className="text-gray-900 font-semibold" numberOfLines={1}>
                        {product.name}
                      </Text>
                      <Text className="text-gray-500 text-sm mt-1">
                        {product.category || 'Uncategorized'}
                      </Text>
                    </View>
                    <View
                      className={`px-2 py-1 rounded-full ${
                        product.status === 'active'
                          ? 'bg-green-100'
                          : 'bg-gray-100'
                      }`}
                    >
                      <Text
                        className={`text-xs font-medium ${
                          product.status === 'active'
                            ? 'text-green-600'
                            : 'text-gray-500'
                        }`}
                      >
                        {product.status === 'active' ? 'Active' : 'Inactive'}
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row items-center justify-between mt-2">
                    <Text className="text-primary-600 font-bold">
                      {formatPrice(product.price)}
                    </Text>
                    <Text className="text-gray-400 text-sm">
                      Stock: {product.quantity}
                    </Text>
                  </View>
                </View>
              </View>
              {/* Actions */}
              <View className="flex-row border-t border-gray-100">
                <TouchableOpacity
                  className="flex-1 py-3 flex-row items-center justify-center border-r border-gray-100"
                  onPress={() => openEditModal(product)}
                >
                  <FontAwesome name="edit" size={14} color="#6b7280" />
                  <Text className="text-gray-600 ml-2">Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 py-3 flex-row items-center justify-center border-r border-gray-100"
                  onPress={() => toggleStatus(product)}
                >
                  <FontAwesome
                    name={product.status === 'active' ? 'eye-slash' : 'eye'}
                    size={14}
                    color="#6b7280"
                  />
                  <Text className="text-gray-600 ml-2">
                    {product.status === 'active' ? 'Hide' : 'Show'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 py-3 flex-row items-center justify-center"
                  onPress={() => handleDelete(product)}
                >
                  <FontAwesome name="trash" size={14} color="#ef4444" />
                  <Text className="text-red-500 ml-2">Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
        <View className="h-6" />
      </ScrollView>

      {/* Add/Edit Product Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowAddModal(false);
          resetForm();
        }}
      >
        <SafeAreaView className="flex-1 bg-white">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1"
          >
            {/* Modal Header */}
            <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100">
              <TouchableOpacity
                onPress={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
              >
                <FontAwesome name="times" size={24} color="#374151" />
              </TouchableOpacity>
              <Text className="text-lg font-bold text-gray-900">
                {editingProduct ? 'Edit Product' : 'Add Product'}
              </Text>
              <View className="w-6" />
            </View>

            <ScrollView className="flex-1 px-4 py-4">
              {/* Name */}
              <View className="mb-4">
                <Text className="text-gray-700 font-medium mb-2">
                  Product Name <Text className="text-red-500">*</Text>
                </Text>
                <TextInput
                  className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
                  placeholder="Enter product name"
                  placeholderTextColor="#9ca3af"
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                />
              </View>

              {/* Description */}
              <View className="mb-4">
                <Text className="text-gray-700 font-medium mb-2">Description</Text>
                <TextInput
                  className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
                  placeholder="Describe your product"
                  placeholderTextColor="#9ca3af"
                  value={formData.description}
                  onChangeText={(text) =>
                    setFormData({ ...formData, description: text })
                  }
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  style={{ minHeight: 100 }}
                />
              </View>

              {/* Price & Quantity */}
              <View className="flex-row mb-4">
                <View className="flex-1 mr-2">
                  <Text className="text-gray-700 font-medium mb-2">
                    Price (ETB) <Text className="text-red-500">*</Text>
                  </Text>
                  <TextInput
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
                    placeholder="0.00"
                    placeholderTextColor="#9ca3af"
                    value={formData.price}
                    onChangeText={(text) =>
                      setFormData({ ...formData, price: text })
                    }
                    keyboardType="numeric"
                  />
                </View>
                <View className="flex-1 ml-2">
                  <Text className="text-gray-700 font-medium mb-2">
                    Quantity <Text className="text-red-500">*</Text>
                  </Text>
                  <TextInput
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
                    placeholder="0"
                    placeholderTextColor="#9ca3af"
                    value={formData.quantity}
                    onChangeText={(text) =>
                      setFormData({ ...formData, quantity: text })
                    }
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Min Order Quantity */}
              <View className="mb-4">
                <Text className="text-gray-700 font-medium mb-2">
                  Minimum Order Quantity
                </Text>
                <TextInput
                  className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
                  placeholder="1"
                  placeholderTextColor="#9ca3af"
                  value={formData.minOrderQuantity}
                  onChangeText={(text) =>
                    setFormData({ ...formData, minOrderQuantity: text })
                  }
                  keyboardType="numeric"
                />
              </View>

              {/* Category */}
              <View className="mb-4">
                <Text className="text-gray-700 font-medium mb-2">Category</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="flex-row"
                >
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      className={`px-4 py-2 rounded-full mr-2 ${
                        formData.category === cat
                          ? 'bg-primary-500'
                          : 'bg-gray-100'
                      }`}
                      onPress={() =>
                        setFormData({
                          ...formData,
                          category: formData.category === cat ? '' : cat,
                        })
                      }
                    >
                      <Text
                        className={
                          formData.category === cat
                            ? 'text-white font-medium'
                            : 'text-gray-700'
                        }
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Country */}
              <View className="mb-6">
                <Text className="text-gray-700 font-medium mb-2">Country</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="flex-row"
                >
                  {COUNTRIES.map((country) => (
                    <TouchableOpacity
                      key={country}
                      className={`px-4 py-2 rounded-full mr-2 ${
                        formData.country === country
                          ? 'bg-primary-500'
                          : 'bg-gray-100'
                      }`}
                      onPress={() =>
                        setFormData({
                          ...formData,
                          country: formData.country === country ? '' : country,
                        })
                      }
                    >
                      <Text
                        className={
                          formData.country === country
                            ? 'text-white font-medium'
                            : 'text-gray-700'
                        }
                      >
                        {country}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </ScrollView>

            {/* Submit Button */}
            <View className="px-4 py-4 border-t border-gray-100">
              <TouchableOpacity
                className={`py-4 rounded-xl ${
                  loading ? 'bg-primary-300' : 'bg-primary-500'
                }`}
                onPress={handleSubmit}
                disabled={loading}
              >
                <Text className="text-white text-center font-semibold text-lg">
                  {loading
                    ? 'Saving...'
                    : editingProduct
                    ? 'Update Product'
                    : 'Create Product'}
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
