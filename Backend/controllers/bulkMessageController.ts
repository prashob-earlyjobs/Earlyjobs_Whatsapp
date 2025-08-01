import { Request, Response } from 'express';
import { BulkMessageService, CreateBulkMessageData } from '../services/bulkMessageService';
import { ContactService } from '../services/contactService';
import { AuthRequest } from '../middleware/auth';
import { normalizePhoneNumber } from '../utils/phoneNumber';

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

      const { name, templateId, contactsData, scheduledAt } = req.body;
      const userId = req.user?.id;

      // Validation
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

      // Process contacts data - create contacts if they don't exist
      const contactIds: string[] = [];
      const contactResults = [];

      for (const contactData of contactsData) {
        if (!contactData.phoneNumber || !contactData.name) {
          return res.status(400).json({
            success: false,
            message: 'Each contact must have phoneNumber and name'
          });
        }

        const normalizedPhone = normalizePhoneNumber(contactData.phoneNumber);
        
        try {
          // Try to find existing contact
          let contact = await ContactService.getContactByPhone(normalizedPhone);
          
          if (!contact) {
            // Create new contact
            contact = await ContactService.createContact({
              phoneNumber: normalizedPhone,
              name: contactData.name,
              email: contactData.email,
              tags: contactData.tags || ['bulk-message'],
              assignedTo: userId
            });
          }
          
          contactIds.push(contact._id as string);
          contactResults.push({
            id: contact._id,
            name: contact.name,
            phoneNumber: contact.phoneNumber,
            status: 'ready'
          });
        } catch (error: any) {
          contactResults.push({
            name: contactData.name,
            phoneNumber: normalizedPhone,
            status: 'error',
            error: error.message
          });
        }
      }

      if (contactIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid contacts found',
          contactResults
        });
      }

      // Create bulk message with original contact data including custom variables
      const mappedContactsData = contactsData.map((contactData, index) => ({
        contactId: contactIds[index],
        name: contactData.name,
        phoneNumber: contactData.phoneNumber,
        email: contactData.email,
        // Include all custom variables from the original data
        ...contactData
      }));
      
      const bulkMessageData: CreateBulkMessageData = {
        name,
        templateId,
        contacts: contactIds,
        contactsData: mappedContactsData,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        createdBy: userId!
      };

      const bulkMessage = await BulkMessageService.createBulkMessage(bulkMessageData);

      // Start processing immediately if not scheduled
      if (!scheduledAt) {
        // Process in background
        BulkMessageService.processBulkMessage(bulkMessage._id as string)
          .catch(error => console.error('Bulk message processing error:', error));
      }

      res.status(201).json({
        success: true,
        message: 'Bulk message created successfully',
        data: {
          bulkMessage,
          contactResults,
          validContacts: contactIds.length,
          totalContacts: contactsData.length
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
      
      // If not admin, only show user's own bulk messages
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

      // Check if user has permission to view this bulk message
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

      // Check permissions
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

      // Check permissions
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

  // POST /api/bulk-messages/validate-contacts - Validate contacts before creating bulk message
  static async validateContacts(req: AuthRequest, res: Response) {
    try {
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Request body is required and must be valid JSON'
        });
      }

      const { contactsData } = req.body;

      if (!contactsData || !Array.isArray(contactsData)) {
        return res.status(400).json({
          success: false,
          message: 'ContactsData array is required'
        });
      }

      const validationResults = [];

      for (const contactData of contactsData) {
        const result: any = {
          originalData: contactData,
          isValid: false,
          errors: []
        };

        // Validate required fields
        if (!contactData.phoneNumber) {
          result.errors.push('Phone number is required');
        }
        if (!contactData.name) {
          result.errors.push('Name is required');
        }

        if (contactData.phoneNumber) {
          try {
            const normalizedPhone = normalizePhoneNumber(contactData.phoneNumber);
            result.normalizedPhoneNumber = normalizedPhone;
            
            // Check if contact already exists
            const existingContact = await ContactService.getContactByPhone(normalizedPhone);
            if (existingContact) {
              result.existingContact = {
                id: existingContact._id,
                name: existingContact.name,
                phoneNumber: existingContact.phoneNumber
              };
            }
          } catch (error) {
            result.errors.push('Invalid phone number format');
          }
        }

        result.isValid = result.errors.length === 0;
        validationResults.push(result);
      }

      const validCount = validationResults.filter(r => r.isValid).length;

      res.json({
        success: true,
        message: 'Contact validation completed',
        data: {
          validationResults,
          summary: {
            total: contactsData.length,
            valid: validCount,
            invalid: contactsData.length - validCount
          }
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