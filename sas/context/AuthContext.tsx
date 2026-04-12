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
  resetNavigation: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = '@attendance_token';
const USER_KEY = '@attendance_user';
const NAVIGATION_KEY = '@attendance_last_navigation';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
    try {
      console.log('AuthContext.loadSession: Starting');
      const savedToken = await AsyncStorage.getItem(TOKEN_KEY);
      const savedUser = await AsyncStorage.getItem(USER_KEY);

      console.log('AuthContext.loadSession: Retrieved from storage - token exists:', !!savedToken, 'user exists:', !!savedUser);

      if (savedToken && savedUser) {
        // Verify token is still valid
        console.log('AuthContext.loadSession: Calling verify API');
        const response = await authAPI.verify(savedToken);
        console.log('AuthContext.loadSession: Verify response:', response);

        if (response.valid) {
          console.log('AuthContext.loadSession: Token valid, setting state');
          setToken(savedToken);
          setUser(response.user);
        } else {
          console.log('AuthContext.loadSession: Token invalid, clearing session');
          // Token invalid, clear storage
          await clearSession();
        }
      } else {
        console.log('AuthContext.loadSession: No saved session');
      }
    } catch (error) {
      console.error('AuthContext.loadSession: Error loading session:', error);
      await clearSession();
    } finally {
      console.log('AuthContext.loadSession: Complete');
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
      console.log('[AuthContext.login] Starting login for email:', email);
      
      const response = await authAPI.login(email, password);
      console.log('[AuthContext.login] API Response received:', {
        hasToken: !!response.token,
        hasUser: !!response.user,
        tokenLength: response.token?.length || 0,
        userData: response.user ? { id: response.user._id, role: response.user.role, email: response.user.email } : null
      });

      if (!response.token) {
        throw new Error('No token in response');
      }
      if (!response.user) {
        throw new Error('No user data in response');
      }

      console.log('[AuthContext.login] Setting state with token and user');
      setToken(response.token);
      setUser(response.user);
      
      console.log('[AuthContext.login] Saving session to storage');
      await saveSession(response.token, response.user);
      
      console.log('[AuthContext.login] Resetting navigation');
      await resetNavigation();
      
      console.log('[AuthContext.login] Login successful!');
    } catch (error: any) {
      console.error('[AuthContext.login] Login error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        fullError: error
      });
      throw new Error(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const resetNavigation = async () => {
    try {
      await AsyncStorage.removeItem(NAVIGATION_KEY);
    } catch (error) {
      console.error('Error resetting navigation:', error);
    }
  };

  const logout = async () => {
    console.log('\n========================================');
    console.log('LOGOUT FUNCTION CALLED');
    console.log('========================================');
    console.log('Current state - user:', user?.email, 'token exists:', !!token);

    try {
      // Capture token before clearing state
      const currentToken = token;
      console.log('Token captured:', currentToken ? 'YES' : 'NO');

      // Call backend logout API first (before clearing state)
      if (currentToken) {
        try {
          console.log('Calling backend logout API...');
          await authAPI.logout(currentToken);
          console.log('Backend logout API: SUCCESS');
        } catch (error) {
          console.error('Backend logout API: FAILED (continuing)', error);
        }
      } else {
        console.log('No token, skipping API call');
      }

      // Clear AsyncStorage
      console.log('Clearing AsyncStorage...');
      await AsyncStorage.removeItem(TOKEN_KEY);
      await AsyncStorage.removeItem(USER_KEY);
      console.log('AsyncStorage: CLEARED');

      // Clear state - this should trigger re-render and navigation
      console.log('Clearing state...');
      setUser(null);
      setToken(null);
      console.log('State: CLEARED');
      console.log('isAuthenticated should now be: false');
      console.log('========================================\n');
    } catch (error) {
      console.error('\n!!! LOGOUT ERROR !!!', error);
      // Force clear everything even if there's an error
      try {
        await AsyncStorage.removeItem(TOKEN_KEY);
        await AsyncStorage.removeItem(USER_KEY);
      } catch (storageError) {
        console.error('AsyncStorage clear error:', storageError);
      }
      setUser(null);
      setToken(null);
      console.log('Force cleared state despite error\n');
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
        resetNavigation,
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
