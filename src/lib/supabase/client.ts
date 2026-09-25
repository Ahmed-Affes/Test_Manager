import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ayfwnyecpwnplbvdoexa.supabase.co';
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'sb_publishable_3VY65otJqHRG22tLcnjMCw_JE8NCYPC';

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
