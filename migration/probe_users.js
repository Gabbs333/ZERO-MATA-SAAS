
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), 'app-admin/.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
// Use public anon key for login (simulate real user)
const supabaseAnon = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY);

// Use admin key for cleanup if we get IDs
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdtd3hjd3ZrbmxueWRhYWp2bG93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg1MjY4MSwiZXhwIjoyMDg2NDI4NjgxfQ.ziKvmKjy87rGYzSXI4MQFK0Iq0QUdB3Dv-2t3I_z5UE';
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function probe() {
  const users = ['patron@test.com', 'serveuse@test.com', 'comptoir@test.com', 'gerant@test.com'];
  
  for (const email of users) {
    console.log(`\nTesting login for ${email}...`);
    const { data, error } = await supabaseAnon.auth.signInWithPassword({
      email,
      password: 'password123'
    });
    
    if (error) {
      console.error(`❌ Login Failed: ${error.message} (Status: ${error.status})`);
      if (error.status === 500) {
        console.log("   -> This confirms the 'Database error' affects this user.");
      }
    } else {
      console.log(`✅ Login Success! ID: ${data.user.id}`);
      
      // If we can login, we can fix the profile!
      console.log("   -> Attempting to fix profile...");
      
      // 1. Check if profile exists via Admin
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();
        
      if (!profile) {
        console.log("   -> Profile missing. Creating it...");
        const { error: upsertError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: data.user.id,
          email: email,
          nom: email.split('@')[0],
          prenom: 'Test',
          role: email.split('@')[0], // patron, serveuse...
          etablissement_id: 'a902b1de-ab2d-46c7-a1ea-98ef8e93f634', // Hardcoded ID found in logs
          actif: true
        });
        
        if (upsertError) console.error("   ❌ Profile creation failed:", upsertError);
        else console.log("   ✅ Profile created manually.");
      } else {
        console.log("   -> Profile exists.");
      }
    }
  }
}

probe();
