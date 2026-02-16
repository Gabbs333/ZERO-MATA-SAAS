
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://gmwxcwvknlnydaajvlow.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAuditLogsConstraints() {
  console.log('Checking audit_logs constraints...');
  
  // We can't easily check constraints via API without pg_catalog access or inserting a row with nulls.
  // Let's try to insert a row with null user_id and see if it fails.
  
  const { data, error } = await supabase
    .from('audit_logs')
    .insert({
      action: 'TEST_CONSTRAINT',
      entite: 'TEST',
      entite_id: 'TEST',
      utilisateur_id: null // Explicitly null
    })
    .select();

  if (error) {
    console.error('❌ Error inserting into audit_logs:', error);
  } else {
    console.log('✅ Inserted row with null utilisateur_id:', data);
    // Cleanup
    await supabase.from('audit_logs').delete().eq('id', data[0].id);
  }
}

checkAuditLogsConstraints();
