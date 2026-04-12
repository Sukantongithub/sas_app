import { StyleSheet, View, TouchableOpacity, ScrollView, Alert, Platform, Switch, ActivityIndicator } from 'react-native';
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
  registerNumber?: string;
  className?: string;
  section?: string;
  parentName?: string;
  parentNames?: string[];
  fatherName?: string;
  motherName?: string;
  [key: string]: any;
}

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user, logout, token } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [changePasswordVisible, setChangePasswordVisible] = useState(false);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Fetch student profile on mount (only for students)
  const fetchStudentProfile = async () => {
    if (!token || !user) {
      console.log('⚠️ Missing token or user', { tokenExists: !!token, userExists: !!user });
      setLoadingProfile(false);
      return;
    }

    // Only fetch student profile if user is a student
    if (user.role !== 'student') {
      console.log('ℹ️ User is not a student (role:', user.role + '), skipping student profile fetch');
      setLoadingProfile(false);
      return;
    }

    // Extract ID - handle both string and object formats
    let profileId = null;
    
    if (user?.studentId) {
      profileId = typeof user.studentId === 'string' ? user.studentId : user.studentId?._id || user.studentId?.id;
    } else if (user?.id) {
      profileId = typeof user.id === 'string' ? user.id : user.id?._id || user.id?.id;
    } else if (user?._id) {
      profileId = typeof user._id === 'string' ? user._id : user._id?._id || user._id?.id;
    }

    console.log('🔍 Fetching student profile - User object:', { 
      studentId: user.studentId, 
      id: user.id, 
      _id: user._id,
      extractedProfileId: profileId
    });

    if (!profileId) {
      console.log('⚠️ No valid profile ID found');
      setLoadingProfile(false);
      return;
    }

    try {
      console.log('📤 Fetching profile for:', { profileId, userRole: user.role });
      const response = await studentManagementAPI.getStudentProfile(profileId, token);
      console.log('📥 Profile Response:', response);
      
      if (response?.success && response.data) {
        console.log('✅ Student Profile Set:', response.data);
        console.log('   Parent Details:', response.data.parentDetails);
        setStudentProfile(response.data);
      } else {
        console.warn('❌ Response not successful:', response);
      }
    } catch (error) {
      console.error('❌ Error fetching student profile:', error);
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    console.log('[PROFILE] ProfileScreen mounted - user role:', user?.role);
    console.log('[PROFILE] User details:', user);
    fetchStudentProfile();
  }, [user?.role, token]);

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
      <CommonHeader title="My Profile" />

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        
        {/* Profile Card */}
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

            {/* Student Information */}
            {user?.role === 'student' && (
              <>
                <ThemedText type="subtitle" style={styles.sectionTitle}>
                  Academic Details
                </ThemedText>

                <View style={[styles.infoCard, { marginHorizontal: 16 }]}>
                  {loadingProfile ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color={colors.tint} />
                    </View>
                  ) : (
                    <>
                      {studentProfile?.registerNumber && (
                        <View style={styles.infoRow}>
                          <IconSymbol name="number.circle.fill" size={18} color={Colors[colorScheme ?? 'light'].tint} />
                          <View style={styles.infoContent}>
                            <ThemedText style={styles.infoLabel}>Register Number</ThemedText>
                            <ThemedText style={styles.infoValue}>{studentProfile.registerNumber}</ThemedText>
                          </View>
                        </View>
                      )}

                      {(studentProfile?.className || studentProfile?.class) && (
                        <View style={[styles.infoRow, studentProfile?.section ? styles.infoRowBorder : {}]}>
                          <IconSymbol name="book.fill" size={18} color={Colors[colorScheme ?? 'light'].tint} />
                          <View style={styles.infoContent}>
                            <ThemedText style={styles.infoLabel}>Class</ThemedText>
                            <ThemedText style={styles.infoValue}>{studentProfile.className || studentProfile.class}</ThemedText>
                          </View>
                        </View>
                      )}

                      {studentProfile?.section && (
                        <View style={styles.infoRow}>
                          <IconSymbol name="list.number" size={18} color={Colors[colorScheme ?? 'light'].tint} />
                          <View style={styles.infoContent}>
                            <ThemedText style={styles.infoLabel}>Section</ThemedText>
                            <ThemedText style={styles.infoValue}>{studentProfile.section}</ThemedText>
                          </View>
                        </View>
                      )}
                    </>
                  )}
                </View>

                {/* Parent Information */}
                <ThemedText type="subtitle" style={styles.sectionTitle}>
                  Parent/Guardian Details
                </ThemedText>

                <View style={[styles.infoCard, { marginHorizontal: 16 }]}>
                  {loadingProfile ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color={colors.tint} />
                    </View>
                  ) : studentProfile?.parentDetails && studentProfile.parentDetails.length > 0 ? (
                    <>
                      {studentProfile.parentDetails.map((parent: any, index: number) => (
                        <View 
                          key={parent._id || index}
                          style={[
                            styles.infoRow, 
                            index < studentProfile.parentDetails.length - 1 ? styles.infoRowBorder : {}
                          ]}>
                          <IconSymbol name="person.fill" size={18} color={Colors[colorScheme ?? 'light'].tint} />
                          <View style={styles.infoContent}>
                            <ThemedText style={styles.infoLabel}>{parent.name}</ThemedText>
                            <ThemedText style={styles.infoValue}>
                              {parent.mobileNumber ? `📞 ${parent.mobileNumber}` : 'No phone'}
                            </ThemedText>
                            {parent.email && (
                              <ThemedText style={[styles.infoValue, { fontSize: 12, marginTop: 2 }]}>
                                📧 {parent.email}
                              </ThemedText>
                            )}
                          </View>
                        </View>
                      ))}
                    </>
                  ) : (
                    <ThemedText style={styles.infoValue}>No parent information available</ThemedText>
                  )}
                </View>
              </>
            )}

            {/* Change Password Section */}
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
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 16,
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
    borderRadius: 8,
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
  logoutContainer: {
    paddingTop: 24,
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
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  expandedSettings: {
    paddingTop: 4,
  },
  loadingContainer: {
    paddingVertical: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
