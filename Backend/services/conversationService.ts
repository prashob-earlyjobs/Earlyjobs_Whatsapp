import Conversation, { IConversation } from '../models/Conversation';
import Contact from '../models/Contact';

export interface CreateConversationData {
  contactId: string;
  assignedTo?: string;
}

export interface ConversationFilters {
  status?: 'open' | 'closed' | 'pending';
  assignedTo?: string;
  tags?: string[];
}

export class ConversationService {
  static async createConversation(conversationData: CreateConversationData): Promise<IConversation> {
    // Check if contact exists
    const contact = await Contact.findById(conversationData.contactId);
    if (!contact) {
      throw new Error('Contact not found');
    }

    // Check if conversation already exists for this contact
    const existingConversation = await Conversation.findOne({ 
      contactId: conversationData.contactId,
      status: { $in: ['open', 'pending'] }
    });

    if (existingConversation) {
      return existingConversation;
    }

    const conversation = new Conversation(conversationData);
    return await conversation.save();
  }

  static async getConversationById(conversationId: string): Promise<IConversation | null> {
    return await Conversation.findById(conversationId)
      .populate('contactId', 'name phoneNumber email')
      .populate('assignedTo', 'name email');
  }

  static async getAllConversations(filters: ConversationFilters = {}): Promise<IConversation[]> {
    const query: any = {};

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.assignedTo) {
      query.assignedTo = filters.assignedTo;
    }

    if (filters.tags && filters.tags.length > 0) {
      query.tags = { $in: filters.tags };
    }

    return await Conversation.find(query)
      .populate('contactId', 'name phoneNumber email')
      .populate('assignedTo', 'name email')
      .sort({ lastMessageAt: -1 });
  }

  static async updateConversationStatus(
    conversationId: string, 
    status: 'open' | 'closed' | 'pending'
  ): Promise<IConversation | null> {
    return await Conversation.findByIdAndUpdate(
      conversationId,
      { status },
      { new: true }
    ).populate('contactId', 'name phoneNumber email')
     .populate('assignedTo', 'name email');
  }

  static async assignConversation(
    conversationId: string, 
    userId: string
  ): Promise<IConversation | null> {
    return await Conversation.findByIdAndUpdate(
      conversationId,
      { assignedTo: userId },
      { new: true }
    ).populate('contactId', 'name phoneNumber email')
     .populate('assignedTo', 'name email');
  }

  static async markAsRead(conversationId: string): Promise<IConversation | null> {
    return await Conversation.findByIdAndUpdate(
      conversationId,
      { unreadCount: 0 },
      { new: true }
    );
  }

  static async updateLastMessage(conversationId: string): Promise<IConversation | null> {
    return await Conversation.findByIdAndUpdate(
      conversationId,
      { lastMessageAt: new Date() },
      { new: true }
    );
  }

  static async incrementUnreadCount(conversationId: string): Promise<IConversation | null> {
    return await Conversation.findByIdAndUpdate(
      conversationId,
      { $inc: { unreadCount: 1 } },
      { new: true }
    );
  }
} 