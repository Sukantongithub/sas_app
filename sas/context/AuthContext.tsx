import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '@/types/auth';
import { authAPI } from '@/services/authApi';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (userData: any) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = '@attendance_token';
const USER_KEY = '@attendance_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load session on mount
  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
    try {
      const savedToken = await AsyncStorage.getItem(TOKEN_KEY);
      const savedUser = await AsyncStorage.getItem(USER_KEY);

      if (savedToken && savedUser) {
        // Verify token is still valid
        const response = await authAPI.verify(savedToken);
        
        if (response.valid) {
          setToken(savedToken);
          setUser(response.user);
        } else {
          // Token invalid, clear storage
          await clearSession();
        }
      }
    } catch (error) {
      console.error('Error loading session:', error);
      await clearSession();
    } finally {
      setLoading(false);
    }
  };

  const saveSession = async (token: string, user: User) => {
    try {
      await AsyncStorage.setItem(TOKEN_KEY, token);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (error) {
      console.error('Error saving session:', error);
    }
  };

  const clearSession = async () => {
    try {
      await AsyncStorage.removeItem(TOKEN_KEY);
      await AsyncStorage.removeItem(USER_KEY);
      setToken(null);
      setUser(null);
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      const response = await authAPI.login(email, password);
      
      setToken(response.token);
      setUser(response.user);
      await saveSession(response.token, response.user);
    } catch (error: any) {
      throw new Error(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      console.log('Logout: Starting logout process');
      // Capture token before clearing
      const currentToken = token;

      // Best-effort call to backend first
      if (currentToken) {
        try {
          console.log('Logout: Calling logout API with JWT token');
          await authAPI.logout(currentToken);
          console.log('Logout: API call completed');
        } catch (error) {
          console.error('Logout API error (continuing with client-side logout):', error);
        }
      }

      // Clear local session
      await clearSession();
      console.log('Logout: Local session cleared');

      // Ensure AsyncStorage is fully cleared
      await AsyncStorage.removeItem(TOKEN_KEY);
      await AsyncStorage.removeItem(USER_KEY);
      console.log('Logout: AsyncStorage cleared');
    } catch (error) {
      console.error('Logout error:', error);
      // Force clear state even if async storage fails
      setToken(null);
      setUser(null);
    }
  };

  const register = async (userData: any) => {
    try {
      setLoading(true);
      await authAPI.register(userData);
    } catch (error: any) {
      throw new Error(error.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        loading,
        login,
        logout,
        register,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
