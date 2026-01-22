import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Student, AttendanceRecord } from '@/types/attendance';
import { studentsAPI, attendanceAPI } from '@/services/api';

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

  const refreshStudents = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await studentsAPI.getAll();
      // Map MongoDB _id to id for compatibility
      const mappedData = data.map((student: any) => ({
        id: student._id,
        name: student.name,
        rollNumber: student.rollNumber,
        email: student.email,
        phone: student.phone,
        class: student.class,
      }));
      setStudents(mappedData);
    } catch (err: any) {
      setError(err.message || 'Failed to load students');
      console.error('Error loading students:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshAttendance = async () => {
    try {
      setError(null);
      const data = await attendanceAPI.getAll();
      // Map MongoDB format to app format
      const mappedData = data.map((record: any) => ({
        id: record._id,
        studentId: record.studentId._id || record.studentId,
        date: record.date,
        status: record.status,
        remarks: record.remarks,
        markedAt: record.markedAt,
      }));
      setAttendanceRecords(mappedData);
    } catch (err: any) {
      setError(err.message || 'Failed to load attendance records');
      console.error('Error loading attendance:', err);
    }
  };

  // Load students on mount
  useEffect(() => {
    refreshStudents();
    refreshAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addStudent = async (student: Omit<Student, 'id'>) => {
    try {
      setLoading(true);
      setError(null);
      await studentsAPI.create(student);
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
      await studentsAPI.delete(id);
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
      
      await attendanceAPI.mark({
        studentId,
        date: today,
        status,
        remarks,
      });
      
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
