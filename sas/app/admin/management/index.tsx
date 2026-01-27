import React from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRouter } from 'expo-router';
import AdminHeader from '../AdminHeader';

export default function ManagementScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();

  const managementOptions = [
    {
      icon: 'person.2.circle.fill',
      title: 'User & Role Management',
      description: 'Manage users, roles, permissions & status',
      onPress: () => router.push('/admin/management/users'),
    },
    {
      icon: 'calendar.badge.clock',
      title: 'Timetable & Shifts',
      description: 'Configure class schedules & shift timings',
      onPress: () => router.push('/admin/management/timetable'),
    },
    {
      icon: 'graduationcap.fill',
      title: 'Manage Students',
      description: 'Create, edit, delete students & view analytics',
      onPress: () => router.push('/admin/management/students'),
    },
    {
      icon: 'person.3.fill',
      title: 'Manage Staff',
      description: 'Create, edit, delete staff & performance tracking',
      onPress: () => router.push('/admin/management/staff'),
    },
  ];

  const ActionCard = ({
    icon,
    title,
    description,
    onPress,
  }: {
    icon: string;
    title: string;
    description: string;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      style={[styles.card, styles.cardShadow, { backgroundColor: colors.cardBackground, borderLeftColor: colors.tint }]}
      onPress={onPress}>
      <View style={styles.cardIconContainer}>
        <IconSymbol size={32} name={icon as any} color={colors.tint} />
      </View>
      <View style={styles.cardContent}>
        <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
          {title}
        </ThemedText>
        <ThemedText style={styles.cardDescription}>{description}</ThemedText>
      </View>
      <IconSymbol size={20} name="chevron.right" color={colors.tint} />
    </TouchableOpacity>
  );

  return (
    <ThemedView style={styles.container}>
      <AdminHeader title="Management Center" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <ThemedText type="defaultSemiBold" style={styles.headerTitle}>
            Management Options
          </ThemedText>
          <ThemedText style={styles.headerSubtitle}>
            Manage all system components
          </ThemedText>
        </View>

        {managementOptions.map((option, index) => (
          <ActionCard
            key={index}
            icon={option.icon}
            title={option.title}
            description={option.description}
            onPress={option.onPress}
          />
        ))}
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
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 20,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    opacity: 0.6,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  cardIconContainer: {
    marginRight: 16,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    marginBottom: 2,
  },
  cardDescription: {
    fontSize: 12,
    opacity: 0.6,
  },
  cardShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
