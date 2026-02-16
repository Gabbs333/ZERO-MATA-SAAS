
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://gmwxcwvknlnydaajvlow.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAuditLogs() {
  console.log('Checking if audit_logs table exists...');
  
  const { data, error } = await supabase
    .from('audit_logs')
    .select('count', { count: 'exact', head: true });

  if (error) {
    console.error('❌ Error checking audit_logs:', error);
    if (error.code === '42P01') {
        console.error('Table audit_logs does not exist!');
    }
  } else {
    console.log('✅ Table audit_logs exists.');
  }
}

checkAuditLogs();
