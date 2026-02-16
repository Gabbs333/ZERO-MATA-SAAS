const fs = require('fs');
const { Client } = require('pg');
const path = require('path');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

async function runSqlFile(filePath) {
  const client = new Client({
    connectionString,
  });

  try {
    await client.connect();
    console.log(`Connected to database. Executing ${filePath}...`);
    
    const sql = fs.readFileSync(filePath, 'utf8');
    await client.query(sql);
    
    console.log('Successfully executed SQL script.');
  } catch (err) {
    console.error('Error executing SQL script:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error('Please provide a SQL file path.');
  process.exit(1);
}

runSqlFile(path.resolve(process.cwd(), sqlFile));
