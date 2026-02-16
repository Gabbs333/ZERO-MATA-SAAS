import { config } from 'dotenv'
import { Pool } from 'pg'
import { readFileSync } from 'fs'
import { join } from 'path'

// Load environment variables
config()

// Global database pool for tests
let pool: Pool | null = null
let databaseAvailable = false

export async function getTestPool(): Promise<Pool> {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres',
      connectionTimeoutMillis: 5000
    })
  }
  return pool
}

export async function isDatabaseAvailable(): Promise<boolean> {
  try {
    const testPool = await getTestPool()
    await testPool.query('SELECT 1')
    return true
  } catch (error) {
    return false
  }
}

export async function setupTestDatabase() {
  databaseAvailable = await isDatabaseAvailable()
  
  if (!databaseAvailable) {
    console.warn('\n⚠️  Database not available. Tests will be skipped.')
    console.warn('To run tests, start a PostgreSQL database:')
    console.warn('  - Option 1: supabase start (requires Supabase CLI)')
    console.warn('  - Option 2: docker run -p 54322:5432 -e POSTGRES_PASSWORD=postgres postgres')
    console.warn('  - Option 3: Set DATABASE_URL in .env to your PostgreSQL instance\n')
    return
  }
  
  const testPool = await getTestPool()
  
  try {
    // Drop all tables if they exist (clean slate)
    await testPool.query(`
      DROP SCHEMA IF EXISTS public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO postgres;
      GRANT ALL ON SCHEMA public TO public;
    `)
    
    // Create auth schema for testing (simulating Supabase auth)
    await testPool.query(`
      CREATE SCHEMA IF NOT EXISTS auth;
      
      -- Create a minimal auth.users table for testing
      CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        encrypted_password TEXT,
        email_confirmed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        raw_user_meta_data JSONB DEFAULT '{}'::jsonb
      );
      
      -- Mock auth.uid() function for testing
      CREATE OR REPLACE FUNCTION auth.uid()
      RETURNS UUID AS $$
        SELECT '00000000-0000-0000-0000-000000000000'::UUID;
      $$ LANGUAGE sql;
      
      -- Mock auth.jwt() function for testing
      CREATE OR REPLACE FUNCTION auth.jwt()
      RETURNS JSONB AS $$
        SELECT '{"role": "authenticated"}'::jsonb;
      $$ LANGUAGE sql;
    `)
    
    // Run the migrations in order
    const migrations = [
      '20240115000000_initial_schema.sql',
      '20240116000000_configure_auth.sql',
      '20240116000001_profiles_trigger.sql',
      '20240116000002_rls_policies.sql',
      '20240116000003_audit_system.sql',
      '20240117000000_products_stock_rls.sql',
      '20240118000000_commandes_rls.sql',
      '20240118000001_commandes_functions.sql',
      '20240119000000_ravitaillements_rls.sql',
      '20240119000001_ravitaillements_functions.sql',
      '20240120000000_stock_alerts.sql',
      '20240128000000_create_etablissements.sql',
      '20240128000001_add_etablissement_id.sql',
      '20240128000002_admin_role_support.sql',
      '20240128000003_migrate_existing_data.sql',
      '20240128000004_subscription_functions.sql',
      '20240128000005_multi_tenant_rls_policies.sql',
      '20240128000008_multi_tenant_audit_logging.sql'
    ]
    
    for (const migration of migrations) {
      try {
        const migrationSQL = readFileSync(
          join(__dirname, '../supabase/migrations', migration),
          'utf-8'
        )
        await testPool.query(migrationSQL)
        console.log(`✓ Migration ${migration} applied successfully`)
      } catch (error) {
        console.error(`Failed to apply migration ${migration}:`, error)
        throw error
      }
    }
    
    console.log('✓ Database schema created successfully')
  } catch (error) {
    console.error('Failed to setup test database:', error)
    databaseAvailable = false
  }
}

export async function cleanupTestDatabase() {
  if (!databaseAvailable) return
  
  const testPool = await getTestPool()
  
  // Clean all data but keep schema
  const tables = [
    'audit_logs',
    'encaissements',
    'factures',
    'commande_items',
    'commandes',
    'ravitaillement_items',
    'ravitaillements',
    'mouvements_stock',
    'stock',
    'produits',
    'tables',
    'profiles',
    'auth.users',
    'etablissements'
  ]
  
  for (const table of tables) {
    try {
      await testPool.query(`TRUNCATE TABLE ${table} CASCADE`)
    } catch (error) {
      // Ignore errors during cleanup
    }
  }
}

export async function closeTestDatabase() {
  if (pool) {
    await pool.end()
    pool = null
  }
}

export function skipIfNoDB() {
  if (!databaseAvailable) {
    return true
  }
  return false
}

// Setup before all tests
beforeAll(async () => {
  await setupTestDatabase()
}, 30000)

// Cleanup after each test
afterEach(async () => {
  await cleanupTestDatabase()
})

// Cleanup after all tests
afterAll(async () => {
  await closeTestDatabase()
})
