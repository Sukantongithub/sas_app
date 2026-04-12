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
  Text,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';
import AdminHeader from './AdminHeader';

import { API_BASE_URL } from '@/config/apiConfig';

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
  const [submitting, setSubmitting] = useState(false);
  const [deletingPeriodKey, setDeletingPeriodKey] = useState<string | null>(null);
  const [deletingTimetableId, setDeletingTimetableId] = useState<string | null>(null);
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
    // Validate last period before adding new one
    const lastPeriod = formData.periods[formData.periods.length - 1];
    
    if (!lastPeriod.subject?.trim()) {
      Alert.alert('Error', 'Please fill in subject for the previous period before adding a new one');
      return;
    }

    if (!lastPeriod.startTime || !lastPeriod.endTime) {
      Alert.alert('Error', 'Please fill in times for the previous period before adding a new one');
      return;
    }

    // FIX: Use Math.max to handle gaps in period numbers
    const maxPeriodNumber = formData.periods.length > 0 
      ? Math.max(...formData.periods.map(p => p.periodNumber))
      : 0;
    const newPeriodNumber = maxPeriodNumber + 1;
    
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

  const handleRemovePeriod = async (index: number) => {
    try {
      console.log('[handleRemovePeriod] Starting - index:', index, 'editingId:', editingId, 'total periods:', formData.periods.length);
      
      if (index < 0 || index >= formData.periods.length) {
        console.error('[handleRemovePeriod] Invalid index:', index);
        Alert.alert('Error', 'Invalid period index');
        return;
      }

      // If trying to delete the last period
      if (formData.periods.length === 1) {
        console.log('[handleRemovePeriod] Attempting to delete last period - editingId:', editingId);
        
        // If editing an existing timetable, offer to delete entire timetable
        if (editingId) {
          Alert.alert(
            'Delete Last Period',
            'This is the only period in this timetable. Would you like to delete the entire timetable instead?',
            [
              {
                text: 'Cancel',
                style: 'cancel'
              },
              {
                text: 'Delete Entire Timetable',
                style: 'destructive',
                onPress: async () => {
                  // IMPORTANT: Capture editingId BEFORE calling resetForm
                  const timetableIdToDelete = editingId;
                  console.log('[handleRemovePeriod] User wants to delete entire timetable:', timetableIdToDelete);
                  
                  // Call delete (it will show its own confirmation + handle the delete)
                  // Don't reset form yet - let delete handle that
                  handleDelete(timetableIdToDelete, '', '');
                }
              }
            ]
          );
          return;
        } else {
          // For new timetables, still require at least 1 period
          Alert.alert('Error', 'A timetable must have at least one period. Delete the entire timetable from the list if you want to remove it.');
          return;
        }
      }

      const removedPeriod = formData.periods[index];
      const periodNumber = removedPeriod.periodNumber;
      const requestKey = `${editingId}-${periodNumber}`;

      // DEBOUNCE: Prevent multiple concurrent delete requests for same period
      if (deletingPeriodKey === requestKey) {
        console.log('[handleRemovePeriod] Delete already in progress for this period');
        Alert.alert('Info', 'Delete is already in progress for this period');
        return;
      }

      console.log('[handleRemovePeriod] Removing period:', {
        index,
        periodNumber,
        subject: removedPeriod.subject,
        willCallBackend: !!editingId
      });

      // If editing existing timetable, delete from backend immediately
      if (editingId) {
        if (!token) {
          console.error('[handleRemovePeriod] No token available');
          Alert.alert('Error', 'Authentication required. Please log in again.');
          return;
        }
        
        // Set loading state - FIXES: No loading feedback issue
        setDeletingPeriodKey(requestKey);
        
        console.log('[handleRemovePeriod] Calling backend DELETE endpoint...', {
          timetableId: editingId,
          periodNumber,
          url: `${API_BASE_URL}/admin/timetables/${editingId}/periods/${periodNumber}`
        });
        try {
          const response = await fetch(`${API_BASE_URL}/admin/timetables/${editingId}/periods/${periodNumber}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          const result = await response.json();
          console.log('[handleRemovePeriod] Backend response:', result);

          if (!response.ok) {
            throw new Error(result.message || `Failed to delete period ${periodNumber}`);
          }

          console.log(`[handleRemovePeriod] Period ${periodNumber} deleted from backend`);
          
          // Update local state to match backend response
          if (result.data && result.data.periods) {
            setFormData({
              ...formData,
              periods: result.data.periods
            });
            console.log('[handleRemovePeriod] Local state updated with backend response');
          } else {
            // Manual local update if backend doesn't return full timetable
            const newPeriods = formData.periods
              .filter((_, i) => i !== index)
              .map((period, newIndex) => ({
                ...period,
                periodNumber: newIndex + 1,
              }));
            setFormData({ ...formData, periods: newPeriods });
          }

          Alert.alert('Success', `Period ${periodNumber} deleted successfully`);
        } catch (error: any) {
          console.error('[handleRemovePeriod] Backend error:', error);
          Alert.alert('Error', error.message || 'Failed to delete period from server');
          return; // Don't update local state if backend call fails
        } finally {
          // Clear loading state
          setDeletingPeriodKey(null);
        }
      } else {
        // For new timetables (not yet saved), just update local state
        console.log('[handleRemovePeriod] New timetable - updating local state only');
        
        const newPeriods = formData.periods
          .filter((_, i) => i !== index)
          .map((period, newIndex) => ({
            ...period,
            periodNumber: newIndex + 1,
          }));

        setFormData({ ...formData, periods: newPeriods });
        console.log('[handleRemovePeriod] Local state updated');
      }
    } catch (error) {
      console.error('[handleRemovePeriod] Exception:', error);
      setDeletingPeriodKey(null);
      Alert.alert('Error', 'Failed to remove period: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleUpdatePeriod = (index: number, field: string, value: any) => {
    const newPeriods = [...formData.periods];
    newPeriods[index] = { ...newPeriods[index], [field]: value };
    setFormData({ ...formData, periods: newPeriods });
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.classId?.trim()) {
      Alert.alert('Error', 'Please select a class');
      return;
    }

    if (!formData.dayOfWeek?.trim()) {
      Alert.alert('Error', 'Please select a day of week');
      return;
    }

    // Validate periods
    if (!formData.periods || formData.periods.length === 0) {
      Alert.alert('Error', 'At least one period is required');
      return;
    }

    // Validate all periods have required fields
    for (let i = 0; i < formData.periods.length; i++) {
      const p = formData.periods[i];
      const periodNum = i + 1;

      if (!p.subject?.trim()) {
        Alert.alert('Error', `Period ${periodNum}: Subject is required`);
        return;
      }

      if (!p.startTime?.trim()) {
        Alert.alert('Error', `Period ${periodNum}: Start time is required`);
        return;
      }

      if (!p.endTime?.trim()) {
        Alert.alert('Error', `Period ${periodNum}: End time is required`);
        return;
      }

      // Validate time format
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(p.startTime)) {
        Alert.alert('Error', `Period ${periodNum}: Invalid start time format. Use HH:MM`);
        return;
      }

      if (!timeRegex.test(p.endTime)) {
        Alert.alert('Error', `Period ${periodNum}: Invalid end time format. Use HH:MM`);
        return;
      }

      // Validate start time < end time
      const [startH, startM] = p.startTime.split(':').map(Number);
      const [endH, endM] = p.endTime.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      if (startMinutes >= endMinutes) {
        Alert.alert('Error', `Period ${periodNum}: Start time must be before end time`);
        return;
      }
    }

    // Validate period numbers are sequential
    const periodNumbers = formData.periods.map((p, idx) => idx + 1); // Should be [1, 2, 3, ...]
    for (let i = 0; i < periodNumbers.length; i++) {
      if (periodNumbers[i] !== i + 1) {
        Alert.alert('Error', 'Period numbers must be sequential (1, 2, 3, ...)');
        return;
      }
    }

    setSubmitting(true);
    try {
      const url = editingId
        ? `${API_BASE_URL}/admin/timetables/${editingId}`
        : `${API_BASE_URL}/admin/timetables`;
      const method = editingId ? 'PUT' : 'POST';

      // Prepare payload - convert empty strings to undefined for optional fields
      const payload = {
        ...formData,
        section: formData.section?.trim() || undefined,
        periods: formData.periods.map((p) => ({
          periodNumber: p.periodNumber,
          subject: p.subject?.trim() || '',
          startTime: p.startTime?.trim() || '',
          endTime: p.endTime?.trim() || '',
          room: p.room?.trim() || undefined,
          isLab: Boolean(p.isLab),
        })),
      };

      console.log('[TimetableSubmit]', { url, method, payload });

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      console.log('[TimetableResponse]', { status: response.status, result });

      if (!response.ok) {
        // Handle validation errors specially
        if (result.errors && Array.isArray(result.errors)) {
          const errorMessages = result.errors.map((e: any) => e.message).join('\n');
          throw new Error(errorMessages);
        }
        throw new Error(result.message || `Failed to ${editingId ? 'update' : 'create'} timetable`);
      }

      Alert.alert('Success', `Timetable ${editingId ? 'updated' : 'created'} successfully`);
      resetForm();
      await fetchTimetables();
    } catch (error: any) {
      console.error('[TimetableError]', error);
      Alert.alert('Error', error.message || `Failed to ${editingId ? 'update' : 'create'} timetable`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (timetable: Timetable) => {
    // Validate timetable structure
    if (!timetable._id || !timetable.classId?._id || !Array.isArray(timetable.periods)) {
      Alert.alert('Error', 'Invalid timetable data. Please refresh and try again.');
      return;
    }

    // Validate all periods have required fields
    const invalidPeriods = timetable.periods.filter(
      p => !p.periodNumber || !p.subject || !p.startTime || !p.endTime
    );
    if (invalidPeriods.length > 0) {
      Alert.alert('Error', 'Some periods are missing required fields in the database. Please contact support.');
      return;
    }

    try {
      setEditingId(timetable._id);
      setFormData({
        classId: timetable.classId._id,
        section: timetable.section?.trim() || '',
        dayOfWeek: timetable.dayOfWeek,
        periods: timetable.periods.map((p) => ({
          periodNumber: Number(p.periodNumber) || 0,
          subject: String(p.subject || '').trim(),
          startTime: String(p.startTime || '').trim(),
          endTime: String(p.endTime || '').trim(),
          room: String(p.room || '').trim(),
          isLab: Boolean(p.isLab) || false,
        })),
      });
      setShowForm(true);
    } catch (error) {
      console.error('Error preparing edit form:', error);
      Alert.alert('Error', 'Failed to load timetable for editing');
    }
  };

  const handleDelete = (id: string, className?: string, day?: string) => {
    try {
      console.log('[handleDelete] Delete requested for:', { id, className, day });

      if (!id || !id.match(/^[0-9a-f]{24}$/i)) {
        Alert.alert('Error', 'Invalid timetable ID');
        return;
      }

      // If className/day not provided, look it up from timetables list
      let displayName = className;
      let displayDay = day;
      
      if (!displayName || !displayDay) {
        console.log('[handleDelete] ClassNname or day missing, looking up from list...');
        const timetable = timetables.find(t => t._id === id);
        if (timetable) {
          displayName = timetable.classId.name + (timetable.section ? ` - ${timetable.section}` : '');
          displayDay = timetable.dayOfWeek;
          console.log('[handleDelete] Found timetable info:', { displayName, displayDay });
        } else {
          console.warn('[handleDelete] Timetable not found in list for ID:', id);
          displayName = displayName || 'Unknown Class';
          displayDay = displayDay || 'Unknown Day';
        }
      }

      // DEBOUNCE: Prevent multiple concurrent delete requests
      if (deletingTimetableId === id) {
        console.log('[handleDelete] Delete already in progress for this timetable');
        Alert.alert('Info', 'Delete is already in progress for this timetable');
        return;
      }

      Alert.alert(
        'Confirm Delete',
        `Delete timetable for ${displayName} - ${displayDay || 'Unknown'}? This action cannot be undone.`,
        [
          {
            text: 'Cancel',
            onPress: () => {
              console.log('[handleDelete] Deletion cancelled');
            },
            style: 'cancel'
          },
          {
            text: 'Delete',
            onPress: async () => {
              try {
                if (!token) {
                  console.error('[handleDelete] No token available');
                  throw new Error('Authentication required. Please log in again.');
                }
                
                // Set loading state - FIXES: No loading feedback issue
                setDeletingTimetableId(id);
                
                console.log('[handleDelete] Proceeding with deletion for ID:', {
                  id,
                  url: `${API_BASE_URL}/admin/timetables/${id}`,
                  hasToken: !!token
                });

                const response = await fetch(`${API_BASE_URL}/admin/timetables/${id}`, {
                  method: 'DELETE',
                  headers: { 
                    Authorization: `Bearer ${token}`,
                  },
                });

                console.log('[handleDelete] Response status:', response.status);

                let responseData: any;
                try {
                  responseData = await response.json();
                } catch {
                  throw new Error(`Server error: HTTP ${response.status}`);
                }

                if (!response.ok) {
                  // Handle specific error codes
                  let errorMessage = responseData.message || 'Failed to delete timetable';

                  switch (responseData.code) {
                    case 'INVALID_ID':
                      errorMessage = 'Invalid timetable ID format';
                      break;
                    case 'NOT_FOUND':
                      errorMessage = 'Timetable not found. It may have already been deleted.';
                      break;
                    case 'DATABASE_ERROR':
                      errorMessage = 'Database error occurred. Please try again later.';
                      break;
                    case 'DELETE_FAILED':
                      errorMessage = 'Failed to delete timetable. Please try again.';
                      break;
                    default:
                      errorMessage = responseData.message || 'An error occurred';
                  }

                  console.error('[handleDelete] Error response:', {
                    status: response.status,
                    code: responseData.code,
                    message: responseData.message,
                    details: responseData.details
                  });

                  throw new Error(errorMessage);
                }

                console.log('[handleDelete] Deletion response:', responseData);
                Alert.alert('Success', 'Timetable deleted successfully');
                console.log('[handleDelete] Deletion successful, refetching...');
                
                // If the deleted timetable was being edited, reset the form
                if (editingId === id) {
                  console.log('[handleDelete] Deleted timetable was being edited, resetting form...');
                  resetForm();
                  setShowForm(false);
                }
                
                // Refetch the list after a short delay to ensure deletion is persisted
                setTimeout(() => {
                  console.log('[handleDelete] Calling fetchTimetables after delete...');
                  fetchTimetables();
                }, 500);
              } catch (error: any) {
                const errorMsg = error.message || 'Failed to delete timetable';
                console.error('[handleDelete] Error:', {
                  message: errorMsg,
                  name: error.name,
                  fullError: error,
                  stack: error.stack
                });
                Alert.alert('Deletion Failed', `${errorMsg}\n\nPlease try again or refresh the page.`);
              } finally {
                // Clear loading state
                setDeletingTimetableId(null);
                console.log('[handleDelete] Finally block - loading state cleared');
              }
            },
            style: 'destructive'
          }
        ],
        { cancelable: false }
      );
    } catch (error) {
      console.error('[handleDelete] Outer error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
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
      <AdminHeader title="Timetable & Shifts Configuration" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
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
              <View key={`period-${index}`} style={styles.periodCard}>
                <View style={styles.periodHeader}>
                  <ThemedText type="defaultSemiBold" style={styles.periodNumber}>
                    Period {period.periodNumber}
                  </ThemedText>
                  <TouchableOpacity 
                    activeOpacity={0.6}
                    style={[
                      styles.deleteButtonContainer, 
                      styles.deletePeriodButton,
                      deletingPeriodKey === `${editingId}-${period.periodNumber}` && styles.buttonDisabled
                    ]}
                    onPress={() => {
                      console.log('[UI] Delete button pressed for period:', { index, periodNumber: period.periodNumber });
                      handleRemovePeriod(index);
                    }}
                    disabled={deletingPeriodKey === `${editingId}-${period.periodNumber}`}
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                    {deletingPeriodKey === `${editingId}-${period.periodNumber}` ? (
                      <ActivityIndicator size="small" color="#f44336" />
                    ) : (
                      <IconSymbol 
                        name="xmark.circle.fill" 
                        size={32} 
                        color="#f44336" 
                      />
                    )}
                  </TouchableOpacity>
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
              <IconSymbol name="plus.circle.fill" size={18} color={colors.tint} />
              <ThemedText style={[styles.addPeriodButtonText, { color: colors.tint }]}>Add Period</ThemedText>
            </TouchableOpacity>

            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={[styles.button, styles.cancelButton]} 
                onPress={resetForm}
                disabled={submitting}>
                <IconSymbol name="xmark.circle.fill" size={18} color={colors.textSecondary} />
                <ThemedText style={styles.buttonText}>Cancel</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[
                  styles.button, 
                  styles.createButton,
                  submitting && styles.buttonDisabled
                ]} 
                onPress={handleSubmit}
                disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <IconSymbol name="checkmark.circle.fill" size={18} color="#fff" />
                    <ThemedText style={[styles.buttonText, { color: '#fff' }]}>
                      {editingId ? 'Update' : 'Create'}
                    </ThemedText>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.addButton} onPress={() => setShowForm(true)}>
            <IconSymbol name="plus.circle.fill" size={20} color="#fff" />
            <ThemedText style={styles.addButtonText}>Create Timetable</ThemedText>
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
                <TouchableOpacity 
                  style={styles.editButton} 
                  onPress={() => {
                    console.log('[UI] Edit button pressed for timetable:', item._id);
                    handleEdit(item);
                  }}>
                  <ThemedText style={styles.editButtonText}>Edit</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.deleteButton,
                    deletingTimetableId === item._id && styles.buttonDisabled
                  ]}
                  disabled={deletingTimetableId === item._id}
                  onPress={() => {
                    console.log('[UI] Delete button pressed for timetable:', { 
                      id: item._id, 
                      class: item.classId.name, 
                      day: item.dayOfWeek 
                    });
                    handleDelete(item._id, item.classId.name, item.dayOfWeek);
                  }}>
                  {deletingTimetableId === item._id ? (
                    <ActivityIndicator size="small" color="#f44336" />
                  ) : (
                    <ThemedText style={styles.deleteButtonText}>Delete</ThemedText>
                  )}
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
    borderLeftColor: '#2196f3',
  },
  formTitle: {
    fontSize: 16,
    marginBottom: 12,
    fontWeight: '600',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 8,
    opacity: 0.8,
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
    borderColor: Colors.dark.text + '30',
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
    backgroundColor: Colors.dark.text + '08',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.text + '20',
  },
  periodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  periodNumber: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    flexShrink: 1,
  },
  deleteButtonContainer: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deletePeriodButton: {
    padding: 8,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
    minWidth: 44,
    backgroundColor: 'rgba(244, 67, 54, 0.08)',
  },
  removeButton: {
    fontSize: 26,
    color: '#f44336',
    fontWeight: 'bold',
    lineHeight: 28,
    textAlign: 'center',
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
  buttonDisabled: {
    opacity: 0.5,
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
    backgroundColor: Colors.dark.cardBackground,
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
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
