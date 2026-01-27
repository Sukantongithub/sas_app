import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'expo-router';
import AdminHeader from './AdminHeader';

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', onPress: () => {} },
      {
        text: 'Logout',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };

  const ProfileCard = ({ label, value }: { label: string; value: string }) => (
    <View style={[styles.profileCard, { backgroundColor: colors.cardBackground, borderBottomColor: colors.border }]}>
      <ThemedText style={styles.profileLabel}>{label}</ThemedText>
      <ThemedText type="defaultSemiBold" style={styles.profileValue}>
        {value}
      </ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <AdminHeader title="Admin Profile" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Profile Header */}
        <View style={[styles.profileHeader, { backgroundColor: colors.cardBackground }]}>
          <View style={[styles.avatarContainer, { backgroundColor: colors.tint }]}>
            <IconSymbol size={48} name="person.fill" color="#fff" />
          </View>
          <ThemedText type="title" style={styles.userName}>
            {user?.name || 'Admin User'}
          </ThemedText>
          <View style={[styles.roleBadge, { backgroundColor: colors.tint }]}>
            <ThemedText style={styles.roleBadgeText}>
              {user?.role === 'super_admin' ? 'Super Admin' : 'Admin'}
            </ThemedText>
          </View>
        </View>

        {/* Profile Information */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            Account Information
          </ThemedText>
          <ProfileCard label="Email" value={user?.email || 'N/A'} />
          <ProfileCard label="Last Login" value={user?.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'} />
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            Settings
          </ThemedText>
          <TouchableOpacity style={[styles.settingOption, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.settingLeft}>
              <IconSymbol size={24} name="gear" color={colors.tint} />
              <View>
                <ThemedText type="defaultSemiBold">Preferences</ThemedText>
                <ThemedText style={styles.settingSubtitle}>Manage app preferences</ThemedText>
              </View>
            </View>
            <IconSymbol size={20} name="chevron.right" color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.settingOption, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.settingLeft}>
              <IconSymbol size={24} name="lock.fill" color={colors.tint} />
              <View>
                <ThemedText type="defaultSemiBold">Security</ThemedText>
                <ThemedText style={styles.settingSubtitle}>Change password & security</ThemedText>
              </View>
            </View>
            <IconSymbol size={20} name="chevron.right" color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.logoutButton, { backgroundColor: '#ff4444' }]}
            onPress={handleLogout}>
            <IconSymbol size={20} name="arrow.right.square.fill" color="#fff" />
            <ThemedText style={styles.logoutButtonText}>Logout</ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  profileHeader: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
    marginBottom: 24,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  userName: {
    fontSize: 20,
    marginBottom: 8,
  },
  roleBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  roleBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    marginBottom: 12,
  },
  profileCard: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    marginBottom: 8,
    borderRadius: 10,
  },
  profileLabel: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 4,
  },
  profileValue: {
    fontSize: 14,
  },
  settingOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  settingSubtitle: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
