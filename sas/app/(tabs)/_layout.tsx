import { Tabs, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';
import { TAB_NAVIGATION, AppRole } from '@/constants/navigationConfig';

type RawRole = string | undefined;

type TabRoute =
  | 'index'
  | 'explore'
  | 'student-attendance'
  | 'interactions'
  | 'timetable'
  | 'alerts'
  | 'profile'
  | 'admin'
  | 'history';

function getTabPath(route: TabRoute): string {
  return route === 'index' ? '/(tabs)' : `/(tabs)/${route}`;
}

const TAB_DEFINITIONS: Array<{ route: TabRoute; title: string; icon: string }> = [
  { route: 'index', title: 'Dashboard', icon: 'house.fill' },
  { route: 'explore', title: 'Mark Attend.', icon: 'checkmark.circle.fill' },
  { route: 'student-attendance', title: 'Attendance', icon: 'chart.bar.fill' },
  { route: 'interactions', title: 'Requests', icon: 'tray.and.arrow.down.fill' },
  { route: 'timetable', title: 'Timetable', icon: 'calendar.fill' },
  { route: 'alerts', title: 'Messages', icon: 'bubble.left.and.bubble.right.fill' },
  { route: 'profile', title: 'Profile', icon: 'person.circle.fill' },
  { route: 'admin', title: 'Admin', icon: 'lock.shield.fill' },
  { route: 'history', title: 'History', icon: 'clock.fill' },
];

function normalizeRole(role?: RawRole): AppRole {
  const value = String(role || '').trim().toLowerCase();
  if (value === 'admin') return 'admin';
  if (value === 'super_admin') return 'super_admin';
  if (value === 'hod') return 'hod';
  if (value === 'staff' || value === 'teacher' || value === 'faculty' || value === 'hr') return 'staff';
  if (value === 'parent' || value === 'parents') return 'parent';
  return 'student';
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'light'];
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Get role-based navigation config
  const userRole = normalizeRole(user?.role);
  const navConfig = TAB_NAVIGATION[userRole];

  // Redirect admin users to admin panel.
  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'super_admin') {
      router.replace('/admin');
    }
  }, [user?.role, router]);

  if (user?.role === 'admin' || user?.role === 'super_admin') {
    return null;
  }

  const TAB_HEIGHT = 64;
  const BOTTOM_PAD = Math.max(insets.bottom, 8);
  const tabs = navConfig?.tabs || [];

  // Create set of allowed tab routes for this role.
  const allowedRoutes = new Set(tabs.map((t) => t.route as TabRoute));

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: isDark ? '#64748B' : '#9CA3AF',
        tabBarStyle: {
          backgroundColor: isDark ? colors.cardBackground : '#fff',
          borderTopColor: 'transparent',
          borderTopWidth: 0,
          paddingBottom: BOTTOM_PAD,
          height: TAB_HEIGHT + BOTTOM_PAD,
          // Frosted glass on iOS
          ...(Platform.OS === 'ios' && {
            position: 'absolute',
            backgroundColor: isDark ? 'rgba(30,41,59,0.92)' : 'rgba(255,255,255,0.92)',
          }),
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: isDark ? 0.25 : 0.06,
          shadowRadius: 16,
          elevation: 12,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.2,
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingTop: 8,
        },
        tabBarIconStyle: {
          marginBottom: 0,
        },
        headerShown: false,
        tabBarButton: HapticTab,
      }}
      initialRouteName={tabs[0]?.route || 'student-attendance'}
    >
      {/* Register all tab files and only expose role-allowed ones in the bar. */}
      {TAB_DEFINITIONS.map((tabConfig) => {
        const isAllowed = allowedRoutes.has(tabConfig.route);
        return (
          <Tabs.Screen
            key={tabConfig.route}
            name={tabConfig.route as any}
            options={{
              title: tabConfig.title,
              tabBarIcon: ({ color, focused }) => (
                <View style={focused ? [styles.pill, { backgroundColor: colors.tint + '18' }] : styles.pillPlaceholder}>
                  <IconSymbol size={24} name={tabConfig.icon as any} color={color} />
                </View>
              ),
              href: isAllowed ? (getTabPath(tabConfig.route) as any) : null,
            }}
          />
        );
      })}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  pill: {
    width: 44,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillPlaceholder: {
    width: 44,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
