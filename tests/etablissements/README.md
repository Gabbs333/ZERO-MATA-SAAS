# Etablissements Property Tests

This directory contains property-based tests for the multi-tenant SaaS etablissements feature.

## Test Coverage

### Property 8: Unique Establishment IDs
**Validates: Requirements 2.1**

Tests that all establishment creation operations generate unique UUID identifiers:
- Multiple establishments receive unique IDs
- Identical data still produces unique IDs
- All IDs are valid UUIDs

### Property 9: Establishment Creation Defaults
**Validates: Requirements 2.2, 2.4, 2.5, 3.1, 3.2**

Tests that new establishments have correct default values:
- `statut_abonnement` defaults to 'actif'
- `actif` defaults to true
- `date_debut` set to current timestamp
- `date_fin` set to `date_debut + 12 months`
- Payment tracking fields default to NULL
- Explicitly set values override defaults

### Property 10: Valid Establishment Status Values
**Validates: Requirements 2.3, 3.3**

Tests that `statut_abonnement` only accepts valid values:
- Accepts: 'actif', 'expire', 'suspendu'
- Rejects: any other value
- Rejects: NULL values
- Allows updates between valid values
- Rejects updates to invalid values

## Running the Tests

### Prerequisites

You need a PostgreSQL database connection. Options:

1. **Local Supabase**:
   ```bash
   supabase start
   npm test tests/etablissements/etablissements.property.test.ts
   ```

2. **Docker PostgreSQL**:
   ```bash
   docker run -d -p 54322:5432 -e POSTGRES_PASSWORD=postgres postgres
   npm test tests/etablissements/etablissements.property.test.ts
   ```

3. **Hosted Supabase**:
   Create a `.env` file with your connection string:
   ```
   DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
   ```
   Then run:
   ```bash
   npm test tests/etablissements/etablissements.property.test.ts
   ```

### Test Execution

The tests use fast-check for property-based testing with the following configuration:
- **Property 8**: 50-30 runs per test case
- **Property 9**: 100-50 runs per test case  
- **Property 10**: 50-30 runs per test case

Total test cases: **15 property tests**

## Test Structure

Each test follows the pattern:
1. Generate random test data using fast-check arbitraries
2. Execute database operations
3. Verify properties hold true
4. Clean up test data

## Database Requirements

The tests require:
- PostgreSQL database with the `etablissements` table created
- Migration `20240128000000_create_etablissements.sql` applied
- `uuid-ossp` extension enabled

## Notes

- Tests are automatically skipped if database is not available
- All tests clean up their data after execution
- Tests use direct PostgreSQL connections (pg library)
- No mocking - tests validate real database behavior
