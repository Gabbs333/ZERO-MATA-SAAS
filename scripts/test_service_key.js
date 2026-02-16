const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/Users/gabrielguelieko/Documents/Verrouillage/.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('--- TEST DE LA CLÉ SERVICE ROLE FOURNIE ---');
console.log('URL:', SUPABASE_URL);
console.log('KEY:', SERVICE_KEY);

if (!SERVICE_KEY || !SERVICE_KEY.startsWith('ey')) {
    console.warn('⚠️ ATTENTION: La clé fournie ne ressemble pas à un JWT standard (ne commence pas par "ey").');
    console.warn('Le client Supabase risque de la rejeter ou de ne pas pouvoir authentifier les requêtes admin.');
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testAdminAccess() {
    console.log('\nTentative de listing des utilisateurs (Admin Only)...');
    
    // listUsers() requiert le rôle service_role
    const { data, error } = await supabase.auth.admin.listUsers();

    if (error) {
        console.error('❌ ÉCHEC :', error.message);
        console.error('Détails:', error);
        console.log('\nCONCLUSION: La clé fournie n\'est probablement pas une clé service_role valide pour le client JS.');
        console.log('Elle pourrait être un "Access Token" pour le CLI ou une autre forme de secret.');
    } else {
        console.log('✅ SUCCÈS ! Accès Admin confirmé.');
        console.log(`Nombre d'utilisateurs trouvés : ${data.users.length}`);
        const serveuse = data.users.find(u => u.email === 'serveuse@snackbar.cm');
        if (serveuse) {
            console.log('Compte serveuse trouvé:', serveuse.id, serveuse.email);
        } else {
            console.log('Compte serveuse NON trouvé dans la liste.');
        }
    }
}

testAdminAccess();
