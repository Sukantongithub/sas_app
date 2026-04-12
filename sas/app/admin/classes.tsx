import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';
import AdminHeader from './AdminHeader';
import { API_BASE_URL } from '@/config/apiConfig';

const DEPARTMENTS = [
  'Electronics and Communication Engineering',
  'Computer Science and Engineering',
  'Information Technology',
  'Artificial Intelligence and Data Science',
  'Artificial Intelligence and Machine Learning',
  'Mechanical Engineering',
  'Electrical and Electronics Engineering',
];

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

interface ClassItem {
  _id: string;
  name: string;
  code: string;
  department: string;
  semester: number;
  academicYear: string;
  section?: string;
  students: string[];
  faculty: string[];
  isActive: boolean;
  classroom?: { building?: string; roomNumber?: string };
  startDate?: string;
  endDate?: string;
}

const blankForm = () => {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return {
    name: '',
    code: '',
    department: DEPARTMENTS[0],
    semester: 1,
    academicYear: '2025-2026',
    section: '',
    building: '',
    roomNumber: '',
    startDate: today,
    endDate: '',
  };
};

export default function ClassManagementScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { token, user } = useAuth();

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(blankForm());
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showSemModal, setShowSemModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // ──────────────────────────────────────
  const fetchClasses = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/admin/classes?isActive=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json();
      setClasses(result.data || []);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load classes');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  // ──────────────────────────────────────
  const openCreate = () => {
    setEditingId(null);
    setFormData(blankForm());
    setShowForm(true);
  };

  const openEdit = (cls: ClassItem) => {
    setEditingId(cls._id);
    setFormData({
      name: cls.name,
      code: cls.code,
      department: cls.department,
      semester: cls.semester,
      academicYear: cls.academicYear,
      section: cls.section || '',
      building: cls.classroom?.building || '',
      roomNumber: cls.classroom?.roomNumber || '',
      startDate: cls.startDate ? new Date(cls.startDate).toISOString().split('T')[0] : '',
      endDate: cls.endDate ? new Date(cls.endDate).toISOString().split('T')[0] : '',
    });
    setShowForm(true);
  };

  // ──────────────────────────────────────
  const handleSave = async () => {
    const { name, code, department, semester, academicYear } = formData;
    if (!name.trim() || !code.trim() || !department || !semester || !academicYear.trim()) {
      Alert.alert('Error', 'Name, Code, Department, Semester and Academic Year are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        department,
        semester,
        academicYear: academicYear.trim(),
        section: formData.section.trim() || undefined,
        classroom: (formData.building || formData.roomNumber)
          ? { building: formData.building.trim(), roomNumber: formData.roomNumber.trim() }
          : undefined,
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : new Date().toISOString(),
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : undefined,
      };
      const url = editingId ? `${API_BASE_URL}/admin/classes/${editingId}` : `${API_BASE_URL}/admin/classes`;
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'Failed to save class');
      Alert.alert('Success', editingId ? 'Class updated' : 'Class created successfully');
      setShowForm(false);
      await fetchClasses();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save class');
    } finally {
      setSaving(false);
    }
  };

  const performDeleteClass = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/classes/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(result.message || 'Failed to deactivate class');
      Alert.alert('Done', 'Class deactivated');
      setClasses(prev => prev.filter(c => c._id !== id));
      await fetchClasses();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to deactivate class');
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined'
        ? window.confirm(`Deactivate "${name}"? Students and timetables will be preserved.`)
        : true;
      if (confirmed) {
        void performDeleteClass(id);
      }
      return;
    }

    Alert.alert('Deactivate Class', `Deactivate "${name}"? Students and timetables will be preserved.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate',
        style: 'destructive',
        onPress: () => {
          void performDeleteClass(id);
        },
      },
    ]);
  };

  // ──────────────────────────────────────
  const filtered = classes.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ──────────────────────────────────────
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.center}><ThemedText type="title">Access Denied</ThemedText></View>
      </ThemedView>
    );
  }

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.center}><ActivityIndicator size="large" color={colors.tint} /></View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AdminHeader title="Class Management" />

      <View style={styles.topBar}>
        {/* Search */}
        <View style={[styles.searchBox, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
          <IconSymbol name="magnifyingglass" size={16} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search by name, code, dept…"
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <IconSymbol name="xmark.circle.fill" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Add button */}
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.tint }]} onPress={openCreate}>
          <IconSymbol name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ThemedText style={styles.count}>{filtered.length} class{filtered.length !== 1 ? 'es' : ''}</ThemedText>

      <FlatList
        data={filtered}
        keyExtractor={item => item._id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <IconSymbol name="rectangle.stack.badge.plus" size={52} color={colors.textSecondary} />
            <ThemedText style={styles.emptyTitle}>No classes yet</ThemedText>
            <ThemedText style={styles.emptySub}>Tap + to create your first class</ThemedText>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={[styles.cardAccent, { backgroundColor: item.isActive ? colors.tint : colors.textSecondary }]} />
            <View style={styles.cardBody}>
              <View style={styles.cardTop}>
                <View style={styles.cardLeft}>
                  <ThemedText type="defaultSemiBold" style={styles.className}>{item.name}</ThemedText>
                  <View style={[styles.codeBadge, { backgroundColor: colors.tint + '20' }]}>
                    <ThemedText style={[styles.codeText, { color: colors.tint }]}>{item.code}</ThemedText>
                  </View>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.tint + '15' }]} onPress={() => openEdit(item)}>
                    <IconSymbol name="pencil" size={16} color={colors.tint} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.error + '15' }]} onPress={() => handleDelete(item._id, item.name)}>
                    <IconSymbol name="trash" size={16} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.infoGrid}>
                <View style={styles.infoItem}>
                  <IconSymbol name="building.2" size={13} color={colors.textSecondary} />
                  <ThemedText style={styles.infoText} numberOfLines={1}>{item.department}</ThemedText>
                </View>
                <View style={styles.infoItem}>
                  <IconSymbol name="book" size={13} color={colors.textSecondary} />
                  <ThemedText style={styles.infoText}>Sem {item.semester}</ThemedText>
                </View>
                <View style={styles.infoItem}>
                  <IconSymbol name="calendar" size={13} color={colors.textSecondary} />
                  <ThemedText style={styles.infoText}>{item.academicYear}</ThemedText>
                </View>
                {item.section && (
                  <View style={styles.infoItem}>
                    <IconSymbol name="rectangle.grid.1x2" size={13} color={colors.textSecondary} />
                    <ThemedText style={styles.infoText}>Section {item.section}</ThemedText>
                  </View>
                )}
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statChip}>
                  <IconSymbol name="person.2" size={13} color={colors.tint} />
                  <ThemedText style={[styles.statText, { color: colors.tint }]}>{item.students?.length ?? 0} students</ThemedText>
                </View>
                <View style={styles.statChip}>
                  <IconSymbol name="person.badge.key" size={13} color={colors.tint} />
                  <ThemedText style={[styles.statText, { color: colors.tint }]}>{item.faculty?.length ?? 0} faculty</ThemedText>
                </View>
                <View style={[styles.statusChip, { backgroundColor: item.isActive ? '#22c55e20' : '#ef444420' }]}>
                  <ThemedText style={[styles.statusText, { color: item.isActive ? '#22c55e' : '#ef4444' }]}>
                    {item.isActive ? 'Active' : 'Inactive'}
                  </ThemedText>
                </View>
              </View>
            </View>
          </View>
        )}
      />

      {/* ── Create/Edit Modal ─────────────────────────────── */}
      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.formSheet, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={styles.sheetHeader}>
              <ThemedText type="defaultSemiBold" style={styles.sheetTitle}>
                {editingId ? 'Edit Class' : 'New Class'}
              </ThemedText>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <IconSymbol name="xmark.circle.fill" size={28} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
              {/* Class Name */}
              <FormField label="Class Name *" hint='e.g. "CSE-4A"'>
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                  placeholder='e.g. "CSE-4A"'
                  placeholderTextColor={colors.textSecondary}
                  value={formData.name}
                  onChangeText={t => setFormData(p => ({ ...p, name: t }))}
                />
              </FormField>

              {/* Code */}
              <FormField label="Class Code *" hint='e.g. "CSE4A" (auto-uppercased)'>
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                  placeholder='e.g. "CSE4A"'
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="characters"
                  value={formData.code}
                  onChangeText={t => setFormData(p => ({ ...p, code: t.toUpperCase() }))}
                />
              </FormField>

              {/* Department */}
              <FormField label="Department *">
                <TouchableOpacity
                  style={[styles.selector, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                  onPress={() => setShowDeptModal(true)}>
                  <ThemedText style={{ color: colors.text, flex: 1 }} numberOfLines={1}>{formData.department}</ThemedText>
                  <IconSymbol name="chevron.down" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </FormField>

              {/* Semester */}
              <FormField label="Semester *">
                <TouchableOpacity
                  style={[styles.selector, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                  onPress={() => setShowSemModal(true)}>
                  <ThemedText style={{ color: colors.text, flex: 1 }}>Semester {formData.semester}</ThemedText>
                  <IconSymbol name="chevron.down" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </FormField>

              {/* Academic Year */}
              <FormField label="Academic Year *" hint='e.g. "2025-2026"'>
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                  placeholder='e.g. "2025-2026"'
                  placeholderTextColor={colors.textSecondary}
                  value={formData.academicYear}
                  onChangeText={t => setFormData(p => ({ ...p, academicYear: t }))}
                />
              </FormField>

              {/* Section (optional) */}
              <FormField label="Section" hint="Optional (A, B, Morning, Evening…)">
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                  placeholder="e.g. A"
                  placeholderTextColor={colors.textSecondary}
                  value={formData.section}
                  onChangeText={t => setFormData(p => ({ ...p, section: t }))}
                />
              </FormField>

              {/* Classroom */}
              <FormField label="Classroom (optional)">
                <View style={styles.rowInputs}>
                  <TextInput
                    style={[styles.input, { flex: 1, color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                    placeholder="Building"
                    placeholderTextColor={colors.textSecondary}
                    value={formData.building}
                    onChangeText={t => setFormData(p => ({ ...p, building: t }))}
                  />
                  <TextInput
                    style={[styles.input, { flex: 1, color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                    placeholder="Room No."
                    placeholderTextColor={colors.textSecondary}
                    value={formData.roomNumber}
                    onChangeText={t => setFormData(p => ({ ...p, roomNumber: t }))}
                  />
                </View>
              </FormField>

              {/* Start Date */}
              <FormField label="Start Date *" hint='e.g. "2025-01-15" (YYYY-MM-DD)'>
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textSecondary}
                  value={formData.startDate}
                  onChangeText={t => setFormData(p => ({ ...p, startDate: t }))}
                  inputMode="text"
                />
              </FormField>

              {/* End Date (optional) */}
              <FormField label="End Date" hint="Optional (YYYY-MM-DD)">
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textSecondary}
                  value={formData.endDate}
                  onChangeText={t => setFormData(p => ({ ...p, endDate: t }))}
                  inputMode="text"
                />
              </FormField>

              {/* Save */}
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}>
                <LinearGradient
                  colors={[colors.gradientStart, colors.gradientEnd]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.saveBtnGradient}>
                  {saving
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <IconSymbol name="checkmark.circle.fill" size={20} color="#fff" />}
                  <ThemedText style={styles.saveBtnText}>{editingId ? 'Update Class' : 'Create Class'}</ThemedText>
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Department picker */}
      <Modal visible={showDeptModal} transparent animationType="slide" onRequestClose={() => setShowDeptModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.pickerSheet, { backgroundColor: colors.background }]}>
            <View style={styles.sheetHeader}>
              <ThemedText type="defaultSemiBold" style={styles.sheetTitle}>Select Department</ThemedText>
              <TouchableOpacity onPress={() => setShowDeptModal(false)}>
                <IconSymbol name="xmark.circle.fill" size={28} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {DEPARTMENTS.map(d => (
                <TouchableOpacity
                  key={d}
                  style={[styles.pickerRow, { borderBottomColor: colors.border }, formData.department === d && { backgroundColor: colors.tint + '15' }]}
                  onPress={() => { setFormData(p => ({ ...p, department: d })); setShowDeptModal(false); }}>
                  <ThemedText style={[styles.pickerText, formData.department === d && { color: colors.tint, fontWeight: '700' }]}>{d}</ThemedText>
                  {formData.department === d && <IconSymbol name="checkmark.circle.fill" size={22} color={colors.tint} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Semester picker */}
      <Modal visible={showSemModal} transparent animationType="slide" onRequestClose={() => setShowSemModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.pickerSheet, { backgroundColor: colors.background }]}>
            <View style={styles.sheetHeader}>
              <ThemedText type="defaultSemiBold" style={styles.sheetTitle}>Select Semester</ThemedText>
              <TouchableOpacity onPress={() => setShowSemModal(false)}>
                <IconSymbol name="xmark.circle.fill" size={28} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {SEMESTERS.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.pickerRow, { borderBottomColor: colors.border }, formData.semester === s && { backgroundColor: colors.tint + '15' }]}
                  onPress={() => { setFormData(p => ({ ...p, semester: s })); setShowSemModal(false); }}>
                  <ThemedText style={[styles.pickerText, formData.semester === s && { color: colors.tint, fontWeight: '700' }]}>Semester {s}</ThemedText>
                  {formData.semester === s && <IconSymbol name="checkmark.circle.fill" size={22} color={colors.tint} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

// Helper component for form field labels
function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.fieldGroup}>
      <ThemedText style={styles.fieldLabel}>{label}</ThemedText>
      {hint && <ThemedText style={styles.fieldHint}>{hint}</ThemedText>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Top bar
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  searchInput: { flex: 1, fontSize: 14 },
  addBtn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  count: { paddingHorizontal: 16, fontSize: 13, opacity: 0.5, marginBottom: 4 },

  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  card: { flexDirection: 'row', borderRadius: 18, marginBottom: 12, borderWidth: 1, overflow: 'hidden', elevation: 3 },
  cardAccent: { width: 5 },
  cardBody: { flex: 1, padding: 14, gap: 8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLeft: { flex: 1, gap: 4 },
  className: { fontSize: 16 },
  codeBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  codeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  cardActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoText: { fontSize: 12, opacity: 0.65 },
  statsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12, fontWeight: '600' },
  statusChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700' },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '600', opacity: 0.7 },
  emptySub: { fontSize: 13, opacity: 0.4 },

  // Form modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  formSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%' },
  pickerSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '70%', padding: 20 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 10 },
  sheetTitle: { fontSize: 20 },
  formScroll: { paddingHorizontal: 20 },

  // Form fields
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 4, opacity: 0.8 },
  fieldHint: { fontSize: 11, opacity: 0.45, marginBottom: 6 },
  input: { borderWidth: 1.5, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  selector: { borderWidth: 1.5, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 13, flexDirection: 'row', alignItems: 'center' },
  rowInputs: { flexDirection: 'row', gap: 10 },

  // Save button
  saveBtn: { marginVertical: 20, borderRadius: 16, overflow: 'hidden' },
  saveBtnGradient: { flexDirection: 'row', paddingVertical: 16, alignItems: 'center', justifyContent: 'center', gap: 10 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  // Picker rows
  pickerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 10, borderBottomWidth: 1, borderRadius: 8, marginBottom: 2 },
  pickerText: { fontSize: 15, flex: 1 },
});
