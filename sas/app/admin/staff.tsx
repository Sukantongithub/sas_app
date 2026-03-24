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
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import AdminHeader from './AdminHeader';

const API_BASE_URL = 'http://localhost:5000/api';

interface Staff {
  _id: string;
  userId: {
    name: string;
    email: string;
    role: string;
    isActive: boolean;
  };
  employeeId: string;
  designation: string;
  department: string;
  performanceRating?: number;
  leaveBalance: number;
}

interface ClassOption {
  _id: string;
  name: string;
  code?: string;
  semester?: number;
}

const DEPARTMENTS = [
  'Electronics and Communication Engineering',
  'Computer Science and Engineering',
  'Information Technology',
  'Artificial Intelligence and Data Science',
  'Artificial Intelligence and Machine Learning',
  'Mechanical Engineering',
  'Electrical and Electronics Engineering',
];

const DESIGNATIONS: Array<{ label: string; value: string }> = [
  { label: 'Staff / Teacher', value: 'staff' },
  { label: 'Admin', value: 'admin' },
  { label: 'Security', value: 'security' },
  { label: 'Maintenance', value: 'maintenance' },
  { label: 'Office Manager', value: 'office_manager' },
];

export default function StaffManagementScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { token, user } = useAuth();
  const colors = Colors[colorScheme ?? 'light'];

  const [staff, setStaff] = useState<Staff[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [showDesignationModal, setShowDesignationModal] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);

  const blankForm = () => ({
    name: '',
    email: '',
    password: '',
    employeeId: '',
    designation: 'staff',
    department: DEPARTMENTS[0],
    phone: '',
    dateOfJoining: new Date().toISOString().split('T')[0],
    classIds: [] as string[],
  });
  const [formData, setFormData] = useState(blankForm());

  // ── Data Fetching ──────────────────────────────────────────────
  const fetchStaff = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/admin/staff`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch staff');
      const result = await response.json();
      setStaff(result.data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load staff');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchClasses = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/classes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;
      const result = await response.json();
      setClasses(result.data || []);
    } catch {}
  }, [token]);

  useEffect(() => {
    fetchStaff();
    fetchClasses();
  }, [fetchStaff, fetchClasses]);

  // ── Create Staff ───────────────────────────────────────────────
  const handleCreateStaff = async () => {
    if (!formData.name || !formData.email || !formData.password || !formData.employeeId || !formData.department || !formData.designation) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/admin/staff`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || result.errors?.[0]?.msg || 'Failed to create staff');
      Alert.alert('Success', 'Staff member created successfully');
      setFormData(blankForm());
      setShowForm(false);
      await fetchStaff();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create staff');
    }
  };

  // ── Delete Staff ───────────────────────────────────────────────
  const handleDeleteStaff = (id: string, name: string) => {
    Alert.alert('Delete Staff', `Are you sure you want to delete ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const response = await fetch(`${API_BASE_URL}/admin/staff/${id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok) throw new Error('Failed to delete staff');
            Alert.alert('Success', 'Staff member deleted');
            await fetchStaff();
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to delete staff');
          }
        },
      },
    ]);
  };

  // ── Excel Import ───────────────────────────────────────────────
  const handleImportExcel = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
          '*/*',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const file = result.assets[0];
      const allowedExts = ['.xlsx', '.xls', '.csv'];
      const ext = file.name?.toLowerCase().slice(file.name.lastIndexOf('.'));
      if (!allowedExts.includes(ext || '')) {
        Alert.alert('Invalid File', 'Please select an Excel (.xlsx, .xls) or CSV file');
        return;
      }

      setImporting(true);

      const formDataUpload = new FormData();
      formDataUpload.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'application/octet-stream',
      } as any);

      const response = await fetch(`${API_BASE_URL}/admin/staff/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formDataUpload,
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert('Import Failed', data.message || 'Failed to import staff');
        return;
      }

      const { created, skipped, skippedRows } = data.data;
      let msg = data.message;
      if (skipped > 0) {
        const reasons = skippedRows
          .slice(0, 5)
          .map((r: any) => `Row ${r.row}: ${r.reason}`)
          .join('\n');
        msg += `\n\nSkipped ${skipped} row(s):\n${reasons}${skipped > 5 ? `\n...and ${skipped - 5} more` : ''}`;
      }

      Alert.alert(created > 0 ? 'Import Complete' : 'Nothing Imported', msg);
      if (created > 0) await fetchStaff();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to import file');
    } finally {
      setImporting(false);
    }
  };

  // ── Class picker helpers ───────────────────────────────────────
  const toggleClass = (classId: string) => {
    setFormData(prev => ({
      ...prev,
      classIds: prev.classIds.includes(classId)
        ? prev.classIds.filter(id => id !== classId)
        : [...prev.classIds, classId],
    }));
  };

  const selectedClassNames = formData.classIds
    .map(id => classes.find(c => c._id === id)?.name)
    .filter(Boolean)
    .join(', ');

  // ── Guards ─────────────────────────────────────────────────────
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

  // ── Render ─────────────────────────────────────────────────────
  return (
    <ThemedView style={styles.container}>
      <AdminHeader title="Manage Staff" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <ThemedText style={styles.subtitle}>Total: {staff.length}</ThemedText>
        </View>

        {/* Action buttons */}
        {!showForm && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { flex: 1 }]}
              activeOpacity={0.8}
              onPress={() => { setFormData(blankForm()); setShowForm(true); }}>
              <LinearGradient
                colors={[colors.gradientStart, colors.gradientEnd]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.actionBtnGradient}>
                <IconSymbol name="plus.circle.fill" size={20} color="#fff" />
                <ThemedText style={styles.actionBtnText}>Add Staff</ThemedText>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { flex: 1 }]}
              activeOpacity={0.8}
              onPress={handleImportExcel}
              disabled={importing}>
              <LinearGradient
                colors={['#22c55e', '#16a34a']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.actionBtnGradient}>
                {importing
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <IconSymbol name="tray.and.arrow.down.fill" size={20} color="#fff" />}
                <ThemedText style={styles.actionBtnText}>{importing ? 'Importing…' : 'Import Excel'}</ThemedText>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Excel format hint */}
        {!showForm && (
          <View style={[styles.hintBox, { backgroundColor: colors.tint + '15', borderColor: colors.tint + '40' }]}>
            <IconSymbol name="info.circle" size={14} color={colors.tint} />
            <ThemedText style={[styles.hintText, { color: colors.tint }]}>
              Excel columns: <ThemedText style={styles.hintBold}>Name, Email, Employee ID, Designation, Department</ThemedText>{'\n'}
              Valid designations: staff, admin, security, maintenance, office_manager{'\n'}
              Default password = Employee ID
            </ThemedText>
          </View>
        )}

        {/* Create Form */}
        {showForm && (
          <View style={[styles.formContainer, { backgroundColor: colors.cardBackground, borderColor: colors.tint }]}>
            <View style={styles.formHeader}>
              <IconSymbol name="person.2.badge.gearshape.fill" size={28} color={colors.tint} />
              <ThemedText type="defaultSemiBold" style={styles.formTitle}>Create New Staff</ThemedText>
            </View>

            {/* Name */}
            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Full Name *</ThemedText>
              <View style={[styles.inputWrapper, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                <IconSymbol name="person.fill" size={18} color={colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Full Name"
                  placeholderTextColor={colors.textSecondary}
                  value={formData.name}
                  onChangeText={text => setFormData(p => ({ ...p, name: text }))}
                  autoComplete="off" textContentType="none"
                />
              </View>
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Email *</ThemedText>
              <View style={[styles.inputWrapper, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                <IconSymbol name="envelope.fill" size={18} color={colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Email"
                  placeholderTextColor={colors.textSecondary}
                  value={formData.email}
                  onChangeText={text => setFormData(p => ({ ...p, email: text }))}
                  keyboardType="email-address" autoCapitalize="none"
                  autoComplete="off" textContentType="none"
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Password *</ThemedText>
              <View style={[styles.inputWrapper, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                <IconSymbol name="lock.fill" size={18} color={colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Password (min 6 chars)"
                  placeholderTextColor={colors.textSecondary}
                  value={formData.password}
                  onChangeText={text => setFormData(p => ({ ...p, password: text }))}
                  secureTextEntry autoCapitalize="none"
                  autoComplete="off" textContentType="none"
                />
              </View>
            </View>

            {/* Employee ID */}
            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Employee ID *</ThemedText>
              <View style={[styles.inputWrapper, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                <IconSymbol name="number.square.fill" size={18} color={colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Employee ID"
                  placeholderTextColor={colors.textSecondary}
                  value={formData.employeeId}
                  onChangeText={text => setFormData(p => ({ ...p, employeeId: text }))}
                  autoComplete="off" textContentType="none"
                />
              </View>
            </View>

            {/* Designation */}
            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Designation *</ThemedText>
              <TouchableOpacity
                style={[styles.inputWrapper, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                onPress={() => setShowDesignationModal(true)}>
                <IconSymbol name="briefcase.fill" size={18} color={colors.textSecondary} />
                <ThemedText style={[styles.selectText, { color: colors.text }]}>
                  {DESIGNATIONS.find(d => d.value === formData.designation)?.label ?? formData.designation}
                </ThemedText>
                <IconSymbol name="chevron.down" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Department */}
            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Department *</ThemedText>
              <TouchableOpacity
                style={[styles.inputWrapper, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                onPress={() => setShowDepartmentModal(true)}>
                <IconSymbol name="building.2.fill" size={18} color={colors.textSecondary} />
                <ThemedText style={[styles.selectText, { color: colors.text }]}>{formData.department}</ThemedText>
                <IconSymbol name="chevron.down" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Assign Classes */}
            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Assign to Classes</ThemedText>
              <TouchableOpacity
                style={[styles.inputWrapper, { backgroundColor: colors.inputBackground, borderColor: colors.border, minHeight: 52, height: undefined, paddingVertical: 10 }]}
                onPress={() => setShowClassModal(true)}>
                <IconSymbol name="rectangle.stack.fill" size={18} color={colors.textSecondary} />
                <ThemedText style={[styles.selectText, { color: formData.classIds.length > 0 ? colors.text : colors.textSecondary }]} numberOfLines={2}>
                  {formData.classIds.length > 0 ? selectedClassNames : 'Select classes (optional)'}
                </ThemedText>
                <View style={[styles.badge, { backgroundColor: colors.tint }]}>
                  <ThemedText style={styles.badgeText}>{formData.classIds.length}</ThemedText>
                </View>
                <IconSymbol name="chevron.down" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Phone */}
            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Phone</ThemedText>
              <View style={[styles.inputWrapper, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                <IconSymbol name="phone.fill" size={18} color={colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Phone (10 digits)"
                  placeholderTextColor={colors.textSecondary}
                  value={formData.phone}
                  onChangeText={text => setFormData(p => ({ ...p, phone: text.replace(/[^0-9]/g, '').slice(0, 10) }))}
                  keyboardType="number-pad" maxLength={10}
                  autoComplete="off" textContentType="none"
                />
              </View>
            </View>

            {/* Buttons */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton, { backgroundColor: colors.border }]}
                onPress={() => { setFormData(blankForm()); setShowForm(false); }}>
                <ThemedText style={[styles.buttonText, { color: colors.text }]}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button} onPress={handleCreateStaff}>
                <LinearGradient
                  colors={[colors.gradientStart, colors.gradientEnd]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.gradientButton}>
                  <IconSymbol name="checkmark.circle.fill" size={18} color="#fff" />
                  <ThemedText style={[styles.buttonText, { color: '#fff' }]}>Create Staff</ThemedText>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Staff List */}
        <FlatList
          scrollEnabled={false}
          data={staff}
          keyExtractor={item => item._id}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <IconSymbol name="person.2.slash" size={44} color={colors.textSecondary} />
              <ThemedText style={styles.emptyText}>No staff members yet</ThemedText>
              <ThemedText style={styles.emptySubtext}>Add staff manually or import via Excel</ThemedText>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.staffCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <View style={[styles.staffAvatar, { backgroundColor: colors.tint + '20' }]}>
                <IconSymbol name="person.badge.shield.checkmark.fill" size={24} color={colors.tint} />
              </View>
              <View style={styles.staffInfo}>
                <ThemedText type="defaultSemiBold" style={styles.staffName}>{item.userId.name}</ThemedText>
                <View style={styles.detailRow}>
                  <IconSymbol name="number.square" size={14} color={colors.textSecondary} />
                  <ThemedText style={styles.staffDetail}>ID: {item.employeeId}</ThemedText>
                </View>
                <View style={styles.detailRow}>
                  <IconSymbol name="envelope" size={14} color={colors.textSecondary} />
                  <ThemedText style={styles.staffDetail}>{item.userId.email}</ThemedText>
                </View>
                <View style={styles.detailRow}>
                  <IconSymbol name="building.2" size={14} color={colors.textSecondary} />
                  <ThemedText style={styles.staffDetail}>Dept: {item.department}</ThemedText>
                </View>
                <View style={styles.detailRow}>
                  <IconSymbol name="briefcase" size={14} color={colors.textSecondary} />
                  <ThemedText style={styles.staffDetail}>{item.designation}</ThemedText>
                </View>
                {item.performanceRating && (
                  <View style={styles.detailRow}>
                    <IconSymbol name="star.fill" size={14} color={colors.warning} />
                    <ThemedText style={[styles.staffDetail, { color: colors.warning }]}>Rating: {item.performanceRating}/5</ThemedText>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={[styles.deleteButton, { backgroundColor: colors.error }]}
                onPress={() => handleDeleteStaff(item._id, item.userId.name)}>
                <IconSymbol name="trash.fill" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        />
      </ScrollView>

      {/* ── Designation Modal ──────────────── */}
      <Modal visible={showDesignationModal} transparent animationType="slide" onRequestClose={() => setShowDesignationModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="defaultSemiBold" style={styles.modalTitle}>Select Designation</ThemedText>
              <TouchableOpacity onPress={() => setShowDesignationModal(false)}>
                <IconSymbol name="xmark.circle.fill" size={28} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {DESIGNATIONS.map(d => (
                <TouchableOpacity
                  key={d.value}
                  style={[styles.optionRow, { borderBottomColor: colors.border }, formData.designation === d.value && { backgroundColor: colors.tint + '15' }]}
                  onPress={() => { setFormData(p => ({ ...p, designation: d.value })); setShowDesignationModal(false); }}>
                  <ThemedText style={[styles.optionText, formData.designation === d.value && { color: colors.tint, fontWeight: '700' }]}>{d.label}</ThemedText>
                  {formData.designation === d.value && <IconSymbol name="checkmark.circle.fill" size={24} color={colors.tint} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Department Modal ───────────────── */}
      <Modal visible={showDepartmentModal} transparent animationType="slide" onRequestClose={() => setShowDepartmentModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="defaultSemiBold" style={styles.modalTitle}>Select Department</ThemedText>
              <TouchableOpacity onPress={() => setShowDepartmentModal(false)}>
                <IconSymbol name="xmark.circle.fill" size={28} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {DEPARTMENTS.map(dept => (
                <TouchableOpacity
                  key={dept}
                  style={[styles.optionRow, { borderBottomColor: colors.border }, formData.department === dept && { backgroundColor: colors.tint + '15' }]}
                  onPress={() => { setFormData(p => ({ ...p, department: dept })); setShowDepartmentModal(false); }}>
                  <ThemedText style={[styles.optionText, formData.department === dept && { color: colors.tint, fontWeight: '700' }]}>{dept}</ThemedText>
                  {formData.department === dept && <IconSymbol name="checkmark.circle.fill" size={24} color={colors.tint} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Class Picker Modal ─────────────── */}
      <Modal visible={showClassModal} transparent animationType="slide" onRequestClose={() => setShowClassModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="defaultSemiBold" style={styles.modalTitle}>Assign to Classes</ThemedText>
              <TouchableOpacity onPress={() => setShowClassModal(false)}>
                <IconSymbol name="xmark.circle.fill" size={28} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {classes.length === 0 ? (
              <View style={styles.modalEmpty}>
                <IconSymbol name="rectangle.stack.badge.minus" size={36} color={colors.textSecondary} />
                <ThemedText style={styles.modalEmptyText}>No classes created yet</ThemedText>
                <ThemedText style={styles.modalEmptySubtext}>Create classes in Class Management first</ThemedText>
              </View>
            ) : (
              <ScrollView style={styles.modalScroll}>
                {classes.map(cls => {
                  const selected = formData.classIds.includes(cls._id);
                  return (
                    <TouchableOpacity
                      key={cls._id}
                      style={[styles.optionRow, { borderBottomColor: colors.border }, selected && { backgroundColor: colors.tint + '15' }]}
                      onPress={() => toggleClass(cls._id)}>
                      <View style={styles.classOptionContent}>
                        <ThemedText style={[styles.optionText, selected && { color: colors.tint, fontWeight: '700' }]}>{cls.name}</ThemedText>
                        {cls.code && <ThemedText style={styles.classCode}>{cls.code}{cls.semester ? ` · Sem ${cls.semester}` : ''}</ThemedText>}
                      </View>
                      <View style={[styles.checkbox, { borderColor: colors.tint }, selected && { backgroundColor: colors.tint }]}>
                        {selected && <IconSymbol name="checkmark" size={14} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
            <TouchableOpacity
              style={[styles.doneButton, { backgroundColor: colors.tint }]}
              onPress={() => setShowClassModal(false)}>
              <ThemedText style={styles.doneButtonText}>Done ({formData.classIds.length} selected)</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingVertical: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { marginBottom: 16 },
  subtitle: { fontSize: 14, opacity: 0.6 },

  // Action Row
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  actionBtn: { borderRadius: 14, overflow: 'hidden' },
  actionBtnGradient: { flexDirection: 'row', paddingVertical: 14, alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Hint
  hintBox: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  hintText: { flex: 1, fontSize: 12, lineHeight: 18 },
  hintBold: { fontWeight: '700' },

  // Form
  formContainer: { padding: 20, borderRadius: 20, marginBottom: 20, borderWidth: 2, elevation: 8 },
  formHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 },
  formTitle: { fontSize: 18, fontWeight: '700' },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8, opacity: 0.8 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 14, borderWidth: 2, gap: 10, height: 52 },
  input: { flex: 1, fontSize: 15, fontWeight: '500' },
  selectText: { flex: 1, fontSize: 15, fontWeight: '500' },
  badge: { borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  button: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  gradientButton: { flexDirection: 'row', padding: 14, alignItems: 'center', justifyContent: 'center', gap: 8 },
  cancelButton: { padding: 14, alignItems: 'center', borderRadius: 14 },
  buttonText: { fontWeight: '700', fontSize: 15 },

  // Staff Cards
  staffCard: { flexDirection: 'row', padding: 16, borderRadius: 18, marginBottom: 14, alignItems: 'center', borderWidth: 1, elevation: 5 },
  staffAvatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  staffInfo: { flex: 1 },
  staffName: { fontSize: 16, marginBottom: 6 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  staffDetail: { fontSize: 13, opacity: 0.7 },
  deleteButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '600', opacity: 0.7 },
  emptySubtext: { fontSize: 13, opacity: 0.5, textAlign: 'center' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12 },
  modalTitle: { fontSize: 20 },
  modalScroll: { maxHeight: 400 },
  modalEmpty: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  modalEmptyText: { fontSize: 15, fontWeight: '600', opacity: 0.7 },
  modalEmptySubtext: { fontSize: 13, opacity: 0.5, textAlign: 'center' },
  optionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8, borderBottomWidth: 1, borderRadius: 8, marginBottom: 2 },
  optionText: { fontSize: 15, flex: 1 },
  classOptionContent: { flex: 1 },
  classCode: { fontSize: 12, opacity: 0.5, marginTop: 2 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  doneButton: { marginTop: 16, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  doneButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
