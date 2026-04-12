import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter, usePathname } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { TAB_NAVIGATION, getGroupedNavItems, AppRole } from '@/constants/navigationConfig';

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

  // Get admin navigation config
  const userRole = (user?.role || 'admin') as AppRole;
  const navConfig = TAB_NAVIGATION[userRole];
  const navItems = navConfig?.sidebar || [];
  const { ungrouped, groups } = getGroupedNavItems(navItems);

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
          <Stack.Screen name="classes" />
          <Stack.Screen name="messaging" />
        </Stack>
      </View>

      {/* iOS-style Tab Bar Navigation with Grouped Items */}
      <View style={[
        styles.navBar, 
        { 
          backgroundColor: colors.navBarBackground,
          borderTopColor: colors.navBarBorder,
          paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 12 : 8),
        }
      ]}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Ungrouped items */}
          {ungrouped.map((item) => {
            const active = isActive(item.path);
            return (
              <TouchableOpacity
                key={item.path}
                style={[styles.navItem, { flex: undefined, minWidth: 60 }]}
                onPress={() => router.push(item.path as any)}
                activeOpacity={0.6}>
                <View style={styles.iconContainer}>
                  <IconSymbol
                    size={26}
                    name={item.icon as any}
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
                  ]}
                  numberOfLines={1}>
                  {item.name}
                </ThemedText>
              </TouchableOpacity>
            );
          })}

          {/* Grouped items (Students, Staffs) */}
          {Object.entries(groups).map(([groupName, items]) => (
            <View key={groupName} style={styles.groupContainer}>
              <ThemedText style={styles.groupLabel}>{groupName}</ThemedText>
              <View style={styles.groupItems}>
                {items.map((item) => {
                  const active = isActive(item.path);
                  return (
                    <TouchableOpacity
                      key={item.path}
                      style={[styles.navItem, { flex: undefined, minWidth: 75 }]}
                      onPress={() => router.push(item.path as any)}
                      activeOpacity={0.6}>
                      <View style={styles.iconContainer}>
                        <IconSymbol
                          size={24}
                          name={item.icon as any}
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
                            fontSize: 9,
                          },
                        ]}
                        numberOfLines={1}>
                        {item.name}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
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
    borderTopWidth: 0.5,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    paddingTop: 8,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    maxHeight: 90,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'flex-start',
    gap: 8,
  },
  navItem: {
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
  groupContainer: {
    alignItems: 'center',
    minWidth: 70,
    paddingHorizontal: 4,
  },
  groupLabel: {
    fontSize: 8,
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  groupItems: {
    flexDirection: 'row',
    gap: 4,
  },
});


