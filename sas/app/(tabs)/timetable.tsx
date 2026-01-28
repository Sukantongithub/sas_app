import { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
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
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <ThemedView style={styles.header}>
        <View>
          <ThemedText type="title">Timetable</ThemedText>
          <ThemedText style={styles.headerSubtitle}>Class: {timetable?.student?.class}</ThemedText>
        </View>
        <TouchableOpacity onPress={fetchTimetable}>
          <IconSymbol name="arrow.clockwise" size={24} color={Colors[colorScheme ?? 'light'].tint} />
        </TouchableOpacity>
      </ThemedView>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
        </View>
      ) : timetable ? (
        <View style={styles.content}>
          {days.map((day) => {
            const dayClasses = timetable.timetable?.[day] || [];
            const hasClasses = dayClasses.length > 0;

            return (
              <ThemedView key={day} style={styles.dayCard}>
                <ThemedText type="subtitle" style={styles.dayTitle}>{day}</ThemedText>
                
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
          })}

          <ThemedView style={styles.summaryCard}>
            <IconSymbol name="info.circle" size={20} color={Colors[colorScheme ?? 'light'].tint} />
            <View style={styles.summaryContent}>
              <ThemedText type="defaultSemiBold">Total Periods</ThemedText>
              <ThemedText style={styles.summaryValue}>{timetable.totalPeriods} periods per week</ThemedText>
            </View>
          </ThemedView>
        </View>
      ) : (
        <View style={styles.emptyState}>
          <IconSymbol name="calendar" size={48} color="#999" />
          <ThemedText style={styles.emptyText}>No timetable data available</ThemedText>
          <TouchableOpacity 
            style={[styles.retryButton, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}
            onPress={fetchTimetable}>
            <ThemedText style={styles.retryButtonText}>Try Again</ThemedText>
          </TouchableOpacity>
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
  headerSubtitle: {
    fontSize: 14,
    opacity: 0.6,
    marginTop: 4,
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
  dayCard: {
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
  },
  dayTitle: {
    marginBottom: 12,
    fontSize: 18,
  },
  classesContainer: {
    gap: 10,
  },
  classItem: {
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  periodInfo: {
    gap: 4,
  },
  period: {
    fontSize: 11,
    opacity: 0.6,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  subject: {
    fontSize: 15,
  },
  code: {
    fontSize: 12,
    opacity: 0.7,
  },
  noClasses: {
    fontSize: 13,
    opacity: 0.6,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  summaryCard: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 10,
    marginTop: 20,
    marginBottom: 20,
    gap: 12,
    alignItems: 'center',
  },
  summaryContent: {
    flex: 1,
  },
  summaryValue: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyText: {
    marginTop: 12,
    opacity: 0.6,
    fontSize: 14,
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
