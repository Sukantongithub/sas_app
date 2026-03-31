import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  FlatList,
  View,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';
import { attendanceAPI, timetableAPI } from '@/services/api';
import CommonHeader from '@/components/CommonHeader';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────
interface Period {
  periodNumber: number;
  subject: string;
  startTime: string;
  endTime: string;
  room?: string;
  isLab?: boolean;
  timetableId?: string; // entry _id from DB
}

interface ClassItem {
  _id: string;
  name: string;
  code: string;
  department: string;
  semester: number;
  section?: string;
  students?: string[];
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_LOWER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
const getPeriodColor = (index: number) => {
  const colors = [
    'rgba(33, 150, 243, 0.12)',
    'rgba(76, 175, 80, 0.12)',
    'rgba(255, 193, 7, 0.12)',
    'rgba(244, 67, 54, 0.12)',
    'rgba(156, 39, 176, 0.12)',
    'rgba(0, 188, 212, 0.12)',
    'rgba(255, 152, 0, 0.12)',
    'rgba(63, 81, 181, 0.12)',
  ];
  return colors[index % colors.length];
};

const accentColors = [
  '#2196F3', '#4CAF50', '#FFC107', '#F44336',
  '#9C27B0', '#00BCD4', '#FF9800', '#3F51B5',
];

// ─────────────────────────────────────────────────────────────────
// Empty period template
// ─────────────────────────────────────────────────────────────────
const emptyPeriod = (): Omit<Period, 'timetableId'> => ({
  periodNumber: 1,
  subject: '',
  startTime: '09:00',
  endTime: '09:50',
  room: '',
  isLab: false,
});

// ─────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────
export default function TimetableScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'light'];
  const { user, token } = useAuth();

  const isStaff = user?.role && ['staff', 'hod'].includes(user.role);

  // ── Student state ──
  const [studentTimetable, setStudentTimetable] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ── Staff state ──
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [weeklyTimetable, setWeeklyTimetable] = useState<Record<string, Period[]>>({});
  const [timetableEntries, setTimetableEntries] = useState<any[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [classPickerOpen, setClassPickerOpen] = useState(false);

  // ── Modal state ──
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDay, setEditingDay] = useState<string>('');
  const [editingPeriods, setEditingPeriods] = useState<Omit<Period, 'timetableId'>[]>([emptyPeriod()]);
  const [savingDay, setSavingDay] = useState(false);

  // ─────────────────────────────────────────────────────────────────
  // Student: fetch timetable
  // ─────────────────────────────────────────────────────────────────
  const fetchStudentTimetable = useCallback(async () => {
    if (!user?.id || !token) return;
    setLoading(true);
    try {
      // Pass user ID - backend will handle both Student._id and User._id lookups
      const data = await attendanceAPI.getStudentTimetable(user.id, token);
      if (data && data.timetable) {
        setStudentTimetable(data);
      } else {
        console.warn('No timetable data received:', data);
      }
    } catch (err: any) {
      console.error('Error fetching student timetable:', err);
      // If student not found, it might be that the student profile hasn't been created yet
      if (err?.response?.status === 404) {
        console.warn('Student profile not found. Make sure you are logged in as a student.');
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id, token]);

  // ─────────────────────────────────────────────────────────────────
  // Staff: fetch assigned classes
  // ─────────────────────────────────────────────────────────────────
  const fetchTeacherClasses = useCallback(async () => {
    if (!token) return;
    setStaffLoading(true);
    try {
      const data = await timetableAPI.getTeacherClasses(token);
      const list: ClassItem[] = Array.isArray(data?.data) ? data.data : [];
      setClasses(list);
      if (list.length > 0 && !selectedClass) {
        setSelectedClass(list[0]);
      }
    } catch (err) {
      console.error('Error fetching teacher classes:', err);
    } finally {
      setStaffLoading(false);
    }
  }, [token]);

  // ─────────────────────────────────────────────────────────────────
  // Staff: fetch timetable for selected class
  // ─────────────────────────────────────────────────────────────────
  const fetchClassTimetable = useCallback(async (cls: ClassItem) => {
    if (!token) return;
    setStaffLoading(true);
    try {
      const data = await timetableAPI.getClassTimetable(cls._id, token);
      const tt = data?.data?.timetable || {};
      const entries = data?.data?.entries || [];
      setWeeklyTimetable(tt);
      setTimetableEntries(entries);
    } catch (err) {
      console.error('Error fetching class timetable:', err);
    } finally {
      setStaffLoading(false);
    }
  }, [token]);

  // ─────────────────────────────────────────────────────────────────
  // Effects
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isStaff) {
      fetchTeacherClasses();
    } else if (user) {
      fetchStudentTimetable();
    }
  }, [isStaff, user?.id]);

  useEffect(() => {
    if (isStaff && selectedClass) {
      fetchClassTimetable(selectedClass);
    }
  }, [selectedClass?._id]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (isStaff && selectedClass) {
      await fetchClassTimetable(selectedClass);
    } else {
      await fetchStudentTimetable();
    }
    setRefreshing(false);
  };

  // ─────────────────────────────────────────────────────────────────
  // Staff: open add/edit modal for a day
  // ─────────────────────────────────────────────────────────────────
  const openDayEditor = (day: string) => {
    const dayLower = day.toLowerCase();
    const existing = weeklyTimetable[dayLower] || [];
    setEditingDay(day);
    if (existing.length > 0) {
      setEditingPeriods(existing.map(p => ({
        periodNumber: p.periodNumber,
        subject: p.subject,
        startTime: p.startTime,
        endTime: p.endTime,
        room: p.room || '',
        isLab: p.isLab || false,
      })));
    } else {
      setEditingPeriods([emptyPeriod()]);
    }
    setModalVisible(true);
  };

  const addPeriodToModal = () => {
    setEditingPeriods(prev => [
      ...prev,
      { ...emptyPeriod(), periodNumber: prev.length + 1 },
    ]);
  };

  const removePeriodFromModal = (idx: number) => {
    setEditingPeriods(prev => prev.filter((_, i) => i !== idx).map((p, i) => ({ ...p, periodNumber: i + 1 })));
  };

  const updatePeriodField = (idx: number, field: keyof Omit<Period, 'timetableId'>, value: any) => {
    setEditingPeriods(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  };

  // ─────────────────────────────────────────────────────────────────
  // Staff: save a day's timetable
  // ─────────────────────────────────────────────────────────────────
  const saveDayTimetable = async () => {
    if (!selectedClass || !token) return;

    for (const p of editingPeriods) {
      if (!p.subject.trim()) {
        Alert.alert('Validation', 'Subject name is required for all periods.');
        return;
      }
      if (!p.startTime || !p.endTime) {
        Alert.alert('Validation', 'Start and end times are required.');
        return;
      }
    }

    setSavingDay(true);
    try {
      const dayLower = editingDay.toLowerCase();
      // Find existing entry for this day
      const existingEntry = timetableEntries.find(e => e.dayOfWeek === dayLower);

      if (existingEntry) {
        await timetableAPI.updateTimetableEntry(existingEntry._id, {
          periods: editingPeriods.map(p => ({
            periodNumber: p.periodNumber,
            subject: p.subject.trim(),
            startTime: p.startTime,
            endTime: p.endTime,
            room: p.room?.trim() || undefined,
            isLab: p.isLab || false,
          })),
        }, token);
      } else {
        await timetableAPI.createTimetableEntry({
          classId: selectedClass._id,
          dayOfWeek: dayLower,
          section: selectedClass.section,
          periods: editingPeriods.map(p => ({
            periodNumber: p.periodNumber,
            subject: p.subject.trim(),
            startTime: p.startTime,
            endTime: p.endTime,
            room: p.room?.trim() || undefined,
            isLab: p.isLab || false,
          })),
        }, token);
      }

      setModalVisible(false);
      await fetchClassTimetable(selectedClass);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save timetable.');
    } finally {
      setSavingDay(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // Staff: clear a day's timetable
  // ─────────────────────────────────────────────────────────────────
  const clearDay = (day: string) => {
    const dayLower = day.toLowerCase();
    const entry = timetableEntries.find(e => e.dayOfWeek === dayLower);
    if (!entry) return;

    Alert.alert(
      'Clear Day',
      `Remove all periods for ${day}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear', style: 'destructive',
          onPress: async () => {
            try {
              await timetableAPI.deleteTimetableEntry(entry._id, token!);
              if (selectedClass) await fetchClassTimetable(selectedClass);
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete.');
            }
          },
        },
      ]
    );
  };

  // ─────────────────────────────────────────────────────────────────
  // RENDER: loading
  // ─────────────────────────────────────────────────────────────────
  if (loading || (isStaff && staffLoading && classes.length === 0)) {
    return (
      <ThemedView style={styles.container}>
        <CommonHeader title="Timetable" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      </ThemedView>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // RENDER: STUDENT VIEW
  // ─────────────────────────────────────────────────────────────────
  if (!isStaff) {
    return (
      <ThemedView style={styles.container}>
        <CommonHeader title="Weekly Schedule" />

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.tint} />
          </View>
        ) : studentTimetable ? (
          <FlatList
            data={DAYS}
            keyExtractor={day => day}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            renderItem={({ item: day }) => {
              const dayClasses = studentTimetable.timetable?.[day] || [];
              const hasClasses = dayClasses.length > 0;
              return (
                <ThemedView style={[styles.dayCard, { marginHorizontal: 16 }]}>
                  <ThemedText type="defaultSemiBold" style={styles.dayTitle}>{day}</ThemedText>
                  {hasClasses ? (
                    <View style={styles.classesContainer}>
                      {dayClasses.map((classItem: any, index: number) => (
                        <View
                          key={index}
                          style={[styles.classItem, {
                            backgroundColor: getPeriodColor(index),
                            borderLeftColor: accentColors[index % accentColors.length],
                          }]}
                        >
                          <View style={styles.periodInfo}>
                            <ThemedText style={styles.period}>Period {classItem.periodNumber || classItem.period}</ThemedText>
                            <ThemedText type="defaultSemiBold" style={styles.subject}>
                              {classItem.subject || 'Subject'}
                            </ThemedText>
                            {classItem.startTime && classItem.endTime && (
                              <ThemedText style={styles.code}>{classItem.startTime} - {classItem.endTime}</ThemedText>
                            )}
                            {classItem.room && (
                              <ThemedText style={styles.code}>Room: {classItem.room}</ThemedText>
                            )}
                            {classItem.isLab && (
                              <ThemedText style={[styles.code, { color: '#FF9800' }]}>🔬 Lab Class</ThemedText>
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
              studentTimetable.totalPeriods ? (
                <ThemedView style={[styles.summaryCard, { marginHorizontal: 16 }]}>
                  <IconSymbol name="info.circle.fill" size={18} color={colors.tint} />
                  <View style={styles.summaryContent}>
                    <ThemedText type="defaultSemiBold">Total Periods</ThemedText>
                    <ThemedText style={styles.summaryValue}>{studentTimetable.totalPeriods} periods per week</ThemedText>
                  </View>
                </ThemedView>
              ) : null
            }
          />
        ) : (
          <View style={styles.emptyState}>
            <IconSymbol name="calendar" size={48} color={colors.text} />
            <ThemedText style={styles.emptyText}>No timetable data available</ThemedText>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.tint }]}
              onPress={fetchStudentTimetable}
            >
              <ThemedText style={styles.retryButtonText}>Try Again</ThemedText>
            </TouchableOpacity>
          </View>
        )}
      </ThemedView>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // RENDER: STAFF VIEW
  // ─────────────────────────────────────────────────────────────────
  return (
    <ThemedView style={styles.container}>
      <CommonHeader title="Manage Timetable" />

      {/* Class Picker */}
      <View style={[styles.classPickerBar, { backgroundColor: isDark ? colors.cardBackground : '#F3F4F6' }]}>
        <TouchableOpacity
          style={[styles.classPickerBtn, { borderColor: colors.tint }]}
          onPress={() => setClassPickerOpen(true)}
        >
          <IconSymbol name="rectangle.stack.fill" size={16} color={colors.tint} />
          <ThemedText style={[styles.classPickerText, { color: colors.tint }]} numberOfLines={1}>
            {selectedClass ? `${selectedClass.name} (${selectedClass.code})` : 'Select a Class'}
          </ThemedText>
          <IconSymbol name="chevron.down" size={14} color={colors.tint} />
        </TouchableOpacity>
        {selectedClass && (
          <ThemedText style={styles.classSubtext}>
            {selectedClass.department} · Sem {selectedClass.semester}
            {selectedClass.section ? ` · Sec ${selectedClass.section}` : ''}
            {selectedClass.students ? ` · ${selectedClass.students.length} students` : ''}
          </ThemedText>
        )}
      </View>

      {staffLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      ) : !selectedClass ? (
        <View style={styles.emptyState}>
          <IconSymbol name="rectangle.stack" size={48} color={colors.text} />
          <ThemedText style={styles.emptyText}>No classes found</ThemedText>
          <ThemedText style={styles.emptySubtext}>
            Ask your admin to create classes in the Admin Panel first.
          </ThemedText>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.tint }]}
            onPress={fetchTeacherClasses}
          >
            <ThemedText style={styles.retryButtonText}>Refresh</ThemedText>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {DAYS.map((day, dayIdx) => {
            const dayLower = day.toLowerCase();
            const periods: Period[] = weeklyTimetable[dayLower] || [];
            const hasPeriods = periods.length > 0;

            return (
              <ThemedView key={day} style={[styles.dayCard, { marginHorizontal: 16 }]}>
                {/* Day header */}
                <View style={styles.dayHeader}>
                  <ThemedText type="defaultSemiBold" style={styles.dayTitle}>{day}</ThemedText>
                  <View style={styles.dayActions}>
                    {hasPeriods && (
                      <TouchableOpacity
                        style={[styles.iconBtn, { backgroundColor: 'rgba(244,67,54,0.1)' }]}
                        onPress={() => clearDay(day)}
                      >
                        <IconSymbol name="trash" size={14} color="#F44336" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.iconBtn, { backgroundColor: colors.tint + '18' }]}
                      onPress={() => openDayEditor(day)}
                    >
                      <IconSymbol name={hasPeriods ? 'pencil' : 'plus'} size={14} color={colors.tint} />
                      <ThemedText style={[styles.iconBtnText, { color: colors.tint }]}>
                        {hasPeriods ? 'Edit' : 'Add'}
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Periods */}
                {hasPeriods ? (
                  <View style={styles.classesContainer}>
                    {periods.map((p, idx) => (
                      <View
                        key={idx}
                        style={[styles.classItem, {
                          backgroundColor: getPeriodColor(idx),
                          borderLeftColor: accentColors[idx % accentColors.length],
                        }]}
                      >
                        <View style={styles.periodRow}>
                          <View style={styles.periodInfo}>
                            <ThemedText style={styles.period}>
                              Period {p.periodNumber}{p.isLab ? ' · LAB' : ''}
                            </ThemedText>
                            <ThemedText type="defaultSemiBold" style={styles.subject}>{p.subject}</ThemedText>
                            <ThemedText style={styles.code}>{p.startTime} – {p.endTime}{p.room ? ` · ${p.room}` : ''}</ThemedText>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <ThemedText style={styles.noClasses}>No periods — tap Add to create</ThemedText>
                )}
              </ThemedView>
            );
          })}

          {/* Info footer */}
          <ThemedView style={[styles.summaryCard, { marginHorizontal: 16 }]}>
            <IconSymbol name="info.circle.fill" size={18} color={colors.tint} />
            <View style={styles.summaryContent}>
              <ThemedText type="defaultSemiBold">Assigned to students</ThemedText>
              <ThemedText style={styles.summaryValue}>
                Students in this class will see the timetable you set here.
              </ThemedText>
            </View>
          </ThemedView>
        </ScrollView>
      )}

      {/* ── Class Picker Modal ── */}
      <Modal visible={classPickerOpen} transparent animationType="fade" onRequestClose={() => setClassPickerOpen(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setClassPickerOpen(false)}>
          <View style={[styles.pickerSheet, { backgroundColor: isDark ? '#1E293B' : '#fff' }]}>
            <ThemedText type="defaultSemiBold" style={styles.pickerTitle}>Select Class</ThemedText>
            <ScrollView>
              {classes.map(cls => (
                <TouchableOpacity
                  key={cls._id}
                  style={[
                    styles.pickerItem,
                    selectedClass?._id === cls._id && { backgroundColor: colors.tint + '18' },
                  ]}
                  onPress={() => { setSelectedClass(cls); setClassPickerOpen(false); }}
                >
                  <ThemedText type="defaultSemiBold">{cls.name}</ThemedText>
                  <ThemedText style={styles.pickerItemSub}>
                    {cls.code} · {cls.department} · Sem {cls.semester}
                    {cls.section ? ` · Sec ${cls.section}` : ''}
                  </ThemedText>
                </TouchableOpacity>
              ))}
              {classes.length === 0 && (
                <ThemedText style={styles.noClasses}>No classes found</ThemedText>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Day Period Editor Modal ── */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.editorSheet, { backgroundColor: isDark ? '#1E293B' : '#fff' }]}>
            {/* Header */}
            <View style={styles.editorHeader}>
              <ThemedText type="defaultSemiBold" style={styles.editorTitle}>
                {editingDay} · {selectedClass?.name}
              </ThemedText>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <IconSymbol name="xmark.circle.fill" size={24} color={isDark ? '#94A3B8' : '#9CA3AF'} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.editorScroll} keyboardShouldPersistTaps="handled">
              {editingPeriods.map((p, idx) => (
                <View key={idx} style={[styles.periodEditor, { borderColor: isDark ? '#334155' : '#E5E7EB' }]}>
                  {/* Period header */}
                  <View style={styles.periodEditorHeader}>
                    <ThemedText type="defaultSemiBold" style={{ color: colors.tint }}>Period {p.periodNumber}</ThemedText>
                    {editingPeriods.length > 1 && (
                      <TouchableOpacity onPress={() => removePeriodFromModal(idx)}>
                        <IconSymbol name="minus.circle.fill" size={20} color="#F44336" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Subject */}
                  <ThemedText style={styles.fieldLabel}>Subject *</ThemedText>
                  <TextInput
                    style={[styles.input, { color: isDark ? '#F1F5F9' : '#1E293B', borderColor: isDark ? '#475569' : '#D1D5DB', backgroundColor: isDark ? '#0F172A' : '#F9FAFB' }]}
                    placeholder="e.g. Mathematics"
                    placeholderTextColor={isDark ? '#475569' : '#9CA3AF'}
                    value={p.subject}
                    onChangeText={v => updatePeriodField(idx, 'subject', v)}
                  />

                  {/* Time row */}
                  <View style={styles.timeRow}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <ThemedText style={styles.fieldLabel}>Start Time *</ThemedText>
                      <TextInput
                        style={[styles.input, { color: isDark ? '#F1F5F9' : '#1E293B', borderColor: isDark ? '#475569' : '#D1D5DB', backgroundColor: isDark ? '#0F172A' : '#F9FAFB' }]}
                        placeholder="09:00"
                        placeholderTextColor={isDark ? '#475569' : '#9CA3AF'}
                        value={p.startTime}
                        onChangeText={v => updatePeriodField(idx, 'startTime', v)}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.fieldLabel}>End Time *</ThemedText>
                      <TextInput
                        style={[styles.input, { color: isDark ? '#F1F5F9' : '#1E293B', borderColor: isDark ? '#475569' : '#D1D5DB', backgroundColor: isDark ? '#0F172A' : '#F9FAFB' }]}
                        placeholder="09:50"
                        placeholderTextColor={isDark ? '#475569' : '#9CA3AF'}
                        value={p.endTime}
                        onChangeText={v => updatePeriodField(idx, 'endTime', v)}
                      />
                    </View>
                  </View>

                  {/* Room */}
                  <ThemedText style={styles.fieldLabel}>Room (optional)</ThemedText>
                  <TextInput
                    style={[styles.input, { color: isDark ? '#F1F5F9' : '#1E293B', borderColor: isDark ? '#475569' : '#D1D5DB', backgroundColor: isDark ? '#0F172A' : '#F9FAFB' }]}
                    placeholder="e.g. Lab 3 / Room 204"
                    placeholderTextColor={isDark ? '#475569' : '#9CA3AF'}
                    value={p.room}
                    onChangeText={v => updatePeriodField(idx, 'room', v)}
                  />

                  {/* Is Lab toggle */}
                  <TouchableOpacity
                    style={styles.labToggle}
                    onPress={() => updatePeriodField(idx, 'isLab', !p.isLab)}
                  >
                    <View style={[styles.checkbox, { borderColor: colors.tint, backgroundColor: p.isLab ? colors.tint : 'transparent' }]}>
                      {p.isLab && <IconSymbol name="checkmark" size={11} color="#fff" />}
                    </View>
                    <ThemedText style={styles.labLabel}>Lab session</ThemedText>
                  </TouchableOpacity>
                </View>
              ))}

              {/* Add another period */}
              <TouchableOpacity style={[styles.addPeriodBtn, { borderColor: colors.tint }]} onPress={addPeriodToModal}>
                <IconSymbol name="plus.circle.fill" size={18} color={colors.tint} />
                <ThemedText style={[styles.addPeriodText, { color: colors.tint }]}>Add Another Period</ThemedText>
              </TouchableOpacity>
            </ScrollView>

            {/* Save button */}
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.tint, opacity: savingDay ? 0.7 : 1 }]}
              onPress={saveDayTimetable}
              disabled={savingDay}
            >
              {savingDay
                ? <ActivityIndicator size="small" color="#fff" />
                : <ThemedText style={styles.saveBtnText}>Save Timetable</ThemedText>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

// ─────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingTop: 8, paddingBottom: 28 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Class picker bar
  classPickerBar: { paddingHorizontal: 16, paddingVertical: 10, gap: 4 },
  classPickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  classPickerText: { fontSize: 14, fontWeight: '600', maxWidth: 220 },
  classSubtext: { fontSize: 11, opacity: 0.6, marginTop: 2 },

  // Day card
  dayCard: {
    marginBottom: 10, marginTop: 2, paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 12, backgroundColor: 'rgba(128,128,128,0.08)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 2, elevation: 2,
  },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  dayTitle: { fontSize: 15, fontWeight: '600' },
  dayActions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
  },
  iconBtnText: { fontSize: 12, fontWeight: '600' },

  // Period items
  classesContainer: { gap: 8 },
  classItem: {
    paddingVertical: 10, paddingHorizontal: 10, borderRadius: 10, borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  periodRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  periodInfo: { gap: 2, flex: 1 },
  period: { fontSize: 10, opacity: 0.6, fontWeight: '600', textTransform: 'uppercase' },
  subject: { fontSize: 14 },
  code: { fontSize: 11, opacity: 0.7 },
  noClasses: { fontSize: 12, opacity: 0.6, fontStyle: 'italic', textAlign: 'center', paddingVertical: 12 },

  // Summary
  summaryCard: {
    flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12,
    marginBottom: 8, marginTop: 8, gap: 10, alignItems: 'center',
    backgroundColor: 'rgba(128,128,128,0.08)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 2,
  },
  summaryContent: { flex: 1 },
  summaryValue: { fontSize: 12, opacity: 0.7, marginTop: 2 },

  // Empty
  emptyState: { alignItems: 'center', justifyContent: 'center', flex: 1, gap: 12, paddingVertical: 40 },
  emptyText: { opacity: 0.6, fontSize: 14 },
  emptySubtext: { opacity: 0.5, fontSize: 12, textAlign: 'center', paddingHorizontal: 32 },
  retryButton: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  // Class picker modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32, maxHeight: '60%' },
  pickerTitle: { fontSize: 16, marginBottom: 12 },
  pickerItem: { paddingVertical: 12, paddingHorizontal: 8, borderRadius: 10, marginBottom: 4 },
  pickerItemSub: { fontSize: 11, opacity: 0.6, marginTop: 2 },

  // Editor modal
  editorSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%', paddingBottom: Platform.OS === 'ios' ? 32 : 16 },
  editorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(128,128,128,0.15)' },
  editorTitle: { fontSize: 15 },
  editorScroll: { paddingHorizontal: 16, paddingTop: 12 },
  periodEditor: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
  periodEditorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  fieldLabel: { fontSize: 11, fontWeight: '600', opacity: 0.6, textTransform: 'uppercase', marginBottom: 4, marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 },
  timeRow: { flexDirection: 'row' },
  labToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  labLabel: { fontSize: 13, opacity: 0.8 },
  addPeriodBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 10, padding: 12, justifyContent: 'center', marginBottom: 16 },
  addPeriodText: { fontSize: 14, fontWeight: '600' },
  saveBtn: { marginHorizontal: 16, marginTop: 8, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
