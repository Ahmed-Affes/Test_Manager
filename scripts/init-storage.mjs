import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ayfwnyecpwnplbvdoexa.supabase.co';
const supabaseKey = 'sb_secret_gioQusDWALQuwaevZ3931g_JurcMSHF';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testStorage() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  console.log('Buckets:', buckets, error);

  if (!buckets?.some(b => b.name === 'evidence')) {
    console.log('Creating "evidence" bucket...');
    const { data, error: createErr } = await supabase.storage.createBucket('evidence', {
      public: false,
      fileSizeLimit: 52428800 // 50MB
    });
    console.log('Bucket created:', data, createErr);
  }
}

testStorage();
