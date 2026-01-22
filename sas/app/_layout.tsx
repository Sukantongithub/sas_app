import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect } from 'react';
import { LogBox } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AttendanceProvider } from '@/context/AttendanceContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';

// Suppress react-native-web deprecation warnings early
if (typeof console !== 'undefined') {
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    if (
      args[0]?.toString?.().includes?.('props.pointerEvents is deprecated') ||
      args[0]?.includes?.('props.pointerEvents is deprecated')
    ) {
      return;
    }
    originalWarn(...args);
  };
}

LogBox.ignoreLogs(['props.pointerEvents is deprecated']);

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { isAuthenticated, user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inTabsGroup = segments[0] === '(tabs)';

    if (!isAuthenticated && segments[0] !== 'login' && segments[0] !== 'register') {
      // Redirect to login if not authenticated
      router.replace('/login');
    } else if (isAuthenticated && (segments[0] === 'login' || segments[0] === 'register')) {
      // Redirect to appropriate dashboard based on role
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, segments, loading]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AttendanceProvider>
        <RootLayoutNav />
      </AttendanceProvider>
    </AuthProvider>
  );
}
