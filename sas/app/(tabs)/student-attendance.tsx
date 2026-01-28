import { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, Share } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';
import { attendanceAPI } from '@/services/api';

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
  const [activeTab, setActiveTab] = useState<'daily' | 'subject' | 'monthly' | 'time'>('daily');
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
        case 'daily':
          const daily = await attendanceAPI.getStudentDaily(studentId, selectedDate, token);
          setDailyData(daily);
          break;
        case 'subject':
          const subject = await attendanceAPI.getStudentSubjectWise(studentId, {}, token);
          setSubjectData(subject);
          break;
        case 'monthly':
          const monthly = await attendanceAPI.getStudentMonthly(studentId, new Date().getFullYear(), new Date().getMonth() + 1, token);
          setMonthlyData(monthly);
          break;
        case 'time':
          const time = await attendanceAPI.getStudentTimeRecords(studentId, {}, token);
          setTimeRecords(time.records || []);
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

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <ThemedView style={styles.header}>
        <ThemedText type="title">My Attendance</ThemedText>
        <TouchableOpacity onPress={handleDownloadReport}>
          <IconSymbol name="arrow.down.circle" size={28} color={Colors[colorScheme ?? 'light'].tint} />
        </TouchableOpacity>
      </ThemedView>

      {/* Tab Navigation */}
      <ThemedView style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'daily' && styles.activeTab]}
          onPress={() => setActiveTab('daily')}>
          <IconSymbol name="calendar" size={20} color={activeTab === 'daily' ? '#fff' : Colors[colorScheme ?? 'light'].text} />
          <ThemedText style={[styles.tabText, activeTab === 'daily' && styles.activeTabText]}>Daily</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'subject' && styles.activeTab]}
          onPress={() => setActiveTab('subject')}>
          <IconSymbol name="book.fill" size={20} color={activeTab === 'subject' ? '#fff' : Colors[colorScheme ?? 'light'].text} />
          <ThemedText style={[styles.tabText, activeTab === 'subject' && styles.activeTabText]}>Subject</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'monthly' && styles.activeTab]}
          onPress={() => setActiveTab('monthly')}>
          <IconSymbol name="chart.bar.fill" size={20} color={activeTab === 'monthly' ? '#fff' : Colors[colorScheme ?? 'light'].text} />
          <ThemedText style={[styles.tabText, activeTab === 'monthly' && styles.activeTabText]}>Monthly</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'time' && styles.activeTab]}
          onPress={() => setActiveTab('time')}>
          <IconSymbol name="clock.fill" size={20} color={activeTab === 'time' ? '#fff' : Colors[colorScheme ?? 'light'].text} />
          <ThemedText style={[styles.tabText, activeTab === 'time' && styles.activeTabText]}>Time</ThemedText>
        </TouchableOpacity>
      </ThemedView>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
        </View>
      ) : (
        <View style={styles.content}>
          {activeTab === 'daily' && renderDailyView()}
          {activeTab === 'subject' && renderSubjectView()}
          {activeTab === 'monthly' && renderMonthlyView()}
          {activeTab === 'time' && renderTimeView()}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    padding: 10,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    gap: 4,
  },
  activeTab: {
    backgroundColor: '#007AFF',
  },
  tabText: {
    fontSize: 12,
  },
  activeTabText: {
    color: '#fff',
  },
  content: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 50,
  },
  sectionTitle: {
    marginTop: 20,
    marginBottom: 12,
  },
  summaryCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  summaryLabel: {
    fontSize: 12,
    marginTop: 4,
    opacity: 0.7,
  },
  recordCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordTime: {
    fontSize: 12,
    marginTop: 4,
    opacity: 0.7,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  subjectCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  subjectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  percentage: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
  },
  subjectStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  subjectStatItem: {
    alignItems: 'center',
  },
  subjectStatNumber: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  subjectStatLabel: {
    fontSize: 11,
    marginTop: 2,
    opacity: 0.7,
  },
  monthlyCard: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  monthlyCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  monthlyPercentage: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  monthlyLabel: {
    fontSize: 14,
    marginTop: 4,
    opacity: 0.7,
  },
  monthlyStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 16,
  },
  monthlyStatItem: {
    alignItems: 'center',
    gap: 4,
  },
  monthlyStatNumber: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  monthlyStatLabel: {
    fontSize: 11,
    opacity: 0.7,
  },
  dailyBreakdownCard: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  dailyBreakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dailyBreakdownStats: {
    flexDirection: 'row',
    gap: 16,
  },
  dailyBreakdownStat: {
    fontSize: 12,
    opacity: 0.7,
  },
  timeCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  timeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  timeDate: {
    fontSize: 12,
    marginTop: 4,
    opacity: 0.7,
  },
  timeDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeDetailLabel: {
    fontSize: 11,
    opacity: 0.7,
  },
  timeDetailValue: {
    fontSize: 13,
    fontWeight: '600',
  },
});
