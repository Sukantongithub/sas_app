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
    if (loading) {
      console.log('_layout: Still loading, skipping navigation');
      return;
    }

    const inTabsGroup = segments[0] === '(tabs)';
    const inAdminGroup = segments[0] === 'admin';
    const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

    console.log('_layout: Navigation check', {
      isAuthenticated,
      userRole: user?.role,
      currentSegment: segments[0],
      inTabsGroup,
      inAdminGroup,
      isAdmin
    });

    if (!isAuthenticated && segments[0] !== 'login' && segments[0] !== 'register') {
      // Redirect to login if not authenticated
      console.log('_layout: Not authenticated, redirecting to login');
      router.replace('/login');
    } else if (isAuthenticated && (segments[0] === 'login' || segments[0] === 'register')) {
      // Redirect to appropriate dashboard based on role
      if (isAdmin) {
        console.log('_layout: Authenticated admin on login/register, redirecting to admin');
        router.replace('/admin');
      } else {
        console.log('_layout: Authenticated user on login/register, redirecting to tabs');
        router.replace('/(tabs)');
      }
    } else if (isAuthenticated && isAdmin && inTabsGroup) {
      // Redirect admin users away from tabs to admin panel
      console.log('_layout: Admin in tabs, redirecting to admin panel');
      router.replace('/admin');
    }
  }, [isAuthenticated, user?.role, segments, loading, router]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
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
