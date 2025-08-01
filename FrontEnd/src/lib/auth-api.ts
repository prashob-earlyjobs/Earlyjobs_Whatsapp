// Authentication API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

// Auth Types
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'bde' | 'hr' | 'franchise' | 'tech';
  department?: string;
  isActive: boolean;
  permissions: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'bde' | 'hr' | 'franchise' | 'tech';
  department?: string;
  permissions?: string[];
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    token: string;
    refreshToken: string;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
}

// Helper function for API requests
async function authApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  // Add auth token if available (except for login/register)
  const token = localStorage.getItem('authToken');
  if (token && !endpoint.includes('/login') && !endpoint.includes('/register')) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    headers: { ...defaultHeaders, ...options.headers },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('Auth API request failed:', error);
    throw error;
  }
}

// Authentication API Functions
export const authApi = {
  // Login user
  login: async (loginData: LoginData): Promise<AuthResponse> => {
    const response = await authApiRequest<AuthResponse['data']>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(loginData),
    });
    
    return {
      success: response.success,
      message: response.message,
      data: response.data!,
    };
  },

  // Register user
  register: async (registerData: RegisterData): Promise<ApiResponse<{ user: User }>> => {
    return authApiRequest<{ user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(registerData),
    });
  },

  // Logout user
  logout: async (): Promise<ApiResponse<null>> => {
    return authApiRequest<null>('/auth/logout', {
      method: 'POST',
    });
  },

  // Get user profile
  getProfile: async (): Promise<ApiResponse<{ user: User }>> => {
    return authApiRequest<{ user: User }>('/auth/profile');
  },

  // Update user profile
  updateProfile: async (updateData: Partial<User> & { currentPassword?: string; password?: string }): Promise<ApiResponse<{ user: User }>> => {
    return authApiRequest<{ user: User }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  },

  // Refresh token
  refreshToken: async (refreshToken: string): Promise<ApiResponse<{ token: string }>> => {
    return authApiRequest<{ token: string }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  },
};

// Token management utilities
export const tokenManager = {
  setTokens: (token: string, refreshToken: string) => {
    localStorage.setItem('authToken', token);
    localStorage.setItem('refreshToken', refreshToken);
  },

  getToken: (): string | null => {
    return localStorage.getItem('authToken');
  },

  getRefreshToken: (): string | null => {
    return localStorage.getItem('refreshToken');
  },

  clearTokens: () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  },

  setUser: (user: User) => {
    localStorage.setItem('user', JSON.stringify(user));
  },

  getUser: (): User | null => {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },
};

export default authApi; 