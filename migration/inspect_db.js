
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:PzUsdRWteIQ0tkoP@db.gmwxcwvknlnydaajvlow.supabase.co:5432/postgres';

async function inspect() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false } // Supabase requires SSL
  });

  try {
    await client.connect();
    console.log('✅ Connected to Database directly via Postgres protocol.');

    // 1. Check profiles table definition
    console.log('\n--- Checking public.profiles columns ---');
    const resColumns = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'profiles';
    `);
    console.table(resColumns.rows);

    // 2. Check handle_new_user source code
    console.log('\n--- Checking handle_new_user source code ---');
    const resFunc = await client.query(`
      SELECT pg_get_functiondef(oid) as source
      FROM pg_proc
      WHERE proname = 'handle_new_user';
    `);
    if (resFunc.rows.length > 0) {
      console.log(resFunc.rows[0].source);
    } else {
      console.log('❌ Function handle_new_user not found.');
    }

    // 3. Check etablissements content
    console.log('\n--- Checking etablissements data ---');
    const resEtab = await client.query('SELECT id, nom FROM public.etablissements');
    console.table(resEtab.rows);

    // 4. Check triggers on auth.users
    console.log('\n--- Checking triggers on auth.users ---');
    const resTriggers = await client.query(`
      SELECT 
        trigger_name,
        event_manipulation,
        event_object_schema,
        event_object_table,
        action_statement
      FROM information_schema.triggers
      WHERE event_object_schema = 'auth' AND event_object_table = 'users';
    `);
    console.table(resTriggers.rows);

  } catch (err) {
    console.error('❌ Database inspection failed:', err);
  } finally {
    await client.end();
  }
}

inspect();
