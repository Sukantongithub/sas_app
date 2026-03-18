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

export default function StudentsManagementScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { token, user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    rollNumber: '',
    email: '',
    class: '',
  });

  useEffect(() => {
    fetchStudents();
  }, [token]);

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

  const handleCreateStudent = async () => {
    if (!formData.name || !formData.rollNumber || !formData.email || !formData.class) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/admin/students`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to create student');

      Alert.alert('Success', 'Student created successfully');
      setFormData({ name: '', rollNumber: '', email: '', class: '' });
      setShowForm(false);
      await fetchStudents();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create student');
    }
  };

  const handleDeleteStudent = (id: string, name: string) => {
    Alert.alert(
      'Delete Student',
      `Are you sure you want to delete ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_BASE_URL}/admin/students/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });

              if (!response.ok) throw new Error('Failed to delete student');

              Alert.alert('Success', 'Student deleted successfully');
              await fetchStudents();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete student');
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
      <AdminHeader title="Manage Students" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <ThemedText style={styles.subtitle}>Total: {students.length}</ThemedText>
        </View>

        {showForm && (
          <View style={[styles.formContainer, { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground, borderColor: Colors[colorScheme ?? 'light'].tint }]}>
            <View style={styles.formHeader}>
              <IconSymbol name="person.badge.plus.fill" size={28} color={Colors[colorScheme ?? 'light'].tint} />
              <ThemedText type="defaultSemiBold" style={styles.formTitle}>
                Create New Student
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
              <View style={[styles.inputWrapper, { backgroundColor: Colors[colorScheme ?? 'light'].inputBackground, borderColor: Colors[colorScheme ?? 'light'].border }]}>
                <IconSymbol name="book.fill" size={18} color={Colors[colorScheme ?? 'light'].textSecondary} />
                <TextInput
                  style={[styles.input, { color: Colors[colorScheme ?? 'light'].text }]}
                  placeholder="Class"
                  placeholderTextColor={Colors[colorScheme ?? 'light'].textSecondary}
                  value={formData.class}
                  onChangeText={(text) => setFormData({ ...formData, class: text })}
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
                  setFormData({ name: '', rollNumber: '', email: '', class: '' });
                }}>
                <ThemedText style={[styles.buttonText, { color: Colors[colorScheme ?? 'light'].text }]}>Cancel</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity style={styles.button} onPress={handleCreateStudent}>
                <LinearGradient
                  colors={[Colors[colorScheme ?? 'light'].gradientStart, Colors[colorScheme ?? 'light'].gradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientButton}>
                  <IconSymbol name="checkmark.circle.fill" size={18} color="#fff" />
                  <ThemedText style={[styles.buttonText, { color: '#fff' }]}>Create Student</ThemedText>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!showForm && (
          <TouchableOpacity style={styles.addButtonWrapper} onPress={() => {
            setFormData({ name: '', rollNumber: '', email: '', class: '' });
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
                style={[styles.deleteButton, { backgroundColor: Colors[colorScheme ?? 'light'].error }]}
                onPress={() => handleDeleteStudent(item._id, item.name)}>
                <IconSymbol name="trash.fill" size={16} color="#fff" />
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
  deleteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});
