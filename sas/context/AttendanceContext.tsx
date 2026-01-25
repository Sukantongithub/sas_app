import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Student, AttendanceRecord } from '@/types/attendance';
import { studentsAPI, attendanceAPI } from '@/services/api';
import { useAuth } from '@/context/AuthContext';

interface AttendanceContextType {
  students: Student[];
  attendanceRecords: AttendanceRecord[];
  loading: boolean;
  error: string | null;
  addStudent: (student: Omit<Student, 'id'>) => Promise<void>;
  deleteStudent: (id: string) => Promise<void>;
  markAttendance: (studentId: string, status: 'present' | 'absent' | 'late', remarks?: string) => Promise<void>;
  getStudentAttendance: (studentId: string) => AttendanceRecord[];
  getTodayAttendance: () => AttendanceRecord[];
  refreshStudents: () => Promise<void>;
  refreshAttendance: () => Promise<void>;
}

const AttendanceContext = createContext<AttendanceContextType | undefined>(undefined);

export function AttendanceProvider({ children }: { children: ReactNode }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { token, isAuthenticated, loading: authLoading } = useAuth();

  const refreshStudents = React.useCallback(async () => {
    try {
      if (!token) {
        console.warn('AttendanceContext.refreshStudents: No token available');
        setError('Authorization token required');
        return;
      }
      console.log('AttendanceContext.refreshStudents: Token available, fetching students with token:', token.substring(0, 20) + '...');
      setLoading(true);
      setError(null);
      const data = await studentsAPI.getAll(token);
      // Map MongoDB _id to id for compatibility
      const mappedData = data.map((student: any) => ({
        id: student._id,
        name: student.name,
        rollNumber: student.rollNumber,
        email: student.email,
        phone: student.phone,
        class: student.class,
      }));
      console.log('AttendanceContext.refreshStudents: Successfully fetched', mappedData.length, 'students');
      setStudents(mappedData);
    } catch (err: any) {
      setError(err.message || 'Failed to load students');
      console.error('Error loading students:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const refreshAttendance = React.useCallback(async () => {
    try {
      if (!token) {
        console.warn('AttendanceContext.refreshAttendance: No token available');
        setError('Authorization token required');
        return;
      }
      console.log('AttendanceContext.refreshAttendance: Token available, fetching attendance with token:', token.substring(0, 20) + '...');
      setError(null);
      const data = await attendanceAPI.getAll(undefined, token);
      // Map MongoDB format to app format
      const mappedData = data.map((record: any) => ({
        id: record._id,
        studentId: record.studentId._id || record.studentId,
        date: record.date,
        status: record.status,
        remarks: record.remarks,
        markedAt: record.markedAt,
      }));
      console.log('AttendanceContext.refreshAttendance: Successfully fetched', mappedData.length, 'records');
      setAttendanceRecords(mappedData);
    } catch (err: any) {
      setError(err.message || 'Failed to load attendance records');
      console.error('Error loading attendance:', err);
    }
  }, [token]);

  // Load students and attendance when auth is complete and token is available
  useEffect(() => {
    console.log('AttendanceContext.useEffect: authLoading=', authLoading, 'isAuthenticated=', isAuthenticated, 'hasToken=', !!token);
    
    if (authLoading) {
      console.log('AttendanceContext: Auth still loading, waiting...');
      return;
    }

    if (!isAuthenticated || !token) {
      console.log('AttendanceContext: Not authenticated, clearing data');
      setStudents([]);
      setAttendanceRecords([]);
      return;
    }

    console.log('AttendanceContext: Auth complete with valid token, fetching data');
    refreshStudents();
    refreshAttendance();
  }, [authLoading, isAuthenticated, token, refreshStudents, refreshAttendance]);

  const addStudent = async (student: Omit<Student, 'id'>) => {
    try {
      setLoading(true);
      setError(null);
      if (!token) throw new Error('Authorization token required');

      await studentsAPI.create(student, token);
      await refreshStudents();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to add student');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteStudent = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      if (!token) throw new Error('Authorization token required');

      await studentsAPI.delete(id, token);
      await refreshStudents();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete student');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const markAttendance = async (studentId: string, status: 'present' | 'absent' | 'late', remarks?: string) => {
    try {
      setError(null);
      const today = new Date().toISOString().split('T')[0];
      
      if (!token) throw new Error('Authorization token required');

      await attendanceAPI.mark({
        studentId,
        date: today,
        status,
        remarks,
      }, token);
      
      await refreshAttendance();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to mark attendance');
      throw err;
    }
  };

  const getStudentAttendance = (studentId: string) => {
    return attendanceRecords.filter(record => record.studentId === studentId);
  };

  const getTodayAttendance = () => {
    const today = new Date().toISOString().split('T')[0];
    return attendanceRecords.filter(record => record.date === today);
  };

  return (
    <AttendanceContext.Provider
      value={{
        students,
        attendanceRecords,
        loading,
        error,
        addStudent,
        deleteStudent,
        markAttendance,
        getStudentAttendance,
        getTodayAttendance,
        refreshStudents,
        refreshAttendance,
      }}>
      {children}
    </AttendanceContext.Provider>
  );
}

export function useAttendance() {
  const context = useContext(AttendanceContext);
  if (context === undefined) {
    throw new Error('useAttendance must be used within AttendanceProvider');
  }
  return context;
}
