import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';

const API_BASE_URL = 'http://localhost:5000/api';

interface DashboardStats {
  totalStudents: number;
  totalStaff: number;
  totalAttendanceRecords: number;
  totalLeaveRequests: number;
}

interface AttendanceStats {
  present: number;
  absent: number;
  late: number;
}

interface AdminDashboard {
  summary: DashboardStats;
  attendance: AttendanceStats;
  leaves: {
    approved: number;
    pending: number;
    rejected: number;
  };
  classDistribution: Array<{ _id: string; count: number }>;
  staffDistribution: Array<{ _id: string; count: number }>;
}

export default function AdminDashboardScreen() {
  const colorScheme = useColorScheme();
  const { token } = useAuth();
  const [analytics, setAnalytics] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'management'>('overview');

  useEffect(() => {
    fetchDashboard();
  }, [token]);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/admin/analytics/dashboard`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch dashboard data');

      const result = await response.json();
      setAnalytics(result.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard');
      Alert.alert('Error', err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleManageStudents = () => {
    Alert.alert(
      'Students Management',
      'Navigate to Students Management Panel',
      [{ text: 'OK' }]
    );
  };

  const handleManageStaff = () => {
    Alert.alert(
      'Staff Management',
      'Navigate to Staff Management Panel',
      [{ text: 'OK' }]
    );
  };

  const StatCard = ({ label, value, color }: { label: string; value: number | string; color: string }) => (
    <View style={[styles.statCard, { backgroundColor: color }]}>
      <ThemedText style={styles.statNumber}>{value}</ThemedText>
      <ThemedText style={styles.statLabel}>{label}</ThemedText>
    </View>
  );

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText type="title" style={styles.headerTitle}>
            Admin Dashboard
          </ThemedText>
          <ThemedText style={styles.headerSubtitle}>
            System Overview & Analytics
          </ThemedText>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
            onPress={() => setActiveTab('overview')}>
            <ThemedText
              style={[
                styles.tabText,
                activeTab === 'overview' && { color: Colors[colorScheme ?? 'light'].tint },
              ]}>
              Overview
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'analytics' && styles.activeTab]}
            onPress={() => setActiveTab('analytics')}>
            <ThemedText
              style={[
                styles.tabText,
                activeTab === 'analytics' && { color: Colors[colorScheme ?? 'light'].tint },
              ]}>
              Analytics
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'management' && styles.activeTab]}
            onPress={() => setActiveTab('management')}>
            <ThemedText
              style={[
                styles.tabText,
                activeTab === 'management' && { color: Colors[colorScheme ?? 'light'].tint },
              ]}>
              Management
            </ThemedText>
          </TouchableOpacity>
        </View>

        {error && (
          <ThemedView style={styles.errorBanner}>
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </ThemedView>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && analytics && (
          <View>
            {/* Summary Stats */}
            <View style={styles.statsGrid}>
              <StatCard
                label="Total Students"
                value={analytics.summary.totalStudents}
                color="rgba(66, 165, 245, 0.2)"
              />
              <StatCard
                label="Total Staff"
                value={analytics.summary.totalStaff}
                color="rgba(156, 39, 176, 0.2)"
              />
            </View>

            <View style={styles.statsGrid}>
              <StatCard
                label="Attendance Records"
                value={analytics.summary.totalAttendanceRecords}
                color="rgba(76, 175, 80, 0.2)"
              />
              <StatCard
                label="Leave Requests"
                value={analytics.summary.totalLeaveRequests}
                color="rgba(255, 152, 0, 0.2)"
              />
            </View>

            {/* Attendance Summary */}
            <View style={styles.section}>
              <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                Attendance Summary
              </ThemedText>
              <View style={styles.statsGrid}>
                <View style={[styles.miniCard, { backgroundColor: 'rgba(76, 175, 80, 0.2)' }]}>
                  <ThemedText style={styles.miniNumber}>
                    {analytics.attendance.present}
                  </ThemedText>
                  <ThemedText style={styles.miniLabel}>Present</ThemedText>
                </View>
                <View style={[styles.miniCard, { backgroundColor: 'rgba(244, 67, 54, 0.2)' }]}>
                  <ThemedText style={styles.miniNumber}>
                    {analytics.attendance.absent}
                  </ThemedText>
                  <ThemedText style={styles.miniLabel}>Absent</ThemedText>
                </View>
                <View style={[styles.miniCard, { backgroundColor: 'rgba(255, 152, 0, 0.2)' }]}>
                  <ThemedText style={styles.miniNumber}>
                    {analytics.attendance.late}
                  </ThemedText>
                  <ThemedText style={styles.miniLabel}>Late</ThemedText>
                </View>
              </View>
            </View>

            {/* Leave Summary */}
            <View style={styles.section}>
              <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                Leave Requests
              </ThemedText>
              <View style={styles.statsGrid}>
                <View style={[styles.miniCard, { backgroundColor: 'rgba(76, 175, 80, 0.2)' }]}>
                  <ThemedText style={styles.miniNumber}>
                    {analytics.leaves.approved}
                  </ThemedText>
                  <ThemedText style={styles.miniLabel}>Approved</ThemedText>
                </View>
                <View style={[styles.miniCard, { backgroundColor: 'rgba(255, 193, 7, 0.2)' }]}>
                  <ThemedText style={styles.miniNumber}>
                    {analytics.leaves.pending}
                  </ThemedText>
                  <ThemedText style={styles.miniLabel}>Pending</ThemedText>
                </View>
                <View style={[styles.miniCard, { backgroundColor: 'rgba(244, 67, 54, 0.2)' }]}>
                  <ThemedText style={styles.miniNumber}>
                    {analytics.leaves.rejected}
                  </ThemedText>
                  <ThemedText style={styles.miniLabel}>Rejected</ThemedText>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && analytics && (
          <View>
            {/* Class Distribution */}
            <View style={styles.section}>
              <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                Class Distribution
              </ThemedText>
              {analytics.classDistribution.map((item) => (
                <View key={item._id} style={styles.listItem}>
                  <ThemedText style={styles.listLabel}>{item._id}</ThemedText>
                  <ThemedText style={styles.listValue}>{item.count} students</ThemedText>
                </View>
              ))}
            </View>

            {/* Staff Distribution */}
            <View style={styles.section}>
              <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                Staff Distribution
              </ThemedText>
              {analytics.staffDistribution.map((item) => (
                <View key={item._id} style={styles.listItem}>
                  <ThemedText style={styles.listLabel}>
                    {item._id.replace('_', ' ').toUpperCase()}
                  </ThemedText>
                  <ThemedText style={styles.listValue}>{item.count}</ThemedText>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Management Tab */}
        {activeTab === 'management' && (
          <View>
            <View style={styles.section}>
              <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                Management Tools
              </ThemedText>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleManageStudents}>
                <IconSymbol size={24} name="graduationcap.fill" color={Colors[colorScheme ?? 'light'].tint} />
                <View style={styles.actionButtonContent}>
                  <ThemedText style={styles.actionButtonText}>
                    Manage Students
                  </ThemedText>
                  <ThemedText style={styles.actionButtonSubtext}>
                    Create, Edit, Delete, View Analytics
                  </ThemedText>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleManageStaff}>
                <IconSymbol size={24} name="person.3.fill" color={Colors[colorScheme ?? 'light'].tint} />
                <View style={styles.actionButtonContent}>
                  <ThemedText style={styles.actionButtonText}>
                    Manage Staff
                  </ThemedText>
                  <ThemedText style={styles.actionButtonSubtext}>
                    Create, Edit, Delete, Performance Tracking
                  </ThemedText>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton}>
                <IconSymbol size={24} name="chart.bar.fill" color={Colors[colorScheme ?? 'light'].tint} />
                <View style={styles.actionButtonContent}>
                  <ThemedText style={styles.actionButtonText}>
                    View Reports
                  </ThemedText>
                  <ThemedText style={styles.actionButtonSubtext}>
                    Attendance, Leave, Performance Reports
                  </ThemedText>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton}>
                <IconSymbol size={24} name="arrow.down.doc.fill" color={Colors[colorScheme ?? 'light'].tint} />
                <View style={styles.actionButtonContent}>
                  <ThemedText style={styles.actionButtonText}>
                    Export Data
                  </ThemedText>
                  <ThemedText style={styles.actionButtonSubtext}>
                    Export analytics to JSON/CSV
                  </ThemedText>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Refresh Button */}
        <TouchableOpacity style={styles.refreshButton} onPress={fetchDashboard}>
          <IconSymbol size={20} name="arrow.clockwise" color="#fff" />
          <ThemedText style={styles.refreshButtonText}>Refresh</ThemedText>
        </TouchableOpacity>
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
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorBanner: {
    backgroundColor: '#ff444420',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    marginBottom: 12,
  },
  miniCard: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  miniNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  miniLabel: {
    fontSize: 11,
    opacity: 0.7,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  listLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  listValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  actionButton: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionButtonContent: {
    flex: 1,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  actionButtonSubtext: {
    fontSize: 12,
    opacity: 0.7,
  },
  refreshButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  refreshButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
