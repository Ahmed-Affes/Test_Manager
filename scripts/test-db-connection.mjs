import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ayfwnyecpwnplbvdoexa.supabase.co';
const supabaseKey = 'sb_secret_gioQusDWALQuwaevZ3931g_JurcMSHF';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('Testing Supabase connectivity...');
  try {
    const { data, error } = await supabase.from('projects').select('count', { count: 'exact' });
    if (error) {
      console.log('Query "projects" result code:', error.code, error.message);
    } else {
      console.log('Successfully queried "projects" table! Count:', data);
    }
  } catch (err) {
    console.error('Connection error:', err);
  }
}

check();
