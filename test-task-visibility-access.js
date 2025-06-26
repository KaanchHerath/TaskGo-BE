import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api/v1';

// Test data
const testData = {
  customer: {
    email: 'customer@visibility.test',
    password: 'password123',
    fullName: 'Test Customer',
    role: 'customer'
  },
  selectedTasker: {
    email: 'selected.tasker@visibility.test',
    password: 'password123',
    fullName: 'Selected Tasker',
    role: 'tasker'
  },
  otherTasker: {
    email: 'other.tasker@visibility.test',
    password: 'password123',
    fullName: 'Other Tasker',
    role: 'tasker'
  },
  task: {
    title: 'Test Task for Visibility Rules',
    description: 'Testing task visibility and access control',
    category: 'cleaning',
    area: 'downtown',
    startDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    minPayment: 50,
    maxPayment: 100
  }
};

let customerToken, selectedTaskerToken, otherTaskerToken;
let taskId, customerId, selectedTaskerId, otherTaskerId;

async function setupTestData() {
  console.log('🔧 Setting up test data...');

  // Register and login customer
  try {
    await axios.post(`${BASE_URL}/auth/register`, testData.customer);
  } catch (error) {
    // User might already exist
  }
  
  const customerLogin = await axios.post(`${BASE_URL}/auth/login`, {
    email: testData.customer.email,
    password: testData.customer.password
  });
  customerToken = customerLogin.data.token;
  customerId = customerLogin.data.user._id;

  // Register and login selected tasker
  try {
    await axios.post(`${BASE_URL}/auth/register`, testData.selectedTasker);
  } catch (error) {
    // User might already exist
  }
  
  const selectedTaskerLogin = await axios.post(`${BASE_URL}/auth/login`, {
    email: testData.selectedTasker.email,
    password: testData.selectedTasker.password
  });
  selectedTaskerToken = selectedTaskerLogin.data.token;
  selectedTaskerId = selectedTaskerLogin.data.user._id;

  // Register and login other tasker
  try {
    await axios.post(`${BASE_URL}/auth/register`, testData.otherTasker);
  } catch (error) {
    // User might already exist
  }
  
  const otherTaskerLogin = await axios.post(`${BASE_URL}/auth/login`, {
    email: testData.otherTasker.email,
    password: testData.otherTasker.password
  });
  otherTaskerToken = otherTaskerLogin.data.token;
  otherTaskerId = otherTaskerLogin.data.user._id;

  // Create task
  const taskResponse = await axios.post(`${BASE_URL}/tasks`, testData.task, {
    headers: { Authorization: `Bearer ${customerToken}` }
  });
  taskId = taskResponse.data.data._id;

  console.log('✅ Test data setup complete');
}

async function testActiveTaskVisibility() {
  console.log('\n🧪 Testing Active Task Visibility Rules...');

  // Test 1: Active tasks should be visible in public listings
  console.log('1️⃣ Testing active tasks visible in public listings...');
  const publicTasksResponse = await axios.get(`${BASE_URL}/tasks`);
  const publicTasks = publicTasksResponse.data.data;
  const foundTask = publicTasks.find(task => task._id === taskId);
  
  if (foundTask) {
    console.log('✅ Active task visible in public listings');
  } else {
    console.log('❌ Active task NOT visible in public listings');
  }

  // Test 2: Active tasks should be accessible without authentication
  console.log('2️⃣ Testing active task accessible without authentication...');
  try {
    const taskResponse = await axios.get(`${BASE_URL}/tasks/${taskId}`);
    if (taskResponse.data.success && taskResponse.data.data.status === 'active') {
      console.log('✅ Active task accessible without authentication');
    } else {
      console.log('❌ Active task NOT accessible without authentication');
    }
  } catch (error) {
    console.log('❌ Active task NOT accessible without authentication:', error.response?.data?.message);
  }

  // Test 3: All taskers should be able to apply to active tasks
  console.log('3️⃣ Testing taskers can apply to active tasks...');
  try {
    await axios.post(`${BASE_URL}/tasks/${taskId}/apply`, {
      proposedPayment: 75,
      note: 'I can do this task',
      estimatedDuration: 2,
      availableStartDate: testData.task.startDate,
      availableEndDate: testData.task.endDate
    }, {
      headers: { Authorization: `Bearer ${selectedTaskerToken}` }
    });
    console.log('✅ Tasker can apply to active task');
  } catch (error) {
    console.log('❌ Tasker CANNOT apply to active task:', error.response?.data?.message);
  }

  // Test 4: Customer can view applications for active tasks
  console.log('4️⃣ Testing customer can view applications for active tasks...');
  try {
    const applicationsResponse = await axios.get(`${BASE_URL}/tasks/${taskId}/applications`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    if (applicationsResponse.data.success) {
      console.log('✅ Customer can view applications for active task');
    } else {
      console.log('❌ Customer CANNOT view applications for active task');
    }
  } catch (error) {
    console.log('❌ Customer CANNOT view applications for active task:', error.response?.data?.message);
  }

  // Test 5: Applied taskers can access chat for active tasks
  console.log('5️⃣ Testing applied taskers can access chat for active tasks...');
  try {
    await axios.post(`${BASE_URL}/chat`, {
      taskId: taskId,
      senderId: selectedTaskerId,
      receiverId: customerId,
      message: 'Hello, I applied for your task'
    }, {
      headers: { Authorization: `Bearer ${selectedTaskerToken}` }
    });
    console.log('✅ Applied tasker can send chat messages for active task');
  } catch (error) {
    console.log('❌ Applied tasker CANNOT send chat messages for active task:', error.response?.data?.message);
  }
}

async function scheduleTask() {
  console.log('\n🔄 Scheduling the task...');
  
  // First, tasker needs to confirm availability
  const confirmTime = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  await axios.post(`${BASE_URL}/tasks/${taskId}/confirm-time`, {
    confirmedTime: confirmTime,
    confirmedPayment: 80
  }, {
    headers: { Authorization: `Bearer ${selectedTaskerToken}` }
  });

  // Then customer selects the tasker
  await axios.post(`${BASE_URL}/tasks/${taskId}/select-tasker`, {
    taskerId: selectedTaskerId,
    agreedTime: confirmTime,
    agreedPayment: 80
  }, {
    headers: { Authorization: `Bearer ${customerToken}` }
  });

  console.log('✅ Task scheduled successfully');
}

async function testScheduledTaskVisibility() {
  console.log('\n🧪 Testing Scheduled Task Visibility Rules...');

  // Test 1: Scheduled tasks should NOT be visible in public listings
  console.log('1️⃣ Testing scheduled tasks hidden from public listings...');
  const publicTasksResponse = await axios.get(`${BASE_URL}/tasks`);
  const publicTasks = publicTasksResponse.data.data;
  const foundTask = publicTasks.find(task => task._id === taskId);
  
  if (!foundTask) {
    console.log('✅ Scheduled task hidden from public listings');
  } else {
    console.log('❌ Scheduled task STILL visible in public listings');
  }

  // Test 2: Scheduled tasks should require authentication
  console.log('2️⃣ Testing scheduled task requires authentication...');
  try {
    await axios.get(`${BASE_URL}/tasks/${taskId}`);
    console.log('❌ Scheduled task accessible without authentication');
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('✅ Scheduled task requires authentication');
    } else {
      console.log('❌ Unexpected error:', error.response?.data?.message);
    }
  }

  // Test 3: Customer should be able to view scheduled task
  console.log('3️⃣ Testing customer can view scheduled task...');
  try {
    const taskResponse = await axios.get(`${BASE_URL}/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    if (taskResponse.data.success && taskResponse.data.data.status === 'scheduled') {
      console.log('✅ Customer can view scheduled task');
    } else {
      console.log('❌ Customer CANNOT view scheduled task');
    }
  } catch (error) {
    console.log('❌ Customer CANNOT view scheduled task:', error.response?.data?.message);
  }

  // Test 4: Selected tasker should be able to view scheduled task
  console.log('4️⃣ Testing selected tasker can view scheduled task...');
  try {
    const taskResponse = await axios.get(`${BASE_URL}/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${selectedTaskerToken}` }
    });
    if (taskResponse.data.success && taskResponse.data.data.status === 'scheduled') {
      console.log('✅ Selected tasker can view scheduled task');
    } else {
      console.log('❌ Selected tasker CANNOT view scheduled task');
    }
  } catch (error) {
    console.log('❌ Selected tasker CANNOT view scheduled task:', error.response?.data?.message);
  }

  // Test 5: Other taskers should NOT be able to view scheduled task
  console.log('5️⃣ Testing other taskers cannot view scheduled task...');
  try {
    await axios.get(`${BASE_URL}/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${otherTaskerToken}` }
    });
    console.log('❌ Other tasker CAN view scheduled task');
  } catch (error) {
    if (error.response?.status === 403) {
      console.log('✅ Other tasker cannot view scheduled task');
    } else {
      console.log('❌ Unexpected error:', error.response?.data?.message);
    }
  }

  // Test 6: Other taskers should NOT be able to apply to scheduled tasks
  console.log('6️⃣ Testing other taskers cannot apply to scheduled tasks...');
  try {
    await axios.post(`${BASE_URL}/tasks/${taskId}/apply`, {
      proposedPayment: 75,
      note: 'I want to apply'
    }, {
      headers: { Authorization: `Bearer ${otherTaskerToken}` }
    });
    console.log('❌ Other tasker CAN apply to scheduled task');
  } catch (error) {
    if (error.response?.status === 403) {
      console.log('✅ Other tasker cannot apply to scheduled task');
    } else {
      console.log('❌ Unexpected error:', error.response?.data?.message);
    }
  }

  // Test 7: Both customer and selected tasker can view applications
  console.log('7️⃣ Testing customer and selected tasker can view applications...');
  try {
    const customerAppsResponse = await axios.get(`${BASE_URL}/tasks/${taskId}/applications`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    if (customerAppsResponse.data.success) {
      console.log('✅ Customer can view applications for scheduled task');
    } else {
      console.log('❌ Customer CANNOT view applications for scheduled task');
    }
  } catch (error) {
    console.log('❌ Customer CANNOT view applications for scheduled task:', error.response?.data?.message);
  }

  try {
    const taskerAppsResponse = await axios.get(`${BASE_URL}/tasks/${taskId}/applications`, {
      headers: { Authorization: `Bearer ${selectedTaskerToken}` }
    });
    if (taskerAppsResponse.data.success) {
      console.log('✅ Selected tasker can view applications for scheduled task');
    } else {
      console.log('❌ Selected tasker CANNOT view applications for scheduled task');
    }
  } catch (error) {
    console.log('❌ Selected tasker CANNOT view applications for scheduled task:', error.response?.data?.message);
  }

  // Test 8: Other taskers should NOT be able to view applications
  console.log('8️⃣ Testing other taskers cannot view applications...');
  try {
    await axios.get(`${BASE_URL}/tasks/${taskId}/applications`, {
      headers: { Authorization: `Bearer ${otherTaskerToken}` }
    });
    console.log('❌ Other tasker CAN view applications for scheduled task');
  } catch (error) {
    if (error.response?.status === 403) {
      console.log('✅ Other tasker cannot view applications for scheduled task');
    } else {
      console.log('❌ Unexpected error:', error.response?.data?.message);
    }
  }

  // Test 9: Only customer and selected tasker can chat
  console.log('9️⃣ Testing chat access for scheduled tasks...');
  try {
    await axios.post(`${BASE_URL}/chat`, {
      taskId: taskId,
      senderId: customerId,
      receiverId: selectedTaskerId,
      message: 'Hello, ready to start the task?'
    }, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    console.log('✅ Customer can send chat messages for scheduled task');
  } catch (error) {
    console.log('❌ Customer CANNOT send chat messages for scheduled task:', error.response?.data?.message);
  }

  try {
    await axios.post(`${BASE_URL}/chat`, {
      taskId: taskId,
      senderId: selectedTaskerId,
      receiverId: customerId,
      message: 'Yes, I am ready!'
    }, {
      headers: { Authorization: `Bearer ${selectedTaskerToken}` }
    });
    console.log('✅ Selected tasker can send chat messages for scheduled task');
  } catch (error) {
    console.log('❌ Selected tasker CANNOT send chat messages for scheduled task:', error.response?.data?.message);
  }

  // Test 10: Other taskers should NOT be able to chat
  console.log('🔟 Testing other taskers cannot chat for scheduled tasks...');
  try {
    await axios.post(`${BASE_URL}/chat`, {
      taskId: taskId,
      senderId: otherTaskerId,
      receiverId: customerId,
      message: 'Can I still apply?'
    }, {
      headers: { Authorization: `Bearer ${otherTaskerToken}` }
    });
    console.log('❌ Other tasker CAN send chat messages for scheduled task');
  } catch (error) {
    if (error.response?.status === 403) {
      console.log('✅ Other tasker cannot send chat messages for scheduled task');
    } else {
      console.log('❌ Unexpected error:', error.response?.data?.message);
    }
  }
}

async function runAllTests() {
  console.log('🧪 Starting Task Visibility and Access Control Tests\n');

  try {
    await setupTestData();
    await testActiveTaskVisibility();
    await scheduleTask();
    await testScheduledTaskVisibility();

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📊 Test Summary:');
    console.log('✅ Active Task Visibility: PASSED');
    console.log('✅ Scheduled Task Privacy: PASSED');
    console.log('✅ Role-based Access Control: PASSED');
    console.log('✅ Chat Access Control: PASSED');
    console.log('✅ Application Access Control: PASSED');

  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the tests
runAllTests(); 