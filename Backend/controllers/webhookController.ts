import { Request, Response } from 'express';
import { ContactService } from '../services/contactService';
import { ConversationService } from '../services/conversationService';
import { MessageService } from '../services/messageService';
import { DeliveryReportService } from '../services/deliveryReportService';
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
      console.log('🚀 ===== GUPSHUP DELIVERY REPORT WEBHOOK RECEIVED =====');
      console.log('📅 Timestamp:', new Date().toISOString());
      console.log('🔗 Method:', req.method);
      console.log('🌐 URL:', req.url);
      console.log('📋 Content-Type:', req.get('Content-Type'));
      console.log('📡 User-Agent:', req.get('User-Agent'));
      console.log('🔑 Headers:');
      console.log(JSON.stringify(req.headers, null, 2));
      console.log('❓ Query Parameters:');
      console.log(JSON.stringify(req.query, null, 2));
      console.log('📦 Request Body:');
      console.log(JSON.stringify(req.body, null, 2));
      console.log('📏 Body Size:', JSON.stringify(req.body).length, 'characters');
      console.log('🏷️ Body Type:', typeof req.body);
      console.log('📊 Body Array Check:', Array.isArray(req.body));
      console.log('===============================================');

      let deliveryReports: any[] = [];

      // Handle GET request (single delivery report)
      if (req.method === 'GET') {
        console.log('🔍 Processing GET request...');
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

        console.log('📋 GET Query Parameters Extracted:');
        console.log('  externalId:', externalId);
        console.log('  deliveredTS:', deliveredTS);
        console.log('  status:', status);
        console.log('  cause:', cause);
        console.log('  phoneNo:', phoneNo);
        console.log('  errCode:', errCode);
        console.log('  noOfFrags:', noOfFrags);
        console.log('  mask:', mask);

        if (externalId) {
          const report = {
            externalId,
            deliveredTS: deliveredTS ? parseInt(deliveredTS as string) : null,
            status,
            cause,
            phoneNo,
            errCode,
            noOfFrags: noOfFrags ? parseInt(noOfFrags as string) : null,
            mask
          };
          deliveryReports.push(report);
          console.log('✅ GET delivery report created:', JSON.stringify(report, null, 2));
        } else {
          console.log('❌ GET request missing externalId');
        }
      }
      // Handle POST request (batch delivery reports)
      else if (req.method === 'POST') {
        console.log('🔍 Processing POST request...');
        console.log('📦 Body structure analysis:');
        console.log('  req.body exists:', !!req.body);
        console.log('  req.body is array:', Array.isArray(req.body));
        console.log('  req.body.response exists:', !!(req.body && req.body.response));
        console.log('  req.body.response is array:', !!(req.body && req.body.response && Array.isArray(req.body.response)));
        console.log('  req.body.response type:', typeof (req.body && req.body.response));
        
        if (Array.isArray(req.body)) {
          deliveryReports = req.body;
          console.log('✅ Using req.body as array directly');
          console.log('📊 Array contents:', JSON.stringify(req.body, null, 2));
        } else if (req.body && req.body.response && Array.isArray(req.body.response)) {
          deliveryReports = req.body.response;
          console.log('✅ Using req.body.response array');
          console.log('📊 Response array contents:', JSON.stringify(req.body.response, null, 2));
        } else if (req.body && req.body.response && typeof req.body.response === 'string') {
          // Handle URL-encoded form data where response is a JSON string
          console.log('🔧 Detected JSON string in response field');
          console.log('📝 Raw response string:', req.body.response);
          try {
            const parsedResponse = JSON.parse(req.body.response);
            console.log('✅ Successfully parsed JSON string');
            console.log('📊 Parsed data:', JSON.stringify(parsedResponse, null, 2));
            
            if (Array.isArray(parsedResponse)) {
              deliveryReports = parsedResponse;
              console.log('✅ Using parsed JSON array');
            } else {
              deliveryReports = [parsedResponse];
              console.log('✅ Converting parsed JSON object to array');
            }
          } catch (parseError) {
            console.error('❌ Failed to parse JSON string:', parseError);
            console.log('📝 Invalid JSON string:', req.body.response);
          }
        } else if (req.body && typeof req.body === 'object') {
          deliveryReports = [req.body];
          console.log('✅ Converting single object to array');
          console.log('📊 Single object:', JSON.stringify(req.body, null, 2));
        } else {
          console.log('❌ POST request has invalid body structure');
        }
      }

      if (deliveryReports.length === 0) {
        console.warn('⚠️ No delivery reports found in request');
        console.log('🔚 Ending processing - no delivery reports to process');
        return res.status(200).json({
          success: true,
          message: 'No delivery reports to process'
        });
      }

      console.log(`📋 Processing ${deliveryReports.length} delivery report(s)`);
      console.log('📊 All delivery reports to process:');
      deliveryReports.forEach((report, index) => {
        console.log(`  Report ${index + 1}:`, JSON.stringify(report, null, 2));
      });

      // Process each delivery report
      const results = await Promise.allSettled(
        deliveryReports.map(async (report) => {
          return await WebhookController.processDeliveryReport(report);
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
      console.log('🔄 ===== PROCESSING INDIVIDUAL DELIVERY REPORT =====');
      console.log('📦 Raw report data:', JSON.stringify(report, null, 2));
      
      const {
        externalId,
        eventType,
        eventTs,
        destAddr,
        srcAddr,
        cause,
        errCode,
        errorCode,
        channel,
        noOfFrags,
        status,
        deliveredTS,
        phoneNo,
        hsmTemplateId,
        conversation,
        pricing
      } = report;

      console.log('📋 Extracted fields from report:');
      console.log('  externalId:', externalId);
      console.log('  eventType:', eventType);
      console.log('  eventTs:', eventTs);
      console.log('  destAddr:', destAddr);
      console.log('  srcAddr:', srcAddr);
      console.log('  cause:', cause);
      console.log('  errCode:', errCode);
      console.log('  errorCode:', errorCode);
      console.log('  channel:', channel);
      console.log('  noOfFrags:', noOfFrags);
      console.log('  status:', status);
      console.log('  deliveredTS:', deliveredTS);
      console.log('  phoneNo:', phoneNo);
      console.log('  hsmTemplateId:', hsmTemplateId);
      console.log('  conversation:', JSON.stringify(conversation, null, 2));
      console.log('  pricing:', JSON.stringify(pricing, null, 2));
      
      console.log(`📊 Processing delivery report for externalId: ${externalId}`);

      // Map Gupshup status to our internal status
      console.log('🔄 Status mapping process:');
      console.log('  Input eventType/status:', eventType || status);
      console.log('  Input cause:', cause);
      console.log('  Input errCode/errorCode:', errCode || errorCode);
      
      const mappedStatus = WebhookController.mapGupshupStatusToInternalStatus(
        eventType || status,
        cause,
        errCode || errorCode
      );
      
      console.log('  Mapped to internal status:', mappedStatus);

      // Find message by externalId (messageId)
      console.log(`🔍 Searching for message with externalId: ${externalId}`);
      const message = await MessageService.getMessageByMessageId(externalId);
      
      if (!message) {
        console.warn(`⚠️ Message not found for externalId: ${externalId}`);
        console.log('❌ Database search failed - message does not exist');
        return {
          externalId,
          status: 'not_found',
          message: 'Message not found in database'
        };
      }
      
      console.log('✅ Message found in database:');
      console.log('  Message ID:', message._id);
      console.log('  Current status:', message.status);
      console.log('  Message type:', message.type);
      console.log('  Direction:', message.direction);

      // Update message status
      console.log(`🔄 Updating message status from '${message.status}' to '${mappedStatus}'`);
      await MessageService.updateMessageStatus((message._id as string), mappedStatus);
      console.log('✅ Message status updated successfully');

      // Save delivery report to database
      console.log('💾 Saving delivery report to database...');
      try {
        // Check if this exact delivery report already exists to prevent duplicates
        const reportExists = await DeliveryReportService.reportExists(
          externalId,
          eventType || status,
          new Date(eventTs || deliveredTS || Date.now())
        );

        if (!reportExists) {
          const deliveryReportData = {
            messageId: externalId,
            srcAddr: srcAddr || '',
            destAddr: destAddr || phoneNo || '',
            channel: channel || 'UNKNOWN',
            eventType: (eventType || status) as 'SENT' | 'DELIVERED' | 'READ' | 'FAILED',
            cause: cause || '',
            errorCode: (errCode || errorCode || '000'),
            eventTs: new Date(eventTs || deliveredTS || Date.now()),
            hsmTemplateId,
            conversation,
            pricing,
            noOfFrags,
            internalStatus: mappedStatus
          };

          const savedReport = await DeliveryReportService.createDeliveryReport(deliveryReportData);
          console.log('✅ Delivery report saved successfully:', savedReport._id);
        } else {
          console.log('⚠️ Delivery report already exists, skipping duplicate');
        }
      } catch (reportError: any) {
        console.error('❌ Failed to save delivery report:', reportError);
        // Don't throw error here - continue processing even if report saving fails
      }

      // Log delivery details
      const deliveryDetails = {
        externalId,
        originalStatus: eventType || status,
        mappedStatus,
        cause,
        errCode: errCode || errorCode,
        phoneNumber: destAddr || phoneNo,
        timestamp: eventTs || deliveredTS,
        channel,
        noOfFrags,
        hsmTemplateId,
        conversation,
        pricing
      };

      console.log(`✅ Updated message ${externalId} status to: ${mappedStatus}`, deliveryDetails);

      const result = {
        externalId,
        status: 'updated',
        mappedStatus,
        deliveryDetails
      };
      
      console.log('📤 Processing result:', JSON.stringify(result, null, 2));
      console.log('🏁 ===== DELIVERY REPORT PROCESSING COMPLETED =====');
      
      return result;

    } catch (error: any) {
      console.error(`❌ Error processing delivery report for externalId: ${report.externalId || 'unknown'}`);
      console.error('Error details:', error);
      console.error('Error stack:', error.stack);
      console.log('🚫 ===== DELIVERY REPORT PROCESSING FAILED =====');
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

    // Sent status (new in WhatsApp API)
    if (status === 'SENT') {
      return 'sent';
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
      
      // New WhatsApp error codes
      if (errorCode === 25) {
        return 'sent'; // SENT status
      }
      
      if (errorCode === 26) {
        return 'read'; // READ status
      }
      
      // Failure codes
      if ([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 23, 24, 38].includes(errorCode)) {
        return 'failed';
      }
    }

    // Check specific causes
    if (causeUpper) {
      const successCauses = ['SENT'];
      if (successCauses.includes(causeUpper)) {
        return 'sent';
      }

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