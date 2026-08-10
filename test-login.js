async function run() {
  const loginRes = await fetch('http://127.0.0.1:3000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@test.com', // Replace with the actual email from the user if needed
      password: 'password123'
    })
  });
  console.log('Login Status:', loginRes.status);
  const loginData = await loginRes.json().catch(() => null);
  console.log('Login Data:', loginData);
}
run().catch(console.error);
