import { useState } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, View, Alert } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAttendance } from '@/context/AttendanceContext';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function MarkAttendanceScreen() {
  const colorScheme = useColorScheme();
  const { students, markAttendance, getTodayAttendance, error } = useAttendance();
  const [selectedStatus, setSelectedStatus] = useState<Record<string, 'present' | 'absent' | 'late'>>({});
  const [marking, setMarking] = useState(false);
  
  const todayAttendance = getTodayAttendance();
  const markedStudentIds = new Set(todayAttendance.map(record => record.studentId));

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
    <ScrollView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Mark Attendance</ThemedText>
        <ThemedText style={styles.date}>
          {new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </ThemedText>
      </ThemedView>

      {error && (
        <ThemedView style={styles.errorBanner}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </ThemedView>
      )}

      <ThemedView style={styles.statsContainer}>
        <View style={styles.statCard}>
          <ThemedText style={styles.statNumber}>{stats.total}</ThemedText>
          <ThemedText style={styles.statLabel}>Total</ThemedText>
        </View>
        <View style={[styles.statCard, { backgroundColor: 'rgba(76, 175, 80, 0.2)' }]}>
          <ThemedText style={[styles.statNumber, { color: '#4CAF50' }]}>{stats.present}</ThemedText>
          <ThemedText style={styles.statLabel}>Present</ThemedText>
        </View>
        <View style={[styles.statCard, { backgroundColor: 'rgba(244, 67, 54, 0.2)' }]}>
          <ThemedText style={[styles.statNumber, { color: '#F44336' }]}>{stats.absent}</ThemedText>
          <ThemedText style={styles.statLabel}>Absent</ThemedText>
        </View>
        <View style={[styles.statCard, { backgroundColor: 'rgba(255, 152, 0, 0.2)' }]}>
          <ThemedText style={[styles.statNumber, { color: '#FF9800' }]}>{stats.late}</ThemedText>
          <ThemedText style={styles.statLabel}>Late</ThemedText>
        </View>
      </ThemedView>

      <TouchableOpacity
        style={[styles.markAllButton, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}
        onPress={markAllPresent}
        disabled={marking}>
        <ThemedText style={styles.markAllText}>
          {marking ? 'Marking...' : 'Mark All Present'}
        </ThemedText>
      </TouchableOpacity>

      <ThemedView style={styles.studentList}>
        {students.map((student) => {
          const currentStatus = getStatusForStudent(student.id);
          const isMarked = currentStatus !== null;

          return (
            <ThemedView key={student.id} style={styles.studentCard}>
              <View style={styles.studentInfo}>
                <View style={styles.studentHeader}>
                  <ThemedText type="defaultSemiBold" style={styles.studentName}>
                    {student.name}
                  </ThemedText>
                  {isMarked && (
                    <IconSymbol name="checkmark.circle.fill" size={20} color={getStatusColor(currentStatus)} />
                  )}
                </View>
                <ThemedText style={styles.studentDetails}>
                  {student.rollNumber} - {student.class}
                </ThemedText>
              </View>

              <View style={styles.statusButtons}>
                <TouchableOpacity
                  style={[
                    styles.statusButton,
                    currentStatus === 'present' && { backgroundColor: '#4CAF50' }
                  ]}
                  onPress={() => handleMarkAttendance(student.id, 'present')}>
                  <IconSymbol 
                    name="checkmark.circle" 
                    size={24} 
                    color={currentStatus === 'present' ? '#fff' : '#4CAF50'} 
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.statusButton,
                    currentStatus === 'late' && { backgroundColor: '#FF9800' }
                  ]}
                  onPress={() => handleMarkAttendance(student.id, 'late')}>
                  <IconSymbol 
                    name="clock" 
                    size={24} 
                    color={currentStatus === 'late' ? '#fff' : '#FF9800'} 
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.statusButton,
                    currentStatus === 'absent' && { backgroundColor: '#F44336' }
                  ]}
                  onPress={() => handleMarkAttendance(student.id, 'absent')}>
                  <IconSymbol 
                    name="xmark.circle" 
                    size={24} 
                    color={currentStatus === 'absent' ? '#fff' : '#F44336'} 
                  />
                </TouchableOpacity>
              </View>
            </ThemedView>
          );
        })}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 20,
    paddingTop: 50,
  },
  date: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 8,
  },
  statCard: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    opacity: 0.7,
    marginTop: 4,
  },
  markAllButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  markAllText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  studentList: {
    marginBottom: 20,
  },
  studentCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
  },
  studentInfo: {
    marginBottom: 12,
  },
  studentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
  },
  studentDetails: {
    fontSize: 13,
    opacity: 0.7,
  },
  statusButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 8,
  },
  statusButton: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
  },
  errorBanner: {
    backgroundColor: '#ff444420',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 14,
  },
});
