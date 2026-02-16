# Multi-Tenant SaaS Architecture

## Overview

This document describes the architecture of the multi-tenant SaaS platform for the snack bar management system. The platform enables a SaaS provider to manage multiple snack bar establishments as separate clients, each with isolated data, annual subscriptions, and centralized administration.

## Architecture Principles

### 1. Shared Database, Shared Schema

- All establishments share the same PostgreSQL database
- All establishments use the same table schemas
- Data isolation enforced through `etablissement_id` column + RLS policies
- Cost-effective and easy to maintain

### 2. Database-First Security

- Row Level Security (RLS) enforces multi-tenancy at database level
- Application code cannot bypass security policies
- Defense-in-depth: security at multiple layers

### 3. Subscription-Based Access

- Annual subscriptions with manual payment confirmation
- Automatic expiration after 12 months
- Immediate access denial for expired/suspended accounts

### 4. Admin Separation

- Admin users exist outside establishment context
- Cross-establishment read access for monitoring
- Cannot perform establishment-specific operations

## System Components

### 1. Database Layer

#### Core Tables

**etablissements** - Client establishments
```sql
- id: UUID (primary key)
- nom: TEXT (establishment name)
- statut_abonnement: TEXT ('actif', 'expire', 'suspendu')
- date_debut: TIMESTAMPTZ (subscription start)
- date_fin: TIMESTAMPTZ (subscription end)
- actif: BOOLEAN (access enabled/disabled)
```

**profiles** - User profiles
```sql
- id: UUID (primary key)
- role: TEXT ('serveuse', 'comptoir', 'gerant', 'patron', 'admin')
- etablissement_id: UUID (NULL for admin users)
- nom, prenom: TEXT
- actif: BOOLEAN
```

**All Business Tables**
- produits, stock, tables, commandes, factures, etc.
- Each includes `etablissement_id: UUID NOT NULL`
- Foreign key to etablissements table
- Indexed for efficient filtering

#### RLS Policies

**Establishment Users**:
```sql
-- Example: commandes table
CREATE POLICY "users_access_own_establishment"
  ON commandes FOR ALL
  TO authenticated
  USING (
    etablissement_id = (
      SELECT etablissement_id FROM profiles WHERE id = auth.uid()
    )
  );
```

**Admin Users**:
```sql
-- Example: commandes table
CREATE POLICY "admins_read_all_establishments"
  ON commandes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

#### Database Functions

**confirm_payment_and_extend_subscription()**
- Extends subscription by 12 months
- Reactivates expired establishments
- Logs payment confirmation
- SECURITY DEFINER (admin only)

**suspend_etablissement()**
- Sets status to 'suspendu'
- Disables access (actif = false)
- Logs suspension with reason
- SECURITY DEFINER (admin only)

**reactivate_etablissement()**
- Sets status to 'actif'
- Enables access (actif = true)
- Logs reactivation
- SECURITY DEFINER (admin only)

### 2. Edge Functions

#### expire-subscriptions

**Purpose**: Automatically expire subscriptions after 12 months

**Schedule**: Daily at 00:00 UTC (via pg_cron)

**Logic**:
1. Query establishments where `date_fin < NOW()` AND `statut_abonnement = 'actif'`
2. For each expired establishment:
   - Set `statut_abonnement = 'expire'`
   - Set `actif = false`
   - Log expiration to audit_logs
3. Handle errors gracefully (continue on individual failures)
4. Return summary of expired establishments

**Error Handling**:
- Individual failures don't stop processing
- All errors logged to audit_logs
- Summary includes successes and failures

### 3. Application Layer

#### app-admin (Admin Dashboard)

**Purpose**: Platform administration and management

**Features**:
- View all establishments
- Create new establishments
- Confirm payments and extend subscriptions
- Suspend/reactivate establishments
- View global statistics
- Access audit logs

**Access**: Admin users only (`role = 'admin'`)

**Technology**: React + TypeScript + Material-UI

#### app-patron (Owner Dashboard)

**Purpose**: Establishment owner management

**Features**:
- View business analytics
- Manage products and stock
- View orders and invoices
- Manage users
- View subscription status

**Access**: Patron role within establishment

**Multi-Tenant Changes**:
- Displays establishment name in header
- Shows subscription status and expiration warning
- Access denied if subscription expired

#### app-comptoir (Counter Application)

**Purpose**: Order validation and payment processing

**Features**:
- Validate pending orders
- Generate invoices
- Record payments
- View stock levels

**Access**: Comptoir role within establishment

**Multi-Tenant Changes**:
- Displays establishment name
- Access denied if subscription expired

#### app-serveuse (Waitress Mobile App)

**Purpose**: Order taking on mobile devices

**Features**:
- Create orders
- Add items to orders
- View order history
- Offline support

**Access**: Serveuse role within establishment

**Multi-Tenant Changes**:
- Displays establishment name
- Access denied if subscription expired

## Data Flow

### User Authentication Flow

```
1. User enters credentials
   ↓
2. Supabase Auth validates
   ↓
3. Profile lookup (includes etablissement_id)
   ↓
4. Check establishment status (actif, statut_abonnement)
   ↓
5. If expired/suspended → Deny access
   ↓
6. If active → Generate JWT with etablissement_id
   ↓
7. All queries filtered by etablissement_id via RLS
```

### Admin Authentication Flow

```
1. Admin enters credentials
   ↓
2. Supabase Auth validates
   ↓
3. Profile lookup (role = 'admin', etablissement_id = NULL)
   ↓
4. Generate JWT with admin role
   ↓
5. Admin RLS policies allow cross-establishment read access
   ↓
6. Admin functions allow management operations
```

### Subscription Expiration Flow

```
1. Cron job triggers daily at 00:00 UTC
   ↓
2. Edge function queries expired establishments
   ↓
3. For each expired establishment:
   - Update status to 'expire'
   - Set actif = false
   - Log to audit_logs
   ↓
4. Users from expired establishments denied access on next login
```

### Payment Confirmation Flow

```
1. Admin confirms payment received
   ↓
2. Admin dashboard calls confirm_payment_and_extend_subscription()
   ↓
3. Function verifies admin role
   ↓
4. Function extends date_fin by 12 months
   ↓
5. Function sets statut_abonnement = 'actif', actif = true
   ↓
6. Function logs payment confirmation
   ↓
7. Establishment users can access system again
```

## Security Model

### Multi-Tenancy Security

**Database Level**:
- RLS policies enforce etablissement_id filtering
- Cannot be bypassed by application code
- Applies to all queries (SELECT, INSERT, UPDATE, DELETE)

**Application Level**:
- Subscription status checked on login
- Expired/suspended establishments denied access
- JWT includes etablissement_id for RLS filtering

**Admin Level**:
- Admin users have NULL etablissement_id
- Special RLS policies for cross-establishment access
- Admin functions use SECURITY DEFINER
- All admin actions logged

### Data Isolation

**Horizontal Isolation** (between establishments):
- RLS policies filter by etablissement_id
- Foreign keys respect establishment boundaries
- Indexes on etablissement_id for performance

**Vertical Isolation** (within establishment):
- Role-based access control (RBAC)
- Serveuses see only their orders
- Comptoir sees all orders
- Gerant/Patron see all data

### Audit Logging

All significant actions logged:
- User logins
- Admin actions (create establishment, confirm payment, suspend, reactivate)
- Automatic expiration events
- Data modifications (via triggers)

Audit log includes:
- user_id (NULL for system actions)
- action type
- table_name and record_id
- details (JSONB)
- etablissement_id
- timestamp

## Scalability Considerations

### Database Performance

**Indexes**:
- All tables have index on etablissement_id
- Composite indexes for common queries
- Sequential number generation optimized

**Connection Pooling**:
- Supabase manages connection pooling
- RLS policies add minimal overhead
- Queries remain efficient with proper indexes

**Query Optimization**:
- RLS filtering happens at database level
- Indexes used for etablissement_id filtering
- Admin queries bypass establishment filtering efficiently

### Application Scaling

**Horizontal Scaling**:
- Stateless applications (React SPAs)
- Can deploy multiple instances
- Load balancing at CDN level

**Caching**:
- Static assets cached at CDN
- API responses can be cached per establishment
- Real-time subscriptions for live updates

### Growth Projections

**Current Capacity**:
- Single PostgreSQL database
- Supports 100+ establishments
- Thousands of users per establishment

**Future Scaling**:
- Database read replicas for reporting
- Separate analytics database
- Sharding by etablissement_id if needed

## Monitoring and Observability

### Key Metrics

**Business Metrics**:
- Total establishments
- Active/expired/suspended counts
- Subscription renewals per month
- User logins per establishment

**Technical Metrics**:
- Database query performance
- RLS policy overhead
- API response times
- Error rates per establishment

**Security Metrics**:
- Failed login attempts
- Admin actions
- Unauthorized access attempts
- Subscription expiration events

### Logging

**Application Logs**:
- User actions
- Errors and exceptions
- Performance metrics

**Database Logs**:
- Slow queries
- RLS policy violations
- Constraint violations

**Audit Logs**:
- All significant actions
- Admin operations
- System events

## Disaster Recovery

### Backup Strategy

**Database Backups**:
- Daily automated backups (Supabase)
- Point-in-time recovery available
- Backup retention: 30 days

**Application Backups**:
- Source code in Git
- Deployment configurations versioned
- Environment variables documented

### Recovery Procedures

**Database Recovery**:
1. Identify issue and impact
2. Stop accepting new traffic
3. Restore from backup or point-in-time
4. Verify data integrity
5. Resume traffic

**Application Recovery**:
1. Identify failing component
2. Rollback to previous deployment
3. Verify functionality
4. Monitor for issues

## Future Enhancements

### Phase 2 Features

1. **Automated Payments**
   - Stripe/PayPal integration
   - Automatic subscription renewal
   - Payment failure handling

2. **Self-Service Registration**
   - Public registration page
   - Email verification
   - Trial period support

3. **Email Notifications**
   - Expiration warnings (30, 15, 7 days)
   - Payment confirmations
   - Suspension notices

4. **Tiered Pricing**
   - Multiple subscription plans
   - Feature flags per plan
   - Usage-based billing

5. **API Access**
   - REST API for third-party integrations
   - API keys per establishment
   - Rate limiting

### Phase 3 Features

1. **Advanced Analytics**
   - Cross-establishment benchmarking
   - Predictive analytics
   - Custom reports

2. **White-Label Support**
   - Custom branding per establishment
   - Custom domains
   - Branded mobile apps

3. **Multi-Region Support**
   - Regional databases
   - Data residency compliance
   - Global CDN

## Conclusion

The multi-tenant SaaS architecture provides a scalable, secure, and maintainable platform for managing multiple snack bar establishments. The database-first security model ensures data isolation, while the subscription management system provides automated access control. The architecture is designed to scale from tens to hundreds of establishments while maintaining performance and security.

