import { useState, useEffect, useCallback } from 'react';
import { conversationApi, Conversation, Message } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface UseConversationsState {
  conversations: Conversation[];
  loading: boolean;
  error: string | null;
  count: number;
}

interface UseConversationsReturn extends UseConversationsState {
  refreshConversations: () => Promise<void>;
  updateConversationStatus: (id: string, status: 'open' | 'closed' | 'pending') => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
}

// Helper function to handle auth errors
const handleAuthError = (error: any, logout: () => Promise<void>) => {
  if (error.message === 'REFRESH_TOKEN_MISSING' || error.message === 'REFRESH_FAILED') {
    logout().catch(console.error);
    return true; // Indicates this was an auth error
  }
  return false; // Not an auth error
};

export const useConversations = (): UseConversationsReturn => {
  const { logout, isAuthenticated, isLoading: authLoading } = useAuth();
  const [state, setState] = useState<UseConversationsState>({
    conversations: [],
    loading: true,
    error: null,
    count: 0,
  });

  const fetchConversations = useCallback(async () => {
    // Wait for auth to complete before making API calls
    if (authLoading) {
      return;
    }

    if (!isAuthenticated) {
      setState({
        conversations: [],
        loading: false,
        error: null,
        count: 0,
      });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await conversationApi.getConversations();
      
      setState({
        conversations: response.data.conversations,
        loading: false,
        error: null,
        count: response.data.count,
      });
    } catch (error: any) {
      // Handle auth errors
      const wasAuthError = handleAuthError(error, logout);
      
      if (!wasAuthError) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: error.message || 'Failed to fetch conversations',
        }));
      } else {
        // For auth errors, don't show error state, just let logout handle it
        setState(prev => ({ ...prev, loading: false }));
      }
    }
  }, [isAuthenticated, authLoading, logout]);

  const refreshConversations = useCallback(async () => {
    await fetchConversations();
  }, [fetchConversations]);

  const updateConversationStatus = useCallback(async (
    id: string, 
    status: 'open' | 'closed' | 'pending'
  ) => {
    try {
      await conversationApi.updateConversationStatus(id, status);
      
      // Update local state
      setState(prev => ({
        ...prev,
        conversations: prev.conversations.map(conv =>
          conv._id === id ? { ...conv, status } : conv
        ),
      }));
    } catch (error: any) {
      // Handle auth errors
      const wasAuthError = handleAuthError(error, logout);
      if (!wasAuthError) {
        throw error;
      }
    }
  }, [logout]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await conversationApi.markAsRead(id);
      
      // Update local state
      setState(prev => ({
        ...prev,
        conversations: prev.conversations.map(conv =>
          conv._id === id ? { ...conv, unreadCount: 0 } : conv
        ),
      }));
    } catch (error: any) {
      // Handle auth errors
      const wasAuthError = handleAuthError(error, logout);
      if (!wasAuthError) {
        throw error;
      }
    }
  }, [logout]);

  // Fetch conversations when auth completes or when explicitly refreshed
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Also fetch when component mounts (handles page refresh)
  useEffect(() => {
    if (!authLoading) {
      fetchConversations();
    }
  }, []); // Only run on mount

  return {
    ...state,
    refreshConversations,
    updateConversationStatus,
    markAsRead,
  };
};

// Hook for managing messages in a specific conversation
interface UseConversationMessagesReturn {
  messages: Message[];
  loading: boolean;
  error: string | null;
  loadMoreMessages: () => Promise<void>;
  sendMessage: (messageData: { type: 'text' | 'image' | 'document' | 'template'; content: any }) => Promise<void>;
  hasMore: boolean;
}

export const useConversationMessages = (conversationId: string | null): UseConversationMessagesReturn => {
  const { logout, isAuthenticated, isLoading: authLoading } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  
  const limit = 50;

  const fetchMessages = useCallback(async (resetMessages = false) => {
    // Wait for auth to complete before making API calls
    if (authLoading) {
      return;
    }

    if (!conversationId || !isAuthenticated) {
      if (!isAuthenticated) {
        setMessages([]);
        setError(null);
      }
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const currentOffset = resetMessages ? 0 : offset;
      
      const response = await conversationApi.getConversationMessages(
        conversationId, 
        limit, 
        currentOffset
      );
      
      const newMessages = response.data.messages;
      
      if (resetMessages) {
        setMessages(newMessages);
        setOffset(newMessages.length);
      } else {
        // When loading more (older) messages, add them to the beginning
        // since backend returns messages in descending order (newest first)
        setMessages(prev => [...newMessages, ...prev]);
        setOffset(prev => prev + newMessages.length);
      }
      
      setHasMore(newMessages.length === limit);
      
    } catch (error: any) {
      // Handle auth errors
      const wasAuthError = handleAuthError(error, logout);
      if (!wasAuthError) {
        setError(error.message || 'Failed to fetch messages');
      }
    } finally {
      setLoading(false);
    }
  }, [conversationId, offset, limit, isAuthenticated, authLoading, logout]);

  const loadMoreMessages = useCallback(async () => {
    if (!hasMore || loading) return;
    await fetchMessages(false);
  }, [fetchMessages, hasMore, loading]);

  const sendMessage = useCallback(async (messageData: {
    type: 'text' | 'image' | 'document' | 'template';
    content: any;
  }) => {
    if (!conversationId || !isAuthenticated) {
      return;
    }
    
    try {
      const response = await conversationApi.sendMessage(conversationId, messageData);
      
      // Add the new message to the beginning of the array since backend returns
      // messages in descending order (newest first). When ChatInterface reverses
      // the array for display, the new message will appear at the bottom.
      setMessages(prev => [response.data.message, ...prev]);
      
    } catch (error: any) {
      // Handle auth errors
      const wasAuthError = handleAuthError(error, logout);
      if (!wasAuthError) {
        throw error;
      }
    }
  }, [conversationId, isAuthenticated, logout]);

  // Reset and fetch messages when conversation changes or auth completes
  useEffect(() => {
    if (conversationId && isAuthenticated && !authLoading) {
      setMessages([]);
      setOffset(0);
      setHasMore(true);
      setError(null);
      fetchMessages(true);
    } else if (!isAuthenticated && !authLoading) {
      // Clear messages when not authenticated
      setMessages([]);
      setError(null);
    }
  }, [conversationId, isAuthenticated, authLoading]);

  return {
    messages,
    loading,
    error,
    loadMoreMessages,
    sendMessage,
    hasMore,
  };
}; 