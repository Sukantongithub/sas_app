const API_BASE_URL = 'http://localhost:5000/api';

const handleResponse = async (response: Response) => {
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = text;
  }

  if (!response.ok) {
    console.error('API Error Response:', {
      status: response.status,
      data: data,
      url: response.url
    });
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

// Auth API
export const authAPI = {
  login: async (email: string, password: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    return handleResponse(response);
  },

  register: async (userData: {
    name: string;
    email: string;
    password: string;
    role?: string;
    studentId?: string;
  }) => {
    console.log('Registration request:', { ...userData, password: '***' });
    const response = await fetchWithTimeout(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });
    return handleResponse(response);
  },

  verify: async (token: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ token }),
    });
    return handleResponse(response);
  },

  logout: async (token: string) => {
    console.log('Logout API: Sending request (JWT - client-side removal)');
    if (!token) {
      console.warn('No token available for logout');
      return { message: 'No token to logout', success: true };
    }

    // With JWT, just verify token is valid before client removes it
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      console.log('Logout API: Response received');
      return handleResponse(response);
    } catch (error) {
      console.error('Logout API error (continuing with client-side logout):', error);
      // Even if server call fails, return success so client can logout
      return { message: 'Logged out (client-side)', success: true };
    }
  },

  getMe: async (token: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  changePassword: async (
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
    token: string
  ) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    });
    return handleResponse(response);
  },
};
