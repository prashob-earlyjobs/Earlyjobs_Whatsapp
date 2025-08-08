import axios from 'axios';

// Test configuration
const WEBHOOK_BASE_URL = 'http://localhost:3000/api/webhooks/gupshup';

// Example delivery reports based on Gupshup documentation
const deliveryReports = {
  // GET request example (single delivery report)
  getRequest: {
    url: `${WEBHOOK_BASE_URL}/delivery-report`,
    params: {
      externalId: '3562707498794989059-328736121207676738',
      deliveredTS: '1526347800000',
      status: 'SUCCESS',
      cause: 'SUCCESS',
      phoneNo: '919892488888',
      errCode: '000',
      noOfFrags: '1',
      mask: 'TESTIN'
    }
  },

  // POST request example (batch delivery reports)
  postRequest: {
    url: `${WEBHOOK_BASE_URL}/delivery-report`,
    data: {
      response: [
        {
          externalId: '3562707498794989059-328736121207676738',
          eventType: 'DELIVERED',
          eventTs: 1526347800000,
          destAddr: 919892488888,
          srcAddr: 'TESTIN',
          cause: 'SUCCESS',
          errCode: '000',
          channel: 'SMS',
          noOfFrags: 1
        },
        {
          externalId: '3798318073013708082-252169030017029882',
          eventType: 'FAILED',
          eventTs: 1526347800000,
          destAddr: 91989237777,
          srcAddr: 'ABCDEF',
          cause: 'UNKNOWN_SUBSCRIBER',
          errCode: '003',
          channel: 'SMS',
          noOfFrags: 1
        }
      ]
    }
  },

  // Single POST delivery report
  singlePostRequest: {
    url: `${WEBHOOK_BASE_URL}/delivery-report`,
    data: {
      externalId: 'test-message-id-123',
      eventType: 'DELIVERED',
      eventTs: Date.now(),
      destAddr: 919892488888,
      srcAddr: 'TESTIN',
      cause: 'SUCCESS',
      errCode: '000',
      channel: 'SMS',
      noOfFrags: 1
    }
  }
};

async function testGetDeliveryReport() {
  try {
    console.log('🧪 Testing GET Delivery Report Webhook...');
    console.log('URL:', deliveryReports.getRequest.url);
    console.log('Params:', deliveryReports.getRequest.params);

    const response = await axios.get(deliveryReports.getRequest.url, {
      params: deliveryReports.getRequest.params
    });

    console.log('✅ GET Delivery Report Response:');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error: any) {
    console.error('❌ GET Delivery Report Test Failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

async function testPostDeliveryReport() {
  try {
    console.log('\n🧪 Testing POST Delivery Report Webhook (Batch)...');
    console.log('URL:', deliveryReports.postRequest.url);
    console.log('Data:', JSON.stringify(deliveryReports.postRequest.data, null, 2));

    const response = await axios.post(deliveryReports.postRequest.url, 
      deliveryReports.postRequest.data,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ POST Delivery Report Response:');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error: any) {
    console.error('❌ POST Delivery Report Test Failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

async function testSinglePostDeliveryReport() {
  try {
    console.log('\n🧪 Testing POST Delivery Report Webhook (Single)...');
    console.log('URL:', deliveryReports.singlePostRequest.url);
    console.log('Data:', JSON.stringify(deliveryReports.singlePostRequest.data, null, 2));

    const response = await axios.post(deliveryReports.singlePostRequest.url, 
      deliveryReports.singlePostRequest.data,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Single POST Delivery Report Response:');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error: any) {
    console.error('❌ Single POST Delivery Report Test Failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Test different Gupshup status scenarios
async function testStatusScenarios() {
  const scenarios = [
    {
      name: 'Success Delivery',
      data: {
        externalId: 'success-message-123',
        eventType: 'DELIVERED',
        cause: 'SUCCESS',
        errCode: '000'
      }
    },
    {
      name: 'Failed - Unknown Subscriber',
      data: {
        externalId: 'failed-message-123',
        eventType: 'FAILED',
        cause: 'UNKNOWN_SUBSCRIBER',
        errCode: '003'
      }
    },
    {
      name: 'Failed - DND',
      data: {
        externalId: 'dnd-message-123',
        eventType: 'FAILED',
        cause: 'DND_FAIL',
        errCode: '006'
      }
    },
    {
      name: 'Failed - System Failure',
      data: {
        externalId: 'system-failure-123',
        eventType: 'FAILED',
        cause: 'SYSTEM_FAILURE',
        errCode: '005'
      }
    }
  ];

  console.log('\n🧪 Testing Status Scenarios...');

  for (const scenario of scenarios) {
    try {
      console.log(`\n📊 Testing: ${scenario.name}`);
      
      const testData = {
        ...scenario.data,
        eventTs: Date.now(),
        destAddr: 919892488888,
        srcAddr: 'TESTIN',
        channel: 'SMS',
        noOfFrags: 1
      };

      const response = await axios.post(`${WEBHOOK_BASE_URL}/delivery-report`, testData, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log(`✅ ${scenario.name} Response:`, response.data);

    } catch (error: any) {
      console.error(`❌ ${scenario.name} Failed:`, error.response?.data || error.message);
    }
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting Delivery Report Webhook Tests...\n');

  // Test GET request
  await testGetDeliveryReport();

  // Test POST batch request
  await testPostDeliveryReport();

  // Test single POST request
  await testSinglePostDeliveryReport();

  // Test different status scenarios
  await testStatusScenarios();

  console.log('\n✨ Delivery Report Webhook Tests Complete!');
  console.log('\n📝 Usage Instructions:');
  console.log('1. Make sure your server is running on http://localhost:3000');
  console.log('2. Ensure you have messages in your database with the test messageIds');
  console.log('3. Run: npx ts-node scripts/testDeliveryReportWebhook.ts');
  console.log('4. Check your server logs for webhook processing details');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

export {
  testGetDeliveryReport,
  testPostDeliveryReport,
  testSinglePostDeliveryReport,
  testStatusScenarios,
  runAllTests
}; 