import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api/v1';

// Test data
const testData = {
  availableTasker: {
    email: 'available.tasker@test.com',
    password: 'Test123!@#',
    fullName: 'Available Tasker',
    phone: '+1234567890',
    role: 'tasker',
    country: 'Canada',
    area: 'Toronto',
    skills: ['Cleaning', 'Home Maintenance'],
    idDocument: 'test-id.pdf',
    qualificationDocuments: ['test-qual.pdf']
  },
  unavailableTasker: {
    email: 'unavailable.tasker@test.com',
    password: 'Test123!@#',
    fullName: 'Unavailable Tasker',
    phone: '+1234567891',
    role: 'tasker',
    country: 'Canada',
    area: 'Toronto',
    skills: ['Plumbing', 'Electrical'],
    idDocument: 'test-id.pdf',
    qualificationDocuments: ['test-qual.pdf']
  }
};

async function createTasker(taskerData) {
  try {
    const response = await axios.post(`${BASE_URL}/auth/register`, taskerData);
    return response.data;
  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.message?.includes('already exists')) {
      console.log(`Tasker ${taskerData.email} already exists, attempting login...`);
      const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
        email: taskerData.email,
        password: taskerData.password
      });
      return loginResponse.data;
    }
    throw error;
  }
}

async function updateTaskerAvailability(token, isAvailable) {
  try {
    const response = await axios.put(
      `${BASE_URL}/taskers/availability`,
      { isAvailable },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error updating availability:', error.response?.data || error.message);
    throw error;
  }
}

async function getAllTaskers() {
  try {
    const response = await axios.get(`${BASE_URL}/taskers`);
    return response.data;
  } catch (error) {
    console.error('Error fetching taskers:', error.response?.data || error.message);
    throw error;
  }
}

async function getTopRatedTaskers() {
  try {
    const response = await axios.get(`${BASE_URL}/taskers/top-rated`);
    return response.data;
  } catch (error) {
    console.error('Error fetching top rated taskers:', error.response?.data || error.message);
    throw error;
  }
}

async function runAvailabilityTest() {
  console.log('🧪 Testing Tasker Availability Filtering...\n');

  try {
    // Step 1: Create two taskers
    console.log('📝 Step 1: Creating test taskers...');
    const availableTaskerAuth = await createTasker(testData.availableTasker);
    const unavailableTaskerAuth = await createTasker(testData.unavailableTasker);
    
    console.log('✅ Available tasker created/logged in');
    console.log('✅ Unavailable tasker created/logged in');

    // Step 2: Set availability status
    console.log('\n📝 Step 2: Setting availability status...');
    
    // Set first tasker as available (default should be true, but let's be explicit)
    await updateTaskerAvailability(availableTaskerAuth.token, true);
    console.log('✅ Available tasker set to available');
    
    // Set second tasker as unavailable
    await updateTaskerAvailability(unavailableTaskerAuth.token, false);
    console.log('✅ Unavailable tasker set to unavailable');

    // Step 3: Test getAllTaskers endpoint
    console.log('\n📝 Step 3: Testing getAllTaskers endpoint...');
    const allTaskers = await getAllTaskers();
    
    console.log(`📊 Total taskers returned: ${allTaskers.data.length}`);
    
    // Check if only available taskers are returned
    const availableTaskerFound = allTaskers.data.find(t => t.email === testData.availableTasker.email);
    const unavailableTaskerFound = allTaskers.data.find(t => t.email === testData.unavailableTasker.email);
    
    if (availableTaskerFound) {
      console.log('✅ Available tasker is visible in the list');
    } else {
      console.log('❌ Available tasker is NOT visible in the list');
    }
    
    if (!unavailableTaskerFound) {
      console.log('✅ Unavailable tasker is correctly hidden from the list');
    } else {
      console.log('❌ Unavailable tasker is incorrectly visible in the list');
    }

    // Step 4: Test getTopRatedTaskers endpoint
    console.log('\n📝 Step 4: Testing getTopRatedTaskers endpoint...');
    const topTaskers = await getTopRatedTaskers();
    
    console.log(`📊 Total top-rated taskers returned: ${topTaskers.data.length}`);
    
    const availableInTop = topTaskers.data.find(t => t.email === testData.availableTasker.email);
    const unavailableInTop = topTaskers.data.find(t => t.email === testData.unavailableTasker.email);
    
    if (!unavailableInTop) {
      console.log('✅ Unavailable tasker is correctly hidden from top-rated list');
    } else {
      console.log('❌ Unavailable tasker is incorrectly visible in top-rated list');
    }

    // Step 5: Verify availability status in tasker profiles
    console.log('\n📝 Step 5: Checking availability status in profiles...');
    allTaskers.data.forEach(tasker => {
      const isAvailable = tasker.taskerProfile?.isAvailable;
      if (isAvailable === true) {
        console.log(`✅ Tasker ${tasker.fullName} has isAvailable: true`);
      } else {
        console.log(`❌ Tasker ${tasker.fullName} has isAvailable: ${isAvailable}`);
      }
    });

    console.log('\n🎉 Availability filtering test completed!');
    
    // Summary
    console.log('\n📋 SUMMARY:');
    console.log(`- Available taskers visible: ${availableTaskerFound ? 'YES' : 'NO'}`);
    console.log(`- Unavailable taskers hidden: ${!unavailableTaskerFound ? 'YES' : 'NO'}`);
    console.log(`- Top-rated filtering works: ${!unavailableInTop ? 'YES' : 'NO'}`);
    
    const allTestsPassed = availableTaskerFound && !unavailableTaskerFound && !unavailableInTop;
    console.log(`\n${allTestsPassed ? '✅ ALL TESTS PASSED!' : '❌ SOME TESTS FAILED!'}`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
runAvailabilityTest(); 