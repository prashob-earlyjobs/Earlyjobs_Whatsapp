import { useState, useEffect, useCallback, useRef } from 'react';
import { conversationApi, Conversation, Message } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface UseConversationsReturn {
  conversations: Conversation[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  count: number;
  hasMore: boolean;
  refreshConversations: () => Promise<void>;
  loadMoreConversations: () => Promise<void>;
  updateConversationStatus: (id: string, status: 'open' | 'closed' | 'pending') => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
}

const CONVERSATION_PAGE_SIZE = 30;

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
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const offsetRef = useRef(0);
  const hasMoreRef = useRef(true);
  const loadingRef = useRef(false);
  const loadingMoreRef = useRef(false);

  const limit = CONVERSATION_PAGE_SIZE;

  const fetchConversations = useCallback(async ({ reset = false }: { reset?: boolean } = {}) => {
    // Wait for auth to complete before making API calls
    if (authLoading) {
      return;
    }

    if (!isAuthenticated) {
      setConversations([]);
      setLoading(false);
      setLoadingMore(false);
      setError(null);
      setCount(0);
      setHasMore(false);
      offsetRef.current = 0;
      hasMoreRef.current = false;
      loadingRef.current = false;
      loadingMoreRef.current = false;
      return;
    }

    if (reset) {
      loadingRef.current = true;
      loadingMoreRef.current = false;
      hasMoreRef.current = true;
      offsetRef.current = 0;

      setLoading(true);
      setLoadingMore(false);
      setError(null);
      setHasMore(true);
    } else {
      if (loadingRef.current || loadingMoreRef.current || !hasMoreRef.current) {
        return;
      }

      loadingMoreRef.current = true;
      setLoadingMore(true);
      setError(null);
    }

    try {
      const currentOffset = reset ? 0 : offsetRef.current;

      const response = await conversationApi.getConversations(undefined, {
        limit,
        offset: currentOffset,
      });

      const data = response.data;
      const newConversations = data.conversations ?? [];
      const totalCount = data.count ?? 0;

      const nextOffset = currentOffset + newConversations.length;
      const responseHasMore = data.pagination?.hasMore;
      const computedHasMore =
        typeof responseHasMore === 'boolean'
          ? responseHasMore
          : newConversations.length > 0 && nextOffset < totalCount;

      if (reset) {
        setConversations(newConversations);
      } else {
        setConversations(prev => {
          const existingIds = new Set(prev.map(conv => conv._id));
          const deduped = newConversations.filter(conv => !existingIds.has(conv._id));
          return [...prev, ...deduped];
        });
      }

      setCount(totalCount);
      setHasMore(computedHasMore);
      offsetRef.current = nextOffset;
      hasMoreRef.current = computedHasMore;
      setError(null);
    } catch (error: any) {
      // Handle auth errors
      const wasAuthError = handleAuthError(error, logout);
      
      if (!wasAuthError) {
        setError(error.message || 'Failed to fetch conversations');
      }

      if (reset) {
        setConversations([]);
        setCount(0);
        setHasMore(false);
        offsetRef.current = 0;
        hasMoreRef.current = false;
      }
    } finally {
      if (reset) {
        loadingRef.current = false;
        setLoading(false);
      } else {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [authLoading, isAuthenticated, limit, logout]);

  const refreshConversations = useCallback(async () => {
    await fetchConversations({ reset: true });
  }, [fetchConversations]);

  const loadMoreConversations = useCallback(async () => {
    await fetchConversations({ reset: false });
  }, [fetchConversations]);

  const updateConversationStatus = useCallback(async (
    id: string, 
    status: 'open' | 'closed' | 'pending'
  ) => {
    try {
      await conversationApi.updateConversationStatus(id, status);
      
      // Update local state
      setConversations(prev => prev.map(conv =>
        conv._id === id ? { ...conv, status } : conv
      ));
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
      setConversations(prev => prev.map(conv =>
        conv._id === id ? { ...conv, unreadCount: 0 } : conv
      ));
    } catch (error: any) {
      // Handle auth errors
      const wasAuthError = handleAuthError(error, logout);
      if (!wasAuthError) {
        throw error;
      }
    }
  }, [logout]);

  useEffect(() => {
    if (!authLoading) {
      fetchConversations({ reset: true });
    }
  }, [authLoading, fetchConversations]);

  return {
    conversations,
    loading,
    loadingMore,
    error,
    count,
    hasMore,
    refreshConversations,
    loadMoreConversations,
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
  refreshMessages: () => Promise<void>;
  hasMore: boolean;
}

export const useConversationMessages = (conversationId: string | null): UseConversationMessagesReturn => {
  const { logout, isAuthenticated, isLoading: authLoading } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [lastMessageTimestamp, setLastMessageTimestamp] = useState<string | null>(null);
  
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
        // Set timestamp of the most recent message (first in array since sorted desc)
        if (newMessages.length > 0) {
          setLastMessageTimestamp(newMessages[0].timestamp);
        }
      } else {
        // When loading more (older) messages, add them to the beginning
        // since backend returns messages in descending order (newest first)
        setMessages(prev => [...newMessages, ...prev]);
        setOffset(prev => prev + newMessages.length);
        // Update timestamp if we have newer messages
        if (newMessages.length > 0) {
          setLastMessageTimestamp(newMessages[0].timestamp);
        }
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

  const refreshMessages = useCallback(async () => {
    if (loading) return;
    await fetchMessages(true);
  }, [fetchMessages, loading]);

  const sendMessage = useCallback(async (messageData: {
    type: 'text' | 'image' | 'document' | 'template';
    content: any;
  }) => {
    if (!conversationId || !isAuthenticated) {
      return;
    }
    
    try {
      const response = await conversationApi.sendMessage(conversationId, messageData);
      
      // Add the new message to the beginning of the array, but check for duplicates first
      setMessages(prev => {
        const existingIds = new Set(prev.map(msg => msg._id));
        if (!existingIds.has(response.data.message._id)) {
          console.log(`📤 Adding sent message to local state`);
          return [response.data.message, ...prev];
        }
        console.log(`⚠️ Message ${response.data.message._id} already exists, skipping duplicate`);
        return prev;
      });
      setLastMessageTimestamp(response.data.message.timestamp);
      
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
      setLastMessageTimestamp(null);
      fetchMessages(true);
    } else if (!isAuthenticated && !authLoading) {
      // Clear messages when not authenticated
      setMessages([]);
      setError(null);
    }
  }, [conversationId, isAuthenticated, authLoading]);

  // Poll for new messages when conversation is active
  useEffect(() => {
    if (!conversationId || !isAuthenticated || authLoading || !lastMessageTimestamp) {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        // Fetch only new messages since last timestamp
        const response = await conversationApi.getNewMessages(
          conversationId, 
          lastMessageTimestamp
        );
        
        const newMessages = response.data.messages;
        
        // Check if we have new messages
        if (newMessages.length > 0) {
          // Filter out messages that are already in the current state to prevent duplicates
          setMessages(prev => {
            const existingIds = new Set(prev.map(msg => msg._id));
            const uniqueNewMessages = newMessages.filter(msg => !existingIds.has(msg._id));
            
            if (uniqueNewMessages.length > 0) {
              console.log(`📨 Adding ${uniqueNewMessages.length} new unique messages`);
              return [...uniqueNewMessages, ...prev];
            }
            return prev;
          });
          
          setOffset(prev => prev + newMessages.length);
          // Update timestamp to the most recent message
          setLastMessageTimestamp(newMessages[0].timestamp);
        }
      } catch (error: any) {
        // Silently handle polling errors to avoid disrupting the UI
        console.warn('Polling error:', error.message);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [conversationId, isAuthenticated, authLoading, lastMessageTimestamp]);

  return {
    messages,
    loading,
    error,
    loadMoreMessages,
    sendMessage,
    refreshMessages,
    hasMore,
  };
}; 