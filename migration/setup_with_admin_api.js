
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Charger les variables d'environnement (URL seulement, on hardcode la clé pour ce script admin)
dotenv.config({ path: path.resolve(process.cwd(), 'app-admin/.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdtd3hjd3ZrbmxueWRhYWp2bG93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg1MjY4MSwiZXhwIjoyMDg2NDI4NjgxfQ.ziKvmKjy87rGYzSXI4MQFK0Iq0QUdB3Dv-2t3I_z5UE';

if (!supabaseUrl) {
  console.error('Missing Supabase URL');
  process.exit(1);
}

// Client Admin (Service Role) - contourne RLS et permet la gestion des users
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setupTestEnvironment() {
  console.log('--- CONFIGURATION ENVIRONNEMENT DE TEST (VIA ADMIN API) ---');

  // 1. Créer l'établissement de test (directement en base)
  console.log('1. Gestion de l\'établissement "Etablissement Test"...');
  
  let etabId;
  const { data: existingEtab, error: searchError } = await supabaseAdmin
    .from('etablissements')
    .select('id')
    .eq('nom', 'Etablissement Test')
    .single();

  if (existingEtab) {
    etabId = existingEtab.id;
    console.log(`   ✅ Établissement existant trouvé: ${etabId}`);
  } else {
    // Création
    const { data: newEtab, error: createError } = await supabaseAdmin
      .from('etablissements')
      .insert({
        nom: 'Etablissement Test',
        adresse: '123 Rue Admin API',
        telephone: '+237 600000000',
        email: 'admin-api@test.com',
        statut_abonnement: 'actif',
        actif: true
      })
      .select()
      .single();
      
    if (createError) {
        console.error('❌ Erreur création établissement:', createError);
        return;
    }
    etabId = newEtab.id;
    console.log(`   ✅ Nouvel établissement créé: ${etabId}`);
  }

  // 2. Créer les utilisateurs via l'API Admin
  // NOTE: Les emails originaux (patron@test.com, etc.) sont corrompus dans la base Auth (erreur 500).
  // On utilise des versions v2 pour contourner le problème sans accès root.
  const usersToCreate = [
    { email: 'patron2@test.com', role: 'patron', nom: 'Patron', prenom: 'Test' },
    { email: 'serveuse2@test.com', role: 'serveuse', nom: 'Serveuse', prenom: 'Test' },
    { email: 'comptoir2@test.com', role: 'comptoir', nom: 'Comptoir', prenom: 'Test' },
    { email: 'gerant2@test.com', role: 'gerant', nom: 'Gerant', prenom: 'Test' }
  ];

  for (const user of usersToCreate) {
    console.log(`\n2. Gestion utilisateur ${user.email}...`);

    // 2.1 Tenter de récupérer l'utilisateur pour le supprimer proprement s'il existe (clean slate)
    // On ne peut pas facilement chercher par email via admin api sans listUsers qui est paginé.
    // On va lister tous les users (limit 100 devrait suffire pour un env de test)
    const { data: { users: allUsers }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
        console.error('Erreur listing users:', listError);
    } else {
        const existingUser = allUsers.find(u => u.email === user.email);
        if (existingUser) {
            console.log(`   ⚠️ Utilisateur existant trouvé (${existingUser.id}), suppression...`);
            const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(existingUser.id);
            if (deleteError) {
                console.error('   ❌ Erreur suppression:', deleteError);
            } else {
                console.log('   ✅ Utilisateur supprimé avec succès.');
            }
        }
    }

    // 2.2 Création propre
    const { data: createdUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: user.email,
      password: 'password123',
      email_confirm: true,
      user_metadata: {
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        etablissement_id: etabId
      }
    });

    if (createAuthError) {
      console.error(`   ❌ Erreur création Auth:`, createAuthError);
      // Log more details if available
      if (createAuthError.cause) console.error('      Cause:', createAuthError.cause);
    } else {
      console.log(`   ✅ Utilisateur Auth créé: ${createdUser.user.id}`);
      
      // Force update profile just in case trigger failed silently (Safe Mode)
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: createdUser.user.id,
          email: user.email,
          nom: user.nom,
          prenom: user.prenom,
          role: user.role,
          etablissement_id: etabId
        });
        
      if (profileError) {
         console.error(`   ⚠️ Erreur synchro profil (mais Auth OK):`, profileError);
      } else {
         console.log(`   ✅ Profil public synchronisé.`);
      }
    }
  }

  console.log('\n--- CONFIGURATION TERMINÉE ---');
  console.log('Vous pouvez maintenant vous connecter avec :');
  console.log('Email: patron@test.com (ou serveuse, comptoir, gerant)');
  console.log('Password: password123');
}

setupTestEnvironment();
