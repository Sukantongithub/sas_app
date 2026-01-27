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
          <View style={[styles.formContainer, styles.cardShadow]}>
            <ThemedText type="defaultSemiBold" style={styles.formTitle}>
              Create New Student
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
              placeholder="Roll Number"
              placeholderTextColor="#999"
              value={formData.rollNumber}
              onChangeText={(text) => setFormData({ ...formData, rollNumber: text })}
            />

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#999"
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
            />

            <TextInput
              style={styles.input}
              placeholder="Class"
              placeholderTextColor="#999"
              value={formData.class}
              onChangeText={(text) => setFormData({ ...formData, class: text })}
            />

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  setShowForm(false);
                  setFormData({ name: '', rollNumber: '', email: '', class: '' });
                }}>
                <ThemedText style={styles.buttonText}>Cancel</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.button, styles.createButton]} onPress={handleCreateStudent}>
                <ThemedText style={[styles.buttonText, { color: '#fff' }]}>Create</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!showForm && (
          <TouchableOpacity style={styles.addButton} onPress={() => setShowForm(true)}>
            <ThemedText style={styles.addButtonText}>+ Add Student</ThemedText>
          </TouchableOpacity>
        )}

        <FlatList
          scrollEnabled={false}
          data={students}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <View style={[styles.studentCard, styles.cardShadow]}>
              <View style={styles.studentInfo}>
                <ThemedText type="defaultSemiBold" style={styles.studentName}>
                  {item.name}
                </ThemedText>
                <ThemedText style={styles.studentDetail}>Roll: {item.rollNumber}</ThemedText>
                <ThemedText style={styles.studentDetail}>{item.email}</ThemedText>
                <ThemedText style={styles.studentDetail}>Class: {item.class}</ThemedText>
                {item.stats && (
                  <View style={styles.statsRow}>
                    <ThemedText style={styles.statsText}>
                      Attendance: {item.stats.attendancePercentage}%
                    </ThemedText>
                    <ThemedText style={styles.statsText}>
                      Present: {item.stats.present}/{item.stats.totalClasses}
                    </ThemedText>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteStudent(item._id, item.name)}>
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
    borderLeftColor: '#007AFF',
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
    backgroundColor: Colors.dark.text + '20',
  },
  createButton: {
    backgroundColor: '#007AFF',
  },
  buttonText: {
    fontWeight: '600',
    color: '#fff',
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  studentCard: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.cardBackground,
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 15,
    marginBottom: 4,
  },
  studentDetail: {
    fontSize: 12,
    opacity: 0.6,
  },
  statsRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  statsText: {
    fontSize: 12,
    color: '#007AFF',
    marginVertical: 2,
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
