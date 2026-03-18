import { Tabs, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'light'];
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const isStudent = user?.role === 'student';
  const isTeacher = user?.role === 'teacher';
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isAdminOrTeacher = isAdmin || isTeacher;

  if (isAdmin) {
    router.replace('/admin');
    return null;
  }

  const TAB_HEIGHT = 64;
  const BOTTOM_PAD = Math.max(insets.bottom, 8);

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
        sceneContainerStyle: {
          // leave room for frosted tab bar on iOS
          ...(Platform.OS === 'ios' && { paddingBottom: TAB_HEIGHT + BOTTOM_PAD }),
        },
        headerShown: false,
        tabBarButton: HapticTab,
      }}
      initialRouteName="index"
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Students',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? [styles.pill, { backgroundColor: colors.tint + '18' }] : styles.pillPlaceholder}>
              <IconSymbol size={24} name="person.2.fill" color={color} />
            </View>
          ),
          href: isAdminOrTeacher ? '/(tabs)' : null,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Mark Attend.',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? [styles.pill, { backgroundColor: colors.tint + '18' }] : styles.pillPlaceholder}>
              <IconSymbol size={24} name="checkmark.circle.fill" color={color} />
            </View>
          ),
          href: isTeacher ? '/(tabs)/explore' : null,
        }}
      />
      <Tabs.Screen
        name="student-attendance"
        options={{
          title: 'Attendance',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? [styles.pill, { backgroundColor: colors.tint + '18' }] : styles.pillPlaceholder}>
              <IconSymbol size={24} name="chart.bar.fill" color={color} />
            </View>
          ),
          href: isStudent ? '/(tabs)/student-attendance' : null,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          tabBarIcon: ({ color }) => (
            <View style={styles.pillPlaceholder}>
              <IconSymbol size={24} name="lock.shield.fill" color={color} />
            </View>
          ),
          href: null,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? [styles.pill, { backgroundColor: colors.tint + '18' }] : styles.pillPlaceholder}>
              <IconSymbol size={24} name="clock.fill" color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="interactions"
        options={{
          title: 'Requests',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? [styles.pill, { backgroundColor: colors.tint + '18' }] : styles.pillPlaceholder}>
              <IconSymbol size={24} name="tray.and.arrow.down.fill" color={color} />
            </View>
          ),
          href: isStudent ? '/(tabs)/interactions' : null,
        }}
      />
      <Tabs.Screen
        name="timetable"
        options={{
          title: 'Timetable',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? [styles.pill, { backgroundColor: colors.tint + '18' }] : styles.pillPlaceholder}>
              <IconSymbol size={24} name="calendar.fill" color={color} />
            </View>
          ),
          href: isStudent ? '/(tabs)/timetable' : null,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? [styles.pill, { backgroundColor: colors.tint + '18' }] : styles.pillPlaceholder}>
              <IconSymbol size={24} name="bubble.left.and.bubble.right.fill" color={color} />
            </View>
          ),
          href: '/(tabs)/alerts',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? [styles.pill, { backgroundColor: colors.tint + '18' }] : styles.pillPlaceholder}>
              <IconSymbol size={24} name="person.circle.fill" color={color} />
            </View>
          ),
        }}
      />
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
