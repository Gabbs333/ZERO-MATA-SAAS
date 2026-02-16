
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from app-admin .env since it has the correct URL
dotenv.config({ path: path.resolve(process.cwd(), 'app-admin/.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY; // Using Anon key for public checks

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkState() {
  console.log('Checking DB State after Setup...');

  // 1. Check Etablissements
  const { data: etablissements, error: etabError } = await supabase
    .from('etablissements')
    .select('id, nom, statut_abonnement');

  if (etabError) {
    console.error('Error checking etablissements:', etabError.message);
  } else {
    console.log(`\n--- Etablissements (${etablissements ? etablissements.length : 0}) ---`);
    if (etablissements && etablissements.length > 0) {
      console.log(JSON.stringify(etablissements, null, 2));
    } else {
      console.log('No etablissement found.');
    }
  }
  
  // 2. Check Profiles for Test Users
  const testEmails = ['patron@test.com', 'serveuse@test.com', 'comptoir@test.com', 'admin@test.com'];
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, role, etablissement_id')
    .in('email', testEmails);

  if (profileError) {
    console.error('Error checking profiles:', profileError.message);
  } else {
    console.log(`\n--- Test Profiles Found (${profiles ? profiles.length : 0}) ---`);
    if (profiles && profiles.length > 0) {
      console.log(JSON.stringify(profiles, null, 2));
      
      // Verification logic
      const missing = testEmails.filter(email => !profiles.find(p => p.email === email));
      if (missing.length > 0) {
        console.log(`\n⚠️ Missing profiles for: ${missing.join(', ')}`);
        if (missing.includes('admin@test.com')) {
             console.log('   (Note: admin@test.com was skipped as requested)');
        }
      } else {
        console.log('\n✅ All test profiles are present.');
      }
    } else {
      console.log('No test profiles found.');
    }
  }
}

checkState();
