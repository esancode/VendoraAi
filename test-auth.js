async function runTests() {
  const baseUrl = 'http://localhost:3000/api/v1';

  try {
    console.log('1. Testing registration...');
    let res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: 'Test Corp',
        adminName: 'Admin',
        adminEmail: 'admin.test@vendora.ai',
        password: 'password123'
      })
    });
    const data = await res.json();
    console.log('Registration OK:', res.status, data);

    // Rate Limit Test
    console.log('2. Testing rate limiting & lockouts (10 bad logins)...');
    for (let i = 0; i < 11; i++) {
      let loginRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin.test@vendora.ai', password: 'wrong' })
      });
      const loginData = await loginRes.json();
      console.log(`Attempt ${i+1}: ${loginRes.status} - ${loginData.message}`);
    }
  } catch (err) {
    console.error('Test failed:', err);
  }
}

runTests();
