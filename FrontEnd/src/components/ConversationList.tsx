
import { useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useConversations } from '@/hooks/useConversations';
import { useAuth } from '@/contexts/AuthContext';
import { Conversation } from '@/lib/api';

interface ConversationListProps {
  searchQuery: string;
  selectedConversation: Conversation | null;
  onSelectConversation: (conversation: Conversation) => void;
  refreshTrigger?: number; // New prop to trigger refresh from outside
}

export const ConversationList = ({ 
  searchQuery, 
  selectedConversation, 
  onSelectConversation,
  refreshTrigger
}: ConversationListProps) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  const {
    conversations,
    loading,
    error,
    count,
    refreshConversations,
    updateConversationStatus,
    markAsRead
  } = useConversations();

      // Refresh conversations when refreshTrigger changes
    useEffect(() => {
      if (refreshTrigger && refreshTrigger > 0) {
        refreshConversations();
      }
    }, [refreshTrigger, refreshConversations]);

  // Auto-retry on mount if there's an error
  useEffect(() => {
    if (error && !loading) {
      const retryTimer = setTimeout(() => {
        refreshConversations();
      }, 2000);

      return () => clearTimeout(retryTimer);
    }
  }, [error, loading, refreshConversations]);

  // Filter conversations based on search query
  const filteredConversations = conversations.filter(conv => {
    const contact = conv.contactId;
    const contactName = contact.name?.toLowerCase() || '';
    const contactPhone = contact.phoneNumber || '';
    const searchLower = searchQuery.toLowerCase();
    
    return contactName.includes(searchLower) || contactPhone.includes(searchLower);
  });

  // Format time display
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  // Get status badge variant
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'open':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'closed':
        return 'outline';
      default:
        return 'outline';
    }
  };

  // Handle conversation click
  const handleConversationClick = async (conversation: Conversation) => {
    onSelectConversation(conversation);
    
    // Mark as read if there are unread messages
    if (conversation.unreadCount > 0) {
      try {
        await markAsRead(conversation._id);
      } catch (error) {
        console.error('Failed to mark conversation as read:', error);
      }
    }
  };

  // Handle status change
  const handleStatusChange = async (
    conversationId: string, 
    newStatus: 'open' | 'closed' | 'pending',
    event: React.MouseEvent
  ) => {
    event.stopPropagation(); // Prevent conversation selection
    
    try {
      await updateConversationStatus(conversationId, newStatus);
    } catch (error) {
      console.error('Failed to update conversation status:', error);
    }
  };

  // Loading skeleton
  if (loading && conversations.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto">
        {[...Array(5)].map((_, index) => (
          <div key={index} className="p-4 border-b border-border">
            <div className="flex items-start space-x-3">
              <Skeleton className="w-12 h-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-3 w-48" />
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-6" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            Failed to load conversations
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {error}
          </p>
          <Button onClick={refreshConversations} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Empty state
  if (!loading && filteredConversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="h-8 w-8 text-muted-foreground"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            {searchQuery ? 'No conversations found' : 'No conversations yet'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {searchQuery 
              ? 'Try adjusting your search terms'
              : 'Start a conversation to see it here'
            }
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header with count */}
      <div className="sticky top-0 bg-background border-b border-border px-4 py-2 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {count} conversation{count !== 1 ? 's' : ''}
          {searchQuery && ` matching "${searchQuery}"`}
        </span>
        <Button
          onClick={refreshConversations}
          variant="ghost"
          size="sm"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Conversation list */}
      {filteredConversations.map((conversation) => {
        const contact = conversation.contactId;
        const lastMessage = conversation.lastMessage;
        const isSelected = selectedConversation?._id === conversation._id;
        
        return (
          <div
            key={conversation._id}
            onClick={() => handleConversationClick(conversation)}
            className={`p-4 border-b border-border cursor-pointer hover:bg-accent transition-colors ${
              isSelected ? 'bg-accent border-l-4 border-l-primary' : ''
            }`}
          >
            <div className="flex items-start space-x-3">
              {/* Avatar */}
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-medium text-lg">
                  {contact.name?.charAt(0)?.toUpperCase() || contact.phoneNumber?.charAt(-4) || '?'}
                </span>
              </div>
              
              <div className="flex-1 min-w-0">
                {/* Header row */}
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-medium text-foreground truncate">
                    {contact.name || contact.phoneNumber}
                  </h4>
                  <span className="text-xs text-muted-foreground">
                    {formatTime(conversation.lastMessageAt || conversation.updatedAt)}
                  </span>
                </div>
                
                {/* Phone number (if name exists) */}
                {contact.name && (
                  <p className="text-xs text-muted-foreground mb-1">
                    {contact.phoneNumber}
                  </p>
                )}
                
                {/* Department Tags from Participants - Only for Admin */}
                {isAdmin && conversation.participants && conversation.participants.length > 0 && (
                  <div className="mb-2">
                    <div className="flex flex-wrap gap-1">
                      {conversation.participants.slice(0, 3).map((participant, index) => (
                        <Badge 
                          key={index} 
                          variant="outline" 
                          className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 border-blue-200"
                        >
                          👤 {participant.name}
                          {participant.department ? ` - ${participant.department}` : ''}
                        </Badge>
                      ))}
                      {conversation.participants.length > 3 && (
                        <Badge variant="outline" className="text-xs px-2 py-0.5 bg-gray-50 text-gray-600">
                          +{conversation.participants.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Status and unread count */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {conversation.tags.length > 0 && (
                      <div className="flex space-x-1">
                        {conversation.tags.slice(0, 2).map((tag, index) => (
                          <span
                            key={index}
                            className="text-xs bg-muted px-1 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                        {conversation.tags.length > 2 && (
                          <span className="text-xs text-muted-foreground">
                            +{conversation.tags.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {conversation.unreadCount > 0 && (
                    <Badge variant="destructive" className="text-xs min-w-5 h-5 flex items-center justify-center">
                      {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      
      {/* Loading more indicator */}
      {loading && conversations.length > 0 && (
        <div className="p-4 text-center">
          <RefreshCw className="h-4 w-4 animate-spin mx-auto" />
        </div>
      )}
    </div>
  );
};
