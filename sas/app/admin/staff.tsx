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
} from 'react-native';
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

const DEPARTMENTS = [
  'Electronics and Communication Engineering',
  'Computer Science and Engineering',
  'Information Technology',
  'Artificial Intelligence and Data Science',
  'Artificial Intelligence and Machine Learning',
  'Mechanical Engineering',
  'Electrical and Electronics Engineering',
];

export default function StaffManagementScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { token, user } = useAuth();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    employeeId: '',
    department: DEPARTMENTS[0],
    phone: '',
    dateOfJoining: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    fetchStaff();
  }, [token]);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/admin/staff`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch staff');

      const result = await response.json();
      setStaff(result.data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load staff');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStaff = async () => {
    if (
      !formData.name ||
      !formData.email ||
      !formData.password ||
      !formData.employeeId ||
      !formData.department
    ) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/admin/staff`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to create staff');

      Alert.alert('Success', 'Staff member created successfully');
      setFormData({
        name: '',
        email: '',
        password: '',
        employeeId: '',
        department: DEPARTMENTS[0],
        phone: '',
        dateOfJoining: new Date().toISOString().split('T')[0],
      });
      setShowForm(false);
      await fetchStaff();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create staff');
    }
  };

  const handleDeleteStaff = (id: string, name: string) => {
    Alert.alert(
      'Delete Staff',
      `Are you sure you want to delete ${name}?`,
      [
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

              Alert.alert('Success', 'Staff member deleted successfully');
              await fetchStaff();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete staff');
            }
          },
        },
      ]
    );
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
      <AdminHeader title="Manage Staff" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <ThemedText style={styles.subtitle}>Total: {staff.length}</ThemedText>
        </View>

        {showForm && (
          <View style={[styles.formContainer, { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground, borderColor: Colors[colorScheme ?? 'light'].tint }]}>
            <View style={styles.formHeader}>
              <IconSymbol name="person.2.badge.gearshape.fill" size={28} color={Colors[colorScheme ?? 'light'].tint} />
              <ThemedText type="defaultSemiBold" style={styles.formTitle}>
                Create New Staff
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
              <ThemedText style={styles.inputLabel}>Password *</ThemedText>
              <View style={[styles.inputWrapper, { backgroundColor: Colors[colorScheme ?? 'light'].inputBackground, borderColor: Colors[colorScheme ?? 'light'].border }]}>
                <IconSymbol name="lock.fill" size={18} color={Colors[colorScheme ?? 'light'].textSecondary} />
                <TextInput
                  style={[styles.input, { color: Colors[colorScheme ?? 'light'].text }]}
                  placeholder="Password"
                  placeholderTextColor={Colors[colorScheme ?? 'light'].textSecondary}
                  value={formData.password}
                  onChangeText={(text) => setFormData({ ...formData, password: text })}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="off"
                  textContentType="none"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Employee ID *</ThemedText>
              <View style={[styles.inputWrapper, { backgroundColor: Colors[colorScheme ?? 'light'].inputBackground, borderColor: Colors[colorScheme ?? 'light'].border }]}>
                <IconSymbol name="number.square.fill" size={18} color={Colors[colorScheme ?? 'light'].textSecondary} />
                <TextInput
                  style={[styles.input, { color: Colors[colorScheme ?? 'light'].text }]}
                  placeholder="Employee ID"
                  placeholderTextColor={Colors[colorScheme ?? 'light'].textSecondary}
                  value={formData.employeeId}
                  onChangeText={(text) => setFormData({ ...formData, employeeId: text })}
                  autoComplete="off"
                  textContentType="none"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Department *</ThemedText>
              <TouchableOpacity 
                style={[styles.inputWrapper, { backgroundColor: Colors[colorScheme ?? 'light'].inputBackground, borderColor: Colors[colorScheme ?? 'light'].border }]}
                onPress={() => setShowDepartmentModal(true)}>
                <IconSymbol name="building.2.fill" size={18} color={Colors[colorScheme ?? 'light'].textSecondary} />
                <ThemedText style={[styles.selectText, { color: Colors[colorScheme ?? 'light'].text }]}>
                  {formData.department}
                </ThemedText>
                <IconSymbol name="chevron.down" size={16} color={Colors[colorScheme ?? 'light'].textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Phone</ThemedText>
              <View style={[styles.inputWrapper, { backgroundColor: Colors[colorScheme ?? 'light'].inputBackground, borderColor: Colors[colorScheme ?? 'light'].border }]}>
                <IconSymbol name="phone.fill" size={18} color={Colors[colorScheme ?? 'light'].textSecondary} />
                <TextInput
                  style={[styles.input, { color: Colors[colorScheme ?? 'light'].text }]}
                  placeholder="Phone (10 digits)"
                  placeholderTextColor={Colors[colorScheme ?? 'light'].textSecondary}
                  value={formData.phone}
                  onChangeText={(text) => {
                    // Only allow numbers and max 10 digits
                    const numericValue = text.replace(/[^0-9]/g, '').slice(0, 10);
                    setFormData({ ...formData, phone: numericValue });
                  }}
                  keyboardType="number-pad"
                  maxLength={10}
                  autoComplete="off"
                  textContentType="none"
                />
              </View>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton, { backgroundColor: Colors[colorScheme ?? 'light'].border }]}
                onPress={() => {
                  setFormData({
                    name: '',
                    email: '',
                    password: '',
                    employeeId: '',
                    department: DEPARTMENTS[0],
                    phone: '',
                    dateOfJoining: new Date().toISOString().split('T')[0],
                  });
                  setShowForm(false);
                }}>
                <ThemedText style={[styles.buttonText, { color: Colors[colorScheme ?? 'light'].text }]}>Cancel</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity style={styles.button} onPress={handleCreateStaff}>
                <LinearGradient
                  colors={[Colors[colorScheme ?? 'light'].gradientStart, Colors[colorScheme ?? 'light'].gradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientButton}>
                  <IconSymbol name="checkmark.circle.fill" size={18} color="#fff" />
                  <ThemedText style={[styles.buttonText, { color: '#fff' }]}>Create Staff</ThemedText>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!showForm && (
          <TouchableOpacity 
            style={styles.addButtonWrapper} 
            activeOpacity={0.8}
            onPress={() => {
              setFormData({
                name: '',
                email: '',
                password: '',
                employeeId: '',
                department: DEPARTMENTS[0],
                phone: '',
                dateOfJoining: new Date().toISOString().split('T')[0],
              });
              setShowForm(true);
            }}>
            <LinearGradient
              colors={[Colors[colorScheme ?? 'light'].gradientStart, Colors[colorScheme ?? 'light'].gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.addButton}>
              <IconSymbol name="plus.circle.fill" size={22} color="#fff" />
              <ThemedText style={styles.addButtonText}>Add New Staff</ThemedText>
            </LinearGradient>
          </TouchableOpacity>
        )}

        <FlatList
          scrollEnabled={false}
          data={staff}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <View style={[styles.staffCard, { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground, borderColor: Colors[colorScheme ?? 'light'].border }]}>
              <View style={[styles.staffAvatar, { backgroundColor: Colors[colorScheme ?? 'light'].tint + '20' }]}>
                <IconSymbol name="person.badge.shield.checkmark.fill" size={24} color={Colors[colorScheme ?? 'light'].tint} />
              </View>
              <View style={styles.staffInfo}>
                <ThemedText type="defaultSemiBold" style={styles.staffName}>
                  {item.userId.name}
                </ThemedText>
                <View style={styles.detailRow}>
                  <IconSymbol name="number.square" size={14} color={Colors[colorScheme ?? 'light'].textSecondary} />
                  <ThemedText style={styles.staffDetail}>ID: {item.employeeId}</ThemedText>
                </View>
                <View style={styles.detailRow}>
                  <IconSymbol name="envelope" size={14} color={Colors[colorScheme ?? 'light'].textSecondary} />
                  <ThemedText style={styles.staffDetail}>{item.userId.email}</ThemedText>
                </View>
                <View style={styles.detailRow}>
                  <IconSymbol name="building.2" size={14} color={Colors[colorScheme ?? 'light'].textSecondary} />
                  <ThemedText style={styles.staffDetail}>Dept: {item.department}</ThemedText>
                </View>
                {item.performanceRating && (
                  <View style={styles.detailRow}>
                    <IconSymbol name="star.fill" size={14} color={Colors[colorScheme ?? 'light'].warning} />
                    <ThemedText style={[styles.staffDetail, { color: Colors[colorScheme ?? 'light'].warning }]}>Rating: {item.performanceRating}/5</ThemedText>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={[styles.deleteButton, { backgroundColor: Colors[colorScheme ?? 'light'].error }]}
                onPress={() => handleDeleteStaff(item._id, item.userId.name)}>
                <IconSymbol name="trash.fill" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        />
      </ScrollView>

      {/* Department Selection Modal */}
      <Modal
        visible={showDepartmentModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDepartmentModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="defaultSemiBold" style={styles.modalTitle}>Select Department</ThemedText>
              <TouchableOpacity onPress={() => setShowDepartmentModal(false)}>
                <IconSymbol name="xmark.circle.fill" size={28} color={Colors[colorScheme ?? 'light'].textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {DEPARTMENTS.map((dept) => (
                <TouchableOpacity
                  key={dept}
                  style={[
                    styles.departmentOption,
                    { borderBottomColor: Colors[colorScheme ?? 'light'].border },
                    formData.department === dept && { backgroundColor: Colors[colorScheme ?? 'light'].tint + '15' },
                  ]}
                  onPress={() => {
                    setFormData({ ...formData, department: dept });
                    setShowDepartmentModal(false);
                  }}>
                  <ThemedText style={[
                    styles.departmentOptionText,
                    formData.department === dept && { color: Colors[colorScheme ?? 'light'].tint, fontWeight: '700' },
                  ]}>
                    {dept}
                  </ThemedText>
                  {formData.department === dept && (
                    <IconSymbol name="checkmark.circle.fill" size={24} color={Colors[colorScheme ?? 'light'].tint} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
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
  selectText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
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
  staffInfo: {
    flex: 1,
  },
  staffName: {
    fontSize: 16,
    marginBottom: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  staffDetail: {
    fontSize: 13,
    opacity: 0.7,
  },
  deleteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 15,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
  },
  modalScroll: {
    maxHeight: 400,
  },
  departmentOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderRadius: 8,
    marginBottom: 4,
  },
  departmentOptionText: {
    fontSize: 15,
    flex: 1,
  },
});
