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
import { useAuth } from '@/context/AuthContext';

const API_BASE_URL = 'http://localhost:5000/api';

interface Period {
  periodNumber: number;
  subject: string;
  teacherId?: string | Teacher;
  startTime: string;
  endTime: string;
  room?: string;
  isLab: boolean;
}

interface Teacher {
  _id: string;
  name: string;
  email: string;
}

interface Timetable {
  _id: string;
  classId: {
    _id: string;
    name: string;
    semester?: string;
  };
  section?: string;
  dayOfWeek: string;
  periods: Period[];
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
}

interface ClassOption {
  _id: string;
  name: string;
  semester?: string;
}

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export default function TimetableManagementScreen() {
  const colorScheme = useColorScheme();
  const { token, user } = useAuth();
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    classId: '',
    section: '',
    dayOfWeek: 'monday',
    periods: [
      {
        periodNumber: 1,
        subject: '',
        startTime: '09:00',
        endTime: '10:00',
        room: '',
        isLab: false,
      },
    ],
  });

  useEffect(() => {
    fetchClasses();
    fetchTimetables();
  }, [token]);

  const fetchClasses = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/classes`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch classes');

      const result = await response.json();
      setClasses(result.data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load classes');
    }
  };

  const fetchTimetables = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/admin/timetables`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch timetables');

      const result = await response.json();
      setTimetables(result.data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load timetables');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPeriod = () => {
    const lastPeriod = formData.periods[formData.periods.length - 1];
    const newPeriodNumber = lastPeriod.periodNumber + 1;
    const [hours, minutes] = lastPeriod.endTime.split(':');
    const newStartTime = `${hours}:${minutes}`;
    const newEndHour = String(Number(hours) + 1).padStart(2, '0');
    const newEndTime = `${newEndHour}:${minutes}`;

    setFormData({
      ...formData,
      periods: [
        ...formData.periods,
        {
          periodNumber: newPeriodNumber,
          subject: '',
          startTime: newStartTime,
          endTime: newEndTime,
          room: '',
          isLab: false,
        },
      ],
    });
  };

  const handleRemovePeriod = (index: number) => {
    if (formData.periods.length === 1) {
      Alert.alert('Error', 'At least one period is required');
      return;
    }
    const newPeriods = formData.periods.filter((_, i) => i !== index);
    setFormData({ ...formData, periods: newPeriods });
  };

  const handleUpdatePeriod = (index: number, field: string, value: any) => {
    const newPeriods = [...formData.periods];
    newPeriods[index] = { ...newPeriods[index], [field]: value };
    setFormData({ ...formData, periods: newPeriods });
  };

  const handleSubmit = async () => {
    if (!formData.classId || !formData.dayOfWeek) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const invalidPeriod = formData.periods.find((p) => !p.subject || !p.startTime || !p.endTime);
    if (invalidPeriod) {
      Alert.alert('Error', 'All periods must have subject, start time, and end time');
      return;
    }

    try {
      const url = editingId
        ? `${API_BASE_URL}/admin/timetables/${editingId}`
        : `${API_BASE_URL}/admin/timetables`;
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save timetable');
      }

      Alert.alert('Success', `Timetable ${editingId ? 'updated' : 'created'} successfully`);
      resetForm();
      await fetchTimetables();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save timetable');
    }
  };

  const handleEdit = (timetable: Timetable) => {
    setEditingId(timetable._id);
    setFormData({
      classId: timetable.classId._id,
      section: timetable.section || '',
      dayOfWeek: timetable.dayOfWeek,
      periods: timetable.periods.map((p) => ({
        periodNumber: p.periodNumber,
        subject: p.subject,
        startTime: p.startTime,
        endTime: p.endTime,
        room: p.room || '',
        isLab: p.isLab,
      })),
    });
    setShowForm(true);
  };

  const handleDelete = (id: string, className: string, day: string) => {
    Alert.alert('Delete Timetable', `Delete timetable for ${className} - ${day}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const response = await fetch(`${API_BASE_URL}/admin/timetables/${id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            });

            if (!response.ok) throw new Error('Failed to delete timetable');

            Alert.alert('Success', 'Timetable deleted successfully');
            await fetchTimetables();
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to delete timetable');
          }
        },
      },
    ]);
  };

  const resetForm = () => {
    setFormData({
      classId: '',
      section: '',
      dayOfWeek: 'monday',
      periods: [
        {
          periodNumber: 1,
          subject: '',
          startTime: '09:00',
          endTime: '10:00',
          room: '',
          isLab: false,
        },
      ],
    });
    setEditingId(null);
    setShowForm(false);
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
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <ThemedText type="title">Timetable Management</ThemedText>
          <ThemedText style={styles.subtitle}>Total: {timetables.length} timetables</ThemedText>
        </View>

        {showForm ? (
          <View style={[styles.formContainer, styles.cardShadow]}>
            <ThemedText type="defaultSemiBold" style={styles.formTitle}>
              {editingId ? 'Edit' : 'Create'} Timetable
            </ThemedText>

            {/* Class Selection */}
            <ThemedText style={styles.label}>Class *</ThemedText>
            <ScrollView horizontal style={styles.optionScroll}>
              {classes.map((cls) => (
                <TouchableOpacity
                  key={cls._id}
                  style={[
                    styles.optionButton,
                    formData.classId === cls._id && styles.optionButtonActive,
                  ]}
                  onPress={() => setFormData({ ...formData, classId: cls._id })}>
                  <ThemedText
                    style={[
                      styles.optionButtonText,
                      formData.classId === cls._id && styles.optionButtonTextActive,
                    ]}>
                    {cls.name}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Section */}
            <TextInput
              style={styles.input}
              placeholder="Section (optional)"
              placeholderTextColor="#999"
              value={formData.section}
              onChangeText={(text) => setFormData({ ...formData, section: text })}
            />

            {/* Day of Week */}
            <ThemedText style={styles.label}>Day of Week *</ThemedText>
            <ScrollView horizontal style={styles.optionScroll}>
              {DAYS_OF_WEEK.map((day) => (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.optionButton,
                    formData.dayOfWeek === day && styles.optionButtonActive,
                  ]}
                  onPress={() => setFormData({ ...formData, dayOfWeek: day })}>
                  <ThemedText
                    style={[
                      styles.optionButtonText,
                      formData.dayOfWeek === day && styles.optionButtonTextActive,
                    ]}>
                    {day.charAt(0).toUpperCase() + day.slice(1)}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Periods */}
            <ThemedText style={styles.label}>Periods *</ThemedText>
            {formData.periods.map((period, index) => (
              <View key={index} style={styles.periodCard}>
                <View style={styles.periodHeader}>
                  <ThemedText type="defaultSemiBold" style={styles.periodNumber}>
                    Period {period.periodNumber}
                  </ThemedText>
                  {formData.periods.length > 1 && (
                    <TouchableOpacity onPress={() => handleRemovePeriod(index)}>
                      <ThemedText style={styles.removeButton}>✕</ThemedText>
                    </TouchableOpacity>
                  )}
                </View>

                <TextInput
                  style={styles.input}
                  placeholder="Subject *"
                  placeholderTextColor="#999"
                  value={period.subject}
                  onChangeText={(text) => handleUpdatePeriod(index, 'subject', text)}
                />

                <View style={styles.timeRow}>
                  <View style={styles.timeInput}>
                    <ThemedText style={styles.timeLabel}>Start Time</ThemedText>
                    <TextInput
                      style={styles.input}
                      placeholder="HH:MM"
                      placeholderTextColor="#999"
                      value={period.startTime}
                      onChangeText={(text) => handleUpdatePeriod(index, 'startTime', text)}
                    />
                  </View>
                  <View style={styles.timeInput}>
                    <ThemedText style={styles.timeLabel}>End Time</ThemedText>
                    <TextInput
                      style={styles.input}
                      placeholder="HH:MM"
                      placeholderTextColor="#999"
                      value={period.endTime}
                      onChangeText={(text) => handleUpdatePeriod(index, 'endTime', text)}
                    />
                  </View>
                </View>

                <TextInput
                  style={styles.input}
                  placeholder="Room (optional)"
                  placeholderTextColor="#999"
                  value={period.room}
                  onChangeText={(text) => handleUpdatePeriod(index, 'room', text)}
                />

                <TouchableOpacity
                  style={styles.labToggle}
                  onPress={() => handleUpdatePeriod(index, 'isLab', !period.isLab)}>
                  <View
                    style={[styles.checkbox, period.isLab && styles.checkboxChecked]}></View>
                  <ThemedText style={styles.labLabel}>Lab Session</ThemedText>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={styles.addPeriodButton} onPress={handleAddPeriod}>
              <ThemedText style={styles.addPeriodButtonText}>+ Add Period</ThemedText>
            </TouchableOpacity>

            <View style={styles.buttonRow}>
              <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={resetForm}>
                <ThemedText style={styles.buttonText}>Cancel</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.button, styles.createButton]} onPress={handleSubmit}>
                <ThemedText style={[styles.buttonText, { color: '#fff' }]}>
                  {editingId ? 'Update' : 'Create'}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.addButton} onPress={() => setShowForm(true)}>
            <ThemedText style={styles.addButtonText}>+ Create Timetable</ThemedText>
          </TouchableOpacity>
        )}

        {/* Timetables List */}
        <FlatList
          scrollEnabled={false}
          data={timetables}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <View style={[styles.timetableCard, styles.cardShadow]}>
              <View style={styles.timetableHeader}>
                <View>
                  <ThemedText type="defaultSemiBold" style={styles.className}>
                    {item.classId.name}
                    {item.section && ` - ${item.section}`}
                  </ThemedText>
                  <ThemedText style={styles.dayLabel}>
                    {item.dayOfWeek.charAt(0).toUpperCase() + item.dayOfWeek.slice(1)}
                  </ThemedText>
                </View>
                <View
                  style={[
                    styles.activeBadge,
                    { backgroundColor: item.isActive ? '#4caf50' : '#9e9e9e' },
                  ]}>
                  <ThemedText style={styles.activeBadgeText}>
                    {item.isActive ? 'Active' : 'Inactive'}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.periodsContainer}>
                {item.periods.map((period, idx) => (
                  <View key={idx} style={styles.periodRow}>
                    <ThemedText style={styles.periodInfo}>
                      P{period.periodNumber}: {period.subject}
                    </ThemedText>
                    <ThemedText style={styles.periodTime}>
                      {period.startTime} - {period.endTime}
                    </ThemedText>
                    {period.room && (
                      <ThemedText style={styles.periodRoom}>Room: {period.room}</ThemedText>
                    )}
                    {period.isLab && (
                      <View style={styles.labBadge}>
                        <ThemedText style={styles.labBadgeText}>LAB</ThemedText>
                      </View>
                    )}
                  </View>
                ))}
              </View>

              <View style={styles.timetableActions}>
                <TouchableOpacity style={styles.editButton} onPress={() => handleEdit(item)}>
                  <ThemedText style={styles.editButtonText}>Edit</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDelete(item._id, item.classId.name, item.dayOfWeek)}>
                  <ThemedText style={styles.deleteButtonText}>Delete</ThemedText>
                </TouchableOpacity>
              </View>
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
    backgroundColor: '#f7f8fa',
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
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
  },
  formTitle: {
    fontSize: 16,
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 8,
    opacity: 0.7,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    fontSize: 14,
    backgroundColor: '#f9fafb',
  },
  optionScroll: {
    marginBottom: 12,
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  optionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 8,
  },
  optionButtonActive: {
    backgroundColor: '#2196f3',
    borderColor: '#2196f3',
  },
  optionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  optionButtonTextActive: {
    color: '#fff',
  },
  periodCard: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  periodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  periodNumber: {
    fontSize: 14,
  },
  removeButton: {
    fontSize: 20,
    color: '#f44336',
    fontWeight: 'bold',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeInput: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
    opacity: 0.7,
  },
  labToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#2196f3',
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: '#2196f3',
  },
  labLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  addPeriodButton: {
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  addPeriodButtonText: {
    color: '#2196f3',
    fontWeight: '600',
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
    backgroundColor: '#2196f3',
  },
  buttonText: {
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#2196f3',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  timetableCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
  },
  timetableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  className: {
    fontSize: 16,
    marginBottom: 4,
  },
  dayLabel: {
    fontSize: 13,
    opacity: 0.7,
  },
  activeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  periodsContainer: {
    marginBottom: 12,
  },
  periodRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  periodInfo: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  periodTime: {
    fontSize: 12,
    opacity: 0.7,
  },
  periodRoom: {
    fontSize: 11,
    opacity: 0.6,
    marginTop: 2,
  },
  labBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ff9800',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  labBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  timetableActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
  },
  editButtonText: {
    color: '#2196f3',
    fontWeight: '600',
    fontSize: 13,
  },
  deleteButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#ffebee',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#f44336',
    fontWeight: '600',
    fontSize: 13,
  },
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
});
