import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
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

export default function CommunicationScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [token]);

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

  const markAsRead = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setNotifications(notifications.map(n => n._id === id ? { ...n, isRead: true } : n));
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
          backgroundColor: notification.isRead ? colors.background : 'rgba(0, 122, 255, 0.05)',
          borderLeftColor: getPriorityColor(notification.priority),
        },
      ]}
      onPress={() => !notification.isRead && markAsRead(notification._id)}>
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
        <ThemedText style={styles.notificationMessage}>{notification.message}</ThemedText>
        <ThemedText style={styles.notificationTime}>
          {new Date(notification.createdAt).toLocaleString()}
        </ThemedText>
      </View>
      {!notification.isRead && (
        <View style={[styles.unreadDot, { backgroundColor: colors.tint }]} />
      )}
    </TouchableOpacity>
  );

  return (
    <ThemedView style={styles.container}>
      <AdminHeader title="Communication & Notifications" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
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
            <IconSymbol size={48} name="bell.slash.fill" color={colors.text} />
            <ThemedText style={styles.emptyText}>No notifications yet</ThemedText>
          </View>
        ) : (
          notifications.map((notification) => (
            <NotificationItem key={notification._id} notification={notification} />
          ))
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
    paddingVertical: 20,
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
});
