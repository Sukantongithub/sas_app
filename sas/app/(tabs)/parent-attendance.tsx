import { useState, useEffect } from 'react';
import { StyleSheet, FlatList, View, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';
import { studentManagementAPI, attendanceAPI } from '@/services/api';
import CommonHeader from '@/components/CommonHeader';

interface Child {
  _id: string;
  name: string;
  rollNumber?: string;
  class?: string;
  section?: string;
  userId?: string;
}

interface AttendanceStats {
  totalClasses: number;
  present: number;
  absent: number;
  late: number;
  percentage: number;
}

export default function ParentAttendanceScreen() {
  const colorScheme = useColorScheme();
  const { user, token } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<'children' | 'details'>('children');
  const [activeTab, setActiveTab] = useState<'day' | 'subject' | 'semester'>('day');

  useEffect(() => {
    if (token) {
      fetchChildren();
    }
  }, [token]);

  useEffect(() => {
    if (token && selectedChild && view === 'details') {
      fetchAttendanceForChild(selectedChild);
    }
  }, [activeTab]);

  const fetchChildren = async () => {
    if (!token) return;
    setLoading(true);
    try {
      // Fetch parent's children only
      const response = await studentManagementAPI.getMyChildren(token);

      if (response?.success && response.data && response.data.length > 0) {
        // Map all children with their User IDs
        const childrenList = response.data.map((student: any) => ({
          _id: student._id,
          name: student.name,
          rollNumber: student.rollNumber,
          class: student.class,
          section: student.section,
          userId: student.userId  // Include the student's User account ID
        }));
        
        setChildren(childrenList);
        setSelectedChild(childrenList[0]);
        setView('details');
        await fetchAttendanceForChild(childrenList[0]);
      } else {
        Alert.alert('No Children', 'No children linked to your account');
        setView('children');
      }
    } catch (error) {
      console.error('Error fetching children:', error);
      Alert.alert('Error', 'Failed to load children information');
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceForChild = async (child: Child) => {
    if (!token || !child._id) {
      console.warn('Cannot fetch attendance: missing token or child id');
      return;
    }

    setLoading(true);
    try {
      let data: any;
      if (activeTab === 'day') {
        data = await attendanceAPI.getStudentDaily(child._id, undefined, token);
      } else if (activeTab === 'subject') {
        data = await attendanceAPI.getStudentSubjectWise(child._id, undefined, token);
      } else {
        data = await attendanceAPI.getStudentMonthly(child._id, undefined, undefined, token);
      }

      if (activeTab === 'day') {
        const records = Array.isArray(data?.records) ? data.records : [];
        setAttendance(records);
        setStats({
          totalClasses: Number(data?.summary?.totalPeriods || records.length || 0),
          present: Number(data?.summary?.present || 0),
          absent: Number(data?.summary?.absent || 0),
          late: Number(data?.summary?.late || 0),
          percentage: records.length > 0
            ? Number(((Number(data?.summary?.present || 0) / records.length) * 100).toFixed(2))
            : 0,
        });
      } else if (activeTab === 'subject') {
        const subjectWise = Array.isArray(data?.subjectWise) ? data.subjectWise : [];
        setAttendance(subjectWise);

        const present = subjectWise.reduce((sum: number, item: any) => sum + Number(item?.present || 0), 0);
        const absent = subjectWise.reduce((sum: number, item: any) => sum + Number(item?.absent || 0), 0);
        const late = subjectWise.reduce((sum: number, item: any) => sum + Number(item?.late || 0), 0);
        const totalClasses = subjectWise.reduce((sum: number, item: any) => sum + Number(item?.total || 0), 0);

        setStats({
          totalClasses,
          present,
          absent,
          late,
          percentage: totalClasses > 0 ? Number(((present / totalClasses) * 100).toFixed(2)) : 0,
        });
      } else {
        const records = Array.isArray(data?.dailyBreakdown) ? data.dailyBreakdown : [];
        setAttendance(records);

        const monthlyStats = data?.monthlyStats || {};
        setStats({
          totalClasses: Number(monthlyStats?.totalClasses || 0),
          present: Number(monthlyStats?.present || 0),
          absent: Number(monthlyStats?.absent || 0),
          late: Number(monthlyStats?.late || 0),
          percentage: Number(monthlyStats?.percentage || 0),
        });
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
      setAttendance([]);
      setStats(null);
      Alert.alert('Error', 'Failed to load attendance details for the selected child');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectChild = (child: Child) => {
    setSelectedChild(child);
    setView('details');
    fetchAttendanceForChild(child);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (selectedChild) {
      await fetchAttendanceForChild(selectedChild);
    }
    setRefreshing(false);
  };

  const renderAttendanceCard = (item: any) => (
    <ThemedView style={[styles.attendanceCard, { marginHorizontal: 16 }]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardContent}>
          <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
            {activeTab === 'day'
              ? new Date(item.date).toLocaleDateString()
              : activeTab === 'subject'
                ? item.subject
                : new Date(item.date).toLocaleDateString()}
          </ThemedText>
          <ThemedText style={styles.cardSubtitle}>
            {activeTab === 'day' && `Status: ${item.status}`}
            {activeTab === 'subject' && `Total: ${item.total} | Present: ${item.present}`}
            {activeTab === 'semester' && `Total: ${item.total} | Present: ${item.present}`}
          </ThemedText>
        </View>
        {activeTab === 'day' ? (
          <View style={[
            styles.statusBadge,
            { backgroundColor: item.status === 'present' ? '#4CAF50' : item.status === 'absent' ? '#F44336' : '#FF9800' }
          ]}>
            <ThemedText style={styles.statusText}>
              {item.status?.charAt(0).toUpperCase() + item.status?.slice(1)}
            </ThemedText>
          </View>
        ) : (
          <View style={[
            styles.statusBadge,
            { backgroundColor: Number(item?.percentage || 0) >= 75 ? '#4CAF50' : Number(item?.percentage || 0) >= 60 ? '#FF9800' : '#F44336' }
          ]}>
            <ThemedText style={styles.statusText}>
              {Number(item?.percentage || 0).toFixed(1)}%
            </ThemedText>
          </View>
        )}
      </View>
    </ThemedView>
  );

  if (!user) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Loading...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <CommonHeader title="Son's Attendance" />

      {view === 'children' ? (
        <>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
            </View>
          ) : children.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol name="person.crop.circle.badge.xmark" size={48} color={Colors[colorScheme ?? 'light'].text} />
              <ThemedText style={styles.emptyText}>No children found</ThemedText>
            </View>
          ) : (
            <FlatList
              data={children}
              keyExtractor={(item) => item._id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item: child }) => (
                <TouchableOpacity
                  onPress={() => handleSelectChild(child)}
                  activeOpacity={0.7}>
                  <ThemedView style={[styles.childCard, { marginHorizontal: 16 }]}>
                    <View style={styles.childAvatar}>
                      <IconSymbol name="person.circle.fill" size={40} color={Colors[colorScheme ?? 'light'].tint} />
                    </View>
                    <View style={styles.childInfo}>
                      <ThemedText type="defaultSemiBold">{child.name}</ThemedText>
                      <ThemedText style={styles.childDetails}>
                        Roll: {child.rollNumber} | Class: {child.class}
                      </ThemedText>
                      {child.section && <ThemedText style={styles.childDetails}>Section: {child.section}</ThemedText>}
                    </View>
                    <IconSymbol name="chevron.right" size={18} color="#94a3b8" />
                  </ThemedView>
                </TouchableOpacity>
              )}
            />
          )}
        </>
      ) : (
        <>
          {/* Child Info Header */}
          <View style={[styles.childInfoHeader, { marginHorizontal: 16, marginTop: 12 }]}>
            <TouchableOpacity onPress={() => setView('children')} style={styles.backButton}>
              <IconSymbol name="chevron.left" size={20} color={Colors[colorScheme ?? 'light'].tint} />
              <ThemedText style={styles.backText}>Back</ThemedText>
            </TouchableOpacity>
            <View style={styles.childNameSection}>
              <ThemedText type="defaultSemiBold">{selectedChild?.name}</ThemedText>
              <ThemedText style={styles.childClassInfo}>
                Class {selectedChild?.class} {selectedChild?.section ? `- ${selectedChild.section}` : ''}
              </ThemedText>
            </View>
          </View>

          {/* Attendance Stats */}
          {stats && (
            <View style={[styles.statsContainer, { marginHorizontal: 16, marginTop: 12 }]}>
              <View style={styles.statBox}>
                <ThemedText style={styles.statLabel}>Percentage</ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.statValue}>
                  {stats.percentage}%
                </ThemedText>
              </View>
              <View style={styles.statBox}>
                <ThemedText style={styles.statLabel}>Present</ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.statValue}>
                  {stats.present}
                </ThemedText>
              </View>
              <View style={styles.statBox}>
                <ThemedText style={styles.statLabel}>Absent</ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.statValue}>
                  {stats.absent}
                </ThemedText>
              </View>
            </View>
          )}

          {/* Tab Selection */}
          <View style={[styles.tabContainer, { marginHorizontal: 12, marginTop: 16 }]}>
            {(['day', 'subject', 'semester'] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[
                  styles.tab,
                  activeTab === tab && styles.tabActive
                ]}>
                <ThemedText style={[
                  styles.tabLabel,
                  activeTab === tab && styles.tabLabelActive
                ]}>
                  {tab === 'day' ? 'Day' : tab === 'subject' ? 'Subject' : 'Semester'}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          {/* Attendance List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
            </View>
          ) : (
            <FlatList
              data={attendance}
              keyExtractor={(item, index) => String(item?._id || item?.subject || item?.date || index)}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              renderItem={({ item }) => renderAttendanceCard(item)}
            />
          )}
        </>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    opacity: 0.6,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 20,
  },
  childCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
    gap: 12,
  },
  childAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  childInfo: {
    flex: 1,
  },
  childDetails: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  childInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    fontSize: 14,
  },
  childNameSection: {
    flex: 1,
  },
  childClassInfo: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  statBox: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    opacity: 0.6,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#007AFF',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.6,
  },
  tabLabelActive: {
    color: '#fff',
    opacity: 1,
  },
  attendanceCard: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  cardSubtitle: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
});
