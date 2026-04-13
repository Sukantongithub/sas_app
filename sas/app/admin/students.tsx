import React, { useState, useEffect } from 'react';
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
  Pressable,
  Platform,
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

import { API_BASE_URL } from '@/config/apiConfig';

interface Student {
  _id: string;
  name: string;
  rollNumber: string;
  email: string;
  class: string;
  stats?: {
    totalClasses: number;
    present: number;
    absent: number;
    late: number;
    attendancePercentage: number;
  };
}

interface Class {
  _id: string;
  name: string;
  code: string;
  department: string;
  semester: number;
}

export default function StudentsManagementScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { token, user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [classesLoading, setClassesLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [showFormatModal, setShowFormatModal] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showClassPicker, setShowClassPicker] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    rollNumber: '',
    email: '',
    class: '',
    phone: '',
    parentName: '',
    parentPhone: '',
    parentEmail: '',
    parentRelation: 'guardian',
  });

  const showImportBanner = (type: 'success' | 'error', text: string) => {
    setImportMessage({ type, text });
    setTimeout(() => setImportMessage(null), 4000);
  };

  useEffect(() => {
    fetchStudents();
  }, [token]);

  useEffect(() => {
    // Fetch classes when form is opened
    if (showForm && classes.length === 0) {
      fetchClasses();
    }
  }, [showForm]);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/admin/students`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch students');

      const result = await response.json();
      setStudents(result.data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      setClassesLoading(true);
      const response = await fetch(`${API_BASE_URL}/admin/classes`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch classes');

      const result = await response.json();
      setClasses(result.data || []);
    } catch (error: any) {
      console.error('Error fetching classes:', error);
      Alert.alert('Error', error.message || 'Failed to load classes');
    } finally {
      setClassesLoading(false);
    }
  };

  const blankForm = () => ({
    name: '',
    rollNumber: '',
    email: '',
    class: '',
    phone: '',
    parentName: '',
    parentPhone: '',
    parentEmail: '',
    parentRelation: 'guardian',
  });

  // ── Open Edit Form ────────────────────────────────────────────────
  const openEdit = (student: Student) => {
    setEditingId(student._id);
    setFormData({
      name: student.name || '',
      rollNumber: student.rollNumber || '',
      email: student.email || '',
      class: student.class || '',
      phone: '',
      parentName: '',
      parentPhone: '',
      parentEmail: '',
      parentRelation: 'guardian',
    });
    setShowForm(true);
  };

  // ── Update Student ────────────────────────────────────────────────
  const handleUpdateStudent = async () => {
    if (!editingId) return;
    if (!formData.name || !formData.rollNumber || !formData.email || !formData.class) {
      Alert.alert('Error', 'Please fill in all required student fields');
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/admin/students/${editingId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      const responseData = await response.json();
      if (!response.ok) throw new Error(responseData.message || 'Failed to update student');
      Alert.alert('Success', 'Student updated successfully');
      setFormData(blankForm());
      setEditingId(null);
      setShowForm(false);
      await fetchStudents();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update student');
    }
  };

  // ── Create Student ────────────────────────────────────────────────
  const handleCreateStudent = async () => {
    if (!formData.name || !formData.rollNumber || !formData.email || !formData.class) {
      Alert.alert('Error', 'Please fill in all required student fields');
      return;
    }

    if (!formData.parentName || !formData.parentPhone) {
      Alert.alert('Error', 'Please fill in all required parent fields (Name & Phone)');
      return;
    }

    try {
      const looksLikeEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
      const looksLikePhone = (value: string) => /^\+?[0-9 ()-]{7,20}$/.test(String(value || '').trim());

      let normalizedParentPhone = String(formData.parentPhone || '').trim();
      let normalizedParentEmail = String(formData.parentEmail || '').toLowerCase().trim();

      // Auto-correct if user entered phone and email in opposite fields.
      if (looksLikeEmail(normalizedParentPhone) && looksLikePhone(normalizedParentEmail)) {
        const temp = normalizedParentPhone;
        normalizedParentPhone = normalizedParentEmail;
        normalizedParentEmail = temp;
      }

      const payload = {
        ...formData,
        parentPhone: normalizedParentPhone,
        parentEmail: normalizedParentEmail,
      };

      console.log('📤 Sending student data:', JSON.stringify(payload, null, 2));

      const response = await fetch(`${API_BASE_URL}/admin/students`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();
      console.log('📥 Response status:', response.status);
      console.log('📥 Response data:', responseData);

      if (!response.ok) {
        if (Array.isArray(responseData?.errors) && responseData.errors.length > 0) {
          const details = responseData.errors.map((e: any) => e.msg || e.message || JSON.stringify(e)).join('\n');
          throw new Error(`${responseData.message || 'Validation failed'}\n${details}`);
        }
        throw new Error(responseData.message || 'Failed to create student');
      }

      const result = responseData;
      
      const studentCredentials = result.data.student.loginCredentials 
        ? `\n\n📚 STUDENT LOGIN:\nEmail: ${result.data.student.loginCredentials.email}\nPassword: ${result.data.student.loginCredentials.defaultPassword}`
        : '';

      const parentCredentials = `\n\n👨‍👩‍👧 PARENT LOGIN:\nEmail: ${result.data.parent.email}\nPassword: ${result.data.parent.defaultPassword}`;

      Alert.alert(
        'Success ✅',
        `Student "${formData.name}" created!\n${studentCredentials}${parentCredentials}\n\nPlease share these credentials with the respective users.`
      );
      
      setFormData({ 
        name: '', 
        rollNumber: '', 
        email: '', 
        class: '',
        phone: '',
        parentName: '',
        parentPhone: '',
        parentEmail: '',
        parentRelation: 'guardian',
      });
      setEditingId(null);
      setShowForm(false);
      await fetchStudents();
    } catch (error: any) {
      console.error('❌ Error:', error);
      Alert.alert('Error', error.message || 'Failed to create student');
    }
  };

  const performDeleteStudent = async (id: string) => {
    try {
      let response = await fetch(`${API_BASE_URL}/admin/students/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      // Fallback for environments where DELETE is blocked/unsupported
      if (!response.ok) {
        response = await fetch(`${API_BASE_URL}/admin/students/${id}/delete`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      const result = await response.json().catch(() => ({} as any));
      if (!response.ok) throw new Error(result.message || 'Failed to delete student');

      Alert.alert('Success', 'Student deleted successfully');
      setStudents(prev => prev.filter(s => s._id !== id));
      await fetchStudents();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to delete student');
    }
  };

  const handleDeleteStudent = (id: string, name: string) => {
    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined'
        ? window.confirm(`Are you sure you want to delete ${name}?`)
        : true;
      if (confirmed) {
        void performDeleteStudent(id);
      }
      return;
    }

    Alert.alert(
      'Delete Student',
      `Are you sure you want to delete ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void performDeleteStudent(id);
          },
        },
      ]
    );
  };

  const handleBulkImportStudents = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
          '*/*',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });

      console.log('DocumentPicker result:', JSON.stringify(result));

      if (result.canceled || !result.assets?.length) {
        console.log('File pick cancelled or no assets');
        return;
      }

      const file = result.assets[0];
      console.log('Selected file:', file.name, file.mimeType, file.uri);

      setImportLoading(true);

      const formData = new FormData();

      // On Expo Web the asset has a native File object (.file property).
      // On native (iOS/Android) we use the URI object approach.
      if (file.file) {
        // Web platform — use the real File object directly
        formData.append('file', file.file);
      } else {
        // Native platform — use URI object
        formData.append('file', {
          uri: file.uri,
          name: file.name || 'students.xlsx',
          type: file.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        } as any);
      }

      console.log('Sending import request to:', `${API_BASE_URL}/admin/students/import`);

      const response = await fetch(`${API_BASE_URL}/admin/students/import`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          // Do NOT set Content-Type manually — let fetch set multipart/form-data with boundary
        },
        body: formData,
      });

      console.log('Import response status:', response.status);
      const payload = await response.json();
      console.log('Import payload:', JSON.stringify(payload));

      if (!response.ok) {
        throw new Error(payload.message || 'Failed to import students');
      }

      const summary = payload?.data;
      const created = summary?.created ?? 0;
      const skipped = summary?.skipped ?? 0;
      if (created > 0) {
        showImportBanner(
          'success',
          `✅ ${created} student${created > 1 ? 's' : ''} created successfully!${
            skipped > 0 ? ` (${skipped} skipped)` : ''
          } Default password = Roll Number.`
        );
      } else {
        showImportBanner('error', `No students created. ${skipped} row(s) skipped (already exist).`);
      }

      await fetchStudents();
    } catch (error: any) {
      console.error('Import error:', error);
      showImportBanner('error', error.message || 'Unable to import students file');
    } finally {
      setImportLoading(false);
    }
  };

  const showImportFormatInfo = () => {
    setShowFormatModal(true);
  };

  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.center}>
          <ThemedText type="title">Access Denied</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AdminHeader title="Manage Students" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <ThemedText style={styles.subtitle}>Total: {students.length}</ThemedText>
        </View>

        {importMessage && (
          <View style={[
            styles.importBanner,
            { backgroundColor: importMessage.type === 'success' ? '#1a7a4a' : '#b5361e' }
          ]}>
            <ThemedText style={styles.importBannerText}>{importMessage.text}</ThemedText>
          </View>
        )}

        {showForm && (
          <View style={[styles.formContainer, { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground, borderColor: Colors[colorScheme ?? 'light'].tint }]}>
            <View style={styles.formHeader}>
              <IconSymbol name={editingId ? "pencil.circle.fill" : "person.badge.plus.fill"} size={28} color={Colors[colorScheme ?? 'light'].tint} />
              <ThemedText type="defaultSemiBold" style={styles.formTitle}>
                {editingId ? 'Edit Student' : 'Create New Student'}
              </ThemedText>
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Full Name *</ThemedText>
              <View style={[styles.inputWrapper, { backgroundColor: Colors[colorScheme ?? 'light'].inputBackground, borderColor: Colors[colorScheme ?? 'light'].border }]}>
                <IconSymbol name="person.fill" size={18} color={Colors[colorScheme ?? 'light'].textSecondary} />
                <TextInput
                  style={[styles.input, { color: Colors[colorScheme ?? 'light'].text }]}
                  placeholder="Full Name"
                  placeholderTextColor={Colors[colorScheme ?? 'light'].textSecondary}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  autoComplete="off"
                  textContentType="none"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Roll Number *</ThemedText>
              <View style={[styles.inputWrapper, { backgroundColor: Colors[colorScheme ?? 'light'].inputBackground, borderColor: Colors[colorScheme ?? 'light'].border }]}>
                <IconSymbol name="number.square.fill" size={18} color={Colors[colorScheme ?? 'light'].textSecondary} />
                <TextInput
                  style={[styles.input, { color: Colors[colorScheme ?? 'light'].text }]}
                  placeholder="Roll Number"
                  placeholderTextColor={Colors[colorScheme ?? 'light'].textSecondary}
                  value={formData.rollNumber}
                  onChangeText={(text) => setFormData({ ...formData, rollNumber: text })}
                  autoComplete="off"
                  textContentType="none"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Email *</ThemedText>
              <View style={[styles.inputWrapper, { backgroundColor: Colors[colorScheme ?? 'light'].inputBackground, borderColor: Colors[colorScheme ?? 'light'].border }]}>
                <IconSymbol name="envelope.fill" size={18} color={Colors[colorScheme ?? 'light'].textSecondary} />
                <TextInput
                  style={[styles.input, { color: Colors[colorScheme ?? 'light'].text }]}
                  placeholder="Email"
                  placeholderTextColor={Colors[colorScheme ?? 'light'].textSecondary}
                  value={formData.email}
                  onChangeText={(text) => setFormData({ ...formData, email: text })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="off"
                  textContentType="none"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Class *</ThemedText>
              <TouchableOpacity
                style={[styles.inputWrapper, { backgroundColor: Colors[colorScheme ?? 'light'].inputBackground, borderColor: Colors[colorScheme ?? 'light'].border }]}
                onPress={() => setShowClassPicker(true)}
              >
                <IconSymbol name="book.fill" size={18} color={Colors[colorScheme ?? 'light'].textSecondary} />
                <ThemedText
                  style={[
                    styles.input,
                    {
                      color: formData.class ? Colors[colorScheme ?? 'light'].text : Colors[colorScheme ?? 'light'].textSecondary,
                      flex: 1,
                      paddingHorizontal: 8,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {formData.class || 'Select a Class'}
                </ThemedText>
                <IconSymbol name="chevron.down" size={16} color={Colors[colorScheme ?? 'light'].textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Class Picker Modal */}
            <Modal
              visible={showClassPicker}
              transparent
              animationType="fade"
              onRequestClose={() => setShowClassPicker(false)}
            >
              <Pressable
                style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}
                onPress={() => setShowClassPicker(false)}
              >
                <View style={[styles.classPickerModal, { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground }]}>
                  <View style={styles.classPickerHeader}>
                    <ThemedText type="defaultSemiBold" style={styles.classPickerTitle}>
                      Select a Class
                    </ThemedText>
                    <TouchableOpacity
                      onPress={() => setShowClassPicker(false)}
                      style={styles.closeButton}
                    >
                      <IconSymbol name="xmark.circle.fill" size={24} color={Colors[colorScheme ?? 'light'].tint} />
                    </TouchableOpacity>
                  </View>

                  {classesLoading ? (
                    <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} style={{ marginVertical: 30 }} />
                  ) : classes.length > 0 ? (
                    <FlatList
                      data={classes}
                      keyExtractor={(item) => item._id}
                      scrollEnabled
                      style={styles.classList}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={[
                            styles.classOption,
                            {
                              backgroundColor:
                                formData.class === item.name
                                  ? Colors[colorScheme ?? 'light'].tint + '15'
                                  : 'transparent',
                              borderColor:
                                formData.class === item.name
                                  ? Colors[colorScheme ?? 'light'].tint
                                  : Colors[colorScheme ?? 'light'].border,
                            },
                          ]}
                          onPress={() => {
                            setFormData({ ...formData, class: item.name });
                            setShowClassPicker(false);
                          }}
                        >
                          <View style={styles.classOptionContent}>
                            <ThemedText
                              type="defaultSemiBold"
                              style={{
                                color:
                                  formData.class === item.name
                                    ? Colors[colorScheme ?? 'light'].tint
                                    : Colors[colorScheme ?? 'light'].text,
                              }}
                            >
                              {item.name}
                            </ThemedText>
                            <ThemedText style={styles.classOptionDetail}>
                              {item.code} • {item.department} • Sem {item.semester}
                            </ThemedText>
                          </View>
                          {formData.class === item.name && (
                            <IconSymbol name="checkmark.circle.fill" size={20} color={Colors[colorScheme ?? 'light'].tint} />
                          )}
                        </TouchableOpacity>
                      )}
                      ListEmptyComponent={
                        <ThemedText style={styles.emptyListText}>No classes available</ThemedText>
                      }
                    />
                  ) : (
                    <ThemedText style={styles.emptyListText}>No classes found</ThemedText>
                  )}
                </View>
              </Pressable>
            </Modal>

            <View style={[styles.divider, { backgroundColor: Colors[colorScheme ?? 'light'].border }]} />

            <ThemedText style={[styles.inputLabel, { marginTop: 16, fontSize: 16, fontWeight: '600' }]}>
              Parent/Guardian Details
            </ThemedText>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Parent Name *</ThemedText>
              <View style={[styles.inputWrapper, { backgroundColor: Colors[colorScheme ?? 'light'].inputBackground, borderColor: Colors[colorScheme ?? 'light'].border }]}>
                <IconSymbol name="person.fill" size={18} color={Colors[colorScheme ?? 'light'].textSecondary} />
                <TextInput
                  style={[styles.input, { color: Colors[colorScheme ?? 'light'].text }]}
                  placeholder="Parent Full Name"
                  placeholderTextColor={Colors[colorScheme ?? 'light'].textSecondary}
                  value={formData.parentName}
                  onChangeText={(text) => setFormData({ ...formData, parentName: text })}
                  autoComplete="off"
                  textContentType="none"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Parent Phone *</ThemedText>
              <View style={[styles.inputWrapper, { backgroundColor: Colors[colorScheme ?? 'light'].inputBackground, borderColor: Colors[colorScheme ?? 'light'].border }]}>
                <IconSymbol name="phone.fill" size={18} color={Colors[colorScheme ?? 'light'].textSecondary} />
                <TextInput
                  style={[styles.input, { color: Colors[colorScheme ?? 'light'].text }]}
                  placeholder="Parent Phone Number"
                  placeholderTextColor={Colors[colorScheme ?? 'light'].textSecondary}
                  value={formData.parentPhone}
                  onChangeText={(text) => setFormData({ ...formData, parentPhone: text })}
                  keyboardType="phone-pad"
                  autoComplete="off"
                  textContentType="none"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Parent Email (Optional)</ThemedText>
              <View style={[styles.inputWrapper, { backgroundColor: Colors[colorScheme ?? 'light'].inputBackground, borderColor: Colors[colorScheme ?? 'light'].border }]}>
                <IconSymbol name="envelope.fill" size={18} color={Colors[colorScheme ?? 'light'].textSecondary} />
                <TextInput
                  style={[styles.input, { color: Colors[colorScheme ?? 'light'].text }]}
                  placeholder="Parent Email"
                  placeholderTextColor={Colors[colorScheme ?? 'light'].textSecondary}
                  value={formData.parentEmail}
                  onChangeText={(text) => setFormData({ ...formData, parentEmail: text })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="off"
                  textContentType="none"
                />
              </View>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton, { backgroundColor: Colors[colorScheme ?? 'light'].border }]}
                onPress={() => {
                  setShowForm(false);
                  setFormData(blankForm());
                  setEditingId(null);
                }}>
                <IconSymbol name="xmark.circle.fill" size={18} color={Colors[colorScheme ?? 'light'].textSecondary} />
                <ThemedText style={[styles.buttonText, { color: Colors[colorScheme ?? 'light'].text }]}>Cancel</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity style={styles.button} onPress={editingId ? handleUpdateStudent : handleCreateStudent}>
                <LinearGradient
                  colors={[Colors[colorScheme ?? 'light'].gradientStart, Colors[colorScheme ?? 'light'].gradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientButton}>
                  <IconSymbol name="checkmark.circle.fill" size={18} color="#fff" />
                  <ThemedText style={[styles.buttonText, { color: '#fff' }]}>{editingId ? 'Update Student' : 'Create Student'}</ThemedText>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!showForm && (
          <>
            <TouchableOpacity style={styles.addButtonWrapper} onPress={() => {
              setFormData(blankForm());
              setEditingId(null);
              setShowForm(true);
            }}>
              <LinearGradient
                colors={[Colors[colorScheme ?? 'light'].gradientStart, Colors[colorScheme ?? 'light'].gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.addButton}>
                <IconSymbol name="plus.circle.fill" size={22} color="#fff" />
                <ThemedText style={styles.addButtonText}>Add New Student</ThemedText>
              </LinearGradient>
            </TouchableOpacity>

            <View style={[styles.importCard, { borderColor: Colors[colorScheme ?? 'light'].border, backgroundColor: Colors[colorScheme ?? 'light'].cardBackground }]}>
              <View style={styles.importRow}>
                <TouchableOpacity
                  style={[styles.importButton, { borderColor: Colors[colorScheme ?? 'light'].tint, backgroundColor: Colors[colorScheme ?? 'light'].cardBackground }]}
                  onPress={handleBulkImportStudents}
                  disabled={importLoading}>
                  {importLoading ? (
                    <ActivityIndicator size="small" color={Colors[colorScheme ?? 'light'].tint} />
                  ) : (
                    <View style={styles.importButtonContent}>
                      <View style={[styles.uploadIconWrap, { backgroundColor: Colors[colorScheme ?? 'light'].tint + '20' }]}>
                        <ThemedText style={[styles.uploadSymbol, { color: Colors[colorScheme ?? 'light'].tint }]}>U</ThemedText>
                      </View>
                      <View style={styles.importTextGroup}>
                        <ThemedText style={[styles.importButtonText, { color: Colors[colorScheme ?? 'light'].tint }]}>Upload Excel/CSV</ThemedText>
                        <ThemedText style={[styles.importSubText, { color: Colors[colorScheme ?? 'light'].textSecondary }]}>Tap info icon for format</ThemedText>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.infoButton, { borderColor: Colors[colorScheme ?? 'light'].tint, backgroundColor: Colors[colorScheme ?? 'light'].cardBackground }]}
                  onPress={showImportFormatInfo}
                  activeOpacity={0.8}>
                  <ThemedText style={[styles.infoSymbol, { color: Colors[colorScheme ?? 'light'].tint }]}>i</ThemedText>
                </TouchableOpacity>
              </View>

              <ThemedText style={[styles.importHint, { color: Colors[colorScheme ?? 'light'].textSecondary }]}>File must contain exactly these columns in order: Full Name, Roll Number, Email, Class.</ThemedText>
            </View>
          </>
        )}

        <FlatList
          scrollEnabled={false}
          data={students}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <View style={[styles.studentCard, { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground, borderColor: Colors[colorScheme ?? 'light'].border }]}>
              <View style={[styles.studentAvatar, { backgroundColor: Colors[colorScheme ?? 'light'].tint + '20' }]}>
                <IconSymbol name="person.fill" size={24} color={Colors[colorScheme ?? 'light'].tint} />
              </View>
              <View style={styles.studentInfo}>
                <ThemedText type="defaultSemiBold" style={styles.studentName}>
                  {item.name}
                </ThemedText>
                <View style={styles.detailRow}>
                  <IconSymbol name="number.square" size={14} color={Colors[colorScheme ?? 'light'].textSecondary} />
                  <ThemedText style={styles.studentDetail}>Roll: {item.rollNumber}</ThemedText>
                </View>
                <View style={styles.detailRow}>
                  <IconSymbol name="envelope" size={14} color={Colors[colorScheme ?? 'light'].textSecondary} />
                  <ThemedText style={styles.studentDetail}>{item.email}</ThemedText>
                </View>
                <View style={styles.detailRow}>
                  <IconSymbol name="book" size={14} color={Colors[colorScheme ?? 'light'].textSecondary} />
                  <ThemedText style={styles.studentDetail}>Class: {item.class}</ThemedText>
                </View>
                {item.stats && (
                  <View style={[styles.statsRow, { borderTopColor: Colors[colorScheme ?? 'light'].border }]}>
                    <View style={[styles.statBadge, { backgroundColor: Colors[colorScheme ?? 'light'].success + '20' }]}>
                      <ThemedText style={[styles.statsText, { color: Colors[colorScheme ?? 'light'].success }]}>
                        {item.stats.attendancePercentage}%
                      </ThemedText>
                    </View>
                    <ThemedText style={[styles.statsText, { color: Colors[colorScheme ?? 'light'].textSecondary }]}>
                      {item.stats.present}/{item.stats.totalClasses} Present
                    </ThemedText>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={[styles.editButton, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}
                onPress={() => openEdit(item)}>
                <IconSymbol name="pencil.fill" size={16} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteButton, { backgroundColor: Colors[colorScheme ?? 'light'].error }]}
                onPress={() => handleDeleteStudent(item._id, item.name)}>
                <IconSymbol name="trash.fill" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        />
      </ScrollView>

      <Modal
        visible={showFormatModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFormatModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground, borderColor: Colors[colorScheme ?? 'light'].border }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <View style={[styles.modalInfoBadge, { borderColor: Colors[colorScheme ?? 'light'].tint + '55' }]}>
                  <ThemedText style={[styles.modalInfoBadgeText, { color: Colors[colorScheme ?? 'light'].tint }]}>i</ThemedText>
                </View>
                <ThemedText type="defaultSemiBold" style={styles.modalTitle}>Excel Format (Required)</ThemedText>
              </View>
              <TouchableOpacity onPress={() => setShowFormatModal(false)}>
                <IconSymbol name="xmark.circle.fill" size={22} color={Colors[colorScheme ?? 'light'].textSecondary} />
              </TouchableOpacity>
            </View>

            <ThemedText style={[styles.modalText, { color: Colors[colorScheme ?? 'light'].textSecondary }]}>Header row (exact order):</ThemedText>
            <ThemedText style={styles.modalCode}>Full Name, Roll Number, Email, Class</ThemedText>
            <ThemedText style={[styles.modalText, { color: Colors[colorScheme ?? 'light'].textSecondary }]}>Sample row:</ThemedText>
            <ThemedText style={styles.modalCode}>Rahul Sharma, STU-001, rahul@example.com, 10</ThemedText>

            <TouchableOpacity
              style={[styles.modalCloseButton, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}
              onPress={() => setShowFormatModal(false)}>
              <ThemedText style={styles.modalCloseButtonText}>Close</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.6,
    marginTop: 4,
  },
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
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    opacity: 0.8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 2,
    gap: 10,
    height: 52,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginVertical: 16,
    opacity: 0.3,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  gradientButton: {
    flexDirection: 'row',
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cancelButton: {
    padding: 14,
    alignItems: 'center',
    borderRadius: 14,
  },
  buttonText: {
    fontWeight: '700',
    fontSize: 15,
  },
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
  addButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  importRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
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
  importButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  uploadIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadSymbol: {
    fontSize: 13,
    fontWeight: '800',
  },
  importTextGroup: {
    flex: 1,
  },
  importButtonText: {
    fontWeight: '700',
    fontSize: 14,
  },
  importSubText: {
    fontSize: 11,
    marginTop: 1,
  },
  importHint: {
    marginBottom: 2,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
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
  infoSymbol: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 22,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalInfoBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalInfoBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  modalText: {
    fontSize: 12,
    marginBottom: 4,
  },
  modalCode: {
    fontSize: 12,
    marginBottom: 10,
    fontWeight: '600',
  },
  modalCloseButton: {
    marginTop: 6,
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  studentCard: {
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
  studentAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    marginBottom: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  studentDetail: {
    fontSize: 13,
    opacity: 0.7,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  statBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statsText: {
    fontSize: 13,
    fontWeight: '600',
  },
  editButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  deleteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  importBanner: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  importBannerText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    textAlign: 'center',
  },
  classPickerModal: {
    borderRadius: 16,
    maxHeight: '70%',
    paddingVertical: 16,
    borderWidth: 1,
  },
  classPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  classPickerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  closeButton: {
    padding: 8,
  },
  classList: {
    maxHeight: 400,
  },
  classOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 8,
    marginVertical: 4,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  classOptionContent: {
    flex: 1,
  },
  classOptionDetail: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  emptyListText: {
    textAlign: 'center',
    opacity: 0.6,
    marginVertical: 30,
  },
});
