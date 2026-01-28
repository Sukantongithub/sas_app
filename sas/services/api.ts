// Update this with your machine's IP address when testing on physical device
// Find your IP: Windows (ipconfig), Mac/Linux (ifconfig)
const API_BASE_URL = 'http://localhost:5000/api';

// For Android Emulator use: http://10.0.2.2:5000/api
// For iOS Simulator use: http://localhost:5000/api
// For Physical Device use: http://YOUR_IP_ADDRESS:5000/api

const authHeaders = (token?: string) => (
  token ? { Authorization: `Bearer ${token}` } : {}
);

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

const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 10000) => {
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

// Students API
export const studentsAPI = {
  getAll: async (token?: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/students`, {
      headers: {
        ...authHeaders(token),
      },
    });
    return handleResponse(response);
  },

  getById: async (id: string, token?: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/students/${id}`, {
      headers: {
        ...authHeaders(token),
      },
    });
    return handleResponse(response);
  },

  create: async (studentData: any, token?: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
      body: JSON.stringify(studentData),
    });
    return handleResponse(response);
  },

  update: async (id: string, studentData: any, token?: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/students/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
      body: JSON.stringify(studentData),
    });
    return handleResponse(response);
  },

  delete: async (id: string, token?: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/students/${id}`, {
      method: 'DELETE',
      headers: {
        ...authHeaders(token),
      },
    });
    return handleResponse(response);
  },
};

// Attendance API
export const attendanceAPI = {
  getAll: async (params?: { date?: string; studentId?: string }, token?: string) => {
    const queryParams = new URLSearchParams();
    if (params?.date) queryParams.append('date', params.date);
    if (params?.studentId) queryParams.append('studentId', params.studentId);
    
    const url = queryParams.toString() 
      ? `${API_BASE_URL}/attendance?${queryParams}`
      : `${API_BASE_URL}/attendance`;
    
    const response = await fetchWithTimeout(url, {
      headers: {
        ...authHeaders(token),
      },
    });
    return handleResponse(response);
  },

  getToday: async (token?: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/attendance/today`, {
      headers: {
        ...authHeaders(token),
      },
    });
    return handleResponse(response);
  },

  getByStudent: async (studentId: string, token?: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/attendance/student/${studentId}`, {
      headers: {
        ...authHeaders(token),
      },
    });
    return handleResponse(response);
  },

  getStudentDaily: async (studentId: string, date?: string, token?: string) => {
    const queryParams = date ? `?date=${date}` : '';
    const response = await fetchWithTimeout(`${API_BASE_URL}/attendance/student/${studentId}/daily${queryParams}`, {
      headers: {
        ...authHeaders(token),
      },
    });
    return handleResponse(response);
  },

  getStudentSubjectWise: async (studentId: string, params?: { startDate?: string; endDate?: string }, token?: string) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    
    const url = queryParams.toString() 
      ? `${API_BASE_URL}/attendance/student/${studentId}/subject-wise?${queryParams}`
      : `${API_BASE_URL}/attendance/student/${studentId}/subject-wise`;
    
    const response = await fetchWithTimeout(url, {
      headers: {
        ...authHeaders(token),
      },
    });
    return handleResponse(response);
  },

  getStudentMonthly: async (studentId: string, year?: number, month?: number, token?: string) => {
    const queryParams = new URLSearchParams();
    if (year) queryParams.append('year', year.toString());
    if (month) queryParams.append('month', month.toString());
    
    const url = queryParams.toString() 
      ? `${API_BASE_URL}/attendance/student/${studentId}/monthly?${queryParams}`
      : `${API_BASE_URL}/attendance/student/${studentId}/monthly`;
    
    const response = await fetchWithTimeout(url, {
      headers: {
        ...authHeaders(token),
      },
    });
    return handleResponse(response);
  },

  getStudentTimeRecords: async (studentId: string, params?: { startDate?: string; endDate?: string }, token?: string) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    
    const url = queryParams.toString() 
      ? `${API_BASE_URL}/attendance/student/${studentId}/time-records?${queryParams}`
      : `${API_BASE_URL}/attendance/student/${studentId}/time-records`;
    
    const response = await fetchWithTimeout(url, {
      headers: {
        ...authHeaders(token),
      },
    });
    return handleResponse(response);
  },

  mark: async (attendanceData: {
    studentId: string;
    date: string;
    status: 'present' | 'absent' | 'late';
    remarks?: string;
  }, token?: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
      body: JSON.stringify(attendanceData),
    });
    return handleResponse(response);
  },

  markBulk: async (records: Array<{
    studentId: string;
    date: string;
    status: 'present' | 'absent' | 'late';
    remarks?: string;
  }>, token?: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/attendance/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
      body: JSON.stringify({ records }),
    });
    return handleResponse(response);
  },

  delete: async (id: string, token?: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/attendance/${id}`, {
      method: 'DELETE',
      headers: {
        ...authHeaders(token),
      },
    });
    return handleResponse(response);
  },

  getAllStats: async (token?: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/attendance/stats/all`, {
      headers: {
        ...authHeaders(token),
      },
    });
    return handleResponse(response);
  },

  getStudentTimetable: async (studentId: string, token?: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/attendance/student/${studentId}/timetable`, {
      headers: {
        ...authHeaders(token),
      },
    });
    return handleResponse(response);
  },

  downloadAttendanceReport: async (studentId: string, format: 'csv' | 'json' = 'csv', token?: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/attendance/student/${studentId}/report?format=${format}`, {
      headers: {
        ...authHeaders(token),
      },
    });
    
    if (format === 'json') {
      return handleResponse(response);
    }
    
    // For CSV, return the text content
    const text = await response.text();
    if (!response.ok) {
      throw {
        response: {
          status: response.status,
          data: text,
        },
        message: `HTTP error ${response.status}`,
      };
    }
    return text;
  },
};

// Student Interactions API
export const studentInteractionsAPI = {
  // Absence Reasons
  submitAbsenceReason: async (data: { date: string; reason: string; reasonType?: string; attendanceId: string }, token?: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/student-interactions/absence-reason`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  getAbsenceReasons: async (studentId: string, params?: { status?: string; startDate?: string; endDate?: string }, token?: string) => {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    
    const url = queryParams.toString()
      ? `${API_BASE_URL}/student-interactions/absence-reasons/${studentId}?${queryParams}`
      : `${API_BASE_URL}/student-interactions/absence-reasons/${studentId}`;
    
    const response = await fetchWithTimeout(url, {
      headers: {
        ...authHeaders(token),
      },
    });
    return handleResponse(response);
  },

  // Leave Applications
  submitLeave: async (data: { startDate: string; endDate: string; leaveType?: string; reason: string }, token?: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/student-interactions/leave`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  getLeaves: async (studentId: string, status?: string, token?: string) => {
    const queryParams = status ? `?status=${status}` : '';
    const response = await fetchWithTimeout(`${API_BASE_URL}/student-interactions/leaves/${studentId}${queryParams}`, {
      headers: {
        ...authHeaders(token),
      },
    });
    return handleResponse(response);
  },

  // Exam Eligibility
  getExamEligibility: async (studentId: string, params?: { examType?: string; startDate?: string; endDate?: string }, token?: string) => {
    const queryParams = new URLSearchParams();
    if (params?.examType) queryParams.append('examType', params.examType);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    
    const url = queryParams.toString()
      ? `${API_BASE_URL}/student-interactions/exam-eligibility/${studentId}?${queryParams}`
      : `${API_BASE_URL}/student-interactions/exam-eligibility/${studentId}`;
    
    const response = await fetchWithTimeout(url, {
      headers: {
        ...authHeaders(token),
      },
    });
    return handleResponse(response);
  },

  // Notifications & Low Attendance
  checkLowAttendance: async (studentId: string, token?: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/student-interactions/low-attendance-check/${studentId}`, {
      headers: {
        ...authHeaders(token),
      },
    });
    return handleResponse(response);
  },

  getNotifications: async (studentId: string, params?: { unreadOnly?: boolean; type?: string }, token?: string) => {
    const queryParams = new URLSearchParams();
    if (params?.unreadOnly) queryParams.append('unreadOnly', 'true');
    if (params?.type) queryParams.append('type', params.type);
    
    const url = queryParams.toString()
      ? `${API_BASE_URL}/student-interactions/notifications/${studentId}?${queryParams}`
      : `${API_BASE_URL}/student-interactions/notifications/${studentId}`;
    
    const response = await fetchWithTimeout(url, {
      headers: {
        ...authHeaders(token),
      },
    });
    return handleResponse(response);
  },

  markNotificationRead: async (notificationId: string, token?: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/student-interactions/notifications/${notificationId}/read`, {
      method: 'PUT',
      headers: {
        ...authHeaders(token),
      },
    });
    return handleResponse(response);
  },

  // On-Duty Requests
  submitOnDuty: async (data: { startDate: string; endDate: string; dutyType: string; reason: string; institution?: string; expectedClassesMissed?: number }, token?: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/student-interactions/on-duty`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  getOnDutyRequests: async (studentId: string, status?: string, token?: string) => {
    const queryParams = new URLSearchParams();
    if (status) queryParams.append('status', status);
    
    const url = queryParams.toString()
      ? `${API_BASE_URL}/student-interactions/on-duty/${studentId}?${queryParams}`
      : `${API_BASE_URL}/student-interactions/on-duty/${studentId}`;
    
    const response = await fetchWithTimeout(url, {
      headers: {
        ...authHeaders(token),
      },
    });
    return handleResponse(response);
  },

  approveOnDuty: async (onDutyId: string, approvalRemarks?: string, token?: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/student-interactions/on-duty/${onDutyId}/approve`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
      body: JSON.stringify({ approvalRemarks: approvalRemarks || '' }),
    });
    return handleResponse(response);
  },

  rejectOnDuty: async (onDutyId: string, approvalRemarks?: string, token?: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/student-interactions/on-duty/${onDutyId}/reject`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
      body: JSON.stringify({ approvalRemarks: approvalRemarks || '' }),
    });
    return handleResponse(response);
  },
};

