# External Notification Webhook

## Overview
This webhook allows external portals to store notification messages in your database after they have been sent through Gupshup. It automatically handles contact creation, conversation management, and message storage without re-sending messages.

## Endpoint
```
POST /api/webhooks/notification
```

## Features
- ✅ **Message Storage**: Stores messages already sent via Gupshup
- ✅ **Automatic Contact Management**: Creates new contacts if they don't exist
- ✅ **Smart Conversation Handling**: Continues existing conversations or creates new ones
- ✅ **Template Support**: Supports both text and template messages
- ✅ **Phone Number Validation**: Normalizes and validates phone numbers
- ✅ **Comprehensive Logging**: Detailed logs for debugging and monitoring
- ✅ **Error Handling**: Proper error responses with meaningful messages

## Request Format

### Headers
```
Content-Type: application/json
```

### Body Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `phoneNumber` | string | ✅ | Recipient's phone number (with country code) |
| `message` | string | ✅ | Message content or template message |
| `senderName` | string | ❌ | Name of the sender/portal (default: "System Notification") |
| `messageType` | string | ❌ | Type of message: "text" or "template" (default: "text") |
| `templateId` | string | ❌ | Template ID (required if messageType is "template") |
| `templateData` | object | ❌ | Template variables (default: {}) |
| `gupshupMessageId` | string | ❌ | Message ID from Gupshup API |
| `timestamp` | string | ❌ | When message was sent (ISO string) |
| `status` | string | ❌ | Message status: sent, delivered, etc. |

### Example Requests

#### Text Message
```json
{
  "phoneNumber": "9182919959",
  "message": "Hello! This is a notification from our portal.",
  "senderName": "Customer Portal",
  "gupshupMessageId": "msg_123456789",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "status": "sent"
}
```

#### Template Message
```json
{
  "phoneNumber": "9182919959",
  "message": "Template message content",
  "senderName": "Marketing Portal",
  "messageType": "template",
  "templateId": "reply_availabel_call",
  "templateData": {
    "customerName": "John Doe",
    "appointmentTime": "2:00 PM"
  },
  "gupshupMessageId": "tpl_987654321",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "status": "sent"
}
```

## Response Format

### Success Response (200)
```json
{
  "success": true,
  "message": "External portal message stored successfully",
  "data": {
    "messageId": "64f8a1b2c3d4e5f6a7b8c9d0",
    "conversationId": "64f8a1b2c3d4e5f6a7b8c9d1",
    "contactId": "64f8a1b2c5f6a7b8c9d2",
    "gupshupMessageId": "msg_123456789",
    "status": "sent"
  }
}
```

### Error Responses

#### Missing Required Fields (400)
```json
{
  "success": false,
  "message": "phoneNumber and message are required fields"
}
```

#### Invalid Phone Number (400)
```json
{
  "success": false,
  "message": "Invalid phone number format"
}
```

#### Database Error (500)
```json
{
  "success": false,
  "message": "Failed to store message in database",
  "error": "Database connection failed"
}
```

#### Internal Server Error (500)
```json
{
  "success": false,
  "message": "Internal server error",
  "error": "Error details"
}
```

## How It Works

### 1. Contact Management
- **Existing Contact**: If phone number exists, uses existing contact
- **New Contact**: If phone number doesn't exist, creates new contact with source "external_portal"

### 2. Conversation Management
- **Existing Conversation**: If contact has active conversation, continues it
- **New Conversation**: If no conversation exists, creates new one (unassigned)

### 3. Message Storage
- **Text Messages**: Stores with message content and metadata
- **Template Messages**: Stores with template ID, variables, and fallback text

### 4. Database Updates
- Saves message to database
- Updates conversation `lastMessageAt` timestamp
- Resets conversation `unreadCount`

## Testing

### Using the Test Script
```bash
cd Backend/scripts
npx ts-node testNotificationWebhook.ts
```

**Note**: This webhook is for storing messages that have already been sent via Gupshup, not for sending new messages.

### Manual Testing with curl
```bash
# Text message
curl -X POST http://localhost:3000/api/webhooks/notification \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "9182919959",
    "message": "Test notification",
    "senderName": "Test Portal",
    "gupshupMessageId": "msg_123456",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "status": "sent"
  }'

# Template message
curl -X POST http://localhost:3000/api/webhooks/notification \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "9182919959",
    "message": "Template content",
    "messageType": "template",
    "templateId": "reply_availabel_call",
    "templateData": {"var1": "value1"},
    "gupshupMessageId": "tpl_789012",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "status": "sent"
  }'
```

## Security Considerations

### Authentication
- Currently no authentication required (consider adding API key validation)
- Webhook signature validation can be added for Gupshup-style security

### Rate Limiting
- Consider implementing rate limiting for production use
- Monitor webhook usage and implement throttling if needed

### Input Validation
- Phone number format validation
- Message length limits
- Template ID validation

## Integration Examples

### Node.js
```javascript
const axios = require('axios');

async function sendNotification(phoneNumber, message, senderName = 'Portal') {
  try {
    const response = await axios.post('https://yourdomain.com/api/webhooks/notification', {
      phoneNumber,
      message,
      senderName
    });
    
    return response.data;
  } catch (error) {
    console.error('Failed to send notification:', error.response?.data);
    throw error;
  }
}

// Usage
sendNotification('9182919959', 'Hello from portal!', 'Customer Portal');
```

### Python
```python
import requests

def send_notification(phone_number, message, sender_name='Portal'):
    url = 'https://yourdomain.com/api/webhooks/notification'
    payload = {
        'phoneNumber': phone_number,
        'message': message,
        'senderName': sender_name
    }
    
    response = requests.post(url, json=payload)
    return response.json()

# Usage
result = send_notification('9182919959', 'Hello from portal!', 'Customer Portal')
```

### PHP
```php
function sendNotification($phoneNumber, $message, $senderName = 'Portal') {
    $url = 'https://yourdomain.com/api/webhooks/notification';
    $data = [
        'phoneNumber' => $phoneNumber,
        'message' => $message,
        'senderName' => $senderName
    ];
    
    $options = [
        'http' => [
            'header' => "Content-type: application/json\r\n",
            'method' => 'POST',
            'content' => json_encode($data)
        ]
    ];
    
    $context = stream_context_create($options);
    $result = file_get_contents($url, false, $context);
    
    return json_decode($result, true);
}

// Usage
$result = sendNotification('9182919959', 'Hello from portal!', 'Customer Portal');
```

## Monitoring and Logging

### Console Logs
The webhook provides detailed logging for monitoring:
- 📥 Incoming webhook requests
- 📱 Contact and conversation processing
- 📤 Gupshup API calls
- ✅ Success confirmations
- ❌ Error details

### Database Records
- New contacts created with source "external_portal"
- Messages stored with direction "outbound"
- Conversation updates tracked

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Check Gupshup credentials in environment variables
   - Verify API permissions

2. **Invalid Phone Number**
   - Ensure phone number includes country code
   - Check phone number format validation

3. **Template Not Found**
   - Verify template ID exists in Gupshup
   - Check template approval status

4. **Rate Limiting**
   - Monitor webhook usage
   - Implement delays between requests if needed

### Debug Steps
1. Check webhook logs in console
2. Verify request payload format
3. Test with simple text message first
4. Check Gupshup API status
5. Verify database connections

## Future Enhancements

### Planned Features
- 🔐 API key authentication
- 📊 Webhook usage analytics
- 🚫 Rate limiting and throttling
- 📝 Message templates management
- 🔄 Webhook retry mechanism
- 📱 Bulk notification support

### Customization Options
- Custom webhook endpoints
- Message scheduling
- Priority queuing
- Delivery confirmation callbacks 