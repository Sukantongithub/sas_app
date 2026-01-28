import { useState } from 'react';
import { StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAttendance } from '@/context/AttendanceContext';
import { useAuth } from '@/context/AuthContext';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function StudentsScreen() {
  const colorScheme = useColorScheme();
  const { students, addStudent, deleteStudent, loading, error } = useAttendance();
  const { user } = useAuth();
  const [isAdding, setIsAdding] = useState(false);
  const [newStudent, setNewStudent] = useState({
    name: '',
    rollNumber: '',
    email: '',
    class: '',
  });

  // Check if user has permission to manage students
  const canManageStudents = user?.role && ['admin', 'super_admin', 'teacher', 'faculty'].includes(user.role);
  const isStudent = user?.role === 'student';

  const stats = {
    total: students.length,
    withEmail: students.filter((s) => !!s.email).length,
    classes: new Set(students.map((s) => s.class || 'Unassigned')).size,
  };

  const handleAddStudent = async () => {
    if (!canManageStudents) {
      Alert.alert('Access Denied', 'You do not have permission to add students');
      return;
    }

    if (!newStudent.name || !newStudent.rollNumber || !newStudent.class) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      await addStudent(newStudent);
      setNewStudent({ name: '', rollNumber: '', email: '', class: '' });
      setIsAdding(false);
      Alert.alert('Success', 'Student added successfully');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to add student');
    }
  };

  const handleDeleteStudent = (id: string, name: string) => {
    if (!canManageStudents) {
      Alert.alert('Access Denied', 'You do not have permission to delete students');
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
          onPress: async () => {
            try {
              await deleteStudent(id);
              Alert.alert('Success', 'Student deleted successfully');
            } catch (err: any) {
              Alert.alert('Error', 'Failed to delete student');
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* Show access denied message for students */}
      {isStudent ? (
        <ThemedView style={styles.accessDeniedContainer}>
          <IconSymbol name="exclamationmark.shield.fill" size={64} color="#F44336" />
          <ThemedText type="title" style={styles.accessDeniedTitle}>Access Restricted</ThemedText>
          <ThemedText style={styles.accessDeniedText}>
            Students do not have permission to view or manage student records.
          </ThemedText>
          <ThemedText style={styles.accessDeniedHint}>
            Use the "My Attendance" tab to view your own attendance information.
          </ThemedText>
        </ThemedView>
      ) : (
        <>
          <ThemedView style={styles.header}>
            <ThemedText type="title">Students</ThemedText>
            {canManageStudents && (
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}
                onPress={() => setIsAdding(!isAdding)}>
                <IconSymbol name={isAdding ? 'xmark' : 'plus'} size={20} color="#fff" />
              </TouchableOpacity>
            )}
          </ThemedView>

      <ThemedView style={styles.statsRow}>
        <View style={styles.statCard}>
          <IconSymbol name="person.3.fill" size={20} color={Colors[colorScheme ?? 'light'].tint} />
          <ThemedText type="defaultSemiBold" style={styles.statNumber}>{stats.total}</ThemedText>
          <ThemedText style={styles.statLabel}>Total Students</ThemedText>
        </View>
        <View style={styles.statCard}>
          <IconSymbol name="envelope.fill" size={20} color={Colors[colorScheme ?? 'light'].tint} />
          <ThemedText type="defaultSemiBold" style={styles.statNumber}>{stats.withEmail}</ThemedText>
          <ThemedText style={styles.statLabel}>Emails</ThemedText>
        </View>
        <View style={styles.statCard}>
          <IconSymbol name="rectangle.3.group" size={20} color={Colors[colorScheme ?? 'light'].tint} />
          <ThemedText type="defaultSemiBold" style={styles.statNumber}>{stats.classes}</ThemedText>
          <ThemedText style={styles.statLabel}>Classes</ThemedText>
        </View>
      </ThemedView>

      {error && (
        <ThemedView style={styles.errorBanner}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </ThemedView>
      )}

      {isAdding && (
        <ThemedView style={styles.addForm}>
          <ThemedText type="subtitle" style={styles.formTitle}>Add New Student</ThemedText>
          
          <TextInput
            style={[styles.input, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}
            placeholder="Name *"
            placeholderTextColor={colorScheme === 'dark' ? '#888' : '#666'}
            value={newStudent.name}
            onChangeText={(text) => setNewStudent({ ...newStudent, name: text })}
          />
          
          <TextInput
            style={[styles.input, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}
            placeholder="Roll Number *"
            placeholderTextColor={colorScheme === 'dark' ? '#888' : '#666'}
            value={newStudent.rollNumber}
            onChangeText={(text) => setNewStudent({ ...newStudent, rollNumber: text })}
          />
          
          <TextInput
            style={[styles.input, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}
            placeholder="Email"
            placeholderTextColor={colorScheme === 'dark' ? '#888' : '#666'}
            value={newStudent.email}
            keyboardType="email-address"
            onChangeText={(text) => setNewStudent({ ...newStudent, email: text })}
          />
          
          <TextInput
            style={[styles.input, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}
            placeholder="Class *"
            placeholderTextColor={colorScheme === 'dark' ? '#888' : '#666'}
            value={newStudent.class}
            onChangeText={(text) => setNewStudent({ ...newStudent, class: text })}
          />

          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}
            onPress={handleAddStudent}
            disabled={loading}>
            <ThemedText style={styles.submitButtonText}>
              {loading ? 'Adding...' : 'Add Student'}
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      )}

      <ThemedView style={styles.studentList}>
        <ThemedText type="subtitle" style={styles.listTitle}>
          All Students ({students.length})
        </ThemedText>
        
        {students.map((student) => (
          <ThemedView key={student.id} style={styles.studentCard}>
            <View style={styles.studentInfo}>
              <ThemedText type="defaultSemiBold" style={styles.studentName}>
                {student.name}
              </ThemedText>
              <View style={styles.tagsRow}>
                <View style={styles.chip}>
                  <IconSymbol name="number" size={14} color={Colors[colorScheme ?? 'light'].tint} />
                  <ThemedText style={styles.chipText}>{student.rollNumber}</ThemedText>
                </View>
                <View style={styles.chip}>
                  <IconSymbol name="graduationcap.fill" size={14} color={Colors[colorScheme ?? 'light'].tint} />
                  <ThemedText style={styles.chipText}>{student.class || 'Class'}</ThemedText>
                </View>
                {student.email && (
                  <View style={styles.chipMuted}>
                    <IconSymbol name="envelope" size={14} color="#64748b" />
                    <ThemedText style={styles.chipMutedText} numberOfLines={1}>{student.email}</ThemedText>
                  </View>
                )}
              </View>
            </View>
            <TouchableOpacity
              onPress={() => handleDeleteStudent(student.id, student.name)}>
              <IconSymbol name="trash" size={20} color="#ff4444" />
            </TouchableOpacity>
          </ThemedView>
        ))}
      </ThemedView>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    marginTop: 100,
  },
  accessDeniedTitle: {
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  accessDeniedText: {
    textAlign: 'center',
    fontSize: 16,
    opacity: 0.8,
    lineHeight: 24,
    marginBottom: 16,
  },
  accessDeniedHint: {
    textAlign: 'center',
    fontSize: 14,
    opacity: 0.6,
    fontStyle: 'italic',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: 50,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 10,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    alignItems: 'flex-start',
    gap: 6,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.65,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addForm: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
    borderLeftWidth: 4,
    borderLeftColor: 'rgba(37, 99, 235, 0.5)',
  },
  formTitle: {
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.2)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  submitButton: {
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  studentList: {
    marginBottom: 20,
  },
  listTitle: {
    marginBottom: 16,
  },
  studentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    marginBottom: 4,
  },
  studentDetails: {
    fontSize: 13,
    opacity: 0.7,
    marginBottom: 2,
  },
  studentEmail: {
    fontSize: 12,
    opacity: 0.6,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chipMuted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(100, 116, 139, 0.12)',
    maxWidth: '100%',
  },
  chipMutedText: {
    fontSize: 12,
    opacity: 0.8,
    maxWidth: 160,
  },
  errorBanner: {
    backgroundColor: '#ff444420',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 14,
  },
});
