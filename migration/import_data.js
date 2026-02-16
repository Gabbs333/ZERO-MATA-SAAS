
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Load .env from root (optional, if user updates it with new credentials)
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const DATA_FILE = path.join(__dirname, 'data.json');

// Order matters for FK constraints
const IMPORT_ORDER = [
  'etablissements',
  'profiles',
  'produits',
  'stock',
  'tables',
  'commandes',
  'commande_items',
  'ravitaillements',
  'ravitaillement_items',
  'factures',
  'encaissements',
  'mouvements_stock',
  'audit_logs'
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

// Helper to map column names from old schema (JSON) to new schema
function transformRow(table, row) {
  const newRow = { ...row };

  // Common mappings
  if (newRow.created_at && !newRow.date_creation) {
    newRow.date_creation = newRow.created_at;
    delete newRow.created_at;
  }
  
  // Table specific mappings
  switch (table) {
    case 'profiles':
      if (newRow.updated_at) {
        // If updated_at exists, maybe map to derniere_connexion or just delete if not relevant
        // The schema has derniere_connexion, but updated_at might be different.
        // Let's keep it if possible, but schema doesn't have updated_at.
        delete newRow.updated_at;
      }
      break;
      
    case 'produits':
      if (newRow.updated_at) {
        newRow.date_modification = newRow.updated_at;
        delete newRow.updated_at;
      }
      break;
      
    case 'stock':
      if (newRow.updated_at) {
        newRow.derniere_mise_a_jour = newRow.updated_at;
        delete newRow.updated_at;
      }
      break;
      
    case 'tables':
      if (newRow.updated_at) {
        newRow.derniere_mise_a_jour = newRow.updated_at;
        delete newRow.updated_at;
      }
      break;
      
    case 'commandes':
      // Check if validation date needs mapping
      break;

    case 'factures':
      if (newRow.created_at && !newRow.date_generation) {
        newRow.date_generation = newRow.created_at;
        delete newRow.created_at;
      }
      break;
      
    case 'encaissements':
      if (newRow.created_at && !newRow.date_encaissement) {
        newRow.date_encaissement = newRow.created_at;
        delete newRow.created_at;
      }
      break;
  }
  
  return newRow;
}

async function importData() {
  console.log('--- IMPORT DE DONNÉES VERS NOUVEAU PROJET SUPABASE ---');
  
  if (!fs.existsSync(DATA_FILE)) {
    console.error(`Fichier de données introuvable: ${DATA_FILE}`);
    process.exit(1);
  }
  
  const rawData = fs.readFileSync(DATA_FILE, 'utf8');
  const allData = JSON.parse(rawData);
  
  const supabaseUrl = process.env.SUPABASE_URL || await ask('Entrez NOUVEAU SUPABASE_URL: ');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || await ask('Entrez NOUVEAU SUPABASE_SERVICE_ROLE_KEY: ');

  if (!supabaseUrl || !serviceKey) {
    console.error('URL et Clé requises.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // 0. Build Profile Map for quick lookup
  const profiles = allData.profiles || [];
  const profileMap = {};
  profiles.forEach(p => profileMap[p.id] = p);

  // 1. Import Etablissements FIRST (needed for profiles trigger)
  const etablissementsData = allData['etablissements'];
  if (etablissementsData && etablissementsData.length > 0) {
     console.log(`\n📦 Importing etablissements (${etablissementsData.length} rows) BEFORE users...`);
     const { error } = await supabase
        .from('etablissements')
        .upsert(etablissementsData.map(r => transformRow('etablissements', r)), { onConflict: 'id' });
     
     if (error) {
       console.error(`   ❌ Error importing etablissements: ${error.message}`);
     } else {
       console.log('   ✅ Etablissements imported.');
     }
  }

  // 2. Recreate Users (if available) or generate from profiles
  let usersToCreate = allData.auth_users || [];
  const generatedEmails = {}; // Map id -> email

  if (usersToCreate.length === 0 && profiles.length > 0) {
    console.warn('\n⚠️ Aucune donnée auth.users trouvée. Génération d\'utilisateurs placeholder basés sur les profils...');
    usersToCreate = profiles.map(p => {
      const placeholderEmail = `restored_${p.id.substring(0, 8)}@placeholder.com`;
      generatedEmails[p.id] = placeholderEmail;
      return {
        id: p.id,
        email: placeholderEmail,
        user_metadata: { 
          nom: p.nom, 
          prenom: p.prenom, 
          role: p.role,
          etablissement_id: p.etablissement_id // IMPORTANT: Pass etablissement_id
        }
      };
    });
  } else if (usersToCreate.length > 0) {
    // Enrich existing users with etablissement_id from profiles if missing
    usersToCreate = usersToCreate.map(u => {
      generatedEmails[u.id] = u.email;
      const profile = profileMap[u.id];
      if (profile && profile.etablissement_id) {
         if (!u.user_metadata) u.user_metadata = {};
         u.user_metadata.etablissement_id = profile.etablissement_id;
         u.user_metadata.nom = u.user_metadata.nom || profile.nom;
         u.user_metadata.prenom = u.user_metadata.prenom || profile.prenom;
         u.user_metadata.role = u.user_metadata.role || profile.role;
      }
      return u;
    });
  }

  if (usersToCreate.length > 0) {
    console.log(`\n📦 Ré-importation de ${usersToCreate.length} utilisateurs...`);
    for (const user of usersToCreate) {
      console.log(`   Creating user: ${user.email} (${user.id}) with metadata:`, JSON.stringify(user.user_metadata));
      const { error } = await supabase.auth.admin.createUser({
        id: user.id, // Preserve UUID!
        email: user.email,
        password: 'password123', // Temporary password
        email_confirm: true,
        user_metadata: user.user_metadata
      });
      
      if (error) {
        console.warn(`   ⚠️ Error creating user ${user.email}: ${error.message}`);
      }
    }
  } else {
    console.warn('\n⚠️ Aucune donnée utilisateur ni profil trouvée.');
  }

  // 3. Import Remaining Tables
  const remainingTables = IMPORT_ORDER.filter(t => t !== 'etablissements');
  for (const table of remainingTables) {
    let rows = allData[table];
    if (!rows || rows.length === 0) {
      console.log(`Skipping ${table} (no data)`);
      continue;
    }
    
    // Special handling for profiles: ensure email exists
    if (table === 'profiles') {
      rows = rows.map(row => {
        if (!row.email && generatedEmails[row.id]) {
          return { ...row, email: generatedEmails[row.id] };
        }
        return row;
      });
    }

    // Apply transformation (column renaming)
    rows = rows.map(row => transformRow(table, row));
    
    console.log(`\n📦 Importing ${table} (${rows.length} rows)...`);
    
    // Chunk insert to avoid request size limits
    const chunkSize = 100;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      
      const { error } = await supabase
        .from(table)
        .upsert(chunk, { onConflict: 'id' }); // Use upsert to be safe
        
      if (error) {
        console.error(`   ❌ Error inserting chunk ${i}-${i+chunkSize}: ${error.message}`);
        // Continue or break? Continue to try next chunk
      } else {
        process.stdout.write('.');
      }
    }
    process.stdout.write('\n');
  }

  console.log('\n✅ Import terminé.');
  rl.close();
}

importData();
