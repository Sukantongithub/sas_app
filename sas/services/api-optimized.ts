// API Configuration and Utilities
const API_BASE_URL = 'http://localhost:5000/api';
const REQUEST_TIMEOUT = 10000;

// Helper to create authorization headers
const authHeaders = (token?: string): Record<string, string> => {
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
};

// Generic error handler
const handleResponse = async (response: Response) => {
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw {
      response: {
        status: response.status,
        data: data,
      },
      message: data.message || `HTTP error ${response.status}`,
    };
  }

  return data;
};

// Fetch with timeout
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = REQUEST_TIMEOUT) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

// Build query string from params
const buildQueryString = (params?: Record<string, any>): string => {
  if (!params) return '';
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, String(value));
    }
  });
  const qs = queryParams.toString();
  return qs ? `?${qs}` : '';
};

// Generic GET request
const apiGet = async (endpoint: string, params?: Record<string, any>, token?: string) => {
  const url = `${API_BASE_URL}${endpoint}${buildQueryString(params)}`;
  const response = await fetchWithTimeout(url, {
    headers: authHeaders(token),
  });
  return handleResponse(response);
};

// Generic POST request
const apiPost = async (endpoint: string, body?: any, token?: string) => {
  const response = await fetchWithTimeout(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(token),
    },
    body: JSON.stringify(body),
  });
  return handleResponse(response);
};

// Generic PUT request
const apiPut = async (endpoint: string, body?: any, token?: string) => {
  const response = await fetchWithTimeout(`${API_BASE_URL}${endpoint}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(token),
    },
    body: JSON.stringify(body),
  });
  return handleResponse(response);
};

// Generic DELETE request
const apiDelete = async (endpoint: string, token?: string) => {
  const response = await fetchWithTimeout(`${API_BASE_URL}${endpoint}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return handleResponse(response);
};

// Students API
export const studentsAPI = {
  getAll: (token?: string) => apiGet('/students', undefined, token),
  getById: (id: string, token?: string) => apiGet(`/students/${id}`, undefined, token),
  create: (studentData: any, token?: string) => apiPost('/students', studentData, token),
  update: (id: string, studentData: any, token?: string) => apiPut(`/students/${id}`, studentData, token),
  delete: (id: string, token?: string) => apiDelete(`/students/${id}`, token),
};

// Attendance API
export const attendanceAPI = {
  getAll: (params?: { date?: string; studentId?: string }, token?: string) => 
    apiGet('/attendance', params, token),
  
  getToday: (token?: string) => 
    apiGet('/attendance/today', undefined, token),
  
  getByStudent: (studentId: string, token?: string) => 
    apiGet(`/attendance/student/${studentId}`, undefined, token),
  
  getStudentDaily: (studentId: string, date?: string, token?: string) => 
    apiGet(`/attendance/student/${studentId}/daily`, { date }, token),
  
  getStudentSubjectWise: (studentId: string, params?: { startDate?: string; endDate?: string }, token?: string) => 
    apiGet(`/attendance/student/${studentId}/subject-wise`, params, token),
  
  getStudentMonthly: (studentId: string, year?: number, month?: number, token?: string) => 
    apiGet(`/attendance/student/${studentId}/monthly`, { year, month }, token),
  
  getStudentTimeRecords: (studentId: string, params?: { startDate?: string; endDate?: string }, token?: string) => 
    apiGet(`/attendance/student/${studentId}/time-records`, params, token),
  
  getStudentHistory: (studentId: string, params?: { startDate?: string; endDate?: string; page?: number; limit?: number }, token?: string) => 
    apiGet(`/attendance/student/${studentId}/history`, params, token),
  
  getStudentTimetable: (studentId: string, token?: string) => 
    apiGet(`/attendance/student/${studentId}/timetable`, undefined, token),
  
  downloadAttendanceReport: (studentId: string, format: 'csv' | 'json', token?: string) => 
    apiGet(`/attendance/student/${studentId}/report`, { format }, token),
  
  mark: (attendanceData: any, token?: string) => 
    apiPost('/attendance', attendanceData, token),
};

// Student Interactions API
export const studentInteractionsAPI = {
  // Absence Reasons
  submitAbsenceReason: (data: any, token?: string) => 
    apiPost('/student-interactions/absence-reason', data, token),
  
  getAbsenceReasons: (studentId: string, params?: { status?: string; startDate?: string; endDate?: string }, token?: string) => 
    apiGet(`/student-interactions/absence-reasons/${studentId}`, params, token),
  
  // Leave Applications
  submitLeave: (data: any, token?: string) => 
    apiPost('/student-interactions/leave', data, token),
  
  getLeaves: (studentId: string, params?: { status?: string }, token?: string) => 
    apiGet(`/student-interactions/leaves/${studentId}`, params, token),
  
  // Exam Eligibility
  getExamEligibility: (studentId: string, params?: { examType?: string; startDate?: string; endDate?: string }, token?: string) => 
    apiGet(`/student-interactions/exam-eligibility/${studentId}`, params, token),
  
  // Low Attendance Check
  checkLowAttendance: (studentId: string, token?: string) => 
    apiGet(`/student-interactions/low-attendance-check/${studentId}`, undefined, token),
  
  // Notifications
  getNotifications: (studentId: string, params?: { unreadOnly?: boolean; type?: string }, token?: string) => 
    apiGet(`/student-interactions/notifications/${studentId}`, params, token),
  
  markNotificationRead: (notificationId: string, token?: string) => 
    apiPut(`/student-interactions/notifications/${notificationId}/read`, undefined, token),
  
  // On-Duty Requests
  submitOnDuty: (data: any, token?: string) => 
    apiPost('/student-interactions/on-duty', data, token),
  
  getOnDutyRequests: (studentId: string, params?: { status?: string }, token?: string) => 
    apiGet(`/student-interactions/on-duty/${studentId}`, params, token),
  
  approveOnDuty: (id: string, approvalRemarks?: string, token?: string) => 
    apiPut(`/student-interactions/on-duty/${id}/approve`, { approvalRemarks }, token),
  
  rejectOnDuty: (id: string, approvalRemarks?: string, token?: string) => 
    apiPut(`/student-interactions/on-duty/${id}/reject`, { approvalRemarks }, token),
};

export { API_BASE_URL };
