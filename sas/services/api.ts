// Update this with your machine's IP address when testing on physical device
// Find your IP: Windows (ipconfig), Mac/Linux (ifconfig)
const API_BASE_URL = 'http://localhost:5000/api';

// For Android Emulator use: http://10.0.2.2:5000/api
// For iOS Simulator use: http://localhost:5000/api
// For Physical Device use: http://YOUR_IP_ADDRESS:5000/api

const authHeaders = (token?: string): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

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

// Messaging API
export const messagingAPI = {
  getConversations: async (userId: string, params?: any, token?: string) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page);
    if (params?.limit) queryParams.append('limit', params.limit);

    const url = queryParams.toString()
      ? `${API_BASE_URL}/messages/${userId}/conversations?${queryParams}`
      : `${API_BASE_URL}/messages/${userId}/conversations`;

    const response = await fetchWithTimeout(url, {
      headers: authHeaders(token),
    });
    return handleResponse(response);
  },

  getConversationMessages: async (conversationId: string, page?: number, limit?: number, token?: string) => {
    const queryParams = new URLSearchParams();
    if (page) queryParams.append('page', page.toString());
    if (limit) queryParams.append('limit', limit.toString());

    const url = queryParams.toString()
      ? `${API_BASE_URL}/messages/conversation/${conversationId}/messages?${queryParams}`
      : `${API_BASE_URL}/messages/conversation/${conversationId}/messages`;

    const response = await fetchWithTimeout(url, {
      headers: authHeaders(token),
    });
    return handleResponse(response);
  },

  sendMessage: async (recipientId: string, content: string, attachments?: any[], token?: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/messages/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
      body: JSON.stringify({ recipientId, content, attachments }),
    });
    return handleResponse(response);
  },

  createConversation: async (participantIds: string[], token?: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/messages/conversation/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
      body: JSON.stringify({ participantIds }),
    });
    return handleResponse(response);
  },

  deleteConversation: async (conversationId: string, token?: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/messages/${conversationId}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    return handleResponse(response);
  },

  reactToMessage: async (messageId: string, reaction: string, token?: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/messages/${messageId}/react`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
      body: JSON.stringify({ reaction }),
    });
    return handleResponse(response);
  },

  searchMessages: async (query: string, conversationId?: string, token?: string) => {
    const queryParams = new URLSearchParams();
    if (conversationId) queryParams.append('conversationId', conversationId);

    const url = queryParams.toString()
      ? `${API_BASE_URL}/messages/search/${query}?${queryParams}`
      : `${API_BASE_URL}/messages/search/${query}`;

    const response = await fetchWithTimeout(url, {
      headers: authHeaders(token),
    });
    return handleResponse(response);
  },

  pinMessage: async (messageId: string, token?: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/messages/${messageId}/pin`, {
      method: 'POST',
      headers: authHeaders(token),
    });
    return handleResponse(response);
  },

  getPinnedMessages: async (conversationId: string, token?: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/messages/${conversationId}/pinned`, {
      headers: authHeaders(token),
    });
    return handleResponse(response);
  },
};

// Student Management API
export const studentManagementAPI = {
  // Manage Students
  listStudents: async (params?: any, token?: string) => {
    const queryParams = new URLSearchParams();
    if (params?.class) queryParams.append('class', params.class);
    if (params?.department) queryParams.append('department', params.department);
    if (params?.search) queryParams.append('search', params.search);
    if (params?.page) queryParams.append('page', params.page);
    if (params?.limit) queryParams.append('limit', params.limit);
    if (params?.status) queryParams.append('status', params.status);

    const url = queryParams.toString()
      ? `${API_BASE_URL}/student-management/list?${queryParams}`
      : `${API_BASE_URL}/student-management/list`;

    const response = await fetchWithTimeout(url, {
      headers: authHeaders(token),
    });
    return handleResponse(response);
  },

  getStudentProfile: async (studentId: string, token?: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/student-management/${studentId}/profile`, {
      headers: authHeaders(token),
    });
    return handleResponse(response);
  },

  updateStudent: async (studentId: string, data: any, token?: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/student-management/${studentId}/update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  updateStudentStatus: async (studentId: string, isActive: boolean, token?: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/student-management/${studentId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
      body: JSON.stringify({ isActive }),
    });
    return handleResponse(response);
  },

  // Request Approval
  getPendingRequests: async (studentId: string, token?: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/student-management/${studentId}/pending-requests`, {
      headers: authHeaders(token),
    });
    return handleResponse(response);
  },

  getApprovalQueue: async (type?: string, priority?: string, token?: string) => {
    const queryParams = new URLSearchParams();
    if (type) queryParams.append('type', type);
    if (priority) queryParams.append('priority', priority);

    const url = queryParams.toString()
      ? `${API_BASE_URL}/student-management/requests/approval-queue?${queryParams}`
      : `${API_BASE_URL}/student-management/requests/approval-queue`;

    const response = await fetchWithTimeout(url, {
      headers: authHeaders(token),
    });
    return handleResponse(response);
  },

  approveRequest: async (requestId: string, comments?: string, priority?: string, token?: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/student-management/requests/${requestId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
      body: JSON.stringify({ comments, priority }),
    });
    return handleResponse(response);
  },

  rejectRequest: async (requestId: string, reason: string, token?: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/student-management/requests/${requestId}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
      body: JSON.stringify({ reason }),
    });
    return handleResponse(response);
  },

  // Student Features & Info
  getAcademicInfo: async (studentId: string, token?: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/student-management/${studentId}/academic-info`, {
      headers: authHeaders(token),
    });
    return handleResponse(response);
  },

  getPerformance: async (studentId: string, startDate?: string, endDate?: string, token?: string) => {
    const queryParams = new URLSearchParams();
    if (startDate) queryParams.append('startDate', startDate);
    if (endDate) queryParams.append('endDate', endDate);

    const url = queryParams.toString()
      ? `${API_BASE_URL}/student-management/${studentId}/performance?${queryParams}`
      : `${API_BASE_URL}/student-management/${studentId}/performance`;

    const response = await fetchWithTimeout(url, {
      headers: authHeaders(token),
    });
    return handleResponse(response);
  },

  getDocuments: async (studentId: string, token?: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/student-management/${studentId}/documents`, {
      headers: authHeaders(token),
    });
    return handleResponse(response);
  },

  generateCertificate: async (studentId: string, certificateType: string, token?: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/student-management/${studentId}/generate-certificate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
      body: JSON.stringify({ certificateType }),
    });
    return handleResponse(response);
  },

  getNotifications: async (studentId: string, token?: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/student-management/${studentId}/notifications`, {
      headers: authHeaders(token),
    });
    return handleResponse(response);
  },

  getSchedule: async (studentId: string, token?: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/student-management/${studentId}/schedule`, {
      headers: authHeaders(token),
    });
    return handleResponse(response);
  },
};

