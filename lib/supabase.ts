import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://abqfziattkyzosemffgy.supabase.co';
const supabaseAnonKey = 'sb_publishable_f5mhRbwyVFqZ4DgdDUzuRQ_cTnTXgRv';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
