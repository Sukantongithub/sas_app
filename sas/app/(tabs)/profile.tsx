import { StyleSheet, View, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { useEffect } from 'react';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/AuthContext';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { router } from 'expo-router';

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const { user, logout } = useAuth();

  useEffect(() => {
    console.log('ProfileScreen mounted');
    console.log('User:', user);
    console.log('Logout function type:', typeof logout);
    console.log('Logout function:', logout);
  }, []);

  const handleLogout = async () => {
    console.log('===== LOGOUT BUTTON CLICKED =====');
    console.log('handleLogout called');
    console.log('logout function exists:', typeof logout);
    console.log('user:', user);
    console.log('Platform:', Platform.OS);
    
    // Optional confirmation for web
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to logout?');
      console.log('Web confirm result:', confirmed);
      if (!confirmed) {
        console.log('Logout cancelled');
        return;
      }
    }
    
    try {
      console.log('Profile: About to call logout()');
      await logout();
      console.log('Profile: logout() completed successfully');
    } catch (error: any) {
      console.error('Profile: Logout error:', error);
      if (Platform.OS === 'web') {
        window.alert('Logout failed: ' + (error?.message || 'Please try again'));
      } else {
        Alert.alert('Error', error?.message || 'Logout failed. Please try again.');
      }
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return '#F44336';
      case 'teacher':
        return '#2196F3';
      case 'student':
        return '#4CAF50';
      default:
        return Colors[colorScheme ?? 'light'].tint;
    }
  };

  return (
    <ThemedView style={styles.container}>
      {/* Card-Style Compact Header */}
      <View style={[styles.compactHeader, { backgroundColor: Colors[colorScheme ?? 'light'].tint + '12' }]}>
        <View style={styles.compactHeaderContent}>
          <View style={styles.headerIconLeft}>
            <IconSymbol name="person.crop.circle.fill" size={24} color={Colors[colorScheme ?? 'light'].tint} />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText type="title" style={styles.headerTitle}>My Profile</ThemedText>
            <ThemedText style={styles.headerSubtitle}>{user?.role?.charAt(0).toUpperCase()}{user?.role?.slice(1)}</ThemedText>
          </View>
          <View style={styles.headerIconRight}>
            <IconSymbol name="gear.circle.fill" size={24} color={Colors[colorScheme ?? 'light'].tint} />
          </View>
        </View>
      </View>

      {/* Profile Info Card */}
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        
        <ThemedView style={[styles.profileCard, { marginHorizontal: 16 }]}>
          <View style={styles.avatarContainer}>
            <View style={[styles.avatar, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}>
              <ThemedText style={styles.avatarInitial}>
                {user?.name?.charAt(0).toUpperCase()}
              </ThemedText>
            </View>
          </View>

          <ThemedText type="defaultSemiBold" style={styles.userName}>
            {user?.name}
          </ThemedText>
          <ThemedText style={styles.userEmail}>
            {user?.email}
          </ThemedText>

          <View style={[styles.roleBadge, { backgroundColor: getRoleBadgeColor(user?.role || '') }]}>
            <ThemedText style={styles.roleText}>
              {user?.role?.toUpperCase()}
            </ThemedText>
          </View>
        </ThemedView>

        {/* Account Information */}
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Account Information
        </ThemedText>

        <View style={[styles.infoCard, { marginHorizontal: 16 }]}>
          <View style={styles.infoRow}>
            <IconSymbol name="envelope.fill" size={18} color={Colors[colorScheme ?? 'light'].tint} />
            <View style={styles.infoContent}>
              <ThemedText style={styles.infoLabel}>Email</ThemedText>
              <ThemedText style={styles.infoValue}>{user?.email}</ThemedText>
            </View>
          </View>

          <View style={[styles.infoRow, styles.infoRowBorder]}>
            <IconSymbol name="person.fill" size={18} color={Colors[colorScheme ?? 'light'].tint} />
            <View style={styles.infoContent}>
              <ThemedText style={styles.infoLabel}>Role</ThemedText>
              <ThemedText style={styles.infoValue}>
                {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'N/A'}
              </ThemedText>
            </View>
          </View>

          {user?.lastLogin && (
            <View style={styles.infoRow}>
              <IconSymbol name="clock.fill" size={18} color={Colors[colorScheme ?? 'light'].tint} />
              <View style={styles.infoContent}>
                <ThemedText style={styles.infoLabel}>Last Login</ThemedText>
                <ThemedText style={styles.infoValue}>
                  {new Date(user.lastLogin).toLocaleString()}
                </ThemedText>
              </View>
            </View>
          )}
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={[styles.logoutButton, { marginHorizontal: 16 }]}
          onPress={() => {
            console.log('LOGOUT BUTTON ONPRESS TRIGGERED');
            handleLogout();
          }}
          activeOpacity={0.85}>
          <IconSymbol name="arrow.right.square.fill" size={18} color="#fff" />
          <ThemedText style={styles.logoutText}>Logout</ThemedText>
        </TouchableOpacity>

        <View style={styles.footer}>
          <ThemedText style={styles.footerText}>
            Attendance Management System v1.0
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  compactHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  compactHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconLeft: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconRight: {
    opacity: 0.5,
  },
  headerTitle: {
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    opacity: 0.6,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 20,
  },
  profileCard: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 8,
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  avatarContainer: {
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarInitial: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  userName: {
    fontSize: 18,
    marginBottom: 2,
    fontWeight: '600',
  },
  userEmail: {
    fontSize: 13,
    opacity: 0.6,
    marginBottom: 12,
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  roleText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  sectionTitle: {
    marginLeft: 16,
    marginBottom: 10,
    fontSize: 14,
    fontWeight: '600',
  },
  infoCard: {
    borderRadius: 12,
    marginBottom: 16,
    marginTop: 2,
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 12,
  },
  infoRowBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.15)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.15)',
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    opacity: 0.6,
    marginBottom: 2,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F44336',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 11,
    marginBottom: 16,
    marginTop: 8,
    gap: 8,
    shadowColor: '#F44336',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  logoutText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  footerText: {
    fontSize: 12,
    opacity: 0.5,
  },
});
