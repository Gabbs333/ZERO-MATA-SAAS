const fs = require('fs');
const { Client } = require('pg');
const path = require('path');

const connectionString = 'postgresql://postgres:PzUsdRWteIQ0tkoP@db.gmwxcwvknlnydaajvlow.supabase.co:5432/postgres';

async function runMigration() {
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('Connected to database');

    const filePath = path.join(__dirname, '../supabase/migrations/20260418_fix_handle_new_user_etablissement.sql');
    if (fs.existsSync(filePath)) {
      console.log('Running 20260418_fix_handle_new_user_etablissement.sql...');
      const sql = fs.readFileSync(filePath, 'utf8');
      await client.query(sql);
      console.log('Completed 20260418_fix_handle_new_user_etablissement.sql');
    } else {
      console.error(`File not found: ${filePath}`);
    }

    console.log('Database repair completed successfully');

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

runMigration();
