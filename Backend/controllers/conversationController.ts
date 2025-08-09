import { Request, Response } from 'express';
import { ConversationService, ConversationFilters, CreateConversationData } from '../services/conversationService';
import { MessageService, CreateMessageData } from '../services/messageService';
import { ContactService, CreateContactData } from '../services/contactService';
import { DeliveryReportService } from '../services/deliveryReportService';
import { GupshupService } from '../services/gupshupService';
import { TemplateService } from '../services/templateService';
import { AuthRequest } from '../middleware/auth';
import { normalizePhoneNumber, isValidPhoneNumber } from '../utils/phoneNumber';

export class ConversationController {
  // POST /api/conversations/start - Start new conversation with phone number
  static async startConversationWithPhone(req: AuthRequest, res: Response) {
    try {
      // Check if request body exists
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Request body is required and must be valid JSON'
        });
      }

      const { phoneNumber, name, email, initialMessage } = req.body;
      const userId = req.user?.id;

      // Validation
      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          message: 'Phone number is required to start a conversation'
        });
      }

      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Contact name is required'
        });
      }

      // Type validation
      if (typeof phoneNumber !== 'string' || typeof name !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Phone number and name must be strings'
        });
      }

      // Normalize phone number to ensure consistent format
      const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
      
      // Validate phone number format
      if (!isValidPhoneNumber(normalizedPhoneNumber)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid phone number'
        });
      }

      // Check if contact already exists
      let contact = await ContactService.getContactByPhone(normalizedPhoneNumber);
      
      if (!contact) {
        // Create new contact
        const contactData: CreateContactData = {
          phoneNumber: normalizedPhoneNumber,
          name: name.trim(),
          email: email?.trim(),
          assignedTo: userId
        };

        try {
          contact = await ContactService.createContact(contactData);
        } catch (error: any) {
          if (error.message === 'Contact with this phone number already exists') {
            // Race condition - contact was created between check and creation
            contact = await ContactService.getContactByPhone(normalizedPhoneNumber);
          } else {
            throw error;
          }
        }
      }

      // Find or create conversation for this contact
      const conversationData: CreateConversationData = {
        contactId: contact!._id as string,
        assignedTo: userId
      };

      const result = await ConversationService.findOrCreateConversation(conversationData);
      const conversation = result.conversation;
      
      let message = 'Conversation started successfully';
      if (!result.isNew && !result.wasReopened) {
        message = 'Using existing conversation';
      } else if (result.wasReopened) {
        message = 'Conversation reopened successfully';
      }

      // Send initial message if provided
      let sentMessage = null;
      if (initialMessage && initialMessage.trim()) {
        try {
          // Send message via Gupshup
          const gupshupResponse = await GupshupService.sendTextMessage(
            normalizedPhoneNumber,
            initialMessage.trim()
          );

          // Save message to database
          const messageData: CreateMessageData = {
            conversationId: conversation._id as string,
            contactId: contact!._id as string,
            senderId: userId,
            messageId: gupshupResponse.messageId,
            type: 'text',
            content: { text: initialMessage.trim() },
            direction: 'outbound',
            timestamp: new Date()
          };

          sentMessage = await MessageService.createMessage(messageData);
        } catch (gupshupError: any) {
          console.error('Failed to send initial message:', gupshupError);
          // Don't fail the conversation creation if message sending fails
        }
      }

      res.status(201).json({
        success: true,
        message: message,
        data: {
          conversation,
          contact,
          isNew: result.isNew,
          wasReopened: result.wasReopened,
          conversationAction: result.isNew ? 'created' : result.wasReopened ? 'reopened' : 'reused',
          initialMessageSent: !!sentMessage
        }
      });

    } catch (error: any) {
      console.error('Start conversation error:', error);
      
      if (error.message === 'Contact not found') {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

      // Handle validation errors
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: Object.values(error.errors).map((err: any) => err.message)
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error while starting conversation'
      });
    }
  }

  // POST /api/conversations
  static async createConversation(req: AuthRequest, res: Response) {
    try {
      // Check if request body exists
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Request body is required and must be valid JSON'
        });
      }

      const { contactId, assignedTo }: CreateConversationData = req.body;

      // Validation
      if (!contactId) {
        return res.status(400).json({
          success: false,
          message: 'Contact ID is required to start a conversation'
        });
      }

      // Type validation
      if (typeof contactId !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Contact ID must be a string'
        });
      }

      if (assignedTo && typeof assignedTo !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Assigned user ID must be a string'
        });
      }

      const conversationData: CreateConversationData = {
        contactId: contactId.trim(),
        assignedTo: assignedTo?.trim()
      };

      const result = await ConversationService.findOrCreateConversation(conversationData);

      const message = result.isNew ? 'Conversation created successfully' : 
                     result.wasReopened ? 'Conversation reopened successfully' : 
                     'Using existing conversation';

      res.status(201).json({
        success: true,
        message: message,
        data: {
          conversation: result.conversation,
          isNew: result.isNew,
          wasReopened: result.wasReopened,
          conversationAction: result.isNew ? 'created' : result.wasReopened ? 'reopened' : 'reused'
        }
      });

    } catch (error: any) {
      console.error('Create conversation error:', error);
      
      if (error.message === 'Contact not found') {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

      // Handle validation errors
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: Object.values(error.errors).map((err: any) => err.message)
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error while creating conversation'
      });
    }
  }

  // GET /api/conversations
  static async getConversations(req: AuthRequest, res: Response) {
    try {
      const { status, assignedTo, tags } = req.query;
      
      const filters: ConversationFilters = {};
      
      if (status && ['open', 'closed', 'pending'].includes(status as string)) {
        filters.status = status as 'open' | 'closed' | 'pending';
      }
      
      if (assignedTo) {
        filters.assignedTo = assignedTo as string;
      }
      
      if (tags) {
        filters.tags = Array.isArray(tags) ? tags as string[] : [tags as string];
      }

      const conversations = await ConversationService.getAllConversations(filters);

      res.json({
        success: true,
        message: 'Conversations retrieved successfully',
        data: {
          conversations,
          count: conversations.length
        }
      });

    } catch (error: any) {
      console.error('Get conversations error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while retrieving conversations'
      });
    }
  }

  // GET /api/conversations/:id
  static async getConversationById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Conversation ID is required'
        });
      }

      const conversation = await ConversationService.getConversationById(id);

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      res.json({
        success: true,
        message: 'Conversation retrieved successfully',
        data: {
          conversation
        }
      });

    } catch (error: any) {
      console.error('Get conversation error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while retrieving conversation'
      });
    }
  }

  // PUT /api/conversations/:id/status
  static async updateConversationStatus(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Conversation ID is required'
        });
      }

      if (!status || !['open', 'closed', 'pending'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Valid status is required (open, closed, pending)'
        });
      }

      const conversation = await ConversationService.updateConversationStatus(id, status);

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      res.json({
        success: true,
        message: 'Conversation status updated successfully',
        data: {
          conversation
        }
      });

    } catch (error: any) {
      console.error('Update conversation status error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while updating conversation status'
      });
    }
  }

  // PUT /api/conversations/:id/assign
  static async assignConversation(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { userId } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Conversation ID is required'
        });
      }

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required for assignment'
        });
      }

      const conversation = await ConversationService.assignConversation(id, userId);

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      res.json({
        success: true,
        message: 'Conversation assigned successfully',
        data: {
          conversation
        }
      });

    } catch (error: any) {
      console.error('Assign conversation error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while assigning conversation'
      });
    }
  }

  // GET /api/conversations/:id/messages
  static async getConversationMessages(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { limit = '50', offset = '0' } = req.query;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Conversation ID is required'
        });
      }

      // Check if conversation exists
      const conversation = await ConversationService.getConversationById(id);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      const messages = await MessageService.getMessagesByConversation(
        id,
        parseInt(limit as string, 10),
        parseInt(offset as string, 10)
      );

      res.json({
        success: true,
        message: 'Messages retrieved successfully',
        data: {
          messages,
          count: messages.length,
          conversationId: id
        }
      });

    } catch (error: any) {
      console.error('Get conversation messages error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while retrieving messages'
      });
    }
  }

  // GET /api/conversations/:id/messages/new - Get new messages since timestamp
  static async getNewMessages(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { since } = req.query;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Conversation ID is required'
        });
      }

      if (!since) {
        return res.status(400).json({
          success: false,
          message: 'Since timestamp is required'
        });
      }

      // Check if conversation exists
      const conversation = await ConversationService.getConversationById(id);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      const sinceDate = new Date(since as string);
      if (isNaN(sinceDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid timestamp format'
        });
      }

      const newMessages = await MessageService.getMessagesSinceTimestamp(
        id,
        sinceDate
      );

      res.json({
        success: true,
        message: 'New messages retrieved successfully',
        data: {
          messages: newMessages,
          count: newMessages.length,
          conversationId: id,
          since: sinceDate.toISOString()
        }
      });

    } catch (error: any) {
      console.error('Get new messages error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while retrieving new messages'
      });
    }
  }

  // POST /api/conversations/:id/messages - Send message to real WhatsApp via Gupshup
  static async sendMessage(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { type, content } = req.body;
      const senderId = req.user?.id;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Conversation ID is required'
        });
      }

      if (!type || !['text', 'image', 'document', 'template'].includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'Valid message type is required (text, image, document, template)'
        });
      }

      if (!content) {
        return res.status(400).json({
          success: false,
          message: 'Message content is required'
        });
      }

      // Check if conversation exists and get contact details
      const conversation = await ConversationService.getConversationById(id);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      const contact = conversation.contactId as any;
      if (!contact || !contact.phoneNumber) {
        return res.status(400).json({
          success: false,
          message: 'Contact phone number not found'
        });
      }

      // ⏰ WhatsApp Business API 24-hour rule validation
      // Only template messages can be sent outside the 24-hour customer service window
      if (type !== 'template') {
        const isWithinWindow = await ConversationService.isWithin24HourWindow(id);
        if (!isWithinWindow) {
          return res.status(403).json({
            success: false,
            message: 'Cannot send regular messages outside the 24-hour customer service window. Please use a template message instead.',
            code: 'OUTSIDE_24_HOUR_WINDOW',
            data: {
              lastInboundMessageAt: conversation.lastInboundMessageAt,
              canSendTemplates: true,
              canSendRegularMessages: false
            }
          });
        }
      }

      let gupshupResponse;
      let messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      try {
        // Send message via Gupshup API based on type
        switch (type) {
          case 'text':
            if (!content.text) {
              return res.status(400).json({
                success: false,
                message: 'Text content is required for text messages'
              });
            }
            gupshupResponse = await GupshupService.sendTextMessage(
              contact.phoneNumber,
              content.text
            );

            messageId = gupshupResponse.messageId;
            break;

            
          case 'template':
            if (!content.templateId) {
              return res.status(400).json({
                success: false,
                message: 'Template ID is required for template messages'
              });
            }
            
            // Get template from database to render the message text
            const template = await TemplateService.getTemplateById(content.templateId);
            if (!template) {
              return res.status(404).json({
                success: false,
                message: 'Template not found'
              });
            }
            
            // Render template text with variables
            let renderedText = template.body.text;
            if (content.templateData && template.body.variables) {
              template.body.variables.forEach((variable) => {
                const value = content.templateData[variable] || `{{${variable}}}`;
                renderedText = renderedText.replace(new RegExp(`\\{\\{${variable}\\}\\}`, 'g'), value);
              });
            }
            
            // Extract header and footer from template
            const header = template.header?.content;
            const footer = template.footer;
            

            
            // Add rendered text, header, and footer to content for saving
            content.text = renderedText;
            content.header = header;
            content.footer = footer;
            
            // Prepare template data for validation and sending
            const templateData = {
              message: renderedText,
              header: header,
              footer: footer,
              templateId: template.templateId,
              category: template.category,
              language: template.language,
              isTemplate: true
            };
            
            // Validate template before sending
            const validation = GupshupService.validateTemplateMessage(templateData);
            if (!validation.isValid) {
              return res.status(400).json({
                success: false,
                message: 'Template validation failed',
                errors: validation.errors
              });
            }
            
            // Use enhanced template message sending with conditions
            gupshupResponse = await GupshupService.sendTemplateMessageWithConditions(
              contact.phoneNumber,
              templateData
            );
            messageId = gupshupResponse.messageId;
            break;

          case 'image':
          case 'document':
            if (!content.mediaUrl) {
              return res.status(400).json({
                success: false,
                message: 'Media URL is required for media messages'
              });
            }
            gupshupResponse = await GupshupService.sendMediaMessage(
              contact.phoneNumber,
              content.mediaUrl,
              type as 'image' | 'document',
              content.text // caption
            );
            messageId = gupshupResponse.messageId;
            break;

          default:
            return res.status(400).json({
              success: false,
              message: 'Unsupported message type'
            });
        }

        // Save message to database
        const messageData: CreateMessageData = {
          conversationId: id,
          contactId: contact._id || contact,
          senderId,
          messageId,
          type,
          content,
          direction: 'outbound',
          timestamp: new Date()
        };

        const message = await MessageService.createMessage(messageData);

        res.status(201).json({
          success: true,
          message: 'Message sent successfully to WhatsApp',
          data: {
            message,
            gupshupStatus: gupshupResponse.status,
            sentToPhone: contact.phoneNumber
          }
        });

      } catch (gupshupError: any) {
        console.error('Gupshup API error:', gupshupError);
        
        // Save failed message to database for tracking
        const messageData: CreateMessageData = {
          conversationId: id,
          contactId: contact._id || contact,
          senderId,
          messageId,
          type,
          content,
          direction: 'outbound',
          timestamp: new Date()
        };

        const message = await MessageService.createMessage(messageData);
        
        // Update message status to failed
        await MessageService.updateMessageStatus(message._id as string, 'failed');

        return res.status(500).json({
          success: false,
          message: 'Failed to send message via WhatsApp',
          error: gupshupError.message,
          data: {
            message
          }
        });
      }

    } catch (error: any) {
      console.error('Send message error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while sending message'
      });
    }
  }

  // PUT /api/conversations/:id/read
  static async markAsRead(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Conversation ID is required'
        });
      }

      // Check if conversation exists
      const conversation = await ConversationService.getConversationById(id);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      // Mark messages as read
      await MessageService.markMessagesAsRead(id);

      // Get updated conversation
      const updatedConversation = await ConversationService.getConversationById(id);

      res.json({
        success: true,
        message: 'Conversation marked as read successfully',
        data: {
          conversation: updatedConversation
        }
      });

    } catch (error: any) {
      console.error('Mark as read error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while marking conversation as read'
      });
    }
  }

  // GET /api/conversations/:id/24-hour-status - Check if conversation is within 24-hour messaging window
  static async check24HourStatus(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;



      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Conversation ID is required'
        });
      }

      // Check if conversation exists
      const conversation = await ConversationService.getConversationById(id);
      if (!conversation) {

        return res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
      }



      const canSendRegularMessages = await ConversationService.isWithin24HourWindow(id);
      const canSendTemplates = true; // Templates can always be sent



      let hoursRemaining = 0;
      if (conversation.lastInboundMessageAt && canSendRegularMessages) {
        const now = new Date();
        const timeDifference = now.getTime() - conversation.lastInboundMessageAt.getTime();
        const hoursElapsed = timeDifference / (1000 * 60 * 60);
        hoursRemaining = Math.max(0, 24 - hoursElapsed);
      }

      const responseData = {
        canSendRegularMessages,
        canSendTemplates,
        lastInboundMessageAt: conversation.lastInboundMessageAt,
        hoursRemaining: Math.round(hoursRemaining * 100) / 100 // Round to 2 decimal places
      };



      res.status(200).json({
        success: true,
        message: '24-hour status retrieved successfully',
        data: responseData
      });

    } catch (error: any) {
      console.error('Check 24-hour status error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while checking 24-hour status'
      });
    }
  }

  // POST /api/conversations/test-template
  static async testTemplateConditions(req: AuthRequest, res: Response) {
    try {
      const { phoneNumber, templateData } = req.body;

      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          message: 'Phone number is required'
        });
      }

      if (!templateData) {
        return res.status(400).json({
          success: false,
          message: 'Template data is required'
        });
      }

      // Validate template data
      const validation = GupshupService.validateTemplateMessage(templateData);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Template validation failed',
          errors: validation.errors
        });
      }

      // Create template URL for testing
      const templateUrl = GupshupService.createTemplateUrl(phoneNumber, templateData);

      // Test sending template message
      const gupshupResponse = await GupshupService.sendTemplateMessageWithConditions(
        phoneNumber,
        templateData
      );

      res.json({
        success: true,
        message: 'Template test completed successfully',
        data: {
          templateUrl: templateUrl.replace(/password=[^&]*/, 'password=***'), // Hide password in response
          gupshupResponse,
          validation: {
            isValid: validation.isValid,
            errors: validation.errors
          }
        }
      });
    } catch (error: any) {
      console.error('Test template conditions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to test template conditions',
        error: error.message
      });
    }
  }

  // GET /api/conversations/messages/:messageId/delivery-reports
  static async getMessageDeliveryReports(req: AuthRequest, res: Response) {
    try {
      const { messageId } = req.params;

      if (!messageId) {
        return res.status(400).json({
          success: false,
          message: 'Message ID is required'
        });
      }

      // Get the message to verify it exists and user has access
      const message = await MessageService.getMessageByMessageId(messageId);
      if (!message) {
        return res.status(404).json({
          success: false,
          message: 'Message not found'
        });
      }

      // Get delivery reports for this message
      const deliveryReports = await DeliveryReportService.getDeliveryReportsByMessageId(messageId);
      const latestReport = await DeliveryReportService.getLatestDeliveryReport(messageId);

      res.json({
        success: true,
        data: {
          message: {
            _id: message._id,
            messageId: message.messageId,
            type: message.type,
            status: message.status,
            timestamp: message.timestamp
          },
          deliveryReports,
          latestReport,
          totalReports: deliveryReports.length
        }
      });

    } catch (error: any) {
      console.error('Get delivery reports error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while fetching delivery reports'
      });
    }
  }
} 