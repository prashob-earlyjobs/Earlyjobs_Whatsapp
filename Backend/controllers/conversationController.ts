import { Request, Response } from 'express';
import { ConversationService, ConversationFilters, CreateConversationData } from '../services/conversationService';
import { MessageService, CreateMessageData } from '../services/messageService';
import { GupshupService } from '../services/gupshupService';
import { AuthRequest } from '../middleware/auth';

export class ConversationController {
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

      const conversation = await ConversationService.createConversation(conversationData);

      res.status(201).json({
        success: true,
        message: 'Conversation ready',
        data: {
          conversation
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
            gupshupResponse = await GupshupService.sendTemplateMessage(
              contact.phoneNumber,
              content.templateId,
              content.templateData || {}
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
} 