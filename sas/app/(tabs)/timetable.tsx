import { useState, useEffect } from 'react';
import { StyleSheet, FlatList, View, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';
import { attendanceAPI } from '@/services/api';

export default function TimetableScreen() {
  const colorScheme = useColorScheme();
  const { user, token } = useAuth();
  const [timetable, setTimetable] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const studentId = user?.id;
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    if (studentId && token) {
      fetchTimetable();
    }
  }, [studentId, token]);

  const fetchTimetable = async () => {
    if (!studentId || !token) return;

    setLoading(true);
    try {
      const data = await attendanceAPI.getStudentTimetable(studentId, token);
      setTimetable(data);
    } catch (error: any) {
      console.error('Error fetching timetable:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTimetable();
    setRefreshing(false);
  };

  const getPeriodColor = (index: number) => {
    const colors = [
      'rgba(33, 150, 243, 0.1)',
      'rgba(76, 175, 80, 0.1)',
      'rgba(255, 193, 7, 0.1)',
      'rgba(244, 67, 54, 0.1)',
      'rgba(156, 39, 176, 0.1)',
      'rgba(0, 188, 212, 0.1)',
      'rgba(255, 152, 0, 0.1)',
      'rgba(63, 81, 181, 0.1)',
    ];
    return colors[index % colors.length];
  };

  if (!user || user.role !== 'student') {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>This feature is only available for students.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Timeline-Style Header */}
      <View style={[styles.timelineHeader, { backgroundColor: Colors[colorScheme ?? 'light'].tint + '12' }]}>
        <View style={styles.timelineHeaderContent}>
          <View style={styles.timelineIconContainer}>
            <IconSymbol name="calendar.circle.fill" size={32} color={Colors[colorScheme ?? 'light'].tint} />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText type="title" style={styles.timelineTitle}>Weekly Schedule</ThemedText>
            <ThemedText style={styles.timelineSubtitle}>
              Class: {timetable?.student?.class || 'N/A'} • {timetable?.totalPeriods || 0} periods
            </ThemedText>
          </View>
          <TouchableOpacity onPress={fetchTimetable}>
            <IconSymbol name="arrow.clockwise" size={20} color={Colors[colorScheme ?? 'light'].tint} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
        </View>
      ) : timetable ? (
        <FlatList
          data={days}
          keyExtractor={(day) => day}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item: day }) => {
            const dayClasses = timetable.timetable?.[day] || [];
            const hasClasses = dayClasses.length > 0;

            return (
              <ThemedView style={[styles.dayCard, { marginHorizontal: 16 }]}>
                <ThemedText type="defaultSemiBold" style={styles.dayTitle}>{day}</ThemedText>
                
                {hasClasses ? (
                  <View style={styles.classesContainer}>
                    {dayClasses.map((classItem: any, index: number) => (
                      <View key={index} style={[styles.classItem, { backgroundColor: getPeriodColor(index) }]}>
                        <View style={styles.periodInfo}>
                          <ThemedText style={styles.period}>Period {classItem.period}</ThemedText>
                          <ThemedText type="defaultSemiBold" style={styles.subject}>
                            {classItem.subjectId?.name || 'Subject'}
                          </ThemedText>
                          {classItem.subjectId?.code && (
                            <ThemedText style={styles.code}>Code: {classItem.subjectId.code}</ThemedText>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <ThemedText style={styles.noClasses}>No classes scheduled</ThemedText>
                )}
              </ThemedView>
            );
          }}
          ListFooterComponent={
            timetable.totalPeriods ? (
              <ThemedView style={[styles.summaryCard, { marginHorizontal: 16 }]}>
                <IconSymbol name="info.circle.fill" size={18} color={Colors[colorScheme ?? 'light'].tint} />
                <View style={styles.summaryContent}>
                  <ThemedText type="defaultSemiBold">Total Periods</ThemedText>
                  <ThemedText style={styles.summaryValue}>{timetable.totalPeriods} periods per week</ThemedText>
                </View>
              </ThemedView>
            ) : null
          }
        />
      ) : (
        <View style={styles.emptyState}>
          <IconSymbol name="calendar" size={48} color={Colors[colorScheme ?? 'light'].text} />
          <ThemedText style={styles.emptyText}>No timetable data available</ThemedText>
          <TouchableOpacity 
            style={[styles.retryButton, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}
            onPress={fetchTimetable}>
            <ThemedText style={styles.retryButtonText}>Try Again</ThemedText>
          </TouchableOpacity>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timelineHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  timelineHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timelineIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineTitle: {
    marginBottom: 2,
  },
  timelineSubtitle: {
    fontSize: 12,
    opacity: 0.6,
  },
  headerSubtitle: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  refreshButton: {
    padding: 8,
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
  dayCard: {
    marginBottom: 10,
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
  dayTitle: {
    marginBottom: 8,
    fontSize: 15,
    fontWeight: '600',
  },
  classesContainer: {
    gap: 8,
  },
  classItem: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  periodInfo: {
    gap: 2,
  },
  period: {
    fontSize: 10,
    opacity: 0.6,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  subject: {
    fontSize: 14,
  },
  code: {
    fontSize: 11,
    opacity: 0.7,
  },
  noClasses: {
    fontSize: 12,
    opacity: 0.6,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
  summaryCard: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    marginTop: 8,
    gap: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  summaryContent: {
    flex: 1,
  },
  summaryValue: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 12,
    paddingVertical: 40,
  },
  emptyText: {
    opacity: 0.6,
    fontSize: 14,
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
