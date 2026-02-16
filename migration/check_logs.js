
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkLogs() {
  console.log('Checking debug_logs table...');
  
  const { data, error } = await supabase
    .from('debug_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('❌ Error fetching logs:', error);
  } else {
    if (data.length === 0) {
      console.log('ℹ️ No logs found in debug_logs.');
    } else {
      console.log('✅ Found logs:');
      data.forEach(log => {
        console.log(`[${log.created_at}] ${log.message}:`, JSON.stringify(log.details, null, 2));
      });
    }
  }
}

checkLogs();
