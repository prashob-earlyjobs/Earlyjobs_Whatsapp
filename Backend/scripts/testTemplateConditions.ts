import axios from 'axios';

// Test configuration
const API_BASE_URL = 'http://localhost:3000/api';
const TEST_PHONE_NUMBER = '8714500637'; // Replace with your test phone number

// Example template data based on the URL you provided
const templateData = {
  message: "Hey! 👋\nEver thought of running a business that helps people find jobs?\nWith EarlyJobs, you can start your own recruitment franchise - no experience needed!\n✅ Full training & support\n✅ Work with top brands like HDFC\n✅ Help freshers & women in Tier 2-3 cities\nIt's simple, impactful, and backed by smart tools.\nLet's build something meaningful together.",
  header: "Lead Hiring in Your District with EarlyJobs!",
  footer: "EarlyJobs: Build Wealth, Empower Lives",
  templateId: "earlyjobs_franchise_opportunity",
  category: "MARKETING",
  language: "en",
  isTemplate: true
};

async function testTemplateConditions() {
  try {
    console.log('🧪 Testing Template Conditions...');
    console.log('📱 Phone Number:', TEST_PHONE_NUMBER);
    console.log('📋 Template Data:', JSON.stringify(templateData, null, 2));

    // First, you'll need to get an auth token (this is just an example)
    // In a real scenario, you'd login first
    const authToken = 'YOUR_AUTH_TOKEN_HERE'; // Replace with actual token

    const response = await axios.post(
      `${API_BASE_URL}/conversations/test-template`,
      {
        phoneNumber: TEST_PHONE_NUMBER,
        templateData: templateData
      },
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Template Test Response:');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error: any) {
    console.error('❌ Template Test Failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Example of how to create a template URL manually (for debugging)
function createManualTemplateUrl() {
  const baseUrl = 'https://mediaapi.smsgupshup.com/GatewayAPI/rest';
  const params = new URLSearchParams({
    userid: '2000254194',
    password: '{{PASSWORD}}', // Replace with actual password
    send_to: TEST_PHONE_NUMBER,
    v: '1.1',
    format: 'json',
    msg_type: 'TEXT',
    method: 'SENDMESSAGE',
    msg: templateData.message,
    isTemplate: 'true',
    header: templateData.header,
    footer: templateData.footer
  });

  const templateUrl = `${baseUrl}?${params.toString()}`;
  console.log('🔗 Manual Template URL:');
  console.log(templateUrl);
}

// Example of template validation
function validateTemplateData() {
  const validation = {
    isValid: true,
    errors: [] as string[]
  };

  // Check message length
  const totalLength = (templateData.message?.length || 0) + 
                     (templateData.header?.length || 0) + 
                     (templateData.footer?.length || 0);
  
  if (totalLength > 1024) {
    validation.isValid = false;
    validation.errors.push("Template message exceeds maximum length of 1024 characters");
  }

  if (!templateData.message || templateData.message.trim().length === 0) {
    validation.isValid = false;
    validation.errors.push("Template message body is required");
  }

  if (!templateData.templateId) {
    validation.isValid = false;
    validation.errors.push("Template ID is required for template messages");
  }

  if (!templateData.category) {
    validation.isValid = false;
    validation.errors.push("Template category is required");
  }

  if (!templateData.language) {
    validation.isValid = false;
    validation.errors.push("Template language is required");
  }

  if (templateData.header && templateData.header.length > 60) {
    validation.isValid = false;
    validation.errors.push("Template header cannot exceed 60 characters");
  }

  if (templateData.footer && templateData.footer.length > 60) {
    validation.isValid = false;
    validation.errors.push("Template footer cannot exceed 60 characters");
  }

  console.log('🔍 Template Validation:');
  console.log('Valid:', validation.isValid);
  if (validation.errors.length > 0) {
    console.log('Errors:', validation.errors);
  }

  return validation;
}

// Run tests
console.log('🚀 Starting Template Conditions Test...\n');

// Validate template data
validateTemplateData();

console.log('\n');

// Create manual URL for debugging
createManualTemplateUrl();

console.log('\n');

// Test API endpoint (uncomment when you have auth token)
// testTemplateConditions();

console.log('\n✨ Template Conditions Test Complete!');
console.log('\n📝 Usage Instructions:');
console.log('1. Replace YOUR_AUTH_TOKEN_HERE with a valid authentication token');
console.log('2. Replace TEST_PHONE_NUMBER with a valid phone number');
console.log('3. Update templateData with your actual template information');
console.log('4. Uncomment the testTemplateConditions() call');
console.log('5. Run: npx ts-node scripts/testTemplateConditions.ts'); 