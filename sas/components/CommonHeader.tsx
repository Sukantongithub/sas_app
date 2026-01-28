import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';

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

interface CommonHeaderProps {
  title?: string;
  showNotifications?: boolean;
}

export default function CommonHeader({ title, showNotifications = true }: CommonHeaderProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { token, user } = useAuth();
  const [notificationCount, setNotificationCount] = useState(0);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (showNotifications && token) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [token, showNotifications]);

  const fetchNotifications = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const result = await response.json();
        const unreadNotifications = result.notifications.filter((n: Notification) => !n.isRead);
        setNotifications(unreadNotifications);
        setNotificationCount(unreadNotifications.length);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const getRoleDisplay = () => {
    const role = user?.role as string | undefined;
    if (!role) return 'User';
    
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'admin':
        return 'Admin';
      case 'teacher':
        return 'Teacher';
      case 'student':
        return 'Student';
      default:
        return role.charAt(0).toUpperCase() + role.slice(1);
    }
  };

  return (
    <>
      {/* Minimalist Inline Action Header */}
      <View style={styles.inlineHeader}>
        <View style={styles.inlineContent}>
          <View style={styles.roleChip}>
            <View style={[styles.roleIndicator, { backgroundColor: colors.tint }]} />
            <ThemedText style={styles.roleChipText}>
              {getRoleDisplay()}
            </ThemedText>
            {title && (
              <>
                <View style={styles.dividerDot} />
                <ThemedText style={[styles.titleChipText, { color: colors.text }]}>{title}</ThemedText>
              </>
            )}
          </View>
          {showNotifications && (
            <View style={styles.actionBar}>
              <TouchableOpacity
                style={styles.bellButton}
                onPress={() => setShowNotificationPanel(!showNotificationPanel)}>
                <IconSymbol 
                  size={22} 
                  name={notificationCount > 0 ? "bell.badge.fill" : "bell"} 
                  color={notificationCount > 0 ? '#F44336' : colors.text} 
                />
                {notificationCount > 0 && (
                  <View style={styles.compactBadge}>
                    <ThemedText style={styles.compactBadgeText}>{notificationCount}</ThemedText>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
        <View style={[styles.bottomBorder, { backgroundColor: colors.text }]} />
      </View>

      {/* Notifications Panel */}
      {showNotificationPanel && (
        <View style={[styles.notificationPanel, { backgroundColor: colors.cardBackground }]}>
          <View style={[styles.notificationHeader, { borderBottomColor: colors.text }]}>
            <ThemedText type="defaultSemiBold">Notifications</ThemedText>
            <TouchableOpacity onPress={() => setShowNotificationPanel(false)}>
              <IconSymbol size={24} name="xmark" color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.notificationList}>
            {notifications.length === 0 ? (
              <View style={styles.emptyNotifications}>
                <ThemedText style={styles.emptyText}>No notifications</ThemedText>
              </View>
            ) : (
              notifications.map((notification) => (
                <View
                  key={notification._id}
                  style={[
                    styles.notificationItem,
                    { borderLeftColor: notification.priority === 'urgent' ? '#F44336' : colors.tint },
                  ]}>
                  <View style={styles.notificationContent}>
                    <ThemedText type="defaultSemiBold" style={styles.notificationTitle}>
                      {notification.title}
                    </ThemedText>
                    <ThemedText style={styles.notificationMessage}>{notification.message}</ThemedText>
                    <ThemedText style={styles.notificationTime}>
                      {new Date(notification.createdAt).toLocaleString()}
                    </ThemedText>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  inlineHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  inlineContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  roleIndicator: {
    width: 4,
    height: 24,
    borderRadius: 2,
  },
  roleChipText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  dividerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128, 128, 128, 0.3)',
  },
  titleChipText: {
    fontSize: 14,
    opacity: 0.6,
    fontWeight: '500',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bellButton: {
    position: 'relative',
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  compactBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  bottomBorder: {
    height: 1,
    opacity: 0.08,
  },
  notificationPanel: {
    position: 'absolute',
    top: 60,
    right: 16,
    left: 16,
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
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    opacity: 0.5,
    fontSize: 14,
  },
});
