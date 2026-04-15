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
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';
import AdminHeader from '@/app/admin/AdminHeader';

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

const ROLES = ['super_admin', 'admin', 'hod', 'staff', 'student', 'parent'];

export default function UserManagementScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { token, user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [studentUsers, setStudentUsers] = useState<User[]>([]);
  const [selectedStudentUserId, setSelectedStudentUserId] = useState('');
  const [deviceIdInput, setDeviceIdInput] = useState('');
  const [assigningDevice, setAssigningDevice] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [token, filterRole, filterStatus, searchQuery]);

  useEffect(() => {
    fetchStudentUsers();
  }, [token]);

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

  const fetchStudentUsers = async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/admin/users?role=student&isActive=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch students for device mapping');

      const result = await response.json();
      const items = Array.isArray(result?.data) ? result.data : [];
      setStudentUsers(items);

      if (!selectedStudentUserId && items.length > 0) {
        setSelectedStudentUserId(items[0]._id);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to fetch students');
    }
  };

  const handleAssignDevice = async () => {
    const normalizedDeviceId = String(deviceIdInput || '').trim().toUpperCase().replace(/[:-]/g, '');

    if (!selectedStudentUserId) {
      Alert.alert('Validation', 'Please select a student user');
      return;
    }

    if (!normalizedDeviceId) {
      Alert.alert('Validation', 'Please enter a valid Device ID');
      return;
    }

    try {
      setAssigningDevice(true);
      const response = await fetch(`${API_BASE_URL}/admin/devices/assign`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedStudentUserId,
          deviceId: normalizedDeviceId,
          hardwareModel: 'ESP32-C3',
          imuModel: 'other',
          firmwareVersion: '1.0.0',
          txPower: -59,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Failed to assign device');
      }

      Alert.alert('Success', `Device ${normalizedDeviceId} mapped successfully`);
      setDeviceIdInput('');
    } catch (error: any) {
      Alert.alert('Device Mapping Failed', error.message || 'Unable to map device');
    } finally {
      setAssigningDevice(false);
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
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AdminHeader title="User & Role Management" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <ThemedText style={styles.subtitle}>Total: {users.length} users</ThemedText>
        </View>

        <View style={[styles.mappingContainer, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <ThemedText type="defaultSemiBold" style={styles.mappingTitle}>Quick Device Mapping</ThemedText>
          <ThemedText lightColor={colors.textSecondary} darkColor={colors.textSecondary} style={styles.mappingHint}>
            Select a student and map a hardware Device ID
          </ThemedText>

          <ThemedText lightColor={colors.textSecondary} darkColor={colors.textSecondary} style={styles.filterLabel}>Student</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            {studentUsers.map((student) => (
              <TouchableOpacity
                key={student._id}
                style={[
                  styles.filterButton,
                  { borderColor: colors.border },
                  selectedStudentUserId === student._id && { backgroundColor: colors.tint, borderColor: colors.tint },
                ]}
                onPress={() => setSelectedStudentUserId(student._id)}>
                <ThemedText style={[styles.filterButtonText, selectedStudentUserId === student._id && { color: '#FFFFFF' }]}>
                  {student.name}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ThemedText lightColor={colors.textSecondary} darkColor={colors.textSecondary} style={styles.filterLabel}>Device ID</ThemedText>
          <View style={[styles.searchContainer, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Example: ID_001"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="characters"
              value={deviceIdInput}
              onChangeText={setDeviceIdInput}
            />
          </View>

          <TouchableOpacity
            style={[styles.assignButton, { backgroundColor: colors.tint }, assigningDevice && { opacity: 0.7 }]}
            disabled={assigningDevice}
            onPress={handleAssignDevice}>
            {assigningDevice ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <ThemedText style={styles.assignButtonText}>Save Device Mapping</ThemedText>
            )}
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search by name, email, or phone..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Filters */}
        <View style={[styles.filterContainer, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <ThemedText type="defaultSemiBold" style={styles.filterTitle}>
            Filters
          </ThemedText>

          <ThemedText lightColor={colors.textSecondary} darkColor={colors.textSecondary} style={styles.filterLabel}>Role</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <TouchableOpacity
              style={[
                styles.filterButton,
                { borderColor: colors.border },
                !filterRole && { backgroundColor: colors.tint, borderColor: colors.tint },
              ]}
              onPress={() => setFilterRole('')}>
              <ThemedText style={[styles.filterButtonText, !filterRole && { color: '#FFFFFF' }]}>
                All
              </ThemedText>
            </TouchableOpacity>
            {ROLES.map((role) => (
              <TouchableOpacity
                key={role}
                style={[
                  styles.filterButton,
                  { borderColor: colors.border },
                  filterRole === role && { backgroundColor: colors.tint, borderColor: colors.tint },
                ]}
                onPress={() => setFilterRole(role)}>
                <ThemedText style={[styles.filterButtonText, filterRole === role && { color: '#FFFFFF' }]}>
                  {role}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ThemedText lightColor={colors.textSecondary} darkColor={colors.textSecondary} style={styles.filterLabel}>Status</ThemedText>
          <View style={styles.statusFilterRow}>
            <TouchableOpacity
              style={[
                styles.filterButton,
                { borderColor: colors.border },
                !filterStatus && { backgroundColor: colors.tint, borderColor: colors.tint },
              ]}
              onPress={() => setFilterStatus('')}>
              <ThemedText style={[styles.filterButtonText, !filterStatus && { color: '#FFFFFF' }]}>
                All
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                { borderColor: colors.border },
                filterStatus === 'true' && { backgroundColor: colors.tint, borderColor: colors.tint },
              ]}
              onPress={() => setFilterStatus('true')}>
              <ThemedText style={[styles.filterButtonText, filterStatus === 'true' && { color: '#FFFFFF' }]}>
                Active
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                { borderColor: colors.border },
                filterStatus === 'false' && { backgroundColor: colors.tint, borderColor: colors.tint },
              ]}
              onPress={() => setFilterStatus('false')}>
              <ThemedText style={[styles.filterButtonText, filterStatus === 'false' && { color: '#FFFFFF' }]}>
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
            <View style={[styles.userCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <View style={styles.userHeader}>
                <View style={styles.userInfo}>
                  <ThemedText type="defaultSemiBold" style={styles.userName}>
                    {item.name}
                  </ThemedText>
                  <ThemedText lightColor={colors.textSecondary} darkColor={colors.textSecondary} style={styles.userDetail}>
                    {item.email}
                  </ThemedText>
                  {item.phone && (
                    <View style={styles.userDetailRow}>
                      <IconSymbol size={16} name="phone.fill" color={colors.tint} />
                      <ThemedText lightColor={colors.textSecondary} darkColor={colors.textSecondary} style={styles.userDetail}>
                        {item.phone}
                      </ThemedText>
                    </View>
                  )}
                  {item.studentId && (
                    <ThemedText lightColor={colors.textSecondary} darkColor={colors.textSecondary} style={styles.userDetail}>
                      Roll: {item.studentId.rollNumber} | {item.studentId.class}-{item.studentId.section}
                    </ThemedText>
                  )}
                  {item.lastLogin && (
                    <ThemedText lightColor={colors.textSecondary} darkColor={colors.textSecondary} style={styles.userDetail}>
                      Last login: {new Date(item.lastLogin).toLocaleDateString()}
                    </ThemedText>
                  )}
                </View>
                <View style={[styles.statusBadge, { backgroundColor: item.isActive ? colors.success : colors.error }]}>
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
                    style={[styles.actionButton, { backgroundColor: colors.border }]}
                    onPress={() => {
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
                  style={[styles.actionButton, { backgroundColor: item.isActive ? colors.error : colors.success }]}
                  onPress={() => handleToggleStatus(item._id, item.isActive)}>
                  <ThemedText style={[styles.actionButtonText, { color: '#FFFFFF' }]}>
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
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 24,
  },
  mappingContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  mappingTitle: {
    fontSize: 17,
    marginBottom: 6,
  },
  mappingHint: {
    fontSize: 13,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    marginTop: 6,
  },
  searchContainer: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  searchInput: {
    fontSize: 15,
    padding: 4,
  },
  assignButton: {
    marginTop: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  assignButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  filterContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
  },
  filterTitle: {
    fontSize: 17,
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 10,
  },
  filterScroll: {
    marginBottom: 8,
  },
  statusFilterRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    marginRight: 8,
    marginBottom: 8,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  userCard: {
    padding: 18,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  userInfo: {
    flex: 1,
    marginRight: 12,
  },
  userName: {
    fontSize: 17,
    marginBottom: 6,
  },
  userDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  userDetail: {
    fontSize: 14,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  userActions: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  roleBadge: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
  },
  roleBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
