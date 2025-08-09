import { tokenManager, authApi } from './auth-api';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

// Track if we're currently refreshing to avoid multiple concurrent refresh attempts
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  
  failedQueue = [];
};

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

// Conversation Types
export interface Contact {
  _id: string;
  phoneNumber: string;
  name: string;
  tags?: string[];
}

export interface DeliveryReport {
  _id: string;
  messageId: string;
  srcAddr: string;
  destAddr: string;
  channel: string;
  eventType: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  cause: string;
  errorCode: string;
  eventTs: string;
  hsmTemplateId?: string;
  conversation?: any;
  pricing?: any;
  noOfFrags?: number;
  internalStatus: 'sent' | 'delivered' | 'read' | 'failed';
  processedAt: string;
  createdAt: string;
}

export interface Message {
  _id: string;
  conversationId: string;
  contactId: string;
  senderId?: string;
  messageId: string;
  type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'template' | 'button';
  content: {
    text?: string;
    mediaUrl?: string;
    mediaType?: string;
    templateId?: string;
    templateData?: any;
    header?: string;
    footer?: string;
    buttonData?: any;
  };
  direction: 'inbound' | 'outbound';
  status?: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  _id: string;
  contactId: Contact;
  status: 'open' | 'closed' | 'pending';
  assignedTo?: string;
  department?: string;
  tags: string[];
  lastMessage?: Message;
  lastMessageAt?: string;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationFilters {
  status?: 'open' | 'closed' | 'pending';
  assignedTo?: string;
  department?: string;
  tags?: string[];
}

// User Types
export interface UserData {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'bde' | 'hr' | 'franchise' | 'tech';
  status: 'active' | 'inactive';
  department: string;
  permissions: string[];
  avatar: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserStats {
  total: number;
  active: number;
  inactive: number;
  byRole: {
    admin: number;
    bde: number;
    hr: number;
    franchise: number;
    tech: number;
  };
}

export interface CreateUserData {
  name: string;
  email: string;
  role: 'admin' | 'bde' | 'hr' | 'franchise' | 'tech';
  department?: string;
  password: string;
  permissions?: string[];
}

export interface UpdateUserData {
  name?: string;
  role?: 'admin' | 'bde' | 'hr' | 'franchise' | 'tech';
  department?: string;
  isActive?: boolean;
  permissions?: string[];
}

// API Helper Functions
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  console.log('🌐 API Request:', {
    url,
    method: options.method || 'GET',
    endpoint
  });
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  // Add auth token if available
  const token = tokenManager.getToken();
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
    console.log('🔐 Token found:', token.substring(0, 20) + '...');
  } else {
    console.log('⚠️ No token found');
  }

  const config: RequestInit = {
    headers: { ...defaultHeaders, ...options.headers },
    ...options,
  };

  try {
    console.log('📡 Making request to:', url);
    const response = await fetch(url, config);
    console.log('📥 Response status:', response.status);
    
    // Try to parse response
    let data;
    try {
      data = await response.json();
      console.log('📦 Response data:', data);
    } catch (parseError) {
      console.error('❌ Parse error:', parseError);
      throw new Error('Invalid response from server');
    }

    // Handle authentication errors
    if (response.status === 401 || (response.status === 403 && data.message && (data.message.includes('expired') || data.message.includes('Invalid or expired token')))) {
      // Check if this is actually a token expiry
      if (data.message && (data.message.includes('expired') || data.message.includes('Invalid or expired token'))) {
        // Try to refresh the token
        const refreshToken = tokenManager.getRefreshToken();
        
        if (!refreshToken) {
          tokenManager.clearTokens();
          throw new Error('REFRESH_TOKEN_MISSING');
        }

        if (isRefreshing) {
          // If already refreshing, queue this request
          return new Promise((resolve, reject) => {
            failedQueue.push({ 
              resolve: (token) => {
                // Retry with new token
                const newConfig: RequestInit = {
                  ...config,
                  headers: {
                    ...config.headers,
                    'Authorization': `Bearer ${token}`,
                  },
                };
                
                fetch(url, newConfig)
                  .then(res => res.json())
                  .then(resolve)
                  .catch(reject);
              }, 
              reject 
            });
          });
        }

        isRefreshing = true;
        
        try {
          const refreshResponse = await authApi.refreshToken(refreshToken);
          
          if (refreshResponse.success && refreshResponse.data) {
            // Update token
            const newToken = refreshResponse.data.token;
            tokenManager.setTokens(newToken, refreshToken);
            
            // Process the queue with the new token
            processQueue(null, newToken);
            
            // Retry the original request with the new token
            const newConfig: RequestInit = {
              ...config,
              headers: {
                ...config.headers,
                'Authorization': `Bearer ${newToken}`,
              },
            };
            
            // Retry the original request
            const retryResponse = await fetch(url, newConfig);
            const retryData = await retryResponse.json();
            
            if (!retryResponse.ok) {
              throw new Error(retryData.message || `HTTP error! status: ${retryResponse.status}`);
            }
            
            return retryData;
          } else {
            throw new Error('Token refresh failed - no data returned');
          }
        } catch (refreshError: any) {
          // Process the queue with error
          processQueue(refreshError, null);
          
          // Clear tokens
          tokenManager.clearTokens();
          
          // Throw a specific error that the AuthContext can handle
          throw new Error('REFRESH_FAILED');
        } finally {
          isRefreshing = false;
        }
      } else {
        // For non-expiry auth errors, don't try to refresh
        throw new Error(data.message || 'Authentication failed');
      }
    }

    // Handle other authentication errors (403 without token expiry)
    if (response.status === 403 && data.message && !data.message.includes('expired') && !data.message.includes('Invalid or expired token')) {
      // Don't clear tokens for 403 - user might not have permission for this specific resource
      throw new Error(data.message || 'Access forbidden');
    }

    if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }

    return data;
  } catch (error: any) {
    // Re-throw specific auth errors
    if (error.message === 'REFRESH_TOKEN_MISSING' || error.message === 'REFRESH_FAILED') {
      throw error;
    }
    
    throw error;
  }
}

// Conversation API Functions
export const conversationApi = {
  // Start new conversation with phone number
  startConversation: async (data: {
    phoneNumber: string;
    name: string;
    email?: string;
    initialMessage?: string;
  }): Promise<ApiResponse<{
    conversation: Conversation;
    contact: Contact;
    isNew: boolean;
    initialMessageSent?: boolean;
  }>> => {
    return apiRequest<{
      conversation: Conversation;
      contact: Contact;
      isNew: boolean;
      initialMessageSent?: boolean;
    }>('/conversations/start', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Get all conversations with optional filters
  getConversations: async (filters?: ConversationFilters): Promise<ApiResponse<{ conversations: Conversation[]; count: number }>> => {
    const queryParams = new URLSearchParams();
    
    if (filters?.status) queryParams.append('status', filters.status);
    if (filters?.assignedTo) queryParams.append('assignedTo', filters.assignedTo);
    if (filters?.tags) {
      filters.tags.forEach(tag => queryParams.append('tags', tag));
    }

    const endpoint = `/conversations${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiRequest<{ conversations: Conversation[]; count: number }>(endpoint);
  },

  // Get specific conversation by ID
  getConversationById: async (id: string): Promise<ApiResponse<{ conversation: Conversation }>> => {
    return apiRequest<{ conversation: Conversation }>(`/conversations/${id}`);
  },

  // Get messages for a conversation
  getConversationMessages: async (
    id: string, 
    limit: number = 50, 
    offset: number = 0
  ): Promise<ApiResponse<{ messages: Message[]; count: number; conversationId: string }>> => {
    return apiRequest<{ messages: Message[]; count: number; conversationId: string }>(
      `/conversations/${id}/messages?limit=${limit}&offset=${offset}`
    );
  },

  // Get new messages since timestamp
  getNewMessages: async (
    id: string,
    since: string
  ): Promise<ApiResponse<{ messages: Message[]; count: number; conversationId: string; since: string }>> => {
    return apiRequest<{ messages: Message[]; count: number; conversationId: string; since: string }>(
      `/conversations/${id}/messages/new?since=${encodeURIComponent(since)}`
    );
  },

  // Update conversation status
  updateConversationStatus: async (
    id: string, 
    status: 'open' | 'closed' | 'pending'
  ): Promise<ApiResponse<{ conversation: Conversation }>> => {
    return apiRequest<{ conversation: Conversation }>(`/conversations/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },

  // Assign conversation to user
  assignConversation: async (
    id: string, 
    userId: string
  ): Promise<ApiResponse<{ conversation: Conversation }>> => {
    return apiRequest<{ conversation: Conversation }>(`/conversations/${id}/assign`, {
      method: 'PUT',
      body: JSON.stringify({ userId }),
    });
  },

  // Send message in conversation
  sendMessage: async (
    id: string,
    messageData: {
      type: 'text' | 'image' | 'document' | 'template';
      content: any;
    }
  ): Promise<ApiResponse<{ message: Message; gupshupStatus: string; sentToPhone: string }>> => {
    return apiRequest<{ message: Message; gupshupStatus: string; sentToPhone: string }>(
      `/conversations/${id}/messages`,
      {
        method: 'POST',
        body: JSON.stringify(messageData),
      }
    );
  },

  // Check if conversation is within 24-hour messaging window
  check24HourWindow: async (conversationId: string): Promise<ApiResponse<{
    canSendRegularMessages: boolean;
    canSendTemplates: boolean;
    lastInboundMessageAt?: string;
    hoursRemaining?: number;
  }>> => {
    return apiRequest<{
      canSendRegularMessages: boolean;
      canSendTemplates: boolean;
      lastInboundMessageAt?: string;
      hoursRemaining?: number;
    }>(`/conversations/${conversationId}/24-hour-status`);
  },

  // Mark conversation as read
  markAsRead: async (id: string): Promise<ApiResponse<{ conversation: Conversation }>> => {
    return apiRequest<{ conversation: Conversation }>(`/conversations/${id}/read`, {
      method: 'PUT',
    });
  },

  // Create new conversation
  createConversation: async (contactId: string, assignedTo?: string): Promise<ApiResponse<{ conversation: Conversation }>> => {
    return apiRequest<{ conversation: Conversation }>('/conversations', {
      method: 'POST',
      body: JSON.stringify({ contactId, assignedTo }),
    });
  },
};

export default conversationApi;

// Template Types
export interface GupshupTemplate {
  id: number;
  name: string;
  category: string;
  language: string;
  type: string;
  body: string;
  footer?: string;
  header?: string;
  button_type: string;
  quality_score: string;
  status: string;
  creation_time: number;
  updation_time: number;
}

export interface LocalTemplate {
  _id: string;
  name: string;
  category: string;
  language: string;
  department?: string;
  status: 'approved' | 'pending' | 'rejected';
  templateId: string;
  header?: {
    type: 'text' | 'image' | 'document';
    content: string;
  };
  body: {
    text: string;
    variables: string[];
  };
  footer?: string;
  buttons: Array<{
    type: 'quick_reply' | 'url' | 'phone';
    text: string;
    url?: string;
    phoneNumber?: string;
  }>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateFilters {
  status?: 'approved' | 'pending' | 'rejected';
  category?: string;
  language?: string;
  department?: string;
  createdBy?: string;
}

// Template API Functions
export const templateApi = {
  // Gupshup Templates (Direct from API)
  getGupshupTemplates: async (params?: {
    limit?: number;
    status?: string;
    category?: string;
    search?: string;
  }): Promise<ApiResponse<{
    templates: GupshupTemplate[];
    total: number;
    filters: any;
  }>> => {
    const queryParams = new URLSearchParams();
    
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.category) queryParams.append('category', params.category);
    if (params?.search) queryParams.append('search', params.search);

    const endpoint = `/templates/gupshup${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiRequest<{
      templates: GupshupTemplate[];
      total: number;
      filters: any;
    }>(endpoint);
  },

  getGupshupTemplateCategories: async (): Promise<ApiResponse<{
    categories: string[];
    total: number;
  }>> => {
    return apiRequest<{
      categories: string[];
      total: number;
    }>('/templates/gupshup/categories');
  },

  getGupshupTemplateStats: async (): Promise<ApiResponse<{
    total: number;
    byStatus: Record<string, number>;
    byCategory: Record<string, number>;
    byLanguage: Record<string, number>;
    byType: Record<string, number>;
  }>> => {
    return apiRequest<{
      total: number;
      byStatus: Record<string, number>;
      byCategory: Record<string, number>;
      byLanguage: Record<string, number>;
      byType: Record<string, number>;
    }>('/templates/gupshup/stats');
  },

  getGupshupTemplateById: async (templateId: number): Promise<ApiResponse<GupshupTemplate>> => {
    return apiRequest<GupshupTemplate>(`/templates/gupshup/${templateId}`);
  },

  // Local Template Management
  saveGupshupTemplate: async (data: {
    gupshupTemplateId: number;
    customName?: string;
  }): Promise<ApiResponse<{
    template: LocalTemplate;
    gupshupSource: {
      id: number;
      name: string;
      status: string;
    };
  }>> => {
    return apiRequest<{
      template: LocalTemplate;
      gupshupSource: {
        id: number;
        name: string;
        status: string;
      };
    }>('/templates/save-from-gupshup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  createCustomTemplate: async (data: {
    name: string;
    category: string;
    language: string;
    department?: string;
    body: string;
    header?: string;
    footer?: string;
    buttons?: Array<{
      type: 'quick_reply' | 'url' | 'phone';
      text: string;
      url?: string;
      phoneNumber?: string;
    }>;
  }): Promise<ApiResponse<{
    template: LocalTemplate;
  }>> => {
    return apiRequest<{
      template: LocalTemplate;
    }>('/templates/create-custom', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getLocalTemplates: async (filters?: TemplateFilters): Promise<ApiResponse<{
    templates: LocalTemplate[];
    total: number;
    filters: TemplateFilters;
  }>> => {
    const queryParams = new URLSearchParams();
    
    if (filters?.status) queryParams.append('status', filters.status);
    if (filters?.category) queryParams.append('category', filters.category);
    if (filters?.language) queryParams.append('language', filters.language);
    if (filters?.createdBy) queryParams.append('createdBy', filters.createdBy);

    const endpoint = `/templates${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiRequest<{
      templates: LocalTemplate[];
      total: number;
      filters: TemplateFilters;
    }>(endpoint);
  },

  getLocalTemplateById: async (id: string): Promise<ApiResponse<{
    template: LocalTemplate;
  }>> => {
    return apiRequest<{
      template: LocalTemplate;
    }>(`/templates/${id}`);
  },

  updateLocalTemplate: async (
    id: string,
    data: Partial<LocalTemplate>
  ): Promise<ApiResponse<{
    template: LocalTemplate;
  }>> => {
    return apiRequest<{
      template: LocalTemplate;
    }>(`/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteLocalTemplate: async (id: string): Promise<ApiResponse<any>> => {
    return apiRequest<any>(`/templates/${id}`, {
      method: 'DELETE',
    });
  },

  getLocalTemplateCategories: async (): Promise<ApiResponse<{
    categories: string[];
    total: number;
  }>> => {
    return apiRequest<{
      categories: string[];
      total: number;
    }>('/templates/categories/local');
  },
}; 

// Contact API
export const contactApi = {
  // Search contacts
  async searchContacts(query: string, limit: number = 10): Promise<ApiResponse<{ contacts: Contact[]; count: number; totalFound: number }>> {
    return apiRequest(`/contacts/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  },

  // Get all contacts with filters
  async getAllContacts(filters: { 
    search?: string; 
    tags?: string[]; 
    assignedTo?: string; 
    isBlocked?: boolean; 
  } = {}): Promise<ApiResponse<{ contacts: Contact[]; count: number }>> {
    const params = new URLSearchParams();
    
    if (filters.search) params.append('search', filters.search);
    if (filters.tags?.length) filters.tags.forEach(tag => params.append('tags', tag));
    if (filters.assignedTo) params.append('assignedTo', filters.assignedTo);
    if (filters.isBlocked !== undefined) params.append('isBlocked', filters.isBlocked.toString());
    
    const queryString = params.toString();
    return apiRequest(`/contacts${queryString ? `?${queryString}` : ''}`);
  },

  // Get contact by ID
  async getContactById(id: string): Promise<ApiResponse<{ contact: Contact }>> {
    return apiRequest(`/contacts/${id}`);
  },

  // Create contact
  async createContact(contactData: {
    phoneNumber: string;
    name: string;
    email?: string;
    tags?: string[];
    customFields?: Record<string, any>;
    assignedTo?: string;
  }): Promise<ApiResponse<{ contact: Contact }>> {
    return apiRequest('/contacts', {
      method: 'POST',
      body: JSON.stringify(contactData),
    });
  },
}; 

// Bulk Message Types
export interface BulkMessage {
  _id: string;
  name: string;
  templateId: LocalTemplate;
  contacts: Contact[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  scheduledAt?: string;
  sentCount: number;
  failedCount: number;
  createdBy: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ContactData {
  name: string;
  phoneNumber: string;
  email?: string;
  tags?: string[];
  [key: string]: any; // Allow dynamic properties for template variables
}

export interface BulkMessageStatus {
  status: string;
  sentCount: number;
  failedCount: number;
  totalCount: number;
  progress: number;
}

// Bulk Message API
export const bulkMessageApi = {
  // Validate contacts before creating bulk message
  async validateContacts(contactsData: ContactData[]): Promise<ApiResponse<{
    validationResults: any[];
    summary: {
      total: number;
      valid: number;
      invalid: number;
    };
  }>> {
    return apiRequest('/bulk-messages/validate-contacts', {
      method: 'POST',
      body: JSON.stringify({ contactsData }),
    });
  },

  // Create and send bulk message
  async createBulkMessage(data: {
    name: string;
    templateId: string;
    contactsData: ContactData[];
    scheduledAt?: string;
  }): Promise<ApiResponse<{
    bulkMessage: BulkMessage;
    contactResults: any[];
    validContacts: number;
    totalContacts: number;
  }>> {
    return apiRequest('/bulk-messages', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Get all bulk messages
  async getAllBulkMessages(filters: {
    status?: 'pending' | 'processing' | 'completed' | 'failed';
    createdBy?: string;
  } = {}): Promise<ApiResponse<{
    bulkMessages: BulkMessage[];
    count: number;
  }>> {
    const params = new URLSearchParams();
    
    if (filters.status) params.append('status', filters.status);
    if (filters.createdBy) params.append('createdBy', filters.createdBy);
    
    const queryString = params.toString();
    return apiRequest(`/bulk-messages${queryString ? `?${queryString}` : ''}`);
  },

  // Get bulk message by ID
  async getBulkMessageById(id: string): Promise<ApiResponse<{
    bulkMessage: BulkMessage;
  }>> {
    return apiRequest(`/bulk-messages/${id}`);
  },

  // Get bulk message status
  async getBulkMessageStatus(id: string): Promise<ApiResponse<BulkMessageStatus>> {
    return apiRequest(`/bulk-messages/${id}/status`);
  },

  // Cancel bulk message
  async cancelBulkMessage(id: string): Promise<ApiResponse<{
    bulkMessage: BulkMessage;
  }>> {
    return apiRequest(`/bulk-messages/${id}/cancel`, {
      method: 'PUT',
    });
  },
};

// User Management API
export const userApi = {
  // Get all users
  async getAllUsers(): Promise<ApiResponse<{
    users: UserData[];
    count: number;
  }>> {
    return apiRequest<{
      users: UserData[];
      count: number;
    }>('/users');
  },

  // Get user by ID
  async getUserById(id: string): Promise<ApiResponse<{
    user: UserData;
  }>> {
    return apiRequest<{
      user: UserData;
    }>(`/users/${id}`);
  },

  // Create new user
  async createUser(data: CreateUserData): Promise<ApiResponse<{
    user: UserData;
  }>> {
    return apiRequest<{
      user: UserData;
    }>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Update user
  async updateUser(id: string, data: UpdateUserData): Promise<ApiResponse<{
    user: UserData;
  }>> {
    return apiRequest<{
      user: UserData;
    }>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Delete user
  async deleteUser(id: string): Promise<ApiResponse<{
    message: string;
  }>> {
    return apiRequest<{
      message: string;
    }>(`/users/${id}`, {
      method: 'DELETE',
    });
  },

  // Get user statistics
  async getUserStats(): Promise<ApiResponse<{
    stats: UserStats;
  }>> {
    return apiRequest<{
      stats: UserStats;
    }>('/users/stats');
  },
};

// Delivery Report API
export const deliveryReportApi = {
  // Get delivery reports for a specific message
  async getMessageDeliveryReports(messageId: string): Promise<ApiResponse<{
    message: {
      _id: string;
      messageId: string;
      type: string;
      status: string;
      timestamp: string;
    };
    deliveryReports: DeliveryReport[];
    latestReport: DeliveryReport | null;
    totalReports: number;
  }>> {
    return apiRequest<{
      message: {
        _id: string;
        messageId: string;
        type: string;
        status: string;
        timestamp: string;
      };
      deliveryReports: DeliveryReport[];
      latestReport: DeliveryReport | null;
      totalReports: number;
    }>(`/conversations/messages/${messageId}/delivery-reports`);
  },
}; 