import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api/v1';

// Test the availability toggle functionality
async function testAvailabilityToggle() {
  console.log('🧪 Testing Tasker Availability Toggle...\n');

  try {
    // Step 1: Login as a tasker
    console.log('📝 Step 1: Logging in as a tasker...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'available.tasker@test.com',
      password: 'Test123!@#'
    });

    if (!loginResponse.data.success) {
      throw new Error('Login failed');
    }

    const token = loginResponse.data.token;
    console.log('✅ Login successful');

    // Step 2: Test setting availability to false
    console.log('\n📝 Step 2: Setting availability to false...');
    const setUnavailableResponse = await axios.put(
      `${BASE_URL}/taskers/availability`,
      { isAvailable: false },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (setUnavailableResponse.data.success) {
      console.log('✅ Availability set to false successfully');
      console.log(`   Current status: ${setUnavailableResponse.data.data.taskerProfile.isAvailable}`);
    } else {
      throw new Error('Failed to set availability to false');
    }

    // Step 3: Check if tasker appears in public listing
    console.log('\n📝 Step 3: Checking public tasker listing...');
    const publicListingResponse = await axios.get(`${BASE_URL}/taskers`);
    const taskerInListing = publicListingResponse.data.data.find(
      t => t.email === 'available.tasker@test.com'
    );

    if (!taskerInListing) {
      console.log('✅ Tasker correctly hidden from public listing when unavailable');
    } else {
      console.log('❌ Tasker still visible in public listing when unavailable');
    }

    // Step 4: Test setting availability to true
    console.log('\n📝 Step 4: Setting availability to true...');
    const setAvailableResponse = await axios.put(
      `${BASE_URL}/taskers/availability`,
      { isAvailable: true },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (setAvailableResponse.data.success) {
      console.log('✅ Availability set to true successfully');
      console.log(`   Current status: ${setAvailableResponse.data.data.taskerProfile.isAvailable}`);
    } else {
      throw new Error('Failed to set availability to true');
    }

    // Step 5: Check if tasker appears in public listing again
    console.log('\n📝 Step 5: Checking public tasker listing again...');
    const publicListingResponse2 = await axios.get(`${BASE_URL}/taskers`);
    const taskerInListing2 = publicListingResponse2.data.data.find(
      t => t.email === 'available.tasker@test.com'
    );

    if (taskerInListing2) {
      console.log('✅ Tasker correctly visible in public listing when available');
    } else {
      console.log('❌ Tasker not visible in public listing when available');
    }

    console.log('\n🎉 Availability toggle test completed!');
    
    // Summary
    console.log('\n📋 SUMMARY:');
    console.log(`- API toggle to unavailable: ${setUnavailableResponse.data.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`- Hidden when unavailable: ${!taskerInListing ? 'SUCCESS' : 'FAILED'}`);
    console.log(`- API toggle to available: ${setAvailableResponse.data.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`- Visible when available: ${taskerInListing2 ? 'SUCCESS' : 'FAILED'}`);

    const allTestsPassed = setUnavailableResponse.data.success && 
                          !taskerInListing && 
                          setAvailableResponse.data.success && 
                          taskerInListing2;
    
    console.log(`\n${allTestsPassed ? '✅ ALL TESTS PASSED!' : '❌ SOME TESTS FAILED!'}`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testAvailabilityToggle(); 