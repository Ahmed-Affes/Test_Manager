async function probe() {
  const url = 'https://ayfwnyecpwnplbvdoexa.supabase.co';
  const key = 'sb_secret_gioQusDWALQuwaevZ3931g_JurcMSHF';

  const endpoints = [
    '/rest/v1/',
    '/auth/v1/health',
    '/storage/v1/bucket',
    '/pg/query',
    '/database/query',
    '/functions/v1/',
    '/rest/v1/rpc/'
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(url + ep, {
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`
        }
      });
      console.log(ep, '->', res.status, res.statusText);
    } catch (e) {
      console.log(ep, '-> error:', e.message);
    }
  }
}

probe();
