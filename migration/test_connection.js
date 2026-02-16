
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gmwxcwvknlnydaajvlow.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdtd3hjd3ZrbmxueWRhYWp2bG93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg1MjY4MSwiZXhwIjoyMDg2NDI4NjgxfQ.ziKvmKjy87rGYzSXI4MQFK0Iq0QUdB3Dv-2t3I_z5UE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    const { data, error } = await supabase.from('produits').select('*').limit(1);
    if (error) {
      console.error('Supabase Error:', error);
    } else {
      console.log('Supabase Connection Successful. Data:', data);
    }
  } catch (err) {
    console.error('Network/Client Error:', err);
  }
}

testConnection();
