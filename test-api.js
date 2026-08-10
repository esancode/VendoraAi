async function run() {
  console.log("Registering...");
  const regRes = await fetch('http://127.0.0.1:3000/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      companyName: 'Test Corp',
      industry: 'tech',
      adminName: 'Admin',
      adminEmail: 'admin' + Date.now() + '@test.com',
      adminPhone: '1199999999',
      password: 'password123',
      confirmPassword: 'password123'
    })
  });
  console.log('Register Status:', regRes.status);
  const regData = await regRes.json().catch(() => null);
  console.log('Register Data:', regData);

  if (regRes.status !== 201) return;

  const token = regData.accessToken;

  console.log("\nTesting dashboard stats...");
  const statsRes = await fetch('http://127.0.0.1:3000/api/v1/dashboard/stats', {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Stats Status:', statsRes.status);
  console.log('Stats Data:', await statsRes.json().catch(() => null));

  console.log("\nTesting leads priority...");
  const leadsRes = await fetch('http://127.0.0.1:3000/api/v1/leads/priority', {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Leads Status:', leadsRes.status);
  console.log('Leads Data:', await leadsRes.json().catch(() => null));
}

run().catch(console.error);
