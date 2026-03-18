import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert, Platform, Switch } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'expo-router';
import AdminHeader from './AdminHeader';

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { toggleTheme, isDarkMode } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [debugMode, setDebugMode] = useState(false);

  useEffect(() => {
    console.log('Admin ProfileScreen mounted');
    console.log('Admin User:', user);
    console.log('Admin Logout function type:', typeof logout);
    console.log('Admin Logout function:', logout);
  }, []);

  const handleLogout = async () => {
    console.log('===== ADMIN LOGOUT BUTTON CLICKED =====');
    console.log('handleLogout called');
    console.log('logout function exists:', typeof logout);
    console.log('user:', user);
    console.log('Platform:', Platform.OS);
    
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to logout?');
      if (!confirmed) return;
    } else {
      Alert.alert('Logout', 'Are you sure you want to logout?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (error) {
              console.error('Logout error:', error);
            }
          },
        },
      ]);
      return;
    }

    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const SettingRow = ({
    icon,
    label,
    value,
    onPress,
    rightElement,
  }: {
    icon: string;
    label: string;
    value?: string;
    onPress?: () => void;
    rightElement?: React.ReactNode;
  }) => (
    <TouchableOpacity
      style={[
        styles.settingRow,
        { borderBottomColor: colors.border, backgroundColor: colors.cardBackground },
      ]}
      onPress={onPress}
      activeOpacity={0.6}
      disabled={!onPress && !rightElement}>
      <View style={styles.settingLeft}>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: colors.tint + '20' },
          ]}>
          <IconSymbol name={icon as any} size={20} color={colors.tint} />
        </View>
        <View style={styles.settingContent}>
          <ThemedText style={styles.settingLabel}>{label}</ThemedText>
          {value && <ThemedText style={styles.settingValue}>{value}</ThemedText>}
        </View>
      </View>
      {rightElement ? (
        rightElement
      ) : (
        <IconSymbol name="chevron.right" size={18} color="#94a3b8" />
      )}
    </TouchableOpacity>
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
          <View style={[styles.profileCard, { backgroundColor: colors.cardBackground, borderBottomColor: colors.border }]}>
            <ThemedText style={styles.profileLabel}>Email</ThemedText>
            <ThemedText type="defaultSemiBold" style={styles.profileValue}>
              {user?.email || 'N/A'}
            </ThemedText>
          </View>
          <View style={[styles.profileCard, { backgroundColor: colors.cardBackground, borderBottomColor: colors.border }]}>
            <ThemedText style={styles.profileLabel}>Last Login</ThemedText>
            <ThemedText type="defaultSemiBold" style={styles.profileValue}>
              {user?.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
            </ThemedText>
          </View>
        </View>

        {/* Settings Section */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            Account Preferences
          </ThemedText>
          <View style={[styles.settingsContainer, { backgroundColor: colors.cardBackground }]}>
            <SettingRow
              icon="shield.fill"
              label="Change Password"
              onPress={() => {
                Alert.alert('Change Password', 'Password change feature will be available soon');
              }}
            />
            <SettingRow
              icon="key.fill"
              label="Two-Factor Authentication"
              value="Disabled"
              onPress={() => {
                Alert.alert('2FA', 'Two-factor authentication setup will be available soon');
              }}
            />
            <SettingRow
              icon="person.badge.shield.checkmark.fill"
              label="Security Settings"
              onPress={() => {
                Alert.alert('Security', 'Advanced security settings will be available soon');
              }}
            />
          </View>
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            Notifications
          </ThemedText>
          <View style={[styles.settingsContainer, { backgroundColor: colors.cardBackground }]}>
            <SettingRow
              icon="bell.fill"
              label="Enable Notifications"
              rightElement={
                <Switch
                  value={notificationsEnabled}
                  onValueChange={setNotificationsEnabled}
                  trackColor={{ false: '#ccc', true: colors.tint + '40' }}
                  thumbColor={notificationsEnabled ? colors.tint : '#f0f0f0'}
                />
              }
            />
            <SettingRow
              icon="envelope.badge.fill"
              label="Email Alerts"
              rightElement={
                <Switch
                  value={emailNotifications}
                  onValueChange={setEmailNotifications}
                  disabled={!notificationsEnabled}
                  trackColor={{ false: '#ccc', true: colors.tint + '40' }}
                  thumbColor={emailNotifications ? colors.tint : '#f0f0f0'}
                />
              }
            />
            <SettingRow
              icon="speaker.wave.2.fill"
              label="Sound"
              rightElement={
                <Switch
                  value={soundEnabled}
                  onValueChange={setSoundEnabled}
                  disabled={!notificationsEnabled}
                  trackColor={{ false: '#ccc', true: colors.tint + '40' }}
                  thumbColor={soundEnabled ? colors.tint : '#f0f0f0'}
                />
              }
            />
          </View>
        </View>

        {/* Appearance Section */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            Appearance
          </ThemedText>
          <View style={[styles.settingsContainer, { backgroundColor: colors.cardBackground }]}>
            <SettingRow
              icon="moon.fill"
              label="Dark Mode"
              rightElement={
                <Switch
                  value={isDarkMode}
                  onValueChange={toggleTheme}
                  trackColor={{ false: '#ccc', true: colors.tint + '40' }}
                  thumbColor={isDarkMode ? colors.tint : '#f0f0f0'}
                />
              }
            />
          </View>
        </View>

        {/* System Management Section */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            System Management
          </ThemedText>
          <View style={[styles.settingsContainer, { backgroundColor: colors.cardBackground }]}>
            <SettingRow
              icon="exclamationmark.triangle.fill"
              label="Maintenance Mode"
              rightElement={
                <Switch
                  value={maintenanceMode}
                  onValueChange={setMaintenanceMode}
                  trackColor={{ false: '#ccc', true: '#FF9500' }}
                  thumbColor={maintenanceMode ? '#FF9500' : '#f0f0f0'}
                />
              }
            />
            <SettingRow
              icon="ant.circle.fill"
              label="Debug Mode"
              rightElement={
                <Switch
                  value={debugMode}
                  onValueChange={setDebugMode}
                  trackColor={{ false: '#ccc', true: colors.tint + '40' }}
                  thumbColor={debugMode ? colors.tint : '#f0f0f0'}
                />
              }
            />
            <SettingRow
              icon="externaldrive.fill"
              label="Database Backup"
              onPress={() => {
                Alert.alert('Backup', 'Database backup initiated. This may take a few minutes.');
              }}
            />
            <SettingRow
              icon="arrow.counterclockwise"
              label="System Logs"
              onPress={() => {
                Alert.alert('Coming Soon', 'System logs viewer will be available soon');
              }}
            />
          </View>
        </View>

        {/* Logout Button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.logoutButton, { backgroundColor: '#FF3B30' }]}
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
    paddingBottom: 40,
  },
  profileHeader: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 20,
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
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.7,
  },
  profileCard: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    marginBottom: 8,
    borderRadius: 14,
  },
  profileLabel: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 4,
  },
  profileValue: {
    fontSize: 14,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 0,
    borderBottomWidth: 1,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  settingValue: {
    fontSize: 13,
    opacity: 0.6,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 16,
    gap: 8,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  settingsContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
});
