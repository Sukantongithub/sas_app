import { useState } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, View, Alert, RefreshControl } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAttendance } from '@/context/AttendanceContext';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import CommonHeader from '@/components/CommonHeader';

export default function MarkAttendanceScreen() {
  const colorScheme = useColorScheme();
  const { students, markAttendance, getTodayAttendance, error } = useAttendance();
  const [selectedStatus, setSelectedStatus] = useState<Record<string, 'present' | 'absent' | 'late'>>({});
  const [marking, setMarking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const todayAttendance = getTodayAttendance();
  const markedStudentIds = new Set(todayAttendance.map(record => record.studentId));

  const onRefresh = async () => {
    setRefreshing(true);
    // Refresh attendance data
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleMarkAttendance = async (studentId: string, status: 'present' | 'absent' | 'late') => {
    try {
      setMarking(true);
      setSelectedStatus(prev => ({ ...prev, [studentId]: status }));
      await markAttendance(studentId, status);
    } catch (err) {
      Alert.alert('Error', 'Failed to mark attendance');
    } finally {
      setMarking(false);
    }
  };

  const getStatusForStudent = (studentId: string): 'present' | 'absent' | 'late' | null => {
    const record = todayAttendance.find(r => r.studentId === studentId);
    return record ? record.status : null;
  };

  const markAllPresent = () => {
    Alert.alert(
      'Mark All Present',
      'Are you sure you want to mark all students as present?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark All',
          onPress: async () => {
            try {
              setMarking(true);
              for (const student of students) {
                await handleMarkAttendance(student.id, 'present');
              }
              Alert.alert('Success', 'All students marked as present');
            } catch (err) {
              Alert.alert('Error', 'Failed to mark all students');
            } finally {
              setMarking(false);
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return '#4CAF50';
      case 'absent':
        return '#F44336';
      case 'late':
        return '#FF9800';
      default:
        return Colors[colorScheme ?? 'light'].tint;
    }
  };

  const stats = {
    total: students.length,
    present: todayAttendance.filter(r => r.status === 'present').length,
    absent: todayAttendance.filter(r => r.status === 'absent').length,
    late: todayAttendance.filter(r => r.status === 'late').length,
  };

  return (
    <ThemedView style={styles.container}>
      <CommonHeader title="Mark Attendance" />

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statBadge}>
          <ThemedText style={styles.statNumber}>{stats.total}</ThemedText>
          <ThemedText style={styles.statLabel}>Total</ThemedText>
        </View>
        <View style={[styles.statBadge, { backgroundColor: 'rgba(76, 175, 80, 0.15)' }]}>
          <ThemedText style={[styles.statNumber, { color: '#4CAF50' }]}>{stats.present}</ThemedText>
          <ThemedText style={styles.statLabel}>Present</ThemedText>
        </View>
        <View style={[styles.statBadge, { backgroundColor: 'rgba(244, 67, 54, 0.15)' }]}>
          <ThemedText style={[styles.statNumber, { color: '#F44336' }]}>{stats.absent}</ThemedText>
          <ThemedText style={styles.statLabel}>Absent</ThemedText>
        </View>
        <View style={[styles.statBadge, { backgroundColor: 'rgba(255, 152, 0, 0.15)' }]}>
          <ThemedText style={[styles.statNumber, { color: '#FF9800' }]}>{stats.late}</ThemedText>
          <ThemedText style={styles.statLabel}>Late</ThemedText>
        </View>
      </View>

      {error && (
        <ThemedView style={styles.errorBanner}>
          <IconSymbol name="exclamationmark.circle.fill" size={18} color="#ff4444" />
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </ThemedView>
      )}

      {/* Student List */}
      <FlatList
        data={students}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor={Colors[colorScheme ?? 'light'].tint}
          />
        }
        renderItem={({ item: student }) => {
          const currentStatus = getStatusForStudent(student.id);
          const isMarked = currentStatus !== null;

          return (
            <ThemedView style={[styles.studentCard, { marginHorizontal: 16 }]}>
              <View style={styles.studentInfo}>
                <View style={styles.studentHeader}>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="defaultSemiBold" style={styles.studentName}>
                      {student.name}
                    </ThemedText>
                    <ThemedText style={styles.studentDetails}>
                      {student.rollNumber} • {student.class}
                    </ThemedText>
                  </View>
                  {isMarked && (
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(currentStatus) }]}>
                      <ThemedText style={styles.statusBadgeText}>
                        {currentStatus?.charAt(0).toUpperCase()}{currentStatus?.slice(1)}
                      </ThemedText>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.statusButtons}>
                <TouchableOpacity
                  style={[
                    styles.statusButton,
                    currentStatus === 'present' && styles.statusButtonActive,
                    currentStatus === 'present' && { backgroundColor: '#4CAF50' }
                  ]}
                  onPress={() => handleMarkAttendance(student.id, 'present')}>
                  <IconSymbol 
                    name="checkmark" 
                    size={20} 
                    color={currentStatus === 'present' ? '#fff' : '#4CAF50'} 
                  />
                  <ThemedText style={[styles.statusButtonLabel, { color: currentStatus === 'present' ? '#fff' : '#4CAF50' }]}>
                    Present
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.statusButton,
                    currentStatus === 'late' && styles.statusButtonActive,
                    currentStatus === 'late' && { backgroundColor: '#FF9800' }
                  ]}
                  onPress={() => handleMarkAttendance(student.id, 'late')}>
                  <IconSymbol 
                    name="clock" 
                    size={20} 
                    color={currentStatus === 'late' ? '#fff' : '#FF9800'} 
                  />
                  <ThemedText style={[styles.statusButtonLabel, { color: currentStatus === 'late' ? '#fff' : '#FF9800' }]}>
                    Late
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.statusButton,
                    currentStatus === 'absent' && styles.statusButtonActive,
                    currentStatus === 'absent' && { backgroundColor: '#F44336' }
                  ]}
                  onPress={() => handleMarkAttendance(student.id, 'absent')}>
                  <IconSymbol 
                    name="xmark" 
                    size={20} 
                    color={currentStatus === 'absent' ? '#fff' : '#F44336'} 
                  />
                  <ThemedText style={[styles.statusButtonLabel, { color: currentStatus === 'absent' ? '#fff' : '#F44336' }]}>
                    Absent
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </ThemedView>
          );
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  progressHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  progressTitle: {
    marginBottom: 4,
  },
  progressDate: {
    fontSize: 13,
    opacity: 0.6,
  },
  progressBarContainer: {
    gap: 8,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressBarLabel: {
    fontSize: 12,
    opacity: 0.7,
    fontWeight: '500',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    fontSize: 13,
    opacity: 0.7,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  statBadge: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
    opacity: 0.7,
    marginTop: 2,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 20,
  },
  studentCard: {
    marginBottom: 10,
    marginTop: 2,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  studentInfo: {
    marginBottom: 10,
  },
  studentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  studentName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  studentDetails: {
    fontSize: 12,
    opacity: 0.6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  markAllButton: {
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  markAllButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  statusButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  statusButton: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    flexDirection: 'row',
    gap: 4,
  },
  statusButtonActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  statusButtonLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  errorBanner: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 13,
    flex: 1,
  },
});
