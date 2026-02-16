# Snack Bar Management System - Multi-Tenant SaaS Platform

A comprehensive multi-tenant SaaS platform for managing snack bar establishments in Cameroon. The system provides complete traceability from customer order to product delivery, preventing stock theft and providing real-time visibility to owners.

## 🎯 Overview

This platform enables a SaaS provider to manage multiple snack bar establishments as separate clients, each with:
- **Complete data isolation** between establishments
- **Annual subscriptions** with manual payment confirmation
- **Automatic expiration** after 12 months
- **Centralized administration** via admin dashboard
- **Role-based access control** within each establishment

## 🏗️ Architecture

### Multi-Tenancy Model

- **Shared Database, Shared Schema**: All establishments share the same PostgreSQL database and tables
- **RLS-Based Isolation**: Row Level Security (RLS) policies enforce data isolation at the database level
- **Establishment-Scoped Data**: Every table includes `etablissement_id` for data segregation
- **Admin Separation**: Admin users exist outside establishment context with cross-establishment access

### Technology Stack

**Backend**:
- PostgreSQL via Supabase (database + auth + real-time)
- Row Level Security (RLS) for multi-tenancy
- Edge Functions for background jobs
- pg_cron for scheduled tasks

**Frontend**:
- React 18 + TypeScript
- Vite for build tooling
- Material-UI for components
- TanStack Query for data fetching
- Zustand for state management

**Testing**:
- Vitest for unit tests
- fast-check for property-based testing
- 30+ property tests validating correctness

## 📱 Applications

### 1. Admin Dashboard (`app-admin`)

**Purpose**: Platform administration and management

**Features**:
- Manage all establishments (create, view, suspend, reactivate)
- Confirm payments and renew subscriptions
- View global statistics across all establishments
- Access audit logs for all actions
- Monitor subscription expirations

**Access**: Admin users only (`role = 'admin'`)

**URL**: `/admin`

### 2. Owner Dashboard (`app-patron`)

**Purpose**: Establishment owner management

**Features**:
- Business analytics and KPIs
- Product and stock management
- Order and invoice tracking
- User management
- Financial reports
- Subscription status monitoring

**Access**: Patron role within establishment

**URL**: `/patron`

### 3. Counter Application (`app-comptoir`)

**Purpose**: Order validation and payment processing

**Features**:
- Validate pending orders
- Generate invoices
- Record payments
- View stock levels
- Process transactions

**Access**: Comptoir role within establishment

**URL**: `/comptoir`

### 4. Waitress Mobile App (`app-serveuse`)

**Purpose**: Order taking on mobile devices

**Features**:
- Create orders for tables
- Add items to orders
- View order history
- Offline support
- Real-time updates

**Access**: Serveuse role within establishment

**Platform**: React Native (Expo)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL (via Supabase or local)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd snack-bar-management

# Install root dependencies
npm install

# Install app dependencies
cd app-admin && npm install && cd ..
cd app-patron && npm install && cd ..
cd app-comptoir && npm install && cd ..
cd app-serveuse && npm install && cd ..
```

### Database Setup

```bash
# Start Supabase (includes PostgreSQL)
supabase start

# Or use Docker PostgreSQL
docker run -d -p 54322:5432 -e POSTGRES_PASSWORD=postgres postgres

# Apply migrations
supabase db push

# Or manually
psql $DATABASE_URL -f supabase/migrations/*.sql
```

### Create Admin User

```bash
# Set environment variables
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Run creation script
./scripts/create-admin-user.sh
```

See [Admin User Setup Guide](docs/ADMIN_USER_SETUP.md) for detailed instructions.

### Run Applications

```bash
# Admin Dashboard
cd app-admin
npm run dev
# Access at http://localhost:3003

# Owner Dashboard
cd app-patron
npm run dev
# Access at http://localhost:3001

# Counter Application
cd app-comptoir
npm run dev
# Access at http://localhost:3002

# Waitress Mobile App
cd app-serveuse
npm start
# Scan QR code with Expo Go app
```

### Run Tests

```bash
# Run all tests
npm test

# Run specific test suite
npm test tests/multi-tenancy/

# Run with coverage
npm run test:coverage
```

## 📚 Documentation

### Core Documentation

- **[Multi-Tenant Architecture](docs/MULTI_TENANT_ARCHITECTURE.md)** - System architecture and design
- **[Deployment Guide](docs/MULTI_TENANT_DEPLOYMENT.md)** - Production deployment instructions
- **[Subscription Management](docs/SUBSCRIPTION_MANAGEMENT.md)** - Managing subscriptions and payments
- **[Admin User Setup](docs/ADMIN_USER_SETUP.md)** - Creating admin users

### Application Documentation

- **[Admin Dashboard](app-admin/README.md)** - Admin application guide
- **[Owner Dashboard](app-patron/README.md)** - Patron application guide
- **[Counter Application](app-comptoir/README.md)** - Comptoir application guide
- **[Waitress Mobile App](app-serveuse/README.md)** - Serveuse application guide

### Development Documentation

- **[Testing Guide](tests/README.md)** - Running and writing tests
- **[Tech Stack](docs/TECH_STACK.md)** - Technology choices and conventions
- **[Project Structure](docs/PROJECT_STRUCTURE.md)** - Codebase organization

## 🔐 Security

### Multi-Tenancy Security

- **RLS Policies**: Database-level data isolation
- **Establishment Filtering**: All queries automatically filtered by `etablissement_id`
- **Admin Separation**: Admin users cannot perform establishment-specific operations
- **Subscription Enforcement**: Expired/suspended establishments denied access

### Authentication

- **Supabase Auth**: Industry-standard authentication
- **JWT Tokens**: Secure session management
- **Role-Based Access**: Different permissions per role
- **Audit Logging**: All actions logged for compliance

### Data Protection

- **Encryption at Rest**: Database encryption via Supabase
- **Encryption in Transit**: HTTPS/TLS for all connections
- **Backup Strategy**: Daily automated backups
- **Data Isolation**: Complete separation between establishments

## 🧪 Testing

### Test Coverage

- **30 Property-Based Tests**: Validating universal correctness properties
- **Unit Tests**: Schema, constraints, triggers, migrations
- **Integration Tests**: End-to-end workflows
- **Frontend Tests**: Component and store tests

### Running Tests

```bash
# All tests
npm test

# Property-based tests only
npm test tests/multi-tenancy/

# Specific test file
npm test tests/multi-tenancy/data-isolation.property.test.ts

# With coverage
npm run test:coverage
```

### Test Categories

| Category | Tests | Description |
|----------|-------|-------------|
| Data Isolation | 5 | Verify establishment data separation |
| Admin Access | 2 | Verify admin cross-establishment access |
| Subscription | 7 | Verify subscription lifecycle |
| Expiration | 4 | Verify automatic expiration |
| Audit Logging | 5 | Verify all actions logged |
| User Management | 3 | Verify user isolation |
| Functionality | 3 | Verify existing features work |

## 📊 Database Schema

### Core Tables

- **etablissements**: Client establishments with subscription info
- **profiles**: User profiles with roles and establishment assignment
- **produits**: Product catalog (per establishment)
- **stock**: Inventory levels (per establishment)
- **tables**: Physical tables (per establishment)
- **commandes**: Customer orders (per establishment)
- **factures**: Invoices (per establishment)
- **encaissements**: Payments (per establishment)
- **audit_logs**: Complete action history

### Key Relationships

```
etablissements (1) ─── (N) profiles
etablissements (1) ─── (N) produits
etablissements (1) ─── (N) commandes
etablissements (1) ─── (N) factures
```

All tables include `etablissement_id` foreign key for data isolation.

## 🔄 Subscription Lifecycle

```
[Created] → [Active] → [Expiring Soon] → [Expired] → [Renewed] → [Active]
                ↓
           [Suspended] → [Reactivated] → [Active]
```

### States

- **Active**: Full access, subscription valid
- **Expiring Soon**: Active but expires within 30 days (warning shown)
- **Expired**: Access denied, subscription past `date_fin`
- **Suspended**: Access denied, manually suspended by admin

### Automatic Expiration

- **Schedule**: Daily at 00:00 UTC
- **Process**: Edge function queries expired establishments and updates status
- **Result**: Users denied access on next login attempt

See [Subscription Management Guide](docs/SUBSCRIPTION_MANAGEMENT.md) for details.

## 🛠️ Development

### Project Structure

```
.
├── app-admin/          # Admin dashboard (React)
├── app-patron/         # Owner dashboard (React)
├── app-comptoir/       # Counter application (React)
├── app-serveuse/       # Waitress mobile app (React Native)
├── supabase/
│   ├── migrations/     # Database migrations
│   └── functions/      # Edge functions
├── tests/              # Test suites
│   ├── multi-tenancy/  # Multi-tenant tests
│   ├── auth/           # Authentication tests
│   ├── commandes/      # Order tests
│   └── ...
├── docs/               # Documentation
└── scripts/            # Utility scripts
```

### Key Conventions

- **Migrations**: Sequential, idempotent, timestamped
- **RLS Policies**: Enforce multi-tenancy at database level
- **Property Tests**: Validate universal correctness properties
- **Audit Logging**: Log all significant actions
- **French Language**: All UI text in French (Cameroon market)

### Adding a New Feature

1. Create spec in `.kiro/specs/`
2. Write requirements and design
3. Create migrations for database changes
4. Implement RLS policies
5. Write property-based tests
6. Implement application code
7. Update documentation

## 📈 Monitoring

### Key Metrics

**Business Metrics**:
- Total establishments
- Active/expired/suspended counts
- Subscription renewals
- Revenue metrics

**Technical Metrics**:
- Database query performance
- API response times
- Error rates
- RLS policy overhead

**Security Metrics**:
- Failed login attempts
- Admin actions
- Unauthorized access attempts
- Subscription expiration events

### Audit Logs

All significant actions logged:
- User logins
- Admin actions (create, suspend, confirm payment)
- Automatic expiration
- Data modifications

Query audit logs:
```sql
SELECT * FROM audit_logs 
WHERE action = 'PAYMENT_CONFIRMED'
ORDER BY date_action DESC 
LIMIT 10;
```

## 🚢 Deployment

### Production Deployment

See [Deployment Guide](docs/MULTI_TENANT_DEPLOYMENT.md) for complete instructions.

**Quick Steps**:
1. Backup current database
2. Apply migrations to production
3. Deploy edge functions
4. Configure cron job
5. Create admin user
6. Deploy applications
7. Verify functionality

### Environment Variables

Each application requires:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Admin user creation requires:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 🤝 Contributing

### Development Workflow

1. Create feature branch
2. Implement changes
3. Write/update tests
4. Update documentation
5. Submit pull request

### Code Standards

- TypeScript strict mode
- ESLint + Prettier
- Property-based tests for core logic
- Comprehensive documentation
- French language for UI

## 📝 License

[Your License Here]

## 🆘 Support

### Documentation

- [Architecture Guide](docs/MULTI_TENANT_ARCHITECTURE.md)
- [Deployment Guide](docs/MULTI_TENANT_DEPLOYMENT.md)
- [Subscription Management](docs/SUBSCRIPTION_MANAGEMENT.md)
- [Admin Setup](docs/ADMIN_USER_SETUP.md)

### Troubleshooting

See [Deployment Guide - Troubleshooting](docs/MULTI_TENANT_DEPLOYMENT.md#troubleshooting) for common issues and solutions.

### Contact

[Your Contact Information]

## 🎉 Acknowledgments

Built with:
- [Supabase](https://supabase.com/) - Backend platform
- [React](https://react.dev/) - Frontend framework
- [Vitest](https://vitest.dev/) - Testing framework
- [fast-check](https://fast-check.dev/) - Property-based testing
- [Material-UI](https://mui.com/) - UI components

---

**Status**: ✅ Production Ready  
**Version**: 2.0.0 (Multi-Tenant)  
**Last Updated**: February 2026

