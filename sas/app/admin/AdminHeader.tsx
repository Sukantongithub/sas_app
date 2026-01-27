import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';

const API_BASE_URL = 'http://localhost:5000/api';

interface Notification {
  _id: string;
  type: 'attendance_modification_request' | 'sensitive_data_modification' | string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  isRead: boolean;
  createdAt: string;
  data?: any;
}

interface AdminHeaderProps {
  title?: string;
}

export default function AdminHeader({ title }: AdminHeaderProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { token, user } = useAuth();
  const [notificationCount, setNotificationCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const fetchNotifications = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const result = await response.json();
        const criticalNotifications = result.notifications.filter(
          (n: Notification) =>
            (n.type === 'attendance_modification_request' || n.type === 'sensitive_data_modification') &&
            !n.isRead
        );
        setNotifications(criticalNotifications);
        setNotificationCount(criticalNotifications.length);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  return (
    <>
      {/* Header with Notifications and Role */}
      <View style={[styles.headerBar, { backgroundColor: colors.cardBackground, borderBottomColor: colors.text }]}>
        <View style={styles.headerLeft}>
          <ThemedText type="defaultSemiBold" style={styles.roleText}>
            {user?.role === 'super_admin' ? 'Super Admin' : 'Admin'}
          </ThemedText>
          {title && (
            <ThemedText style={[styles.pageTitle, { color: colors.text, opacity: 0.7 }]}>
              {title}
            </ThemedText>
          )}
        </View>
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => setShowNotifications(!showNotifications)}>
          <IconSymbol size={24} name="bell.fill" color={colors.tint} />
          {notificationCount > 0 && (
            <View style={[styles.notificationBadge, { backgroundColor: colors.tint }]}>
              <ThemedText style={styles.badgeText}>{notificationCount}</ThemedText>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Notifications Panel */}
      {showNotifications && (
        <View style={[styles.notificationPanel, { backgroundColor: colors.cardBackground }]}>
          <View style={[styles.notificationHeader, { borderBottomColor: colors.text }]}>
            <ThemedText type="defaultSemiBold">Notifications</ThemedText>
            <TouchableOpacity onPress={() => setShowNotifications(false)}>
              <IconSymbol size={24} name="xmark" color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.notificationList}>
            {notifications.length === 0 ? (
              <View style={styles.emptyNotifications}>
                <ThemedText style={styles.emptyText}>No pending notifications</ThemedText>
              </View>
            ) : (
              notifications.map((notif) => (
                <TouchableOpacity
                  key={notif._id}
                  style={[
                    styles.notificationItem,
                    {
                      borderLeftColor:
                        notif.priority === 'urgent' ? '#ff4444' : notif.priority === 'high' ? '#ff9800' : colors.tint,
                      backgroundColor: notif.isRead ? colors.background : 'rgba(0, 122, 255, 0.05)',
                    },
                  ]}>
                  <View style={styles.notificationContent}>
                    <ThemedText type="defaultSemiBold" style={styles.notificationTitle}>
                      {notif.title}
                    </ThemedText>
                    <ThemedText style={styles.notificationMessage}>{notif.message}</ThemedText>
                    <ThemedText style={styles.notificationTime}>
                      {new Date(notif.createdAt).toLocaleString()}
                    </ThemedText>
                  </View>
                  <IconSymbol
                    size={20}
                    name={notif.type === 'attendance_modification_request' ? 'clock.fill' : 'lock.fill'}
                    color={colors.tint}
                  />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'column',
  },
  roleText: {
    fontSize: 16,
    fontWeight: '600',
  },
  pageTitle: {
    fontSize: 12,
    marginTop: 2,
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  notificationPanel: {
    position: 'absolute',
    top: 56,
    right: 16,
    width: '90%',
    maxHeight: 400,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  notificationList: {
    maxHeight: 350,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    borderLeftWidth: 4,
    gap: 8,
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
  emptyNotifications: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    opacity: 0.6,
    fontSize: 14,
  },
});
