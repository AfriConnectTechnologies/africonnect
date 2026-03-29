import { useSignUp, useOAuth, useAuth } from '@clerk/clerk-expo';
import { Link, useRouter } from 'expo-router';
import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { useTheme } from '@/lib/theme';

// Required for OAuth to work properly
WebBrowser.maybeCompleteAuthSession();

type Role = 'buyer' | 'seller';

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const { startOAuthFlow: startGoogleOAuth } = useOAuth({ strategy: 'oauth_google' });
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const { colors, isDark } = useTheme();

  // If already signed in, redirect to home
  useEffect(() => {
    if (isSignedIn) {
      router.replace('/(tabs)');
    }
  }, [isSignedIn]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('buyer');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState('');

  const onSignUp = async () => {
    if (!isLoaded) return;

    setLoading(true);
    setError('');

    try {
      await signUp.create({
        emailAddress: email,
        password,
        firstName: name.split(' ')[0],
        lastName: name.split(' ').slice(1).join(' ') || undefined,
        unsafeMetadata: {
          role,
        },
      });

      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (err: any) {
      console.error('Sign up error:', err);
      setError(err.errors?.[0]?.message || 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onVerify = async () => {
    if (!isLoaded) return;

    setLoading(true);
    setError('');

    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (completeSignUp.status === 'complete') {
        await setActive({ session: completeSignUp.createdSessionId });
        router.replace('/(tabs)');
      } else {
        setError('Verification failed. Please try again.');
      }
    } catch (err: any) {
      console.error('Verification error:', err);
      setError(err.errors?.[0]?.message || 'Verification failed. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  const onGoogleSignUp = useCallback(async () => {
    // Check if already signed in
    if (isSignedIn) {
      router.replace('/(tabs)');
      return;
    }

    setGoogleLoading(true);
    setError('');

    try {
      const { createdSessionId, setActive: setActiveSession, signIn: googleSignIn, signUp: googleSignUp } = await startGoogleOAuth();

      if (createdSessionId && setActiveSession) {
        await setActiveSession({ session: createdSessionId });
        router.replace('/(tabs)');
      } else if (googleSignIn || googleSignUp) {
        // OAuth flow was cancelled or needs additional steps
        setError('Please complete the sign up process.');
      }
    } catch (err: any) {
      console.error('Google sign up error:', err);
      // Handle "already signed in" error - check various formats
      const errorMsg = err.message || err.errors?.[0]?.message || '';
      if (errorMsg.toLowerCase().includes('already signed in') || 
          errorMsg.toLowerCase().includes('already authenticated')) {
        router.replace('/(tabs)');
        return;
      }
      setError(err.errors?.[0]?.message || 'Google sign up failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  }, [startGoogleOAuth, router, isSignedIn]);

  if (pendingVerification) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
            <View className="flex-1 px-6 pt-12 pb-8">
              <View className="items-center mb-12">
                <View 
                  style={{ backgroundColor: colors.success }}
                  className="w-20 h-20 rounded-2xl items-center justify-center mb-4"
                >
                  <Text className="text-white text-3xl">✉️</Text>
                </View>
                <Text style={{ color: colors.text }} className="text-3xl font-bold">
                  Verify Email
                </Text>
                <Text style={{ color: colors.textSecondary }} className="mt-2 text-center">
                  We sent a verification code to{'\n'}{email}
                </Text>
              </View>

              {error ? (
                <View 
                  style={{ 
                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2',
                    borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#fecaca',
                  }}
                  className="rounded-xl p-4 mb-6 border"
                >
                  <Text style={{ color: colors.error }} className="text-center">{error}</Text>
                </View>
              ) : null}

              <View>
                <Text style={{ color: colors.text }} className="font-medium mb-2">Verification Code</Text>
                <TextInput
                  style={{ 
                    backgroundColor: isDark ? colors.muted : '#faf8f5',
                    borderColor: colors.border,
                    color: colors.text,
                  }}
                  className="border rounded-xl px-4 py-4 text-center text-xl tracking-widest"
                  placeholder="000000"
                  placeholderTextColor={colors.mutedForeground}
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>

              <TouchableOpacity
                style={{ 
                  backgroundColor: loading ? `${colors.success}99` : colors.success 
                }}
                className="mt-6 py-4 rounded-xl"
                onPress={onVerify}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white text-center font-semibold text-lg">
                    Verify Email
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 px-6 pt-12 pb-8">
            {/* Logo & Header */}
            <View className="items-center mb-6">
              <View 
                style={{ backgroundColor: colors.primary }}
                className="w-20 h-20 rounded-2xl items-center justify-center mb-4"
              >
                <Text className="text-white text-3xl font-bold">A</Text>
              </View>
              <Text style={{ color: colors.text }} className="text-3xl font-bold">
                Create Account
              </Text>
              <Text style={{ color: colors.textSecondary }} className="mt-2">
                Join the AfriConnect marketplace
              </Text>
            </View>

            {/* Error Message */}
            {error ? (
              <View 
                style={{ 
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2',
                  borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#fecaca',
                }}
                className="rounded-xl p-4 mb-6 border"
              >
                <Text style={{ color: colors.error }} className="text-center">{error}</Text>
              </View>
            ) : null}

            {/* Google Sign Up */}
            <TouchableOpacity
              style={{ 
                backgroundColor: colors.card,
                borderColor: colors.border,
              }}
              className={`flex-row items-center justify-center py-4 rounded-xl border mb-6 ${
                googleLoading ? 'opacity-70' : ''
              }`}
              onPress={onGoogleSignUp}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <ActivityIndicator color="#4285F4" />
              ) : (
                <>
                  <FontAwesome name="google" size={20} color="#4285F4" />
                  <Text style={{ color: colors.text }} className="font-semibold ml-3">
                    Continue with Google
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View className="flex-row items-center mb-6">
              <View style={{ backgroundColor: colors.border }} className="flex-1 h-px" />
              <Text style={{ color: colors.mutedForeground }} className="mx-4">or</Text>
              <View style={{ backgroundColor: colors.border }} className="flex-1 h-px" />
            </View>

            {/* Role Selection */}
            <View className="mb-6">
              <Text style={{ color: colors.text }} className="font-medium mb-3">I want to</Text>
              <View className="flex-row space-x-3">
                <TouchableOpacity
                  style={{
                    borderColor: role === 'buyer' ? colors.primary : colors.border,
                    backgroundColor: role === 'buyer' 
                      ? (isDark ? 'rgba(212, 145, 90, 0.1)' : '#fef7f0')
                      : colors.card,
                  }}
                  className="flex-1 p-4 rounded-xl border-2"
                  onPress={() => setRole('buyer')}
                >
                  <Text className="text-2xl text-center mb-2">🛒</Text>
                  <Text
                    style={{ color: role === 'buyer' ? colors.primary : colors.text }}
                    className="text-center font-semibold"
                  >
                    Buy Products
                  </Text>
                  <Text style={{ color: colors.textSecondary }} className="text-center text-xs mt-1">
                    Browse & purchase
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    borderColor: role === 'seller' ? colors.primary : colors.border,
                    backgroundColor: role === 'seller' 
                      ? (isDark ? 'rgba(212, 145, 90, 0.1)' : '#fef7f0')
                      : colors.card,
                  }}
                  className="flex-1 p-4 rounded-xl border-2 ml-3"
                  onPress={() => setRole('seller')}
                >
                  <Text className="text-2xl text-center mb-2">🏪</Text>
                  <Text
                    style={{ color: role === 'seller' ? colors.primary : colors.text }}
                    className="text-center font-semibold"
                  >
                    Sell Products
                  </Text>
                  <Text style={{ color: colors.textSecondary }} className="text-center text-xs mt-1">
                    List & manage
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Form */}
            <View className="space-y-4">
              <View>
                <Text style={{ color: colors.text }} className="font-medium mb-2">Full Name</Text>
                <TextInput
                  style={{ 
                    backgroundColor: isDark ? colors.muted : '#faf8f5',
                    borderColor: colors.border,
                    color: colors.text,
                  }}
                  className="border rounded-xl px-4 py-4"
                  placeholder="Enter your full name"
                  placeholderTextColor={colors.mutedForeground}
                  value={name}
                  onChangeText={setName}
                  autoComplete="name"
                />
              </View>

              <View className="mt-4">
                <Text style={{ color: colors.text }} className="font-medium mb-2">Email</Text>
                <TextInput
                  style={{ 
                    backgroundColor: isDark ? colors.muted : '#faf8f5',
                    borderColor: colors.border,
                    color: colors.text,
                  }}
                  className="border rounded-xl px-4 py-4"
                  placeholder="Enter your email"
                  placeholderTextColor={colors.mutedForeground}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                />
              </View>

              <View className="mt-4">
                <Text style={{ color: colors.text }} className="font-medium mb-2">Password</Text>
                <TextInput
                  style={{ 
                    backgroundColor: isDark ? colors.muted : '#faf8f5',
                    borderColor: colors.border,
                    color: colors.text,
                  }}
                  className="border rounded-xl px-4 py-4"
                  placeholder="Create a password"
                  placeholderTextColor={colors.mutedForeground}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="new-password"
                />
              </View>

              {/* Sign Up Button */}
              <TouchableOpacity
                style={{ 
                  backgroundColor: loading ? `${colors.primary}99` : colors.primary 
                }}
                className="mt-6 py-4 rounded-xl"
                onPress={onSignUp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white text-center font-semibold text-lg">
                    Create Account
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Sign In Link */}
            <View className="flex-row justify-center mt-8">
              <Text style={{ color: colors.textSecondary }}>Already have an account? </Text>
              <Link href="/(auth)/sign-in" asChild>
                <TouchableOpacity>
                  <Text style={{ color: colors.primary }} className="font-semibold">Sign In</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
