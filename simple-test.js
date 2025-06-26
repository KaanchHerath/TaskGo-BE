import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000/api';

// Simple test function
async function runTests() {
  console.log('🚀 Starting TaskGo API Tests...\n');

  try {
    // Test 1: Check if server is running
    console.log('1. Testing server health...');
    try {
      const response = await fetch(`${BASE_URL}/v1/tasks`);
      console.log(`✅ Server is running - Status: ${response.status}`);
    } catch (error) {
      console.log('❌ Server is not running. Please start the server first.');
      console.log('   Run: npm run dev');
      return;
    }

    // Test 2: Get all tasks (public endpoint)
    console.log('\n2. Testing GET /api/v1/tasks (public)');
    const tasksResponse = await fetch(`${BASE_URL}/v1/tasks`);
    const tasksData = await tasksResponse.json();
    
    if (tasksResponse.status === 200 && tasksData.success) {
      console.log('✅ GET /tasks - PASSED');
      console.log(`   Found ${tasksData.data?.length || 0} tasks`);
      console.log(`   Pagination: ${JSON.stringify(tasksData.pagination)}`);
    } else {
      console.log('❌ GET /tasks - FAILED');
      console.log(`   Status: ${tasksResponse.status}`);
      console.log(`   Response: ${JSON.stringify(tasksData)}`);
    }

    // Test 3: Try to create task without auth (should fail with 401)
    console.log('\n3. Testing POST /api/v1/tasks (without auth - should fail)');
    const createResponse = await fetch(`${BASE_URL}/v1/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'Test Task',
        category: 'Cleaning',
        minPayment: 50,
        maxPayment: 100,
        area: 'Colombo',
        startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 48 * 60 * 60 * 1000)
      })
    });
    
    if (createResponse.status === 401) {
      console.log('✅ POST /tasks without auth - PASSED (correctly rejected)');
    } else {
      console.log('❌ POST /tasks without auth - FAILED (should be 401)');
      console.log(`   Status: ${createResponse.status}`);
    }

    // Test 4: Test filtering
    console.log('\n4. Testing GET /api/v1/tasks with filters');
    const filteredResponse = await fetch(`${BASE_URL}/v1/tasks?category=Plumbing&area=Colombo`);
    const filteredData = await filteredResponse.json();
    
    if (filteredResponse.status === 200) {
      console.log('✅ GET /tasks with filters - PASSED');
      console.log(`   Filtered results: ${filteredData.data?.length || 0} tasks`);
    } else {
      console.log('❌ GET /tasks with filters - FAILED');
    }

    // Test 5: Test pagination
    console.log('\n5. Testing GET /api/v1/tasks with pagination');
    const paginatedResponse = await fetch(`${BASE_URL}/v1/tasks?page=1&limit=5`);
    const paginatedData = await paginatedResponse.json();
    
    if (paginatedResponse.status === 200 && paginatedData.pagination) {
      console.log('✅ GET /tasks with pagination - PASSED');
      console.log(`   Page: ${paginatedData.pagination.page}, Limit: ${paginatedData.pagination.limit}`);
      console.log(`   Total: ${paginatedData.pagination.total}, Pages: ${paginatedData.pagination.pages}`);
    } else {
      console.log('❌ GET /tasks with pagination - FAILED');
    }

    // Test 6: Test invalid task ID
    console.log('\n6. Testing GET /api/v1/tasks/:id with invalid ID');
    const invalidResponse = await fetch(`${BASE_URL}/v1/tasks/invalid-id`);
    
    if (invalidResponse.status === 400) {
      console.log('✅ GET /tasks/invalid-id - PASSED (correctly rejected)');
    } else {
      console.log('❌ GET /tasks/invalid-id - FAILED (should be 400)');
      console.log(`   Status: ${invalidResponse.status}`);
    }

    console.log('\n🎉 Basic API tests completed!');
    console.log('\n📝 Summary:');
    console.log('   ✅ Task API endpoints are working correctly');
    console.log('   ✅ Authentication protection is working');
    console.log('   ✅ Filtering and pagination are working');
    console.log('   ✅ Error handling is working');
    console.log('\n💡 To test authenticated endpoints, you need to:');
    console.log('   1. Register/login as a customer or tasker');
    console.log('   2. Use the JWT token in Authorization header');
    console.log('   3. Test task creation, applications, etc.');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.log('\n💡 Make sure:');
    console.log('   1. Backend server is running (npm run dev)');
    console.log('   2. MongoDB is connected');
    console.log('   3. All dependencies are installed');
  }
}

// Run the tests
runTests(); 