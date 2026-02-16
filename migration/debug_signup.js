const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '../app-admin/.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function debug() {
    console.log('Testing SignUp without metadata...');
    const email = `debug.${Date.now()}@test.com`;
    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: 'password123',
    });
    
    if (error) {
        console.error('Error (no metadata):', error.message);
    } else {
        console.log('Success (no metadata):', data.user.id);
    }

    console.log('Testing SignUp WITH metadata but NO etablissement...');
    const email2 = `debug2.${Date.now()}@test.com`;
    const { data: d2, error: e2 } = await supabase.auth.signUp({
        email: email2,
        password: 'password123',
        options: {
            data: {
                role: 'serveuse',
                nom: 'Debug',
                prenom: 'User'
            }
        }
    });

    if (e2) {
        console.error('Error (metadata, no etab):', e2.message);
    } else {
        console.log('Success (metadata, no etab):', d2.user.id);
    }
}

debug();
