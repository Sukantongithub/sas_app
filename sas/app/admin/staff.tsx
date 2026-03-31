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
import { useAuth } from '@/context/AuthContext';
import AdminHeader from './AdminHeader';

const API_BASE_URL = 'http://localhost:5000/api';

interface StaffMember {
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
  section?: string;
  performanceRating?: number;
  leaveBalance: number;
  isActive: boolean;
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
  { label: 'HOD', value: 'hod' },
  { label: 'Admin', value: 'admin' },
  { label: 'Security', value: 'security' },
  { label: 'Maintenance', value: 'maintenance' },
  { label: 'Office Manager', value: 'office_manager' },
];

export default function StaffManagementScreen() {
  const colorScheme = useColorScheme();
  const { token, user } = useAuth();
  const colors = Colors[colorScheme ?? 'light'];

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showFormatModal, setShowFormatModal] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [showDesignationModal, setShowDesignationModal] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  const showImportBanner = (type: 'success' | 'error', text: string) => {
    setImportMessage({ type, text });
    setTimeout(() => setImportMessage(null), 4000);
  };

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
      setImporting(true);

      const formDataUpload = new FormData();
      if ((file as any).file) {
        formDataUpload.append('file', (file as any).file);
      } else {
        formDataUpload.append('file', {
          uri: file.uri,
          name: file.name || 'staff.xlsx',
          type: file.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        } as any);
      }

      const response = await fetch(`${API_BASE_URL}/admin/staff/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formDataUpload,
      });

      const data = await response.json();

      if (!response.ok) {
        showImportBanner('error', data.message || 'Failed to import staff');
        return;
      }

      const { created, skipped } = data.data;
      if (created > 0) {
        showImportBanner(
          'success',
          `✅ ${created} staff member${created > 1 ? 's' : ''} created!${skipped > 0 ? ` (${skipped} skipped)` : ''} Default password = Employee ID.`
        );
      } else {
        showImportBanner('error', `No staff created. ${skipped} row(s) skipped (already exist or invalid).`);
      }
      if (created > 0) await fetchStaff();
    } catch (error: any) {
      showImportBanner('error', error.message || 'Failed to import file');
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

        {/* Import Banner */}
        {importMessage && (
          <View style={[
            styles.importBanner,
            { backgroundColor: importMessage.type === 'success' ? '#1a7a4a' : '#b5361e' }
          ]}>
            <ThemedText style={styles.importBannerText}>{importMessage.text}</ThemedText>
          </View>
        )}

        {/* Create Form (shown when showForm=true) */}
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
              <ThemedText style={styles.inputLabel}>Staff ID / Employee ID *</ThemedText>
              <View style={[styles.inputWrapper, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                <IconSymbol name="number.square.fill" size={18} color={colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="e.g. STF-CSE-001"
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
                <View style={[styles.countBadge, { backgroundColor: colors.tint }]}>
                  <ThemedText style={styles.countBadgeText}>{formData.classIds.length}</ThemedText>
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

        {/* "Add New Staff" button + Excel import card (hidden when form is open) */}
        {!showForm && (
          <>
            {/* Full-width gradient Add button */}
            <TouchableOpacity
              style={styles.addButtonWrapper}
              onPress={() => { setFormData(blankForm()); setShowForm(true); }}>
              <LinearGradient
                colors={[colors.gradientStart, colors.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.addButton}>
                <IconSymbol name="plus.circle.fill" size={22} color="#fff" />
                <ThemedText style={styles.addButtonText}>Add New Staff</ThemedText>
              </LinearGradient>
            </TouchableOpacity>

            {/* Upload Excel/CSV card */}
            <View style={[styles.importCard, { borderColor: colors.border, backgroundColor: colors.cardBackground }]}>
              <View style={styles.importRow}>
                <TouchableOpacity
                  style={[styles.importButton, { borderColor: colors.tint, backgroundColor: colors.cardBackground }]}
                  onPress={handleImportExcel}
                  disabled={importing}>
                  {importing ? (
                    <ActivityIndicator size="small" color={colors.tint} />
                  ) : (
                    <View style={styles.importButtonContent}>
                      <View style={[styles.uploadIconWrap, { backgroundColor: colors.tint + '20' }]}>
                        <ThemedText style={[styles.uploadSymbol, { color: colors.tint }]}>U</ThemedText>
                      </View>
                      <View style={styles.importTextGroup}>
                        <ThemedText style={[styles.importButtonText, { color: colors.tint }]}>Upload Excel/CSV</ThemedText>
                        <ThemedText style={[styles.importSubText, { color: colors.textSecondary }]}>Tap info icon for format</ThemedText>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.infoButton, { borderColor: colors.tint, backgroundColor: colors.cardBackground }]}
                  onPress={() => setShowFormatModal(true)}
                  activeOpacity={0.8}>
                  <ThemedText style={[styles.infoSymbol, { color: colors.tint }]}>i</ThemedText>
                </TouchableOpacity>
              </View>

              <ThemedText style={[styles.importHint, { color: colors.textSecondary }]}>
                File must contain: Name, Email, Employee ID, Designation, Department
              </ThemedText>
            </View>
          </>
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
              {/* Avatar circle with initials */}
              <View style={[styles.staffAvatar, { backgroundColor: colors.tint + '20' }]}>
                <ThemedText style={[styles.avatarLetter, { color: colors.tint }]}>
                  {item.userId?.name?.charAt(0).toUpperCase() || '?'}
                </ThemedText>
              </View>
              <View style={styles.staffInfo}>
                <ThemedText type="defaultSemiBold" style={styles.staffName}>{item.userId?.name}</ThemedText>
                <View style={styles.detailRow}>
                  <IconSymbol name="number.square" size={14} color={colors.textSecondary} />
                  <ThemedText style={styles.staffDetail}>ID: {item.employeeId}</ThemedText>
                </View>
                <View style={styles.detailRow}>
                  <IconSymbol name="envelope" size={14} color={colors.textSecondary} />
                  <ThemedText style={styles.staffDetail}>{item.userId?.email}</ThemedText>
                </View>
                <View style={styles.detailRow}>
                  <IconSymbol name="building.2" size={14} color={colors.textSecondary} />
                  <ThemedText style={styles.staffDetail}>{item.department}</ThemedText>
                </View>
                <View style={styles.detailRow}>
                  <IconSymbol name="briefcase" size={14} color={colors.textSecondary} />
                  <ThemedText style={styles.staffDetail}>{item.designation}</ThemedText>
                </View>
                {item.performanceRating != null && (
                  <View style={styles.detailRow}>
                    <IconSymbol name="star.fill" size={14} color={colors.warning} />
                    <ThemedText style={[styles.staffDetail, { color: colors.warning }]}>Rating: {item.performanceRating}/5</ThemedText>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={[styles.deleteButton, { backgroundColor: colors.error }]}
                onPress={() => handleDeleteStaff(item._id, item.userId?.name)}>
                <IconSymbol name="trash.fill" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        />
      </ScrollView>

      {/* ── Format Info Modal ────────────────────── */}
      <Modal visible={showFormatModal} transparent animationType="fade" onRequestClose={() => setShowFormatModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <View style={[styles.modalInfoBadge, { borderColor: colors.tint + '55' }]}>
                  <ThemedText style={[styles.modalInfoBadgeText, { color: colors.tint }]}>i</ThemedText>
                </View>
                <ThemedText type="defaultSemiBold" style={styles.modalTitle}>Excel Format (Required)</ThemedText>
              </View>
              <TouchableOpacity onPress={() => setShowFormatModal(false)}>
                <IconSymbol name="xmark.circle.fill" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ThemedText style={[styles.modalText, { color: colors.textSecondary }]}>Header row (any order):</ThemedText>
            <ThemedText style={styles.modalCode}>Name, Email, Employee ID, Designation, Department</ThemedText>
            <ThemedText style={[styles.modalText, { color: colors.textSecondary }]}>Sample row:</ThemedText>
            <ThemedText style={styles.modalCode}>Ramesh Kumar, ramesh@college.edu, STF-001, staff, Computer Science and Engineering</ThemedText>
            <ThemedText style={[styles.modalText, { color: colors.textSecondary }]}>
              Valid designations: staff, hod, admin, security, maintenance, office_manager
            </ThemedText>
            <ThemedText style={[styles.modalText, { color: colors.textSecondary, marginTop: 4 }]}>
              Default password = Employee ID
            </ThemedText>
            <TouchableOpacity
              style={[styles.modalCloseButton, { backgroundColor: colors.tint }]}
              onPress={() => setShowFormatModal(false)}>
              <ThemedText style={styles.modalCloseButtonText}>Close</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Designation Modal ──────────────────── */}
      <Modal visible={showDesignationModal} transparent animationType="slide" onRequestClose={() => setShowDesignationModal(false)}>
        <View style={styles.bottomModalOverlay}>
          <View style={[styles.bottomModalContent, { backgroundColor: colors.background }]}>
            <View style={styles.bottomModalHeader}>
              <ThemedText type="defaultSemiBold" style={styles.bottomModalTitle}>Select Designation</ThemedText>
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

      {/* ── Department Modal ───────────────────── */}
      <Modal visible={showDepartmentModal} transparent animationType="slide" onRequestClose={() => setShowDepartmentModal(false)}>
        <View style={styles.bottomModalOverlay}>
          <View style={[styles.bottomModalContent, { backgroundColor: colors.background }]}>
            <View style={styles.bottomModalHeader}>
              <ThemedText type="defaultSemiBold" style={styles.bottomModalTitle}>Select Department</ThemedText>
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

      {/* ── Class Picker Modal ─────────────────── */}
      <Modal visible={showClassModal} transparent animationType="slide" onRequestClose={() => setShowClassModal(false)}>
        <View style={styles.bottomModalOverlay}>
          <View style={[styles.bottomModalContent, { backgroundColor: colors.background }]}>
            <View style={styles.bottomModalHeader}>
              <ThemedText type="defaultSemiBold" style={styles.bottomModalTitle}>Assign to Classes</ThemedText>
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

  header: { marginBottom: 20 },
  subtitle: { fontSize: 14, opacity: 0.6, marginTop: 4 },

  // Import Banner
  importBanner: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  importBannerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },

  // Form
  formContainer: {
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  formHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 },
  formTitle: { fontSize: 18, fontWeight: '700' },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8, opacity: 0.8 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 2,
    gap: 10,
    height: 52,
  },
  input: { flex: 1, fontSize: 15, fontWeight: '500' },
  selectText: { flex: 1, fontSize: 15, fontWeight: '500' },
  countBadge: { borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  countBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  button: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  gradientButton: { flexDirection: 'row', padding: 14, alignItems: 'center', justifyContent: 'center', gap: 8 },
  cancelButton: { padding: 14, alignItems: 'center', borderRadius: 14 },
  buttonText: { fontWeight: '700', fontSize: 15 },

  // "Add New Staff" full-width button
  addButtonWrapper: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  addButton: {
    flexDirection: 'row',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  // Import card
  importCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  importRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  importButton: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  importButtonContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  uploadIconWrap: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  uploadSymbol: { fontSize: 13, fontWeight: '800' },
  importTextGroup: { flex: 1 },
  importButtonText: { fontWeight: '700', fontSize: 14 },
  importSubText: { fontSize: 11, marginTop: 1 },
  importHint: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
  infoButton: {
    borderWidth: 1,
    borderRadius: 12,
    width: 46,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  infoSymbol: { fontSize: 20, fontWeight: '800', lineHeight: 22 },

  // Staff Cards
  staffCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 18,
    marginBottom: 14,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  staffAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarLetter: { fontSize: 20, fontWeight: '700' },
  staffInfo: { flex: 1 },
  staffName: { fontSize: 16, marginBottom: 6 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  staffDetail: { fontSize: 13, opacity: 0.7 },
  deleteButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '600', opacity: 0.7 },
  emptySubtext: { fontSize: 13, opacity: 0.5, textAlign: 'center' },

  // Format Info Modal (centre)
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)', justifyContent: 'center', paddingHorizontal: 20 },
  modalCard: { borderRadius: 16, padding: 16, borderWidth: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 16 },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalInfoBadge: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  modalInfoBadgeText: { fontSize: 13, fontWeight: '800' },
  modalText: { fontSize: 12, marginBottom: 4 },
  modalCode: { fontSize: 12, marginBottom: 10, fontWeight: '600' },
  modalCloseButton: { marginTop: 6, height: 42, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  modalCloseButtonText: { color: '#fff', fontWeight: '700' },

  // Bottom-sheet modals (Designation, Department, Class picker)
  bottomModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  bottomModalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  bottomModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12 },
  bottomModalTitle: { fontSize: 20 },
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
