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
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
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

const DESIGNATIONS = ['admin', 'staff', 'security', 'maintenance', 'office_manager'];

export default function StaffManagementScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { token, user } = useAuth();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    employeeId: '',
    designation: 'staff',
    department: '',
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
        designation: 'staff',
        department: '',
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
          <View style={[styles.formContainer, styles.cardShadow]}>
            <ThemedText type="defaultSemiBold" style={styles.formTitle}>
              Create New Staff
            </ThemedText>

            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor="#999"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
            />

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#999"
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              keyboardType="email-address"
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#999"
              value={formData.password}
              onChangeText={(text) => setFormData({ ...formData, password: text })}
              secureTextEntry
            />

            <TextInput
              style={styles.input}
              placeholder="Employee ID"
              placeholderTextColor="#999"
              value={formData.employeeId}
              onChangeText={(text) => setFormData({ ...formData, employeeId: text })}
            />

            <TextInput
              style={styles.input}
              placeholder="Department"
              placeholderTextColor="#999"
              value={formData.department}
              onChangeText={(text) => setFormData({ ...formData, department: text })}
            />

            <TextInput
              style={styles.input}
              placeholder="Phone"
              placeholderTextColor="#999"
              value={formData.phone}
              onChangeText={(text) => setFormData({ ...formData, phone: text })}
              keyboardType="phone-pad"
            />

            <ThemedText style={styles.label}>Designation</ThemedText>
            <ScrollView horizontal style={styles.designationScroll}>
              {DESIGNATIONS.map((des) => (
                <TouchableOpacity
                  key={des}
                  style={[
                    styles.designationButton,
                    formData.designation === des && styles.designationButtonActive,
                  ]}
                  onPress={() => setFormData({ ...formData, designation: des })}>
                  <ThemedText
                    style={[
                      styles.designationButtonText,
                      formData.designation === des && styles.designationButtonTextActive,
                    ]}>
                    {des}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => setShowForm(false)}>
                <ThemedText style={styles.buttonText}>Cancel</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.button, styles.createButton]} onPress={handleCreateStaff}>
                <ThemedText style={[styles.buttonText, { color: '#fff' }]}>Create</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!showForm && (
          <TouchableOpacity style={styles.addButton} onPress={() => setShowForm(true)}>
            <ThemedText style={styles.addButtonText}>+ Add Staff</ThemedText>
          </TouchableOpacity>
        )}

        <FlatList
          scrollEnabled={false}
          data={staff}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <View style={[styles.staffCard, styles.cardShadow]}>
              <View style={styles.staffInfo}>
                <ThemedText type="defaultSemiBold" style={styles.staffName}>
                  {item.userId.name}
                </ThemedText>
                <ThemedText style={styles.staffDetail}>ID: {item.employeeId}</ThemedText>
                <ThemedText style={styles.staffDetail}>{item.userId.email}</ThemedText>
                <ThemedText style={styles.staffDetail}>Dept: {item.department}</ThemedText>
                <View style={styles.designationBadge}>
                  <ThemedText style={styles.designationBadgeText}>{item.designation}</ThemedText>
                </View>
                {item.performanceRating && (
                  <ThemedText style={styles.staffDetail}>Rating: {item.performanceRating}/5</ThemedText>
                )}
              </View>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteStaff(item._id, item.userId.name)}>
                <ThemedText style={styles.deleteButtonText}>Delete</ThemedText>
              </TouchableOpacity>
            </View>
          )}
        />
      </ScrollView>
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
    backgroundColor: Colors.dark.cardBackground,
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#9c27b0',
  },
  formTitle: {
    fontSize: 16,
    marginBottom: 12,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.dark.text + '30',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    fontSize: 14,
    backgroundColor: Colors.dark.text + '10',
    color: Colors.dark.text,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    opacity: 0.8,
  },
  designationScroll: {
    marginBottom: 12,
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  designationButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.text + '30',
    marginRight: 8,
  },
  designationButtonActive: {
    backgroundColor: '#9c27b0',
    borderColor: '#9c27b0',
  },
  designationButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  designationButtonTextActive: {
    color: '#fff',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#ddd',
  },
  createButton: {
    backgroundColor: '#9c27b0',
  },
  buttonText: {
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#9c27b0',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  staffCard: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.cardBackground,
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 4,
    borderLeftColor: '#9c27b0',
  },
  staffInfo: {
    flex: 1,
  },
  staffName: {
    fontSize: 15,
    marginBottom: 4,
  },
  staffDetail: {
    fontSize: 12,
    opacity: 0.6,
  },
  designationBadge: {
    backgroundColor: '#9c27b0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  designationBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#ff3b30',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  cardShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
