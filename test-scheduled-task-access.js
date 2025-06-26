const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

// Test tokens (you'll need to get these from actual login)
const CUSTOMER_TOKEN = 'your_customer_token_here';
const TASKER_TOKEN = 'your_tasker_token_here';

// Test scheduled task access
async function testScheduledTaskAccess() {
  console.log('🧪 Testing Scheduled Task Access...\n');

  try {
    // First, let's get a list of tasks to find a scheduled one
    console.log('1. Getting all tasks to find scheduled ones...');
    const tasksResponse = await axios.get(`${API_BASE}/v1/tasks`);
    console.log(`Found ${tasksResponse.data.data.length} active tasks`);

    // For this test, we'll need to manually create a scheduled task or use an existing one
    // Let's assume we have a scheduled task ID
    const SCHEDULED_TASK_ID = 'your_scheduled_task_id_here';

    // Test 1: Access without authentication (should fail)
    console.log('\n2. Testing access without authentication...');
    try {
      await axios.get(`${API_BASE}/v1/tasks/${SCHEDULED_TASK_ID}`);
      console.log('❌ ERROR: Should have failed without auth');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Correctly blocked unauthenticated access');
      } else {
        console.log('❌ Unexpected error:', error.response?.data?.message);
      }
    }

    // Test 2: Access as customer (should succeed)
    console.log('\n3. Testing access as customer...');
    try {
      const response = await axios.get(`${API_BASE}/v1/tasks/${SCHEDULED_TASK_ID}`, {
        headers: { Authorization: `Bearer ${CUSTOMER_TOKEN}` }
      });
      console.log('✅ Customer can access scheduled task');
      console.log('Task status:', response.data.data.status);
    } catch (error) {
      console.log('❌ Customer access failed:', error.response?.data?.message);
    }

    // Test 3: Access as selected tasker (should succeed)
    console.log('\n4. Testing access as selected tasker...');
    try {
      const response = await axios.get(`${API_BASE}/v1/tasks/${SCHEDULED_TASK_ID}`, {
        headers: { Authorization: `Bearer ${TASKER_TOKEN}` }
      });
      console.log('✅ Selected tasker can access scheduled task');
      console.log('Task status:', response.data.data.status);
    } catch (error) {
      console.log('❌ Tasker access failed:', error.response?.data?.message);
    }

  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Helper function to decode JWT token
function decodeToken(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return payload;
  } catch (error) {
    return null;
  }
}

console.log('📋 Instructions:');
console.log('1. Replace CUSTOMER_TOKEN and TASKER_TOKEN with actual tokens');
console.log('2. Replace SCHEDULED_TASK_ID with an actual scheduled task ID');
console.log('3. Run: node test-scheduled-task-access.js\n');

// Uncomment to run the test
// testScheduledTaskAccess(); 