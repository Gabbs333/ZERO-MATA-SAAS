const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres:PzUsdRWteIQ0tkoP@db.gmwxcwvknlnydaajvlow.supabase.co:5432/postgres';

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false } // Required for Supabase
});

async function runMigration() {
  try {
    await client.connect();
    console.log('Connected to database');

    const migrationPath = path.join(__dirname, 'supabase/migrations/20260216000000_dashboard_new_rpcs.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executing migration...');
    await client.query(sql);
    console.log('Migration executed successfully!');
  } catch (err) {
    console.error('Error executing migration:', err);
  } finally {
    await client.end();
  }
}

runMigration();
