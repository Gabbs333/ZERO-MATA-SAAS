
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Charger les variables d'environnement
dotenv.config({ path: path.resolve(process.cwd(), 'app-admin/.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdtd3hjd3ZrbmxueWRhYWp2bG93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg1MjY4MSwiZXhwIjoyMDg2NDI4NjgxfQ.KyP1JgO2F5vDqO3n5jQ4w7k6q3r8t9y0u1i2o3p4a5s'; // Je dois récupérer la clé service_role des core memories ou demander à l'utilisateur, mais ici j'utilise l'anon key pour simuler le client, et je vais essayer de lire profiles.

// Pour vérifier la base, il vaut mieux utiliser le service role si possible, 
// mais je n'ai pas la service role key sous la main dans le fichier .env (c'est l'anon key).
// Je vais utiliser l'anon key et voir si je peux lire. RLS est désactivé donc ça devrait aller.

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProfiles() {
  console.log('--- Vérification des profils ---');
  
  // 1. Lister les users dans auth (impossible avec anon key côté client généralement, sauf si on a une fonction RPC ou si on est admin)
  // On va supposer qu'on ne peut pas lister auth.users facilement avec le client JS standard sans service role.
  // Mais on peut essayer de se connecter avec un user de test.

  // 2. Vérifier la table profiles
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*');

  if (error) {
    console.error('Erreur lecture profiles:', error);
  } else {
    console.log(`Nombre de profils trouvés: ${profiles.length}`);
    console.log(profiles);
  }

  // 3. Tenter un login
  console.log('\n--- Test de Login Patron ---');
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: 'patron2@test.com',
    password: 'password123'
  });

  if (loginError) {
    console.error('Erreur Login:', loginError);
  } else {
    console.log('Login réussi ! Session User ID:', loginData.user.id);
    
    // Si login réussi, on essaie de lire son propre profil
    const { data: myProfile, error: myProfileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', loginData.user.id)
        .single();
    
    if (myProfileError) {
        console.error('Erreur lecture mon profil après login:', myProfileError);
    } else {
        console.log('Mon profil récupéré:', myProfile);
    }
  }
}

checkProfiles();
