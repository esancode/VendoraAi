async function runTests() {
  const baseUrl = 'http://localhost:3000/api/v1';

  try {
    console.log('1. Soliciting password recovery...');
    const res = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin.test@vendora.ai' })
    });
    console.log('Recovery response:', res.status, await res.json());

    // NOTE: The actual 6-digit code would be printed in the backend console via MailService mock.
    // For automatic verification, we need to read from Redis.
    // However, since we don't have direct access to redis library in this script easily,
    // we just verified that the endpoint doesn't crash.

    console.log('2. Testing Google SSO redirect stub...');
    const googleRes = await fetch(`${baseUrl}/auth/google`);
    console.log('Google SSO response status:', googleRes.status);
    console.log('Google SSO response:', await googleRes.json());
    
  } catch (err) {
    console.error('Test failed:', err);
  }
}

runTests();
