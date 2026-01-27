import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

const API_BASE_URL = 'http://localhost:5000/api';

interface DashboardStats {
  totalStudents: number;
  totalStaff: number;
  totalAttendanceRecords: number;
  totalLeaveRequests: number;
}

interface Analytics {
  summary: DashboardStats;
  attendance: { present: number; absent: number; late: number };
  leaves: { approved: number; pending: number; rejected: number };
  classDistribution: Array<{ _id: string; count: number }>;
  staffDistribution: Array<{ _id: string; count: number }>;
}

export default function AdminScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { token, user } = useAuth();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchDashboard();
  }, [token]);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/admin/analytics/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch analytics');

      const result = await response.json();
      setAnalytics(result.data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboard();
    setRefreshing(false);
  };

  const StatCard = ({ label, value }: { label: string; value: number }) => (
    <View style={[styles.statCard, styles.cardShadow]}>
      <ThemedText type="defaultSemiBold" style={styles.statValue}>
        {value}
      </ThemedText>
      <ThemedText style={styles.statLabel}>{label}</ThemedText>
    </View>
  );

  const ActionCard = ({
    icon,
    title,
    description,
    onPress,
  }: {
    icon: string;
    title: string;
    description: string;
    onPress: () => void;
  }) => (
    <TouchableOpacity style={[styles.actionCard, styles.cardShadow]} onPress={onPress}>
      <View style={styles.actionIconContainer}>
        <IconSymbol size={28} name={icon as any} color={Colors[colorScheme ?? 'light'].tint} />
      </View>
      <View style={styles.actionContent}>
        <ThemedText type="defaultSemiBold" style={styles.actionTitle}>
          {title}
        </ThemedText>
        <ThemedText style={styles.actionDescription}>{description}</ThemedText>
      </View>
    </TouchableOpacity>
  );

  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.center}>
          <ThemedText type="title">Access Denied</ThemedText>
          <ThemedText style={styles.errorText}>You don't have admin privileges</ThemedText>
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
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText type="title" style={styles.headerTitle}>
            Admin Dashboard
          </ThemedText>
          <ThemedText style={styles.subtitle}>Welcome {user.name}</ThemedText>
        </View>

        {/* Key Stats */}
        {analytics && (
          <>
            <View style={styles.statsContainer}>
              <StatCard label="Students" value={analytics.summary.totalStudents} />
              <StatCard label="Staff" value={analytics.summary.totalStaff} />
            </View>

            <View style={styles.statsContainer}>
              <StatCard label="Attendance" value={analytics.summary.totalAttendanceRecords} />
              <StatCard label="Leaves" value={analytics.summary.totalLeaveRequests} />
            </View>

            {/* Quick Stats */}
            <View style={styles.quickStatsContainer}>
              <View style={[styles.miniStat, styles.cardShadow, { backgroundColor: '#ffffff' }]}>
                <ThemedText style={styles.miniStatValue}>{analytics.attendance.present}</ThemedText>
                <ThemedText style={styles.miniStatLabel}>Present</ThemedText>
              </View>
              <View style={[styles.miniStat, styles.cardShadow, { backgroundColor: '#ffffff' }]}>
                <ThemedText style={styles.miniStatValue}>{analytics.attendance.absent}</ThemedText>
                <ThemedText style={styles.miniStatLabel}>Absent</ThemedText>
              </View>
              <View style={[styles.miniStat, styles.cardShadow, { backgroundColor: '#ffffff' }]}>
                <ThemedText style={styles.miniStatValue}>{analytics.attendance.late}</ThemedText>
                <ThemedText style={styles.miniStatLabel}>Late</ThemedText>
              </View>
            </View>
          </>
        )}

        {/* Management Actions */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            Management
          </ThemedText>

          <ActionCard
            icon="person.2.circle.fill"
            title="User & Role Management"
            description="Manage users, roles, permissions & status"
            onPress={() => router.push('/admin/users')}
          />

          <ActionCard
            icon="calendar.badge.clock"
            title="Timetable & Shifts"
            description="Configure class schedules & shift timings"
            onPress={() => router.push('/admin/timetable')}
          />

          <ActionCard
            icon="graduationcap.fill"
            title="Manage Students"
            description="Create, edit, delete students & view analytics"
            onPress={() => router.push('/admin/students')}
          />

          <ActionCard
            icon="person.3.fill"
            title="Manage Staff"
            description="Create, edit, delete staff & performance tracking"
            onPress={() => router.push('/admin/staff')}
          />

          <ActionCard
            icon="chart.bar.fill"
            title="View Analytics"
            description="Detailed attendance, leave & performance reports"
            onPress={() => router.push('/admin/analytics')}
          />

          <ActionCard
            icon="arrow.down.doc.fill"
            title="Export Data"
            description="Download system data as JSON"
            onPress={() => router.push('/admin/export')}
          />
        </View>

        {/* Leave Stats */}
        {analytics && (
          <View style={styles.section}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              Leave Requests
            </ThemedText>
            <View style={styles.leaveStatsRow}>
              <View style={[styles.leaveStat, styles.cardShadow]}>
                <ThemedText style={styles.leaveStatValue}>{analytics.leaves.approved}</ThemedText>
                <ThemedText style={styles.leaveStatLabel}>Approved</ThemedText>
              </View>
              <View style={[styles.leaveStat, styles.cardShadow]}>
                <ThemedText style={styles.leaveStatValue}>{analytics.leaves.pending}</ThemedText>
                <ThemedText style={styles.leaveStatLabel}>Pending</ThemedText>
              </View>
              <View style={[styles.leaveStat, styles.cardShadow]}>
                <ThemedText style={styles.leaveStatValue}>{analytics.leaves.rejected}</ThemedText>
                <ThemedText style={styles.leaveStatLabel}>Rejected</ThemedText>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
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
    paddingHorizontal: 16,
  },
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.6,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  statValue: {
    fontSize: 24,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
  },
  quickStatsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  miniStat: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  miniStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  miniStatLabel: {
    fontSize: 11,
    opacity: 0.7,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    marginBottom: 12,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  actionIconContainer: {
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: 12,
    opacity: 0.6,
  },
  leaveStatsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  leaveStat: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  leaveStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  leaveStatLabel: {
    fontSize: 11,
    opacity: 0.7,
  },
  errorText: {
    color: '#ff4444',
    marginTop: 8,
  },
  cardShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
