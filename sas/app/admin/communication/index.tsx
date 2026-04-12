import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  FlatList,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';
import AdminHeader from '../AdminHeader';

const API_BASE_URL = 'http://localhost:5000/api';

interface Notification {
  _id: string;
  type: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  isRead: boolean;
  createdAt: string;
  data?: any;
}

interface Staff {
  _id: string;
  name: string;
  email: string;
  role: string;
}

interface AlertType {
  value: string;
  label: string;
}

interface Priority {
  value: string;
  label: string;
  color: string;
}

export default function CommunicationScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { token } = useAuth();

  const [tab, setTab] = useState<'notifications' | 'send-alert'>('notifications');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // Alert sending state
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertPriority, setAlertPriority] = useState('high');
  const [alertType, setAlertType] = useState('general');
  const [alertTypes, setAlertTypes] = useState<AlertType[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [searchStaff, setSearchStaff] = useState('');

  useEffect(() => {
    if (tab === 'notifications') {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 15000);
      return () => clearInterval(interval);
    } else {
      fetchAlertOptions();
      fetchStaffRecipients();
    }
  }, [tab, token]);

  const fetchNotifications = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const result = await response.json();
        setNotifications(result.notifications || []);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlertOptions = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/notifications/admin/alert-types`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const result = await response.json();
        setAlertTypes(result.alertTypes);
        setPriorities(result.priorities);
      }
    } catch (error) {
      console.error('Failed to fetch alert options:', error);
    }
  };

  const fetchStaffRecipients = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchStaff) params.append('search', searchStaff);

      const response = await fetch(
        `${API_BASE_URL}/notifications/admin/recipients?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const result = await response.json();
        setStaffList(result.recipients || []);
      }
    } catch (error) {
      console.error('Failed to fetch staff:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectStaff = (staffId: string) => {
    setSelectedStaff(prev =>
      prev.includes(staffId)
        ? prev.filter(id => id !== staffId)
        : [...prev, staffId]
    );
  };

  const handleSendAlert = async () => {
    if (selectedStaff.length === 0) {
      Alert.alert('Error', 'Please select at least one staff member');
      return;
    }

    if (!alertTitle.trim()) {
      Alert.alert('Error', 'Alert title is required');
      return;
    }

    if (!alertMessage.trim()) {
      Alert.alert('Error', 'Alert message is required');
      return;
    }

    try {
      setIsSending(true);

      const response = await fetch(
        `${API_BASE_URL}/notifications/admin/send-alert`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recipientIds: selectedStaff,
            title: alertTitle,
            message: alertMessage,
            priority: alertPriority,
            type: alertType,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to send alert');
      }

      Alert.alert(
        'Success',
        `Alert sent to ${result.sent} staff member(s)`
      );

      // Reset form
      setAlertTitle('');
      setAlertMessage('');
      setAlertPriority('high');
      setAlertType('general');
      setSelectedStaff([]);
      setTab('notifications');
      fetchNotifications();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send alert');
    } finally {
      setIsSending(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/notifications/${id}/read`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        setNotifications(
          notifications.map(n =>
            n._id === id ? { ...n, isRead: true } : n
          )
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to mark notification as read');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'attendance_modification_request':
        return 'clock.fill';
      case 'sensitive_data_modification':
        return 'lock.fill';
      case 'leave_approved':
      case 'leave_rejected':
        return 'checkmark.circle.fill';
      default:
        return 'bell.fill';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return '#ff4444';
      case 'high':
        return '#ff9800';
      case 'medium':
        return colors.tint;
      default:
        return '#4CAF50';
    }
  };

  const NotificationItem = ({ notification }: { notification: Notification }) => (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        {
          backgroundColor: notification.isRead
            ? colors.background
            : 'rgba(0, 122, 255, 0.05)',
          borderLeftColor: getPriorityColor(notification.priority),
        },
      ]}
      onPress={() => !notification.isRead && markAsRead(notification._id)}
    >
      <View style={styles.notificationIcon}>
        <IconSymbol
          size={24}
          name={getNotificationIcon(notification.type) as any}
          color={getPriorityColor(notification.priority)}
        />
      </View>
      <View style={styles.notificationContent}>
        <ThemedText type="defaultSemiBold" style={styles.notificationTitle}>
          {notification.title}
        </ThemedText>
        <ThemedText style={styles.notificationMessage}>
          {notification.message}
        </ThemedText>
        <ThemedText style={styles.notificationTime}>
          {new Date(notification.createdAt).toLocaleString()}
        </ThemedText>
      </View>
      {!notification.isRead && (
        <View style={[styles.unreadDot, { backgroundColor: colors.tint }]} />
      )}
    </TouchableOpacity>
  );

  const StaffItem = ({ staff }: { staff: Staff }) => {
    const isSelected = selectedStaff.includes(staff._id);

    return (
      <TouchableOpacity
        style={[
          styles.staffItem,
          {
            backgroundColor: isSelected
              ? colors.tint + '20'
              : colors.cardBackground,
            borderColor: isSelected ? colors.tint : colors.border,
            borderWidth: isSelected ? 2 : 1,
          },
        ]}
        onPress={() => handleSelectStaff(staff._id)}
      >
        <View style={[styles.staffAvatar, { backgroundColor: colors.tint + '30' }]}>
          <IconSymbol
            name="person.fill"
            size={18}
            color={colors.tint}
          />
        </View>
        <View style={styles.staffInfo}>
          <ThemedText style={styles.staffName}>{staff.name}</ThemedText>
          <ThemedText style={styles.staffEmail}>{staff.email}</ThemedText>
        </View>
        {isSelected && (
          <View style={[styles.checkmark, { backgroundColor: colors.tint }]}>
            <IconSymbol name="checkmark" size={14} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <AdminHeader title="Communication & Alerts" />

      {/* Tabs */}
      <View
        style={[
          styles.tabBar,
          { backgroundColor: colors.cardBackground, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.tab,
            {
              borderBottomColor:
                tab === 'notifications' ? colors.tint : 'transparent',
              borderBottomWidth: tab === 'notifications' ? 2 : 0,
            },
          ]}
          onPress={() => setTab('notifications')}
        >
          <IconSymbol name="bell.fill" size={18} color={colors.tint} />
          <ThemedText style={styles.tabLabel}>Notifications</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            {
              borderBottomColor:
                tab === 'send-alert' ? colors.tint : 'transparent',
              borderBottomWidth: tab === 'send-alert' ? 2 : 0,
            },
          ]}
          onPress={() => setTab('send-alert')}
        >
          <IconSymbol name="envelope.fill" size={18} color={colors.tint} />
          <ThemedText style={styles.tabLabel}>Send Alert</ThemedText>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {tab === 'notifications' ? (
          <>
            <View style={styles.header}>
              <ThemedText type="defaultSemiBold" style={styles.headerTitle}>
                Notifications
              </ThemedText>
              <ThemedText style={styles.headerSubtitle}>
                {notifications.filter(n => !n.isRead).length} unread
              </ThemedText>
            </View>

            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color={colors.tint} />
              </View>
            ) : notifications.length === 0 ? (
              <View style={styles.emptyContainer}>
                <IconSymbol
                  size={48}
                  name="bell.slash.fill"
                  color={colors.text}
                />
                <ThemedText style={styles.emptyText}>
                  No notifications yet
                </ThemedText>
              </View>
            ) : (
              notifications.map(notification => (
                <NotificationItem
                  key={notification._id}
                  notification={notification}
                />
              ))
            )}
          </>
        ) : (
          <>
            <View style={styles.header}>
              <ThemedText type="defaultSemiBold" style={styles.headerTitle}>
                Send Alert to Staff
              </ThemedText>
              {selectedStaff.length > 0 && (
                <ThemedText style={styles.selectedCount}>
                  {selectedStaff.length} selected
                </ThemedText>
              )}
            </View>

            {/* Search */}
            <View
              style={[
                styles.searchBar,
                { backgroundColor: colors.cardBackground, borderColor: colors.border },
              ]}
            >
              <IconSymbol
                name="magnifyingglass"
                size={16}
                color={colors.textSecondary}
              />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search staff..."
                placeholderTextColor={colors.textSecondary}
                value={searchStaff}
                onChangeText={text => {
                  setSearchStaff(text);
                  setTimeout(() => {
                    const params = new URLSearchParams();
                    if (text) params.append('search', text);
                    // Re-fetch with search
                  }, 300);
                }}
              />
            </View>

            {/* Alert Form */}
            <View
              style={[
                styles.formSection,
                { backgroundColor: colors.cardBackground },
              ]}
            >
              <ThemedText type="defaultSemiBold" style={styles.formLabel}>
                Alert Type
              </ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.typeScroll}
              >
                {alertTypes.map(type => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.typeButton,
                      {
                        backgroundColor:
                          alertType === type.value
                            ? colors.tint
                            : colors.border,
                      },
                    ]}
                    onPress={() => setAlertType(type.value)}
                  >
                    <ThemedText
                      style={[
                        styles.typeButtonText,
                        {
                          color:
                            alertType === type.value ? '#fff' : colors.text,
                        },
                      ]}
                    >
                      {type.label}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <ThemedText type="defaultSemiBold" style={styles.formLabel}>
                Priority
              </ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.priorityScroll}
              >
                {priorities.map(p => (
                  <TouchableOpacity
                    key={p.value}
                    style={[
                      styles.priorityButton,
                      {
                        backgroundColor:
                          alertPriority === p.value ? p.color : colors.border,
                      },
                    ]}
                    onPress={() => setAlertPriority(p.value)}
                  >
                    <ThemedText
                      style={[
                        styles.priorityText,
                        {
                          color:
                            alertPriority === p.value ? '#fff' : colors.text,
                        },
                      ]}
                    >
                      {p.label}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <ThemedText type="defaultSemiBold" style={styles.formLabel}>
                Title *
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { color: colors.text, borderColor: colors.border },
                ]}
                placeholder="Alert title..."
                placeholderTextColor={colors.textSecondary}
                value={alertTitle}
                onChangeText={setAlertTitle}
                editable={!isSending}
              />

              <ThemedText type="defaultSemiBold" style={styles.formLabel}>
                Message *
              </ThemedText>
              <TextInput
                style={[
                  styles.textArea,
                  { color: colors.text, borderColor: colors.border },
                ]}
                placeholder="Alert message..."
                placeholderTextColor={colors.textSecondary}
                value={alertMessage}
                onChangeText={setAlertMessage}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                editable={!isSending}
              />
            </View>

            {/* Staff List */}
            <View style={styles.staffSection}>
              <ThemedText type="defaultSemiBold" style={styles.staffSectionTitle}>
                Select Recipients
              </ThemedText>

              {loading ? (
                <View style={styles.center}>
                  <ActivityIndicator size="large" color={colors.tint} />
                </View>
              ) : (
                <FlatList
                  scrollEnabled={false}
                  data={staffList}
                  keyExtractor={item => item._id}
                  renderItem={({ item }) => <StaffItem staff={item} />}
                  contentContainerStyle={styles.staffList}
                />
              )}
            </View>

            {/* Send Button */}
            <TouchableOpacity
              style={[
                styles.sendButton,
                { backgroundColor: colors.tint, opacity: isSending ? 0.6 : 1 },
              ]}
              onPress={handleSendAlert}
              disabled={isSending}
            >
              {isSending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <IconSymbol name="paperplane.fill" size={18} color="#fff" />
                  <ThemedText style={styles.sendButtonText}>
                    Send Alert
                  </ThemedText>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
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
    paddingVertical: 16,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    opacity: 0.6,
  },
  selectedCount: {
    fontSize: 13,
    opacity: 0.7,
    marginTop: 4,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.6,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
  },
  notificationIcon: {
    marginRight: 12,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 14,
    marginBottom: 2,
  },
  notificationMessage: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 10,
    opacity: 0.5,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  formSection: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
    opacity: 0.8,
  },
  typeScroll: {
    marginBottom: 12,
    marginHorizontal: -14,
    paddingHorizontal: 14,
  },
  typeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  typeButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  priorityScroll: {
    marginBottom: 12,
    marginHorizontal: -14,
    paddingHorizontal: 14,
  },
  priorityButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '500',
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '500',
    minHeight: 100,
  },
  staffSection: {
    marginTop: 20,
  },
  staffSectionTitle: {
    fontSize: 14,
    marginBottom: 12,
  },
  staffList: {
    gap: 8,
    marginBottom: 16,
  },
  staffItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  staffAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  staffInfo: {
    flex: 1,
  },
  staffName: {
    fontSize: 13,
    fontWeight: '600',
  },
  staffEmail: {
    fontSize: 11,
    opacity: 0.6,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 20,
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
