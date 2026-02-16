
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://gmwxcwvknlnydaajvlow.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('Script started.');
console.log('URL:', supabaseUrl);
console.log('Key length:', supabaseKey ? supabaseKey.length : 0);

async function checkColumn() {
  console.log('Checking if etablissement_id column exists in profiles...');
  
  // Try to select the column
  const { data, error } = await supabase
    .from('profiles')
    .select('etablissement_id')
    .limit(1);

  if (error) {
    console.error('❌ Error selecting etablissement_id:', error.message);
  } else {
    console.log('✅ Column etablissement_id exists in profiles.');
  }

  console.log('Checking etablissements IDs...');
  const { data: etabs, error: errorEtabs } = await supabase
    .from('etablissements')
    .select('id, nom');
  
  if (errorEtabs) {
    console.error('❌ Error fetching etablissements:', errorEtabs.message);
  } else {
    console.log('Found etablissements:', etabs);
  }
}

checkColumn();
