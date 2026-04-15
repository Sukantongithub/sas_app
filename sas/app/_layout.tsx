import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect } from 'react';
import { LogBox } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AttendanceProvider } from '@/context/AttendanceContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider as CustomThemeProvider } from '@/context/ThemeContext';
import { TAB_NAVIGATION, AppRole } from '@/constants/navigationConfig';

function getTabPath(route: string): string {
  return route === 'index' ? '/(tabs)' : `/(tabs)/${route}`;
}

function normalizeRole(role?: string): AppRole {
  const value = String(role || '').trim().toLowerCase();
  if (value === 'admin') return 'admin';
  if (value === 'super_admin') return 'super_admin';
  if (value === 'hod') return 'hod';
  if (value === 'staff' || value === 'teacher' || value === 'faculty' || value === 'hr') return 'staff';
  if (value === 'parent' || value === 'parents') return 'parent';
  return 'student';
}

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
    const role = normalizeRole(user?.role);
    const roleConfig = TAB_NAVIGATION[role];
    const isAdmin = role === 'admin' || role === 'super_admin';
    const firstTab = roleConfig?.tabs?.[0]?.route || 'student-attendance';

    console.log('_layout: Navigation check', {
      isAuthenticated,
      userRole: role,
      currentSegment: segments[0],
      inTabsGroup,
      inAdminGroup,
      isAdmin
    });

    if (!isAuthenticated && segments[0] !== 'login') {
      // Redirect to login if not authenticated
      console.log('_layout: Not authenticated, redirecting to login');
      router.replace('/login');
    } else if (isAuthenticated && segments[0] === 'login') {
      // Redirect to appropriate dashboard based on role
      if (isAdmin) {
        console.log('_layout: Authenticated admin on login, redirecting to admin');
        router.replace('/admin');
      } else {
        console.log('_layout: Authenticated user on login, redirecting to first role tab');
        router.replace(getTabPath(firstTab) as any);
      }
    } else if (isAuthenticated && isAdmin && inTabsGroup) {
      // Redirect admin users away from tabs to admin panel
      console.log('_layout: Admin in tabs, redirecting to admin panel');
      router.replace('/admin');
    } else if (isAuthenticated && !isAdmin && inAdminGroup) {
      // Redirect non-admin users away from admin group.
      console.log('_layout: Non-admin in admin group, redirecting to role tab');
      router.replace(getTabPath(firstTab) as any);
    }
  }, [isAuthenticated, user?.role, segments, loading, router]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
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
    <CustomThemeProvider>
      <AuthProvider>
        <AttendanceProvider>
          <RootLayoutNav />
        </AttendanceProvider>
      </AuthProvider>
    </CustomThemeProvider>
  );
}
