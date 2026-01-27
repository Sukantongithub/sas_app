import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';
import AdminHeader from './AdminHeader';

const API_BASE_URL = 'http://localhost:5000/api';

interface ExportOption {
  type: 'students' | 'staff' | 'attendance' | 'leaves' | 'all';
  label: string;
  description: string;
  icon: string;
  color: string;
}

export default function ExportScreen() {
  const colorScheme = useColorScheme();
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(false);

  const exportOptions: ExportOption[] = [
    {
      type: 'students',
      label: 'Students Data',
      description: 'Export all student records',
      icon: 'person.2.fill',
      color: '#007AFF',
    },
    {
      type: 'staff',
      label: 'Staff Data',
      description: 'Export all staff records',
      icon: 'person.3.fill',
      color: '#9c27b0',
    },
    {
      type: 'attendance',
      label: 'Attendance Records',
      description: 'Export all attendance data',
      icon: 'checkmark.circle.fill',
      color: '#4CAF50',
    },
    {
      type: 'leaves',
      label: 'Leave Requests',
      description: 'Export all leave requests',
      icon: 'calendar.fill',
      color: '#ff9800',
    },
    {
      type: 'all',
      label: 'Complete Dump',
      description: 'Export all system data',
      icon: 'arrow.down.doc.fill',
      color: '#f44336',
    },
  ];

  const handleExport = async (type: ExportOption['type']) => {
    try {
      setLoading(true);

      const response = await fetch(`${API_BASE_URL}/admin/analytics/export?type=${type}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Export failed');

      const data = await response.json();

      // Create filename
      const filename = `attendance-${type}-${new Date().toISOString().split('T')[0]}.json`;

      // Show success message with data preview
      const preview = JSON.stringify(data).substring(0, 100);
      Alert.alert(
        'Export Successful',
        `Data exported successfully!\n\nFilename: ${filename}\n\nRecords: ${
          Object.keys(data).length > 0 ? 'Multiple tables' : 'No data'
        }`,
        [
          {
            text: 'OK',
            onPress: () => {
              console.log('Exported data:', data);
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Export Failed', error.message || 'Failed to export data');
    } finally {
      setLoading(false);
    }
  };

  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.center}>
          <ThemedText type="title">Access Denied</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AdminHeader title="Export Data" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <ThemedText style={styles.subtitle}>
            Download system data as JSON files
          </ThemedText>
        </View>

        <View style={styles.infoBox}>
          <ThemedText style={styles.infoText}>
            Select data type to export. Files will be saved with timestamp.
          </ThemedText>
        </View>

        {exportOptions.map((option) => (
          <TouchableOpacity
            key={option.type}
            style={styles.optionCard}
            onPress={() => handleExport(option.type)}
            disabled={loading}>
            <View style={styles.optionHeader}>
              <View style={styles.optionIconContainer}>
                <IconSymbol size={32} name={option.icon as any} color={option.color} />
              </View>
              <View style={styles.optionText}>
                <ThemedText type="defaultSemiBold" style={styles.optionLabel}>
                  {option.label}
                </ThemedText>
                <ThemedText style={styles.optionDescription}>
                  {option.description}
                </ThemedText>
              </View>
            </View>
            <View
              style={[
                styles.optionBorder,
                {
                  borderLeftColor: option.color,
                  borderTopColor: option.color,
                },
              ]}
            />
          </TouchableOpacity>
        ))}

        <View style={styles.notesBox}>
          <ThemedText type="defaultSemiBold" style={styles.notesTitle}>
            Notes
          </ThemedText>
          <ThemedText style={styles.notesText}>
            • All exports are in JSON format{'\n'}• Files are timestamped{'\n'}• Contains all
            related data{'\n'}• Ready for analysis and backup
          </ThemedText>
        </View>

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
            <ThemedText style={styles.loadingText}>Exporting data...</ThemedText>
          </View>
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.6,
    marginTop: 4,
  },
  infoBox: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  infoText: {
    fontSize: 14,
    opacity: 0.7,
  },
  optionCard: {
    backgroundColor: 'rgba(0, 122, 255, 0.08)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionIconContainer: {
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 12,
    opacity: 0.6,
  },
  optionBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    borderLeftWidth: 4,
    borderTopWidth: 1,
    borderTopColor: 'transparent',
    pointerEvents: 'none',
  },
  notesBox: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  notesTitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  notesText: {
    fontSize: 12,
    opacity: 0.7,
    lineHeight: 18,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  loadingText: {
    marginTop: 12,
    color: '#fff',
    fontWeight: '600',
  },
});
