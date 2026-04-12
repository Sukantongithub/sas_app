import { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
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

// ─── Types ───────────────────────────────────────────────────────────────────

interface BackendPeriod {
  timetableId: string;  // entry._id embedded by backend
  dayOfWeek: string;
  periodNumber: number;
  subject: string;
  startTime: string;
  endTime: string;
  room?: string;
  isLab?: boolean;
}

interface EditPeriod {
  periodNumber: number;
  subject: string;
  startTime: string;
  endTime: string;
  room: string;
  isLab: boolean;
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

// ─── Constants ───────────────────────────────────────────────────────────────

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const PERIOD_COLORS = [
  'rgba(33,150,243,0.12)', 'rgba(76,175,80,0.12)',
  'rgba(255,193,7,0.12)',  'rgba(244,67,54,0.12)',
  'rgba(156,39,176,0.12)', 'rgba(0,188,212,0.12)',
  'rgba(255,152,0,0.12)',  'rgba(63,81,181,0.12)',
];
const ACCENT = ['#2196F3','#4CAF50','#FFC107','#F44336','#9C27B0','#00BCD4','#FF9800','#3F51B5'];

const blankEdit = (): EditPeriod => ({
  periodNumber: 1, subject: '', startTime: '09:00', endTime: '09:50', room: '', isLab: false,
});

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TimetableScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'light'];
  const { user, token } = useAuth();
  const isStaff = user?.role && ['staff', 'hod', 'admin', 'super_admin'].includes(user.role);

  // ── Student state ──
  const [studentTimetable, setStudentTimetable] = useState<any>(null);
  const [studentLoading, setStudentLoading] = useState(false);

  // ── Staff: class list ──
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [classPickerOpen, setClassPickerOpen] = useState(false);

  // ── Staff: weekly timetable  (key = lowercase day, value = array of BackendPeriod) ──
  // This is the SINGLE source of truth. timetableId comes from backend on each period.
  const [weekly, setWeekly] = useState<Record<string, BackendPeriod[]>>({});
  const [ttLoading, setTtLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ── Editor modal ──
  const [editorDay, setEditorDay] = useState('');
  const [editorPeriods, setEditorPeriods] = useState<EditPeriod[]>([blankEdit()]);
  const [editorVisible, setEditorVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Add period quick modal ──
  const [addModalDay, setAddModalDay] = useState('');
  const [addForm, setAddForm] = useState<EditPeriod>(blankEdit());
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addingPeriod, setAddingPeriod] = useState(false);

  // ── Per-period delete busy state ──
  // Key: `${day}-${periodNumber}`
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  // ─── Fetch helpers ────────────────────────────────────────────────────────

  const loadStudentTimetable = useCallback(async () => {
    if (!user?.id || !token) return;
    setStudentLoading(true);
    try {
      const res = await attendanceAPI.getStudentTimetable(user.id, token);
      if (res?.timetable) setStudentTimetable(res);
    } catch (e) {
      console.error('student timetable error', e);
    } finally {
      setStudentLoading(false);
    }
  }, [user?.id, token]);

  const loadClasses = useCallback(async () => {
    if (!token) return;
    setTtLoading(true);
    try {
      const res = await timetableAPI.getTeacherClasses(token);
      const list: ClassItem[] = Array.isArray(res?.data) ? res.data : [];
      setClasses(list);
      if (list.length > 0 && !selectedClass) setSelectedClass(list[0]);
    } catch (e) {
      console.error('loadClasses error', e);
    } finally {
      setTtLoading(false);
    }
  }, [token]);

  /**
   * loadTimetable:
   *   GET /api/teachers/timetable/class/:classId
   *   Response shape: { success: true, data: { timetable: { monday: [...], ... }, entries: [...] } }
   *
   *   Each period in `timetable.<day>` already has `timetableId` set to entry._id by the backend.
   *   We store exactly that — no ObjectId conversion needed (JSON serialises ObjectId to string).
   */
  const loadTimetable = useCallback(async (cls: ClassItem) => {
    if (!token) return;
    setTtLoading(true);
    try {
      const res = await timetableAPI.getClassTimetable(cls._id, token);
      const tt: Record<string, BackendPeriod[]> = res?.data?.timetable || {};
      // Guarantee all day keys exist
      const full: Record<string, BackendPeriod[]> = {};
      DAYS.forEach(d => { full[d.toLowerCase()] = tt[d.toLowerCase()] || []; });
      setWeekly(full);
    } catch (e) {
      console.error('loadTimetable error', e);
      Alert.alert('Error', 'Failed to load timetable. Pull down to refresh.');
    } finally {
      setTtLoading(false);
    }
  }, [token]);

  // ─── Effects ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isStaff) loadClasses();
    else if (user) loadStudentTimetable();
  }, [isStaff, user?.id]);

  useEffect(() => {
    if (isStaff && selectedClass) loadTimetable(selectedClass);
  }, [selectedClass?._id]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (isStaff && selectedClass) await loadTimetable(selectedClass);
    else await loadStudentTimetable();
    setRefreshing(false);
  };

  // ─── Staff: day editor ───────────────────────────────────────────────────

  const openEditor = (day: string) => {
    const existing = weekly[day.toLowerCase()] || [];
    setEditorDay(day);
    setEditorPeriods(
      existing.length > 0
        ? existing.map(p => ({
            periodNumber: p.periodNumber,
            subject: p.subject,
            startTime: p.startTime,
            endTime: p.endTime,
            room: p.room || '',
            isLab: p.isLab || false,
          }))
        : [blankEdit()]
    );
    setEditorVisible(true);
  };

  const updateEditorField = (idx: number, field: keyof EditPeriod, val: any) =>
    setEditorPeriods(prev => prev.map((p, i) => (i === idx ? { ...p, [field]: val } : p)));

  const addEditorPeriod = () =>
    setEditorPeriods(prev => [...prev, { ...blankEdit(), periodNumber: prev.length + 1 }]);

  const removeEditorPeriod = (idx: number) => {
    if (editorPeriods.length === 1) {
      Alert.alert('Cannot Remove', 'At least one period is required. Use the 🗑 trash button to clear the whole day.');
      return;
    }
    setEditorPeriods(prev =>
      prev.filter((_, i) => i !== idx).map((p, i) => ({ ...p, periodNumber: i + 1 }))
    );
  };

  const saveEditor = async () => {
    for (const p of editorPeriods) {
      if (!p.subject.trim()) { Alert.alert('Validation', 'Subject is required for all periods.'); return; }
      if (!p.startTime || !p.endTime) { Alert.alert('Validation', 'Times are required.'); return; }
    }
    if (!selectedClass || !token) return;

    setSaving(true);
    try {
      const dayLower = editorDay.toLowerCase();
      const existing = weekly[dayLower] || [];
      // timetableId is on every period from backend — use first period's id
      const timetableId: string | undefined = existing[0]?.timetableId;

      const payload = editorPeriods.map(p => ({
        periodNumber: p.periodNumber,
        subject: p.subject.trim(),
        startTime: p.startTime,
        endTime: p.endTime,
        room: p.room.trim() || undefined,
        isLab: p.isLab,
      }));

      if (timetableId) {
        // Update existing entry — replace all periods
        await timetableAPI.updateTimetableEntry(timetableId, { periods: payload }, token);
      } else {
        // Create new entry for this day
        await timetableAPI.createTimetableEntry({
          classId: selectedClass._id,
          dayOfWeek: dayLower,
          section: selectedClass.section,
          periods: payload,
        }, token);
      }

      setEditorVisible(false);
      await loadTimetable(selectedClass);
    } catch (e: any) {
      Alert.alert('Save Failed', e?.message || 'Server error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Staff: delete individual period (from card view) ────────────────────

  const handleDeletePeriod = (day: string, period: BackendPeriod) => {
    const dayLower = day.toLowerCase();
    const allPeriodsForDay = weekly[dayLower] || [];
    const key = `${dayLower}-${period.periodNumber}`;

    if (!period.timetableId) {
      Alert.alert('Error', 'Timetable ID missing. Pull down to refresh and try again.');
      return;
    }

    if (allPeriodsForDay.length === 1) {
      // Last period — confirm full day clear instead
      Alert.alert(
        'Remove Last Period',
        `"${period.subject}" is the only period on ${day}. Remove the entire day's schedule?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove Day',
            style: 'destructive',
            onPress: () => handleClearDay(day),
          },
        ]
      );
      return;
    }

    Alert.alert(
      'Delete Period',
      `Delete Period ${period.periodNumber} — "${period.subject}" from ${day}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingKey(key);
            try {
              await timetableAPI.deletePeriod(period.timetableId!, period.periodNumber, token!);
              if (selectedClass) await loadTimetable(selectedClass);
            } catch (e: any) {
              Alert.alert('Delete Failed', e?.message || 'Server error. Please try again.');
            } finally {
              setDeletingKey(null);
            }
          },
        },
      ]
    );
  };

  // ─── Staff: clear entire day ──────────────────────────────────────────────

  const handleClearDay = (day: string) => {
    const dayLower = day.toLowerCase();
    const existing = weekly[dayLower] || [];
    const timetableId: string | undefined = existing[0]?.timetableId;
    if (!timetableId) return;

    Alert.alert(
      'Clear Day',
      `Remove all ${existing.length} period(s) scheduled on ${day}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await timetableAPI.deleteTimetableEntry(timetableId, token!);
              if (selectedClass) await loadTimetable(selectedClass);
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to clear day.');
            }
          },
        },
      ]
    );
  };

  // ─── Staff: quick add period (from card "Add Period" button) ─────────────

  const openAddModal = (day: string) => {
    setAddModalDay(day);
    setAddForm({ ...blankEdit() });
    setAddModalVisible(true);
  };

  const confirmAddPeriod = async () => {
    if (!addForm.subject.trim()) { Alert.alert('Validation', 'Subject is required.'); return; }
    if (!addForm.startTime || !addForm.endTime) { Alert.alert('Validation', 'Times are required.'); return; }
    if (!token || !selectedClass) return;

    const dayLower = addModalDay.toLowerCase();
    const existing = weekly[dayLower] || [];
    const timetableId: string | undefined = existing[0]?.timetableId;

    setAddingPeriod(true);
    try {
      if (timetableId) {
        // Day already has an entry — add period directly via API
        await timetableAPI.addPeriod(timetableId, {
          periodNumber: existing.length + 1,
          subject: addForm.subject.trim(),
          startTime: addForm.startTime,
          endTime: addForm.endTime,
          room: addForm.room.trim() || undefined,
          isLab: addForm.isLab,
        }, token);
      } else {
        // Day has no entry — create one
        await timetableAPI.createTimetableEntry({
          classId: selectedClass._id,
          dayOfWeek: dayLower,
          section: selectedClass.section,
          periods: [{
            periodNumber: 1,
            subject: addForm.subject.trim(),
            startTime: addForm.startTime,
            endTime: addForm.endTime,
            room: addForm.room.trim() || undefined,
            isLab: addForm.isLab,
          }],
        }, token);
      }
      setAddModalVisible(false);
      await loadTimetable(selectedClass);
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Could not add period.');
    } finally {
      setAddingPeriod(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  const inputStyle = [
    styles.input,
    {
      color: isDark ? '#F1F5F9' : '#1E293B',
      borderColor: isDark ? '#475569' : '#D1D5DB',
      backgroundColor: isDark ? '#0F172A' : '#F9FAFB',
    },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Loading screen
  // ─────────────────────────────────────────────────────────────────────────

  if ((isStaff && ttLoading && classes.length === 0) || (!isStaff && studentLoading && !studentTimetable)) {
    return (
      <ThemedView style={styles.container}>
        <CommonHeader title="Timetable" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      </ThemedView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: STUDENT VIEW
  // ─────────────────────────────────────────────────────────────────────────

  if (!isStaff) {
    return (
      <ThemedView style={styles.container}>
        <CommonHeader title="Weekly Schedule" />
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {studentTimetable ? (
            DAYS.map(day => {
              const dayClasses = studentTimetable.timetable?.[day.toLowerCase()] || studentTimetable.timetable?.[day] || [];
              return (
                <ThemedView key={day} style={[styles.dayCard, { marginHorizontal: 16 }]}>
                  <ThemedText type="defaultSemiBold" style={styles.dayTitle}>{day}</ThemedText>
                  {dayClasses.length > 0 ? (
                    <View style={styles.periodsWrap}>
                      {dayClasses.map((p: any, i: number) => (
                        <View
                          key={i}
                          style={[styles.periodCard, {
                            backgroundColor: PERIOD_COLORS[i % PERIOD_COLORS.length],
                            borderLeftColor: ACCENT[i % ACCENT.length],
                          }]}
                        >
                          <ThemedText style={styles.periodLabel}>Period {p.periodNumber || p.period}</ThemedText>
                          <ThemedText type="defaultSemiBold" style={styles.subjectText}>{p.subject}</ThemedText>
                          {p.startTime && <ThemedText style={styles.metaText}>{p.startTime} – {p.endTime}</ThemedText>}
                          {p.room && <ThemedText style={styles.metaText}>📍 {p.room}</ThemedText>}
                          {p.isLab && <ThemedText style={[styles.metaText, { color: '#FF9800' }]}>🔬 Lab</ThemedText>}
                        </View>
                      ))}
                    </View>
                  ) : (
                    <ThemedText style={styles.noData}>No classes scheduled</ThemedText>
                  )}
                </ThemedView>
              );
            })
          ) : (
            <View style={styles.center}>
              <ThemedText style={styles.noData}>No timetable found</ThemedText>
              <TouchableOpacity style={[styles.btn, { backgroundColor: colors.tint }]} onPress={loadStudentTimetable}>
                <ThemedText style={styles.btnText}>Refresh</ThemedText>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </ThemedView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: STAFF VIEW
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <ThemedView style={styles.container}>
      <CommonHeader title="Manage Timetable" />

      {/* ── Class Picker Bar ── */}
      <View style={[styles.pickerBar, { backgroundColor: isDark ? '#1E293B' : '#F3F4F6' }]}>
        <TouchableOpacity style={[styles.pickerBtn, { borderColor: colors.tint }]} onPress={() => setClassPickerOpen(true)}>
          <IconSymbol name="rectangle.stack.fill" size={15} color={colors.tint} />
          <ThemedText style={[styles.pickerBtnText, { color: colors.tint }]} numberOfLines={1}>
            {selectedClass ? `${selectedClass.name} (${selectedClass.code})` : 'Select Class'}
          </ThemedText>
          <IconSymbol name="chevron.down" size={13} color={colors.tint} />
        </TouchableOpacity>
        {selectedClass && (
          <ThemedText style={styles.pickerSub}>
            {selectedClass.department} · Sem {selectedClass.semester}
            {selectedClass.section ? ` · Sec ${selectedClass.section}` : ''}
          </ThemedText>
        )}
      </View>

      {/* ── Main timetable list ── */}
      {!selectedClass ? (
        <View style={styles.center}>
          <ThemedText style={styles.noData}>No class selected</ThemedText>
        </View>
      ) : ttLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {DAYS.map(day => {
            const dayLower = day.toLowerCase();
            const periods = weekly[dayLower] || [];
            const has = periods.length > 0;

            return (
              <ThemedView key={day} style={[styles.dayCard, { marginHorizontal: 16 }]}>
                {/* Day header row */}
                <View style={styles.dayHeaderRow}>
                  <View style={styles.dayTitleRow}>
                    <ThemedText type="defaultSemiBold" style={styles.dayTitle}>{day}</ThemedText>
                    {has && (
                      <View style={[styles.badge, { backgroundColor: colors.tint + '22' }]}>
                        <ThemedText style={[styles.badgeText, { color: colors.tint }]}>
                          {periods.length} {periods.length === 1 ? 'period' : 'periods'}
                        </ThemedText>
                      </View>
                    )}
                  </View>
                  <View style={styles.dayActions}>
                    {has && (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: 'rgba(244,67,54,0.1)' }]}
                        onPress={() => handleClearDay(day)}
                      >
                        <IconSymbol name="trash" size={14} color="#F44336" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.tint + '18' }]}
                      onPress={() => openEditor(day)}
                    >
                      <IconSymbol name={has ? 'pencil' : 'plus'} size={14} color={colors.tint} />
                      <ThemedText style={[styles.actionBtnText, { color: colors.tint }]}>
                        {has ? 'Edit' : 'Add'}
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Period cards */}
                {has ? (
                  <View style={styles.periodsWrap}>
                    {periods.map((p, idx) => {
                      const key = `${dayLower}-${p.periodNumber}`;
                      const isDeleting = deletingKey === key;
                      return (
                        <View
                          key={idx}
                          style={[styles.periodCard, {
                            backgroundColor: PERIOD_COLORS[idx % PERIOD_COLORS.length],
                            borderLeftColor: ACCENT[idx % ACCENT.length],
                          }]}
                        >
                          <View style={styles.periodCardInner}>
                            <View style={{ flex: 1 }}>
                              <ThemedText style={styles.periodLabel}>
                                Period {p.periodNumber}{p.isLab ? ' · LAB' : ''}
                              </ThemedText>
                              <ThemedText type="defaultSemiBold" style={styles.subjectText}>{p.subject}</ThemedText>
                              <ThemedText style={styles.metaText}>
                                {p.startTime} – {p.endTime}{p.room ? ` · ${p.room}` : ''}
                              </ThemedText>
                            </View>

                            {/* ── DELETE PERIOD BUTTON ── */}
                            <TouchableOpacity
                              style={[styles.deletePeriodBtn, isDeleting && { opacity: 0.5 }]}
                              disabled={isDeleting}
                              onPress={() => handleDeletePeriod(day, p)}
                            >
                              {isDeleting
                                ? <ActivityIndicator size="small" color="#F44336" />
                                : <IconSymbol name="minus.circle.fill" size={22} color="#F44336" />}
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}

                    {/* Quick Add Period button */}
                    <TouchableOpacity
                      style={[styles.quickAddBtn, { borderColor: colors.tint }]}
                      onPress={() => openAddModal(day)}
                    >
                      <IconSymbol name="plus.circle" size={15} color={colors.tint} />
                      <ThemedText style={[styles.quickAddText, { color: colors.tint }]}>Add Period</ThemedText>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.emptyDay, { borderColor: colors.tint + '55' }]}
                    onPress={() => openEditor(day)}
                  >
                    <IconSymbol name="plus" size={16} color={colors.tint} />
                    <ThemedText style={[styles.emptyDayText, { color: colors.tint }]}>Tap to add periods</ThemedText>
                  </TouchableOpacity>
                )}
              </ThemedView>
            );
          })}

          <View style={{ height: 28 }} />
        </ScrollView>
      )}

      {/* ════════════════════════════════════════════════════════════════
          CLASS PICKER MODAL
      ════════════════════════════════════════════════════════════════ */}
      <Modal visible={classPickerOpen} transparent animationType="fade" onRequestClose={() => setClassPickerOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setClassPickerOpen(false)}>
          <View style={[styles.sheet, { backgroundColor: isDark ? '#1E293B' : '#fff' }]}>
            <ThemedText type="defaultSemiBold" style={styles.sheetTitle}>Select Class</ThemedText>
            <ScrollView>
              {classes.map(cls => (
                <TouchableOpacity
                  key={cls._id}
                  style={[styles.classRow, selectedClass?._id === cls._id && { backgroundColor: colors.tint + '18' }]}
                  onPress={() => { setSelectedClass(cls); setClassPickerOpen(false); }}
                >
                  <ThemedText type="defaultSemiBold">{cls.name}</ThemedText>
                  <ThemedText style={styles.classSub}>{cls.code} · {cls.department} · Sem {cls.semester}{cls.section ? ` · ${cls.section}` : ''}</ThemedText>
                </TouchableOpacity>
              ))}
              {classes.length === 0 && <ThemedText style={styles.noData}>No classes found</ThemedText>}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ════════════════════════════════════════════════════════════════
          DAY EDITOR MODAL
      ════════════════════════════════════════════════════════════════ */}
      <Modal visible={editorVisible} transparent animationType="slide" onRequestClose={() => setEditorVisible(false)}>
        <View style={styles.overlay}>
          <View style={[styles.editorSheet, { backgroundColor: isDark ? '#1E293B' : '#fff' }]}>
            {/* Header */}
            <View style={styles.editorHeader}>
              <View>
                <ThemedText type="defaultSemiBold" style={styles.sheetTitle}>{editorDay}</ThemedText>
                <ThemedText style={styles.classSub}>{selectedClass?.name}</ThemedText>
              </View>
              <TouchableOpacity onPress={() => setEditorVisible(false)}>
                <IconSymbol name="xmark.circle.fill" size={26} color={isDark ? '#64748B' : '#9CA3AF'} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ paddingHorizontal: 16 }} keyboardShouldPersistTaps="handled">
              {editorPeriods.map((p, idx) => (
                <View key={idx} style={[styles.editorPeriodCard, { borderColor: isDark ? '#334155' : '#E5E7EB' }]}>
                  {/* Period card header */}
                  <View style={styles.editorPeriodHeader}>
                    <View style={styles.editorPeriodTitle}>
                      <View style={[styles.numBadge, { backgroundColor: ACCENT[idx % ACCENT.length] + '25' }]}>
                        <ThemedText style={[styles.numBadgeText, { color: ACCENT[idx % ACCENT.length] }]}>{idx + 1}</ThemedText>
                      </View>
                      <ThemedText type="defaultSemiBold" style={{ color: colors.tint }}>Period {p.periodNumber}</ThemedText>
                    </View>

                    {/* ── REMOVE PERIOD from modal (local draft) ── */}
                    <TouchableOpacity
                      style={styles.removePeriodBtn}
                      onPress={() => removeEditorPeriod(idx)}
                    >
                      <IconSymbol name="trash" size={14} color="#F44336" />
                      <ThemedText style={styles.removePeriodText}>Remove</ThemedText>
                    </TouchableOpacity>
                  </View>

                  <ThemedText style={styles.fieldLabel}>Subject *</ThemedText>
                  <TextInput
                    style={inputStyle}
                    placeholder="e.g. Mathematics"
                    placeholderTextColor={isDark ? '#475569' : '#9CA3AF'}
                    value={p.subject}
                    onChangeText={v => updateEditorField(idx, 'subject', v)}
                  />

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.fieldLabel}>Start *</ThemedText>
                      <TextInput
                        style={inputStyle}
                        placeholder="09:00"
                        placeholderTextColor={isDark ? '#475569' : '#9CA3AF'}
                        value={p.startTime}
                        onChangeText={v => updateEditorField(idx, 'startTime', v)}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.fieldLabel}>End *</ThemedText>
                      <TextInput
                        style={inputStyle}
                        placeholder="09:50"
                        placeholderTextColor={isDark ? '#475569' : '#9CA3AF'}
                        value={p.endTime}
                        onChangeText={v => updateEditorField(idx, 'endTime', v)}
                      />
                    </View>
                  </View>

                  <ThemedText style={styles.fieldLabel}>Room (optional)</ThemedText>
                  <TextInput
                    style={inputStyle}
                    placeholder="Room 204"
                    placeholderTextColor={isDark ? '#475569' : '#9CA3AF'}
                    value={p.room}
                    onChangeText={v => updateEditorField(idx, 'room', v)}
                  />

                  <TouchableOpacity style={styles.labRow} onPress={() => updateEditorField(idx, 'isLab', !p.isLab)}>
                    <View style={[styles.checkbox, { borderColor: colors.tint, backgroundColor: p.isLab ? colors.tint : 'transparent' }]}>
                      {p.isLab && <IconSymbol name="checkmark" size={11} color="#fff" />}
                    </View>
                    <ThemedText style={{ fontSize: 13, opacity: 0.8 }}>Lab session</ThemedText>
                  </TouchableOpacity>
                </View>
              ))}

              {/* Add another period */}
              <TouchableOpacity style={[styles.addAnotherBtn, { borderColor: colors.tint }]} onPress={addEditorPeriod}>
                <IconSymbol name="plus.circle.fill" size={18} color={colors.tint} />
                <ThemedText style={[styles.addAnotherText, { color: colors.tint }]}>Add Another Period</ThemedText>
              </TouchableOpacity>

              <View style={{ height: 12 }} />
            </ScrollView>

            {/* Save button */}
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.tint, opacity: saving ? 0.7 : 1 }]}
              onPress={saveEditor}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <ThemedText style={styles.saveBtnText}>Save Timetable</ThemedText>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ════════════════════════════════════════════════════════════════
          QUICK ADD PERIOD MODAL
      ════════════════════════════════════════════════════════════════ */}
      <Modal visible={addModalVisible} transparent animationType="slide" onRequestClose={() => setAddModalVisible(false)}>
        <View style={styles.overlay}>
          <View style={[styles.addSheet, { backgroundColor: isDark ? '#1E293B' : '#fff' }]}>
            <View style={styles.editorHeader}>
              <View>
                <ThemedText type="defaultSemiBold" style={styles.sheetTitle}>Add Period</ThemedText>
                <ThemedText style={styles.classSub}>{addModalDay} · {selectedClass?.name}</ThemedText>
              </View>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <IconSymbol name="xmark.circle.fill" size={26} color={isDark ? '#64748B' : '#9CA3AF'} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ paddingHorizontal: 16 }} keyboardShouldPersistTaps="handled">
              <ThemedText style={styles.fieldLabel}>Subject *</ThemedText>
              <TextInput
                style={inputStyle}
                placeholder="e.g. Physics"
                placeholderTextColor={isDark ? '#475569' : '#9CA3AF'}
                value={addForm.subject}
                onChangeText={v => setAddForm(f => ({ ...f, subject: v }))}
                autoFocus
              />

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.fieldLabel}>Start *</ThemedText>
                  <TextInput
                    style={inputStyle}
                    placeholder="09:00"
                    placeholderTextColor={isDark ? '#475569' : '#9CA3AF'}
                    value={addForm.startTime}
                    onChangeText={v => setAddForm(f => ({ ...f, startTime: v }))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.fieldLabel}>End *</ThemedText>
                  <TextInput
                    style={inputStyle}
                    placeholder="09:50"
                    placeholderTextColor={isDark ? '#475569' : '#9CA3AF'}
                    value={addForm.endTime}
                    onChangeText={v => setAddForm(f => ({ ...f, endTime: v }))}
                  />
                </View>
              </View>

              <ThemedText style={styles.fieldLabel}>Room (optional)</ThemedText>
              <TextInput
                style={inputStyle}
                placeholder="Room 301"
                placeholderTextColor={isDark ? '#475569' : '#9CA3AF'}
                value={addForm.room}
                onChangeText={v => setAddForm(f => ({ ...f, room: v }))}
              />

              <TouchableOpacity style={styles.labRow} onPress={() => setAddForm(f => ({ ...f, isLab: !f.isLab }))}>
                <View style={[styles.checkbox, { borderColor: colors.tint, backgroundColor: addForm.isLab ? colors.tint : 'transparent' }]}>
                  {addForm.isLab && <IconSymbol name="checkmark" size={11} color="#fff" />}
                </View>
                <ThemedText style={{ fontSize: 13, opacity: 0.8 }}>Lab session</ThemedText>
              </TouchableOpacity>

              <View style={{ height: 12 }} />
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.tint, opacity: addingPeriod ? 0.7 : 1 }]}
              onPress={confirmAddPeriod}
              disabled={addingPeriod}
            >
              {addingPeriod
                ? <ActivityIndicator size="small" color="#fff" />
                : <ThemedText style={styles.saveBtnText}>Add Period</ThemedText>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 40 },
  listContent: { paddingTop: 8, paddingBottom: 24 },

  // Class picker bar
  pickerBar: { paddingHorizontal: 16, paddingVertical: 10, gap: 4 },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  pickerBtnText: { fontSize: 14, fontWeight: '600', maxWidth: 220 },
  pickerSub: { fontSize: 11, opacity: 0.55, marginTop: 2 },

  // Day card
  dayCard: {
    marginBottom: 10, marginTop: 2, paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 14, backgroundColor: 'rgba(128,128,128,0.07)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  dayHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  dayTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  dayTitle: { fontSize: 15, fontWeight: '600' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  dayActions: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
  },
  actionBtnText: { fontSize: 12, fontWeight: '600' },

  // Period card
  periodsWrap: { gap: 7 },
  periodCard: {
    borderRadius: 10, borderLeftWidth: 3, borderLeftColor: '#007AFF',
    paddingVertical: 9, paddingHorizontal: 10,
  },
  periodCardInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  periodLabel: { fontSize: 10, opacity: 0.6, fontWeight: '600', textTransform: 'uppercase' },
  subjectText: { fontSize: 14, marginTop: 1 },
  metaText: { fontSize: 11, opacity: 0.7, marginTop: 1 },

  // Delete period button (on card)
  deletePeriodBtn: {
    padding: 8,
    borderRadius: 20,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Quick add period button
  quickAddBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 8, borderWidth: 1, borderStyle: 'dashed',
    borderRadius: 8, marginTop: 2,
  },
  quickAddText: { fontSize: 12, fontWeight: '600' },

  // Empty day placeholder
  emptyDay: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 14, borderWidth: 1.5, borderStyle: 'dashed',
    borderRadius: 10, opacity: 0.7,
  },
  emptyDayText: { fontSize: 13, fontWeight: '600' },

  noData: { fontSize: 13, opacity: 0.5, fontStyle: 'italic', textAlign: 'center', paddingVertical: 12 },
  btn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  btnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  // Modals
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.52)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, maxHeight: '60%' },
  sheetTitle: { fontSize: 16, fontWeight: '700' },
  classRow: { paddingVertical: 12, paddingHorizontal: 8, borderRadius: 10, marginBottom: 4 },
  classSub: { fontSize: 11, opacity: 0.55, marginTop: 2 },

  // Editor modal
  editorSheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '92%', paddingBottom: Platform.OS === 'ios' ? 32 : 16 },
  editorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(128,128,128,0.12)' },
  editorPeriodCard: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12, marginTop: 4 },
  editorPeriodHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  editorPeriodTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  numBadge: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  numBadgeText: { fontSize: 12, fontWeight: '700' },
  removePeriodBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8,
    backgroundColor: 'rgba(244,67,54,0.08)',
  },
  removePeriodText: { fontSize: 11, color: '#F44336', fontWeight: '600' },
  fieldLabel: { fontSize: 10, fontWeight: '700', opacity: 0.55, textTransform: 'uppercase', marginTop: 8, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 },
  labRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  addAnotherBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 10,
    padding: 12, marginBottom: 4,
  },
  addAnotherText: { fontSize: 14, fontWeight: '600' },
  saveBtn: { marginHorizontal: 16, marginTop: 8, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Add period modal
  addSheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '80%', paddingBottom: Platform.OS === 'ios' ? 32 : 16 },
});
