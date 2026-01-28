import { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, TextInput, Alert, ActivityIndicator, RefreshControl } from 'react-native';
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

  const studentId = user?.id;

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
        case 'leave':
          const leavesData = await studentInteractionsAPI.getLeaves(studentId, undefined, token);
          setLeaves(leavesData);
          break;
        case 'absence':
          const reasonsData = await studentInteractionsAPI.getAbsenceReasons(studentId, {}, token);
          setAbsenceReasons(reasonsData);
          break;
        case 'eligibility':
          const eligData = await studentInteractionsAPI.getExamEligibility(studentId, {}, token);
          setEligibility(eligData);
          const lowAttData = await studentInteractionsAPI.checkLowAttendance(studentId, token);
          setLowAttendanceInfo(lowAttData);
          break;
        case 'on-duty':
          const onDutyData = await studentInteractionsAPI.getOnDutyRequests(studentId, undefined, token);
          setOnDutyRequests(onDutyData.onDutyRequests || []);
          break;
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
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            value={leaveForm.startDate}
            onChangeText={(text) => setLeaveForm({ ...leaveForm, startDate: text })}
          />
        </View>

        <View style={styles.formGroup}>
          <ThemedText style={styles.label}>End Date *</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            value={leaveForm.endDate}
            onChangeText={(text) => setLeaveForm({ ...leaveForm, endDate: text })}
          />
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
              <ThemedText style={styles.alertStatNumber}>{lowAttendanceInfo.percentage.toFixed(1)}%</ThemedText>
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
              <ThemedText style={styles.eligibilityNumber}>{eligibility.currentPercentage}%</ThemedText>
              <ThemedText style={styles.eligibilityLabel}>Your Attendance</ThemedText>
            </View>
            <View style={styles.eligibilityStat}>
              <ThemedText style={styles.eligibilityNumber}>{eligibility.requiredPercentage}%</ThemedText>
              <ThemedText style={styles.eligibilityLabel}>Required</ThemedText>
            </View>
            <View style={styles.eligibilityStat}>
              <ThemedText style={styles.eligibilityNumber}>{eligibility.totalClasses}</ThemedText>
              <ThemedText style={styles.eligibilityLabel}>Total Classes</ThemedText>
            </View>
            <View style={styles.eligibilityStat}>
              <ThemedText style={styles.eligibilityNumber}>{eligibility.presentCount}</ThemedText>
              <ThemedText style={styles.eligibilityLabel}>Present</ThemedText>
            </View>
          </View>

          <ThemedText style={styles.eligibilityMessage}>{eligibility.message}</ThemedText>

          {!eligibility.isEligible && eligibility.classesNeeded > 0 && (
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
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            value={onDutyForm.startDate}
            onChangeText={(text) => setOnDutyForm({ ...onDutyForm, startDate: text })}
          />
        </View>

        <View style={styles.formGroup}>
          <ThemedText style={styles.label}>End Date *</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            value={onDutyForm.endDate}
            onChangeText={(text) => setOnDutyForm({ ...onDutyForm, endDate: text })}
          />
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
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Tab Navigation */}
      <ThemedView style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'eligibility' && styles.activeTab]}
          onPress={() => setActiveTab('eligibility')}>
          <IconSymbol name="checkmark.seal" size={20} color={activeTab === 'eligibility' ? '#fff' : Colors[colorScheme ?? 'light'].text} />
          <ThemedText style={[styles.tabText, activeTab === 'eligibility' && styles.activeTabText]}>Eligibility</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'leave' && styles.activeTab]}
          onPress={() => setActiveTab('leave')}>
          <IconSymbol name="calendar.badge.plus" size={20} color={activeTab === 'leave' ? '#fff' : Colors[colorScheme ?? 'light'].text} />
          <ThemedText style={[styles.tabText, activeTab === 'leave' && styles.activeTabText]}>Leave</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'on-duty' && styles.activeTab]}
          onPress={() => setActiveTab('on-duty')}>
          <IconSymbol name="checkmark.circle.fill" size={20} color={activeTab === 'on-duty' ? '#fff' : Colors[colorScheme ?? 'light'].text} />
          <ThemedText style={[styles.tabText, activeTab === 'on-duty' && styles.activeTabText]}>On-Duty</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'absence' && styles.activeTab]}
          onPress={() => setActiveTab('absence')}>
          <IconSymbol name="doc.text" size={20} color={activeTab === 'absence' ? '#fff' : Colors[colorScheme ?? 'light'].text} />
          <ThemedText style={[styles.tabText, activeTab === 'absence' && styles.activeTabText]}>Reasons</ThemedText>
        </TouchableOpacity>
      </ThemedView>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
        </View>
      ) : (
        <View style={styles.content}>
          {activeTab === 'leave' && renderLeaveTab()}
          {activeTab === 'absence' && renderAbsenceTab()}
          {activeTab === 'eligibility' && renderEligibilityTab()}
          {activeTab === 'on-duty' && renderOnDutyTab()}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    padding: 10,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    gap: 4,
    position: 'relative',
  },
  activeTab: {
    backgroundColor: '#007AFF',
  },
  tabText: {
    fontSize: 11,
  },
  activeTabText: {
    color: '#fff',
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#F44336',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  content: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 50,
  },
  sectionTitle: {
    marginTop: 20,
    marginBottom: 12,
  },
  formCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  cardTitle: {
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#007AFF',
  },
  typeButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  submitButton: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  leaveCard: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  leaveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  leaveDate: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  leaveReason: {
    fontSize: 13,
    marginTop: 4,
    opacity: 0.8,
  },
  remarksText: {
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
    opacity: 0.7,
  },
  reasonCard: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  reasonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reasonType: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 13,
    opacity: 0.8,
  },
  alertCard: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  alertTitle: {
    marginTop: 12,
    textAlign: 'center',
  },
  alertMessage: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 14,
    opacity: 0.8,
  },
  alertStats: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 32,
  },
  alertStat: {
    alignItems: 'center',
  },
  alertStatNumber: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  alertStatLabel: {
    fontSize: 11,
    opacity: 0.7,
    marginTop: 4,
  },
  eligibilityCard: {
    padding: 20,
    borderRadius: 12,
  },
  eligibilityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  eligibilityStatus: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  eligibilityStatusText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  eligibilityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 20,
  },
  eligibilityStat: {
    width: '45%',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 8,
  },
  eligibilityNumber: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  eligibilityLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  eligibilityMessage: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.8,
    marginBottom: 16,
  },
  improvementTip: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    borderRadius: 8,
    alignItems: 'center',
  },
  improvementText: {
    flex: 1,
    fontSize: 13,
    color: '#FF9800',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 12,
    opacity: 0.6,
    fontSize: 14,
  },
  dutyCard: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  dutyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dutyDate: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  institution: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 4,
    fontWeight: '500',
  },
  dutyReason: {
    fontSize: 13,
    marginTop: 4,
    opacity: 0.8,
  },
});
