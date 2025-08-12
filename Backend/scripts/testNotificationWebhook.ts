import axios from 'axios';

const BASE_URL = 'http://localhost:3000/api/webhooks';

interface NotificationPayload {
  phoneNumber: string;
  message: string;
  senderName?: string;
  messageType?: 'text' | 'template';
  templateId?: string;
  templateData?: Record<string, string>;
  gupshupMessageId?: string; // Message ID from Gupshup
  timestamp?: string; // When message was sent
  status?: string; // Message status (sent, delivered, etc.)
}

async function testNotificationWebhook(payload: NotificationPayload) {
  try {
    console.log('📤 Testing notification webhook with payload:', payload);
    
    const response = await axios.post(`${BASE_URL}/notification`, payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Success:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('❌ Error:', error.response?.data || error.message);
    return null;
  }
}

async function testTextNotification() {
  console.log('\n🧪 Testing Text Notification:');
  await testNotificationWebhook({
    phoneNumber: '9182919959',
    message: 'Hello! This is a test notification from external portal.',
    senderName: 'Test Portal',
    gupshupMessageId: `msg_${Date.now()}`,
    timestamp: new Date().toISOString(),
    status: 'sent'
  });
}

async function testTemplateNotification() {
  console.log('\n🧪 Testing Template Notification:');
  await testNotificationWebhook({
    phoneNumber: '9182919959',
    message: 'Template message content',
    senderName: 'Test Portal',
    messageType: 'template',
    templateId: 'reply_availabel_call',
    templateData: {
      variable1: 'value1',
      variable2: 'value2'
    },
    gupshupMessageId: `tpl_${Date.now()}`,
    timestamp: new Date().toISOString(),
    status: 'sent'
  });
}

async function testNewContactNotification() {
  console.log('\n🧪 Testing New Contact Notification:');
  await testNotificationWebhook({
    phoneNumber: '919876543210',
    message: 'Welcome! This is your first notification.',
    senderName: 'Welcome Portal',
    gupshupMessageId: `new_${Date.now()}`,
    timestamp: new Date().toISOString(),
    status: 'sent'
  });
}

async function testExistingContactNotification() {
  console.log('\n🧪 Testing Existing Contact Notification:');
  await testNotificationWebhook({
    phoneNumber: '9182919959',
    message: 'Follow-up message for existing contact.',
    senderName: 'Follow-up Portal',
    gupshupMessageId: `fup_${Date.now()}`,
    timestamp: new Date().toISOString(),
    status: 'sent'
  });
}

async function runAllTests() {
  console.log('🚀 Starting External Notification Webhook Tests...\n');
  
  await testTextNotification();
  await testTemplateNotification();
  await testNewContactNotification();
  await testExistingContactNotification();
  
  console.log('\n🏁 All tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

export {
  testNotificationWebhook,
  testTextNotification,
  testTemplateNotification,
  testNewContactNotification,
  testExistingContactNotification
}; 