async function testManagement() {
  const token = 'sb_secret_gioQusDWALQuwaevZ3931g_JurcMSHF';
  const projectRef = 'ayfwnyecpwnplbvdoexa';

  console.log('Testing Management API /v1/projects/' + projectRef);
  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: 'SELECT 1 as test;'
      })
    });
    console.log('Status:', res.status, res.statusText);
    const text = await res.text();
    console.log('Response:', text);
  } catch (err) {
    console.error('Error:', err);
  }
}

testManagement();
