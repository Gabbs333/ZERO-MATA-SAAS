# Migration Tests

This directory contains comprehensive unit tests for the database migrations.

## Test Coverage

### 1. Schema Tests (`migrations/schema.test.ts`)
- Verifies all required tables are created
- Validates table columns and data types
- Ensures proper table structure

### 2. Constraints Tests (`migrations/constraints.test.ts`)
- **Uniqueness Constraints**: Tests unique constraints on key fields (produits.nom, tables.numero, commandes.numero_commande, factures.numero_facture)
- **Foreign Key Constraints**: Validates referential integrity between tables
- **Cascade Behavior**: Tests cascade delete operations
- **Check Constraints**: Validates business rules (positive prices, non-negative stock, valid roles, etc.)

### 3. Defaults Tests (`migrations/defaults.test.ts`)
- Tests default values for all columns with defaults
- Validates automatic timestamp generation
- Verifies UUID generation for primary keys
- Checks boolean and numeric defaults

### 4. Triggers Tests (`migrations/triggers.test.ts`)
- **Sequential Number Generation**: Tests automatic generation of numero_commande, numero_ravitaillement, and numero_facture
- **Commande Total Calculation**: Validates automatic calculation of montant_total when commande_items are inserted/updated/deleted
- **Product Modification Date**: Tests automatic update of date_modification on product updates

## Prerequisites

### Option 1: Local Supabase (Recommended for Testing)

1. Install Supabase CLI:
```bash
npm install -g supabase
```

2. Start local Supabase:
```bash
supabase start
```

This will start a local PostgreSQL database on port 54322.

### Option 2: Remote PostgreSQL

Set up a PostgreSQL database and configure the connection string in `.env`.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file from example:
```bash
cp .env.example .env
```

3. Configure database connection in `.env`:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
```

## Running Tests

### Run all tests:
```bash
npm test
```

### Run tests in watch mode:
```bash
npm run test:watch
```

### Run tests with coverage:
```bash
npm run test:coverage
```

### Run specific test file:
```bash
npx vitest run tests/migrations/schema.test.ts
```

## Test Structure

Each test file follows this pattern:

1. **Setup**: Uses `beforeEach` to get a clean database connection
2. **Test**: Executes SQL queries and validates results
3. **Cleanup**: Automatically handled by `tests/setup.ts`

## Important Notes

- Tests run against a real PostgreSQL database (not mocked)
- Each test suite gets a clean database state
- All tables are truncated between tests
- The migration is applied once before all tests
- Tests validate actual database behavior, not just code logic

## Troubleshooting

### Connection Errors

If you get connection errors:
1. Ensure PostgreSQL is running
2. Check the DATABASE_URL in `.env`
3. Verify port 54322 is accessible

### Migration Errors

If migration fails to apply:
1. Check the SQL syntax in `supabase/migrations/20240115000000_initial_schema.sql`
2. Ensure all dependencies are installed
3. Try running the migration manually:
```bash
psql $DATABASE_URL -f supabase/migrations/20240115000000_initial_schema.sql
```

### Test Failures

If tests fail:
1. Check the error message for specific constraint violations
2. Verify the migration was applied correctly
3. Ensure the database is clean before running tests
4. Check for any data type mismatches

## Adding New Tests

When adding new tests:

1. Create a new test file in `tests/migrations/`
2. Import the test pool: `import { getTestPool } from '../setup'`
3. Use `beforeEach` to get the pool
4. Write descriptive test names
5. Test both success and failure cases
6. Clean up any test data (handled automatically)

Example:
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { getTestPool } from '../setup'

describe('My New Feature', () => {
  let pool: any
  
  beforeEach(async () => {
    pool = await getTestPool()
  })

  it('should do something', async () => {
    const result = await pool.query('SELECT 1 as value')
    expect(result.rows[0].value).toBe(1)
  })
})
```
