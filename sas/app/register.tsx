import { useState } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function RegisterScreen() {
  const colorScheme = useColorScheme();
  const { toggleTheme, isDarkMode } = useTheme();
  const { register } = useAuth();
  const roleOptions = [
    { key: 'student', label: 'Student', icon: 'graduationcap.fill' },
    { key: 'parent', label: 'Parents', icon: 'person.2.fill' },
    { key: 'staff', label: 'Staff', icon: 'person.3.fill' },
    { key: 'hod', label: 'HOD', icon: 'rectangle.3.group' },
    { key: 'admin', label: 'Admin', icon: 'person.circle.fill' },
  ] as const;

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'student' as 'admin' | 'hod' | 'staff' | 'parent' | 'student',
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
      {/* Dark Mode Toggle */}
      <TouchableOpacity 
        style={styles.themeToggle}
        onPress={toggleTheme}>
        <IconSymbol 
          name={isDarkMode ? 'sun.max.fill' : 'moon.fill'} 
          size={24} 
          color={Colors[colorScheme ?? 'light'].tint} 
        />
      </TouchableOpacity>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={22} color={Colors[colorScheme ?? 'light'].tint} />
          <ThemedText style={[styles.backText, { color: Colors[colorScheme ?? 'light'].tint }]}>
            Back
          </ThemedText>
        </TouchableOpacity>

        <View style={styles.headerContainer}>
          <View style={[styles.logoContainer, { 
            backgroundColor: Colors[colorScheme ?? 'light'].tint + '20',
          }]}>
            <IconSymbol name="person.badge.plus.fill" size={40} color={Colors[colorScheme ?? 'light'].tint} />
          </View>
          <ThemedText type="title" style={styles.title}>
            Create Account
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: Colors[colorScheme ?? 'light'].textSecondary }]}>
            Register to get started
          </ThemedText>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <ThemedText style={[styles.label, { color: Colors[colorScheme ?? 'light'].text }]}>Full Name *</ThemedText>
            <View style={[styles.inputWrapper, { 
              backgroundColor: Colors[colorScheme ?? 'light'].inputBackground,
              borderColor: Colors[colorScheme ?? 'light'].border,
            }]}>
              <IconSymbol name="person.fill" size={20} color={Colors[colorScheme ?? 'light'].textSecondary} />
              <TextInput
                style={[styles.input, { color: Colors[colorScheme ?? 'light'].text }]}
                placeholder="Enter your full name"
                placeholderTextColor={Colors[colorScheme ?? 'light'].textSecondary}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={[styles.label, { color: Colors[colorScheme ?? 'light'].text }]}>Email *</ThemedText>
            <View style={[styles.inputWrapper, { 
              backgroundColor: Colors[colorScheme ?? 'light'].inputBackground,
              borderColor: Colors[colorScheme ?? 'light'].border,
            }]}>
              <IconSymbol name="envelope.fill" size={20} color={Colors[colorScheme ?? 'light'].textSecondary} />
              <TextInput
                style={[styles.input, { color: Colors[colorScheme ?? 'light'].text }]}
                placeholder="Enter your email"
                placeholderTextColor={Colors[colorScheme ?? 'light'].textSecondary}
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={[styles.label, { color: Colors[colorScheme ?? 'light'].text }]}>Password *</ThemedText>
            <View style={[styles.inputWrapper, { 
              backgroundColor: Colors[colorScheme ?? 'light'].inputBackground,
              borderColor: Colors[colorScheme ?? 'light'].border,
            }]}>
              <IconSymbol name="lock.fill" size={20} color={Colors[colorScheme ?? 'light'].textSecondary} />
              <TextInput
                style={[styles.input, { color: Colors[colorScheme ?? 'light'].text }]}
                placeholder="Enter password (min 6 characters)"
                placeholderTextColor={Colors[colorScheme ?? 'light'].textSecondary}
                value={formData.password}
                onChangeText={(text) => setFormData({ ...formData, password: text })}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={[styles.label, { color: Colors[colorScheme ?? 'light'].text }]}>Confirm Password *</ThemedText>
            <View style={[styles.inputWrapper, { 
              backgroundColor: Colors[colorScheme ?? 'light'].inputBackground,
              borderColor: Colors[colorScheme ?? 'light'].border,
            }]}>
              <IconSymbol name="lock.fill" size={20} color={Colors[colorScheme ?? 'light'].textSecondary} />
              <TextInput
                style={[styles.input, { color: Colors[colorScheme ?? 'light'].text }]}
                placeholder="Re-enter password"
                placeholderTextColor={Colors[colorScheme ?? 'light'].textSecondary}
                value={formData.confirmPassword}
                onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={[styles.label, { color: Colors[colorScheme ?? 'light'].text }]}>Select Role</ThemedText>
            <View style={styles.roleContainer}>
              {roleOptions.map((roleOption) => (
                <TouchableOpacity
                  key={roleOption.key}
                  style={[
                    styles.roleButton,
                    { 
                      backgroundColor: Colors[colorScheme ?? 'light'].inputBackground,
                      borderColor: formData.role === roleOption.key 
                        ? Colors[colorScheme ?? 'light'].tint 
                        : Colors[colorScheme ?? 'light'].border,
                    },
                    formData.role === roleOption.key && styles.roleButtonActive
                  ]}
                  onPress={() => setFormData({ ...formData, role: roleOption.key })}>
                  <IconSymbol 
                    name={roleOption.icon}
                    size={24} 
                    color={formData.role === roleOption.key ? Colors[colorScheme ?? 'light'].tint : Colors[colorScheme ?? 'light'].textSecondary} 
                  />
                  <ThemedText
                    style={[
                      styles.roleText,
                      { color: formData.role === roleOption.key ? Colors[colorScheme ?? 'light'].tint : Colors[colorScheme ?? 'light'].text }
                    ]}>
                    {roleOption.label}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={styles.registerButton}
            onPress={handleRegister}
            disabled={isRegistering}>
            <LinearGradient
              colors={[Colors[colorScheme ?? 'light'].gradientStart, Colors[colorScheme ?? 'light'].gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientButton}>
              {isRegistering ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.registerButtonText}>
                  Create Account
                </ThemedText>
              )}
            </LinearGradient>
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
  themeToggle: {
    position: 'absolute',
    top: 60,
    right: 24,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 32,
    paddingTop: 60,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  backText: {
    fontSize: 16,
    marginLeft: 6,
    fontWeight: '600',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoContainer: {
    width: 84,
    height: 84,
    borderRadius: 42,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 2,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  roleContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  roleButton: {
    flex: 1,
    height: 80,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    gap: 8,
  },
  roleButtonActive: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  roleText: {
    fontSize: 16,
    fontWeight: '700',
  },
  registerButton: {
    height: 56,
    borderRadius: 16,
    marginTop: 32,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  gradientButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
