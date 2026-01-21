import { useSignIn, useOAuth, useAuth } from '@clerk/clerk-expo';
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

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
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

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const onSignIn = async () => {
    if (!isLoaded) return;

    setLoading(true);
    setError('');

    try {
      const signInAttempt = await signIn.create({
        identifier: email,
        password,
      });

      if (signInAttempt.status === 'complete') {
        await setActive({ session: signInAttempt.createdSessionId });
        router.replace('/(tabs)');
      } else {
        setError('Sign in failed. Please try again.');
      }
    } catch (err: any) {
      console.error('Sign in error:', err);
      setError(err.errors?.[0]?.message || 'Sign in failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const onGoogleSignIn = useCallback(async () => {
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
        setError('Please complete the sign in process.');
      }
    } catch (err: any) {
      console.error('Google sign in error:', err);
      // Handle "already signed in" error - check various formats
      const errorMsg = err.message || err.errors?.[0]?.message || '';
      if (errorMsg.toLowerCase().includes('already signed in') || 
          errorMsg.toLowerCase().includes('already authenticated')) {
        router.replace('/(tabs)');
        return;
      }
      setError(err.errors?.[0]?.message || 'Google sign in failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  }, [startGoogleOAuth, router, isSignedIn]);

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
            <View className="items-center mb-10">
              <View 
                style={{ backgroundColor: colors.primary }}
                className="w-20 h-20 rounded-2xl items-center justify-center mb-4"
              >
                <Text className="text-white text-3xl font-bold">A</Text>
              </View>
              <Text style={{ color: colors.text }} className="text-3xl font-bold">
                Welcome Back
              </Text>
              <Text style={{ color: colors.textSecondary }} className="mt-2">
                Sign in to your AfriConnect account
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

            {/* Google Sign In */}
            <TouchableOpacity
              style={{ 
                backgroundColor: colors.card,
                borderColor: colors.border,
              }}
              className={`flex-row items-center justify-center py-4 rounded-xl border mb-6 ${
                googleLoading ? 'opacity-70' : ''
              }`}
              onPress={onGoogleSignIn}
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

            {/* Email/Password Form */}
            <View className="space-y-4">
              <View>
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
                  placeholder="Enter your password"
                  placeholderTextColor={colors.mutedForeground}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="password"
                />
              </View>

              {/* Sign In Button */}
              <TouchableOpacity
                style={{ 
                  backgroundColor: loading ? `${colors.primary}99` : colors.primary 
                }}
                className="mt-6 py-4 rounded-xl"
                onPress={onSignIn}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white text-center font-semibold text-lg">
                    Sign In
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Sign Up Link */}
            <View className="flex-row justify-center mt-8">
              <Text style={{ color: colors.textSecondary }}>Don't have an account? </Text>
              <Link href="/(auth)/sign-up" asChild>
                <TouchableOpacity>
                  <Text style={{ color: colors.primary }} className="font-semibold">Sign Up</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
