import { useState, useMemo } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, TextInput } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAttendance } from '@/context/AttendanceContext';
import { useAuth } from '@/context/AuthContext';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AttendanceStats } from '@/types/attendance';

type FilterType = 'all' | 'low' | 'high';
type SortType = 'name' | 'percentage' | 'recent';

export default function HistoryScreen() {
  const colorScheme = useColorScheme();
  const { students, attendanceRecords } = useAttendance();
  const { user } = useAuth();
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortType, setSortType] = useState<SortType>('name');

  // Check if user is a student
  const isStudent = user?.role === 'student';

  const calculateStats = (studentId: string): AttendanceStats => {
    const records = attendanceRecords.filter(r => r.studentId === studentId);
    const totalClasses = records.length;
    const present = records.filter(r => r.status === 'present').length;
    const absent = records.filter(r => r.status === 'absent').length;
    const late = records.filter(r => r.status === 'late').length;
    const percentage = totalClasses > 0 ? (present / totalClasses) * 100 : 0;

    return { totalClasses, present, absent, late, percentage };
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return { name: 'checkmark.circle.fill' as const, color: '#4CAF50' };
      case 'absent':
        return { name: 'xmark.circle.fill' as const, color: '#F44336' };
      case 'late':
        return { name: 'clock.fill' as const, color: '#FF9800' };
      default:
        return { name: 'questionmark.circle' as const, color: '#999' };
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const groupRecordsByDate = () => {
    const grouped: Record<string, typeof attendanceRecords> = {};
    attendanceRecords.forEach(record => {
      if (!grouped[record.date]) {
        grouped[record.date] = [];
      }
      grouped[record.date].push(record);
    });
    return Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0]));
  };

  // Filter and sort students
  const filteredAndSortedStudents = useMemo(() => {
    let filtered = students.filter(student => {
      const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          student.rollNumber.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!matchesSearch) return false;
      
      const stats = calculateStats(student.id);
      
      if (filterType === 'low' && stats.percentage >= 75) return false;
      if (filterType === 'high' && stats.percentage < 75) return false;
      
      return true;
    });

    // Sort students
    filtered.sort((a, b) => {
      const statsA = calculateStats(a.id);
      const statsB = calculateStats(b.id);
      
      switch (sortType) {
        case 'percentage':
          return statsB.percentage - statsA.percentage;
        case 'recent':
          const recordsA = attendanceRecords.filter(r => r.studentId === a.id);
          const recordsB = attendanceRecords.filter(r => r.studentId === b.id);
          const latestA = recordsA.length > 0 ? new Date(recordsA[0].date).getTime() : 0;
          const latestB = recordsB.length > 0 ? new Date(recordsB[0].date).getTime() : 0;
          return latestB - latestA;
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  }, [students, searchQuery, filterType, sortType, attendanceRecords]);

  const overallStats = useMemo(() => {
    const allRecords = attendanceRecords;
    const totalClasses = allRecords.length;
    const present = allRecords.filter(r => r.status === 'present').length;
    const absent = allRecords.filter(r => r.status === 'absent').length;
    const late = allRecords.filter(r => r.status === 'late').length;
    const percentage = totalClasses > 0 ? (present / totalClasses) * 100 : 0;

    return {
      totalClasses,
      present,
      absent,
      late,
      percentage: parseFloat(percentage.toFixed(2))
    };
  }, [attendanceRecords]);

  return (
    <ScrollView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Attendance History</ThemedText>
      </ThemedView>

      {/* Show message for students to use the dedicated attendance screen */}
      {isStudent ? (
        <ThemedView style={styles.studentMessageContainer}>
          <IconSymbol name="info.circle.fill" size={48} color={Colors[colorScheme ?? 'light'].tint} />
          <ThemedText type="subtitle" style={styles.studentMessageTitle}>
            View Your Attendance
          </ThemedText>
          <ThemedText style={styles.studentMessageText}>
            Students should use the "My Attendance" tab to view their daily attendance, subject-wise stats, monthly percentage, and time records.
          </ThemedText>
          <ThemedText style={styles.studentMessageHint}>
            Tap the "My Attendance" icon in the bottom navigation to access your complete attendance dashboard.
          </ThemedText>
        </ThemedView>
      ) : (
        <>
          {/* Overall Statistics */}
          <ThemedView style={styles.overallStatsCard}>
            <ThemedText type="subtitle" style={styles.cardTitle}>Overall Statistics</ThemedText>
            <View style={styles.overallStatsGrid}>
              <View style={styles.overallStatItem}>
                <IconSymbol name="chart.bar.fill" size={24} color={Colors[colorScheme ?? 'light'].tint} />
                <ThemedText style={styles.overallStatNumber}>{overallStats.percentage.toFixed(1)}%</ThemedText>
                <ThemedText style={styles.overallStatLabel}>Avg Attendance</ThemedText>
              </View>
              <View style={styles.overallStatItem}>
                <IconSymbol name="checkmark.circle.fill" size={24} color="#4CAF50" />
                <ThemedText style={styles.overallStatNumber}>{overallStats.present}</ThemedText>
                <ThemedText style={styles.overallStatLabel}>Present</ThemedText>
              </View>
              <View style={styles.overallStatItem}>
                <IconSymbol name="xmark.circle.fill" size={24} color="#F44336" />
                <ThemedText style={styles.overallStatNumber}>{overallStats.absent}</ThemedText>
                <ThemedText style={styles.overallStatLabel}>Absent</ThemedText>
              </View>
            </View>
          </ThemedView>

          {/* Search and Filters */}
          <ThemedView style={styles.controlsSection}>
        <View style={styles.searchContainer}>
          <IconSymbol name="magnifyingglass" size={16} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search students..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <IconSymbol name="xmark.circle.fill" size={16} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filterRow}>
          <View style={styles.filterGroup}>
            <ThemedText style={styles.filterLabel}>Filter:</ThemedText>
            <TouchableOpacity
              style={[styles.filterButton, filterType === 'all' && styles.filterButtonActive]}
              onPress={() => setFilterType('all')}>
              <ThemedText style={[styles.filterButtonText, filterType === 'all' && styles.filterButtonTextActive]}>
                All
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filterType === 'low' && styles.filterButtonActive]}
              onPress={() => setFilterType('low')}>
              <ThemedText style={[styles.filterButtonText, filterType === 'low' && styles.filterButtonTextActive]}>
                Low (&lt;75%)
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filterType === 'high' && styles.filterButtonActive]}
              onPress={() => setFilterType('high')}>
              <ThemedText style={[styles.filterButtonText, filterType === 'high' && styles.filterButtonTextActive]}>
                High (≥75%)
              </ThemedText>
            </TouchableOpacity>
          </View>

          <View style={styles.filterGroup}>
            <ThemedText style={styles.filterLabel}>Sort:</ThemedText>
            <TouchableOpacity
              style={[styles.filterButton, sortType === 'name' && styles.filterButtonActive]}
              onPress={() => setSortType('name')}>
              <ThemedText style={[styles.filterButtonText, sortType === 'name' && styles.filterButtonTextActive]}>
                Name
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, sortType === 'percentage' && styles.filterButtonActive]}
              onPress={() => setSortType('percentage')}>
              <ThemedText style={[styles.filterButtonText, sortType === 'percentage' && styles.filterButtonTextActive]}>
                %
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </ThemedView>

      {/* Student Stats Cards */}
      <ThemedView style={styles.statsSection}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Student Statistics ({filteredAndSortedStudents.length})
        </ThemedText>
        
        {filteredAndSortedStudents.map(student => {
          const stats = calculateStats(student.id);
          const isSelected = selectedStudentId === student.id;

          return (
            <TouchableOpacity
              key={student.id}
              onPress={() => setSelectedStudentId(isSelected ? null : student.id)}>
              <ThemedView style={styles.statCard}>
                <View style={styles.statHeader}>
                  <View>
                    <ThemedText type="defaultSemiBold" style={styles.studentName}>
                      {student.name}
                    </ThemedText>
                    <ThemedText style={styles.rollNumber}>
                      {student.rollNumber}
                    </ThemedText>
                  </View>
                  <View style={styles.percentageContainer}>
                    <ThemedText style={[
                      styles.percentage,
                      { color: stats.percentage >= 75 ? '#4CAF50' : '#F44336' }
                    ]}>
                      {stats.percentage.toFixed(1)}%
                    </ThemedText>
                    <IconSymbol 
                      name={isSelected ? 'chevron.up' : 'chevron.down'} 
                      size={16} 
                      color={Colors[colorScheme ?? 'light'].text} 
                    />
                  </View>
                </View>

                {isSelected && (
                  <View style={styles.detailedStats}>
                    <View style={styles.statRow}>
                      <View style={styles.statItem}>
                        <IconSymbol name="book.fill" size={16} color={Colors[colorScheme ?? 'light'].tint} />
                        <ThemedText style={styles.statText}>
                          {stats.totalClasses} Classes
                        </ThemedText>
                      </View>
                      <View style={styles.statItem}>
                        <IconSymbol name="checkmark.circle.fill" size={16} color="#4CAF50" />
                        <ThemedText style={styles.statText}>
                          {stats.present} Present
                        </ThemedText>
                      </View>
                    </View>
                    <View style={styles.statRow}>
                      <View style={styles.statItem}>
                        <IconSymbol name="xmark.circle.fill" size={16} color="#F44336" />
                        <ThemedText style={styles.statText}>
                          {stats.absent} Absent
                        </ThemedText>
                      </View>
                      <View style={styles.statItem}>
                        <IconSymbol name="clock.fill" size={16} color="#FF9800" />
                        <ThemedText style={styles.statText}>
                          {stats.late} Late
                        </ThemedText>
                      </View>
                    </View>
                  </View>
                )}
              </ThemedView>
            </TouchableOpacity>
          );
        })}
      </ThemedView>

      {/* Daily Attendance Records */}
      <ThemedView style={styles.recordsSection}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Daily Records
        </ThemedText>

        {attendanceRecords.length === 0 ? (
          <ThemedView style={styles.emptyState}>
            <IconSymbol name="calendar.badge.exclamationmark" size={48} color="#999" />
            <ThemedText style={styles.emptyText}>
              No attendance records yet
            </ThemedText>
          </ThemedView>
        ) : (
          groupRecordsByDate().map(([date, records]) => (
            <ThemedView key={date} style={styles.dateGroup}>
              <ThemedText type="defaultSemiBold" style={styles.dateHeader}>
                {formatDate(date)}
              </ThemedText>
              
              {records.map(record => {
                const student = students.find(s => s.id === record.studentId);
                if (!student) return null;

                const statusInfo = getStatusIcon(record.status);
                
                return (
                  <View key={record.id} style={styles.recordCard}>
                    <View style={styles.recordInfo}>
                      <ThemedText style={styles.recordName}>
                        {student.name}
                      </ThemedText>
                      <ThemedText style={styles.recordRoll}>
                        {student.rollNumber}
                      </ThemedText>
                    </View>
                    <View style={styles.recordStatus}>
                      <IconSymbol 
                        name={statusInfo.name} 
                        size={20} 
                        color={statusInfo.color} 
                      />
                      <ThemedText 
                        style={[
                          styles.statusText,
                          { color: statusInfo.color }
                        ]}>
                        {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                      </ThemedText>
                    </View>
                  </View>
                );
              })}
            </ThemedView>
          ))
        )}
      </ThemedView>
        </>
      )}
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
  studentMessageContainer: {
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    marginHorizontal: 8,
    marginTop: 20,
  },
  studentMessageTitle: {
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  studentMessageText: {
    textAlign: 'center',
    fontSize: 14,
    opacity: 0.8,
    lineHeight: 22,
    marginBottom: 12,
  },
  studentMessageHint: {
    textAlign: 'center',
    fontSize: 12,
    opacity: 0.6,
    fontStyle: 'italic',
  },
  overallStatsCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
  },
  cardTitle: {
    marginBottom: 16,
  },
  overallStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  overallStatItem: {
    alignItems: 'center',
    gap: 6,
  },
  overallStatNumber: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  overallStatLabel: {
    fontSize: 11,
    opacity: 0.7,
  },
  controlsSection: {
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.light.text,
  },
  filterRow: {
    gap: 12,
  },
  filterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.7,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
  },
  filterButtonActive: {
    backgroundColor: Colors.light.tint,
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  statsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  statCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  studentName: {
    fontSize: 16,
  },
  rollNumber: {
    fontSize: 13,
    opacity: 0.7,
    marginTop: 2,
  },
  percentageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  percentage: {
    fontSize: 20,
    fontWeight: '700',
  },
  detailedStats: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
  },
  statText: {
    fontSize: 13,
    fontWeight: '500',
  },
  recordsSection: {
    marginBottom: 20,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 12,
    opacity: 0.6,
    fontSize: 14,
  },
  dateGroup: {
    marginBottom: 20,
  },
  dateHeader: {
    fontSize: 15,
    marginBottom: 12,
    opacity: 0.8,
    fontWeight: '600',
    paddingLeft: 4,
  },
  recordCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
  },
  recordInfo: {
    flex: 1,
  },
  recordName: {
    fontSize: 14,
    fontWeight: '600',
  },
  recordRoll: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 4,
  },
  recordStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
