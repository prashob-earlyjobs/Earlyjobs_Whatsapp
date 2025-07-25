import { Request, Response } from 'express';
import { ContactService } from '../services/contactService';
import { ConversationService } from '../services/conversationService';
import { MessageService } from '../services/messageService';
import { GupshupService } from '../services/gupshupService';
import { IWebhookIncoming, validateWebhookIncoming } from '../models/WebhookIncoming';

export class WebhookController {
  // POST /api/webhooks/gupshup/incoming - Handle incoming WhatsApp messages
  static async handleIncomingMessage(req: Request, res: Response) {
    console.log('📥 Incoming webhook received:', JSON.stringify(req.body, null, 2));

    try {
      console.log('📥 Incoming webhook received:', JSON.stringify(req.body, null, 2));

      // Validate webhook signature (optional but recommended for security)
      const signature = req.headers['x-gupshup-signature'] as string;
      if (signature && !GupshupService.validateWebhookSignature(JSON.stringify(req.body), signature)) {
        return res.status(401).json({
          success: false,
          message: 'Invalid webhook signature'
        });
      }

      const { 
        waNumber,
        mobile,
        name,
        text,
        type,
        timestamp,
        image
      } = req.body;

      // Validate required fields using the model validator
      if (!validateWebhookIncoming(req.body)) {
        console.error('❌ Missing or invalid required fields in webhook:', { waNumber, mobile, name, text, type, timestamp });
        return res.status(400).json({
          success: false,
          message: 'Missing or invalid required fields: waNumber, mobile, name, text, type, timestamp are mandatory'
        });
      }

      // Convert timestamp from string to Date if needed
      const messageTimestamp = new Date(parseInt(timestamp));
      if (isNaN(messageTimestamp.getTime())) {
        console.error('❌ Invalid timestamp format:', timestamp);
        return res.status(400).json({
          success: false,
          message: 'Invalid timestamp format'
        });
      }

      const phoneNumber = waNumber || mobile;
      const senderName = name;

      // 1. Find or create contact
      let contact;
      try {
        // Try to find existing contact by phone number
        contact = await ContactService.getContactByPhone(phoneNumber);

        if (!contact) {
          // Create new contact automatically
          contact = await ContactService.createContact({
            phoneNumber,
            name: senderName,
            tags: ['whatsapp-user']
          });
          console.log('✅ New contact created:', contact._id);
        }
      } catch (error: any) {
        console.error('❌ Error handling contact:', error);
        return res.status(500).json({
          success: false,
          message: 'Error processing contact'
        });
      }

      // 2. Find or create conversation
      let conversation;
      try {
        conversation = await ConversationService.createConversation({
          contactId: contact._id as string
        });
        console.log('✅ Conversation ready:', conversation._id);
      } catch (error: any) {
        console.error('❌ Error handling conversation:', error);
        return res.status(500).json({
          success: false,
          message: 'Error processing conversation'
        });
      }

      // 3. Process message content based on type
      let messageContent: any = {};
      
      switch (type.toLowerCase()) {
        case 'text':
          messageContent = { text: text || '' };
          break;
          
        case 'image':
          messageContent = {
            text: text || '',
            mediaUrl: image || '',
            mediaType: 'image/jpeg'
          };
          break;
          
        case 'document':
          messageContent = {
            text: text || '',
            mediaUrl: image || '',
            mediaType: 'application/pdf'
          };
          break;
          
        case 'audio':
          messageContent = {
            text: text || '',
            mediaUrl: image || '',
            mediaType: 'audio/mpeg'
          };
          break;

        case 'video':
          messageContent = {
            text: text || '',
            mediaUrl: image || '',
            mediaType: 'video/mp4'
          };
          break;
          
        default:
          messageContent = { text: text || `Unsupported message type: ${type}` };
      }

      // 4. Save incoming message
      try {
        // Generate a unique messageId from waNumber and timestamp
        const generatedMessageId = `${waNumber}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const message = await MessageService.createMessage({
          conversationId: conversation._id as string,
          contactId: contact._id as string,
          messageId: generatedMessageId,
          type: type.toLowerCase() as any,
          content: messageContent,
          direction: 'inbound',
          timestamp: messageTimestamp
        });

        console.log('✅ Incoming message saved:', message._id);

        // Respond to Gupshup
        res.status(200).json({
          success: true,
          message: 'Message processed successfully',
          data: {
            messageId: message._id,
            conversationId: conversation._id,
            contactId: contact._id
          }
        });

      } catch (error: any) {
        console.error('❌ Error saving message:', error);
        return res.status(500).json({
          success: false,
          message: 'Error saving message'
        });
      }

    } catch (error: any) {
      console.error('❌ Webhook processing error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error processing webhook'
      });
    }
  }

  // POST /api/webhooks/gupshup/status - Handle message status updates
  static async handleStatusUpdate(req: Request, res: Response) {
    try {
      console.log('📊 Status webhook received:', JSON.stringify(req.body, null, 2));

      const { messageId, status, timestamp, reason } = req.body;

      if (!messageId || !status) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: messageId, status'
        });
      }

      // Update message status in database
      try {
        const validStatuses = ['sent', 'delivered', 'read', 'failed'];
        if (!validStatuses.includes(status.toLowerCase())) {
          console.warn('⚠️ Unknown status received:', status);
          return res.status(200).json({
            success: true,
            message: 'Unknown status, ignored'
          });
        }

        await MessageService.updateMessageStatus(messageId, status.toLowerCase());
        
        console.log(`✅ Message ${messageId} status updated to: ${status}`);

        res.status(200).json({
          success: true,
          message: 'Status updated successfully'
        });

      } catch (error: any) {
        console.error('❌ Error updating message status:', error);
        res.status(500).json({
          success: false,
          message: 'Error updating message status'
        });
      }

    } catch (error: any) {
      console.error('❌ Status webhook error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error processing status update'
      });
    }
  }

  // GET /api/webhooks/test - Test webhook endpoint
  static async testWebhook(req: Request, res: Response) {
    res.json({
      success: true,
      message: 'Webhook endpoints are working',
      timestamp: new Date().toISOString(),
      endpoints: {
        incoming: 'POST /api/webhooks/gupshup/incoming',
        status: 'POST /api/webhooks/gupshup/status'
      }
    });
  }
} 