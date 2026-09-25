async function inspectSchema() {
  const url = 'https://ayfwnyecpwnplbvdoexa.supabase.co/rest/v1/';
  const key = 'sb_secret_gioQusDWALQuwaevZ3931g_JurcMSHF';

  const res = await fetch(url, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });

  const spec = await res.json();
  console.log('OpenAPI definitions:', Object.keys(spec.definitions || {}));
  console.log('OpenAPI paths:', Object.keys(spec.paths || {}));
}

inspectSchema();
