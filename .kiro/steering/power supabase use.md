---
inclusion: always
---

# Supabase Usage Guidelines

This project uses PostgreSQL via Supabase with a database-first architecture. All business logic, security, and data validation happens at the database layer using functions, triggers, and Row Level Security (RLS) policies.

## Core Architecture Principles

**Database-First Design**:
- Business logic in PL/pgSQL functions and triggers
- Security enforced via RLS policies (not application code)
- Schema, functions, triggers, and policies defined in migrations
- Application code uses thin clients: `pg` for tests, `@supabase/supabase-js` for apps

**Why Database-First**:
- Single source of truth for business rules
- Security cannot be bypassed by client code
- Testable at the database layer
- Real-time subscriptions work automatically

## Migration Conventions

**File Naming**: `YYYYMMDDHHMMSS_description.sql`
- Migrations execute in timestamp order
- Never modify existing migrations (create new ones instead)
- Group related changes: `_rls.sql` for policies, `_functions.sql` for logic

**Idempotency Required**: All migrations must be rerunnable
```sql
CREATE TABLE IF NOT EXISTS table_name (...);
CREATE INDEX IF NOT EXISTS idx_name ON table_name(column);
CREATE OR REPLACE FUNCTION function_name() RETURNS trigger AS $$
```

**Standard Migration Structure**:
1. Schema: Tables with constraints, indexes, foreign keys
2. Functions: Business logic and validation
3. Triggers: Auto-calculations and sequential numbers
4. RLS: Enable RLS and create policies

**Example Migration Order** (from this project):
```
20240115000000_initial_schema.sql       # All tables, indexes, base structure
20240116000000_configure_auth.sql       # Supabase auth schema setup
20240116000001_profiles_trigger.sql     # Auto-create profiles on signup
20240116000002_rls_policies.sql         # Base RLS policies
20240118000000_commandes_rls.sql        # Domain-specific RLS
20240118000001_commandes_functions.sql  # Domain business logic
```

## RLS Policy Patterns

**Always Enable RLS**:
```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
```

**Role-Based Access Pattern** (used throughout this project):
```sql
-- Check user role from profiles table
CREATE POLICY "policy_name"
  ON table_name FOR operation
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'required_role'
      AND actif = true
    )
  );
```

**Common Policy Operations**:
- `FOR SELECT`: Read access (use `USING` clause)
- `FOR INSERT`: Create access (use `WITH CHECK` clause)
- `FOR UPDATE`: Modify access (use both `USING` and `WITH CHECK`)
- `FOR DELETE`: Remove access (use `USING` clause)

**Policy Naming Convention**: `{role}_{action}_{table}` (e.g., `serveuses_can_create_commandes`)

**Typical Access Patterns**:
- Serveuses: Create orders, read own orders
- Comptoir: Read all orders, validate orders, create invoices
- Gérant: Manage products, record supplies
- Patron: Read-only access to everything

## Database Functions

**Function Types in This Project**:

1. **Sequential Number Generators**: Auto-generate unique identifiers
```sql
CREATE OR REPLACE FUNCTION generate_numero_commande()
RETURNS trigger AS $$
DECLARE
  date_part TEXT;
  sequence_num INTEGER;
BEGIN
  date_part := TO_CHAR(NOW(), 'YYYYMMDD');
  -- Find next number for today
  SELECT COALESCE(MAX(CAST(SPLIT_PART(numero_commande, '-', 3) AS INTEGER)), 0) + 1
  INTO sequence_num
  FROM commandes
  WHERE numero_commande LIKE 'CMD-' || date_part || '-%';
  
  NEW.numero_commande := 'CMD-' || date_part || '-' || LPAD(sequence_num::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

2. **Validation Functions**: Check business rules before operations
```sql
CREATE OR REPLACE FUNCTION validate_commande(commande_id UUID)
RETURNS void AS $$
BEGIN
  -- Validation logic
  IF NOT condition THEN
    RAISE EXCEPTION 'Validation failed: %', reason;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

3. **Calculation Triggers**: Auto-compute derived values
```sql
CREATE OR REPLACE FUNCTION calculate_commande_total()
RETURNS trigger AS $$
BEGIN
  NEW.montant_total := (
    SELECT COALESCE(SUM(quantite * prix_unitaire), 0)
    FROM commande_items
    WHERE commande_id = NEW.id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Function Naming**: `snake_case` with action verbs
- Generators: `generate_{entity}_numero()`
- Validators: `validate_{entity}()`
- Calculators: `calculate_{entity}_{field}()`
- Updaters: `update_{entity}_from_{source}()`

**Security Context**:
- Default: Runs with caller's permissions (respects RLS)
- `SECURITY DEFINER`: Runs with creator's permissions (bypasses RLS, use carefully)

## Data Type Standards

**Primary Keys**: UUID with `uuid_generate_v4()` default
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
```
Requires: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`

**Money Values**: INTEGER (store smallest unit, e.g., centimes)
```sql
prix_vente INTEGER NOT NULL CHECK (prix_vente >= 0)
-- 500 = 5.00 FCFA, 12500 = 125.00 FCFA
```
Never use DECIMAL or FLOAT for money (floating-point errors).

**Timestamps**: TIMESTAMPTZ with timezone awareness
```sql
date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
date_modification TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

**Enums**: TEXT with CHECK constraints (more flexible than PostgreSQL ENUMs)
```sql
role TEXT NOT NULL CHECK (role IN ('serveuse', 'comptoir', 'gerant', 'patron')),
statut TEXT NOT NULL CHECK (statut IN ('en_attente', 'validee', 'annulee'))
```

**Foreign Keys**: Always specify ON DELETE behavior
```sql
-- Dependent records should cascade
commande_id UUID NOT NULL REFERENCES commandes(id) ON DELETE CASCADE,

-- Referenced records should prevent deletion
produit_id UUID NOT NULL REFERENCES produits(id) ON DELETE RESTRICT
```

## Testing Patterns

**Test Setup** (`tests/setup.ts`):
- Mock `auth.users` table for testing
- Mock `auth.uid()` and `auth.jwt()` functions
- Run all migrations before tests
- Truncate tables between tests (preserve schema)

**Test Database Connection**:
```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres'
});
```

**Testing RLS Policies**:
```typescript
// Set session user context
await pool.query(`SELECT set_config('request.jwt.claims', '{"sub": "${userId}"}', true)`);

// Test operation with that user's permissions
const result = await pool.query('SELECT * FROM commandes');
```

**Property-Based Testing**: Use fast-check to verify universal properties
```typescript
import fc from 'fast-check';

test('property: all validated orders have positive totals', async () => {
  await fc.assert(
    fc.asyncProperty(orderArbitrary, async (order) => {
      // Test property holds for all generated orders
    })
  );
});
```

## Sequential Number Format

**Pattern**: `PREFIX-YYYYMMDD-NNN`
- `CMD-20240115-001` (Commandes)
- `RAV-20240115-001` (Ravitaillements)
- `FACT-20240115-001` (Factures)

**Implementation**: Trigger fires BEFORE INSERT when field is NULL/empty
- Extracts date part: `TO_CHAR(NOW(), 'YYYYMMDD')`
- Finds max sequence for today: `MAX(CAST(SPLIT_PART(numero, '-', 3) AS INTEGER))`
- Increments and pads: `LPAD((max + 1)::TEXT, 3, '0')`

**Concurrency**: Use row-level locking if high concurrency expected
```sql
SELECT ... FROM table WHERE ... FOR UPDATE;
```

## Common Patterns from This Project

**Audit Logging**: Track all significant actions
```sql
INSERT INTO audit_logs (user_id, action, table_name, record_id, details)
VALUES (auth.uid(), 'CREATE', 'commandes', NEW.id, row_to_json(NEW)::jsonb);
```

**Immutability After Validation**: Prevent changes to validated records
```sql
CREATE POLICY "no_update_after_validation"
  ON commandes FOR UPDATE
  USING (statut != 'validee');
```

**Stock Movement Tracking**: Record all inventory changes
```sql
INSERT INTO mouvements_stock (produit_id, quantite, type_mouvement, reference_id)
VALUES (product_id, quantity, 'SORTIE', commande_id);
```

**Soft Deletes**: Use `actif` boolean instead of DELETE
```sql
actif BOOLEAN NOT NULL DEFAULT true
```

## Critical Rules

1. **Never bypass RLS in application code** - Security must be enforced at database level
2. **Never modify existing migrations** - Create new migrations for schema changes
3. **Never use floating-point for money** - Always use INTEGER (smallest currency unit)
4. **Always use CASCADE/RESTRICT** - Explicitly define foreign key deletion behavior
5. **Always test with real database** - No mocks for database layer tests
6. **Always use TIMESTAMPTZ** - Never use TIMESTAMP without timezone
7. **Always make migrations idempotent** - Use IF NOT EXISTS / CREATE OR REPLACE
8. **Always validate in database** - Don't rely on client-side validation alone

## When to Use Supabase Power

Activate the Supabase power when you need to:
- Look up RLS policy patterns or best practices
- Understand Supabase auth integration (`auth.uid()`, `auth.jwt()`)
- Learn about Supabase-specific features (realtime, storage, edge functions)
- Troubleshoot migration or RLS issues
- Find examples of PL/pgSQL functions or triggers
- Understand Supabase client library usage