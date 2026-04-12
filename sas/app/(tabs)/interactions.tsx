import { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, TextInput, Alert, ActivityIndicator, RefreshControl, Modal, Platform, ScrollView, DatePickerIOS } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';
import { studentInteractionsAPI } from '@/services/api';
import ApprovalDashboard from '@/components/ApprovalDashboard';

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

  const studentId = String(user?.studentId || user?.id || '').trim();

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
            <View style={[styles.datePickerHeader, { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground }]}>
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
    if (studentId && studentId !== '' && token) {
      fetchData();
    }
  }, [activeTab, studentId, token]);

  const fetchData = async () => {
    if (!studentId || studentId === '' || !token) {
      console.log('[InteractionsDebug] Skipping fetch - studentId:', studentId, 'token:', !!token);
      return;
    }

    setLoading(true);
    try {
      console.log('[InteractionsDebug] Fetching data for studentId:', studentId, 'activeTab:', activeTab);
      
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
      console.error('[InteractionsError] Error fetching data:', error);
      console.error('[InteractionsError] Details:', {
        studentId,
        activeTab,
        message: error?.message,
        response: error?.response,
      });
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
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Form Section */}
      <View style={styles.timelineSection}>
        <View style={styles.timelineItem}>
          <View style={styles.timelineLine} />
          <View style={[styles.timelineMarker, { backgroundColor: '#3b82f6' }]} />
          
          <View style={styles.timelineContent}>
            <ThemedText type="subtitle" style={styles.timelineTitle}>New Leave Application</ThemedText>
            
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
                <IconSymbol name="calendar" size={18} color="#3b82f6" />
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
                <IconSymbol name="calendar" size={18} color="#3b82f6" />
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
                numberOfLines={3}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: '#3b82f6' }]}
              onPress={handleSubmitLeave}
              disabled={loading}>
              <ThemedText style={styles.submitButtonText}>
                {loading ? 'Submitting...' : 'Submit Application'}
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* History Section */}
      {leaves.length > 0 && (
        <View style={styles.timelineSection}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Application History</ThemedText>
          {leaves.map((leave, index) => (
            <View key={leave._id} style={styles.timelineItem}>
              {index < leaves.length - 1 && <View style={styles.timelineLine} />}
              <View style={[styles.timelineMarker, {
                backgroundColor: leave.status === 'approved' ? '#51cf66' : leave.status === 'rejected' ? '#ff6b6b' : '#f59e0b'
              }]} />
              
              <View style={styles.timelineContent}>
                <View style={styles.historyHeader}>
                  <ThemedText type="defaultSemiBold">{leave.leaveType.toUpperCase()}</ThemedText>
                  <View style={[styles.statusBadgeTimeline, {
                    backgroundColor: leave.status === 'approved' ? 'rgba(81, 207, 102, 0.2)' : leave.status === 'rejected' ? 'rgba(255, 107, 107, 0.2)' : 'rgba(245, 158, 11, 0.2)'
                  }]}>
                    <ThemedText style={[styles.statusTextTimeline, {
                      color: leave.status === 'approved' ? '#51cf66' : leave.status === 'rejected' ? '#ff6b6b' : '#f59e0b'
                    }]}>
                      {leave.status.toUpperCase()}
                    </ThemedText>
                  </View>
                </View>
                <ThemedText style={styles.dateRange}>
                  {new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}
                </ThemedText>
                <ThemedText style={styles.historyReason}>{leave.reason}</ThemedText>
                {leave.approvalRemarks && (
                  <ThemedText style={styles.remarksText}>📝 {leave.approvalRemarks}</ThemedText>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );

  const renderAbsenceTab = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      {absenceReasons.length === 0 ? (
        <View style={styles.emptyStateTimeline}>
          <IconSymbol name="checkmark.circle.fill" size={64} color="#51cf66" />
          <ThemedText style={styles.emptyTextTimeline}>No absences to report</ThemedText>
          <ThemedText style={styles.emptyHintTimeline}>Good attendance record</ThemedText>
        </View>
      ) : (
        <View style={styles.timelineSection}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Absence Record</ThemedText>
          {absenceReasons.map((reason, index) => (
            <View key={reason._id} style={styles.timelineItem}>
              {index < absenceReasons.length - 1 && <View style={styles.timelineLine} />}
              <View style={[styles.timelineMarker, {
                backgroundColor: reason.status === 'approved' ? '#51cf66' : reason.status === 'rejected' ? '#ff6b6b' : '#f59e0b'
              }]} />
              
              <View style={styles.timelineContent}>
                <View style={styles.historyHeader}>
                  <ThemedText type="defaultSemiBold">{new Date(reason.date).toLocaleDateString()}</ThemedText>
                  <View style={[styles.statusBadgeTimeline, {
                    backgroundColor: reason.status === 'approved' ? 'rgba(81, 207, 102, 0.2)' : reason.status === 'rejected' ? 'rgba(255, 107, 107, 0.2)' : 'rgba(245, 158, 11, 0.2)'
                  }]}>
                    <ThemedText style={[styles.statusTextTimeline, {
                      color: reason.status === 'approved' ? '#51cf66' : reason.status === 'rejected' ? '#ff6b6b' : '#f59e0b'
                    }]}>
                      {reason.status.toUpperCase()}
                    </ThemedText>
                  </View>
                </View>
                <ThemedText style={styles.reasonType}>{reason.reasonType}</ThemedText>
                <ThemedText style={styles.historyReason}>{reason.reason}</ThemedText>
                {reason.reviewRemarks && (
                  <ThemedText style={styles.remarksText}>📝 {reason.reviewRemarks}</ThemedText>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );

  const renderEligibilityTab = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.timelineSection}>
        <View style={styles.timelineItem}>
          <View style={[styles.timelineMarker, {
            backgroundColor: eligibility?.isEligible ? '#51cf66' : '#ff6b6b'
          }]} />
          
          <View style={styles.timelineContent}>
            <ThemedText type="subtitle" style={styles.timelineTitle}>Exam Eligibility Status</ThemedText>
            
            {eligibility && (
              <>
                <View style={[styles.statusCard, {
                  backgroundColor: eligibility.isEligible ? 'rgba(81, 207, 102, 0.15)' : 'rgba(255, 107, 107, 0.15)',
                  borderLeftColor: eligibility.isEligible ? '#51cf66' : '#ff6b6b'
                }]}>
                  <ThemedText style={[styles.statusTitle, {
                    color: eligibility.isEligible ? '#51cf66' : '#ff6b6b'
                  }]}>
                    {eligibility.isEligible ? '✓ ELIGIBLE' : '✗ NOT ELIGIBLE'}
                  </ThemedText>
                </View>

                <View style={styles.statsGrid}>
                  <View style={styles.statBox}>
                    <ThemedText style={styles.statNumber}>{eligibility.currentPercentage ?? 0}%</ThemedText>
                    <ThemedText style={styles.statLabel}>Your Attendance</ThemedText>
                  </View>
                  <View style={styles.statBox}>
                    <ThemedText style={styles.statNumber}>{eligibility.requiredPercentage ?? 75}%</ThemedText>
                    <ThemedText style={styles.statLabel}>Required</ThemedText>
                  </View>
                  <View style={styles.statBox}>
                    <ThemedText style={styles.statNumber}>{eligibility.presentCount ?? 0}</ThemedText>
                    <ThemedText style={styles.statLabel}>Present</ThemedText>
                  </View>
                  <View style={styles.statBox}>
                    <ThemedText style={styles.statNumber}>{eligibility.totalClasses ?? 0}</ThemedText>
                    <ThemedText style={styles.statLabel}>Total Classes</ThemedText>
                  </View>
                </View>

                <ThemedText style={styles.messageText}>{eligibility.message}</ThemedText>

                {!eligibility.isEligible && (eligibility.classesNeeded ?? 0) > 0 && (
                  <View style={styles.tipBox}>
                    <IconSymbol name="lightbulb.fill" size={18} color="#f59e0b" />
                    <ThemedText style={styles.tipText}>
                      Attend {eligibility.classesNeeded} more classes without absence to become eligible
                    </ThemedText>
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      </View>

      {lowAttendanceInfo && (
        <View style={styles.timelineSection}>
          <View style={styles.timelineItem}>
            <View style={[styles.timelineMarker, {
              backgroundColor: lowAttendanceInfo.hasLowAttendance ? '#ff6b6b' : '#51cf66'
            }]} />
            
            <View style={styles.timelineContent}>
              <ThemedText type="subtitle" style={styles.timelineTitle}>Attendance Alert</ThemedText>
              
              <View style={[styles.alertBox, {
                backgroundColor: lowAttendanceInfo.hasLowAttendance ? 'rgba(255, 107, 107, 0.15)' : 'rgba(81, 207, 102, 0.15)',
                borderLeftColor: lowAttendanceInfo.hasLowAttendance ? '#ff6b6b' : '#51cf66'
              }]}>
                <IconSymbol 
                  name={lowAttendanceInfo.hasLowAttendance ? 'exclamationmark.triangle.fill' : 'checkmark.circle.fill'} 
                  size={24} 
                  color={lowAttendanceInfo.hasLowAttendance ? '#ff6b6b' : '#51cf66'}
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <ThemedText style={[styles.alertTitle, {
                    color: lowAttendanceInfo.hasLowAttendance ? '#ff6b6b' : '#51cf66'
                  }]}>
                    {lowAttendanceInfo.hasLowAttendance ? 'Low Attendance' : 'Good Attendance'}
                  </ThemedText>
                  <ThemedText style={styles.alertMessage}>{lowAttendanceInfo.message}</ThemedText>
                </View>
              </View>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );

  const renderOnDutyTab = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Form Section */}
      <View style={styles.timelineSection}>
        <View style={styles.timelineItem}>
          <View style={styles.timelineLine} />
          <View style={[styles.timelineMarker, { backgroundColor: '#8b5cf6' }]} />
          
          <View style={styles.timelineContent}>
            <ThemedText type="subtitle" style={styles.timelineTitle}>New On-Duty Request</ThemedText>
            
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
                <IconSymbol name="calendar" size={18} color="#8b5cf6" />
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
                <IconSymbol name="calendar" size={18} color="#8b5cf6" />
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
                numberOfLines={3}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: '#8b5cf6' }]}
              onPress={handleSubmitOnDuty}
              disabled={loading}>
              <ThemedText style={styles.submitButtonText}>
                {loading ? 'Submitting...' : 'Submit Request'}
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* History Section */}
      {onDutyRequests.length > 0 ? (
        <View style={styles.timelineSection}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Request History</ThemedText>
          {onDutyRequests.map((request, index) => (
            <View key={request._id} style={styles.timelineItem}>
              {index < onDutyRequests.length - 1 && <View style={styles.timelineLine} />}
              <View style={[styles.timelineMarker, {
                backgroundColor: request.status === 'approved' ? '#51cf66' : request.status === 'rejected' ? '#ff6b6b' : '#f59e0b'
              }]} />
              
              <View style={styles.timelineContent}>
                <View style={styles.historyHeader}>
                  <ThemedText type="defaultSemiBold">{request.dutyType.toUpperCase()}</ThemedText>
                  <View style={[styles.statusBadgeTimeline, {
                    backgroundColor: request.status === 'approved' ? 'rgba(81, 207, 102, 0.2)' : request.status === 'rejected' ? 'rgba(255, 107, 107, 0.2)' : 'rgba(245, 158, 11, 0.2)'
                  }]}>
                    <ThemedText style={[styles.statusTextTimeline, {
                      color: request.status === 'approved' ? '#51cf66' : request.status === 'rejected' ? '#ff6b6b' : '#f59e0b'
                    }]}>
                      {request.status.toUpperCase()}
                    </ThemedText>
                  </View>
                </View>
                <ThemedText style={styles.dateRange}>
                  {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                </ThemedText>
                {request.institution && (
                  <ThemedText style={styles.institution}>📍 {request.institution}</ThemedText>
                )}
                <ThemedText style={styles.historyReason}>{request.reason}</ThemedText>
                {request.approvalRemarks && (
                  <ThemedText style={styles.remarksText}>📝 {request.approvalRemarks}</ThemedText>
                )}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyStateTimeline}>
          <IconSymbol name="checkmark.circle.fill" size={64} color="#8b5cf6" />
          <ThemedText style={styles.emptyTextTimeline}>No on-duty requests yet</ThemedText>
          <ThemedText style={styles.emptyHintTimeline}>Submit your first request above</ThemedText>
        </View>
      )}
    </ScrollView>
  );

  if (!user) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
      </ThemedView>
    );
  }

  // Show approval dashboard for staff and HOD
  if (user.role === 'staff' || user.role === 'hod') {
    return <ApprovalDashboard />;
  }

  // Show student interactions for students
  if (user.role !== 'student') {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>This feature is not available for your role.</ThemedText>
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
        onDateSelect={(date: string) => setLeaveForm({ ...leaveForm, startDate: date })}
        tempDate={tempLeaveStartDate}
        setTempDate={setTempLeaveStartDate}
        title="Select Start Date"
      />

      {/* Leave End Date Picker */}
      <DatePickerModal
        visible={showLeaveEndDatePicker}
        onClose={() => setShowLeaveEndDatePicker(false)}
        onDateSelect={(date: string) => setLeaveForm({ ...leaveForm, endDate: date })}
        tempDate={tempLeaveEndDate}
        setTempDate={setTempLeaveEndDate}
        title="Select End Date"
      />

      {/* On-Duty Start Date Picker */}
      <DatePickerModal
        visible={showOnDutyStartDatePicker}
        onClose={() => setShowOnDutyStartDatePicker(false)}
        onDateSelect={(date: string) => setOnDutyForm({ ...onDutyForm, startDate: date })}
        tempDate={tempOnDutyStartDate}
        setTempDate={setTempOnDutyStartDate}
        title="Select Start Date"
      />

      {/* On-Duty End Date Picker */}
      <DatePickerModal
        visible={showOnDutyEndDatePicker}
        onClose={() => setShowOnDutyEndDatePicker(false)}
        onDateSelect={(date: string) => setOnDutyForm({ ...onDutyForm, endDate: date })}
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

  // Type Buttons
  typeButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  typeButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: 'rgba(128, 128, 128, 0.08)', borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.2)' },
  typeButtonActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  typeButtonText: { fontSize: 12, fontWeight: '600', opacity: 0.7 },
  typeButtonTextActive: { color: '#fff', opacity: 1 },
  textArea: { minHeight: 100, textAlignVertical: 'top', paddingVertical: 12 },
  formGroup: { marginBottom: 12 },

  // Timeline Layout
  timelineSection: { paddingHorizontal: 16, paddingVertical: 12 },
  timelineItem: { flexDirection: 'row', marginBottom: 24, position: 'relative' },
  timelineLine: { position: 'absolute', left: 11, top: 40, width: 2, bottom: -24, backgroundColor: 'rgba(148, 163, 184, 0.2)' },
  timelineMarker: { width: 24, height: 24, borderRadius: 12, marginRight: 16, marginTop: 0, borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 4 },
  timelineContent: { flex: 1, backgroundColor: 'rgba(128, 128, 128, 0.04)', borderRadius: 14, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  timelineTitle: { fontSize: 15, marginBottom: 12 },
  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  statusBadgeTimeline: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusTextTimeline: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  dateRange: { fontSize: 12, opacity: 0.6, marginBottom: 6 },
  reasonType: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  historyReason: { fontSize: 12, opacity: 0.65, lineHeight: 18 },
  statusCard: { borderLeftWidth: 4, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, marginVertical: 10 },
  statusTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 12 },
  statBox: { flex: 1, minWidth: '45%', backgroundColor: 'rgba(128, 128, 128, 0.08)', borderRadius: 12, padding: 14, alignItems: 'center' },
  statNumber: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  statLabel: { fontSize: 11, opacity: 0.6, textAlign: 'center' },
  messageText: { fontSize: 13, opacity: 0.7, marginVertical: 10, lineHeight: 20 },
  tipBox: { flexDirection: 'row', backgroundColor: 'rgba(245, 158, 11, 0.15)', borderLeftColor: '#f59e0b', borderLeftWidth: 4, borderRadius: 10, padding: 12, marginTop: 12, gap: 10 },
  tipText: { flex: 1, fontSize: 12, opacity: 0.75, lineHeight: 18 },
  alertBox: { flexDirection: 'row', borderLeftWidth: 4, borderRadius: 10, padding: 12, marginTop: 10, gap: 12 },
  alertTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  alertMessage: { fontSize: 12, opacity: 0.7, lineHeight: 18 },
  emptyStateTimeline: { paddingVertical: 100, alignItems: 'center', justifyContent: 'center' },
  emptyTextTimeline: { fontSize: 18, fontWeight: '700', marginBottom: 8, marginTop: 16 },
  emptyHintTimeline: { fontSize: 14, opacity: 0.5 },
  sectionTitle: { fontSize: 14, fontWeight: '600', marginVertical: 12 },
});

