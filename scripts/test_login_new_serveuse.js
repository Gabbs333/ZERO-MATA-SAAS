// TEST DE CONNEXION AVEC LE NOUVEAU COMPTE SERVEUSE
// Ce script teste la connexion avec le compte serveuse.test@snackbar.cm
// pour vérifier si le problème est spécifique à l'email serveuse@snackbar.cm

const { createClient } = require('@supabase/supabase-js');

// Clés extraites de app-serveuse/.env
const SUPABASE_URL = 'https://wgzbpgauajgxkxoezlqw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnemJwZ2F1YWpneGt4b2V6bHF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MzY1NDMsImV4cCI6MjA4NDUxMjU0M30.L7bhsOoX40pZcVq2WcqjSnLm5tcbIckPudIOgEg4aX4';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false
  }
});

async function runTest() {
  console.log('--- TEST DE CONNEXION AVEC NOUVEAU COMPTE ---');
  console.log('Utilisateur cible : serveuse.test@snackbar.cm');
  console.log('Mot de passe : même que serveuse@snackbar.cm (password123)');
  
  // Test avec le NOUVEL email
  console.log('\n🔄 Tentative de connexion avec serveuse.test@snackbar.cm...');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'serveuse.test@snackbar.cm',
    password: 'password123'
  });

  if (error) {
    console.error('❌ ÉCHEC :', error.status, error.message);
    
    if (error.status === 500) {
      console.log('\n🚨 DIAGNOSTIC : L\'erreur 500 persiste même avec un nouvel email !');
      console.log('Cela confirme que le problème n\'est PAS spécifique à serveuse@snackbar.cm');
      console.log('Le problème est systémique dans la base de données ou les triggers système.');
      console.log('\n💡 SOLUTION : Le support Supabase doit investiguer côté serveur.');
    } else if (error.message.includes('Invalid login credentials')) {
      console.log('\n✅ BONNE NOUVELLE : Le serveur répond correctement !');
      console.log('L\'erreur est juste un mauvais mot de passe.');
      console.log('Le problème 500 semble résolu !');
    }
  } else {
    console.log('🎉 SUCCÈS ! Connexion réussie avec le nouvel email !');
    console.log('Session ID:', data.session?.user.id);
    console.log('\n✅ Le problème était spécifique à serveuse@snackbar.cm');
    console.log('Le nouveau compte fonctionne parfaitement !');
  }
}

runTest();