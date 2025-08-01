import Message, { IMessage, IMessageContent } from '../models/Message';
import Conversation from '../models/Conversation';
import { ConversationService } from './conversationService';

export interface CreateMessageData {
  conversationId: string;
  contactId: string;
  senderId?: string;
  messageId: string;
  type: 'text' | 'image' | 'document' | 'template';
  content: IMessageContent;
  direction: 'inbound' | 'outbound';
  timestamp: Date;
}

export interface MessageFilters {
  conversationId?: string;
  contactId?: string;
  direction?: 'inbound' | 'outbound';
  status?: 'sent' | 'delivered' | 'read' | 'failed';
  type?: 'text' | 'image' | 'document' | 'template';
}

export class MessageService {
  static async createMessage(messageData: CreateMessageData): Promise<IMessage> {
    const message = new Message(messageData);
    const savedMessage = await message.save();

    // Update conversation last message time
    await ConversationService.updateLastMessage(messageData.conversationId);

    // If it's an inbound message, increment unread count and update lastInboundMessageAt
    if (messageData.direction === 'inbound') {
      console.log('📥 Processing inbound message for conversation:', messageData.conversationId);
      console.log('📅 Updating lastInboundMessageAt to:', messageData.timestamp);
      
      await ConversationService.incrementUnreadCount(messageData.conversationId);
      const updateResult = await ConversationService.updateLastInboundMessage(messageData.conversationId, messageData.timestamp);
      
      console.log('✅ lastInboundMessageAt update result:', updateResult ? 'Success' : 'Failed');
    }

    return savedMessage;
  }

  static async getMessageById(messageId: string): Promise<IMessage | null> {
    return await Message.findById(messageId)
      .populate('conversationId')
      .populate('contactId', 'name phoneNumber')
      .populate('senderId', 'name email');
  }

  static async getMessagesByConversation(
    conversationId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<IMessage[]> {
    return await Message.find({ conversationId })
      .populate('senderId', 'name email')
      .sort({ timestamp: -1 })
      .limit(limit)
      .skip(offset);
  }

  static async getAllMessages(filters: MessageFilters = {}): Promise<IMessage[]> {
    const query: any = {};

    if (filters.conversationId) {
      query.conversationId = filters.conversationId;
    }

    if (filters.contactId) {
      query.contactId = filters.contactId;
    }

    if (filters.direction) {
      query.direction = filters.direction;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.type) {
      query.type = filters.type;
    }

    return await Message.find(query)
      .populate('conversationId')
      .populate('contactId', 'name phoneNumber')
      .populate('senderId', 'name email')
      .sort({ timestamp: -1 });
  }

  static async updateMessageStatus(
    messageId: string,
    status: 'sent' | 'delivered' | 'read' | 'failed'
  ): Promise<IMessage | null> {
    return await Message.findByIdAndUpdate(
      messageId,
      { status },
      { new: true }
    );
  }

  static async markMessagesAsRead(conversationId: string): Promise<void> {
    await Message.updateMany(
      { conversationId, direction: 'inbound', isRead: false },
      { isRead: true }
    );

    // Reset unread count in conversation
    await ConversationService.markAsRead(conversationId);
  }

  static async deleteMessage(messageId: string): Promise<boolean> {
    const result = await Message.findByIdAndDelete(messageId);
    return !!result;
  }
} 