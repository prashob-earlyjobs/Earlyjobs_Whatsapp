import BulkMessage, { IBulkMessage } from '../models/BulkMessage';
import Template from '../models/Template';
import Contact from '../models/Contact';
import Message from '../models/Message';
import { GupshupService } from './gupshupService';
import { ConversationService } from './conversationService';
import { MessageService } from './messageService';
import { DeliveryReportService } from './deliveryReportService';

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

export interface BulkMessageReportEntry {
  contactId: string | null;
  name: string;
  phoneNumber: string;
  email?: string;
  messageId: string | null;
  messageStatus: string;
  deliveryStatus: string | null;
  deliveryEventType: string | null;
  deliveryCause: string | null;
  deliveryErrorCode: string | null;
  destinationAddress: string | null;
  lastUpdatedAt: string | null;
}

export interface BulkMessageReportSummary {
  totalContacts: number;
  pending: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  successRate: number;
}

export interface BulkMessageReport {
  bulkMessage: {
    id: string;
    name: string;
    status: string;
    templateName?: string;
    createdAt: string;
    createdBy: {
      id: string;
      name: string;
      email?: string;
    } | null;
  };
  summary: BulkMessageReportSummary;
  entries: BulkMessageReportEntry[];
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

    const uniqueContactIds = [...new Set(bulkData.contacts.map(id => id.toString()))];
    const contacts = await Contact.find({
      _id: { $in: uniqueContactIds },
      isBlocked: { $ne: true },
    });

    const usableIdSet = new Set(contacts.map(c => (c._id as any).toString()));
    const contactsDataById = new Map<string, (typeof bulkData.contactsData)[number]>();

    bulkData.contactsData.forEach(entry => {
      const id = entry.contactId?.toString();
      if (id && !contactsDataById.has(id)) {
        contactsDataById.set(id, entry);
      }
    });

    const validContactIds: string[] = [];
    const validContactsData: typeof bulkData.contactsData = [];

    for (const contactId of uniqueContactIds) {
      if (usableIdSet.has(contactId) && contactsDataById.has(contactId)) {
        validContactIds.push(contactId);
        validContactsData.push(contactsDataById.get(contactId)!);
      }
    }

    const excludedCount = uniqueContactIds.length - validContactIds.length;
    if (excludedCount > 0) {
      console.warn(`⚠️ Excluded ${excludedCount} contact(s) (missing or blocked)`);
    }

    if (validContactIds.length === 0) {
      throw new Error('No usable contacts found for campaign');
    }

    console.log(`✅ Campaign will include ${validContactIds.length} contact(s)`);

    const bulkMessage = new BulkMessage({
      name: bulkData.name,
      templateId: bulkData.templateId,
      contacts: validContactIds,
      contactsData: validContactsData,
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
        
        // Extract header and footer from template (header can be text or image URL)
        const header = template.header?.type === 'text' ? template.header.content : undefined;
        const footer = template.footer;
        const isImageTemplate = template.header?.type === 'image' && !!template.header?.content;

        // Get the normalized phone number from the contact record
        const contact = await (await import('../models/Contact')).default.findById(contactData.contactId);
        const normalizedPhoneNumber = contact ? contact.phoneNumber : contactData.phoneNumber;

        // Send via image template API or text template API
        const gupshupResponse = isImageTemplate
          ? await GupshupService.sendImageTemplateMessage(
              normalizedPhoneNumber,
              renderedText,
              template.header!.content,
              footer,
              { isTemplate: true, templateId: template.templateId, category: template.category, language: template.language }
            )
          : await GupshupService.sendTemplateMessage(
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
        const messageContent: Record<string, any> = {
          text: renderedText,
          header: header || undefined,
          footer: footer || undefined
        };
        if (isImageTemplate) {
          messageContent.mediaUrl = template.header!.content;
        }

        await MessageService.createMessage({
          conversationId: (conversation._id as any).toString(),
          contactId: (contactData.contactId as any).toString(),
          senderId: (bulkMessage.createdBy as any).toString(),
          bulkMessageId: (bulkMessage._id as any).toString(),
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
        // console.log(`💾 Database updated (success) - sentCount: ${sentCount}, failedCount: ${failedCount}`);
        
      } catch (error) {
        console.error(`Failed to send message to ${contactData.phoneNumber}:`, error);
        failedCount++;
        
        // Update database with current progress for real-time updates
        bulkMessage.sentCount = sentCount;
        bulkMessage.failedCount = failedCount;
        await bulkMessage.save();
        // console.log(`💾 Database updated (failure) - sentCount: ${sentCount}, failedCount: ${failedCount}`);
        
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

  static async getBulkMessageReport(bulkMessageId: string): Promise<BulkMessageReport> {
    const bulkMessage = await BulkMessage.findById(bulkMessageId)
      .populate('templateId', 'name')
      .populate('createdBy', 'name email')
      .populate('contacts', 'name phoneNumber email');

    if (!bulkMessage) {
      throw new Error('Bulk message not found');
    }

    const bulkMessageObjectId = bulkMessage._id as any;
    const bulkMessageIdString =
      bulkMessageObjectId?.toString?.() ?? String(bulkMessageObjectId);

    const contactsData = (bulkMessage.contactsData as any[]) || [];
    const contactDocs = (bulkMessage.contacts as any[]) || [];

    const contactDocMap = new Map<string, any>();
    contactDocs.forEach(contact => {
      const id = contact._id?.toString();
      if (id) {
        contactDocMap.set(id, contact);
      }
    });

    const messages = await Message.find({ bulkMessageId: bulkMessageObjectId })
      .populate('contactId', 'name phoneNumber email')
      .select('contactId messageId status timestamp bulkMessageId');

    const messageByContactId = new Map<string, typeof messages[number]>();
    const messageIds: string[] = [];

    messages.forEach(message => {
      const rawContactId = (message.contactId as any)?._id ?? message.contactId;
      const contactId = rawContactId ? rawContactId.toString() : null;
      if (contactId) {
        if (!messageByContactId.has(contactId)) {
          messageByContactId.set(contactId, message);
        }
      }
      if (message.messageId) {
        messageIds.push(message.messageId);
      }
    });

    const latestReportsMap = await DeliveryReportService.getLatestDeliveryReportsForMessages(messageIds);

    const summary: BulkMessageReportSummary = {
      totalContacts: contactsData.length,
      pending: 0,
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      successRate: 0,
    };

    const normalizeStatus = (status: string | null | undefined): string | null => {
      if (!status) return null;
      return status.toLowerCase();
    };

    const incrementSummary = (status: string | null) => {
      const normalized = normalizeStatus(status);
      switch (normalized) {
        case 'sent':
          summary.sent += 1;
          break;
        case 'delivered':
          summary.delivered += 1;
          break;
        case 'read':
          summary.read += 1;
          break;
        case 'failed':
          summary.failed += 1;
          break;
        default:
          summary.pending += 1;
          break;
      }
    };

    const entries: BulkMessageReportEntry[] = contactsData.map(contactData => {
      const contactId = contactData.contactId ? contactData.contactId.toString() : null;
      const contactDoc = contactId ? contactDocMap.get(contactId) : null;
      const message = contactId ? messageByContactId.get(contactId) : undefined;

      const latestReport = message?.messageId
        ? latestReportsMap[message.messageId] ?? null
        : null;

      const deliveryStatus = latestReport?.internalStatus ?? null;
      const messageStatus = message?.status ?? (deliveryStatus ? deliveryStatus : 'pending');

      incrementSummary(deliveryStatus || messageStatus);

      return {
        contactId,
        name: contactDoc?.name ?? contactData.name,
        phoneNumber: contactDoc?.phoneNumber ?? contactData.phoneNumber,
        email: contactDoc?.email ?? contactData.email,
        messageId: message?.messageId ?? null,
        messageStatus,
        deliveryStatus,
        deliveryEventType: latestReport?.eventType ?? null,
        deliveryCause: latestReport?.cause ?? null,
        deliveryErrorCode: latestReport?.errorCode ?? null,
        destinationAddress: latestReport?.destAddr ?? null,
        lastUpdatedAt: latestReport?.eventTs
          ? latestReport.eventTs.toISOString()
          : message?.timestamp
            ? message.timestamp.toISOString()
            : null,
      };
    });

    if (summary.totalContacts > 0) {
      summary.successRate = ((summary.delivered + summary.read) / summary.totalContacts) * 100;
    }

    const createdBy = bulkMessage.createdBy as any;
    const template = bulkMessage.templateId as any;

    return {
      bulkMessage: {
        id: bulkMessageIdString,
        name: bulkMessage.name,
        status: bulkMessage.status,
        templateName: template?.name,
        createdAt: bulkMessage.createdAt ? bulkMessage.createdAt.toISOString() : new Date().toISOString(),
        createdBy: createdBy
          ? {
              id: createdBy._id?.toString() ?? '',
              name: createdBy.name,
              email: createdBy.email,
            }
          : null,
      },
      summary,
      entries,
    };
  }
} 