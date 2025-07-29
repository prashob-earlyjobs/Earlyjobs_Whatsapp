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
  /**
   * Find or create conversation for a contact
   * This method handles the complete logic for preventing duplicate conversations:
   * 1. Look for existing open/pending conversation first
   * 2. If not found, look for closed conversations to reopen
   * 3. Only create new conversation if none exists
   */
  static async findOrCreateConversation(conversationData: CreateConversationData): Promise<{ conversation: IConversation; isNew: boolean; wasReopened: boolean }> {
    // Check if contact exists
    const contact = await Contact.findById(conversationData.contactId);
    if (!contact) {
      throw new Error('Contact not found');
    }

    console.log(`🔍 Looking for existing conversation for contact: ${conversationData.contactId}`);

    // First, check if there's an active conversation (open or pending)
    let existingConversation = await Conversation.findOne({ 
      contactId: conversationData.contactId,
      status: { $in: ['open', 'pending'] }
    }).populate('contactId', 'name phoneNumber email')
      .populate('assignedTo', 'name email');

    if (existingConversation) {
      console.log(`✅ Found existing active conversation: ${existingConversation._id}`);
      return { 
        conversation: existingConversation, 
        isNew: false, 
        wasReopened: false 
      };
    }

    // If no active conversation, look for the most recent closed conversation
    const closedConversation = await Conversation.findOne({ 
      contactId: conversationData.contactId,
      status: 'closed'
    })
    .sort({ updatedAt: -1 }) // Get the most recent closed conversation
    .populate('contactId', 'name phoneNumber email')
    .populate('assignedTo', 'name email');

    if (closedConversation) {
      // Reopen the closed conversation
      console.log(`🔄 Reopening closed conversation: ${closedConversation._id}`);
      const reopenedConversation = await Conversation.findByIdAndUpdate(
        closedConversation._id,
        { 
          status: 'open',
          unreadCount: 0, // Reset unread count when reopening
          lastMessageAt: new Date()
        },
        { new: true }
      ).populate('contactId', 'name phoneNumber email')
       .populate('assignedTo', 'name email');

      return { 
        conversation: reopenedConversation!, 
        isNew: false, 
        wasReopened: true 
      };
    }

    // No existing conversation found, create a new one
    console.log(`➕ Creating new conversation for contact: ${conversationData.contactId}`);
    const conversation = new Conversation(conversationData);
    const savedConversation = await conversation.save();
    
    // Populate the saved conversation
    const populatedConversation = await Conversation.findById(savedConversation._id)
      .populate('contactId', 'name phoneNumber email')
      .populate('assignedTo', 'name email');

    return { 
      conversation: populatedConversation!, 
      isNew: true, 
      wasReopened: false 
    };
  }

  /**
   * Legacy method for backward compatibility
   * Now uses the enhanced findOrCreateConversation method
   */
  static async createConversation(conversationData: CreateConversationData): Promise<IConversation> {
    const result = await this.findOrCreateConversation(conversationData);
    return result.conversation;
  }

  static async getConversationById(conversationId: string): Promise<IConversation | null> {
    return await Conversation.findById(conversationId)
      .populate('contactId', 'name phoneNumber email')
      .populate('assignedTo', 'name email');
  }

  static async getConversationByContactId(contactId: string): Promise<IConversation | null> {
    return await Conversation.findOne({ 
      contactId,
      status: { $in: ['open', 'pending'] }
    })
      .populate('contactId', 'name phoneNumber email')
      .populate('assignedTo', 'name email');
  }

  /**
   * Find conversation by phone number (for convenience)
   */
  static async getConversationByPhoneNumber(phoneNumber: string): Promise<IConversation | null> {
    // First find the contact by phone number
    const contact = await Contact.findOne({ phoneNumber });
    if (!contact) {
      return null;
    }

    // Then find their active conversation
    return await this.getConversationByContactId(contact._id as string);
  }

  /**
   * Get all conversations for a contact (including closed ones)
   */
  static async getAllConversationsForContact(contactId: string): Promise<IConversation[]> {
    return await Conversation.find({ contactId })
      .populate('contactId', 'name phoneNumber email')
      .populate('assignedTo', 'name email')
      .sort({ updatedAt: -1 });
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