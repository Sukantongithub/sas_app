import { Tabs } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const router = useRouter();

  // Show different tabs based on role
  const isStudent = user?.role === 'student';
  const isTeacher = user?.role === 'teacher';
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isAdminOrTeacher = isAdmin || isTeacher;

  // Redirect admins away from tabs layout
  if (isAdmin) {
    router.replace('/admin');
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Students',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.2.fill" color={color} />,
          href: isAdminOrTeacher ? '/(tabs)' : null,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Mark Attendance',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="checkmark.circle.fill" color={color} />,
          href: isTeacher ? '/(tabs)/explore' : null,
        }}
      />
      <Tabs.Screen
        name="student-attendance"
        options={{
          title: 'My Attendance',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="chart.bar.fill" color={color} />,
          href: isStudent ? '/(tabs)/student-attendance' : null,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="lock.shield.fill" color={color} />,
          href: null,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="clock.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="interactions"
        options={{
          title: 'Requests',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="envelope.fill" color={color} />,
          href: isStudent ? '/(tabs)/interactions' : null,
        }}
      />
      <Tabs.Screen
        name="timetable"
        options={{
          title: 'Timetable',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="calendar.fill" color={color} />,
          href: isStudent ? '/(tabs)/timetable' : null,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="envelope.fill" color={color} />,
          href: '/(tabs)/alerts',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.circle.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}

