import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { authApi, tokenManager, User, LoginData, RegisterData } from '@/lib/auth-api';

// Auth State Interface
interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  error: string | null;
}

// Auth Actions
type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: { user: User; token: string; refreshToken: string } }
  | { type: 'LOGIN_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'SET_USER'; payload: User }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'CLEAR_ERROR' }
  | { type: 'TOKEN_REFRESHED'; payload: { token: string } };

// Initial State
const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: true,
  user: null,
  error: null,
};

// Auth Reducer
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        isAuthenticated: true,
        isLoading: false,
        user: action.payload.user,
        error: null,
      };
    case 'LOGIN_FAILURE':
      return {
        ...state,
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: action.payload,
      };
    case 'LOGOUT':
      return {
        ...state,
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null,
      };
    case 'SET_USER':
      return {
        ...state,
        isAuthenticated: true,
        isLoading: false,
        user: action.payload,
        error: null,
      };
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    case 'TOKEN_REFRESHED':
      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
}

// Auth Context Interface
interface AuthContextType extends AuthState {
  login: (data: LoginData) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  refreshUserProfile: () => Promise<void>;
  handleTokenRefresh: (newToken: string) => void;
}

// Create Context
const AuthContext = createContext<AuthContextType | null>(null);

// Auth Provider Props
interface AuthProviderProps {
  children: ReactNode;
}

// Auth Provider Component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check if user is already authenticated on mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const token = tokenManager.getToken();
      const refreshToken = tokenManager.getRefreshToken();
      const user = tokenManager.getUser();

      if (token && user) {
        try {
          // Verify token is still valid by fetching profile
          const response = await authApi.getProfile();
          if (response.success && response.data) {
            dispatch({ type: 'SET_USER', payload: response.data.user });
            tokenManager.setUser(response.data.user); // Update stored user data
            return;
          }
        } catch (error: any) {
          // Try to refresh token if we have a refresh token
          if (refreshToken) {
            try {
              const refreshResponse = await authApi.refreshToken(refreshToken);
              
              if (refreshResponse.success && refreshResponse.data) {
                const newToken = refreshResponse.data.token;
                tokenManager.setTokens(newToken, refreshToken);
                
                // Verify with new token
                const profileResponse = await authApi.getProfile();
                if (profileResponse.success && profileResponse.data) {
                  dispatch({ type: 'SET_USER', payload: profileResponse.data.user });
                  tokenManager.setUser(profileResponse.data.user);
                  dispatch({ type: 'TOKEN_REFRESHED', payload: { token: newToken } });
                  return;
                }
              }
            } catch (refreshError: any) {
              console.error('Token refresh failed:', refreshError.message);
            }
          }
          
          // Token refresh failed or no refresh token, clear everything
          tokenManager.clearTokens();
        }
      }

      dispatch({ type: 'SET_LOADING', payload: false });
    };

    checkAuthStatus();
  }, []);

  // Handle token refresh from API layer
  const handleTokenRefresh = (newToken: string) => {
    dispatch({ type: 'TOKEN_REFRESHED', payload: { token: newToken } });
  };

  // Login function
  const login = async (data: LoginData): Promise<void> => {
    dispatch({ type: 'LOGIN_START' });
    
    try {
      const response = await authApi.login(data);
      
      if (response.success) {
        const { user, token, refreshToken } = response.data;
        
        // Store tokens and user data
        tokenManager.setTokens(token, refreshToken);
        tokenManager.setUser(user);
        
        dispatch({ 
          type: 'LOGIN_SUCCESS', 
          payload: { user, token, refreshToken } 
        });
      } else {
        throw new Error(response.message);
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Login failed';
      dispatch({ type: 'LOGIN_FAILURE', payload: errorMessage });
      throw error;
    }
  };

  // Register function
  const register = async (data: RegisterData): Promise<void> => {
    dispatch({ type: 'LOGIN_START' });
    
    try {
      const response = await authApi.register(data);
      
      if (response.success) {
        // After successful registration, automatically log in
        await login({ email: data.email, password: data.password });
      } else {
        throw new Error(response.message);
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Registration failed';
      dispatch({ type: 'LOGIN_FAILURE', payload: errorMessage });
      throw error;
    }
  };

  // Logout function
  const logout = async (): Promise<void> => {
    try {
      // Call logout API if token exists
      const token = tokenManager.getToken();
      if (token) {
        await authApi.logout();
      }
    } catch (error) {
      // Continue with logout even if API call fails
    } finally {
      // Clear local storage and state
      tokenManager.clearTokens();
      dispatch({ type: 'LOGOUT' });
    }
  };

  // Clear error function
  const clearError = (): void => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  // Refresh user profile
  const refreshUserProfile = async (): Promise<void> => {
    try {
      const response = await authApi.getProfile();
      if (response.success && response.data) {
        dispatch({ type: 'SET_USER', payload: response.data.user });
        tokenManager.setUser(response.data.user);
      }
    } catch (error: any) {
      throw error;
    }
  };

  // Context value
  const contextValue: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    clearError,
    refreshUserProfile,
    handleTokenRefresh,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext; 