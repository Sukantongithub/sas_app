import React from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { View, Pressable } from 'react-native';

export default function AdminLayout() {
  const { user } = useAuth();
  const router = useRouter();

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

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: 'Back',
      }}>
      <Stack.Screen
        name="index"
        options={{
          title: 'Admin Dashboard',
          headerTitleStyle: { fontWeight: '600' },
          headerLeft: () => (
            <Pressable
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(tabs)');
                }
              }}
              style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
              <ThemedText type="defaultSemiBold">Back</ThemedText>
            </Pressable>
          ),
        }}
      />
      <Stack.Screen
        name="students"
        options={{
          title: 'Manage Students',
          headerTitleStyle: { fontWeight: '600' },
        }}
      />
      <Stack.Screen
        name="staff"
        options={{
          title: 'Manage Staff',
          headerTitleStyle: { fontWeight: '600' },
        }}
      />
      <Stack.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          headerTitleStyle: { fontWeight: '600' },
        }}
      />
      <Stack.Screen
        name="export"
        options={{
          title: 'Export Data',
          headerTitleStyle: { fontWeight: '600' },
        }}
      />
    </Stack>
  );
}
