import BulkMessage, { IBulkMessage } from '../models/BulkMessage';
import Template from '../models/Template';
import Contact from '../models/Contact';
import { GupshupService } from './gupshupService';

export interface CreateBulkMessageData {
  name: string;
  templateId: string;
  contacts: string[];
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
      ...bulkData,
      status: 'pending',
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
      .populate('templateId')
      .populate('contacts');

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
    const contacts = bulkMessage.contacts as any[];
    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      
      try {
        // Send message via Gupshup
        await GupshupService.sendTemplateMessage(
          contact.phoneNumber,
          template.templateId,
          {} // Template variables would go here
        );
        
        sentCount++;
      } catch (error) {
        console.error(`Failed to send message to ${contact.phoneNumber}:`, error);
        failedCount++;
      }

      // Update progress
      const progress = Math.floor(((i + 1) / contacts.length) * 100);
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