import { useState, useEffect, useRef } from 'react';
import { Search, Filter, Send, Paperclip, MoreHorizontal, MessageCircle, User, FileText, RefreshCw, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ConversationList } from './ConversationList';
import { TemplateSelector } from './TemplateSelector';
import { DeliveryInfoModal } from './DeliveryInfoModal';
import { MessageTickIndicator } from './MessageStatusIndicator';
import { useConversationMessages } from '@/hooks/useConversations';
import { useAuth } from '@/contexts/AuthContext';
import { Conversation, Message, LocalTemplate, conversationApi } from '@/lib/api';
import { toast } from 'sonner';

interface ChatInterfaceProps {
  selectedConversation: Conversation | null;
  onSelectConversation: (conversation: Conversation) => void;
  onStartNewConversation?: () => void;
  refreshTrigger?: number; // New prop to trigger conversation list refresh
}

export const ChatInterface = ({ 
  selectedConversation, 
  onSelectConversation, 
  onStartNewConversation,
  refreshTrigger 
}: ChatInterfaceProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<LocalTemplate | null>(null);
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [isSending, setIsSending] = useState(false);
  const [previousMessageCount, setPreviousMessageCount] = useState(0);
  
  // 24-hour window state
  const [canSendRegularMessages, setCanSendRegularMessages] = useState(true);
  const [hoursRemaining, setHoursRemaining] = useState<number | null>(null);
  
  // Delivery info modal state
  const [deliveryInfoMessage, setDeliveryInfoMessage] = useState<Message | null>(null);
  const [isDeliveryInfoOpen, setIsDeliveryInfoOpen] = useState(false);
  
  // Refs for scroll management
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isAutoScrolling = useRef(false);

  // Get current user context
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Get messages for the selected conversation
  const {
    messages,
    loading: messagesLoading,
    error: messagesError,
    sendMessage,
    loadMoreMessages,
    refreshMessages,
    hasMore
  } = useConversationMessages(selectedConversation?._id || null);

  // Reverse messages to show newest at bottom (WhatsApp style)
  const displayMessages = [...messages].reverse();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesContainerRef.current && messages.length > previousMessageCount) {
      isAutoScrolling.current = true;
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
      
      // Reset auto-scrolling flag after animation completes
      setTimeout(() => {
        isAutoScrolling.current = false;
      }, 300);
    }
    setPreviousMessageCount(messages.length);
  }, [messages.length, previousMessageCount]);

  // Auto-scroll to bottom when conversation changes
  useEffect(() => {
    if (messagesContainerRef.current && selectedConversation) {
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTo({
            top: messagesContainerRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 100);
    }
    setPreviousMessageCount(0);
  }, [selectedConversation?._id]);

  // Check 24-hour window status when conversation is selected
  useEffect(() => {
    const check24HourWindow = async () => {
      if (!selectedConversation) {
        setCanSendRegularMessages(true);
        setHoursRemaining(null);
        return;
      }

      try {
        const response = await conversationApi.check24HourWindow(selectedConversation._id);
        setCanSendRegularMessages(response.data.canSendRegularMessages);
        setHoursRemaining(response.data.hoursRemaining || null);
      } catch (error) {
        console.error('❌ Error checking 24-hour window:', error);
        // Default to allowing regular messages if there's an error
        setCanSendRegularMessages(true);
        setHoursRemaining(null);
      }
    };

    check24HourWindow();
  }, [selectedConversation]);

  const handleSendMessage = async () => {
    if (!selectedConversation || (!messageText.trim() && !selectedTemplate) || isSending) return;
    
    setIsSending(true);
    try {
      let messageData;
      
      if (selectedTemplate) {
        // Validate template variables are filled
        const missingVariables = selectedTemplate.body.variables?.filter(
          variable => !templateVariables[variable]?.trim()
        ) || [];
        
        if (missingVariables.length > 0) {
          toast.error(`Please fill in all template variables: ${missingVariables.join(', ')}`);
          return;
        }
        
        // Send template message
        messageData = {
          type: 'template' as const,
          content: {
            templateId: selectedTemplate._id, // Use MongoDB _id, not templateId
            templateData: templateVariables
          }
        };
      } else {
        // Send text message
        messageData = {
          type: 'text' as const,
          content: {
            text: messageText
          }
        };
      }
      
      await sendMessage(messageData);
      setMessageText('');
      setSelectedTemplate(null);
      setTemplateVariables({});
      setShowTemplateSelector(false);
    } catch (error: any) {
      console.error('Error sending message:', error);
      
      // Handle 24-hour window error
      if (error.response?.data?.code === 'OUTSIDE_24_HOUR_WINDOW') {
        toast.error('Cannot send regular messages outside the 24-hour window. Please use a template message instead.');
        setCanSendRegularMessages(false);
      } else {
        toast.error(error.response?.data?.message || 'Failed to send message');
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleTemplateSelect = (template: LocalTemplate) => {
    setSelectedTemplate(template);
    setShowTemplateSelector(false);
    
    // Initialize template variables with empty values
    const initialVariables: Record<string, string> = {};
    if (template.body.variables) {
      template.body.variables.forEach(variable => {
        initialVariables[variable] = '';
      });
    }
    setTemplateVariables(initialVariables);
  };

  const handleLoadMoreMessages = async () => {
    if (!messagesContainerRef.current) return;
    
    // Store current scroll position and height
    const container = messagesContainerRef.current;
    const previousScrollHeight = container.scrollHeight;
    const previousScrollTop = container.scrollTop;
    
    await loadMoreMessages();
    
    // Restore scroll position after loading more messages
    setTimeout(() => {
      if (container) {
        const newScrollHeight = container.scrollHeight;
        const heightDifference = newScrollHeight - previousScrollHeight;
        container.scrollTop = previousScrollTop + heightDifference;
      }
    }, 100);
  };

  const handleDeliveryInfoClick = (message: Message) => {
    setDeliveryInfoMessage(message);
    setIsDeliveryInfoOpen(true);
  };

  const handleCloseDeliveryInfo = () => {
    setIsDeliveryInfoOpen(false);
    setDeliveryInfoMessage(null);
  };

  return (
    <div className="flex h-full bg-background">
      {/* Conversation List */}
      <div className="w-1/3 border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border bg-card">

          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <ConversationList
          searchQuery={searchQuery}
          selectedConversation={selectedConversation}
          onSelectConversation={onSelectConversation}
          refreshTrigger={refreshTrigger}
        />
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-border bg-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">{selectedConversation.contactId.name}</h3>
                    <p className="text-sm text-muted-foreground">{selectedConversation.contactId.phoneNumber}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">
                    {selectedConversation.status}
                  </Badge>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={refreshMessages}
                    disabled={messagesLoading}
                    title="Refresh messages"
                  >
                    <RefreshCw className={`w-4 h-4 ${messagesLoading ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={messagesContainerRef}>
              {messagesLoading && (
                <div className="text-center text-muted-foreground">Loading messages...</div>
              )}
              
              {messagesError && (
                <div className="text-center text-red-500">Error loading messages: {messagesError}</div>
              )}
              
              {hasMore && !messagesLoading && (
                <div className="text-center">
                  <Button variant="outline" onClick={handleLoadMoreMessages}>
                    Load Older Messages
                  </Button>
                </div>
              )}
              
              {messages.length === 0 && !messagesLoading && (
                <div className="text-center text-muted-foreground">No messages yet. Start the conversation!</div>
              )}
              
              {displayMessages.map((message) => (
                <div
                  key={message._id}
                  className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-sm px-4 py-2 rounded-lg relative group ${
                      message.direction === 'outbound'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    <div className="text-sm">
                      {message.type === 'text' && message.content.text && (
                        <p className="whitespace-pre-wrap">{message.content.text}</p>
                      )}
                      {message.type === 'button' && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                              🔘 Button Response
                            </span>
                          </div>
                          {message.content.text ? (
                            <p className="whitespace-pre-wrap font-medium">{message.content.text}</p>
                          ) : (
                            <p className="italic">Button clicked</p>
                          )}
                          {message.content.buttonData?.payload?.payload && message.content.buttonData.payload.payload !== message.content.text && (
                            <p className="text-xs text-muted-foreground">
                              Payload: {message.content.buttonData.payload.payload}
                            </p>
                          )}
                        </div>
                      )}
                      {message.type === 'template' && (
                        <div className="space-y-1">
                          {/* Header */}
                          {message.content.header && (
                            <p className="font-semibold text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-md border border-blue-300 shadow-sm">
                              📋 {message.content.header}
                            </p>
                          )}
                          
                          {/* Body */}
                          {message.content.text ? (
                            <p className="whitespace-pre-wrap">{message.content.text}</p>
                          ) : (
                            <p className="italic">Template message</p>
                          )}
                          
                          {/* Footer */}
                          {message.content.footer && (
                            <p className="text-xs text-muted-foreground border-t pt-1 mt-1">
                              📝 {message.content.footer}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    

                    
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center space-x-2">
                        <div className="text-xs opacity-70">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </div>
                        {/* Status Tick - Only for outbound messages */}
                        {message.direction === 'outbound' && (
                          <MessageTickIndicator 
                            status={message.status} 
                            className="w-4 h-4"
                          />
                        )}
                      </div>
                      {/* Delivery Info Button - Only for outbound messages */}
                      {message.direction === 'outbound' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                          onClick={() => handleDeliveryInfoClick(message)}
                          title="View delivery information"
                        >
                          <Info className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Template Selector */}
            {showTemplateSelector && (
              <div className="border-t border-border bg-card p-4">
                <TemplateSelector
                  onSelectTemplate={handleTemplateSelect}
                  onClose={() => setShowTemplateSelector(false)}
                />
              </div>
            )}

            {/* Message Input */}
            <div className="p-4 border-t border-border bg-card">
              {/* 24-Hour Window Warning */}
              {!canSendRegularMessages && (
                <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <div className="text-yellow-600 mt-0.5">⏰</div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-yellow-800 mb-1">
                        24-Hour Window Expired
                      </p>
                      <p className="text-xs text-yellow-700">
                        Regular messaging is not available. The customer hasn't sent a message in the last 24 hours. 
                        You can only send <strong>template messages</strong> now.
                      </p>
                      {hoursRemaining && hoursRemaining > 0 && (
                        <p className="text-xs text-yellow-600 mt-1">
                          Time remaining: {hoursRemaining.toFixed(1)} hours
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {selectedTemplate && (
                <div className="mb-3 p-3 bg-primary/5 rounded-lg border border-primary/20 max-h-48 overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium">Selected Template: {selectedTemplate.name}</p>
                          <Badge variant="outline" className="text-xs">
                            {selectedTemplate.category}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedTemplate(null);
                            setTemplateVariables({});
                          }}
                          className="shrink-0"
                        >
                          ×
                        </Button>
                      </div>
                      
                      {/* Template Preview */}
                      <div className="text-xs text-muted-foreground space-y-1">
                        {selectedTemplate.header && (
                          <p className="font-medium">📋 {selectedTemplate.header.content}</p>
                        )}
                        <div className="max-h-20 overflow-y-auto">
                          <p className="whitespace-pre-wrap">
                            {selectedTemplate.body.text.replace(/\{\{(\w+|\d+)\}\}/g, (match, variable) => {
                              const value = templateVariables[variable];
                              return value ? `${value}` : `{{${variable}}}`;
                            })}
                          </p>
                        </div>
                        {selectedTemplate.footer && (
                          <p className="italic">{selectedTemplate.footer}</p>
                        )}
                      </div>
                      
                      {/* Template Variables Input */}
                      {selectedTemplate.body.variables && selectedTemplate.body.variables.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs font-medium text-foreground">Template Variables:</p>
                          <div className="space-y-2 max-h-32 overflow-y-auto">
                            {selectedTemplate.body.variables.map((variable, index) => (
                              <div key={index} className="space-y-1">
                                <label className="text-xs text-muted-foreground">
                                  Variable {variable}:
                                </label>
                                <Input
                                  placeholder={`Enter value for {{${variable}}}`}
                                  value={templateVariables[variable] || ''}
                                  onChange={(e) => setTemplateVariables(prev => ({
                                    ...prev,
                                    [variable]: e.target.value
                                  }))}
                                  className="h-8 text-xs"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex items-center space-x-2">
                <Button
                  variant={!canSendRegularMessages ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowTemplateSelector(!showTemplateSelector)}
                  className={!canSendRegularMessages ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}
                  title={!canSendRegularMessages ? "Click to select a template message" : "Select template"}
                >
                  <FileText className="w-4 h-4" />
                  {!canSendRegularMessages && <span className="ml-1 text-xs">Template</span>}
                </Button>
                
                <Button variant="outline" size="sm">
                  <Paperclip className="w-4 h-4" />
                </Button>
                
                <Input
                  placeholder={
                    !canSendRegularMessages 
                      ? "Regular messages disabled - Use templates only" 
                      : "Type a message..."
                  }
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={isSending || !canSendRegularMessages}
                  className="flex-1"
                />
                
                <Button 
                  onClick={handleSendMessage}
                  disabled={
                    isSending || 
                    (!messageText.trim() && !selectedTemplate) ||
                    (selectedTemplate && selectedTemplate.body.variables?.some(variable => !templateVariables[variable]?.trim())) ||
                    (!canSendRegularMessages && !selectedTemplate)
                  }
                  size="sm"
                  title={
                    !canSendRegularMessages && !selectedTemplate 
                      ? "Regular messages disabled. Please select a template." 
                      : undefined
                  }
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No conversation selected</h3>
              <p className="text-muted-foreground mb-4">Choose a conversation from the list to start chatting</p>
              {onStartNewConversation && (
                <Button onClick={onStartNewConversation}>
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Start New Conversation
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delivery Info Modal */}
      <DeliveryInfoModal
        message={deliveryInfoMessage}
        isOpen={isDeliveryInfoOpen}
        onClose={handleCloseDeliveryInfo}
      />
    </div>
  );
};
