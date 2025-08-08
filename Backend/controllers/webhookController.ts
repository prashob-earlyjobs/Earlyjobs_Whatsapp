import { Request, Response } from 'express';
import { ContactService } from '../services/contactService';
import { ConversationService } from '../services/conversationService';
import { MessageService } from '../services/messageService';
import { GupshupService } from '../services/gupshupService';
import { IWebhookIncoming, validateWebhookIncoming } from '../models/WebhookIncoming';
import { normalizePhoneNumber, isValidPhoneNumber } from '../utils/phoneNumber';

export class WebhookController {
  // POST /api/webhooks/gupshup/incoming - Handle incoming WhatsApp messages
  static async handleIncomingMessage(req: Request, res: Response) {
    try {
      console.log('📥 Incoming webhook received:');
      console.log('Headers:', JSON.stringify(req.headers, null, 2));
      console.log('Body:', JSON.stringify(req.body, null, 2));
      console.log('Content-Type:', req.get('Content-Type'));

      // Check if req.body exists and is not empty
      if (!req.body || typeof req.body !== 'object') {
        console.error('❌ Request body is missing or invalid:', { 
          bodyType: typeof req.body, 
          body: req.body,
          contentType: req.get('Content-Type')
        });
        return res.status(400).json({
          success: false,
          message: 'Request body is missing or invalid. Expected JSON object.',
          received: {
            bodyType: typeof req.body,
            contentType: req.get('Content-Type')
          }
        });
      }

      // Validate webhook signature (optional but recommended for security)
      const signature = req.headers['x-gupshup-signature'] as string;
      if (signature && !GupshupService.validateWebhookSignature(JSON.stringify(req.body), signature)) {
        return res.status(401).json({
          success: false,
          message: 'Invalid webhook signature'
        });
      }

      // Safe destructuring with default values
      const { 
        waNumber = '',
        mobile = '',
        name = '',
        text = '',
        type = '',
        timestamp = '',
        image = ''
      } = req.body || {};

      console.log('📝 Extracted fields:', { waNumber, mobile, name, text, type, timestamp, image });

      // Validate required fields using the model validator
      if (!validateWebhookIncoming(req.body)) {
        console.error('❌ Missing or invalid required fields in webhook:', { waNumber, mobile, name, text, type, timestamp });
        return res.status(400).json({
          success: false,
          message: 'Missing or invalid required fields: waNumber, mobile, name, text, type, timestamp are mandatory',
          received: { waNumber, mobile, name, text, type, timestamp }
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

      // Use mobile (contact's number) as the primary phone number
      // waNumber is OUR business number, mobile is the CONTACT's number
      const rawPhoneNumber = mobile ;
      const senderName = name;

      // Additional validation
      if (!rawPhoneNumber) {
        console.error('❌ No phone number provided:', { waNumber, mobile });
        return res.status(400).json({
          success: false,
          message: 'Contact phone number is required (mobile field)'
        });
      }

      // Normalize phone number to ensure consistent format
      const phoneNumber = normalizePhoneNumber(rawPhoneNumber);
      
      // Validate normalized phone number
      if (!isValidPhoneNumber(phoneNumber)) {
        console.error('❌ Invalid phone number format:', { original: rawPhoneNumber, normalized: phoneNumber });
        return res.status(400).json({
          success: false,
          message: 'Invalid phone number format'
        });
      }

      console.log('📞 Contact phone number (normalized):', phoneNumber);
      console.log('🏢 Business WhatsApp number:', waNumber);
      console.log('📱 Original vs Normalized:', { original: rawPhoneNumber, normalized: phoneNumber });

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
      let conversationInfo: { isNew: boolean; wasReopened: boolean } = { isNew: false, wasReopened: false };
      try {
        const result = await ConversationService.findOrCreateConversation({
          contactId: contact._id as string
        });
        conversation = result.conversation;
        conversationInfo = { isNew: result.isNew, wasReopened: result.wasReopened };
        
        if (result.isNew) {
          console.log('✅ New conversation created:', conversation._id);
        } else if (result.wasReopened) {
          console.log('🔄 Conversation reopened:', conversation._id);
        } else {
          console.log('♻️ Using existing conversation:', conversation._id);
        }
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
            contactId: contact._id,
            conversationStatus: {
              isNew: conversationInfo.isNew,
              wasReopened: conversationInfo.wasReopened,
              action: conversationInfo.isNew ? 'created' : conversationInfo.wasReopened ? 'reopened' : 'reused'
            }
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
        incoming: 'POST /api/webhooks/incoming',
        status: 'POST /api/webhooks/status',
        debug: 'POST /api/webhooks/debug'
      }
    });
  }

  // POST /api/webhooks/debug - Debug webhook endpoint
  static async debugWebhook(req: Request, res: Response) {
    try {
      console.log('🔍 DEBUG WEBHOOK - Headers:', JSON.stringify(req.headers, null, 2));
      console.log('🔍 DEBUG WEBHOOK - Body:', JSON.stringify(req.body, null, 2));
      console.log('🔍 DEBUG WEBHOOK - Content-Type:', req.get('Content-Type'));
      console.log('🔍 DEBUG WEBHOOK - Method:', req.method);
      console.log('🔍 DEBUG WEBHOOK - URL:', req.url);
      console.log('🔍 DEBUG WEBHOOK - Query:', JSON.stringify(req.query, null, 2));

      res.status(200).json({
        success: true,
        message: 'Debug data logged successfully',
        received: {
          headers: req.headers,
          body: req.body,
          contentType: req.get('Content-Type'),
          method: req.method,
          url: req.url,
          query: req.query
        }
      });
    } catch (error: any) {
      console.error('❌ Debug webhook error:', error);
      res.status(500).json({
        success: false,
        message: 'Debug webhook error',
        error: error.message
      });
    }
  }

  // GET/POST /api/webhooks/gupshup/delivery-report - Handle real-time delivery reports
  static async handleDeliveryReport(req: Request, res: Response) {
    try {
      console.log('📊 Delivery Report Webhook Received:');
      console.log('Method:', req.method);
      console.log('Headers:', JSON.stringify(req.headers, null, 2));
      console.log('Query:', JSON.stringify(req.query, null, 2));
      console.log('Body:', JSON.stringify(req.body, null, 2));

      let deliveryReports: any[] = [];

      // Handle GET request (single delivery report)
      if (req.method === 'GET') {
        const {
          externalId,
          deliveredTS,
          status,
          cause,
          phoneNo,
          errCode,
          noOfFrags,
          mask
        } = req.query;

        if (externalId) {
          deliveryReports.push({
            externalId,
            deliveredTS: deliveredTS ? parseInt(deliveredTS as string) : null,
            status,
            cause,
            phoneNo,
            errCode,
            noOfFrags: noOfFrags ? parseInt(noOfFrags as string) : null,
            mask
          });
        }
      }
      // Handle POST request (batch delivery reports)
      else if (req.method === 'POST') {
        if (Array.isArray(req.body)) {
          deliveryReports = req.body;
        } else if (req.body && req.body.response && Array.isArray(req.body.response)) {
          deliveryReports = req.body.response;
        } else if (req.body && typeof req.body === 'object') {
          deliveryReports = [req.body];
        }
      }

      if (deliveryReports.length === 0) {
        console.warn('⚠️ No delivery reports found in request');
        return res.status(200).json({
          success: true,
          message: 'No delivery reports to process'
        });
      }

      console.log(`📋 Processing ${deliveryReports.length} delivery report(s)`);

      // Process each delivery report
      const results = await Promise.allSettled(
        deliveryReports.map(async (report) => {
          return await this.processDeliveryReport(report);
        })
      );

      // Count successful and failed processing
      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.filter(result => result.status === 'rejected').length;

      console.log(`✅ Processed ${successful} delivery reports successfully, ${failed} failed`);

      // Log any failed processing
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`❌ Failed to process delivery report ${index}:`, result.reason);
        }
      });

      res.status(200).json({
        success: true,
        message: `Processed ${successful} delivery reports successfully`,
        processed: successful,
        failed: failed,
        total: deliveryReports.length
      });

    } catch (error: any) {
      console.error('❌ Delivery report webhook error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error processing delivery reports',
        error: error.message
      });
    }
  }

  // Process individual delivery report
  private static async processDeliveryReport(report: any) {
    try {
      const {
        externalId,
        eventType,
        eventTs,
        destAddr,
        srcAddr,
        cause,
        errCode,
        channel,
        noOfFrags,
        status,
        deliveredTS,
        phoneNo
      } = report;

      console.log(`📊 Processing delivery report for externalId: ${externalId}`);

      // Map Gupshup status to our internal status
      const mappedStatus = this.mapGupshupStatusToInternalStatus(
        eventType || status,
        cause,
        errCode
      );

      // Find message by externalId (messageId)
      const message = await MessageService.getMessageByMessageId(externalId);
      
      if (!message) {
        console.warn(`⚠️ Message not found for externalId: ${externalId}`);
        return {
          externalId,
          status: 'not_found',
          message: 'Message not found in database'
        };
      }

      // Update message status
      await MessageService.updateMessageStatus((message._id as string), mappedStatus);

      // Log delivery details
      const deliveryDetails = {
        externalId,
        originalStatus: eventType || status,
        mappedStatus,
        cause,
        errCode,
        phoneNumber: destAddr || phoneNo,
        timestamp: eventTs || deliveredTS,
        channel,
        noOfFrags
      };

      console.log(`✅ Updated message ${externalId} status to: ${mappedStatus}`, deliveryDetails);

      return {
        externalId,
        status: 'updated',
        mappedStatus,
        deliveryDetails
      };

    } catch (error: any) {
      console.error(`❌ Error processing delivery report:`, error);
      throw error;
    }
  }

  // Map Gupshup status to internal status
  private static mapGupshupStatusToInternalStatus(
    eventType: string,
    cause?: string,
    errCode?: string
  ): 'sent' | 'delivered' | 'read' | 'failed' {
    const status = eventType?.toUpperCase();
    const causeUpper = cause?.toUpperCase();

    // Success cases
    if (status === 'DELIVERED' || status === 'SUCCESS') {
      return 'delivered';
    }

    // Read status (if supported by Gupshup)
    if (status === 'READ') {
      return 'read';
    }

    // Failure cases based on Gupshup documentation
    if (status === 'FAILED' || status === 'FAILURE' || status === 'UNDELIV') {
      return 'failed';
    }

    // Check specific error codes
    if (errCode) {
      const errorCode = parseInt(errCode);
      
      // Success codes
      if (errorCode === 0) {
        return 'delivered';
      }
      
      // Failure codes
      if ([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 23, 24, 38].includes(errorCode)) {
        return 'failed';
      }
    }

    // Check specific causes
    if (causeUpper) {
      const failureCauses = [
        'ABSENT_SUBSCRIBER',
        'UNKNOWN_SUBSCRIBER',
        'BLOCKED_MASK',
        'SYSTEM_FAILURE',
        'CALL_BARRED',
        'SERVICE_DOWN',
        'DND_FAIL',
        'DND_TIMEOUT',
        'MSG_DOES_NOT_MATCH_TEMPLATE',
        'OUTSIDE_WORKING_HOURS',
        'BLOCKED',
        'BLOCKED_FOR_USER',
        'OTHER'
      ];

      if (failureCauses.includes(causeUpper)) {
        return 'failed';
      }
    }

    // Default to sent if we can't determine the status
    console.warn(`⚠️ Unknown status mapping for: ${eventType}, cause: ${cause}, errCode: ${errCode}`);
    return 'sent';
  }
} 