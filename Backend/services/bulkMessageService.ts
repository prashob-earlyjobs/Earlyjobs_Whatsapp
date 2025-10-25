import BulkMessage, { IBulkMessage } from '../models/BulkMessage';
import Template from '../models/Template';
import Contact from '../models/Contact';
import { GupshupService } from './gupshupService';
import { ConversationService } from './conversationService';
import { MessageService } from './messageService';

export interface CreateBulkMessageData {
  name: string;
  templateId: string;
  contacts: string[];
  contactsData: Array<{
    contactId: string;
    name: string;
    phoneNumber: string;
    email?: string;
    [key: string]: any; // Allow custom variables
  }>;
  scheduledAt?: Date;
  createdBy: string;
}

export class BulkMessageService {
  static async createBulkMessage(bulkData: CreateBulkMessageData): Promise<IBulkMessage> {
    console.log('🔍 ===== CREATING BULK MESSAGE =====');
    console.log('📋 Bulk data received:', {
      name: bulkData.name,
      templateId: bulkData.templateId,
      contactsCount: bulkData.contacts.length,
      contactsDataCount: bulkData.contactsData.length,
      createdBy: bulkData.createdBy
    });

    // Validate template exists
    const template = await Template.findById(bulkData.templateId);
    if (!template) {
      console.error('❌ Template not found:', bulkData.templateId);
      throw new Error('Template not found');
    }
    console.log('✅ Template found:', template.name);

    // Validate contacts exist
    console.log('🔍 Validating contacts...');
    console.log('📱 Contact IDs to validate:', bulkData.contacts);
    
    const contacts = await Contact.find({ _id: { $in: bulkData.contacts } });
    console.log('📊 Contacts found in database:', contacts.length);
    console.log('📊 Expected contacts count:', bulkData.contacts.length);
    
    if (contacts.length !== bulkData.contacts.length) {
      console.error('❌ Contact validation failed!');
      console.error('📱 Expected contacts:', bulkData.contacts);
      console.error('📱 Found contacts:', contacts.map(c => ({ id: c._id, name: c.name, phone: c.phoneNumber })));
      
      // Find which contacts are missing
      const foundIds = contacts.map(c => (c._id as any).toString());
      const missingIds = bulkData.contacts.filter(id => !foundIds.includes(id.toString()));
      console.error('🚫 Missing contact IDs:', missingIds);
      
      throw new Error(`Some contacts not found. Expected: ${bulkData.contacts.length}, Found: ${contacts.length}, Missing: ${missingIds.length}`);
    }

    console.log('✅ All contacts validated successfully');

    const bulkMessage = new BulkMessage({
      name: bulkData.name,
      templateId: bulkData.templateId,
      contacts: bulkData.contacts,
      contactsData: bulkData.contactsData,
      status: 'pending',
      scheduledAt: bulkData.scheduledAt,
      createdBy: bulkData.createdBy,
    });

    const savedBulkMessage = await bulkMessage.save();
    console.log('✅ Bulk message created successfully:', savedBulkMessage._id);
    console.log('🏁 ===== BULK MESSAGE CREATION COMPLETED =====');
    
    return savedBulkMessage;
  }

  static async getBulkMessageById(bulkMessageId: string): Promise<IBulkMessage | null> {
    return await BulkMessage.findById(bulkMessageId)
      .populate('templateId')
      .populate('contacts', 'name phoneNumber')
      .populate('createdBy', 'name email');
  }

  static async getAllBulkMessages(filters: any = {}): Promise<IBulkMessage[]> {
    const query: any = {};

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.createdBy) {
      query.createdBy = filters.createdBy;
    }

    return await BulkMessage.find(query)
      .populate('templateId', 'name')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
  }

  static async processBulkMessage(
    bulkMessageId: string, 
    progressCallback?: (progress: number) => void
  ): Promise<void> {
    const bulkMessage = await BulkMessage.findById(bulkMessageId)
      .populate('templateId');

    if (!bulkMessage) {
      throw new Error('Bulk message not found');
    }

    if (bulkMessage.status !== 'pending') {
      throw new Error('Bulk message is not in pending status');
    }

    // Update status to processing
    bulkMessage.status = 'processing';
    await bulkMessage.save();

    const template = bulkMessage.templateId as any;
    const contactsData = bulkMessage.contactsData as any[];
    let sentCount = 0;
    let failedCount = 0;

    console.log(`🚀 Starting to process ${contactsData.length} messages`);

    for (let i = 0; i < contactsData.length; i++) {
      const contactData = contactsData[i];
      
      try {
        // Render template text with variables using the original contact data
        let renderedText = template.body.text;
        
        if (template.body.variables) {
          template.body.variables.forEach((variable: string) => {
            // Try to get the value from contactData (including custom variables)
            let value = contactData[variable];
            
            // Fallback to common fields
            if (value === undefined || value === null) {
              const fallbackMappings: Record<string, string> = {
                name: contactData.name,
                phoneNumber: contactData.phoneNumber,
                phone: contactData.phoneNumber,
                email: contactData.email || ''
              };
              value = fallbackMappings[variable];
            }
            
            // If still no value, use the variable placeholder
            if (value === undefined || value === null) {
              value = `{{${variable}}}`;
            }
            
            renderedText = renderedText.replace(new RegExp(`\\{\\{${variable}\\}\\}`, 'g'), String(value));
          });
        }
        
        // Extract header and footer from template
        const header = template.header?.content;
        const footer = template.footer;
        
        // Get the normalized phone number from the contact record
        const contact = await (await import('../models/Contact')).default.findById(contactData.contactId);
        const normalizedPhoneNumber = contact ? contact.phoneNumber : contactData.phoneNumber;
        
        // Send message via Gupshup using normalized phone number
        const gupshupResponse = await GupshupService.sendTemplateMessage(
          normalizedPhoneNumber,
          renderedText,
          header,
          footer
        );
        
        // Create or find conversation for this contact
        const { conversation } = await ConversationService.findOrCreateConversation({
          contactId: (contactData.contactId as any).toString(),
          assignedTo: (bulkMessage.createdBy as any).toString()
        });
        
        // Create individual message record in database
        const messageContent = {
          text: renderedText,
          header: header || undefined,
          footer: footer || undefined
        };
        
        await MessageService.createMessage({
          conversationId: (conversation._id as any).toString(),
          contactId: (contactData.contactId as any).toString(),
          senderId: (bulkMessage.createdBy as any).toString(),
          messageId: gupshupResponse.messageId,
          type: 'template',
          content: messageContent,
          direction: 'outbound',
          timestamp: new Date()
        });
        
        // Add user as participant in the conversation for bulk messages
        const User = (await import('../models/User')).default;
        const fullUser = await User.findById(bulkMessage.createdBy).select('name role department');
        
        if (fullUser) {
          await ConversationService.addParticipant(
            (conversation._id as any).toString(),
            (bulkMessage.createdBy as any).toString(),
            fullUser.name,
            fullUser.role,
            fullUser.department
          );
        }
        
        sentCount++;
        
        // Update database with current progress for real-time updates
        bulkMessage.sentCount = sentCount;
        bulkMessage.failedCount = failedCount;
        await bulkMessage.save();
        console.log(`💾 Database updated (success) - sentCount: ${sentCount}, failedCount: ${failedCount}`);
        
      } catch (error) {
        console.error(`Failed to send message to ${contactData.phoneNumber}:`, error);
        failedCount++;
        
        // Update database with current progress for real-time updates
        bulkMessage.sentCount = sentCount;
        bulkMessage.failedCount = failedCount;
        await bulkMessage.save();
        console.log(`💾 Database updated (failure) - sentCount: ${sentCount}, failedCount: ${failedCount}`);
        
        // Log failed message progress
        const progress = Math.floor(((i + 1) / contactsData.length) * 100);
        console.log(`❌ Message ${i + 1}/${contactsData.length} failed:`, {
          contact: contactData.name,
          phone: contactData.phoneNumber,
          error: (error as any).message,
          progress: `${progress}%`
        });
      }

      // Update progress
      const progress = Math.floor(((i + 1) / contactsData.length) * 100);
      if (progressCallback) {
        console.log(`📊 Calling progress callback: ${progress}%`);
        progressCallback(progress);
      }
      
      // Log progress for debugging
      console.log(`📤 Message ${i + 1}/${contactsData.length} processed:`, {
        contact: contactData.name,
        phone: contactData.phoneNumber,
        status: sentCount > failedCount ? 'success' : 'failed',
        progress: `${progress}%`,
        sentCount,
        failedCount,
        totalCount: contactsData.length
      });

      // Add delay to ensure frontend can catch progress updates
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Update final status
    bulkMessage.status = failedCount === 0 ? 'completed' : 'failed';
    await bulkMessage.save();
  }

  static async cancelBulkMessage(bulkMessageId: string): Promise<IBulkMessage | null> {
    const bulkMessage = await BulkMessage.findById(bulkMessageId);
    
    if (!bulkMessage) {
      throw new Error('Bulk message not found');
    }

    if (bulkMessage.status === 'processing') {
      throw new Error('Cannot cancel bulk message that is currently processing');
    }

    bulkMessage.status = 'failed';
    return await bulkMessage.save();
  }

  static async getBulkMessageStatus(bulkMessageId: string): Promise<{
    status: string;
    sentCount: number;
    failedCount: number;
    totalCount: number;
    progress: number;
  }> {
    const bulkMessage = await BulkMessage.findById(bulkMessageId).populate('contacts');
    
    if (!bulkMessage) {
      throw new Error('Bulk message not found');
    }

    // Use contactsData length for accurate progress calculation
    const totalCount = (bulkMessage.contactsData as any[]).length;
    const completedCount = bulkMessage.sentCount + bulkMessage.failedCount;
    const progress = totalCount > 0 ? Math.floor((completedCount / totalCount) * 100) : 0;

    console.log('📊 Progress calculation:', {
      bulkMessageId,
      status: bulkMessage.status,
      totalCount,
      completedCount,
      sentCount: bulkMessage.sentCount,
      failedCount: bulkMessage.failedCount,
      progress: `${progress}%`,
      rawBulkMessage: {
        sentCount: bulkMessage.sentCount,
        failedCount: bulkMessage.failedCount,
        status: bulkMessage.status
      }
    });

    return {
      status: bulkMessage.status,
      sentCount: bulkMessage.sentCount,
      failedCount: bulkMessage.failedCount,
      totalCount,
      progress,
    };
  }
} 