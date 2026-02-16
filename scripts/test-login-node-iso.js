const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../app-serveuse/.env' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// On utilise une configuration MINIMALE pour isoler le problème
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
});

async function testLogin(email, password) {
  console.log(`\n--------------------------------------------------`);
  console.log(`TEST LOGIN: ${email}`);
  console.log(`Password: ${password === 'password123' ? 'CORRECT' : 'WRONG'}`);
  
  const start = Date.now();
  
  try {
    // On appelle UNIQUEMENT l'API d'authentification
    // Pas de requête vers profiles, pas de logique métier.
    // Juste Auth.
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    const duration = Date.now() - start;
    console.log(`Durée: ${duration}ms`);

    if (error) {
      console.log('RÉSULTAT: ÉCHEC ❌');
      console.log('Status:', error.status);
      console.log('Code:', error.code || 'N/A');
      console.log('Name:', error.name);
      console.log('Message:', error.message);
      
      // Si c'est une 500, c'est un crash serveur (BDD/Edge Function)
      // Si c'est une 400, c'est une erreur client (Mauvais mot de passe)
    } else {
      console.log('RÉSULTAT: SUCCÈS ✅');
      console.log('User ID:', data.user.id);
    }
  } catch (err) {
    console.log('EXCEPTION CRITIQUE 💥');
    console.error(err);
  }
}

async function run() {
  // 1. Test avec le compte qui marche (Patron)
  await testLogin('patron@snackbar.cm', 'password123');
  
  // 2. Test avec le compte qui plante (Serveuse) - Mot de passe CORRECT
  await testLogin('serveuse@snackbar.cm', 'password123');

  // 3. Test avec le compte qui plante (Serveuse) - Mot de passe INCORRECT
  // Si ça renvoie 500, c'est que le crash arrive AVANT la vérification du mot de passe
  await testLogin('serveuse@snackbar.cm', 'wrongpassword');
}

run();
