export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'super_admin' | 'teacher' | 'student';
  studentId?: any;
  lastLogin?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
}
