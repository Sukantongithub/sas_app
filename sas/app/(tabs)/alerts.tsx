import { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, ActivityIndicator, RefreshControl, FlatList } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';
import { studentInteractionsAPI } from '@/services/api';

export default function AlertsScreen() {
  const colorScheme = useColorScheme();
  const { user, token } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'unread'>('all');

  const studentId = user?.id;

  useEffect(() => {
    if (studentId && token) {
      fetchNotifications();
    }
  }, [studentId, token]);

  const fetchNotifications = async () => {
    if (!studentId || !token) return;

    setLoading(true);
    try {
      const params = filterType === 'unread' ? { unreadOnly: true } : {};
      const data = await studentInteractionsAPI.getNotifications(studentId, params, token);
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error: any) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  const handleMarkAsRead = async (notificationId: string) => {
    if (!token) return;

    try {
      await studentInteractionsAPI.markNotificationRead(notificationId, token);
      await fetchNotifications();
    } catch (error: any) {
      console.error('Error marking notification as read:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'low_attendance':
        return 'exclamationmark.triangle.fill';
      case 'leave_status':
        return 'calendar.badge.checkmark';
      case 'on_duty_approval':
      case 'on_duty_rejection':
        return 'checkmark.circle.fill';
      case 'absence_acknowledged':
        return 'doc.checkmark';
      default:
        return 'bell.fill';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'low_attendance':
        return '#F44336';
      case 'leave_status':
      case 'on_duty_approval':
      case 'absence_acknowledged':
        return '#4CAF50';
      case 'on_duty_rejection':
        return '#FF9800';
      default:
        return Colors[colorScheme ?? 'light'].tint;
    }
  };

  const displayedNotifications = filterType === 'unread' 
    ? notifications.filter(n => !n.isRead)
    : notifications;

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
      <ThemedView style={styles.header}>
        <View>
          <ThemedText type="title">Notifications</ThemedText>
          {unreadCount > 0 && (
            <ThemedText style={styles.unreadBadge}>
              {unreadCount} unread
            </ThemedText>
          )}
        </View>
      </ThemedView>

      {/* Filter Tabs */}
      <ThemedView style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filterType === 'all' && styles.filterButtonActive]}
          onPress={() => {
            setFilterType('all');
          }}>
          <ThemedText style={[styles.filterText, filterType === 'all' && styles.filterTextActive]}>
            All
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filterType === 'unread' && styles.filterButtonActive]}
          onPress={() => {
            setFilterType('unread');
          }}>
          <ThemedText style={[styles.filterText, filterType === 'unread' && styles.filterTextActive]}>
            Unread {unreadCount > 0 && `(${unreadCount})`}
          </ThemedText>
        </TouchableOpacity>
      </ThemedView>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
        </View>
      ) : displayedNotifications.length === 0 ? (
        <View style={styles.emptyState}>
          <IconSymbol name="bell.slash" size={48} color="#999" />
          <ThemedText style={styles.emptyText}>
            {filterType === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </ThemedText>
        </View>
      ) : (
        <View style={styles.notificationsList}>
          {displayedNotifications.map((notification) => (
            <TouchableOpacity
              key={notification._id}
              onPress={() => {
                if (!notification.isRead) {
                  handleMarkAsRead(notification._id);
                }
              }}
              activeOpacity={0.7}>
              <ThemedView 
                style={[
                  styles.notificationCard,
                  !notification.isRead && styles.notificationUnread,
                ]}>
                <View style={styles.notificationIconContainer}>
                  <IconSymbol 
                    name={getNotificationIcon(notification.type) as any}
                    size={24}
                    color={getNotificationColor(notification.type)}
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
                  <View style={styles.unreadIndicator}>
                    <View style={styles.unreadDot} />
                  </View>
                )}
              </ThemedView>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  unreadBadge: {
    fontSize: 13,
    opacity: 0.6,
    marginTop: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 50,
  },
  notificationsList: {
    padding: 16,
    gap: 12,
  },
  notificationCard: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
    alignItems: 'flex-start',
  },
  notificationUnread: {
    backgroundColor: 'rgba(37, 99, 235, 0.05)',
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  notificationIconContainer: {
    paddingTop: 4,
  },
  notificationContent: {
    flex: 1,
    gap: 4,
  },
  notificationTitle: {
    fontSize: 15,
  },
  notificationMessage: {
    fontSize: 13,
    opacity: 0.8,
    lineHeight: 18,
  },
  notificationTime: {
    fontSize: 11,
    opacity: 0.6,
    marginTop: 4,
  },
  unreadIndicator: {
    paddingTop: 6,
    paddingLeft: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyText: {
    marginTop: 12,
    opacity: 0.6,
    fontSize: 14,
  },
});
