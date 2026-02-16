# Project Structure

## Directory Organization

```
.
├── .kiro/                          # Kiro configuration
│   ├── specs/                      # Feature specifications
│   │   └── snack-bar-management/   # Main feature spec
│   └── steering/                   # Project guidelines (this file)
│
├── supabase/                       # Database layer
│   └── migrations/                 # Sequential SQL migrations
│       ├── 20240115000000_initial_schema.sql
│       ├── 20240116000000_configure_auth.sql
│       ├── 20240116000001_profiles_trigger.sql
│       ├── 20240116000002_rls_policies.sql
│       ├── 20240116000003_audit_system.sql
│       ├── 20240117000000_products_stock_rls.sql
│       ├── 20240118000000_commandes_rls.sql
│       ├── 20240118000001_commandes_functions.sql
│       ├── 20240119000000_ravitaillements_rls.sql
│       ├── 20240119000001_ravitaillements_functions.sql
│       ├── 20240120000000_stock_alerts.sql
│       ├── 20240121000000_factures_rls.sql
│       ├── 20240121000001_factures_functions.sql
│       ├── 20240121000002_encaissements_rls.sql
│       └── 20240121000003_encaissements_functions.sql
│
├── tests/                          # Test suites
│   ├── setup.ts                    # Global test configuration
│   ├── auth/                       # Authentication tests
│   │   ├── authentication.property.test.ts
│   │   ├── rbac.property.test.ts
│   │   └── audit.property.test.ts
│   ├── commandes/                  # Order management tests
│   │   ├── commandes.property.test.ts
│   │   ├── validation.property.test.ts
│   │   ├── immutability.property.test.ts
│   │   └── product-filtering.property.test.ts
│   ├── encaissements/              # Payment collection tests
│   │   └── encaissements.property.test.ts
│   ├── factures/                   # Invoice tests
│   │   └── factures.property.test.ts
│   ├── migrations/                 # Schema validation tests
│   │   ├── schema.test.ts
│   │   ├── constraints.test.ts
│   │   ├── defaults.test.ts
│   │   └── triggers.test.ts
│   ├── products/                   # Product catalog tests
│   │   └── products.property.test.ts
│   ├── ravitaillements/            # Supply management tests
│   │   └── ravitaillements.property.test.ts
│   └── stock/                      # Inventory tests
│       └── stock.property.test.ts
│
├── docs/                           # Documentation
│   ├── SUPABASE_AUTH_SETUP.md
│   └── TASK_2_IMPLEMENTATION_SUMMARY.md
│
├── package.json                    # Dependencies and scripts
├── tsconfig.json                   # TypeScript configuration
├── vitest.config.ts                # Test runner configuration
├── .env.example                    # Environment template
└── *.md                            # Task summaries and guides
```

## Domain Organization

The codebase is organized by business domain:

### Core Domains

1. **Authentication & Authorization** (`auth/`)
   - User profiles and roles
   - RBAC (Role-Based Access Control)
   - Audit logging

2. **Product Management** (`products/`, `stock/`)
   - Product catalog
   - Inventory tracking
   - Stock alerts

3. **Order Management** (`commandes/`)
   - Order creation by waitresses
   - Order validation at counter
   - Order immutability after validation

4. **Supply Chain** (`ravitaillements/`)
   - Supply recording by managers
   - Stock replenishment
   - Cost tracking

5. **Financial** (`factures/`, `encaissements/`)
   - Invoice generation
   - Payment collection
   - Receivables tracking

## Database Schema

### Core Tables

**Users & Auth**:
- `auth.users` - Supabase authentication
- `profiles` - Extended user profiles with roles

**Products & Inventory**:
- `produits` - Product catalog
- `stock` - Current inventory levels
- `mouvements_stock` - Stock movement history

**Operations**:
- `tables` - Physical table management
- `commandes` - Customer orders
- `commande_items` - Order line items
- `ravitaillements` - Supply deliveries
- `ravitaillement_items` - Supply line items

**Financial**:
- `factures` - Invoices
- `encaissements` - Payment records

**Audit**:
- `audit_logs` - Complete action history

## Migration Strategy

Migrations are applied sequentially:
1. Initial schema (tables, indexes, functions, triggers)
2. Auth configuration
3. Profile triggers
4. RLS policies (security)
5. Audit system
6. Domain-specific RLS and functions

Each migration is self-contained and idempotent.

## Test Organization

Tests mirror the domain structure:
- **Migration tests**: Validate schema correctness
- **Property tests**: Verify business rules across all inputs
- **Domain tests**: Organized by business capability

## File Naming Conventions

- **Migrations**: `YYYYMMDDHHMMSS_description.sql`
- **Property tests**: `domain.property.test.ts`
- **Unit tests**: `domain.test.ts`
- **Documentation**: `UPPERCASE_WITH_UNDERSCORES.md`
- **Specs**: `lowercase-with-dashes/`

## Key Architectural Patterns

1. **Database-First**: Business logic in PostgreSQL (functions, triggers, RLS)
2. **Real-Time Sync**: Supabase subscriptions for live updates
3. **Immutability**: Validated orders cannot be modified
4. **Audit Trail**: All actions logged with user and timestamp
5. **Role-Based Security**: RLS policies enforce access control
6. **Sequential Numbering**: Auto-generated unique identifiers
7. **Property-Based Testing**: Universal correctness properties
