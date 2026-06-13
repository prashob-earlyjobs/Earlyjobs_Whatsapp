import { Request, Response } from 'express';
import { BulkMessageService, CreateBulkMessageData } from '../services/bulkMessageService';
import { processBulkContacts } from '../services/bulkContactProcessingService';
import { AuthRequest } from '../middleware/auth';

export class BulkMessageController {
  // POST /api/bulk-messages - Create and process bulk message
  static async createBulkMessage(req: AuthRequest, res: Response) {
    try {
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Request body is required and must be valid JSON'
        });
      }

      const { name, templateId, contactsData, contacts, scheduledAt } = req.body;
      const userId = req.user?.id;

      if (!name || !templateId || !contactsData || !Array.isArray(contactsData)) {
        return res.status(400).json({
          success: false,
          message: 'Name, templateId, and contactsData (array) are required'
        });
      }

      if (contactsData.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one contact is required'
        });
      }

      const hasPreValidatedPayload =
        Array.isArray(contacts) &&
        contacts.length > 0 &&
        contactsData.every((entry: { contactId?: string }) => !!entry.contactId);

      let contactIds: string[];
      let successfulContactsData: CreateBulkMessageData['contactsData'];
      let contactResults: any[];
      let totalSubmitted: number;

      if (hasPreValidatedPayload) {
        // Reuse contacts prepared during validate-contacts — one batch DB check only
        contactIds = contacts.map((id: string) => id.toString());
        successfulContactsData = contactsData;
        contactResults = contactsData.map((entry: { contactId: string; name: string; phoneNumber: string }) => ({
          id: entry.contactId,
          name: entry.name,
          phoneNumber: entry.phoneNumber,
          status: 'ready',
        }));
        totalSubmitted = contactIds.length;
        console.log('📊 Using pre-validated contacts (skipping duplicate processing):', contactIds.length);
      } else {
        // Fallback for direct API use without prior validation
        const processed = await processBulkContacts(contactsData, userId);
        contactIds = processed.contactIds;
        successfulContactsData = processed.contactsData;
        contactResults = processed.contactResults;
        totalSubmitted = processed.summary.total;
      }

      if (contactIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No usable contacts found for campaign',
          contactResults
        });
      }

      const excludedCount = hasPreValidatedPayload ? 0 : totalSubmitted - contactIds.length;

      const bulkMessageData: CreateBulkMessageData = {
        name,
        templateId,
        contacts: contactIds,
        contactsData: successfulContactsData,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        createdBy: userId!
      };

      const bulkMessage = await BulkMessageService.createBulkMessage(bulkMessageData);

      if (!scheduledAt) {
        BulkMessageService.processBulkMessage(bulkMessage._id as string, (progress) => {
          console.log(`📊 Bulk message progress: ${progress}%`);
        }).catch(error => console.error('Bulk message processing error:', error));
      }

      res.status(201).json({
        success: true,
        message: excludedCount > 0
          ? `Bulk message created with ${contactIds.length} contacts (${excludedCount} excluded)`
          : 'Bulk message created successfully',
        data: {
          bulkMessage,
          contactResults,
          validContacts: contactIds.length,
          excludedContacts: excludedCount,
          totalContacts: totalSubmitted
        }
      });

    } catch (error: any) {
      console.error('Create bulk message error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while creating bulk message'
      });
    }
  }

  // GET /api/bulk-messages - Get all bulk messages
  static async getAllBulkMessages(req: AuthRequest, res: Response) {
    try {
      const { status, createdBy } = req.query;
      const userId = req.user?.id;

      const filters: any = {};
      
      if (status && ['pending', 'processing', 'completed', 'failed'].includes(status as string)) {
        filters.status = status;
      }
      
      if (req.user?.role !== 'admin') {
        filters.createdBy = userId;
      } else if (createdBy) {
        filters.createdBy = createdBy;
      }

      const bulkMessages = await BulkMessageService.getAllBulkMessages(filters);

      res.json({
        success: true,
        message: 'Bulk messages retrieved successfully',
        data: {
          bulkMessages,
          count: bulkMessages.length
        }
      });

    } catch (error: any) {
      console.error('Get bulk messages error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while retrieving bulk messages'
      });
    }
  }

  // GET /api/bulk-messages/:id - Get bulk message by ID
  static async getBulkMessageById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Bulk message ID is required'
        });
      }

      const bulkMessage = await BulkMessageService.getBulkMessageById(id);

      if (!bulkMessage) {
        return res.status(404).json({
          success: false,
          message: 'Bulk message not found'
        });
      }

      if (req.user?.role !== 'admin' && bulkMessage.createdBy._id.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      res.json({
        success: true,
        message: 'Bulk message retrieved successfully',
        data: {
          bulkMessage
        }
      });

    } catch (error: any) {
      console.error('Get bulk message error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while retrieving bulk message'
      });
    }
  }

  // GET /api/bulk-messages/:id/status - Get bulk message status
  static async getBulkMessageStatus(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Bulk message ID is required'
        });
      }

      const bulkMessage = await BulkMessageService.getBulkMessageById(id);

      if (!bulkMessage) {
        return res.status(404).json({
          success: false,
          message: 'Bulk message not found'
        });
      }

      if (req.user?.role !== 'admin' && bulkMessage.createdBy._id.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const status = await BulkMessageService.getBulkMessageStatus(id);

      res.json({
        success: true,
        message: 'Bulk message status retrieved successfully',
        data: status
      });

    } catch (error: any) {
      console.error('Get bulk message status error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while retrieving bulk message status'
      });
    }
  }

  // GET /api/bulk-messages/:id/report - Get bulk message delivery report
  static async getBulkMessageReport(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Bulk message ID is required'
        });
      }

      const bulkMessage = await BulkMessageService.getBulkMessageById(id);

      if (!bulkMessage) {
        return res.status(404).json({
          success: false,
          message: 'Bulk message not found'
        });
      }

      if (req.user?.role !== 'admin' && bulkMessage.createdBy._id.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const report = await BulkMessageService.getBulkMessageReport(id);

      res.json({
        success: true,
        message: 'Bulk message report retrieved successfully',
        data: {
          report
        }
      });
    } catch (error: any) {
      console.error('Get bulk message report error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while retrieving bulk message report'
      });
    }
  }

  // PUT /api/bulk-messages/:id/cancel - Cancel bulk message
  static async cancelBulkMessage(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Bulk message ID is required'
        });
      }

      const bulkMessage = await BulkMessageService.getBulkMessageById(id);

      if (!bulkMessage) {
        return res.status(404).json({
          success: false,
          message: 'Bulk message not found'
        });
      }

      if (req.user?.role !== 'admin' && bulkMessage.createdBy._id.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const cancelledBulkMessage = await BulkMessageService.cancelBulkMessage(id);

      res.json({
        success: true,
        message: 'Bulk message cancelled successfully',
        data: {
          bulkMessage: cancelledBulkMessage
        }
      });

    } catch (error: any) {
      console.error('Cancel bulk message error:', error);
      
      if (error.message === 'Cannot cancel bulk message that is currently processing') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error while cancelling bulk message'
      });
    }
  }

  // POST /api/bulk-messages/validate-contacts - Process contacts once for preview + send
  static async validateContacts(req: AuthRequest, res: Response) {
    try {
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Request body is required and must be valid JSON'
        });
      }

      const { contactsData } = req.body;
      const userId = req.user?.id;

      if (!contactsData || !Array.isArray(contactsData)) {
        return res.status(400).json({
          success: false,
          message: 'ContactsData array is required'
        });
      }

      const processed = await processBulkContacts(contactsData, userId);

      res.json({
        success: true,
        message: 'Contact validation completed',
        data: {
          validationResults: processed.validationResults,
          contactIds: processed.contactIds,
          contactsData: processed.contactsData,
          contactResults: processed.contactResults,
          summary: processed.summary,
        }
      });

    } catch (error: any) {
      console.error('Validate contacts error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while validating contacts'
      });
    }
  }
}
