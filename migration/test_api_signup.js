
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Charger les variables d'environnement
dotenv.config({ path: path.resolve(process.cwd(), 'app-admin/.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testApiSignupAndLogin() {
  const email = `test_api_${Date.now()}@test.com`;
  const password = 'password123';

  console.log(`Tentative de création de l'utilisateur ${email} via API...`);

  // 1. SignUp
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        nom: 'TestAPI',
        prenom: 'User',
        role: 'serveuse' // On teste avec un rôle basique
      }
    }
  });

  if (signUpError) {
    console.error('Erreur SignUp:', signUpError);
    return;
  }

  console.log('SignUp réussi:', signUpData.user?.id);

  // 2. SignIn
  console.log('Tentative de connexion immédiate...');
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (signInError) {
    console.error('Erreur SignIn:', signInError);
  } else {
    console.log('SignIn réussi ! Session Token:', signInData.session?.access_token ? 'Présent' : 'Manquant');
    console.log('User ID:', signInData.user?.id);
  }
}

testApiSignupAndLogin();
