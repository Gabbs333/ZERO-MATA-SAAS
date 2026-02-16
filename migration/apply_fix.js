const fs = require('fs');
const { Client } = require('pg');

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

    const sql = fs.readFileSync('/Users/gabrielguelieko/Documents/Verrouillage/migration/fix_schema_mismatch.sql', 'utf8');
    
    console.log('Running migration...');
    await client.query(sql);
    console.log('Migration completed successfully');

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

runMigration();
