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
    // Validate template exists
    const template = await Template.findById(bulkData.templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    // Validate contacts exist
    const contacts = await Contact.find({ _id: { $in: bulkData.contacts } });
    if (contacts.length !== bulkData.contacts.length) {
      throw new Error('Some contacts not found');
    }

    const bulkMessage = new BulkMessage({
      name: bulkData.name,
      templateId: bulkData.templateId,
      contacts: bulkData.contacts,
      contactsData: bulkData.contactsData,
      status: 'pending',
      scheduledAt: bulkData.scheduledAt,
      createdBy: bulkData.createdBy,
    });

    return await bulkMessage.save();
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
        
        // Send message via Gupshup
        const gupshupResponse = await GupshupService.sendTemplateMessage(
          contactData.phoneNumber,
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
        
        sentCount++;
      } catch (error) {
        console.error(`Failed to send message to ${contactData.phoneNumber}:`, error);
        failedCount++;
      }

      // Update progress
      const progress = Math.floor(((i + 1) / contactsData.length) * 100);
      if (progressCallback) {
        progressCallback(progress);
      }

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Update final status
    bulkMessage.sentCount = sentCount;
    bulkMessage.failedCount = failedCount;
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

    const totalCount = (bulkMessage.contacts as any[]).length;
    const completedCount = bulkMessage.sentCount + bulkMessage.failedCount;
    const progress = totalCount > 0 ? Math.floor((completedCount / totalCount) * 100) : 0;

    return {
      status: bulkMessage.status,
      sentCount: bulkMessage.sentCount,
      failedCount: bulkMessage.failedCount,
      totalCount,
      progress,
    };
  }
} 