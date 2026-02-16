# Technology Stack

## Backend Architecture

**Database**: PostgreSQL via Supabase
- Hosted database with real-time subscriptions
- Row Level Security (RLS) for access control
- Database functions and triggers for business logic
- Auth schema integration for user management

## Tech Stack

**Runtime**: Node.js with TypeScript
- TypeScript 5.3+ with strict mode enabled
- ES2022 target with ESNext modules
- Node module resolution

**Testing Framework**: Vitest
- Property-based testing with fast-check
- Unit tests for migrations and business logic
- 30-second timeout for database operations
- Global test utilities via setup file

**Database Client**: 
- `pg` for direct PostgreSQL connections in tests
- `@supabase/supabase-js` for application code

**Environment**: dotenv for configuration

## Project Structure

```
supabase/migrations/     # Database schema migrations (sequential)
tests/                   # Test suites organized by domain
  auth/                  # Authentication and RBAC tests
  commandes/             # Order management tests
  encaissements/         # Payment collection tests
  factures/              # Invoice tests
  products/              # Product catalog tests
  ravitaillements/       # Supply management tests
  stock/                 # Inventory tests
  migrations/            # Schema validation tests
  setup.ts               # Global test configuration
```

## Common Commands

### Testing
```bash
npm test                 # Run all tests once
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run with coverage report
```

### Database
```bash
supabase start          # Start local Supabase (includes PostgreSQL)
supabase stop           # Stop local Supabase
```

### Alternative Database Setup
```bash
# Docker PostgreSQL
docker run -d -p 54322:5432 -e POSTGRES_PASSWORD=postgres postgres

# Custom database via .env
DATABASE_URL=postgresql://user:pass@host:port/db
```

### Helper Scripts
```bash
./run-tests.sh                # Automated test runner with checks
./start-db-and-test.sh        # Start DB and run tests
```

## Database Conventions

**Migration Naming**: `YYYYMMDDHHMMSS_description.sql`
- Migrations run in sequential order
- Never modify existing migrations
- Each migration is idempotent (uses IF NOT EXISTS)

**Naming Conventions**:
- Tables: lowercase with underscores (e.g., `commande_items`)
- Functions: lowercase with underscores (e.g., `generate_numero_commande`)
- Triggers: `trigger_` prefix (e.g., `trigger_calculate_commande_total`)
- Indexes: `idx_` prefix (e.g., `idx_commandes_serveuse`)

**ID Generation**: UUID v4 via `uuid_generate_v4()`

**Sequential Numbers**: Auto-generated via triggers
- Format: `PREFIX-YYYYMMDD-NNN`
- Examples: `CMD-20240115-001`, `RAV-20240115-001`, `FACT-20240115-001`

## Testing Conventions

**Property-Based Tests**: Use fast-check for universal properties
- File suffix: `.property.test.ts`
- Must include requirement validation comments: `**Validates: Requirements X.Y**`
- Test real database behavior (no mocks)

**Unit Tests**: Standard Vitest tests
- File suffix: `.test.ts`
- Focus on schema, constraints, defaults, triggers

**Test Setup**: 
- Global setup in `tests/setup.ts`
- Auto-creates auth schema and runs migrations
- Cleans data between tests (truncates tables)
- Skips tests gracefully if database unavailable

## Code Style

**TypeScript**:
- Strict mode enabled
- Explicit types preferred
- ESM imports/exports
- Async/await for database operations

**SQL**:
- Uppercase keywords (SELECT, FROM, WHERE)
- Explicit constraint names
- Comments for complex logic
- Use CHECK constraints for data validation
