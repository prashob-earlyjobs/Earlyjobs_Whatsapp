require('dotenv').config();

// Test script to verify template message sending with proper credentials
async function testDirectTemplateSend() {
  // Set the environment variables based on your working URL
  process.env.GUPSHUP_USER_ID = '2000254194';
  process.env.GUPSHUP_PASSWORD = 'h7ZkLBDE';
  
  console.log('🧪 Testing direct template message sending...');
  console.log('Using credentials from working URL:');
  console.log('- User ID:', process.env.GUPSHUP_USER_ID);
  console.log('- Password:', '***' + process.env.GUPSHUP_PASSWORD.slice(-3));
  
  try {
    // Import the service after setting env vars
    const { GupshupService } = require('./services/gupshupService');
    
    // Test template data similar to your working URL
    const templateData = {
      message: "Hey! 👋 \nEver thought of running a business that helps people find jobs? \nWith EarlyJobs, you can start your own recruitment franchise - no experience needed! \n✅ Full training & support \n✅ Work with top brands like HDFC \n✅ Help freshers & women in Tier 2-3 cities It's simple, impactful, and backed by smart tools. \nLet's build something meaningful together.",
      header: "Lead Hiring in Your District with EarlyJobs!",
      footer: "EarlyJobs: Build Wealth, Empower Lives",
      isTemplate: true
    };
    
    // Test phone number from your working URL
    const phoneNumber = '6385875940';
    
    console.log('📤 Sending template message...');
    console.log('- Phone:', phoneNumber);
    console.log('- Message length:', templateData.message.length);
    console.log('- Has header:', !!templateData.header);
    console.log('- Has footer:', !!templateData.footer);
    
    const response = await GupshupService.sendTemplateMessageWithConditions(
      phoneNumber,
      templateData
    );
    
    console.log('✅ SUCCESS!');
    console.log('Response:', JSON.stringify(response, null, 2));
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
  }
}

testDirectTemplateSend();