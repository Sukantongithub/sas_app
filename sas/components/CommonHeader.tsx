import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';

const API_BASE_URL = 'http://localhost:5000/api';

type AppRole = 'super_admin' | 'admin' | 'hod' | 'staff' | 'student' | 'parent' | 'faculty' | 'teacher' | 'hr' | string;

interface CommonHeaderProps {
  title?: string;
  showNotifications?: boolean;
}

interface NotificationResponse {
  notifications?: Array<{ isRead?: boolean }>;
  unreadCount?: number;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Admin',
  admin: 'Admin',
  hod: 'HOD',
  staff: 'Staff',
  student: 'Student',
  parent: 'Parents',
  parents: 'Parents',
  teacher: 'Staff',
  faculty: 'Staff',
  hr: 'Staff',
};

function getRoleLabel(role?: AppRole): string {
  if (!role) return 'User';
  const normalized = String(role).toLowerCase();
  return ROLE_LABELS[normalized] || role;
}

export default function CommonHeader({ title = 'Dashboard', showNotifications = true }: CommonHeaderProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    if (!showNotifications || !token) {
      setNotificationCount(0);
      return;
    }

    const fetchUnread = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/notifications`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) return;

        const result = (await response.json()) as NotificationResponse;
        if (typeof result.unreadCount === 'number') {
          setNotificationCount(result.unreadCount);
          return;
        }

        const unread = (result.notifications || []).filter((item) => !item.isRead).length;
        setNotificationCount(unread);
      } catch {
        // Notifications are best-effort for header display.
      }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [showNotifications, token]);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colorScheme === 'dark' ? '#0B1220' : colors.cardBackground,
          borderBottomColor: colors.border,
          paddingTop: Math.max(insets.top, 8),
        },
      ]}
    >
      <View style={styles.innerRow}>
        <View style={styles.leftCluster}>
          <View style={[styles.roleAccent, { backgroundColor: colors.tint }]} />
          <ThemedText style={[styles.roleText, { color: colors.text }]}>{getRoleLabel(user?.role)}</ThemedText>
          <ThemedText style={[styles.dot, { color: colors.textSecondary }]}>.</ThemedText>
          <ThemedText numberOfLines={1} style={[styles.titleText, { color: colors.textSecondary }]}>
            {title}
          </ThemedText>
        </View>

        {showNotifications && (
          <TouchableOpacity style={styles.bellButton} activeOpacity={0.7}>
            <IconSymbol size={20} name="bell.fill" color={colors.text} />
            {notificationCount > 0 && (
              <View style={styles.badge}>
                <ThemedText style={styles.badgeText}>{notificationCount > 99 ? '99+' : String(notificationCount)}</ThemedText>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  innerRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftCluster: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleAccent: {
    width: 4,
    height: 28,
    borderRadius: 2,
    marginRight: 10,
  },
  roleText: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 36,
  },
  dot: {
    marginHorizontal: 8,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  titleText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  bellButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 1,
    right: 1,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
  },
});
