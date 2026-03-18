import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function CommonHeader({ title, showNotifications = true }: CommonHeaderProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();

  const [notificationCount, setNotificationCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const bellAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (showNotifications && token) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [token, showNotifications]);

  useEffect(() => {
    if (notificationCount > 0) {
      Animated.sequence([
        Animated.timing(bellAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.timing(bellAnim, { toValue: -1, duration: 120, useNativeDriver: true }),
        Animated.timing(bellAnim, { toValue: 0.5, duration: 100, useNativeDriver: true }),
        Animated.timing(bellAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      ]).start();
    }
  }, [notificationCount]);

  const bellRotation = bellAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-15deg', '0deg', '15deg'],
  });

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const result = await res.json();
        const unread = result.notifications.filter((n: Notification) => !n.isRead);
        setNotifications(unread);
        setNotificationCount(unread.length);
      }
    } catch { /* silent */ }
  };

  const getRoleLabel = () => {
    const role = user?.role as string | undefined;
    if (!role) return 'User';
    const map: Record<string, string> = {
      super_admin: 'Super Admin',
      admin: 'Admin',
      teacher: 'Teacher',
      student: 'Student',
    };
    return map[role] ?? role.charAt(0).toUpperCase() + role.slice(1);
  };

  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const avatarLetter = user?.name?.charAt(0).toUpperCase() ?? '?';

  const priorityColor = (p: string) => {
    if (p === 'urgent') return '#EF4444';
    if (p === 'high') return '#F59E0B';
    return colors.tint;
  };

  return (
    <>
      {/* ── Gradient accent strip (behind safe area) ─────────────────── */}
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ height: insets.top + 2 }}
      />

      {/* ── Main header row ──────────────────────────────────────────── */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: isDark ? colors.cardBackground : '#fff',
            borderBottomColor: colors.border,
            paddingTop: 12,
          },
        ]}
      >
        {/* Left: greeting + role chip */}
        <View style={styles.left}>
          <View style={[styles.avatarBadge, { backgroundColor: colors.tint }]}>
            <ThemedText style={styles.avatarLetter}>{avatarLetter}</ThemedText>
          </View>
          <View style={styles.greetingBlock}>
            <ThemedText style={[styles.greeting, { color: colors.textSecondary }]}>
              {getGreeting()}, <ThemedText style={[styles.firstName, { color: colors.text }]}>{firstName}</ThemedText>
            </ThemedText>
            <View style={styles.roleChip}>
              <View style={[styles.roleDot, { backgroundColor: colors.tint }]} />
              <ThemedText style={[styles.roleLabel, { color: colors.tint }]}>
                {getRoleLabel()}
              </ThemedText>
              {title && (
                <>
                  <View style={styles.roleSep} />
                  <ThemedText style={[styles.pageTitle, { color: colors.textSecondary }]} numberOfLines={1}>
                    {title}
                  </ThemedText>
                </>
              )}
            </View>
          </View>
        </View>

        {/* Right: bell */}
        {showNotifications && (
          <TouchableOpacity
            onPress={() => setShowPanel(v => !v)}
            style={[styles.bellBtn, { backgroundColor: colors.tint + '14' }]}
            activeOpacity={0.7}
          >
            <Animated.View style={{ transform: [{ rotate: bellRotation }] }}>
              <IconSymbol
                size={22}
                name={notificationCount > 0 ? 'bell.badge.fill' : 'bell.fill'}
                color={notificationCount > 0 ? '#EF4444' : colors.tint}
              />
            </Animated.View>
            {notificationCount > 0 && (
              <View style={styles.badge}>
                <ThemedText style={styles.badgeText}>
                  {notificationCount > 9 ? '9+' : notificationCount}
                </ThemedText>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* ── Bottom accent line ───────────────────────────────────────── */}
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.accentLine}
      />

      {/* ── Notification panel ───────────────────────────────────────── */}
      {showPanel && (
        <View
          style={[
            styles.panel,
            {
              backgroundColor: isDark ? colors.cardBackground : '#fff',
              borderColor: colors.border,
            },
          ]}
        >
          {/* Panel header */}
          <View style={[styles.panelHeader, { borderBottomColor: colors.border }]}>
            <ThemedText style={styles.panelTitle}>Notifications</ThemedText>
            {notificationCount > 0 && (
              <View style={[styles.countPill, { backgroundColor: '#EF4444' }]}>
                <ThemedText style={styles.countPillText}>{notificationCount} unread</ThemedText>
              </View>
            )}
            <TouchableOpacity onPress={() => setShowPanel(false)} style={styles.closeBtn}>
              <IconSymbol size={20} name="xmark.circle.fill" color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Panel body */}
          <ScrollView style={styles.panelScroll} showsVerticalScrollIndicator={false}>
            {notifications.length === 0 ? (
              <View style={styles.emptyPanel}>
                <IconSymbol size={36} name="bell.slash.fill" color={colors.textSecondary} />
                <ThemedText style={[styles.emptyPanelText, { color: colors.textSecondary }]}>
                  No new notifications
                </ThemedText>
              </View>
            ) : (
              notifications.map(n => (
                <View
                  key={n._id}
                  style={[
                    styles.notifItem,
                    {
                      borderLeftColor: priorityColor(n.priority),
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.notifContent}>
                    <ThemedText style={styles.notifTitle} numberOfLines={1}>{n.title}</ThemedText>
                    <ThemedText style={[styles.notifMsg, { color: colors.textSecondary }]} numberOfLines={2}>
                      {n.message}
                    </ThemedText>
                    <ThemedText style={[styles.notifTime, { color: colors.textSecondary }]}>
                      {timeAgo(n.createdAt)}
                    </ThemedText>
                  </View>
                  {n.priority === 'urgent' && (
                    <IconSymbol size={16} name="exclamationmark.circle.fill" color="#EF4444" />
                  )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  avatarBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  avatarLetter: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  greetingBlock: {
    flex: 1,
    gap: 3,
  },
  greeting: {
    fontSize: 12,
    fontWeight: '500',
  },
  firstName: {
    fontWeight: '700',
    fontSize: 12,
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  roleLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  roleSep: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(128,128,128,0.35)',
  },
  pageTitle: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  bellBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '800',
  },
  accentLine: {
    height: 2,
    opacity: 0.6,
  },
  // ── Panel ────────────────────────────────────────────────────────────────
  panel: {
    position: 'absolute',
    top: 64,
    left: 12,
    right: 12,
    borderRadius: 16,
    borderWidth: 1,
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 12,
    overflow: 'hidden',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  countPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  countPillText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  panelScroll: {
    maxHeight: 320,
  },
  emptyPanel: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  emptyPanelText: {
    fontSize: 14,
    fontWeight: '500',
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderLeftWidth: 3,
    borderBottomWidth: 1,
    gap: 10,
  },
  notifContent: {
    flex: 1,
    gap: 2,
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  notifMsg: {
    fontSize: 12,
    lineHeight: 17,
  },
  notifTime: {
    fontSize: 10,
    marginTop: 2,
  },
});
