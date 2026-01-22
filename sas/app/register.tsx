import { useState } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function RegisterScreen() {
  const colorScheme = useColorScheme();
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'student' as 'admin' | 'teacher' | 'student',
  });
  const [isRegistering, setIsRegistering] = useState(false);

  const handleRegister = async () => {
    if (!formData.name || !formData.email || !formData.password) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    try {
      setIsRegistering(true);
      await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
      });
      
      Alert.alert(
        'Success',
        'Registration successful! Please login with your credentials.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/login'),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message || 'Something went wrong');
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={24} color={Colors[colorScheme ?? 'light'].tint} />
          <ThemedText style={[styles.backText, { color: Colors[colorScheme ?? 'light'].tint }]}>
            Back to Login
          </ThemedText>
        </TouchableOpacity>

        <View style={styles.headerContainer}>
          <ThemedText type="title" style={styles.title}>
            Create Account
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Register to get started
          </ThemedText>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Full Name *</ThemedText>
            <TextInput
              style={[
                styles.input,
                { 
                  color: colorScheme === 'dark' ? '#fff' : '#000',
                  backgroundColor: colorScheme === 'dark' ? '#333' : '#f5f5f5'
                }
              ]}
              placeholder="Enter your full name"
              placeholderTextColor={colorScheme === 'dark' ? '#888' : '#666'}
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Email *</ThemedText>
            <TextInput
              style={[
                styles.input,
                { 
                  color: colorScheme === 'dark' ? '#fff' : '#000',
                  backgroundColor: colorScheme === 'dark' ? '#333' : '#f5f5f5'
                }
              ]}
              placeholder="Enter your email"
              placeholderTextColor={colorScheme === 'dark' ? '#888' : '#666'}
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Password *</ThemedText>
            <TextInput
              style={[
                styles.input,
                { 
                  color: colorScheme === 'dark' ? '#fff' : '#000',
                  backgroundColor: colorScheme === 'dark' ? '#333' : '#f5f5f5'
                }
              ]}
              placeholder="Enter password (min 6 characters)"
              placeholderTextColor={colorScheme === 'dark' ? '#888' : '#666'}
              value={formData.password}
              onChangeText={(text) => setFormData({ ...formData, password: text })}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Confirm Password *</ThemedText>
            <TextInput
              style={[
                styles.input,
                { 
                  color: colorScheme === 'dark' ? '#fff' : '#000',
                  backgroundColor: colorScheme === 'dark' ? '#333' : '#f5f5f5'
                }
              ]}
              placeholder="Re-enter password"
              placeholderTextColor={colorScheme === 'dark' ? '#888' : '#666'}
              value={formData.confirmPassword}
              onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Role</ThemedText>
            <View style={styles.roleContainer}>
              {(['student', 'teacher'] as const).map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.roleButton,
                    formData.role === role && { backgroundColor: Colors[colorScheme ?? 'light'].tint }
                  ]}
                  onPress={() => setFormData({ ...formData, role })}>
                  <ThemedText
                    style={[
                      styles.roleText,
                      formData.role === role && { color: '#fff' }
                    ]}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.registerButton,
              { backgroundColor: Colors[colorScheme ?? 'light'].tint }
            ]}
            onPress={handleRegister}
            disabled={isRegistering}>
            {isRegistering ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.registerButtonText}>
                Register
              </ThemedText>
            )}
          </TouchableOpacity>
        </View>
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
    padding: 24,
    paddingTop: 60,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backText: {
    fontSize: 16,
    marginLeft: 8,
    fontWeight: '600',
  },
  headerContainer: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    fontWeight: '500',
  },
  formContainer: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.2)',
  },
  roleContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  roleButton: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  roleText: {
    fontSize: 16,
    fontWeight: '600',
  },
  registerButton: {
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
