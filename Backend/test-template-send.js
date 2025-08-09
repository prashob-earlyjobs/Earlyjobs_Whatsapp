const axios = require('axios');

// Test sending a template message to identify the issue
async function testTemplateSend() {
  try {
    console.log('🧪 Testing template message sending...');
    
    // First, let's get a valid access token (you'll need to replace this with actual login)
    const loginResponse = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'test@example.com', // Replace with actual user email
      password: 'testpassword' // Replace with actual password
    });
    
    const token = loginResponse.data.data.token;
    console.log('✅ Got access token');
    
    // Get templates to find a valid templateId
    const templatesResponse = await axios.get('http://localhost:5001/api/templates', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const templates = templatesResponse.data.data.templates;
    if (templates.length === 0) {
      console.log('❌ No templates found');
      return;
    }
    
    const template = templates[0];
    console.log('📋 Using template:', template.name, 'ID:', template._id);
    
    // Find a contact or use the test phone number
    const contactsResponse = await axios.get('http://localhost:5001/api/contacts?limit=1', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    let phoneNumber = '6385875940'; // Default test number
    let conversationId = null;
    
    if (contactsResponse.data.data.contacts.length > 0) {
      const contact = contactsResponse.data.data.contacts[0];
      phoneNumber = contact.phoneNumber;
      console.log('👤 Using contact:', contact.name, 'Phone:', phoneNumber);
      
      // Get or create conversation
      const conversationsResponse = await axios.get(`http://localhost:5001/api/conversations?contactPhone=${phoneNumber}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (conversationsResponse.data.data.conversations.length > 0) {
        conversationId = conversationsResponse.data.data.conversations[0]._id;
      }
    }
    
    if (!conversationId) {
      console.log('❌ No conversation found for phone number:', phoneNumber);
      return;
    }
    
    // Test template message sending
    const templateMessage = {
      type: 'template',
      content: {
        templateId: template._id,
        templateData: {} // Empty template data for now
      }
    };
    
    console.log('📤 Sending template message...');
    console.log('Request:', JSON.stringify(templateMessage, null, 2));
    
    const response = await axios.post(
      `http://localhost:5001/api/conversations/${conversationId}/messages`,
      templateMessage,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    
    console.log('✅ Success:', response.data);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    console.error('Status:', error.response?.status);
    
    if (error.response?.data) {
      console.error('Error details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testTemplateSend();