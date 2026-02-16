const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://wgzbpgauajgxkxoezlqw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnemJwZ2F1YWpneGt4b2V6bHF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MzY1NDMsImV4cCI6MjA4NDUxMjU0M30.L7bhsOoX40pZcVq2WcqjSnLm5tcbIckPudIOgEg4aX4';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runTest() {
  const email = `test_${Date.now()}@snackbar.cm`;
  const password = 'password123';

  console.log(`--- TEST SIGNUP ---`);
  console.log(`Tentative de création d'un nouvel utilisateur : ${email}`);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    console.error('❌ SIGNUP ÉCHOUÉ :', error.status, error.message);
  } else {
    console.log('✅ SIGNUP RÉUSSI !');
    console.log('User ID:', data.user?.id);
    
    // Si le signup marche, est-ce que le login marche ?
    // (Note: Si confirmation email requise, le login échouera peut-être, mais avec une autre erreur)
  }
}

runTest();
