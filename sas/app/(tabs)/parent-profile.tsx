import { StyleSheet, View, TouchableOpacity, ScrollView, Alert, Platform, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/AuthContext';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { router } from 'expo-router';
import CommonHeader from '@/components/CommonHeader';
import ChangePasswordModal from '@/components/ChangePasswordModal';
import { studentManagementAPI } from '@/services/api';

interface StudentProfile {
  _id: string;
  name: string;
  registerNumber?: string;
  rollNumber?: string;
  className?: string;
  class?: string;
  section?: string;
  fatherName?: string;
  motherName?: string;
  advisorName?: string;
  [key: string]: any;
}

export default function ParentProfileScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user, logout, token } = useAuth();
  const [changePasswordVisible, setChangePasswordVisible] = useState(false);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const fetchStudentProfile = async () => {
    if (!token) {
      setLoadingProfile(false);
      return;
    }

    try {
      // Fetch all students to get parent's child (first match)
      const response = await studentManagementAPI.listStudents(
        { limit: 100 },
        token
      );

      if (response?.success && response.data?.students && response.data.students.length > 0) {
        const student = response.data.students[0];
        
        // Fetch detailed student profile
        const detailedResponse = await studentManagementAPI.getStudentProfile(
          student._id,
          token
        );

        if (detailedResponse?.success && detailedResponse.data) {
          setStudentProfile(detailedResponse.data);
        }
      }
    } catch (error) {
      console.error('Error fetching student profile:', error);
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    fetchStudentProfile();
  }, [token]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Logout failed. Please try again.');
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'parent':
        return '#9C27B0';
      default:
        return Colors[colorScheme ?? 'light'].tint;
    }
  };

  return (
    <ThemedView style={styles.container}>
      <CommonHeader title="My Profile" />

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        
        {/* Parent Profile Card */}
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

        {/* Parent Account Information */}
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

          {user?.lastLogin && (
            <View style={[styles.infoRow, styles.infoRowBorder]}>
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

        {/* Son Information */}
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Son Information
        </ThemedText>

        <View style={[styles.infoCard, { marginHorizontal: 16 }]}>
          {loadingProfile ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.tint} />
            </View>
          ) : studentProfile ? (
            <>
              <View style={styles.infoRow}>
                <IconSymbol name="person.fill" size={18} color={Colors[colorScheme ?? 'light'].tint} />
                <View style={styles.infoContent}>
                  <ThemedText style={styles.infoLabel}>Name</ThemedText>
                  <ThemedText style={styles.infoValue}>{studentProfile.name}</ThemedText>
                </View>
              </View>

              {(studentProfile?.registerNumber || studentProfile?.rollNumber) && (
                <View style={[styles.infoRow, styles.infoRowBorder]}>
                  <IconSymbol name="number.circle.fill" size={18} color={Colors[colorScheme ?? 'light'].tint} />
                  <View style={styles.infoContent}>
                    <ThemedText style={styles.infoLabel}>Register Number</ThemedText>
                    <ThemedText style={styles.infoValue}>
                      {studentProfile.registerNumber || studentProfile.rollNumber}
                    </ThemedText>
                  </View>
                </View>
              )}

              {(studentProfile?.className || studentProfile?.class) && (
                <View style={[styles.infoRow, styles.infoRowBorder]}>
                  <IconSymbol name="book.fill" size={18} color={Colors[colorScheme ?? 'light'].tint} />
                  <View style={styles.infoContent}>
                    <ThemedText style={styles.infoLabel}>Class</ThemedText>
                    <ThemedText style={styles.infoValue}>
                      {studentProfile.className || studentProfile.class}
                    </ThemedText>
                  </View>
                </View>
              )}

              {studentProfile?.section && (
                <View style={[styles.infoRow, styles.infoRowBorder]}>
                  <IconSymbol name="list.number" size={18} color={Colors[colorScheme ?? 'light'].tint} />
                  <View style={styles.infoContent}>
                    <ThemedText style={styles.infoLabel}>Section</ThemedText>
                    <ThemedText style={styles.infoValue}>{studentProfile.section}</ThemedText>
                  </View>
                </View>
              )}

              {studentProfile?.advisorName && (
                <View style={styles.infoRow}>
                  <IconSymbol name="person.2.badge.fill" size={18} color={Colors[colorScheme ?? 'light'].tint} />
                  <View style={styles.infoContent}>
                    <ThemedText style={styles.infoLabel}>Advisor</ThemedText>
                    <ThemedText style={styles.infoValue}>{studentProfile.advisorName}</ThemedText>
                  </View>
                </View>
              )}
            </>
          ) : (
            <View style={styles.noDataContainer}>
              <ThemedText style={styles.noDataText}>No son information available</ThemedText>
            </View>
          )}
        </View>

        {/* Security Section */}
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Security
        </ThemedText>

        <View style={[styles.infoCard, { marginHorizontal: 16, marginBottom: 24 }]}>
          <TouchableOpacity
            style={styles.infoRow}
            onPress={() => setChangePasswordVisible(true)}
            activeOpacity={0.6}>
            <IconSymbol name="lock.fill" size={18} color={Colors[colorScheme ?? 'light'].tint} />
            <View style={styles.infoContent}>
              <ThemedText style={styles.infoLabel}>Password</ThemedText>
              <ThemedText style={styles.infoValue}>Change your password</ThemedText>
            </View>
            <IconSymbol name="chevron.right" size={18} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={[styles.logoutButton, { marginHorizontal: 16, marginTop: 24 }]}
          onPress={handleLogout}
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

      <ChangePasswordModal 
        visible={changePasswordVisible}
        onClose={() => setChangePasswordVisible(false)}
      />
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
    paddingBottom: 40,
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
    marginTop: 16,
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
  loadingContainer: {
    paddingVertical: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataContainer: {
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 13,
    opacity: 0.6,
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
