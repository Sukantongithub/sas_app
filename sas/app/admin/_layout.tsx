import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter, usePathname } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import AdminHeader from './AdminHeader';

export default function AdminLayout() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  // Redirect if not admin
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return (
      <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ThemedText type="title">Access Denied</ThemedText>
        <ThemedText style={{ marginTop: 8, opacity: 0.6 }}>
          You don't have admin privileges
        </ThemedText>
      </ThemedView>
    );
  }

  const adminSections = [
    { name: 'Dashboard', path: '/admin', icon: 'house.fill' },
    { name: 'Management', path: '/admin/management', icon: 'person.3.fill' },
    { name: 'Analytics', path: '/admin/analytics', icon: 'chart.pie.fill' },
    { name: 'Messages', path: '/admin/communication', icon: 'envelope.fill' },
    { name: 'Profile', path: '/admin/profile', icon: 'person.circle.fill' },
  ];

  const isActive = (path: string) => {
    if (path === '/admin') return pathname === '/admin';
    return pathname.startsWith(path);
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.contentContainer}>
        <Stack
          screenOptions={{
            headerShown: false,
          }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="export" />
        </Stack>
      </View>

      {/* iOS-style Tab Bar Navigation */}
      <View style={[
        styles.navBar, 
        { 
          backgroundColor: colors.navBarBackground,
          borderTopColor: colors.navBarBorder,
          paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 12 : 8),
        }
      ]}>
        {adminSections.map((section) => {
          const active = isActive(section.path);
          return (
            <TouchableOpacity
              key={section.path}
              style={styles.navItem}
              onPress={() => router.push(section.path as any)}
              activeOpacity={0.6}>
              <View style={styles.iconContainer}>
                <IconSymbol
                  size={26}
                  name={section.icon as any}
                  color={active ? colors.tint : colors.textSecondary}
                  weight="medium"
                />
              </View>
              <ThemedText
                style={[
                  styles.navLabel,
                  { 
                    color: active ? colors.tint : colors.textSecondary,
                    fontWeight: active ? '600' : '500',
                  },
                ]}>
                {section.name}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
  },
  navBar: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    paddingTop: 8,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 2,
  },
  iconContainer: {
    marginBottom: 2,
  },
  navLabel: {
    fontSize: 10,
    letterSpacing: -0.1,
  },
});

