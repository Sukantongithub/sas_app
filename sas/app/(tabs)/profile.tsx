import { StyleSheet, View, TouchableOpacity, ScrollView, Alert } from 'react-native';
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

  const handleLogout = async () => {
    try {
      await logout();
      // Navigate to login only after logout completes
      router.replace('/login');
    } catch (error: any) {
      console.error('Logout error:', error);
      Alert.alert('Error', error?.message || 'Logout failed. Please try again.');
      // Still navigate to login even if logout fails on backend
      router.replace('/login');
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
    <ScrollView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Profile</ThemedText>
      </ThemedView>

      <ThemedView style={styles.profileCard}>
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}>
            <IconSymbol name="person.fill" size={48} color="#fff" />
          </View>
        </View>

        <ThemedText type="title" style={styles.userName}>
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

      <ThemedView style={styles.infoSection}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Account Information
        </ThemedText>

        <View style={styles.infoRow}>
          <IconSymbol name="envelope.fill" size={20} color={Colors[colorScheme ?? 'light'].tint} />
          <View style={styles.infoContent}>
            <ThemedText style={styles.infoLabel}>Email</ThemedText>
            <ThemedText style={styles.infoValue}>{user?.email}</ThemedText>
          </View>
        </View>

        <View style={styles.infoRow}>
          <IconSymbol name="person.fill" size={20} color={Colors[colorScheme ?? 'light'].tint} />
          <View style={styles.infoContent}>
            <ThemedText style={styles.infoLabel}>Role</ThemedText>
            <ThemedText style={styles.infoValue}>
              {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'N/A'}
            </ThemedText>
          </View>
        </View>

        {user?.lastLogin && (
          <View style={styles.infoRow}>
            <IconSymbol name="clock.fill" size={20} color={Colors[colorScheme ?? 'light'].tint} />
            <View style={styles.infoContent}>
              <ThemedText style={styles.infoLabel}>Last Login</ThemedText>
              <ThemedText style={styles.infoValue}>
                {new Date(user.lastLogin).toLocaleString()}
              </ThemedText>
            </View>
          </View>
        )}
      </ThemedView>

      <TouchableOpacity
        style={[styles.logoutButton, { backgroundColor: '#F44336' }]}
        onPress={handleLogout}>
        <IconSymbol name="arrow.right.square.fill" size={20} color="#fff" />
        <ThemedText style={styles.logoutText}>Logout</ThemedText>
      </TouchableOpacity>

      <View style={styles.footer}>
        <ThemedText style={styles.footerText}>
          Attendance Management System v1.0
        </ThemedText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 20,
    paddingTop: 50,
  },
  profileCard: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
  },
  avatarContainer: {
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontSize: 24,
    marginBottom: 4,
    fontWeight: '700',
  },
  userEmail: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 16,
  },
  roleBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  roleText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  infoSection: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
  },
  sectionTitle: {
    marginBottom: 16,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  infoContent: {
    marginLeft: 16,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 2,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 8,
    shadowColor: '#F44336',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  footerText: {
    fontSize: 12,
    opacity: 0.5,
  },
});
