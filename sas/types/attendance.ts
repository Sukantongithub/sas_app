export interface Student {
  id: string;
  name: string;
  rollNumber: string;
  email?: string;
  phone?: string;
  class: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  remarks?: string;
  markedAt: string;
}

export interface AttendanceStats {
  totalClasses: number;
  present: number;
  absent: number;
  late: number;
  percentage: number;
}
