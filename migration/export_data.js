
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Load .env from root
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const OUTPUT_FILE = path.join(__dirname, 'data.json');

const TABLES = [
  'etablissements', // Parent table
  'profiles',
  'produits',
  'stock',
  'tables',
  'commandes',
  'commande_items',
  'mouvements_stock',
  'ravitaillements',
  'ravitaillement_items',
  'factures',
  'encaissements',
  // 'audit_logs' // Often too large, optional
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function exportData() {
  console.log('--- EXPORT DE DONNÉES SUPABASE ---');
  console.log('Ce script va télécharger les données des tables publiques au format JSON.');
  
  const supabaseUrl = process.env.SUPABASE_URL || await ask('Entrez SUPABASE_URL: ');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || await ask('Entrez SUPABASE_SERVICE_ROLE_KEY: ');

  if (!supabaseUrl || !serviceKey) {
    console.error('URL et Clé requises.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const allData = {};

  // Try to export auth.users
  console.log('Tentative d\'export des utilisateurs (auth.users)...');
  try {
    let allUsers = [];
    let page = 1;
    while (true) {
      const { data: { users }, error } = await supabase.auth.admin.listUsers({ page: page, perPage: 1000 });
      if (error) throw error;
      if (!users || users.length === 0) break;
      allUsers = allUsers.concat(users);
      if (users.length < 1000) break;
      page++;
    }
    console.log(`  -> ${allUsers.length} users found`);
    allData['auth_users'] = allUsers;
  } catch (e) {
    console.warn('⚠️ Exception lors de l\'export utilisateurs:', e.message);
  }

  for (const table of TABLES) {
    console.log(`Exporting table: ${table}...`);
    
    // Simple pagination to fetch all rows
    let rows = [];
    let page = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        // If table doesn't exist (e.g. etablissements might be missing if migration not run), warn and continue
        console.warn(`⚠️ Error exporting ${table}: ${error.message}`);
        break;
      }

      if (data.length === 0) break;
      
      rows = rows.concat(data);
      if (data.length < pageSize) break;
      page++;
    }

    console.log(`  -> ${rows.length} rows`);
    allData[table] = rows;
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allData, null, 2));
  console.log(`\n✅ Données exportées dans ${OUTPUT_FILE}`);
  console.log('NOTE: Les IDs (UUID) sont préservés. Les profils utilisateurs seront "orphelins"');
  console.log('jusqu\'à ce que vous recréiez les utilisateurs dans auth.users avec les mêmes IDs');
  console.log('ou que vous mettiez à jour la table profiles avec les nouveaux IDs.');
  
  rl.close();
}

exportData();
