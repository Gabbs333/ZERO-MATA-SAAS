const { createClient } = require('@supabase/supabase-js');

// Clés extraites de app-serveuse/.env
const SUPABASE_URL = 'https://wgzbpgauajgxkxoezlqw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnemJwZ2F1YWpneGt4b2V6bHF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MzY1NDMsImV4cCI6MjA4NDUxMjU0M30.L7bhsOoX40pZcVq2WcqjSnLm5tcbIckPudIOgEg4aX4';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false // Pas besoin de persistance pour ce test
  }
});

async function runTest() {
  console.log('--- TEST DE CONNEXION DIRECT ---');
  console.log('Utilisateur cible : serveuse@snackbar.cm');
  
  // Test 0: SUPPRIMÉ POUR ÉVITER LE SPAM MAIL (et l'erreur 429)
  // Le test se concentre uniquement sur la connexion (signIn) qui ne déclenche pas d'envoi d'email
  // sauf si confirmation requise, mais ici on teste la création de session.
  
  // Tentative 1 : Connexion utilisateur existant
  console.log('\nTentative de connexion avec "password123" (serveuse)...');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'serveuse@snackbar.cm',
    password: 'password123'
  });

  if (error) {
    console.error('❌ ÉCHEC :', error.status, error.message);
    
    if (error.status === 500 || error.message.includes('unexpected_failure')) {
      console.log('\n🚨 DIAGNOSTIC : ERREUR 500 CONFIRMÉE');
      console.log('Cela confirme que le serveur bloque l\'écriture de la session.');
      console.log('CAUSE PROBABLE : RLS activé sur auth.users ou auth.sessions.');
      console.log('SOLUTION : Exécuter le script "disable_auth_rls_final.sql" dans Supabase.');
    } else if (error.message.includes('Invalid login credentials')) {
      console.log('\n⚠️ Mauvais mot de passe (mais le serveur répond !).');
      console.log('Cela signifie que le RLS/Triggers ne plantent PAS la vérification du mot de passe,');
      console.log('mais pourraient planter l\'étape suivante (création session).');
      console.log('Essayez de réinitialiser le mot de passe ou donnez le bon mot de passe.');
    }
  } else {
    console.log('✅ SUCCÈS ! Connexion réussie.');
    console.log('Session ID:', data.session?.user.id);
    console.log('Le problème est RÉSOLU.');
  }
}

runTest();
