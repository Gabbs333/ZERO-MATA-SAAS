import { createClient, createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

// Edge Function URL for patron-invite-staff
const patronInviteStaffUrl = import.meta.env.VITE_PATRON_INVITE_STAFF_URL 
  || `${supabaseUrl}/functions/v1/patron-invite-staff`;

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn(
    'Supabase credentials not found in .env. Using default local Supabase values. Please create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for production.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Export the Edge Function URL for use in other components
export { patronInviteStaffUrl };
