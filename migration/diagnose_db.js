
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:PzUsdRWteIQ0tkoP@[2a05:d014:1c06:5f44:fdfe:407:42dd:df37]:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to PostgreSQL');

    // 1. List triggers on auth.users
    const resTriggers = await client.query(`
      SELECT event_object_schema as table_schema,
             event_object_table as table_name,
             trigger_schema,
             trigger_name,
             action_timing,
             event_manipulation,
             action_statement
      FROM information_schema.triggers
      WHERE event_object_schema = 'auth' AND event_object_table = 'users'
    `);
    
    console.log('\n--- TRIGGERS ON auth.users ---');
    resTriggers.rows.forEach(r => {
      console.log(`${r.trigger_name}: ${r.action_timing} ${r.event_manipulation}`);
    });

    // 2. Check auth.sessions columns
    const resColumns = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'auth' AND table_name = 'sessions'
    `);
    
    console.log('\n--- COLUMNS IN auth.sessions ---');
    resColumns.rows.forEach(r => {
      console.log(`${r.column_name}: ${r.data_type} (Default: ${r.column_default})`);
    });

    // 3. Try to select users manually (to see if DB read works)
    const resUsers = await client.query('SELECT id, email FROM auth.users LIMIT 5');
    console.log('\n--- USERS IN auth.users ---');
    resUsers.rows.forEach(r => console.log(`${r.email} (${r.id})`));

  } catch (err) {
    console.error('Database Error:', err);
  } finally {
    await client.end();
  }
}

run();
