# Delivery Report Webhook Implementation

This document explains the implementation of Gupshup's real-time delivery report webhook for tracking message delivery status.

## Overview

The delivery report webhook receives real-time updates from Gupshup about the delivery status of sent messages. It supports both GET and POST requests and can handle batch processing of multiple delivery reports.

## Webhook Endpoint

```
GET/POST /api/webhooks/gupshup/delivery-report
```

## Request Formats

### 1. GET Request (Single Delivery Report)

Gupshup sends GET requests with query parameters:

```
GET /api/webhooks/gupshup/delivery-report?externalId=%0&deliveredTS=%1&status=%2&cause=%3&phoneNo=%4&errCode=%6&noOfFrags=%7&mask=%8
```

**Query Parameters:**
- `externalId`: Unique message ID (our messageId)
- `deliveredTS`: Delivery timestamp (LONG number)
- `status`: Final status (SUCCESS, FAILURE, UNKNOWN)
- `cause`: Response cause (see status mapping below)
- `phoneNo`: Recipient phone number
- `errCode`: Error code
- `noOfFrags`: Number of fragments (160 chars per fragment)
- `mask`: Sender ID (optional)

### 2. POST Request (Batch Delivery Reports)

Gupshup sends POST requests with JSON array containing up to 20 delivery reports:

```json
{
  "response": [
    {
      "externalId": "3562707498794989059-328736121207676738",
      "eventType": "DELIVERED",
      "eventTs": 1526347800000,
      "destAddr": 919892488888,
      "srcAddr": "TESTIN",
      "cause": "SUCCESS",
      "errCode": "000",
      "channel": "SMS",
      "noOfFrags": 1
    },
    {
      "externalId": "3798318073013708082-252169030017029882",
      "eventType": "FAILED",
      "eventTs": 1526347800000,
      "destAddr": 91989237777,
      "srcAddr": "ABCDEF",
      "cause": "UNKNOWN_SUBSCRIBER",
      "errCode": "003",
      "channel": "SMS",
      "noOfFrags": 1
    }
  ]
}
```

## Status Mapping

The webhook maps Gupshup statuses to internal message statuses:

### Internal Statuses
- `sent`: Message sent but delivery status unknown
- `delivered`: Message successfully delivered
- `read`: Message read by recipient (if supported)
- `failed`: Message delivery failed

### Gupshup Status Mapping

| Gupshup Status | Gupshup Cause | Error Code | Internal Status |
|----------------|---------------|------------|-----------------|
| DELIVERED/SUCCESS | SUCCESS | 000 | delivered |
| FAILED/FAILURE/UNDELIV | ABSENT_SUBSCRIBER | 001 | failed |
| FAILED/FAILURE/UNDELIV | CALL_BARRED | 002 | failed |
| FAILED/FAILURE/UNDELIV | UNKNOWN_SUBSCRIBER | 003 | failed |
| FAILED/FAILURE/UNDELIV | SERVICE_DOWN | 004 | failed |
| FAILED/FAILURE/UNDELIV | SYSTEM_FAILURE | 005 | failed |
| FAILED/FAILURE/UNDELIV | DND_FAIL | 006 | failed |
| FAILED/FAILURE/UNDELIV | BLOCKED | 007 | failed |
| FAILED/FAILURE/UNDELIV | DND_TIMEOUT | 008 | failed |
| FAILED/FAILURE/UNDELIV | OUTSIDE_WORKING_HOURS | 009 | failed |
| FAILED/FAILURE/UNDELIV | OTHER | 00a | failed |
| FAILED/FAILURE/UNDELIV | BLOCKED_MASK | 00b | failed |
| EXPIRED | SMSCTIMEDOUT | 00c | failed |
| FAILED | CANCEL_CAUSEID | 00d | failed |
| FAILED | CANCEL_SCHEDULE | 00e | failed |
| FAILED | DEFERRED | 010 | failed |
| UNDELIV | INBOXFULL | 011 | failed |
| UNDELIV | CONGESTION | 012 | failed |
| EXPIRED | NO_ACK_FROM_OPERATOR | 013 | failed |
| FAILED | MSG_DOES_NOT_MATCH_TEMPLATE | 038 | failed |

## Implementation Details

### 1. Webhook Controller

The `WebhookController.handleDeliveryReport()` method:

- **Supports both GET and POST requests**
- **Handles batch processing** of multiple delivery reports
- **Maps Gupshup statuses** to internal statuses
- **Updates message status** in the database
- **Provides detailed logging** for debugging
- **Handles errors gracefully** with proper error responses

### 2. Message Service Integration

Uses `MessageService.getMessageByMessageId()` to find messages by their external ID and `MessageService.updateMessageStatus()` to update delivery status.

### 3. Error Handling

- **Message not found**: Logs warning and continues processing other reports
- **Database errors**: Logs error and returns appropriate HTTP status
- **Invalid data**: Validates input and returns 400 Bad Request
- **Processing errors**: Uses Promise.allSettled for batch processing

## Configuration

### 1. Gupshup Dashboard Setup

1. Log in to https://enterprise.smsgupshup.com
2. Go to Settings → Advanced Account Settings
3. Set Realtime Delivery URL to: `https://toolsapis.earlyjobs.ai/api/webhooks/gupshup/delivery-report`
4. Choose GET or POST method (POST recommended for batch processing)


### 2. Environment Variables

Ensure your server is accessible via HTTPS for production use.

### 3. Webhook Security

Consider implementing webhook signature validation for additional security:

```typescript
// Validate webhook signature
const signature = req.headers['x-gupshup-signature'] as string;
if (signature && !GupshupService.validateWebhookSignature(JSON.stringify(req.body), signature)) {
  return res.status(401).json({ success: false, message: 'Invalid signature' });
}
```

## Testing

### 1. Test Script

Use the provided test script:

```bash
npx ts-node scripts/testDeliveryReportWebhook.ts
```

### 2. Manual Testing

#### GET Request Test
```bash
curl "http://localhost:3000/api/webhooks/gupshup/delivery-report?externalId=test-123&status=SUCCESS&cause=SUCCESS&phoneNo=919892488888&errCode=000"
```

#### POST Request Test
```bash
curl -X POST http://localhost:3000/api/webhooks/gupshup/delivery-report \
  -H "Content-Type: application/json" \
  -d '{
    "externalId": "test-123",
    "eventType": "DELIVERED",
    "eventTs": 1526347800000,
    "destAddr": 919892488888,
    "srcAddr": "TESTIN",
    "cause": "SUCCESS",
    "errCode": "000",
    "channel": "SMS",
    "noOfFrags": 1
  }'
```

### 3. Batch Testing
```bash
curl -X POST http://localhost:3000/api/webhooks/gupshup/delivery-report \
  -H "Content-Type: application/json" \
  -d '{
    "response": [
      {
        "externalId": "msg-1",
        "eventType": "DELIVERED",
        "cause": "SUCCESS"
      },
      {
        "externalId": "msg-2",
        "eventType": "FAILED",
        "cause": "UNKNOWN_SUBSCRIBER"
      }
    ]
  }'
```

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "Processed 2 delivery reports successfully",
  "processed": 2,
  "failed": 0,
  "total": 2
}
```

### Error Response
```json
{
  "success": false,
  "message": "Internal server error processing delivery reports",
  "error": "Database connection failed"
}
```

## Monitoring and Logging

### 1. Console Logs

The webhook provides detailed console logging:

```
📊 Delivery Report Webhook Received:
📋 Processing 2 delivery report(s)
📊 Processing delivery report for externalId: msg-123
✅ Updated message msg-123 status to: delivered
✅ Processed 2 delivery reports successfully, 0 failed
```

### 2. Database Updates

Message status is updated in the database:

```typescript
// Before webhook
{ messageId: "msg-123", status: "sent" }

// After webhook
{ messageId: "msg-123", status: "delivered" }
```

### 3. Error Tracking

Failed processing is logged with details:

```
❌ Failed to process delivery report 1: Message not found in database
```

## Best Practices

### 1. Performance
- **Batch processing**: Handle multiple reports efficiently
- **Async processing**: Use Promise.allSettled for parallel processing
- **Database optimization**: Use indexes on messageId field

### 2. Reliability
- **Idempotency**: Handle duplicate delivery reports gracefully
- **Error handling**: Continue processing other reports if one fails
- **Retry logic**: Implement retry for transient failures

### 3. Security
- **Input validation**: Validate all incoming data
- **Rate limiting**: Implement rate limiting for webhook endpoints
- **Authentication**: Consider webhook signature validation

### 4. Monitoring
- **Health checks**: Monitor webhook endpoint availability
- **Metrics**: Track delivery success/failure rates
- **Alerts**: Set up alerts for webhook failures

## Troubleshooting

### Common Issues

1. **Message not found**
   - Ensure messageId in database matches externalId from Gupshup
   - Check message creation timing

2. **Webhook not receiving calls**
   - Verify URL is accessible from internet
   - Check Gupshup dashboard configuration
   - Ensure HTTPS for production

3. **Status not updating**
   - Check database connection
   - Verify messageId format
   - Review error logs

4. **Batch processing issues**
   - Check JSON format
   - Verify array structure
   - Review individual report processing

### Debug Mode

Enable debug logging by checking the webhook logs:

```typescript
console.log('📊 Delivery Report Webhook Received:');
console.log('Method:', req.method);
console.log('Headers:', JSON.stringify(req.headers, null, 2));
console.log('Query:', JSON.stringify(req.query, null, 2));
console.log('Body:', JSON.stringify(req.body, null, 2));
``` 