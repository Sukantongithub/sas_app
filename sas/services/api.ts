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
};
