
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function debug() {
  console.log('--- DEBUGGING DB STATE ---');

  // 1. Check Etablissements
  const { data: etablissements, error: errorEtab } = await supabase
    .from('etablissements')
    .select('*');
  
  if (errorEtab) {
    console.error('❌ Error fetching etablissements:', errorEtab.message);
  } else {
    console.log(`✅ Found ${etablissements.length} etablissements:`);
    etablissements.forEach(e => console.log(`   - ${e.id} (${e.nom})`));
  }

  // 2. Check Profiles
  const { data: profiles, error: errorProf } = await supabase
    .from('profiles')
    .select('*');

  if (errorProf) {
    console.error('❌ Error fetching profiles:', errorProf.message);
  } else {
    console.log(`✅ Found ${profiles.length} profiles.`);
  }

  // 3. List Users
  const { data: { users }, error: errorUsers } = await supabase.auth.admin.listUsers();
  if (errorUsers) {
    console.error('❌ Error fetching users:', errorUsers.message);
  } else {
    console.log(`✅ Found ${users.length} users in auth.users.`);
    users.forEach(u => console.log(`   - ${u.email} (${u.id})`));
  }

  console.log('--- END DEBUG ---');
}

debug();
