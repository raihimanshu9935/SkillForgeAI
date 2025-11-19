import axios from 'axios';

const API_URL = 'http://localhost:4000/auth';

async function testAuth() {
  try {
    console.log('Testing Signup...');
    try {
      const signupRes = await axios.post(`${API_URL}/signup`, {
        name: 'Test User',
        email: `test${Date.now()}@example.com`, // Unique email
        password: 'password123'
      });
      console.log('✅ Signup successful:', signupRes.data);
    } catch (error) {
      if (error.response && error.response.status === 400 && error.response.data.message === 'User already exists') {
         console.log('⚠️ User already exists, proceeding to login...');
      } else {
         throw error;
      }
    }

    console.log('Testing Login...');
    // Use a known email for login test if signup was skipped or just use the one we tried to create
    // For simplicity, let's just try to login with the one we just created (or tried to)
    // Actually, let's just use a fixed email for the login test to be sure.
    
    // Let's create a specific user for login testing to be sure
    const loginEmail = 'login_test@example.com';
    try {
        await axios.post(`${API_URL}/signup`, {
            name: 'Login Tester',
            email: loginEmail,
            password: 'password123'
        });
    } catch (e) {} // Ignore if exists

    const loginRes = await axios.post(`${API_URL}/login`, {
      email: loginEmail,
      password: 'password123'
    });
    console.log('✅ Login successful:', loginRes.data);

  } catch (error) {
    console.error('❌ Auth test failed:', error.response ? error.response.data : error.message);
    process.exit(1);
  }
}

testAuth();
