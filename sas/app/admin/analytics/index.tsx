import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';
import AdminHeader from '../AdminHeader';

const API_BASE_URL = 'http://localhost:5000/api';

export default function AnalyticsScreen() {
  const colorScheme = useColorScheme();
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'attendance' | 'staff' | 'leave'>(
    'dashboard'
  );
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [dateFilter, setDateFilter] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    fetchAnalytics();
  }, [token, activeTab]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      let url = '';

      switch (activeTab) {
        case 'dashboard':
          url = `${API_BASE_URL}/admin/analytics/dashboard`;
          break;
        case 'attendance':
          url = `${API_BASE_URL}/admin/analytics/attendance?startDate=${dateFilter.startDate}&endDate=${dateFilter.endDate}`;
          break;
        case 'staff':
          url = `${API_BASE_URL}/admin/analytics/staff-performance`;
          break;
        case 'leave':
          url = `${API_BASE_URL}/admin/analytics/leave-analytics`;
          break;
      }

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch analytics');

      const result = await response.json();
      setData(result.data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
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

  return (
    <ThemedView style={styles.container}>
      <AdminHeader title="Analytics & Reports" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <ThemedText style={styles.subtitle}>Detailed Reports & Analytics</ThemedText>
        </View>

        {/* Tab Navigation */}
        <ScrollView horizontal style={styles.tabScroll} showsHorizontalScrollIndicator={false}>
          {(['dashboard', 'attendance', 'staff', 'leave'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
              onPress={() => setActiveTab(tab)}>
              <ThemedText
                style={[
                  styles.tabText,
                  activeTab === tab && { color: Colors[colorScheme ?? 'light'].tint },
                ]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
          </View>
        ) : (
          <>
            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && data && (
              <View>
                <View style={styles.section}>
                  <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                    Summary
                  </ThemedText>
                  <View style={styles.statsGrid}>
                    <StatBox label="Students" value={data.summary.totalStudents} />
                    <StatBox label="Staff" value={data.summary.totalStaff} />
                  </View>
                  <View style={styles.statsGrid}>
                    <StatBox label="Attendance" value={data.summary.totalAttendanceRecords} />
                    <StatBox label="Leaves" value={data.summary.totalLeaveRequests} />
                  </View>
                </View>

                <View style={styles.section}>
                  <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                    Attendance Status
                  </ThemedText>
                  <View style={styles.statsGrid}>
                    <StatBox label="Present" value={data.attendance.present} color="#4CAF50" />
                    <StatBox label="Absent" value={data.attendance.absent} color="#f44336" />
                    <StatBox label="Late" value={data.attendance.late} color="#ff9800" />
                  </View>
                </View>
              </View>
            )}

            {/* Attendance Tab */}
            {activeTab === 'attendance' && (
              <View>
                <View style={styles.filterContainer}>
                  <TextInput
                    style={styles.dateInput}
                    placeholder="Start Date (YYYY-MM-DD)"
                    value={dateFilter.startDate}
                    onChangeText={(text) => setDateFilter({ ...dateFilter, startDate: text })}
                  />
                  <TextInput
                    style={styles.dateInput}
                    placeholder="End Date (YYYY-MM-DD)"
                    value={dateFilter.endDate}
                    onChangeText={(text) => setDateFilter({ ...dateFilter, endDate: text })}
                  />
                  <TouchableOpacity style={styles.filterButton} onPress={fetchAnalytics}>
                    <ThemedText style={styles.filterButtonText}>Filter</ThemedText>
                  </TouchableOpacity>
                </View>

                {data?.byClass && (
                  <View style={styles.section}>
                    <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                      By Class
                    </ThemedText>
                    {data.byClass.map((item: any) => (
                      <View key={item.class} style={styles.listItem}>
                        <View>
                          <ThemedText style={styles.itemLabel}>{item.class}</ThemedText>
                          <ThemedText style={styles.itemDetail}>
                            Present: {item.present} | Absent: {item.absent} | Late: {item.late}
                          </ThemedText>
                        </View>
                        <ThemedText style={styles.percentage}>{item.percentage}%</ThemedText>
                      </View>
                    ))}
                  </View>
                )}

                {data?.byStudent && (
                  <View style={styles.section}>
                    <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                      Top Performers
                    </ThemedText>
                    {data.byStudent.slice(0, 5).map((item: any) => (
                      <View key={item.name} style={styles.listItem}>
                        <View>
                          <ThemedText style={styles.itemLabel}>{item.name}</ThemedText>
                          <ThemedText style={styles.itemDetail}>{item.rollNumber}</ThemedText>
                        </View>
                        <ThemedText style={styles.percentage}>{item.percentage}%</ThemedText>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Staff Tab */}
            {activeTab === 'staff' && data && (
              <View>
                {data.staffPerformance?.slice(0, 10).map((item: any) => (
                  <View key={item._id} style={styles.listItem}>
                    <View style={styles.itemContent}>
                      <ThemedText style={styles.itemLabel}>{item.name}</ThemedText>
                      <ThemedText style={styles.itemDetail}>{item.designation}</ThemedText>
                      <ThemedText style={styles.itemDetail}>{item.department}</ThemedText>
                    </View>
                    <View style={styles.ratingBox}>
                      <ThemedText style={styles.ratingText}>
                        Rating: {item.performanceRating}/5
                      </ThemedText>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Leave Tab */}
            {activeTab === 'leave' && data && (
              <View>
                <View style={styles.section}>
                  <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                    Leave Status Summary
                  </ThemedText>
                  <View style={styles.statsGrid}>
                    <StatBox label="Approved" value={data.leaveStatusSummary.approved} color="#4CAF50" />
                    <StatBox label="Pending" value={data.leaveStatusSummary.pending} color="#ff9800" />
                    <StatBox label="Rejected" value={data.leaveStatusSummary.rejected} color="#f44336" />
                  </View>
                </View>

                <View style={styles.section}>
                  <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                    Top Leave Takers
                  </ThemedText>
                  {data.topLeaveTakers?.slice(0, 10).map((item: any) => (
                    <View key={item.name} style={styles.listItem}>
                      <View>
                        <ThemedText style={styles.itemLabel}>{item.name}</ThemedText>
                        <ThemedText style={styles.itemDetail}>{item.role}</ThemedText>
                      </View>
                      <ThemedText style={styles.percentage}>{item.totalLeaves} leaves</ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

function StatBox({
  label,
  value,
  color = '#007AFF',
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <View style={[styles.statBox, { borderLeftColor: color }]}>
      <ThemedText type="defaultSemiBold" style={{ color, fontSize: 20 }}>
        {value}
      </ThemedText>
      <ThemedText style={styles.statLabel}>{label}</ThemedText>
    </View>
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
  tabScroll: {
    marginBottom: 20,
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginRight: 8,
  },
  activeTab: {
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontWeight: '600',
    fontSize: 14,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(0, 122, 255, 0.08)',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  filterContainer: {
    gap: 12,
    marginBottom: 20,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
  },
  filterButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  filterButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  listItem: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 122, 255, 0.08)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemContent: {
    flex: 1,
  },
  itemLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  itemDetail: {
    fontSize: 12,
    opacity: 0.6,
  },
  percentage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  ratingBox: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
