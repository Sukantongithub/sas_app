import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';

const API_BASE_URL = 'http://localhost:5000/api';

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  studentId?: {
    rollNumber: string;
    class: string;
    section: string;
  };
}

const ROLES = ['super_admin', 'admin', 'faculty', 'teacher', 'student', 'parent', 'staff', 'hr'];

export default function UserManagementScreen() {
  const colorScheme = useColorScheme();
  const { token, user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchUsers();
  }, [token, filterRole, filterStatus, searchQuery]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterRole) params.append('role', filterRole);
      if (filterStatus) params.append('isActive', filterStatus);
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`${API_BASE_URL}/admin/users?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch users');

      const result = await response.json();
      setUsers(result.data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/status`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (!response.ok) throw new Error('Failed to update user status');

      Alert.alert('Success', `User ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
      await fetchUsers();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update user status');
    }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    if (user?.role !== 'super_admin') {
      Alert.alert('Permission Denied', 'Only super admins can change user roles');
      return;
    }

    Alert.alert(
      'Change Role',
      `Are you sure you want to change this user's role to ${newRole}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/role`, {
                method: 'PUT',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ role: newRole }),
              });

              if (!response.ok) throw new Error('Failed to update role');

              Alert.alert('Success', 'User role updated successfully');
              await fetchUsers();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to update role');
            }
          },
        },
      ]
    );
  };

  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.center}>
          <ThemedText type="title">Access Denied</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <ThemedText type="title">User & Role Management</ThemedText>
          <ThemedText style={styles.subtitle}>Total: {users.length} users</ThemedText>
        </View>

        {/* Search Bar */}
        <View style={[styles.searchContainer, styles.cardShadow]}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, email, or phone..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Filters */}
        <View style={[styles.filterContainer, styles.cardShadow]}>
          <ThemedText type="defaultSemiBold" style={styles.filterTitle}>
            Filters
          </ThemedText>

          <ThemedText style={styles.filterLabel}>Role</ThemedText>
          <ScrollView horizontal style={styles.filterScroll}>
            <TouchableOpacity
              style={[styles.filterButton, !filterRole && styles.filterButtonActive]}
              onPress={() => setFilterRole('')}>
              <ThemedText
                style={[styles.filterButtonText, !filterRole && styles.filterButtonTextActive]}>
                All
              </ThemedText>
            </TouchableOpacity>
            {ROLES.map((role) => (
              <TouchableOpacity
                key={role}
                style={[styles.filterButton, filterRole === role && styles.filterButtonActive]}
                onPress={() => setFilterRole(role)}>
                <ThemedText
                  style={[
                    styles.filterButtonText,
                    filterRole === role && styles.filterButtonTextActive,
                  ]}>
                  {role}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ThemedText style={styles.filterLabel}>Status</ThemedText>
          <View style={styles.statusFilterRow}>
            <TouchableOpacity
              style={[styles.filterButton, !filterStatus && styles.filterButtonActive]}
              onPress={() => setFilterStatus('')}>
              <ThemedText
                style={[styles.filterButtonText, !filterStatus && styles.filterButtonTextActive]}>
                All
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filterStatus === 'true' && styles.filterButtonActive]}
              onPress={() => setFilterStatus('true')}>
              <ThemedText
                style={[
                  styles.filterButtonText,
                  filterStatus === 'true' && styles.filterButtonTextActive,
                ]}>
                Active
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filterStatus === 'false' && styles.filterButtonActive]}
              onPress={() => setFilterStatus('false')}>
              <ThemedText
                style={[
                  styles.filterButtonText,
                  filterStatus === 'false' && styles.filterButtonTextActive,
                ]}>
                Inactive
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Users List */}
        <FlatList
          scrollEnabled={false}
          data={users}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <View style={[styles.userCard, styles.cardShadow]}>
              <View style={styles.userHeader}>
                <View style={styles.userInfo}>
                  <ThemedText type="defaultSemiBold" style={styles.userName}>
                    {item.name}
                  </ThemedText>
                  <ThemedText style={styles.userDetail}>{item.email}</ThemedText>
                  {item.phone && <ThemedText style={styles.userDetail}>📱 {item.phone}</ThemedText>}
                  {item.studentId && (
                    <ThemedText style={styles.userDetail}>
                      Roll: {item.studentId.rollNumber} | {item.studentId.class}-
                      {item.studentId.section}
                    </ThemedText>
                  )}
                  {item.lastLogin && (
                    <ThemedText style={styles.userDetail}>
                      Last login: {new Date(item.lastLogin).toLocaleDateString()}
                    </ThemedText>
                  )}
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: item.isActive ? '#4caf50' : '#f44336' },
                  ]}>
                  <ThemedText style={styles.statusBadgeText}>
                    {item.isActive ? 'Active' : 'Inactive'}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.userActions}>
                <View style={[styles.roleBadge, getRoleColor(item.role)]}>
                  <ThemedText style={styles.roleBadgeText}>{item.role}</ThemedText>
                </View>

                {user.role === 'super_admin' && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                      // Show role picker
                      const buttons = ROLES.map((role) => ({
                        text: role,
                        onPress: () => handleChangeRole(item._id, role),
                      }));
                      buttons.push({ text: 'Cancel', onPress: async () => Promise.resolve() });
                      Alert.alert('Change Role', 'Select new role', buttons as any);
                    }}>
                    <ThemedText style={styles.actionButtonText}>Change Role</ThemedText>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    { backgroundColor: item.isActive ? '#f44336' : '#4caf50' },
                  ]}
                  onPress={() => handleToggleStatus(item._id, item.isActive)}>
                  <ThemedText style={[styles.actionButtonText, { color: '#fff' }]}>
                    {item.isActive ? 'Deactivate' : 'Activate'}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      </ScrollView>
    </ThemedView>
  );
}

function getRoleColor(role: string) {
  const colors: Record<string, object> = {
    super_admin: { backgroundColor: '#e91e63' },
    admin: { backgroundColor: '#9c27b0' },
    teacher: { backgroundColor: '#2196f3' },
    faculty: { backgroundColor: '#00bcd4' },
    student: { backgroundColor: '#4caf50' },
    parent: { backgroundColor: '#ff9800' },
    staff: { backgroundColor: '#795548' },
    hr: { backgroundColor: '#607d8b' },
  };
  return colors[role] || { backgroundColor: '#9e9e9e' };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f8fa',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.6,
    marginTop: 4,
  },
  searchContainer: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 14,
    marginBottom: 16,
  },
  searchInput: {
    fontSize: 14,
    padding: 8,
  },
  filterContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
  },
  filterTitle: {
    fontSize: 16,
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 8,
    opacity: 0.7,
  },
  filterScroll: {
    marginBottom: 12,
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  statusFilterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#2196f3',
    borderColor: '#2196f3',
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  userCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    marginBottom: 4,
  },
  userDetail: {
    fontSize: 13,
    opacity: 0.7,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  userActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
});
