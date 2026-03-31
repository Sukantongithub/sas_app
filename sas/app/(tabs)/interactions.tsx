import { useState, useEffect } from 'react';
import { StyleSheet, FlatList, View, TouchableOpacity, TextInput, Alert, ActivityIndicator, RefreshControl, Modal, DatePickerIOS, Platform, ScrollView } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';
import { studentInteractionsAPI } from '@/services/api';

type InteractionTab = 'leave' | 'absence' | 'eligibility' | 'on-duty';

export default function StudentInteractionsScreen() {
  const colorScheme = useColorScheme();
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState<InteractionTab>('eligibility');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Leave Application State
  const [leaveForm, setLeaveForm] = useState({
    startDate: '',
    endDate: '',
    leaveType: 'casual',
    reason: ''
  });
  const [leaves, setLeaves] = useState<any[]>([]);

  // Absence Reason State
  const [absenceReasons, setAbsenceReasons] = useState<any[]>([]);

  // Exam Eligibility State
  const [eligibility, setEligibility] = useState<any>(null);
  const [lowAttendanceInfo, setLowAttendanceInfo] = useState<any>(null);

  // On-Duty Request State
  const [onDutyForm, setOnDutyForm] = useState({
    startDate: '',
    endDate: '',
    dutyType: 'sports',
    reason: '',
    institution: ''
  });
  const [onDutyRequests, setOnDutyRequests] = useState<any[]>([]);

  // Date Picker State
  const [showLeaveStartDatePicker, setShowLeaveStartDatePicker] = useState(false);
  const [showLeaveEndDatePicker, setShowLeaveEndDatePicker] = useState(false);
  const [showOnDutyStartDatePicker, setShowOnDutyStartDatePicker] = useState(false);
  const [showOnDutyEndDatePicker, setShowOnDutyEndDatePicker] = useState(false);
  const [tempLeaveStartDate, setTempLeaveStartDate] = useState(new Date());
  const [tempLeaveEndDate, setTempLeaveEndDate] = useState(new Date());
  const [tempOnDutyStartDate, setTempOnDutyStartDate] = useState(new Date());
  const [tempOnDutyEndDate, setTempOnDutyEndDate] = useState(new Date());

  const studentId = user?.studentId || user?.id;

  // Helper function to format date for display
  const formatDateForDisplay = (dateString: string) => {
    if (!dateString) return 'Select Date';
    try {
      const date = new Date(dateString + 'T00:00:00');
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateString;
    }
  };

  // Helper function to format date for API (YYYY-MM-DD)
  const formatDateForAPI = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Component for rendering date picker based on platform
  const DatePickerModal = ({ 
    visible, 
    onClose, 
    onDateSelect, 
    tempDate, 
    setTempDate, 
    title 
  }: any) => {
    if (Platform.OS === 'web') {
      return (
        <Modal
          transparent
          animationType="fade"
          visible={visible}
          onRequestClose={onClose}>
          <View style={styles.datePickerContainer}>
            <View style={[styles.datePickerHeader, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}>
              <TouchableOpacity onPress={onClose}>
                <ThemedText style={styles.datePickerHeaderButton}>Cancel</ThemedText>
              </TouchableOpacity>
              <ThemedText style={styles.datePickerTitle}>{title}</ThemedText>
              <TouchableOpacity
                onPress={() => {
                  onDateSelect(formatDateForAPI(tempDate));
                  onClose();
                }}>
                <ThemedText style={[styles.datePickerHeaderButton, { color: Colors[colorScheme ?? 'light'].tint }]}>Done</ThemedText>
              </TouchableOpacity>
            </View>
            <View style={styles.webDatePickerContent}>
              <ThemedText style={styles.webDatePickerLabel}>Select a date:</ThemedText>
              <input
                type="date"
                value={formatDateForAPI(tempDate)}
                onChange={(e: any) => {
                  if (e.target.value) {
                    const [year, month, day] = e.target.value.split('-');
                    const newDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                    setTempDate(newDate);
                  }
                }}
                style={{
                  fontSize: 18,
                  padding: '12px 16px',
                  borderWidth: 2,
                  borderColor: Colors[colorScheme ?? 'light'].tint,
                  borderRadius: 8,
                  marginHorizontal: 20,
                  marginVertical: 20,
                  textAlign: 'center',
                  fontFamily: 'inherit',
                  backgroundColor: Colors[colorScheme ?? 'light'].background,
                  color: Colors[colorScheme ?? 'light'].text,
                  cursor: 'pointer',
                } as any}
              />
            </View>
          </View>
        </Modal>
      );
    }

    // Native date picker
    return (
      <Modal
        transparent
        animationType="slide"
        visible={visible}
        onRequestClose={onClose}>
        <View style={styles.datePickerContainer}>
          <View style={styles.datePickerHeader}>
            <TouchableOpacity onPress={onClose}>
              <ThemedText style={styles.datePickerHeaderButton}>Cancel</ThemedText>
            </TouchableOpacity>
            <ThemedText style={styles.datePickerTitle}>{title}</ThemedText>
            <TouchableOpacity
              onPress={() => {
                onDateSelect(formatDateForAPI(tempDate));
                onClose();
              }}>
              <ThemedText style={[styles.datePickerHeaderButton, { color: Colors[colorScheme ?? 'light'].tint }]}>Done</ThemedText>
            </TouchableOpacity>
          </View>
          <DatePickerIOS
            date={tempDate}
            onDateChange={setTempDate}
            mode="date"
          />
        </View>
      </Modal>
    );
  };

  useEffect(() => {
    if (studentId && token) {
      fetchData();
    }
  }, [activeTab, studentId, token]);

  const fetchData = async () => {
    if (!studentId || !token) return;

    setLoading(true);
    try {
      switch (activeTab) {
        case 'leave': {
          const data = await studentInteractionsAPI.getLeaves(studentId, undefined, token);
          setLeaves(Array.isArray(data) ? data : []);
          break;
        }
        case 'absence': {
          const data = await studentInteractionsAPI.getAbsenceReasons(studentId, {}, token);
          setAbsenceReasons(Array.isArray(data) ? data : []);
          break;
        }
        case 'eligibility': {
          // getExamEligibility already normalises response to flat shape
          const eligData = await studentInteractionsAPI.getExamEligibility(studentId, {}, token);
          setEligibility(eligData);
          // ✓ FIX: Only check low attendance if user is a student (has valid studentId)
          if (user?.role === 'student' && studentId) {
            try {
              const lowData = await studentInteractionsAPI.checkLowAttendance(studentId, token);
              setLowAttendanceInfo(lowData);
            } catch (lowAttError: any) {
              console.warn('Could not fetch low attendance info:', lowAttError?.message || lowAttError);
              setLowAttendanceInfo(null);
            }
          } else {
            setLowAttendanceInfo(null);
          }
          break;
        }
        case 'on-duty': {
          const data = await studentInteractionsAPI.getOnDutyRequests(studentId, undefined, token);
          setOnDutyRequests(data?.onDutyRequests ?? (Array.isArray(data) ? data : []));
          break;
        }
      }
    } catch (error: any) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleSubmitLeave = async () => {
    if (!leaveForm.startDate || !leaveForm.endDate || !leaveForm.reason) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!token) return;

    try {
      setLoading(true);
      await studentInteractionsAPI.submitLeave(leaveForm, token);
      Alert.alert('Success', 'Leave application submitted successfully');
      setLeaveForm({ startDate: '', endDate: '', leaveType: 'casual', reason: '' });
      await fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit leave application');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitOnDuty = async () => {
    if (!onDutyForm.startDate || !onDutyForm.endDate || !onDutyForm.dutyType || !onDutyForm.reason) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!token) return;

    try {
      setLoading(true);
      await studentInteractionsAPI.submitOnDuty(onDutyForm, token);
      Alert.alert('Success', 'On-duty request submitted successfully');
      setOnDutyForm({ startDate: '', endDate: '', dutyType: 'sports', reason: '', institution: '' });
      await fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit on-duty request');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#4CAF50';
      case 'pending': return '#FF9800';
      case 'rejected': return '#F44336';
      default: return '#999';
    }
  };

  const renderLeaveTab = () => (
    <View>
      <ThemedView style={styles.formCard}>
        <ThemedText type="subtitle" style={styles.cardTitle}>Apply for Leave</ThemedText>
        
        <View style={styles.formGroup}>
          <ThemedText style={styles.label}>Start Date *</ThemedText>
          <TouchableOpacity
            style={styles.datePickerButton}
            onPress={() => {
              if (leaveForm.startDate) {
                setTempLeaveStartDate(new Date(leaveForm.startDate + 'T00:00:00'));
              }
              setShowLeaveStartDatePicker(true);
            }}>
            <ThemedText style={styles.datePickerButtonText}>
              {formatDateForDisplay(leaveForm.startDate)}
            </ThemedText>
            <IconSymbol name="calendar" size={20} color={Colors[colorScheme ?? 'light'].tint} />
          </TouchableOpacity>
        </View>

        <View style={styles.formGroup}>
          <ThemedText style={styles.label}>End Date *</ThemedText>
          <TouchableOpacity
            style={styles.datePickerButton}
            onPress={() => {
              if (leaveForm.endDate) {
                setTempLeaveEndDate(new Date(leaveForm.endDate + 'T00:00:00'));
              }
              setShowLeaveEndDatePicker(true);
            }}>
            <ThemedText style={styles.datePickerButtonText}>
              {formatDateForDisplay(leaveForm.endDate)}
            </ThemedText>
            <IconSymbol name="calendar" size={20} color={Colors[colorScheme ?? 'light'].tint} />
          </TouchableOpacity>
        </View>

        <View style={styles.formGroup}>
          <ThemedText style={styles.label}>Leave Type</ThemedText>
          <View style={styles.typeButtons}>
            {['casual', 'sick', 'emergency'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.typeButton, leaveForm.leaveType === type && styles.typeButtonActive]}
                onPress={() => setLeaveForm({ ...leaveForm, leaveType: type })}>
                <ThemedText style={[styles.typeButtonText, leaveForm.leaveType === type && styles.typeButtonTextActive]}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.formGroup}>
          <ThemedText style={styles.label}>Reason *</ThemedText>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Enter reason for leave"
            value={leaveForm.reason}
            onChangeText={(text) => setLeaveForm({ ...leaveForm, reason: text })}
            multiline
            numberOfLines={4}
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}
          onPress={handleSubmitLeave}
          disabled={loading}>
          <ThemedText style={styles.submitButtonText}>
            {loading ? 'Submitting...' : 'Submit Leave Application'}
          </ThemedText>
        </TouchableOpacity>
      </ThemedView>

      <ThemedText type="subtitle" style={styles.sectionTitle}>Your Leave Applications</ThemedText>
      {leaves.map((leave) => (
        <ThemedView key={leave._id} style={styles.leaveCard}>
          <View style={styles.leaveHeader}>
            <View>
              <ThemedText type="defaultSemiBold">{leave.leaveType.toUpperCase()}</ThemedText>
              <ThemedText style={styles.leaveDate}>
                {new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}
              </ThemedText>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(leave.status) }]}>
              <ThemedText style={styles.statusText}>{leave.status.toUpperCase()}</ThemedText>
            </View>
          </View>
          <ThemedText style={styles.leaveReason}>{leave.reason}</ThemedText>
          {leave.approvalRemarks && (
            <ThemedText style={styles.remarksText}>Remarks: {leave.approvalRemarks}</ThemedText>
          )}
        </ThemedView>
      ))}
    </View>
  );

  const renderAbsenceTab = () => (
    <View>
      <ThemedText type="subtitle" style={styles.sectionTitle}>Absence Reasons Submitted</ThemedText>
      {absenceReasons.length === 0 ? (
        <ThemedView style={styles.emptyState}>
          <IconSymbol name="doc.text" size={48} color="#999" />
          <ThemedText style={styles.emptyText}>No absence reasons submitted yet</ThemedText>
        </ThemedView>
      ) : (
        absenceReasons.map((reason) => (
          <ThemedView key={reason._id} style={styles.reasonCard}>
            <View style={styles.reasonHeader}>
              <ThemedText type="defaultSemiBold">
                {new Date(reason.date).toLocaleDateString()}
              </ThemedText>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(reason.status) }]}>
                <ThemedText style={styles.statusText}>{reason.status.toUpperCase()}</ThemedText>
              </View>
            </View>
            <ThemedText style={styles.reasonType}>{reason.reasonType}</ThemedText>
            <ThemedText style={styles.reasonText}>{reason.reason}</ThemedText>
            {reason.reviewRemarks && (
              <ThemedText style={styles.remarksText}>Review: {reason.reviewRemarks}</ThemedText>
            )}
          </ThemedView>
        ))
      )}
    </View>
  );

  const renderEligibilityTab = () => (
    <View>
      {lowAttendanceInfo && (
        <ThemedView style={[styles.alertCard, { 
          backgroundColor: lowAttendanceInfo.hasLowAttendance ? 'rgba(244, 67, 54, 0.1)' : 'rgba(76, 175, 80, 0.1)'
        }]}>
          <IconSymbol 
            name={lowAttendanceInfo.hasLowAttendance ? 'exclamationmark.triangle.fill' : 'checkmark.circle.fill'} 
            size={32} 
            color={lowAttendanceInfo.hasLowAttendance ? '#F44336' : '#4CAF50'}
          />
          <ThemedText type="subtitle" style={styles.alertTitle}>
            {lowAttendanceInfo.hasLowAttendance ? 'Low Attendance Warning' : 'Good Attendance'}
          </ThemedText>
          <ThemedText style={styles.alertMessage}>{lowAttendanceInfo.message}</ThemedText>
          <View style={styles.alertStats}>
            <View style={styles.alertStat}>
              <ThemedText style={styles.alertStatNumber}>{(lowAttendanceInfo.percentage ?? 0).toFixed(1)}%</ThemedText>
              <ThemedText style={styles.alertStatLabel}>Your Attendance</ThemedText>
            </View>
            <View style={styles.alertStat}>
              <ThemedText style={styles.alertStatNumber}>{lowAttendanceInfo.threshold}%</ThemedText>
              <ThemedText style={styles.alertStatLabel}>Required</ThemedText>
            </View>
          </View>
        </ThemedView>
      )}

      {eligibility && (
        <ThemedView style={styles.eligibilityCard}>
          <View style={styles.eligibilityHeader}>
            <ThemedText type="title">Exam Eligibility</ThemedText>
            <IconSymbol 
              name={eligibility.isEligible ? 'checkmark.seal.fill' : 'xmark.seal.fill'} 
              size={40} 
              color={eligibility.isEligible ? '#4CAF50' : '#F44336'}
            />
          </View>

          <View style={[styles.eligibilityStatus, {
            backgroundColor: eligibility.isEligible ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)'
          }]}>
            <ThemedText style={[styles.eligibilityStatusText, {
              color: eligibility.isEligible ? '#4CAF50' : '#F44336'
            }]}>
              {eligibility.isEligible ? '✓ ELIGIBLE' : '✗ NOT ELIGIBLE'}
            </ThemedText>
          </View>

          <View style={styles.eligibilityGrid}>
            <View style={styles.eligibilityStat}>
              <ThemedText style={styles.eligibilityNumber}>{eligibility.currentPercentage ?? 0}%</ThemedText>
              <ThemedText style={styles.eligibilityLabel}>Your Attendance</ThemedText>
            </View>
            <View style={styles.eligibilityStat}>
              <ThemedText style={styles.eligibilityNumber}>{eligibility.requiredPercentage ?? 75}%</ThemedText>
              <ThemedText style={styles.eligibilityLabel}>Required</ThemedText>
            </View>
            <View style={styles.eligibilityStat}>
              <ThemedText style={styles.eligibilityNumber}>{eligibility.totalClasses ?? 0}</ThemedText>
              <ThemedText style={styles.eligibilityLabel}>Total Classes</ThemedText>
            </View>
            <View style={styles.eligibilityStat}>
              <ThemedText style={styles.eligibilityNumber}>{eligibility.presentCount ?? 0}</ThemedText>
              <ThemedText style={styles.eligibilityLabel}>Present</ThemedText>
            </View>
          </View>

          <ThemedText style={styles.eligibilityMessage}>{eligibility.message}</ThemedText>

          {!eligibility.isEligible && (eligibility.classesNeeded ?? 0) > 0 && (
            <View style={styles.improvementTip}>
              <IconSymbol name="lightbulb.fill" size={20} color="#FF9800" />
              <ThemedText style={styles.improvementText}>
                Attend next {eligibility.classesNeeded} classes without absence to become eligible
              </ThemedText>
            </View>
          )}
        </ThemedView>
      )}
    </View>
  );

  const renderOnDutyTab = () => (
    <View>
      <ThemedView style={styles.formCard}>
        <ThemedText type="subtitle" style={styles.cardTitle}>Request On-Duty</ThemedText>
        
        <View style={styles.formGroup}>
          <ThemedText style={styles.label}>Start Date *</ThemedText>
          <TouchableOpacity
            style={styles.datePickerButton}
            onPress={() => {
              if (onDutyForm.startDate) {
                setTempOnDutyStartDate(new Date(onDutyForm.startDate + 'T00:00:00'));
              }
              setShowOnDutyStartDatePicker(true);
            }}>
            <ThemedText style={styles.datePickerButtonText}>
              {formatDateForDisplay(onDutyForm.startDate)}
            </ThemedText>
            <IconSymbol name="calendar" size={20} color={Colors[colorScheme ?? 'light'].tint} />
          </TouchableOpacity>
        </View>

        <View style={styles.formGroup}>
          <ThemedText style={styles.label}>End Date *</ThemedText>
          <TouchableOpacity
            style={styles.datePickerButton}
            onPress={() => {
              if (onDutyForm.endDate) {
                setTempOnDutyEndDate(new Date(onDutyForm.endDate + 'T00:00:00'));
              }
              setShowOnDutyEndDatePicker(true);
            }}>
            <ThemedText style={styles.datePickerButtonText}>
              {formatDateForDisplay(onDutyForm.endDate)}
            </ThemedText>
            <IconSymbol name="calendar" size={20} color={Colors[colorScheme ?? 'light'].tint} />
          </TouchableOpacity>
        </View>

        <View style={styles.formGroup}>
          <ThemedText style={styles.label}>Duty Type *</ThemedText>
          <View style={styles.typeButtons}>
            {['sports', 'competition', 'cultural', 'academic', 'official'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.typeButton, onDutyForm.dutyType === type && styles.typeButtonActive]}
                onPress={() => setOnDutyForm({ ...onDutyForm, dutyType: type })}>
                <ThemedText style={[styles.typeButtonText, onDutyForm.dutyType === type && styles.typeButtonTextActive]}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.formGroup}>
          <ThemedText style={styles.label}>Institution/Event</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="Name of institution or event"
            value={onDutyForm.institution}
            onChangeText={(text) => setOnDutyForm({ ...onDutyForm, institution: text })}
          />
        </View>

        <View style={styles.formGroup}>
          <ThemedText style={styles.label}>Reason *</ThemedText>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe the purpose of on-duty"
            value={onDutyForm.reason}
            onChangeText={(text) => setOnDutyForm({ ...onDutyForm, reason: text })}
            multiline
            numberOfLines={4}
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}
          onPress={handleSubmitOnDuty}
          disabled={loading}>
          <ThemedText style={styles.submitButtonText}>
            {loading ? 'Submitting...' : 'Submit On-Duty Request'}
          </ThemedText>
        </TouchableOpacity>
      </ThemedView>

      <ThemedText type="subtitle" style={styles.sectionTitle}>Your On-Duty Requests</ThemedText>
      {onDutyRequests.length === 0 ? (
        <ThemedView style={styles.emptyState}>
          <IconSymbol name="checkmark.circle" size={48} color="#999" />
          <ThemedText style={styles.emptyText}>No on-duty requests submitted yet</ThemedText>
        </ThemedView>
      ) : (
        onDutyRequests.map((request) => (
          <ThemedView key={request._id} style={styles.dutyCard}>
            <View style={styles.dutyHeader}>
              <View>
                <ThemedText type="defaultSemiBold">{request.dutyType.toUpperCase()}</ThemedText>
                <ThemedText style={styles.dutyDate}>
                  {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                </ThemedText>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) }]}>
                <ThemedText style={styles.statusText}>{request.status.toUpperCase()}</ThemedText>
              </View>
            </View>
            {request.institution && (
              <ThemedText style={styles.institution}>{request.institution}</ThemedText>
            )}
            <ThemedText style={styles.dutyReason}>{request.reason}</ThemedText>
            {request.approvalRemarks && (
              <ThemedText style={styles.remarksText}>Approval: {request.approvalRemarks}</ThemedText>
            )}
          </ThemedView>
        ))
      )}
    </View>
  );

  if (!user || user.role !== 'student') {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>This feature is only available for students.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <ThemedText type="title">Requests</ThemedText>
        <ThemedText style={styles.subtitle}>Leave, Absence & Duties</ThemedText>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'eligibility' && styles.activeTab]}
          onPress={() => setActiveTab('eligibility')}>
          <IconSymbol name="checkmark.seal" size={18} color={activeTab === 'eligibility' ? '#fff' : Colors[colorScheme ?? 'light'].text} />
          <ThemedText style={[styles.tabLabel, activeTab === 'eligibility' && styles.activeTabLabel]}>Eligibility</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'leave' && styles.activeTab]}
          onPress={() => setActiveTab('leave')}>
          <IconSymbol name="calendar.badge.plus" size={18} color={activeTab === 'leave' ? '#fff' : Colors[colorScheme ?? 'light'].text} />
          <ThemedText style={[styles.tabLabel, activeTab === 'leave' && styles.activeTabLabel]}>Leave</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'on-duty' && styles.activeTab]}
          onPress={() => setActiveTab('on-duty')}>
          <IconSymbol name="checkmark.circle.fill" size={18} color={activeTab === 'on-duty' ? '#fff' : Colors[colorScheme ?? 'light'].text} />
          <ThemedText style={[styles.tabLabel, activeTab === 'on-duty' && styles.activeTabLabel]}>On-Duty</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'absence' && styles.activeTab]}
          onPress={() => setActiveTab('absence')}>
          <IconSymbol name="doc.text" size={18} color={activeTab === 'absence' ? '#fff' : Colors[colorScheme ?? 'light'].text} />
          <ThemedText style={[styles.tabLabel, activeTab === 'absence' && styles.activeTabLabel]}>Reasons</ThemedText>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {activeTab === 'leave' && renderLeaveTab()}
          {activeTab === 'absence' && renderAbsenceTab()}
          {activeTab === 'eligibility' && renderEligibilityTab()}
          {activeTab === 'on-duty' && renderOnDutyTab()}
        </ScrollView>
      )}

      {/* Leave Start Date Picker */}
      <DatePickerModal
        visible={showLeaveStartDatePicker}
        onClose={() => setShowLeaveStartDatePicker(false)}
        onDateSelect={(date) => setLeaveForm({ ...leaveForm, startDate: date })}
        tempDate={tempLeaveStartDate}
        setTempDate={setTempLeaveStartDate}
        title="Select Start Date"
      />

      {/* Leave End Date Picker */}
      <DatePickerModal
        visible={showLeaveEndDatePicker}
        onClose={() => setShowLeaveEndDatePicker(false)}
        onDateSelect={(date) => setLeaveForm({ ...leaveForm, endDate: date })}
        tempDate={tempLeaveEndDate}
        setTempDate={setTempLeaveEndDate}
        title="Select End Date"
      />

      {/* On-Duty Start Date Picker */}
      <DatePickerModal
        visible={showOnDutyStartDatePicker}
        onClose={() => setShowOnDutyStartDatePicker(false)}
        onDateSelect={(date) => setOnDutyForm({ ...onDutyForm, startDate: date })}
        tempDate={tempOnDutyStartDate}
        setTempDate={setTempOnDutyStartDate}
        title="Select Start Date"
      />

      {/* On-Duty End Date Picker */}
      <DatePickerModal
        visible={showOnDutyEndDatePicker}
        onClose={() => setShowOnDutyEndDatePicker(false)}
        onDateSelect={(date) => setOnDutyForm({ ...onDutyForm, endDate: date })}
        tempDate={tempOnDutyEndDate}
        setTempDate={setTempOnDutyEndDate}
        title="Select End Date"
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  activeTab: {
    backgroundColor: '#007AFF',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  activeTabLabel: {
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    marginHorizontal: 16,
    marginVertical: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  formCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  inputGroup: {
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.8,
    marginBottom: 4,
  },
  input: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    fontSize: 13,
    color: '#000',
  },
  submitButton: {
    marginHorizontal: 16,
    marginVertical: 10,
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
  submitButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  leaveCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    marginTop: 2,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  leaveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  leaveDate: {
    fontSize: 11,
    opacity: 0.6,
    marginTop: 2,
  },
  leaveReason: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 6,
  },
  reasonCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    marginTop: 2,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  reasonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  reasonType: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  reasonText: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  alertCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  alertTitle: {
    marginTop: 8,
    fontSize: 14,
  },
  alertMessage: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
    textAlign: 'center',
  },
  alertStats: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 16,
  },
  alertStat: {
    alignItems: 'center',
  },
  alertStatNumber: {
    fontSize: 18,
    fontWeight: '700',
  },
  alertStatLabel: {
    fontSize: 10,
    opacity: 0.6,
    marginTop: 2,
  },
  eligibilityCard: {
    marginHorizontal: 16,
    marginVertical: 8,
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
  eligibilityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  eligibilityStatus: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 6,
    alignItems: 'center',
  },
  dutyCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    marginTop: 2,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  dutyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  dutyDate: {
    fontSize: 11,
    opacity: 0.6,
    marginTop: 2,
  },
  institution: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  dutyReason: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  remarksText: {
    fontSize: 11,
    opacity: 0.6,
    fontStyle: 'italic',
    marginTop: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  emptyState: {
    marginHorizontal: 16,
    marginVertical: 20,
    paddingVertical: 30,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
  },
  emptyText: {
    fontSize: 13,
    opacity: 0.6,
    marginTop: 8,
  },
  datePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  datePickerButtonText: {
    fontSize: 14,
    flex: 1,
  },
  datePickerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f5f5f5',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  datePickerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  datePickerHeaderButton: {
    fontSize: 14,
    fontWeight: '500',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  webDateInput: {
    fontSize: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 2,
    borderRadius: 8,
    marginHorizontal: 20,
    marginVertical: 20,
    textAlign: 'center',
  },
  webDatePickerContent: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  webDatePickerLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  webDatePickerHint: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 12,
    textAlign: 'center',
  },
});

