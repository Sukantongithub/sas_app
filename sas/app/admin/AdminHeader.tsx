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
      {/* Minimalist Inline Action Header */}
      <View style={styles.inlineHeader}>
        <View style={styles.inlineContent}>
          <View style={styles.roleChip}>
            <View style={[styles.roleIndicator, { backgroundColor: colors.tint }]} />
            <ThemedText style={styles.roleChipText}>
              {user?.role === 'super_admin' ? 'Super Admin' : 'Admin'}
            </ThemedText>
            {title && (
              <>
                <View style={styles.dividerDot} />
                <ThemedText style={[styles.titleChipText, { color: colors.text }]}>{title}</ThemedText>
              </>
            )}
          </View>
          <View style={styles.actionBar}>
            <TouchableOpacity
              style={styles.bellButton}
              onPress={() => setShowNotifications(!showNotifications)}>
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
        </View>
        <View style={[styles.bottomBorder, { backgroundColor: colors.text }]} />
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
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  elevatedCard: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  adminBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  adminBadgeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  titleSection: {
    flex: 1,
    gap: 4,
  },
  adminRole: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  breadcrumbText: {
    fontSize: 12,
    opacity: 0.6,
    fontWeight: '500',
  },
  rightSection: {
    flexDirection: 'row',
    gap: 8,
  },
  notificationIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationIconActive: {
    backgroundColor: 'rgba(244, 67, 54, 0.08)',
  },
  notificationStack: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    shadowColor: '#F44336',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 6,
  },
  pulseText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  gradientHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  roleIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleText: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  pageTitle: {
    fontSize: 13,
    opacity: 0.6,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
    borderRadius: 10,
  },
  notificationBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
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
