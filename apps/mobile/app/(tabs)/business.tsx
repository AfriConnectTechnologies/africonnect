import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  RefreshControl,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation } from 'convex/react';
import { useAuth } from '@clerk/clerk-expo';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { api } from '@/convex/_generated/api';
import { formatDate } from '@/lib/utils';
import { useTheme } from '@/lib/theme';

const BUSINESS_CATEGORIES = [
  'Agriculture',
  'Electronics',
  'Fashion & Textiles',
  'Food & Beverages',
  'Manufacturing',
  'Mining',
  'Services',
  'Technology',
  'Trade & Export',
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
  'Egypt',
  'Morocco',
  'Other',
];

type BusinessFormData = {
  name: string;
  description: string;
  category: string;
  country: string;
  city: string;
  address: string;
  phone: string;
  website: string;
};

export default function BusinessScreen() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { colors, isDark } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<BusinessFormData>({
    name: '',
    description: '',
    category: '',
    country: '',
    city: '',
    address: '',
    phone: '',
    website: '',
  });

  const currentUser = useQuery(
    api.users.getCurrentUser,
    isSignedIn ? undefined : 'skip'
  );
  const myBusiness = useQuery(
    api.businesses.getMyBusiness,
    isSignedIn ? undefined : 'skip'
  );
  const createBusiness = useMutation(api.businesses.createBusiness);
  const updateBusiness = useMutation(api.businesses.updateBusiness);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: '',
      country: '',
      city: '',
      address: '',
      phone: '',
      website: '',
    });
    setIsEditing(false);
  };

  const openEditModal = () => {
    if (myBusiness) {
      setFormData({
        name: myBusiness.name,
        description: myBusiness.description || '',
        category: myBusiness.category,
        country: myBusiness.country,
        city: myBusiness.city || '',
        address: myBusiness.address || '',
        phone: myBusiness.phone || '',
        website: myBusiness.website || '',
      });
      setIsEditing(true);
      setShowRegisterModal(true);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.category || !formData.country) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      if (isEditing) {
        await updateBusiness({
          name: formData.name,
          description: formData.description || undefined,
          category: formData.category,
          country: formData.country,
          city: formData.city || undefined,
          address: formData.address || undefined,
          phone: formData.phone || undefined,
          website: formData.website || undefined,
        });
        Alert.alert('Success', 'Business profile updated successfully');
      } else {
        await createBusiness({
          name: formData.name,
          description: formData.description || undefined,
          category: formData.category,
          country: formData.country,
          city: formData.city || undefined,
          address: formData.address || undefined,
          phone: formData.phone || undefined,
          website: formData.website || undefined,
        });
        Alert.alert('Success', 'Business registered successfully! Your profile is pending verification.');
      }
      setShowRegisterModal(false);
      resetForm();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save business');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return { bg: '#dcfce7', text: '#15803d', icon: 'check-circle' };
      case 'rejected':
        return { bg: '#fee2e2', text: '#dc2626', icon: 'times-circle' };
      default:
        return { bg: '#fef9c3', text: '#ca8a04', icon: 'clock-o' };
    }
  };

  // No business registered
  if (!myBusiness) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          <View className="flex-1 items-center justify-center px-6 py-16">
            <View style={{ backgroundColor: isDark ? 'rgba(212, 145, 90, 0.15)' : '#fef7f0' }} className="w-24 h-24 rounded-full items-center justify-center mb-6">
              <FontAwesome name="building" size={40} color={colors.primary} />
            </View>
            <Text style={{ color: colors.text }} className="text-2xl font-bold text-center">
              Register Your Business
            </Text>
            <Text style={{ color: colors.mutedForeground }} className="text-center mt-3 leading-6">
              Create your business profile to start selling products on the AfriConnect marketplace
            </Text>
            
            <View className="w-full mt-8 space-y-3">
              <View style={{ backgroundColor: colors.card }} className="flex-row items-center rounded-xl p-4">
                <View style={{ backgroundColor: '#dcfce7' }} className="w-10 h-10 rounded-full items-center justify-center">
                  <FontAwesome name="check" size={18} color="#22c55e" />
                </View>
                <View className="flex-1 ml-4">
                  <Text style={{ color: colors.text }} className="font-medium">Get Verified</Text>
                  <Text style={{ color: colors.mutedForeground }} className="text-sm">Build trust with buyers</Text>
                </View>
              </View>
              
              <View style={{ backgroundColor: colors.card }} className="flex-row items-center rounded-xl p-4 mt-3">
                <View style={{ backgroundColor: '#dbeafe' }} className="w-10 h-10 rounded-full items-center justify-center">
                  <FontAwesome name="globe" size={18} color="#3b82f6" />
                </View>
                <View className="flex-1 ml-4">
                  <Text style={{ color: colors.text }} className="font-medium">Reach Africa</Text>
                  <Text style={{ color: colors.mutedForeground }} className="text-sm">Connect with buyers across the continent</Text>
                </View>
              </View>
              
              <View style={{ backgroundColor: colors.card }} className="flex-row items-center rounded-xl p-4 mt-3">
                <View style={{ backgroundColor: '#f3e8ff' }} className="w-10 h-10 rounded-full items-center justify-center">
                  <FontAwesome name="line-chart" size={18} color="#a855f7" />
                </View>
                <View className="flex-1 ml-4">
                  <Text style={{ color: colors.text }} className="font-medium">Grow Your Sales</Text>
                  <Text style={{ color: colors.mutedForeground }} className="text-sm">List unlimited products</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={{ backgroundColor: colors.primary }}
              className="mt-8 px-8 py-4 rounded-xl w-full"
              onPress={() => {
                resetForm();
                setShowRegisterModal(true);
              }}
            >
              <Text style={{ color: colors.primaryForeground }} className="font-semibold text-center text-lg">
                Register Business
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Register Modal */}
        <RegisterModal
          visible={showRegisterModal}
          onClose={() => {
            setShowRegisterModal(false);
            resetForm();
          }}
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleSubmit}
          loading={loading}
          isEditing={isEditing}
          colors={colors}
          isDark={isDark}
        />
      </SafeAreaView>
    );
  }

  // Business exists - show profile
  const statusStyle = getStatusColor(myBusiness.verificationStatus);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
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
      >
        {/* Header Card */}
        <View style={{ backgroundColor: colors.card }} className="mx-4 mt-4 rounded-2xl overflow-hidden">
          {/* Banner */}
          <View style={{ backgroundColor: colors.primary }} className="h-24" />
          
          {/* Logo & Name */}
          <View className="px-4 pb-4">
            <View className="-mt-12 flex-row items-end">
              <View style={{ backgroundColor: colors.card, borderColor: colors.card }} className="w-24 h-24 rounded-2xl border-4 shadow-sm items-center justify-center">
                {myBusiness.logoUrl ? (
                  <Image
                    source={{ uri: myBusiness.logoUrl }}
                    className="w-full h-full rounded-xl"
                  />
                ) : (
                  <FontAwesome name="building" size={36} color={colors.primary} />
                )}
              </View>
              <View className="flex-1 ml-4 mb-2">
                <View style={{ backgroundColor: statusStyle.bg }} className="self-start px-3 py-1 rounded-full flex-row items-center">
                  <FontAwesome name={statusStyle.icon as any} size={12} color={statusStyle.text} />
                  <Text style={{ color: statusStyle.text }} className="ml-1 text-sm font-medium capitalize">
                    {myBusiness.verificationStatus}
                  </Text>
                </View>
              </View>
            </View>
            
            <Text style={{ color: colors.text }} className="text-xl font-bold mt-3">
              {myBusiness.name}
            </Text>
            <View className="flex-row items-center mt-1">
              <FontAwesome name="map-marker" size={14} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground }} className="ml-2">
                {myBusiness.city ? `${myBusiness.city}, ` : ''}{myBusiness.country}
              </Text>
            </View>
          </View>
        </View>

        {/* Status Banner */}
        {myBusiness.verificationStatus === 'pending' && (
          <View style={{ backgroundColor: '#fef9c3', borderColor: '#fde047' }} className="mx-4 mt-4 border rounded-xl p-4 flex-row items-center">
            <FontAwesome name="clock-o" size={20} color="#ca8a04" />
            <View className="flex-1 ml-3">
              <Text style={{ color: '#854d0e' }} className="font-medium">Verification Pending</Text>
              <Text style={{ color: '#a16207' }} className="text-sm">Our team is reviewing your business</Text>
            </View>
          </View>
        )}

        {myBusiness.verificationStatus === 'rejected' && (
          <View style={{ backgroundColor: '#fee2e2', borderColor: '#fecaca' }} className="mx-4 mt-4 border rounded-xl p-4 flex-row items-center">
            <FontAwesome name="times-circle" size={20} color="#dc2626" />
            <View className="flex-1 ml-3">
              <Text style={{ color: '#991b1b' }} className="font-medium">Verification Rejected</Text>
              <Text style={{ color: '#b91c1c' }} className="text-sm">Please update your information and try again</Text>
            </View>
          </View>
        )}

        {/* Description */}
        {myBusiness.description && (
          <View style={{ backgroundColor: colors.card }} className="mx-4 mt-4 rounded-xl p-4">
            <Text style={{ color: colors.text }} className="font-semibold mb-2">About</Text>
            <Text style={{ color: colors.mutedForeground }} className="leading-6">{myBusiness.description}</Text>
          </View>
        )}

        {/* Business Details */}
        <View style={{ backgroundColor: colors.card }} className="mx-4 mt-4 rounded-xl p-4">
          <Text style={{ color: colors.text }} className="font-semibold mb-3">Business Details</Text>
          
          <View className="space-y-3">
            <View className="flex-row items-center">
              <View style={{ backgroundColor: colors.muted }} className="w-10 h-10 rounded-lg items-center justify-center">
                <FontAwesome name="tag" size={16} color={colors.mutedForeground} />
              </View>
              <View className="ml-3">
                <Text style={{ color: colors.mutedForeground }} className="text-xs">Category</Text>
                <Text style={{ color: colors.text }}>{myBusiness.category}</Text>
              </View>
            </View>

            {myBusiness.phone && (
              <View className="flex-row items-center mt-3">
                <View style={{ backgroundColor: colors.muted }} className="w-10 h-10 rounded-lg items-center justify-center">
                  <FontAwesome name="phone" size={16} color={colors.mutedForeground} />
                </View>
                <View className="ml-3">
                  <Text style={{ color: colors.mutedForeground }} className="text-xs">Phone</Text>
                  <Text style={{ color: colors.text }}>{myBusiness.phone}</Text>
                </View>
              </View>
            )}

            {myBusiness.address && (
              <View className="flex-row items-center mt-3">
                <View style={{ backgroundColor: colors.muted }} className="w-10 h-10 rounded-lg items-center justify-center">
                  <FontAwesome name="map-marker" size={16} color={colors.mutedForeground} />
                </View>
                <View className="ml-3">
                  <Text style={{ color: colors.mutedForeground }} className="text-xs">Address</Text>
                  <Text style={{ color: colors.text }}>{myBusiness.address}</Text>
                </View>
              </View>
            )}

            {myBusiness.website && (
              <View className="flex-row items-center mt-3">
                <View style={{ backgroundColor: colors.muted }} className="w-10 h-10 rounded-lg items-center justify-center">
                  <FontAwesome name="globe" size={16} color={colors.mutedForeground} />
                </View>
                <View className="ml-3">
                  <Text style={{ color: colors.mutedForeground }} className="text-xs">Website</Text>
                  <Text style={{ color: colors.primary }}>{myBusiness.website}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Member Since */}
        <View className="mx-4 mt-4 mb-6">
          <Text style={{ color: colors.mutedForeground }} className="text-center text-sm">
            Member since {formatDate(myBusiness.createdAt)}
          </Text>
        </View>

        {/* Edit Button */}
        <View className="px-4 pb-6">
          <TouchableOpacity
            style={{ backgroundColor: colors.primary }}
            className="py-4 rounded-xl"
            onPress={openEditModal}
          >
            <Text style={{ color: colors.primaryForeground }} className="text-center font-semibold text-lg">
              Edit Business Profile
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit Modal */}
      <RegisterModal
        visible={showRegisterModal}
        onClose={() => {
          setShowRegisterModal(false);
          resetForm();
        }}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleSubmit}
        loading={loading}
        isEditing={isEditing}
        colors={colors}
        isDark={isDark}
      />
    </SafeAreaView>
  );
}

// Register/Edit Modal Component
function RegisterModal({
  visible,
  onClose,
  formData,
  setFormData,
  onSubmit,
  loading,
  isEditing,
  colors,
  isDark,
}: {
  visible: boolean;
  onClose: () => void;
  formData: BusinessFormData;
  setFormData: (data: BusinessFormData) => void;
  onSubmit: () => void;
  loading: boolean;
  isEditing: boolean;
  colors: any;
  isDark: boolean;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.card }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          {/* Header */}
          <View style={{ borderBottomColor: colors.border, borderBottomWidth: 1 }} className="flex-row items-center justify-between px-4 py-4">
            <TouchableOpacity onPress={onClose}>
              <FontAwesome name="times" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={{ color: colors.text }} className="text-lg font-bold">
              {isEditing ? 'Edit Business' : 'Register Business'}
            </Text>
            <View className="w-6" />
          </View>

          <ScrollView className="flex-1 px-4 py-4">
            {/* Business Name */}
            <View className="mb-4">
              <Text style={{ color: colors.text }} className="font-medium mb-2">
                Business Name <Text style={{ color: '#ef4444' }}>*</Text>
              </Text>
              <TextInput
                style={{ 
                  backgroundColor: colors.input, 
                  borderColor: colors.border, 
                  color: colors.text 
                }}
                className="border rounded-xl px-4 py-3"
                placeholder="Enter business name"
                placeholderTextColor={colors.mutedForeground}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
              />
            </View>

            {/* Description */}
            <View className="mb-4">
              <Text style={{ color: colors.text }} className="font-medium mb-2">Description</Text>
              <TextInput
                style={{ 
                  backgroundColor: colors.input, 
                  borderColor: colors.border, 
                  color: colors.text,
                  minHeight: 100 
                }}
                className="border rounded-xl px-4 py-3"
                placeholder="Tell us about your business"
                placeholderTextColor={colors.mutedForeground}
                value={formData.description}
                onChangeText={(text) =>
                  setFormData({ ...formData, description: text })
                }
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Category */}
            <View className="mb-4">
              <Text style={{ color: colors.text }} className="font-medium mb-2">
                Category <Text style={{ color: '#ef4444' }}>*</Text>
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {BUSINESS_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={{ 
                      backgroundColor: formData.category === cat 
                        ? colors.primary 
                        : colors.muted 
                    }}
                    className="px-4 py-2 rounded-full mr-2"
                    onPress={() => setFormData({ ...formData, category: cat })}
                  >
                    <Text
                      style={{ 
                        color: formData.category === cat 
                          ? colors.primaryForeground 
                          : colors.text 
                      }}
                      className={formData.category === cat ? 'font-medium' : ''}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Country */}
            <View className="mb-4">
              <Text style={{ color: colors.text }} className="font-medium mb-2">
                Country <Text style={{ color: '#ef4444' }}>*</Text>
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {COUNTRIES.map((country) => (
                  <TouchableOpacity
                    key={country}
                    style={{ 
                      backgroundColor: formData.country === country 
                        ? colors.primary 
                        : colors.muted 
                    }}
                    className="px-4 py-2 rounded-full mr-2"
                    onPress={() => setFormData({ ...formData, country })}
                  >
                    <Text
                      style={{ 
                        color: formData.country === country 
                          ? colors.primaryForeground 
                          : colors.text 
                      }}
                      className={formData.country === country ? 'font-medium' : ''}
                    >
                      {country}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* City */}
            <View className="mb-4">
              <Text style={{ color: colors.text }} className="font-medium mb-2">City</Text>
              <TextInput
                style={{ 
                  backgroundColor: colors.input, 
                  borderColor: colors.border, 
                  color: colors.text 
                }}
                className="border rounded-xl px-4 py-3"
                placeholder="Enter city"
                placeholderTextColor={colors.mutedForeground}
                value={formData.city}
                onChangeText={(text) => setFormData({ ...formData, city: text })}
              />
            </View>

            {/* Address */}
            <View className="mb-4">
              <Text style={{ color: colors.text }} className="font-medium mb-2">Address</Text>
              <TextInput
                style={{ 
                  backgroundColor: colors.input, 
                  borderColor: colors.border, 
                  color: colors.text 
                }}
                className="border rounded-xl px-4 py-3"
                placeholder="Enter full address"
                placeholderTextColor={colors.mutedForeground}
                value={formData.address}
                onChangeText={(text) =>
                  setFormData({ ...formData, address: text })
                }
              />
            </View>

            {/* Phone */}
            <View className="mb-4">
              <Text style={{ color: colors.text }} className="font-medium mb-2">Phone Number</Text>
              <TextInput
                style={{ 
                  backgroundColor: colors.input, 
                  borderColor: colors.border, 
                  color: colors.text 
                }}
                className="border rounded-xl px-4 py-3"
                placeholder="+251 91 234 5678"
                placeholderTextColor={colors.mutedForeground}
                value={formData.phone}
                onChangeText={(text) => setFormData({ ...formData, phone: text })}
                keyboardType="phone-pad"
              />
            </View>

            {/* Website */}
            <View className="mb-6">
              <Text style={{ color: colors.text }} className="font-medium mb-2">Website</Text>
              <TextInput
                style={{ 
                  backgroundColor: colors.input, 
                  borderColor: colors.border, 
                  color: colors.text 
                }}
                className="border rounded-xl px-4 py-3"
                placeholder="https://www.example.com"
                placeholderTextColor={colors.mutedForeground}
                value={formData.website}
                onChangeText={(text) =>
                  setFormData({ ...formData, website: text })
                }
                keyboardType="url"
                autoCapitalize="none"
              />
            </View>
          </ScrollView>

          {/* Submit Button */}
          <View style={{ borderTopColor: colors.border, borderTopWidth: 1 }} className="px-4 py-4">
            <TouchableOpacity
              style={{ 
                backgroundColor: loading 
                  ? (isDark ? 'rgba(212, 145, 90, 0.5)' : '#f8c49a')
                  : colors.primary 
              }}
              className="py-4 rounded-xl"
              onPress={onSubmit}
              disabled={loading}
            >
              <Text style={{ color: colors.primaryForeground }} className="text-center font-semibold text-lg">
                {loading
                  ? 'Saving...'
                  : isEditing
                  ? 'Update Business'
                  : 'Register Business'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
