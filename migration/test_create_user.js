
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://gmwxcwvknlnydaajvlow.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCreateUser() {
  const email = `test_debug_${Date.now()}@example.com`;
  console.log(`Attempting to create user: ${email}`);

  const { data, error } = await supabase.auth.admin.createUser({
    email: email,
    password: 'Password123!',
    email_confirm: true,
    user_metadata: {
      nom: 'Debug',
      prenom: 'User',
      role: 'serveuse',
      etablissement_id: 'e0000000-0000-0000-0000-000000000001'
    }
  });

  if (error) {
    console.error('❌ Error creating user:', error);
  } else {
    console.log('✅ User created successfully:', data.user.id);
    
    // Check profile
    const { data: profile, error: profError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();
      
    if (profError) {
      console.error('❌ Profile not found or error:', profError);
    } else {
      console.log('✅ Profile created:', profile);
    }
  }
}

testCreateUser();
