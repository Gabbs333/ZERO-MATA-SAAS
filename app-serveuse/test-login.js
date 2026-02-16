const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testLogin() {
  console.log('--- TEST START ---');
  
  // Test 1: Health Check via RPC (if function exists)
  console.log('\n1. Testing DB Connection via RPC (health_check)...');
  const { data: health, error: healthError } = await supabase.rpc('health_check');
  if (healthError) {
    console.log('⚠️ Health Check RPC failed (function might not exist yet):', healthError.message);
  } else {
    console.log('✅ Health Check passed:', health);
  }

  // Test 2: SignUp with VALID email (gmail.com) to test WRITE
  const validEmail = `test.serveuse.${Date.now()}@gmail.com`;
  console.log(`\n2. Testing SignUp with VALID email (${validEmail})...`);
  
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: validEmail,
    password: 'password123',
    options: {
      data: {
        role: 'serveuse',
        nom: 'Test',
        prenom: 'Serveuse'
      }
    }
  });

  if (signUpError) {
    console.log('❌ SignUp Result:', signUpError.message);
    if (signUpError.message.includes('Database error')) {
      console.log('   -> CONFIRMED: INSERT/Trigger issue on auth.users or profiles.');
    }
  } else {
    console.log('✅ SignUp SUCCESS! User created.');
    console.log('   -> WRITE operations are working. Triggers seem OK for INSERT.');
  }

  // Test 3: SignIn with the JUST CREATED user (if SignUp worked)
  if (!signUpError && signUpData.user) {
    console.log('\n3. Testing SignIn with the NEW user...');
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: validEmail,
      password: 'password123',
    });
    
    if (signInError) {
      console.log('❌ SignIn Result:', signInError.message);
      if (signInError.message.includes('Database error')) {
        console.log('   -> CONFIRMED: UPDATE Trigger issue on auth.users (last_sign_in_at).');
      }
    } else {
      console.log('✅ SignIn SUCCESS!');
    }
  } else {
    // Test 3b: Try generic login if SignUp failed
    console.log('\n3b. Testing Login with fake credentials...');
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: 'serveuse@snackbar.cm',
      password: 'wrongpassword',
    });
    console.log('SignIn Result:', signInError ? signInError.message : 'Success');
  }

  console.log('\n--- TEST END ---');
}

testLogin();
