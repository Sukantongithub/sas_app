import { useState, useEffect } from 'react';
import { StyleSheet, FlatList, View, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, Share } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';
import { attendanceAPI } from '@/services/api';
import CommonHeader from '@/components/CommonHeader';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

interface DailyRecord {
  _id: string;
  date: string;
  subject?: string;
  entryTime?: Date;
  exitTime?: Date;
  status: AttendanceStatus;
  verificationMethod?: string;
}

interface SubjectStats {
  subject: string;
  total: number;
  present: number;
  absent: number;
  late: number;
  percentage: number;
}

interface MonthlyStats {
  totalClasses: number;
  present: number;
  absent: number;
  late: number;
  percentage: number;
}

interface TimeRecord {
  _id: string;
  date: string;
  subject: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  entryTime?: Date;
  exitTime?: Date;
  duration?: number;
  status: AttendanceStatus;
}

export default function StudentAttendanceScreen() {
  const colorScheme = useColorScheme();
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState<'day' | 'subject' | 'semester'>('day');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [dailyData, setDailyData] = useState<{ records: DailyRecord[]; summary: any } | null>(null);
  const [subjectData, setSubjectData] = useState<{ subjectWise: SubjectStats[]; records: any[] } | null>(null);
  const [monthlyData, setMonthlyData] = useState<{ monthlyStats: MonthlyStats; dailyBreakdown: any[] } | null>(null);
  const [timeRecords, setTimeRecords] = useState<TimeRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Use user.id (User document _id) for the API call
  // The backend middleware will handle checking if this matches the logged-in user
  const studentId = user?.id;

  useEffect(() => {
    if (studentId) {
      fetchData();
    }
  }, [activeTab, studentId]);

  const fetchData = async () => {
    if (!studentId || !token) return;

    setLoading(true);
    try {
      switch (activeTab) {
        case 'day':
          const daily = await attendanceAPI.getStudentDaily(studentId, selectedDate, token);
          setDailyData(daily);
          break;
        case 'subject':
          const subject = await attendanceAPI.getStudentSubjectWise(studentId, {}, token);
          setSubjectData(subject);
          break;
        case 'semester':
          const monthly = await attendanceAPI.getStudentMonthly(studentId, new Date().getFullYear(), new Date().getMonth() + 1, token);
          setMonthlyData(monthly);
          break;
      }
    } catch (error: any) {
      console.error('Error fetching attendance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleDownloadReport = async () => {
    if (!token || !studentId) {
      Alert.alert('Error', 'User information not available');
      return;
    }

    try {
      Alert.alert('Download Report', 'Choose format', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'CSV',
          onPress: async () => {
            try {
              const csv = await attendanceAPI.downloadAttendanceReport(studentId, 'csv', token);
              // Share the CSV data
              await Share.share({
                message: csv,
                title: 'Attendance Report',
              });
            } catch (error: any) {
              Alert.alert('Error', 'Failed to download report');
            }
          },
        },
        {
          text: 'JSON',
          onPress: async () => {
            try {
              const json = await attendanceAPI.downloadAttendanceReport(studentId, 'json', token);
              // Share the JSON data
              await Share.share({
                message: JSON.stringify(json, null, 2),
                title: 'Attendance Report',
              });
            } catch (error: any) {
              Alert.alert('Error', 'Failed to download report');
            }
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to process request');
    }
  };

  const getStatusColor = (status: AttendanceStatus) => {
    switch (status) {
      case 'present': return '#4CAF50';
      case 'absent': return '#F44336';
      case 'late': return '#FF9800';
      case 'excused': return '#2196F3';
      default: return '#999';
    }
  };

  const getStatusIcon = (status: AttendanceStatus) => {
    switch (status) {
      case 'present': return 'checkmark.circle.fill' as const;
      case 'absent': return 'xmark.circle.fill' as const;
      case 'late': return 'clock.fill' as const;
      case 'excused': return 'exclamationmark.circle.fill' as const;
      default: return 'questionmark.circle' as const;
    }
  };

  const formatTime = (time?: Date | string) => {
    if (!time) return 'N/A';
    const date = new Date(time);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const renderDailyView = () => {
    if (!dailyData) return null;

    return (
      <View>
        <ThemedView style={styles.summaryCard}>
          <ThemedText type="subtitle">Today's Summary</ThemedText>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <ThemedText style={styles.summaryNumber}>{dailyData.summary.totalPeriods}</ThemedText>
              <ThemedText style={styles.summaryLabel}>Total Periods</ThemedText>
            </View>
            <View style={styles.summaryItem}>
              <ThemedText style={[styles.summaryNumber, { color: '#4CAF50' }]}>{dailyData.summary.present}</ThemedText>
              <ThemedText style={styles.summaryLabel}>Present</ThemedText>
            </View>
            <View style={styles.summaryItem}>
              <ThemedText style={[styles.summaryNumber, { color: '#F44336' }]}>{dailyData.summary.absent}</ThemedText>
              <ThemedText style={styles.summaryLabel}>Absent</ThemedText>
            </View>
            <View style={styles.summaryItem}>
              <ThemedText style={[styles.summaryNumber, { color: '#FF9800' }]}>{dailyData.summary.late}</ThemedText>
              <ThemedText style={styles.summaryLabel}>Late</ThemedText>
            </View>
          </View>
        </ThemedView>

        <ThemedText type="subtitle" style={styles.sectionTitle}>Period-wise Attendance</ThemedText>
        {dailyData.records.map((record, index) => (
          <ThemedView key={record._id} style={styles.recordCard}>
            <View style={styles.recordHeader}>
              <View>
                <ThemedText type="defaultSemiBold">{record.subject || `Period ${index + 1}`}</ThemedText>
                <ThemedText style={styles.recordTime}>
                  {formatTime(record.entryTime)} {record.exitTime ? `- ${formatTime(record.exitTime)}` : ''}
                </ThemedText>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(record.status) }]}>
                <IconSymbol name={getStatusIcon(record.status)} size={16} color="#fff" />
                <ThemedText style={styles.statusText}>{record.status.toUpperCase()}</ThemedText>
              </View>
            </View>
          </ThemedView>
        ))}
      </View>
    );
  };

  const renderSubjectView = () => {
    if (!subjectData) return null;

    return (
      <View>
        <ThemedText type="subtitle" style={styles.sectionTitle}>Subject-wise Attendance</ThemedText>
        {subjectData.subjectWise.map((subject) => (
          <ThemedView key={subject.subject} style={styles.subjectCard}>
            <View style={styles.subjectHeader}>
              <ThemedText type="defaultSemiBold">{subject.subject}</ThemedText>
              <ThemedText style={[
                styles.percentage,
                { color: subject.percentage >= 75 ? '#4CAF50' : '#F44336' }
              ]}>
                {subject.percentage.toFixed(1)}%
              </ThemedText>
            </View>
            <View style={styles.progressBar}>
              <View style={[
                styles.progressFill,
                {
                  width: `${subject.percentage}%`,
                  backgroundColor: subject.percentage >= 75 ? '#4CAF50' : '#F44336'
                }
              ]} />
            </View>
            <View style={styles.subjectStats}>
              <View style={styles.subjectStatItem}>
                <ThemedText style={styles.subjectStatNumber}>{subject.present}</ThemedText>
                <ThemedText style={styles.subjectStatLabel}>Present</ThemedText>
              </View>
              <View style={styles.subjectStatItem}>
                <ThemedText style={styles.subjectStatNumber}>{subject.absent}</ThemedText>
                <ThemedText style={styles.subjectStatLabel}>Absent</ThemedText>
              </View>
              <View style={styles.subjectStatItem}>
                <ThemedText style={styles.subjectStatNumber}>{subject.late}</ThemedText>
                <ThemedText style={styles.subjectStatLabel}>Late</ThemedText>
              </View>
              <View style={styles.subjectStatItem}>
                <ThemedText style={styles.subjectStatNumber}>{subject.total}</ThemedText>
                <ThemedText style={styles.subjectStatLabel}>Total</ThemedText>
              </View>
            </View>
          </ThemedView>
        ))}
      </View>
    );
  };

  const renderMonthlyView = () => {
    if (!monthlyData) return null;

    const percentage = monthlyData.monthlyStats.percentage;

    return (
      <View>
        <ThemedView style={styles.monthlyCard}>
          <ThemedText type="subtitle">Monthly Overview</ThemedText>
          <View style={styles.monthlyCircle}>
            <ThemedText style={[
              styles.monthlyPercentage,
              { color: percentage >= 75 ? '#4CAF50' : '#F44336' }
            ]}>
              {percentage.toFixed(1)}%
            </ThemedText>
            <ThemedText style={styles.monthlyLabel}>Attendance</ThemedText>
          </View>
          <View style={styles.monthlyStats}>
            <View style={styles.monthlyStatItem}>
              <IconSymbol name="checkmark.circle.fill" size={20} color="#4CAF50" />
              <ThemedText style={styles.monthlyStatNumber}>{monthlyData.monthlyStats.present}</ThemedText>
              <ThemedText style={styles.monthlyStatLabel}>Present</ThemedText>
            </View>
            <View style={styles.monthlyStatItem}>
              <IconSymbol name="xmark.circle.fill" size={20} color="#F44336" />
              <ThemedText style={styles.monthlyStatNumber}>{monthlyData.monthlyStats.absent}</ThemedText>
              <ThemedText style={styles.monthlyStatLabel}>Absent</ThemedText>
            </View>
            <View style={styles.monthlyStatItem}>
              <IconSymbol name="clock.fill" size={20} color="#FF9800" />
              <ThemedText style={styles.monthlyStatNumber}>{monthlyData.monthlyStats.late}</ThemedText>
              <ThemedText style={styles.monthlyStatLabel}>Late</ThemedText>
            </View>
          </View>
        </ThemedView>

        <ThemedText type="subtitle" style={styles.sectionTitle}>Daily Breakdown</ThemedText>
        {monthlyData.dailyBreakdown.map((day) => {
          const dayPercentage = day.total > 0 ? (day.present / day.total) * 100 : 0;
          return (
            <ThemedView key={day.date} style={styles.dailyBreakdownCard}>
              <View style={styles.dailyBreakdownHeader}>
                <ThemedText type="defaultSemiBold">
                  {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </ThemedText>
                <ThemedText style={{ color: dayPercentage >= 75 ? '#4CAF50' : '#F44336' }}>
                  {dayPercentage.toFixed(0)}%
                </ThemedText>
              </View>
              <View style={styles.dailyBreakdownStats}>
                <ThemedText style={styles.dailyBreakdownStat}>P: {day.present}</ThemedText>
                <ThemedText style={styles.dailyBreakdownStat}>A: {day.absent}</ThemedText>
                <ThemedText style={styles.dailyBreakdownStat}>L: {day.late}</ThemedText>
              </View>
            </ThemedView>
          );
        })}
      </View>
    );
  };

  const renderTimeView = () => {
    return (
      <View>
        <ThemedText type="subtitle" style={styles.sectionTitle}>In-Time / Out-Time Records</ThemedText>
        {timeRecords.map((record) => (
          <ThemedView key={record._id} style={styles.timeCard}>
            <View style={styles.timeHeader}>
              <View>
                <ThemedText type="defaultSemiBold">{record.subject}</ThemedText>
                <ThemedText style={styles.timeDate}>
                  {new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </ThemedText>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(record.status) }]}>
                <ThemedText style={styles.statusText}>{record.status.toUpperCase()}</ThemedText>
              </View>
            </View>
            <View style={styles.timeDetails}>
              <View style={styles.timeDetailItem}>
                <IconSymbol name="arrow.right.circle" size={16} color={Colors[colorScheme ?? 'light'].tint} />
                <View>
                  <ThemedText style={styles.timeDetailLabel}>Entry</ThemedText>
                  <ThemedText style={styles.timeDetailValue}>{formatTime(record.entryTime)}</ThemedText>
                </View>
              </View>
              <View style={styles.timeDetailItem}>
                <IconSymbol name="arrow.left.circle" size={16} color={Colors[colorScheme ?? 'light'].tint} />
                <View>
                  <ThemedText style={styles.timeDetailLabel}>Exit</ThemedText>
                  <ThemedText style={styles.timeDetailValue}>{formatTime(record.exitTime)}</ThemedText>
                </View>
              </View>
              <View style={styles.timeDetailItem}>
                <IconSymbol name="timer" size={16} color={Colors[colorScheme ?? 'light'].tint} />
                <View>
                  <ThemedText style={styles.timeDetailLabel}>Duration</ThemedText>
                  <ThemedText style={styles.timeDetailValue}>{formatDuration(record.duration)}</ThemedText>
                </View>
              </View>
            </View>
          </ThemedView>
        ))}
      </View>
    );
  };

  if (!user || user.role !== 'student') {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>This feature is only available for students.</ThemedText>
      </ThemedView>
    );
  }

  const getContentView = () => {
    if (activeTab === 'day') return renderDailyView();
    if (activeTab === 'subject') return renderSubjectView();
    if (activeTab === 'semester') return renderMonthlyView();
    return null;
  };

  const getListData = () => {
    switch (activeTab) {
      case 'day':
        return dailyData?.records || [];
      case 'subject':
        return subjectData?.subjectWise || [];
      case 'semester':
        return monthlyData?.dailyBreakdown || [];
      default:
        return [];
    }
  };

  return (
    <ThemedView style={styles.container}>
      <CommonHeader title="My Attendance" />

      {/* Tab Navigation */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'day' && styles.activeTab]}
          onPress={() => setActiveTab('day')}>
          <IconSymbol
            name="calendar"
            size={18}
            color={activeTab === 'day' ? '#fff' : Colors[colorScheme ?? 'light'].text}
          />
          <ThemedText style={[styles.tabLabel, activeTab === 'day' && styles.activeTabLabel]}>Day</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'subject' && styles.activeTab]}
          onPress={() => setActiveTab('subject')}>
          <IconSymbol
            name="book.fill"
            size={18}
            color={activeTab === 'subject' ? '#fff' : Colors[colorScheme ?? 'light'].text}
          />
          <ThemedText style={[styles.tabLabel, activeTab === 'subject' && styles.activeTabLabel]}>Subject</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'semester' && styles.activeTab]}
          onPress={() => setActiveTab('semester')}>
          <IconSymbol
            name="chart.bar.fill"
            size={18}
            color={activeTab === 'semester' ? '#fff' : Colors[colorScheme ?? 'light'].text}
          />
          <ThemedText style={[styles.tabLabel, activeTab === 'semester' && styles.activeTabLabel]}>Semester</ThemedText>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
        </View>
      ) : (
        <FlatList
          data={getListData()}
          keyExtractor={(item, index) => item._id || index.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors[colorScheme ?? 'light'].tint}
            />
          }
          renderItem={({ item }) => {
            if (activeTab === 'day' && item) {
              return (
                <ThemedView style={[styles.recordCard, { marginHorizontal: 16 }]}>
                  <View style={styles.recordHeader}>
                    <View>
                      <ThemedText type="defaultSemiBold">{item.subject || 'Period'}</ThemedText>
                      <ThemedText style={styles.recordTime}>
                        {formatTime(item.entryTime)} {item.exitTime ? `- ${formatTime(item.exitTime)}` : ''}
                      </ThemedText>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                      <IconSymbol name={getStatusIcon(item.status) as any} size={14} color="#fff" />
                    </View>
                  </View>
                </ThemedView>
              );
            }
            if (activeTab === 'subject' && item) {
              return (
                <ThemedView style={[styles.subjectCard, { marginHorizontal: 16 }]}>
                  <View style={styles.subjectHeader}>
                    <ThemedText type="defaultSemiBold">{item.subject}</ThemedText>
                    <ThemedText style={[
                      styles.percentage,
                      { color: item.percentage >= 75 ? '#4CAF50' : '#F44336' }
                    ]}>
                      {item.percentage.toFixed(0)}%
                    </ThemedText>
                  </View>
                  <View style={styles.progressBar}>
                    <View style={[
                      styles.progressFill,
                      {
                        width: `${item.percentage}%`,
                        backgroundColor: item.percentage >= 75 ? '#4CAF50' : '#F44336'
                      }
                    ]} />
                  </View>
                  <View style={styles.subjectStats}>
                    <View style={styles.subjectStatItem}>
                      <ThemedText style={styles.subjectStatNumber}>{item.present}</ThemedText>
                      <ThemedText style={styles.subjectStatLabel}>P</ThemedText>
                    </View>
                    <View style={styles.subjectStatItem}>
                      <ThemedText style={styles.subjectStatNumber}>{item.absent}</ThemedText>
                      <ThemedText style={styles.subjectStatLabel}>A</ThemedText>
                    </View>
                    <View style={styles.subjectStatItem}>
                      <ThemedText style={styles.subjectStatNumber}>{item.late}</ThemedText>
                      <ThemedText style={styles.subjectStatLabel}>L</ThemedText>
                    </View>
                  </View>
                </ThemedView>
              );
            }
            if (activeTab === 'semester' && item) {
              const dayPercentage = item.total > 0 ? (item.present / item.total) * 100 : 0;
              return (
                <ThemedView style={[styles.dailyBreakdownCard, { marginHorizontal: 16 }]}>
                  <View style={styles.dailyBreakdownHeader}>
                    <ThemedText type="defaultSemiBold">
                      {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </ThemedText>
                    <ThemedText style={{ color: dayPercentage >= 75 ? '#4CAF50' : '#F44336', fontWeight: '600' }}>
                      {dayPercentage.toFixed(0)}%
                    </ThemedText>
                  </View>
                  <View style={styles.dailyBreakdownStats}>
                    <ThemedText style={styles.dailyBreakdownStat}>P: {item.present}</ThemedText>
                    <ThemedText style={styles.dailyBreakdownStat}>A: {item.absent}</ThemedText>
                    <ThemedText style={styles.dailyBreakdownStat}>L: {item.late}</ThemedText>
                  </View>
                </ThemedView>
              );
            }
            return null;
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <IconSymbol name="doc.text" size={40} color={Colors[colorScheme ?? 'light'].text} />
              <ThemedText style={styles.emptyText}>No data available</ThemedText>
            </View>
          }
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statsOverviewHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  statsOverviewTitle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  overviewHeaderTitle: {
    marginBottom: 2,
  },
  overviewHeaderDate: {
    fontSize: 12,
    opacity: 0.6,
  },
  statsOverviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(128, 128, 128, 0.05)',
    borderRadius: 12,
    paddingVertical: 12,
  },
  statOverviewItem: {
    alignItems: 'center',
    gap: 4,
  },
  statOverviewNumber: {
    fontSize: 22,
    fontWeight: '700',
  },
  statOverviewLabel: {
    fontSize: 11,
    opacity: 0.7,
    fontWeight: '500',
  },
  statOverviewDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
  },
  floatingHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    fontSize: 13,
    opacity: 0.7,
    marginTop: 2,
  },
  downloadButton: {
    padding: 6,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  activeTab: {
    backgroundColor: Colors.light.tint,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  activeTabLabel: {
    color: '#fff',
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordCard: {
    marginBottom: 8,
    marginTop: 2,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 11,
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordTime: {
    fontSize: 12,
    marginTop: 2,
    opacity: 0.6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  subjectCard: {
    marginBottom: 8,
    marginTop: 2,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 11,
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  subjectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  percentage: {
    fontSize: 16,
    fontWeight: '700',
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
  },
  subjectStats: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 16,
  },
  subjectStatItem: {
    alignItems: 'center',
  },
  subjectStatNumber: {
    fontSize: 14,
    fontWeight: '700',
  },
  subjectStatLabel: {
    fontSize: 10,
    marginTop: 2,
    opacity: 0.6,
  },
  dailyBreakdownCard: {
    marginBottom: 8,
    marginTop: 2,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 11,
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  dailyBreakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  dailyBreakdownStats: {
    flexDirection: 'row',
    gap: 12,
  },
  dailyBreakdownStat: {
    fontSize: 12,
    opacity: 0.7,
  },
  timeCard: {
    marginBottom: 8,
    marginTop: 2,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 11,
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  timeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  timeDate: {
    fontSize: 11,
    marginTop: 2,
    opacity: 0.6,
  },
  timeDetails: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 16,
  },
  timeDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeDetailLabel: {
    fontSize: 10,
    opacity: 0.6,
  },
  timeDetailValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    opacity: 0.6,
  },
  // ── Missing styles that were referenced but never defined ─────────────────
  summaryCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(128,128,128,0.06)',
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
  },
  summaryItem: {
    alignItems: 'center',
    gap: 4,
  },
  summaryNumber: {
    fontSize: 22,
    fontWeight: '700',
  },
  summaryLabel: {
    fontSize: 11,
    opacity: 0.6,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  monthlyCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(128,128,128,0.06)',
    alignItems: 'center',
  },
  monthlyCircle: {
    marginVertical: 16,
    alignItems: 'center',
  },
  monthlyPercentage: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -1,
  },
  monthlyLabel: {
    fontSize: 13,
    opacity: 0.6,
    fontWeight: '500',
  },
  monthlyStats: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 4,
  },
  monthlyStatItem: {
    alignItems: 'center',
    gap: 4,
  },
  monthlyStatNumber: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 4,
  },
  monthlyStatLabel: {
    fontSize: 11,
    opacity: 0.6,
    fontWeight: '500',
  },
});
