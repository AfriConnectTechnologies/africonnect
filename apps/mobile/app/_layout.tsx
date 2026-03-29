import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Slot, Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View } from 'react-native';
import 'react-native-reanimated';
import '../global.css';

import { ClerkProvider, ClerkLoaded, useAuth } from '@clerk/clerk-expo';
import { tokenCache } from '@/lib/cache';
import { ConvexClientProvider } from '@/lib/convex';
import { ThemeProvider, useTheme } from '@/lib/theme';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error('Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY environment variable');
}

SplashScreen.preventAutoHideAsync();

function InitialLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (isSignedIn && inAuthGroup) {
      router.replace('/(tabs)');
    } else if (!isSignedIn && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    }
  }, [isSignedIn, isLoaded, segments]);

  return <Slot />;
}

// Custom navigation theme that matches our app theme
const AfriConnectLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#c4703c',
    background: '#faf8f5',
    card: '#ffffff',
    text: '#2d2926',
    border: '#e7e0d8',
    notification: '#c4703c',
  },
};

const AfriConnectDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#d4915a',
    background: '#1a1816',
    card: '#252220',
    text: '#f5f3f0',
    border: '#3d3835',
    notification: '#d4915a',
  },
};

function RootLayoutNav() {
  const { isDark, colors } = useTheme();

  return (
    <NavThemeProvider value={isDark ? AfriConnectDarkTheme : AfriConnectLightTheme}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen 
            name="product/[id]" 
            options={{ 
              headerShown: true,
              title: 'Product Details',
              headerBackTitle: 'Back',
              headerStyle: { backgroundColor: colors.card },
              headerTintColor: colors.text,
            }} 
          />
          <Stack.Screen 
            name="business/[id]" 
            options={{ 
              headerShown: true,
              title: 'Business Details',
              headerBackTitle: 'Back',
              headerStyle: { backgroundColor: colors.card },
              headerTintColor: colors.text,
            }} 
          />
        </Stack>
      </View>
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider>
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
        <ClerkLoaded>
          <ConvexClientProvider>
            <RootLayoutNav />
          </ConvexClientProvider>
        </ClerkLoaded>
      </ClerkProvider>
    </ThemeProvider>
  );
}
