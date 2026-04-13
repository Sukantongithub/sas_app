import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { IconSymbol } from './ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { studentManagementAPI } from '@/services/api';
import { useAuth } from '@/context/AuthContext';

interface ApprovalRequest {
  _id: string;
  __type: 'leave' | 'on_duty' | 'absence';
  requestType: string;
  studentName: string;
  reason: string;
  dates: string;
  status: string;
  createdAt: string;
  leaveType?: string;
  dutyType?: string;
  [key: string]: any;
}

interface ApprovalStats {
  total: number;
  byType: {
    leaves: number;
    onDuty: number;
    absenceReasons: number;
  };
}

export default function ApprovalDashboard() {
  const colorScheme = useColorScheme();
  const { token } = useAuth();
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [stats, setStats] = useState<ApprovalStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [remarks, setRemarks] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'leaves' | 'onduty' | 'absence'>('all');
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set());
  const [batchMode, setBatchMode] = useState(false);

  // Load on mount and when filter/token changes
  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token, filterType]);

  const loadData = async () => {
    if (!token) {
      console.warn('No token available for loadData');
      return;
    }
    
    setLoading(true);
    try {
      const [statsRes, requestsRes] = await Promise.all([
        studentManagementAPI.getApprovalStats(token),
        studentManagementAPI.getApprovalQueue(
          filterType === 'leaves' ? 'leave' : filterType === 'onduty' ? 'on_duty' : filterType === 'absence' ? 'absence' : undefined,
          token
        )
      ]);

      console.log('Stats Response:', statsRes);
      console.log('Requests Response:', requestsRes);

      setStats(statsRes.data);
      const allRequests = requestsRes.data?.requests || requestsRes.requests || [];
      
      console.log('Processed Requests:', allRequests);
      setRequests(allRequests);
    } catch (error) {
      console.error('Dashboard Load Error:', error);
      Alert.alert('Error', 'Failed to load approval dashboard: ' + (error as any)?.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest || !token) return;

    try {
      await studentManagementAPI.approveRequest(
        selectedRequest._id,
        remarks,
        undefined,
        token,
        selectedRequest.__type
      );
      Alert.alert('Success', 'Request approved');
      setModalVisible(false);
      setSelectedRequest(null);
      setRemarks('');
      await loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to approve request');
    }
  };

  const handleReject = async () => {
    if (!selectedRequest || !token) {
      Alert.alert('Error', 'Unable to reject request');
      return;
    }

    try {
      await studentManagementAPI.rejectRequest(
        selectedRequest._id,
        remarks || 'Rejected by staff', // Use default message if no reason provided
        token,
        selectedRequest.__type
      );
      Alert.alert('Success', 'Request rejected');
      setModalVisible(false);
      setSelectedRequest(null);
      setRemarks('');
      await loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to reject request');
    }
  };

  const handleBatchApprove = async () => {
    if (selectedRequests.size === 0 || !token) {
      Alert.alert('Error', 'No requests selected');
      return;
    }

    Alert.prompt(
      'Batch Approve',
      'Add comments (optional):',
      [
        {
          text: 'Cancel',
          onPress: () => { },
          style: 'cancel'
        },
        {
          text: 'Approve',
          onPress: async (comments: string | undefined) => {
            try {
              await studentManagementAPI.batchApproveRequests(
                Array.from(selectedRequests),
                comments || undefined,
                token
              );
              Alert.alert('Success', `Approved ${selectedRequests.size} requests`);
              setSelectedRequests(new Set());
              setBatchMode(false);
              await loadData();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Batch approval failed');
            }
          }
        }
      ],
      'plain-text'
    );
  };

  const handleBatchReject = async () => {
    if (selectedRequests.size === 0 || !token) {
      Alert.alert('Error', 'No requests selected');
      return;
    }

    Alert.prompt(
      'Batch Reject',
      'Enter rejection reason (required):',
      [
        {
          text: 'Cancel',
          onPress: () => { },
          style: 'cancel'
        },
        {
          text: 'Reject',
          onPress: async (reason: string | undefined) => {
            if (!reason?.trim()) {
              Alert.alert('Error', 'Rejection reason is required');
              return;
            }

            try {
              await studentManagementAPI.batchRejectRequests(
                Array.from(selectedRequests),
                reason,
                token
              );
              Alert.alert('Success', `Rejected ${selectedRequests.size} requests`);
              setSelectedRequests(new Set());
              setBatchMode(false);
              await loadData();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Batch rejection failed');
            }
          }
        }
      ],
      'plain-text'
    );
  };

  const toggleRequestSelection = (requestId: string) => {
    const newSelected = new Set(selectedRequests);
    if (newSelected.has(requestId)) {
      newSelected.delete(requestId);
    } else {
      newSelected.add(requestId);
    }
    setSelectedRequests(newSelected);
  };

  const getRequestIcon = (type: string) => {
    switch (type) {
      case 'leave':
        return 'calendar.badge.exclamationmark';
      case 'on_duty':
        return 'briefcase.fill';
      case 'absence':
        return 'questionmark.circle.fill';
      default:
        return 'doc.fill';
    }
  };

  const getRequestColor = (type: string) => {
    switch (type) {
      case 'leave':
        return '#3b82f6';
      case 'on_duty':
        return '#8b5cf6';
      case 'absence':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  };

  const StatBox = ({ label, count, type }: { label: string; count: number; type: string }) => (
    <TouchableOpacity
      style={[
        styles.statBox,
        { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground }
      ]}
      onPress={() => {
        if (type === 'leaves') setFilterType('leaves');
        else if (type === 'onduty') setFilterType('onduty');
        else if (type === 'absence') setFilterType('absence');
      }}
    >
      <View style={styles.statContent}>
        <ThemedText style={styles.statLabel}>{label}</ThemedText>
        <ThemedText type="defaultSemiBold" style={styles.statNumber}>
          {count}
        </ThemedText>
      </View>
      <IconSymbol
        name={type === 'leaves' ? 'calendar' : type === 'onduty' ? 'briefcase' : 'exclamationmark.circle'}
        size={24}
        color={getRequestColor(type === 'leaves' ? 'leave' : type === 'onduty' ? 'on_duty' : 'absence')}
      />
    </TouchableOpacity>
  );

  return (
    <ThemedView style={styles.container}>
      {/* Stats Header */}
      {stats && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.statsScroll}
          contentContainerStyle={styles.statsContainer}
        >
          <StatBox label="Total Pending" count={stats.total} type="total" />
          <StatBox label="Leaves" count={stats.byType.leaves} type="leaves" />
          <StatBox label="On-Duty" count={stats.byType.onDuty} type="onduty" />
          <StatBox label="Absence" count={stats.byType.absenceReasons} type="absence" />
        </ScrollView>
      )}

      {/* Filter & Batch Actions */}
      <View style={styles.controlPanel}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
        >
          {[
            { label: 'All', value: 'all' as const },
            { label: 'Leaves', value: 'leaves' as const },
            { label: 'On-Duty', value: 'onduty' as const },
            { label: 'Absence', value: 'absence' as const },
          ].map(filter => (
            <TouchableOpacity
              key={filter.value}
              style={[
                styles.filterButton,
                filterType === filter.value && styles.filterButtonActive
              ]}
              onPress={() => setFilterType(filter.value)}
            >
              <ThemedText
                style={[
                  styles.filterButtonText,
                  filterType === filter.value && styles.filterButtonTextActive
                ]}
              >
                {filter.label}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {batchMode && (
          <View style={styles.batchActions}>
            <TouchableOpacity
              style={styles.batchButton}
              onPress={() => {
                setBatchMode(false);
                setSelectedRequests(new Set());
              }}
            >
              <ThemedText style={styles.batchButtonText}>Cancel</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.batchButton, { backgroundColor: '#ef4444' }]}
              onPress={handleBatchReject}
              disabled={selectedRequests.size === 0}
            >
              <ThemedText style={styles.batchButtonText}>
                Reject ({selectedRequests.size})
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.batchButton, { backgroundColor: '#10b981' }]}
              onPress={handleBatchApprove}
              disabled={selectedRequests.size === 0}
            >
              <ThemedText style={styles.batchButtonText}>
                Approve ({selectedRequests.size})
              </ThemedText>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Requests List */}
      <FlatList
        data={requests}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData().finally(() => setRefreshing(false));
            }}
          />
        }
        ListHeaderComponent={
          batchMode ? (
            <TouchableOpacity
              style={styles.selectAllButton}
              onPress={() => {
                if (selectedRequests.size === requests.length) {
                  setSelectedRequests(new Set());
                } else {
                  setSelectedRequests(new Set(requests.map(r => r._id)));
                }
              }}
            >
              <IconSymbol
                name={selectedRequests.size === requests.length ? 'checkmark.square.fill' : 'square'}
                size={20}
                color={Colors[colorScheme ?? 'light'].tint}
              />
              <ThemedText style={styles.selectAllText}>
                {selectedRequests.size === requests.length ? 'Deselect All' : 'Select All'}
              </ThemedText>
            </TouchableOpacity>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.requestCard,
              { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground },
            ]}
            onPress={() => {
              if (batchMode) {
                toggleRequestSelection(item._id);
              } else {
                setSelectedRequest(item);
                setModalVisible(true);
              }
            }}
            onLongPress={() => {
              if (!batchMode) {
                setBatchMode(true);
                setSelectedRequests(new Set([item._id]));
              }
            }}
          >
            {batchMode && (
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => toggleRequestSelection(item._id)}
              >
                <IconSymbol
                  name={selectedRequests.has(item._id) ? 'checkmark.square.fill' : 'square'}
                  size={20}
                  color={Colors[colorScheme ?? 'light'].tint}
                />
              </TouchableOpacity>
            )}

            <View style={styles.requestContent}>
              <View style={styles.requestHeaderRow}>
                <View style={[
                  styles.typeIndicator,
                  { backgroundColor: getRequestColor(item.__type) }
                ]} />
                <View style={styles.requestMainInfo}>
                  <ThemedText type="defaultSemiBold" style={styles.requestTitle}>
                    {item.studentName}
                  </ThemedText>
                  <View style={styles.requestMeta}>
                    <View style={[styles.typeBadge, { backgroundColor: getRequestColor(item.__type) + '20' }]}>
                      <IconSymbol
                        name={getRequestIcon(item.__type)}
                        size={14}
                        color={getRequestColor(item.__type)}
                      />
                      <ThemedText style={[styles.typeBadgeText, { color: getRequestColor(item.__type) }]}>
                        {item.requestType}
                      </ThemedText>
                    </View>
                  </View>
                </View>
              </View>

              <ThemedText style={styles.requestReason} numberOfLines={2}>
                {item.reason}
              </ThemedText>

              <View style={styles.requestFooter}>
                <ThemedText style={styles.requestDate}>
                  {item.dates}
                </ThemedText>
                <ThemedText style={styles.requestTime}>
                  {new Date(item.createdAt).toLocaleDateString()}
                </ThemedText>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator
                size="large"
                color={Colors[colorScheme ?? 'light'].tint}
              />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <IconSymbol name="checkmark.circle.fill" size={64} color="#10b981" />
              <ThemedText style={styles.emptyText}>All clear!</ThemedText>
              <ThemedText style={styles.emptyHint}>No pending requests</ThemedText>
            </View>
          )
        }
      />

      {/* Toggle Batch Mode Button */}
      {requests.length > 0 && !batchMode && (
        <TouchableOpacity
          style={styles.batchToggleButton}
          onPress={() => setBatchMode(true)}
        >
          <IconSymbol name="square.stack.fill" size={20} color="#fff" />
          <ThemedText style={styles.batchToggleText}>Batch</ThemedText>
        </TouchableOpacity>
      )}

      {/* Approval Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        onRequestClose={() => {
          setModalVisible(false);
          setRemarks('');
        }}
      >
        <ThemedView style={styles.modal}>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => {
              setModalVisible(false);
              setRemarks('');
            }}
          >
            <IconSymbol name="xmark" size={24} color={Colors[colorScheme ?? 'light'].text} />
          </TouchableOpacity>

          {selectedRequest && (
            <ScrollView style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={[
                  styles.modalTypeIcon,
                  { backgroundColor: getRequestColor(selectedRequest.__type) + '20' }
                ]}>
                  <IconSymbol
                    name={getRequestIcon(selectedRequest.__type)}
                    size={40}
                    color={getRequestColor(selectedRequest.__type)}
                  />
                </View>
                <ThemedText type="defaultSemiBold" style={styles.modalTitle}>
                  {selectedRequest.requestType} Request
                </ThemedText>
                <ThemedText style={styles.modalSubtitle}>
                  {selectedRequest.studentName}
                </ThemedText>
              </View>

              <View style={styles.modalSection}>
                <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                  Details
                </ThemedText>
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Type:</ThemedText>
                  <ThemedText style={styles.detailValue}>
                    {selectedRequest.leaveType || selectedRequest.dutyType || 'N/A'}
                  </ThemedText>
                </View>
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Dates:</ThemedText>
                  <ThemedText style={styles.detailValue}>
                    {selectedRequest.dates}
                  </ThemedText>
                </View>
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Reason:</ThemedText>
                  <ThemedText style={styles.detailValue}>
                    {selectedRequest.reason}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.remarksSection}>
                <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                  Your Comments
                </ThemedText>
                <TextInput
                  style={[
                    styles.remarksInput,
                    {
                      color: colorScheme === 'dark' ? '#fff' : '#000',
                      borderColor: Colors[colorScheme ?? 'light'].border
                    }
                  ]}
                  placeholder="Add comments or rejection reason..."
                  placeholderTextColor="#94a3b8"
                  value={remarks}
                  onChangeText={setRemarks}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: '#ef4444' }]}
                  onPress={handleReject}
                >
                  <IconSymbol name="xmark.circle" size={20} color="#fff" />
                  <ThemedText style={styles.actionButtonText}>Reject</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: '#10b981' }]}
                  onPress={handleApprove}
                >
                  <IconSymbol name="checkmark.circle" size={20} color="#fff" />
                  <ThemedText style={styles.actionButtonText}>Approve</ThemedText>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statsScroll: {
    paddingHorizontal: 12,
  },
  statsContainer: {
    paddingVertical: 10,
    gap: 10,
  },
  statBox: {
    borderRadius: 12,
    padding: 12,
    marginRight: 10,
    minWidth: 140,
    maxWidth: 160,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  statContent: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    opacity: 0.7,
    marginBottom: 4,
  },
  statNumber: {
    fontSize: 24,
  },
  controlPanel: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  filterScroll: {
    marginBottom: 8,
  },
  filterButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
    marginRight: 6,
  },
  filterButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  filterButtonText: {
    fontSize: 11,
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  batchActions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  batchButton: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
  },
  batchButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  selectAllText: {
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 100,
  },
  requestCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  checkbox: {
    paddingRight: 8,
    paddingTop: 4,
  },
  typeIndicator: {
    width: 3,
    height: 55,
    borderRadius: 2,
    marginRight: 3,
  },
  requestContent: {
    flex: 1,
  },
  requestHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  requestMainInfo: {
    flex: 1,
  },
  requestTitle: {
    fontSize: 15,
    marginBottom: 4,
    fontWeight: '600',
  },
  requestMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  requestReason: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 8,
    lineHeight: 16,
  },
  requestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  requestDate: {
    fontSize: 12,
    opacity: 0.6,
  },
  requestTime: {
    fontSize: 12,
    opacity: 0.5,
  },
  loadingState: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    height: 400,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyHint: {
    fontSize: 14,
    opacity: 0.6,
    marginTop: 8,
  },
  batchToggleButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  batchToggleText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  modal: {
    flex: 1,
    paddingTop: 60,
  },
  modalCloseButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignSelf: 'flex-end',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 14,
    paddingBottom: 20,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTypeIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    marginBottom: 4,
    fontWeight: '600',
  },
  modalSubtitle: {
    fontSize: 14,
    opacity: 0.6,
  },
  modalSection: {
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    paddingBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    marginBottom: 10,
    fontWeight: '600',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    gap: 12,
    alignItems: 'flex-start',
  },
  detailLabel: {
    fontSize: 13,
    opacity: 0.6,
    fontWeight: '500',
    minWidth: 50,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
    flexWrap: 'wrap',
  },
  remarksSection: {
    marginBottom: 20,
  },
  remarksInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    minHeight: 90,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
    paddingBottom: 40,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
