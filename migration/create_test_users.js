const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Charger les variables d'environnement depuis app-admin
// On suppose que app-admin a les bonnes clés (URL et ANON KEY)
dotenv.config({ path: path.resolve(process.cwd(), '../app-admin/.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Erreur: Variables d\'environnement manquantes (VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY).');
  console.error('Assurez-vous que app-admin/.env contient ces valeurs.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTestUsers() {
  console.log('--- CRÉATION DES UTILISATEURS DE TEST ---');

  // 1. Récupérer l'ID de l'établissement de test
  console.log('1. Recherche de l\'établissement "Etablissement Test"...');
  const { data: etab, error: etabError } = await supabase
    .from('etablissements')
    .select('id')
    .eq('nom', 'Etablissement Test')
    .single();

  if (etabError || !etab) {
    console.error('❌ Erreur: Impossible de trouver "Etablissement Test".');
    console.error('   Veuillez d\'abord exécuter le script SQL "migration/seed_test_establishment.sql" dans Supabase.');
    console.error('   Détail erreur:', etabError ? etabError.message : 'Aucun résultat');
    return;
  }

  console.log(`✅ Établissement trouvé: ${etab.id}`);

  // 2. Liste des utilisateurs à créer
  // On utilise un timestamp pour rendre les emails uniques si on relance le script plusieurs fois
  // ou on garde des emails fixes pour la simplicité (mais attention aux erreurs "User already registered")
  // Ici on va utiliser des emails fixes pour faciliter les tests, mais on gère l'erreur.
  
  const users = [
    { 
      email: 'patron@test.com', 
      password: 'password123', 
      role: 'patron', 
      nom: 'Patron', 
      prenom: 'Test',
      etablissement_id: etab.id 
    },
    { 
      email: 'serveuse@test.com', 
      password: 'password123', 
      role: 'serveuse', 
      nom: 'Serveuse', 
      prenom: 'Test',
      etablissement_id: etab.id 
    },
    { 
      email: 'comptoir@test.com', 
      password: 'password123', 
      role: 'comptoir', 
      nom: 'Comptoir', 
      prenom: 'Test',
      etablissement_id: etab.id 
    },
    { 
      email: 'gerant@test.com', 
      password: 'password123', 
      role: 'gerant', 
      nom: 'Gerant', 
      prenom: 'Test',
      etablissement_id: etab.id 
    }
  ];

  // 3. Création des utilisateurs via SignUp (Trigger créera le profil)
  for (const user of users) {
    console.log(`\nCréation de ${user.email} (Role: ${user.role})...`);
    
    // Tenter de se connecter d'abord pour voir s'il existe
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: user.password
    });

    if (signInData.user) {
      console.log(`ℹ️ L'utilisateur existe déjà (ID: ${signInData.user.id}).`);
      // Vérifier le profil
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', signInData.user.id)
        .single();
        
      if (profile) {
        console.log(`   Profil existant: Role=${profile.role}, Etab=${profile.etablissement_id}`);
        if (profile.etablissement_id !== etab.id) {
            console.warn(`   ⚠️ ATTENTION: L'utilisateur est lié à un autre établissement (${profile.etablissement_id})`);
        }
      } else {
        console.warn(`   ⚠️ Profil manquant pour cet utilisateur.`);
      }
      continue;
    }

    // Si n'existe pas, on le crée
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: user.email,
      password: user.password,
      options: {
        data: {
          role: user.role,
          nom: user.nom,
          prenom: user.prenom,
          etablissement_id: user.etablissement_id
        }
      }
    });

    if (signUpError) {
      console.error(`❌ Erreur création ${user.email}:`, signUpError.message);
    } else if (signUpData.user) {
      console.log(`✅ Utilisateur créé avec succès (ID: ${signUpData.user.id})`);
      
      // Petite pause pour laisser le temps au trigger
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', signUpData.user.id)
        .single();

      if (profile) {
        console.log(`   -> Profil validé: ${profile.nom} ${profile.prenom} (${profile.role})`);
      } else {
        console.error(`   -> ❌ Erreur: Le profil n'a pas été créé automatiquement via le trigger.`);
        if (profileError) console.error('      Détail:', profileError.message);
      }
    }
  }

  console.log('\n--- FIN DU SCRIPT ---');
}

createTestUsers();
