import { useState, useMemo } from 'react';
import { StyleSheet, FlatList, View, TouchableOpacity, TextInput } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAttendance } from '@/context/AttendanceContext';
import { useAuth } from '@/context/AuthContext';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AttendanceStats } from '@/types/attendance';
import CommonHeader from '@/components/CommonHeader';

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
    <ThemedView style={styles.container}>
      <CommonHeader title="Attendance History" />

      {isStudent ? (
        /* Student Message */
        <View style={styles.emptyStateContainer}>
          <IconSymbol name="info.circle.fill" size={48} color={Colors[colorScheme ?? 'light'].tint} />
          <ThemedText type="defaultSemiBold" style={styles.studentMessageTitle}>
            View Your Attendance
          </ThemedText>
          <ThemedText style={styles.studentMessageText}>
            Use the "My Attendance" tab to view your daily attendance, subject-wise stats, monthly percentage, and time records.
          </ThemedText>
        </View>
      ) : (
        /* Teacher/Admin View */
        <FlatList
          data={[1]} // Dummy data to render content once
          keyExtractor={() => 'main'}
          contentContainerStyle={styles.listContent}
          renderItem={() => (
            <>
              {/* Overall Statistics */}
              <ThemedView style={[styles.statsCard, { marginHorizontal: 16 }]}>
                <ThemedText type="defaultSemiBold" style={styles.cardTitle}>Overall Stats</ThemedText>
                <View style={styles.statsGrid}>
                  <View style={styles.statItem}>
                    <IconSymbol name="chart.bar.fill" size={20} color={Colors[colorScheme ?? 'light'].tint} />
                    <ThemedText style={styles.statValue}>{overallStats.percentage.toFixed(0)}%</ThemedText>
                    <ThemedText style={styles.statLabel}>Avg</ThemedText>
                  </View>
                  <View style={styles.statItem}>
                    <IconSymbol name="checkmark.circle.fill" size={20} color="#4CAF50" />
                    <ThemedText style={styles.statValue}>{overallStats.present}</ThemedText>
                    <ThemedText style={styles.statLabel}>Present</ThemedText>
                  </View>
                  <View style={styles.statItem}>
                    <IconSymbol name="xmark.circle.fill" size={20} color="#F44336" />
                    <ThemedText style={styles.statValue}>{overallStats.absent}</ThemedText>
                    <ThemedText style={styles.statLabel}>Absent</ThemedText>
                  </View>
                </View>
              </ThemedView>

              {/* Search and Filters */}
              <View style={[styles.controlsSection, { marginHorizontal: 16 }]}>
                <View style={styles.searchContainer}>
                  <IconSymbol name="magnifyingglass" size={16} color="#999" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search..."
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
                  <TouchableOpacity
                    style={[styles.filterBtn, filterType === 'all' && styles.filterBtnActive]}
                    onPress={() => setFilterType('all')}>
                    <ThemedText style={[styles.filterBtnText, filterType === 'all' && styles.filterBtnTextActive]}>All</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.filterBtn, filterType === 'low' && styles.filterBtnActive]}
                    onPress={() => setFilterType('low')}>
                    <ThemedText style={[styles.filterBtnText, filterType === 'low' && styles.filterBtnTextActive]}>Low</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.filterBtn, filterType === 'high' && styles.filterBtnActive]}
                    onPress={() => setFilterType('high')}>
                    <ThemedText style={[styles.filterBtnText, filterType === 'high' && styles.filterBtnTextActive]}>High</ThemedText>
                  </TouchableOpacity>
                </View>

                <View style={styles.sortRow}>
                  <TouchableOpacity
                    style={[styles.sortBtn, sortType === 'name' && styles.sortBtnActive]}
                    onPress={() => setSortType('name')}>
                    <ThemedText style={[styles.sortBtnText, sortType === 'name' && styles.sortBtnTextActive]}>Name</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sortBtn, sortType === 'percentage' && styles.sortBtnActive]}
                    onPress={() => setSortType('percentage')}>
                    <ThemedText style={[styles.sortBtnText, sortType === 'percentage' && styles.sortBtnTextActive]}>%</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        />
      )}

      {!isStudent && (
        <FlatList
          data={filteredAndSortedStudents}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.studentListContent}
          renderItem={({ item: student }) => {
            const stats = calculateStats(student.id);
            const isSelected = selectedStudentId === student.id;

            return (
              <TouchableOpacity
                onPress={() => setSelectedStudentId(isSelected ? null : student.id)}>
                <ThemedView style={[styles.studentCard, { marginHorizontal: 16 }]}>
                  <View style={styles.studentCardHeader}>
                    <View style={{ flex: 1 }}>
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
                        {stats.percentage.toFixed(0)}%
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
                      <View style={styles.detailRow}>
                        <View style={[styles.detailItem, { marginRight: 8 }]}>
                          <IconSymbol name="book.fill" size={14} color={Colors[colorScheme ?? 'light'].tint} />
                          <ThemedText style={styles.detailText}>{stats.totalClasses}  Classes</ThemedText>
                        </View>
                        <View style={styles.detailItem}>
                          <IconSymbol name="checkmark.circle.fill" size={14} color="#4CAF50" />
                          <ThemedText style={styles.detailText}>{stats.present} P</ThemedText>
                        </View>
                      </View>
                      <View style={styles.detailRow}>
                        <View style={[styles.detailItem, { marginRight: 8 }]}>
                          <IconSymbol name="xmark.circle.fill" size={14} color="#F44336" />
                          <ThemedText style={styles.detailText}>{stats.absent} A</ThemedText>
                        </View>
                        <View style={styles.detailItem}>
                          <IconSymbol name="clock.fill" size={14} color="#FF9800" />
                          <ThemedText style={styles.detailText}>{stats.late} L</ThemedText>
                        </View>
                      </View>
                    </View>
                  )}
                </ThemedView>
              </TouchableOpacity>
            );
          }}
          ListHeaderComponent={<View style={{ height: 8 }} />}
          ListEmptyComponent={
            <View style={styles.emptyStateContainer}>
              <IconSymbol name="person.slash" size={40} color={Colors[colorScheme ?? 'light'].text} />
              <ThemedText style={styles.emptyText}>No students found</ThemedText>
            </View>
          }
          ListFooterComponent={<View style={{ height: 20 }} />}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  filterHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterHeaderTitle: {
    marginBottom: 2,
  },
  filterHeaderSubtitle: {
    fontSize: 12,
    opacity: 0.6,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  listContent: {
    paddingBottom: 8,
  },
  studentListContent: {
    paddingTop: 8,
    paddingBottom: 20,
  },
  statsCard: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 12,
    marginTop: 8,
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  cardTitle: {
    marginBottom: 10,
    fontSize: 14,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
    opacity: 0.6,
  },
  controlsSection: {
    marginBottom: 12,
    marginTop: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.light.text,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  filterBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
  },
  filterBtnActive: {
    backgroundColor: '#007AFF',
  },
  filterBtnText: {
    fontSize: 11,
    fontWeight: '500',
  },
  filterBtnTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  sortRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sortBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
  },
  sortBtnActive: {
    backgroundColor: '#007AFF',
  },
  sortBtnText: {
    fontSize: 11,
    fontWeight: '500',
  },
  sortBtnTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  studentCard: {
    marginBottom: 8,
    marginTop: 2,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  studentCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  studentName: {
    fontSize: 14,
    fontWeight: '600',
  },
  rollNumber: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  percentageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  percentage: {
    fontSize: 16,
    fontWeight: '700',
  },
  detailedStats: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.15)',
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 6,
    gap: 6,
  },
  detailItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(128, 128, 128, 0.06)',
    gap: 4,
  },
  detailText: {
    fontSize: 11,
    fontWeight: '500',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    opacity: 0.6,
    fontSize: 14,
  },
  studentMessageTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  studentMessageText: {
    textAlign: 'center',
    fontSize: 13,
    opacity: 0.7,
    lineHeight: 20,
    marginTop: 8,
  },
});
