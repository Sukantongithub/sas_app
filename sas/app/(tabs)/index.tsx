import { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, View, ActivityIndicator, RefreshControl, Pressable } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/AuthContext';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { studentManagementAPI, messagingAPI } from '@/services/api';

interface StudentProfile {
  id: string;
  name: string;
  rollNumber: string;
  email: string;
  class: string;
  department?: string;
  status?: 'active' | 'inactive';
  attendancePercentage?: number;
  statistics?: {
    totalAttendance: number;
    presentCount: number;
    attendancePercentage: number;
  };
}

interface StudentRequest {
  _id?: string;
  id?: string;
  studentId: string;
  studentName?: string;
  leaveType?: string;
  type?: string;
  reason: string;
  startDate: string;
  endDate?: string;
  status?: string;
  isUrgent?: boolean;
}

export default function StudentsScreen() {
  const colorScheme = useColorScheme();
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState<'students' | 'requests' | 'analytics'>('students');
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [requests, setRequests] = useState<StudentRequest[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<StudentRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isTeacher = user?.role === 'teacher';
  const canManage = isAdmin || isTeacher;

  useEffect(() => {
    if (activeTab === 'students' && canManage) loadStudents();
    else if (activeTab === 'requests' && canManage) loadRequests();
  }, [activeTab]);

  const loadStudents = async () => {
    if (!token || !canManage) return;
    setLoading(true);
    try {
      const response = await studentManagementAPI.listStudents({ limit: 100 }, token);
      setStudents(response.students || []);
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRequests = async () => {
    if (!token || !canManage) return;
    setLoading(true);
    try {
      const response = await studentManagementAPI.getApprovalQueue(undefined, undefined, token);
      const all = [...(response.urgent || []), ...(response.normal || [])];
      setRequests(all);
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRequest = async () => {
    if (!selectedRequest || !token) return;
    try {
      const requestId = selectedRequest._id || selectedRequest.id || '';
      await studentManagementAPI.approveRequest(requestId, approvalNotes, undefined, token);
      Alert.alert('Success', 'Request approved');
      setSelectedRequest(null);
      setApprovalNotes('');
      await loadRequests();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleRejectRequest = async () => {
    if (!selectedRequest || !token || !approvalNotes.trim()) {
      Alert.alert('Error', 'Please provide a rejection reason');
      return;
    }
    try {
      const requestId = selectedRequest._id || selectedRequest.id || '';
      await studentManagementAPI.rejectRequest(requestId, approvalNotes, token);
      Alert.alert('Success', 'Request rejected');
      setSelectedRequest(null);
      setApprovalNotes('');
      await loadRequests();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  if (!canManage) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.accessDenied}>
          <IconSymbol name="exclamationmark.shield.fill" size={64} color="#F44336" />
          <ThemedText type="title" style={{ marginTop: 16 }}>Access Restricted</ThemedText>
          <ThemedText style={{ marginTop: 8, textAlign: 'center', opacity: 0.6 }}>
            Only teachers and admins can manage students
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
        setRefreshing(true);
        if (activeTab === 'students') loadStudents();
        else if (activeTab === 'requests') loadRequests();
        setRefreshing(false);
      }} />}
    >
      <ThemedView style={styles.header}>
        <ThemedText type="title">Student Management</ThemedText>
      </ThemedView>

      {/* Tabs */}
      <View style={styles.tabs}>
        {['students', 'requests', 'analytics'].map(tab => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab as any)}
            style={[styles.tab, activeTab === tab && { borderBottomColor: Colors[colorScheme ?? 'light'].tint, borderBottomWidth: 3 }]}>
            <IconSymbol
              name={tab === 'students' ? 'person.3.fill' : tab === 'requests' ? 'checkmark.circle.fill' : 'chart.bar.fill'}
              size={16}
              color={activeTab === tab ? Colors[colorScheme ?? 'light'].tint : '#94a3b8'}
            />
            <ThemedText style={[styles.tabText, activeTab === tab && { fontWeight: '700' }]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>

      {/* Students Tab */}
      {activeTab === 'students' && !selectedStudent && (
        <>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <ThemedText style={styles.statValue}>{students.length}</ThemedText>
              <ThemedText style={styles.statLabel}>Total</ThemedText>
            </View>
            <View style={styles.statCard}>
              <ThemedText style={styles.statValue}>{new Set(students.map(s => s.class)).size}</ThemedText>
              <ThemedText style={styles.statLabel}>Classes</ThemedText>
            </View>
            <View style={styles.statCard}>
              <ThemedText style={styles.statValue}>{students.filter(s => s.status === 'active').length}</ThemedText>
              <ThemedText style={styles.statLabel}>Active</ThemedText>
            </View>
          </View>

          <View style={styles.searchContainer}>
            <IconSymbol name="magnifyingglass" size={16} color="#94a3b8" />
            <TextInput
              style={[styles.searchInput, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}
              placeholder="Search students..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.studentsList}>
              {students.filter(s => 
                s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.rollNumber.toLowerCase().includes(searchQuery.toLowerCase())
              ).map(student => (
                <TouchableOpacity
                  key={student.id}
                  onPress={() => setSelectedStudent(student)}
                  style={styles.studentCard}>
                  <View style={styles.studentInfo}>
                    <ThemedText type="defaultSemiBold" style={styles.studentName}>
                      {student.name}
                    </ThemedText>
                    <View style={styles.studentMeta}>
                      <ThemedText style={styles.studentMod}>{student.rollNumber}</ThemedText>
                      <ThemedText style={styles.studentMod}>•</ThemedText>
                      <ThemedText style={styles.studentMod}>{student.class}</ThemedText>
                    </View>
                  </View>
                  <IconSymbol name="chevron.right" size={20} color="#cbd5e1" />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      )}

      {/* Student Detail */}
      {activeTab === 'students' && selectedStudent && (
        <ThemedView style={styles.detailCard}>
          <TouchableOpacity onPress={() => setSelectedStudent(null)} style={styles.closeButton}>
            <IconSymbol name="xmark.circle.fill" size={24} color="#94a3b8" />
          </TouchableOpacity>

          <ThemedText type="subtitle" style={{ marginBottom: 16 }}>{selectedStudent.name}</ThemedText>

          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Roll Number</ThemedText>
            <ThemedText style={styles.detailValue}>{selectedStudent.rollNumber}</ThemedText>
          </View>

          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Email</ThemedText>
            <ThemedText style={styles.detailValue}>{selectedStudent.email}</ThemedText>
          </View>

          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Class</ThemedText>
            <ThemedText style={styles.detailValue}>{selectedStudent.class}</ThemedText>
          </View>

          {selectedStudent.statistics && (
            <>
              <View style={[styles.divider, { marginVertical: 12 }]} />
              <ThemedText type="defaultSemiBold" style={{ marginBottom: 8 }}>Performance</ThemedText>
              <View style={styles.detailRow}>
                <ThemedText style={styles.detailLabel}>Attendance</ThemedText>
                <ThemedText style={styles.detailValue}>{selectedStudent.statistics.attendancePercentage?.toFixed(1)}%</ThemedText>
              </View>
              <View style={styles.detailRow}>
                <ThemedText style={styles.detailLabel}>Days Present</ThemedText>
                <ThemedText style={styles.detailValue}>{selectedStudent.statistics.presentCount}</ThemedText>
              </View>
            </>
          )}
        </ThemedView>
      )}

      {/* Requests Tab */}
      {activeTab === 'requests' && !selectedRequest && (
        <>
          {loading ? (
            <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.studentsList}>
              {requests.length === 0 ? (
                <ThemedView style={styles.emptyState}>
                  <IconSymbol name="checkmark.seal.fill" size={48} color="#cbd5e1" />
                  <ThemedText style={styles.emptyText}>No pending requests</ThemedText>
                </ThemedView>
              ) : (
                requests.map(req => (
                  <TouchableOpacity
                    key={req._id || req.id}
                    onPress={() => setSelectedRequest(req)}
                    style={[styles.studentCard, { borderLeftWidth: 4, borderLeftColor: req.isUrgent ? '#ff6b6b' : '#0ea5e9' }]}>
                    <View style={styles.studentInfo}>
                      <ThemedText type="defaultSemiBold">{req.studentName || 'Unknown'}</ThemedText>
                      <ThemedText style={styles.studentMod}>{req.leaveType}</ThemedText>
                      <ThemedText style={styles.studentEmail} numberOfLines={1}>{req.reason}</ThemedText>
                    </View>
                    <IconSymbol name="chevron.right" size={20} color="#cbd5e1" />
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </>
      )}

      {/* Request Detail */}
      {activeTab === 'requests' && selectedRequest && (
        <ThemedView style={styles.detailCard}>
          <TouchableOpacity onPress={() => setSelectedRequest(null)} style={styles.closeButton}>
            <IconSymbol name="xmark.circle.fill" size={24} color="#94a3b8" />
          </TouchableOpacity>

          <ThemedText type="subtitle" style={{ marginBottom: 16 }}>Request Details</ThemedText>

          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Student</ThemedText>
            <ThemedText style={styles.detailValue}>{selectedRequest.studentName}</ThemedText>
          </View>

          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Type</ThemedText>
            <ThemedText style={styles.detailValue}>{selectedRequest.leaveType}</ThemedText>
          </View>

          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Reason</ThemedText>
            <ThemedText style={[styles.detailValue, { maxWidth: '100%' }]}>{selectedRequest.reason}</ThemedText>
          </View>

          <View style={styles.divider} />

          <TextInput
            style={[styles.noteInput, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}
            placeholder="Add approval/rejection reason..."
            placeholderTextColor="#94a3b8"
            value={approvalNotes}
            onChangeText={setApprovalNotes}
            multiline
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity
              onPress={handleRejectRequest}
              style={[styles.actionBtn, { backgroundColor: '#ff6b6b20' }]}>
              <IconSymbol name="xmark.circle.fill" size={18} color="#ff6b6b" />
              <ThemedText style={{ color: '#ff6b6b', fontWeight: '600' }}>Reject</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleApproveRequest}
              style={[styles.actionBtn, { backgroundColor: '#51cf6620' }]}>
              <IconSymbol name="checkmark.circle.fill" size={18} color="#51cf66" />
              <ThemedText style={{ color: '#51cf66', fontWeight: '600' }}>Approve</ThemedText>
            </TouchableOpacity>
          </View>
        </ThemedView>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <>
          <View style={styles.analyticsGrid}>
            <View style={[styles.analyticsCard, { backgroundColor: 'rgba(15, 165, 233, 0.1)' }]}>
              <IconSymbol name="chart.line.uptrend.xyaxis" size={28} color="#0ea5e9" />
              <ThemedText style={styles.analyticsValue}>
                {students.length > 0 ? (students.reduce((acc, s) => acc + (s.attendancePercentage || 0), 0) / students.length).toFixed(1) : 0}%
              </ThemedText>
              <ThemedText style={styles.analyticsLabel}>Avg Attendance</ThemedText>
            </View>

            <View style={[styles.analyticsCard, { backgroundColor: 'rgba(255, 107, 107, 0.1)' }]}>
              <IconSymbol name="exclamationmark.circle.fill" size={28} color="#ff6b6b" />
              <ThemedText style={styles.analyticsValue}>
                {students.filter(s => (s.attendancePercentage || 0) < 75).length}
              </ThemedText>
              <ThemedText style={styles.analyticsLabel}>Low Attendance</ThemedText>
            </View>

            <View style={[styles.analyticsCard, { backgroundColor: 'rgba(81, 207, 102, 0.1)' }]}>
              <IconSymbol name="star.circle.fill" size={28} color="#51cf66" />
              <ThemedText style={styles.analyticsValue}>
                {students.filter(s => (s.attendancePercentage || 0) >= 90).length}
              </ThemedText>
              <ThemedText style={styles.analyticsLabel}>Excellent</ThemedText>
            </View>

            <View style={[styles.analyticsCard, { backgroundColor: 'rgba(37, 99, 235, 0.1)' }]}>
              <IconSymbol name="calendar.badge.checkmark" size={28} color="#2563eb" />
              <ThemedText style={styles.analyticsValue}>{requests.length}</ThemedText>
              <ThemedText style={styles.analyticsLabel}>Pending</ThemedText>
            </View>
          </View>

          <ThemedView style={styles.insightsCard}>
            <ThemedText type="defaultSemiBold" style={{ marginBottom: 12 }}>Key Insights</ThemedText>
            <View style={styles.insightItem}>
              <View style={[styles.insightDot, { backgroundColor: '#0ea5e9' }]} />
              <ThemedText style={styles.insightText}>
                {students.filter(s => (s.attendancePercentage || 0) >= 75).length}/{students.length} students have good attendance
              </ThemedText>
            </View>
            <View style={styles.insightItem}>
              <View style={[styles.insightDot, { backgroundColor: '#ff6b6b' }]} />
              <ThemedText style={styles.insightText}>
                {students.filter(s => (s.attendancePercentage || 0) < 75).length} students need support
              </ThemedText>
            </View>
            <View style={styles.insightItem}>
              <View style={[styles.insightDot, { backgroundColor: '#51cf66' }]} />
              <ThemedText style={styles.insightText}>
                {requests.length} requests pending approval
              </ThemedText>
            </View>
          </ThemedView>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  accessDenied: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  header: { marginBottom: 20, marginTop: 40 },
  tabs: { flexDirection: 'row', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(128, 128, 128, 0.2)' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 6 },
  tabText: { fontSize: 13, fontWeight: '500' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: 'rgba(128, 128, 128, 0.1)' },
  statValue: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  statLabel: { fontSize: 12, opacity: 0.6 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(128, 128, 128, 0.1)', marginBottom: 16, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  studentsList: { marginBottom: 20 },
  studentCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 10, marginBottom: 10, backgroundColor: 'rgba(128, 128, 128, 0.08)', gap: 12 },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 15, marginBottom: 4 },
  studentMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  studentMod: { fontSize: 12, opacity: 0.6 },
  studentEmail: { fontSize: 12, opacity: 0.5 },
  emptyState: { justifyContent: 'center', alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 16, opacity: 0.6 },
  detailCard: { padding: 16, borderRadius: 12, backgroundColor: 'rgba(128, 128, 128, 0.08)', marginBottom: 20 },
  closeButton: { alignSelf: 'flex-end', marginBottom: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(128, 128, 128, 0.1)' },
  detailLabel: { fontSize: 14, opacity: 0.6 },
  detailValue: { fontSize: 14, fontWeight: '500' },
  divider: { height: 1, backgroundColor: 'rgba(128, 128, 128, 0.1)' },
  noteInput: { borderWidth: 1, borderColor: 'rgba(128, 128, 128, 0.2)', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 14, textAlignVertical: 'top', height: 80 },
  buttonRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, gap: 6 },
  analyticsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  analyticsCard: { width: '48%', padding: 16, borderRadius: 12, alignItems: 'center', gap: 8 },
  analyticsValue: { fontSize: 22, fontWeight: '700' },
  analyticsLabel: { fontSize: 11, opacity: 0.6, textAlign: 'center' },
  insightsCard: { padding: 16, borderRadius: 12, backgroundColor: 'rgba(128, 128, 128, 0.08)', marginBottom: 20 },
  insightItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  insightDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  insightText: { flex: 1, fontSize: 13, lineHeight: 18 },
});
