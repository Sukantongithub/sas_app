import { useState, useEffect } from 'react';
import { StyleSheet, FlatList, TextInput, TouchableOpacity, Alert, View, ActivityIndicator, RefreshControl, Modal } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/AuthContext';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { studentManagementAPI } from '@/services/api';

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
  studentId: any;
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
      <View style={styles.container}>
        <View style={styles.accessDenied}>
          <View style={styles.iconCircle}>
            <IconSymbol name="lock.fill" size={48} color="#F44336" />
          </View>
          <ThemedText type="title" style={styles.accessTitle}>Access Restricted</ThemedText>
          <ThemedText style={styles.accessText}>
            Only teachers and admins can manage students
          </ThemedText>
        </View>
      </View>
    );
  }

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.rollNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      {/* Gradient Hero Header */}
      <View style={[styles.heroHeader, { backgroundColor: Colors[colorScheme ?? 'light'].tint + '12' }]}>
        <View style={styles.heroContent}>
          <View style={{ flex: 1 }}>
            <ThemedText type="title" style={styles.heroTitle}>Student Management</ThemedText>
            <ThemedText style={styles.heroSubtitle}>Track attendance & manage requests</ThemedText>
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <IconSymbol name="person.3.fill" size={18} color={Colors[colorScheme ?? 'light'].tint} />
              <ThemedText style={styles.heroStatNumber}>{students.length}</ThemedText>
              <ThemedText style={styles.heroStatLabel}>Students</ThemedText>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <IconSymbol name="bell.badge.fill" size={18} color={Colors[colorScheme ?? 'light'].tint} />
              <ThemedText style={styles.heroStatNumber}>{requests.length}</ThemedText>
              <ThemedText style={styles.heroStatLabel}>Requests</ThemedText>
            </View>
          </View>
        </View>
      </View>
      
      {/* Segmented Control Style Tabs */}
      <View style={styles.segmentedControl}>
        {[
          { key: 'students', icon: 'person.3.fill' as const, label: 'Students' },
          { key: 'requests', icon: 'bell.badge.fill' as const, label: 'Requests' },
          { key: 'analytics', icon: 'chart.bar.fill' as const, label: 'Stats' }
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key as any)}
            style={[
              styles.segment,
              activeTab === tab.key && styles.segmentActive
            ]}>
            <IconSymbol
              name={tab.icon}
              size={20}
              color={activeTab === tab.key ? '#fff' : colorScheme === 'dark' ? '#94a3b8' : '#64748b'}
            />
            <ThemedText style={[
              styles.segmentText,
              activeTab === tab.key && styles.segmentTextActive
            ]}>
              {tab.label}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>

      {/* Students Tab */}
      {activeTab === 'students' && (
        <FlatList
          data={filteredStudents}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={() => {
                setRefreshing(true);
                loadStudents().finally(() => setRefreshing(false));
              }} 
            />
          }
          ListHeaderComponent={
            <>
              {/* Mini Stats */}
              <View style={styles.miniStats}>
                <View style={styles.miniStatItem}>
                  <IconSymbol name="person.3.fill" size={18} color={Colors[colorScheme ?? 'light'].tint} />
                  <ThemedText style={styles.miniStatValue}>{students.length}</ThemedText>
                </View>
                <View style={styles.miniStatDivider} />
                <View style={styles.miniStatItem}>
                  <IconSymbol name="graduationcap.fill" size={18} color={Colors[colorScheme ?? 'light'].tint} />
                  <ThemedText style={styles.miniStatValue}>{new Set(students.map(s => s.class)).size} Classes</ThemedText>
                </View>
                <View style={styles.miniStatDivider} />
                <View style={styles.miniStatItem}>
                  <IconSymbol name="checkmark.circle.fill" size={18} color="#51cf66" />
                  <ThemedText style={styles.miniStatValue}>{students.filter(s => s.status === 'active').length}</ThemedText>
                </View>
              </View>

              {/* Search Bar */}
              <View style={styles.searchBar}>
                <View style={styles.searchIcon}>
                  <IconSymbol name="magnifyingglass" size={18} color="#94a3b8" />
                </View>
                <TextInput
                  style={[styles.searchInput, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}
                  placeholder="Search by name or roll number..."
                  placeholderTextColor="#94a3b8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                    <IconSymbol name="xmark.circle.fill" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>
            </>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setSelectedStudent(item)}
              style={styles.studentCard}
              activeOpacity={0.7}>
              <View style={styles.avatarCircle}>
                <ThemedText style={styles.avatarText}>
                  {item.name.charAt(0).toUpperCase()}
                </ThemedText>
              </View>
              <View style={styles.studentInfo}>
                <ThemedText type="defaultSemiBold" style={styles.studentName}>
                  {item.name}
                </ThemedText>
                <View style={styles.studentMeta}>
                  <ThemedText style={styles.metaText}>{item.rollNumber}</ThemedText>
                  <View style={styles.dot} />
                  <ThemedText style={styles.metaText}>{item.class}</ThemedText>
                </View>
              </View>
              <View style={styles.attendanceBadge}>
                <ThemedText style={styles.badgeText}>
                  {item.attendancePercentage?.toFixed(0) || '0'}%
                </ThemedText>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            loading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
              </View>
            ) : (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <IconSymbol name="person.crop.circle.badge.xmark" size={64} color="#cbd5e1" />
                </View>
                <ThemedText style={styles.emptyText}>No students found</ThemedText>
                <ThemedText style={styles.emptyHint}>Try adjusting your search</ThemedText>
              </View>
            )
          }
        />
      )}

      {/* Requests Tab */}
      {activeTab === 'requests' && (
        <FlatList
          data={requests}
          keyExtractor={(item) => item._id || item.id || ''}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={() => {
                setRefreshing(true);
                loadRequests().finally(() => setRefreshing(false));
              }} 
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setSelectedRequest(item)}
              style={styles.requestCard}
              activeOpacity={0.7}>
              {item.isUrgent && <View style={styles.urgentIndicator} />}
              <View style={styles.requestHeader}>
                <View style={styles.requestAvatar}>
                  <IconSymbol 
                    name={item.isUrgent ? "exclamationmark.triangle.fill" : "person.crop.circle.fill"} 
                    size={24} 
                    color={item.isUrgent ? '#ff6b6b' : Colors[colorScheme ?? 'light'].tint} 
                  />
                </View>
                <View style={styles.requestInfo}>
                  <ThemedText type="defaultSemiBold" style={styles.requestName}>
                    {item.studentName || 'Unknown Student'}
                  </ThemedText>
                  <View style={styles.requestBadge}>
                    <ThemedText style={styles.requestBadgeText}>{item.leaveType}</ThemedText>
                  </View>
                </View>
                <IconSymbol name="chevron.right" size={20} color="#94a3b8" />
              </View>
              <ThemedText style={styles.requestReason} numberOfLines={2}>
                {item.reason}
              </ThemedText>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            loading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
              </View>
            ) : (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <IconSymbol name="tray.fill" size={64} color="#cbd5e1" />
                </View>
                <ThemedText style={styles.emptyText}>All clear!</ThemedText>
                <ThemedText style={styles.emptyHint}>No pending requests</ThemedText>
              </View>
            )
          }
        />
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <FlatList
          data={[]}
          renderItem={null}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={() => {
                setRefreshing(true);
                loadStudents().finally(() => setRefreshing(false));
              }} 
            />
          }
          ListHeaderComponent={
            <>
              <View style={styles.statsGrid}>
                <View style={[styles.statCardLarge, { backgroundColor: 'rgba(15, 165, 233, 0.08)' }]}>
                  <View style={styles.statIconCircle}>
                    <IconSymbol name="chart.line.uptrend.xyaxis" size={32} color="#0ea5e9" />
                  </View>
                  <ThemedText style={styles.statValueLarge}>
                    {students.length > 0 ? (students.reduce((acc, s) => acc + (s.attendancePercentage || 0), 0) / students.length).toFixed(1) : 0}%
                  </ThemedText>
                  <ThemedText style={styles.statLabelLarge}>Average Attendance</ThemedText>
                </View>

                <View style={[styles.statCardLarge, { backgroundColor: 'rgba(255, 107, 107, 0.08)' }]}>
                  <View style={styles.statIconCircle}>
                    <IconSymbol name="exclamationmark.triangle.fill" size={32} color="#ff6b6b" />
                  </View>
                  <ThemedText style={styles.statValueLarge}>
                    {students.filter(s => (s.attendancePercentage || 0) < 75).length}
                  </ThemedText>
                  <ThemedText style={styles.statLabelLarge}>Below 75%</ThemedText>
                </View>

                <View style={[styles.statCardLarge, { backgroundColor: 'rgba(81, 207, 102, 0.08)' }]}>
                  <View style={styles.statIconCircle}>
                    <IconSymbol name="star.fill" size={32} color="#51cf66" />
                  </View>
                  <ThemedText style={styles.statValueLarge}>
                    {students.filter(s => (s.attendancePercentage || 0) >= 90).length}
                  </ThemedText>
                  <ThemedText style={styles.statLabelLarge}>Excellent (≥90%)</ThemedText>
                </View>

                <View style={[styles.statCardLarge, { backgroundColor: 'rgba(245, 158, 11, 0.08)' }]}>
                  <View style={styles.statIconCircle}>
                    <IconSymbol name="clock.badge.checkmark.fill" size={32} color="#f59e0b" />
                  </View>
                  <ThemedText style={styles.statValueLarge}>{requests.length}</ThemedText>
                  <ThemedText style={styles.statLabelLarge}>Pending Requests</ThemedText>
                </View>
              </View>

              <View style={styles.insightsList}>
                <ThemedText type="defaultSemiBold" style={styles.insightsTitle}>
                  Quick Insights
                </ThemedText>
                
                <View style={styles.insightCard}>
                  <View style={[styles.insightIndicator, { backgroundColor: '#0ea5e9' }]} />
                  <View style={styles.insightContent}>
                    <ThemedText style={styles.insightText}>
                      {students.filter(s => (s.attendancePercentage || 0) >= 75).length} out of {students.length} students meeting attendance requirement
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.insightCard}>
                  <View style={[styles.insightIndicator, { backgroundColor: '#ff6b6b' }]} />
                  <View style={styles.insightContent}>
                    <ThemedText style={styles.insightText}>
                      {students.filter(s => (s.attendancePercentage || 0) < 75).length} students need academic counseling for low attendance
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.insightCard}>
                  <View style={[styles.insightIndicator, { backgroundColor: '#51cf66' }]} />
                  <View style={styles.insightContent}>
                    <ThemedText style={styles.insightText}>
                      {students.filter(s => (s.attendancePercentage || 0) >= 90).length} students showing excellent attendance performance
                    </ThemedText>
                  </View>
                </View>
              </View>
            </>
          }
        />
      )}

      {/* Student Detail Modal */}
      <Modal
        visible={selectedStudent !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedStudent(null)}>
        <View style={[styles.modalContainer, { backgroundColor: colorScheme === 'dark' ? '#000' : '#f8fafc' }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSelectedStudent(null)} style={styles.backBtn}>
              <IconSymbol name="chevron.left" size={24} color={Colors[colorScheme ?? 'light'].tint} />
            </TouchableOpacity>
            <ThemedText type="defaultSemiBold" style={styles.modalTitle}>Student Profile</ThemedText>
            <View style={{ width: 40 }} />
          </View>

          {selectedStudent && (
            <FlatList
              contentContainerStyle={styles.modalContent}
              data={[]}
              renderItem={null}
              ListHeaderComponent={
                <>
                  {/* Profile Header */}
                  <View style={styles.profileHeader}>
                    <View style={styles.largeAvatar}>
                      <ThemedText style={styles.largeAvatarText}>
                        {selectedStudent.name.charAt(0).toUpperCase()}
                      </ThemedText>
                    </View>
                    <ThemedText type="title" style={styles.profileName}>
                      {selectedStudent.name}
                    </ThemedText>
                    <ThemedText style={styles.profileSubtext}>
                      {selectedStudent.rollNumber}
                    </ThemedText>
                  </View>

                  {/* Info Cards */}
                  <View style={styles.infoCard}>
                    <View style={styles.infoRow}>
                      <View style={styles.infoIconContainer}>
                        <IconSymbol name="envelope.fill" size={20} color={Colors[colorScheme ?? 'light'].tint} />
                      </View>
                      <View style={styles.infoContent}>
                        <ThemedText style={styles.infoLabel}>Email Address</ThemedText>
                        <ThemedText style={styles.infoValue}>{selectedStudent.email}</ThemedText>
                      </View>
                    </View>
                  </View>

                  <View style={styles.infoCard}>
                    <View style={styles.infoRow}>
                      <View style={styles.infoIconContainer}>
                        <IconSymbol name="building.2.fill" size={20} color={Colors[colorScheme ?? 'light'].tint} />
                      </View>
                      <View style={styles.infoContent}>
                        <ThemedText style={styles.infoLabel}>Class</ThemedText>
                        <ThemedText style={styles.infoValue}>{selectedStudent.class}</ThemedText>
                      </View>
                    </View>
                  </View>

                  {selectedStudent.statistics && (
                    <>
                      <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                        Performance Overview
                      </ThemedText>

                      <View style={styles.performanceGrid}>
                        <View style={styles.performanceCard}>
                          <IconSymbol name="chart.pie.fill" size={32} color="#0ea5e9" />
                          <ThemedText style={styles.perfValue}>
                            {selectedStudent.statistics.attendancePercentage?.toFixed(1)}%
                          </ThemedText>
                          <ThemedText style={styles.perfLabel}>Attendance</ThemedText>
                        </View>

                        <View style={styles.performanceCard}>
                          <IconSymbol name="checkmark.circle.fill" size={32} color="#51cf66" />
                          <ThemedText style={styles.perfValue}>
                            {selectedStudent.statistics.presentCount}
                          </ThemedText>
                          <ThemedText style={styles.perfLabel}>Days Present</ThemedText>
                        </View>

                        <View style={styles.performanceCard}>
                          <IconSymbol name="calendar" size={32} color="#f59e0b" />
                          <ThemedText style={styles.perfValue}>
                            {selectedStudent.statistics.totalAttendance}
                          </ThemedText>
                          <ThemedText style={styles.perfLabel}>Total Classes</ThemedText>
                        </View>
                      </View>
                    </>
                  )}
                </>
              }
            />
          )}
        </View>
      </Modal>

      {/* Request Detail Modal */}
      <Modal
        visible={selectedRequest !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedRequest(null)}>
        <View style={[styles.modalContainer, { backgroundColor: colorScheme === 'dark' ? '#000' : '#f8fafc' }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSelectedRequest(null)} style={styles.backBtn}>
              <IconSymbol name="chevron.left" size={24} color={Colors[colorScheme ?? 'light'].tint} />
            </TouchableOpacity>
            <ThemedText type="defaultSemiBold" style={styles.modalTitle}>Request Details</ThemedText>
            <View style={{ width: 40 }} />
          </View>

          {selectedRequest && (
            <FlatList
              contentContainerStyle={styles.modalContent}
              data={[]}
              renderItem={null}
              ListHeaderComponent={
                <>
                  <View style={styles.infoCard}>
                    <View style={styles.infoRow}>
                      <View style={styles.infoIconContainer}>
                        <IconSymbol name="person.fill" size={20} color={Colors[colorScheme ?? 'light'].tint} />
                      </View>
                      <View style={styles.infoContent}>
                        <ThemedText style={styles.infoLabel}>Student</ThemedText>
                        <ThemedText style={styles.infoValue}>{selectedRequest.studentName}</ThemedText>
                      </View>
                    </View>
                  </View>

                  <View style={styles.infoCard}>
                    <View style={styles.infoRow}>
                      <View style={styles.infoIconContainer}>
                        <IconSymbol name="list.bullet.clipboard.fill" size={20} color={Colors[colorScheme ?? 'light'].tint} />
                      </View>
                      <View style={styles.infoContent}>
                        <ThemedText style={styles.infoLabel}>Request Type</ThemedText>
                        <ThemedText style={styles.infoValue}>{selectedRequest.leaveType}</ThemedText>
                      </View>
                    </View>
                  </View>

                  <View style={styles.infoCard}>
                    <View style={styles.infoRow}>
                      <View style={styles.infoIconContainer}>
                        <IconSymbol name="text.bubble.fill" size={20} color={Colors[colorScheme ?? 'light'].tint} />
                      </View>
                      <View style={styles.infoContent}>
                        <ThemedText style={styles.infoLabel}>Reason</ThemedText>
                        <ThemedText style={styles.infoValue}>{selectedRequest.reason}</ThemedText>
                      </View>
                    </View>
                  </View>

                  <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                    Your Decision
                  </ThemedText>

                  <View style={styles.inputCard}>
                    <TextInput
                      style={[styles.textarea, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}
                      placeholder="Add notes or comments..."
                      placeholderTextColor="#94a3b8"
                      value={approvalNotes}
                      onChangeText={setApprovalNotes}
                      multiline
                      numberOfLines={4}
                    />
                  </View>

                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      onPress={handleRejectRequest}
                      style={styles.rejectButton}
                      activeOpacity={0.8}>
                      <IconSymbol name="xmark.circle.fill" size={22} color="#fff" />
                      <ThemedText style={styles.rejectText}>Reject</ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handleApproveRequest}
                      style={styles.approveButton}
                      activeOpacity={0.8}>
                      <IconSymbol name="checkmark.circle.fill" size={22} color="#fff" />
                      <ThemedText style={styles.approveText}>Approve</ThemedText>
                    </TouchableOpacity>
                  </View>
                </>
              }
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  accessDenied: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  iconCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(244, 67, 54, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  accessTitle: { marginBottom: 12 },
  accessText: { textAlign: 'center', opacity: 0.6, lineHeight: 22 },
  
  // Hero Header
  heroHeader: { 
    paddingHorizontal: 16, 
    paddingTop: 16, 
    paddingBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  heroContent: { 
    flexDirection: 'row', 
    alignItems: 'center',
    gap: 16,
  },
  heroTitle: { 
    marginBottom: 2,
  },
  heroSubtitle: { 
    fontSize: 12, 
    opacity: 0.6,
  },
  heroStats: { 
    flexDirection: 'row', 
    alignItems: 'center',
    gap: 12,
  },
  heroStat: { 
    alignItems: 'center', 
    gap: 4,
  },
  heroStatNumber: { 
    fontSize: 18, 
    fontWeight: '700',
  },
  heroStatLabel: { 
    fontSize: 10, 
    opacity: 0.6,
    fontWeight: '500',
  },
  heroStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
  },
  
  // Segmented Control
  segmentedControl: { flexDirection: 'row', margin: 16, padding: 4, backgroundColor: 'rgba(128, 128, 128, 0.08)', borderRadius: 12, gap: 4 },
  segment: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, gap: 6 },
  segmentActive: { backgroundColor: '#007AFF', shadowColor: '#007AFF', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 },
  segmentText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  segmentTextActive: { color: '#fff' },
  
  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 20 },
  
  // Mini Stats
  miniStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 16, marginBottom: 12, backgroundColor: 'rgba(128, 128, 128, 0.05)', borderRadius: 16 },
  miniStatItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniStatValue: { fontSize: 14, fontWeight: '700' },
  miniStatDivider: { width: 1, height: 20, backgroundColor: 'rgba(128, 128, 128, 0.2)' },
  
  // Search
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(128, 128, 128, 0.08)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  clearButton: { marginLeft: 10 },
  
  // Student Card
  studentCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(128, 128, 128, 0.04)', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  avatarCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 16, marginBottom: 4, fontWeight: '600' },
  studentMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 13, opacity: 0.6 },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#94a3b8' },
  attendanceBadge: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(15, 165, 233, 0.12)', borderRadius: 12 },
  badgeText: { fontSize: 14, fontWeight: '700', color: '#0ea5e9' },
  
  // Request Card
  requestCard: { backgroundColor: 'rgba(128, 128, 128, 0.04)', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  urgentIndicator: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: '#ff6b6b', borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
  requestHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  requestAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(128, 128, 128, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  requestInfo: { flex: 1 },
  requestName: { fontSize: 15, marginBottom: 4 },
  requestBadge: { paddingHorizontal: 8, paddingVertical: 3, backgroundColor: 'rgba(59, 130, 246, 0.12)', borderRadius: 6, alignSelf: 'flex-start' },
  requestBadgeText: { fontSize: 11, fontWeight: '600', color: '#3b82f6' },
  requestReason: { fontSize: 14, opacity: 0.7, lineHeight: 20 },
  
  // Empty State
  loadingState: { paddingVertical: 80, alignItems: 'center' },
  emptyState: { paddingVertical: 80, alignItems: 'center' },
  emptyIcon: { marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptyHint: { fontSize: 14, opacity: 0.5 },
  
  // Modal
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(128, 128, 128, 0.1)' },
  backBtn: { padding: 4 },
  modalTitle: { fontSize: 17 },
  modalContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },
  
  // Profile Header
  profileHeader: { alignItems: 'center', marginBottom: 32 },
  largeAvatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', marginBottom: 16, shadowColor: '#007AFF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  largeAvatarText: { color: '#fff', fontSize: 40, fontWeight: '700' },
  profileName: { marginBottom: 6 },
  profileSubtext: { fontSize: 15, opacity: 0.6 },
  
  // Info Card
  infoCard: { backgroundColor: 'rgba(128, 128, 128, 0.04)', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 2, elevation: 1 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start' },
  infoIconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0, 122, 255, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  infoContent: { flex: 1, paddingTop: 2 },
  infoLabel: { fontSize: 12, opacity: 0.6, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 15, fontWeight: '500', lineHeight: 22 },
  
  // Section
  sectionTitle: { fontSize: 18, marginTop: 24, marginBottom: 16 },
  
  // Performance
  performanceGrid: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  performanceCard: { flex: 1, backgroundColor: 'rgba(128, 128, 128, 0.04)', borderRadius: 16, padding: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 2, elevation: 1 },
  perfValue: { fontSize: 24, fontWeight: '700', marginTop: 12, marginBottom: 4 },
  perfLabel: { fontSize: 12, opacity: 0.6, textAlign: 'center' },
  
  // Input
  inputCard: { backgroundColor: 'rgba(128, 128, 128, 0.04)', borderRadius: 16, padding: 16, marginBottom: 20 },
  textarea: { fontSize: 15, minHeight: 100, textAlignVertical: 'top' },
  
  // Action Buttons
  actionButtons: { flexDirection: 'row', gap: 12 },
  rejectButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ff6b6b', paddingVertical: 16, borderRadius: 14, gap: 8, shadowColor: '#ff6b6b', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  rejectText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  approveButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#51cf66', paddingVertical: 16, borderRadius: 14, gap: 8, shadowColor: '#51cf66', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  approveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  
  // Analytics
  statsGrid: { gap: 12, marginBottom: 24 },
  statCardLarge: { borderRadius: 20, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  statIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255, 255, 255, 0.5)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  statValueLarge: { fontSize: 32, fontWeight: '800', marginBottom: 4 },
  statLabelLarge: { fontSize: 13, opacity: 0.7 },
  
  // Insights
  insightsList: { marginTop: 8 },
  insightsTitle: { fontSize: 18, marginBottom: 16 },
  insightCard: { flexDirection: 'row', backgroundColor: 'rgba(128, 128, 128, 0.04)', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 2, elevation: 1 },
  insightIndicator: { width: 4, borderRadius: 2, marginRight: 14 },
  insightContent: { flex: 1 },
  insightText: { fontSize: 14, lineHeight: 21, opacity: 0.85 },
});
