import { useState } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function LoginScreen() {
  const colorScheme = useColorScheme();
  const { toggleTheme, isDarkMode } = useTheme();
  const { login, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    try {
      setIsLoggingIn(true);
      await login(email, password);
      // Navigation handled by role-based router
    } catch (error: any) {
      Alert.alert('Login Failed', error.message || 'Invalid credentials');
    } finally {
      setIsLoggingIn(false);
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

      <View style={styles.content}>
        <View style={styles.headerContainer}>
          <View style={styles.logoContainer}>
            <Image 
              source={require('@/assets/images/sas_logo.png')} 
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <ThemedText type="title" style={styles.title}>
            PresenX
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: Colors[colorScheme ?? 'light'].textSecondary }]}>
            Secure login to your account
          </ThemedText>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <ThemedText style={[styles.label, { color: Colors[colorScheme ?? 'light'].text }]}>Email</ThemedText>
            <View style={[styles.inputWrapper, { 
              backgroundColor: Colors[colorScheme ?? 'light'].inputBackground,
              borderColor: Colors[colorScheme ?? 'light'].border,
            }]}>
              <IconSymbol name="envelope.fill" size={20} color={Colors[colorScheme ?? 'light'].textSecondary} />
              <TextInput
                style={[styles.input, { color: Colors[colorScheme ?? 'light'].text }]}
                placeholder="Enter your email"
                placeholderTextColor={Colors[colorScheme ?? 'light'].textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={[styles.label, { color: Colors[colorScheme ?? 'light'].text }]}>Password</ThemedText>
            <View style={[styles.inputWrapper, { 
              backgroundColor: Colors[colorScheme ?? 'light'].inputBackground,
              borderColor: Colors[colorScheme ?? 'light'].border,
            }]}>
              <IconSymbol name="lock.fill" size={20} color={Colors[colorScheme ?? 'light'].textSecondary} />
              <TextInput
                style={[styles.input, { color: Colors[colorScheme ?? 'light'].text }]}
                placeholder="Enter your password"
                placeholderTextColor={Colors[colorScheme ?? 'light'].textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
            disabled={isLoggingIn || loading}>
            <LinearGradient
              colors={[Colors[colorScheme ?? 'light'].gradientStart, Colors[colorScheme ?? 'light'].gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientButton}>
              {isLoggingIn ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.loginButtonText}>
                  Sign In
                </ThemedText>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.registerLink}
            onPress={() => router.push('/register')}>
            <ThemedText style={[styles.registerText, { color: Colors[colorScheme ?? 'light'].textSecondary }]}>
              Don't have an account?{' '}
              <ThemedText style={[styles.registerTextBold, { color: Colors[colorScheme ?? 'light'].tint }]}>
                Register
              </ThemedText>
            </ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
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
  content: {
    padding: 32,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    overflow: 'hidden',
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  title: {
    fontSize: 36,
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
  loginButton: {
    height: 56,
    borderRadius: 16,
    marginTop: 28,
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
  loginButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  registerLink: {
    marginTop: 24,
    alignItems: 'center',
  },
  registerText: {
    fontSize: 14,
    opacity: 0.8,
  },
  registerTextBold: {
    fontWeight: '600',
  },
});
