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

    const files = [
      'fix_rpc_and_frontend_mismatch.sql',
      'fix_stock_column_name.sql',
      'fix_ravitaillement_number_generation.sql'
    ];

    for (const file of files) {
      const filePath = path.join(__dirname, file);
      if (fs.existsSync(filePath)) {
        console.log(`Running ${file}...`);
        const sql = fs.readFileSync(filePath, 'utf8');
        await client.query(sql);
        console.log(`Completed ${file}`);
      } else {
        console.warn(`File not found: ${file}`);
      }
    }

    console.log('All migrations completed successfully');

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

runMigration();
