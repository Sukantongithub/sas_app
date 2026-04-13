import { useState } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, View, Alert, RefreshControl, Modal, TextInput, ScrollView } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAttendance } from '@/context/AttendanceContext';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import CommonHeader from '@/components/CommonHeader';

export default function MarkAttendanceScreen() {
  const colorScheme = useColorScheme();
  const { students, markAttendance, getTodayAttendance, error, refreshStudents } = useAttendance();
  const [selectedStatus, setSelectedStatus] = useState<Record<string, 'present' | 'absent' | 'late'>>({});
  const [marking, setMarking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualStudentName, setManualStudentName] = useState('');
  const [manualStudentRoll, setManualStudentRoll] = useState('');
  const [manualStudentClass, setManualStudentClass] = useState('');
  const [manualStatus, setManualStatus] = useState<'present' | 'absent' | 'late'>('present');
  const [manualRecords, setManualRecords] = useState<Array<{id: string, name: string, rollNumber: string, class: string, status: 'present' | 'absent' | 'late'}>>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);

  const normalizeId = (value: any) => String(value || '').trim();
  const normalizeClass = (value: any) => String(value || '').trim().toLowerCase();
  
  const todayAttendance = getTodayAttendance();
  const markedStudentIds = new Set(todayAttendance.map(record => record.studentId));

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshStudents();
    } catch (err) {
      console.error('Error refreshing students:', err);
    }
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleAddManualStudent = async () => {
    if (!manualStudentName.trim() || !manualStudentRoll.trim()) {
      Alert.alert('Error', 'Please fill in name and roll number');
      return;
    }

    const newRecord = {
      id: `manual_${Date.now()}`,
      name: manualStudentName,
      rollNumber: manualStudentRoll,
      class: manualStudentClass || 'Unknown',
      status: manualStatus
    };

    setManualRecords([...manualRecords, newRecord]);
    
    // Try to mark in backend
    try {
      await markAttendance(newRecord.id, manualStatus);
      Alert.alert('Success', `${manualStudentName} marked as ${manualStatus}`);
    } catch (err) {
      // Already recorded locally
      Alert.alert('Recorded Locally', 'Attendance saved locally (backend may be unavailable)');
    }

    // Reset form
    setManualStudentName('');
    setManualStudentRoll('');
    setManualStudentClass('');
    setManualStatus('present');
  };

  const handleMarkManualAttendance = async (recordId: string, newStatus: 'present' | 'absent' | 'late') => {
    setManualRecords(prev => prev.map(r => r.id === recordId ? {...r, status: newStatus} : r));
    try {
      await markAttendance(recordId, newStatus);
    } catch (err) {
      console.error('Error marking attendance:', err);
    }
  };

  const handleMarkAttendance = async (studentId: string, status: 'present' | 'absent' | 'late') => {
    const normalizedStudentId = normalizeId(studentId);
    if (!normalizedStudentId) {
      Alert.alert('Error', 'Invalid student ID. Please refresh and try again.');
      return;
    }

    try {
      setMarking(true);
      setSelectedStatus(prev => ({ ...prev, [normalizedStudentId]: status }));
      await markAttendance(normalizedStudentId, status);
    } catch (err) {
      Alert.alert('Error', 'Failed to mark attendance');
    } finally {
      setMarking(false);
    }
  };

  const getStatusForStudent = (studentId: string): 'present' | 'absent' | 'late' | null => {
    const record = todayAttendance.find(r => r.studentId === studentId);
    return record ? record.status : null;
  };

  const markAllPresent = () => {
    Alert.alert(
      'Mark All Present',
      'Are you sure you want to mark all students as present?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark All',
          onPress: async () => {
            try {
              setMarking(true);
              for (const student of apiStudentsForClass) {
                const studentId = normalizeId((student as any).id || (student as any)._id);
                if (studentId) {
                  await handleMarkAttendance(studentId, 'present');
                }
              }
              Alert.alert('Success', 'All students in selected class marked as present');
            } catch (err) {
              Alert.alert('Error', 'Failed to mark all students');
            } finally {
              setMarking(false);
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return '#4CAF50';
      case 'absent':
        return '#F44336';
      case 'late':
        return '#FF9800';
      default:
        return Colors[colorScheme ?? 'light'].tint;
    }
  };

  const availableClasses = [...new Set(
    students
      .map((student: any) => String(student?.class || '').trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  const apiStudentsForClass = selectedClass
    ? students.filter((student: any) => normalizeClass(student?.class) === normalizeClass(selectedClass))
    : [];

  const manualRecordsForClass = selectedClass
    ? manualRecords.filter((record) => normalizeClass(record.class) === normalizeClass(selectedClass))
    : [];

  const stats = {
    total: apiStudentsForClass.length + manualRecordsForClass.length,
    present: todayAttendance.filter(r => r.status === 'present' && apiStudentsForClass.some(s => normalizeId((s as any).id || (s as any)._id) === normalizeId(r.studentId))).length + manualRecordsForClass.filter(r => r.status === 'present').length,
    absent: todayAttendance.filter(r => r.status === 'absent' && apiStudentsForClass.some(s => normalizeId((s as any).id || (s as any)._id) === normalizeId(r.studentId))).length + manualRecordsForClass.filter(r => r.status === 'absent').length,
    late: todayAttendance.filter(r => r.status === 'late' && apiStudentsForClass.some(s => normalizeId((s as any).id || (s as any)._id) === normalizeId(r.studentId))).length + manualRecordsForClass.filter(r => r.status === 'late').length,
  };

  // Combine students from API and manual entries
  const displayStudents = [
    ...apiStudentsForClass,
    ...manualRecordsForClass.map(r => ({...r, _id: r.id}))
  ];

  return (
    <ThemedView style={styles.container}>
      <CommonHeader title="Mark Attendance" />

      {selectedClass && (
        <View style={styles.statsRow}>
          <View style={styles.statBadge}>
            <ThemedText style={styles.statNumber}>{stats.total}</ThemedText>
            <ThemedText style={styles.statLabel}>Total</ThemedText>
          </View>
          <View style={[styles.statBadge, { backgroundColor: 'rgba(76, 175, 80, 0.15)' }]}> 
            <ThemedText style={[styles.statNumber, { color: '#4CAF50' }]}>{stats.present}</ThemedText>
            <ThemedText style={styles.statLabel}>Present</ThemedText>
          </View>
          <View style={[styles.statBadge, { backgroundColor: 'rgba(244, 67, 54, 0.15)' }]}> 
            <ThemedText style={[styles.statNumber, { color: '#F44336' }]}>{stats.absent}</ThemedText>
            <ThemedText style={styles.statLabel}>Absent</ThemedText>
          </View>
          <View style={[styles.statBadge, { backgroundColor: 'rgba(255, 152, 0, 0.15)' }]}> 
            <ThemedText style={[styles.statNumber, { color: '#FF9800' }]}>{stats.late}</ThemedText>
            <ThemedText style={styles.statLabel}>Late</ThemedText>
          </View>
        </View>
      )}

      {error && (
        <ThemedView style={styles.errorBanner}>
          <IconSymbol name="exclamationmark.circle.fill" size={18} color="#ff4444" />
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.errorText}>{error}</ThemedText>
            <TouchableOpacity onPress={onRefresh} style={styles.retryButton}>
              <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
            </TouchableOpacity>
          </View>
        </ThemedView>
      )}

      {selectedClass && (
        <View style={styles.classFlowHeader}>
          <TouchableOpacity onPress={() => setSelectedClass(null)} style={styles.classBackButton}>
            <IconSymbol name="chevron.left" size={18} color={Colors[colorScheme ?? 'light'].tint} />
            <ThemedText style={styles.classBackText}>Classes</ThemedText>
          </TouchableOpacity>
          <View style={styles.classBadgePill}>
            <ThemedText style={styles.classBadgeText}>{selectedClass}</ThemedText>
          </View>
        </View>
      )}

      {!selectedClass ? (
        <FlatList
          data={availableClasses}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors[colorScheme ?? 'light'].tint}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <IconSymbol name="building.2.crop.circle" size={60} color="#999" />
              <ThemedText style={styles.emptyTitle}>No Classes Assigned</ThemedText>
              <ThemedText style={styles.emptySubtitle}>Assign classes to this staff account to start marking attendance.</ThemedText>
            </View>
          }
          renderItem={({ item }) => {
            const classStudents = students.filter((student: any) => normalizeClass(student?.class) === normalizeClass(item));
            const markedCount = classStudents.filter((student: any) => markedStudentIds.has(normalizeId((student as any).id || (student as any)._id))).length;

            return (
              <TouchableOpacity style={styles.classCard} onPress={() => setSelectedClass(item)}>
                <View style={{ flex: 1 }}>
                  <ThemedText type="defaultSemiBold" style={styles.classCardTitle}>{item}</ThemedText>
                  <ThemedText style={styles.classCardMeta}>{classStudents.length} students</ThemedText>
                </View>
                <View style={styles.classCardRight}>
                  <ThemedText style={styles.classCardMarked}>{markedCount}/{classStudents.length}</ThemedText>
                  <IconSymbol name="chevron.right" size={16} color="#94a3b8" />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      ) : displayStudents.length === 0 ? (
        // Empty State with Manual Entry Option
        <ScrollView 
          style={{ flex: 1 }} 
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              tintColor={Colors[colorScheme ?? 'light'].tint}
            />
          }
        >
          <IconSymbol name="person.crop.circle.badge.exclamationmark" size={60} color="#999" />
          <ThemedText style={styles.emptyTitle}>No Students in {selectedClass}</ThemedText>
          <ThemedText style={styles.emptySubtitle}>
            This class has no mapped students. You can still add manual attendance.
          </ThemedText>
          <TouchableOpacity 
            style={styles.manualButton}
            onPress={() => setShowManualModal(true)}
          >
            <IconSymbol name="plus.circle.fill" size={20} color="#fff" />
            <ThemedText style={styles.manualButtonText}>Manual Entry</ThemedText>
          </TouchableOpacity>

          {manualRecords.length > 0 && (
            <View style={styles.manualRecordsSection}>
              <ThemedText style={styles.manualRecordsTitle}>
                Manually Added Records ({manualRecords.length})
              </ThemedText>
              {manualRecords.map(record => (
                <View key={record.id} style={styles.manualRecordCard}>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.manualRecordName}>{record.name}</ThemedText>
                    <ThemedText style={styles.manualRecordDetails}>
                      {record.rollNumber} • {record.class}
                    </ThemedText>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(record.status) }]}>
                    <ThemedText style={styles.statusBadgeText}>
                      {record.status?.charAt(0).toUpperCase()}{record.status?.slice(1)}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      ) : (
        // Student List from API
        <FlatList
          data={displayStudents}
          keyExtractor={(item) => {
            const key = normalizeId((item as any).id || (item as any)._id || (item as any).rollNumber);
            return key || `${(item as any).name || 'student'}-${(item as any).class || 'class'}`;
          }}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              tintColor={Colors[colorScheme ?? 'light'].tint}
            />
          }
          ListHeaderComponent={
            displayStudents.length > 0 ? (
              <TouchableOpacity 
                style={styles.markAllButton}
                onPress={markAllPresent}
              >
                <IconSymbol name="checkmark.circle.fill" size={20} color="#fff" />
                <ThemedText style={styles.markAllButtonText}>Mark All Present</ThemedText>
              </TouchableOpacity>
            ) : null
          }
          ListFooterComponent={
            apiStudentsForClass.length === 0 && manualRecordsForClass.length === 0 ? null : (
              <TouchableOpacity 
                style={styles.addManualButton}
                onPress={() => setShowManualModal(true)}
              >
                <IconSymbol name="plus.circle" size={18} color="#0066cc" />
                <ThemedText style={styles.addManualButtonText}>Add Manual Entry</ThemedText>
              </TouchableOpacity>
            )
          }
          renderItem={({ item: student }) => {
            const studentId = normalizeId((student as any).id || (student as any)._id);
            let currentStatus: 'present' | 'absent' | 'late' | null = null;
            
            if (student.status) {
              currentStatus = student.status;
            } else {
              const record = todayAttendance.find(r => normalizeId(r.studentId) === studentId);
              currentStatus = record ? record.status : null;
            }
            
            const isMarked = currentStatus !== null;

            return (
              <ThemedView style={[styles.studentCard, { marginHorizontal: 16 }]}>
                <View style={styles.studentInfo}>
                  <View style={styles.studentHeader}>
                    <View style={{ flex: 1 }}>
                      <ThemedText type="defaultSemiBold" style={styles.studentName}>
                        {student.name}
                      </ThemedText>
                      <ThemedText style={styles.studentDetails}>
                        {student.rollNumber} • {student.class}
                      </ThemedText>
                    </View>
                    {isMarked && (
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(currentStatus) }]}>
                        <ThemedText style={styles.statusBadgeText}>
                          {currentStatus?.charAt(0).toUpperCase()}{currentStatus?.slice(1)}
                        </ThemedText>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.statusButtons}>
                  <TouchableOpacity
                    style={[
                      styles.statusButton,
                      currentStatus === 'present' && styles.statusButtonActive,
                      currentStatus === 'present' && { backgroundColor: '#4CAF50' }
                    ]}
                    onPress={() => {
                      if (student.status !== undefined) {
                        handleMarkManualAttendance(studentId, 'present');
                      } else {
                        handleMarkAttendance(studentId, 'present');
                      }
                    }}>
                    <IconSymbol 
                      name="checkmark" 
                      size={20} 
                      color={currentStatus === 'present' ? '#fff' : '#4CAF50'} 
                    />
                    <ThemedText style={[styles.statusButtonLabel, { color: currentStatus === 'present' ? '#fff' : '#4CAF50' }]}>
                      Present
                    </ThemedText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.statusButton,
                      currentStatus === 'late' && styles.statusButtonActive,
                      currentStatus === 'late' && { backgroundColor: '#FF9800' }
                    ]}
                    onPress={() => {
                      if (student.status !== undefined) {
                        handleMarkManualAttendance(studentId, 'late');
                      } else {
                        handleMarkAttendance(studentId, 'late');
                      }
                    }}>
                    <IconSymbol 
                      name="clock" 
                      size={20} 
                      color={currentStatus === 'late' ? '#fff' : '#FF9800'} 
                    />
                    <ThemedText style={[styles.statusButtonLabel, { color: currentStatus === 'late' ? '#fff' : '#FF9800' }]}>
                      Late
                    </ThemedText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.statusButton,
                      currentStatus === 'absent' && styles.statusButtonActive,
                      currentStatus === 'absent' && { backgroundColor: '#F44336' }
                    ]}
                    onPress={() => {
                      if (student.status !== undefined) {
                        handleMarkManualAttendance(studentId, 'absent');
                      } else {
                        handleMarkAttendance(studentId, 'absent');
                      }
                    }}>
                    <IconSymbol 
                      name="xmark" 
                      size={20} 
                      color={currentStatus === 'absent' ? '#fff' : '#F44336'} 
                    />
                    <ThemedText style={[styles.statusButtonLabel, { color: currentStatus === 'absent' ? '#fff' : '#F44336' }]}>
                      Absent
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              </ThemedView>
            );
          }}
        />
      )}

      {/* Manual Entry Modal */}
      <Modal
        visible={showManualModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowManualModal(false)}
      >
        <ThemedView style={styles.modalOverlay}>
          <ThemedView style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Add Manual Attendance</ThemedText>
              <TouchableOpacity onPress={() => setShowManualModal(false)}>
                <IconSymbol name="xmark" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Student Name *</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Enter student name"
                  value={manualStudentName}
                  onChangeText={setManualStudentName}
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Roll Number *</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Enter roll number"
                  value={manualStudentRoll}
                  onChangeText={setManualStudentRoll}
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Class/Section</ThemedText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Enter class"
                  value={manualStudentClass}
                  onChangeText={setManualStudentClass}
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={styles.formLabel}>Attendance Status</ThemedText>
                <View style={styles.statusButtonsGroup}>
                  {(['present', 'late', 'absent'] as const).map((status) => (
                    <TouchableOpacity
                      key={status}
                      style={[
                        styles.statusButtonGroup,
                        manualStatus === status && { backgroundColor: getStatusColor(status) }
                      ]}
                      onPress={() => setManualStatus(status)}
                    >
                      <ThemedText style={[
                        styles.statusButtonGroupText,
                        manualStatus === status && { color: '#fff' }
                      ]}>
                        {status.charAt(0).toUpperCase()}{status.slice(1)}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowManualModal(false)}
              >
                <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleAddManualStudent}
              >
                <ThemedText style={styles.submitButtonText}>Add & Mark</ThemedText>
              </TouchableOpacity>
            </View>
          </ThemedView>
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  progressHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  progressTitle: {
    marginBottom: 4,
  },
  progressDate: {
    fontSize: 13,
    opacity: 0.6,
  },
  progressBarContainer: {
    gap: 8,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressBarLabel: {
    fontSize: 12,
    opacity: 0.7,
    fontWeight: '500',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    fontSize: 13,
    opacity: 0.7,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  classFlowHeader: {
    marginHorizontal: 16,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  classBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(128, 128, 128, 0.12)',
  },
  classBackText: {
    fontSize: 13,
    fontWeight: '600',
  },
  classBadgePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 102, 204, 0.15)',
  },
  classBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0066cc',
  },
  classCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  classCardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  classCardMeta: {
    fontSize: 12,
    opacity: 0.65,
    marginTop: 2,
  },
  classCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  classCardMarked: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4CAF50',
  },
  statBadge: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
    opacity: 0.7,
    marginTop: 2,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 20,
  },
  studentCard: {
    marginBottom: 10,
    marginTop: 2,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  studentInfo: {
    marginBottom: 10,
  },
  studentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  studentName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  studentDetails: {
    fontSize: 12,
    opacity: 0.6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  markAllButton: {
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  markAllButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  statusButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  statusButton: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    flexDirection: 'row',
    gap: 4,
  },
  statusButtonActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  statusButtonLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  errorBanner: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 13,
    flex: 1,
  },
  retryButton: {
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 68, 68, 0.2)',
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  retryButtonText: {
    color: '#ff4444',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 100,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
    marginBottom: 24,
  },
  manualButton: {
    flexDirection: 'row',
    backgroundColor: '#0066cc',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    gap: 10,
    marginBottom: 30,
  },
  manualButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  addManualButton: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#0066cc',
    backgroundColor: 'rgba(0, 102, 204, 0.05)',
  },
  addManualButtonText: {
    color: '#0066cc',
    fontWeight: '600',
    fontSize: 14,
  },
  manualRecordsSection: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  manualRecordsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  manualRecordCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
    alignItems: 'center',
  },
  manualRecordName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  manualRecordDetails: {
    fontSize: 12,
    opacity: 0.6,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: '80%',
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.1)',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalBody: {
    padding: 16,
    flex: 1,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.1)',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(128, 128, 128, 0.15)',
  },
  cancelButtonText: {
    fontWeight: '600',
    fontSize: 14,
  },
  submitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#0066cc',
  },
  submitButtonText: {
    fontWeight: '600',
    fontSize: 14,
    color: '#fff',
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  formInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.3)',
    fontSize: 14,
    color: '#333',
  },
  statusButtonsGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  statusButtonGroup: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.3)',
    alignItems: 'center',
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
  },
  statusButtonGroupText: {
    fontWeight: '600',
    fontSize: 13,
  },
  markAllButton: {
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4CAF50',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  markAllButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
