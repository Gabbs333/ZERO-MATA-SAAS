const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../app-serveuse/.env' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

console.log('Testing Supabase Login...');
console.log('URL:', supabaseUrl);
// Masquer la clé pour la sécurité
console.log('Key:', supabaseKey ? supabaseKey.substring(0, 10) + '...' : 'MISSING');

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
});

async function testLogin(email, password) {
  console.log(`\nAttempting login for: ${email}`);
  const start = Date.now();
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    const duration = Date.now() - start;
    console.log(`Duration: ${duration}ms`);

    if (error) {
      console.error('LOGIN FAILED ❌');
      console.error('Error:', JSON.stringify(error, null, 2));
    } else {
      console.log('LOGIN SUCCESS ✅');
      console.log('User ID:', data.user.id);
      console.log('Email:', data.user.email);
    }
  } catch (err) {
    console.error('EXCEPTION 💥');
    console.error(err);
  }
}

async function run() {
  // Test Serveuse (Fail expected?)
  await testLogin('serveuse@snackbar.cm', 'password123');
  
  // Test Patron (Should work)
  await testLogin('patron@snackbar.cm', 'password123');
  
  // Test Bad Password (Should fail with 400, not 500)
  await testLogin('serveuse@snackbar.cm', 'wrongpassword');
}

run();
