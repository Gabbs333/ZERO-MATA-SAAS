# Multi-Tenant SaaS Deployment Guide

This guide provides step-by-step instructions for deploying the multi-tenant SaaS platform to production.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Database Migration](#database-migration)
4. [Edge Function Deployment](#edge-function-deployment)
5. [Cron Job Configuration](#cron-job-configuration)
6. [Admin User Creation](#admin-user-creation)
7. [Application Deployment](#application-deployment)
8. [Post-Deployment Verification](#post-deployment-verification)
9. [Rollback Procedure](#rollback-procedure)
10. [Troubleshooting](#troubleshooting)

## Prerequisites

Before deploying, ensure you have:

- ✅ Supabase project (production instance)
- ✅ Database backup of current production data
- ✅ Supabase CLI installed (`npm install -g supabase`)
- ✅ Access to Supabase project credentials:
  - Project URL
  - Service role key
  - Database connection string
- ✅ All migrations tested in staging environment
- ✅ Deployment window scheduled (recommended: low-traffic period)

## Pre-Deployment Checklist

### 1. Backup Current Database

```bash
# Create a full database backup
supabase db dump -f backup-$(date +%Y%m%d-%H%M%S).sql

# Or using pg_dump directly
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql
```

### 2. Test Migrations in Staging

```bash
# Apply migrations to staging database
supabase db push --db-url $STAGING_DATABASE_URL

# Run tests
npm test

# Verify data integrity
psql $STAGING_DATABASE_URL -c "SELECT COUNT(*) FROM etablissements;"
```

### 3. Prepare Rollback Plan

- Document current schema version
- Keep backup SQL file accessible
- Prepare rollback migration scripts if needed
- Test rollback procedure in staging

### 4. Notify Users

- Schedule maintenance window
- Notify all establishment users
- Prepare status page updates
- Have support team ready

## Database Migration

### Step 1: Connect to Production Database

```bash
# Set production database URL
export DATABASE_URL="postgresql://postgres:[password]@[host]:5432/postgres"

# Or use Supabase CLI
supabase link --project-ref your-project-ref
```

### Step 2: Apply Migrations

The migrations must be applied in order:

```bash
# Apply all multi-tenant migrations
supabase db push

# Or apply manually in order:
psql $DATABASE_URL -f supabase/migrations/20240128000000_create_etablissements.sql
psql $DATABASE_URL -f supabase/migrations/20240128000001_add_etablissement_id.sql
psql $DATABASE_URL -f supabase/migrations/20240128000002_admin_role_support.sql
psql $DATABASE_URL -f supabase/migrations/20240128000003_migrate_existing_data.sql
psql $DATABASE_URL -f supabase/migrations/20240128000004_subscription_functions.sql
psql $DATABASE_URL -f supabase/migrations/20240128000005_multi_tenant_rls_policies.sql
psql $DATABASE_URL -f supabase/migrations/20240128000006_admin_rls_policies.sql
psql $DATABASE_URL -f supabase/migrations/20240128000007_configure_expiration_cron.sql
psql $DATABASE_URL -f supabase/migrations/20240128000008_multi_tenant_audit_logging.sql
```

### Step 3: Verify Migration Success

```bash
# Check etablissements table exists
psql $DATABASE_URL -c "\d etablissements"

# Check default establishment was created
psql $DATABASE_URL -c "SELECT * FROM etablissements WHERE nom = 'Établissement Principal';"

# Check all tables have etablissement_id
psql $DATABASE_URL -c "SELECT table_name FROM information_schema.columns WHERE column_name = 'etablissement_id';"

# Verify data migration
psql $DATABASE_URL -c "SELECT COUNT(*) FROM profiles WHERE etablissement_id IS NOT NULL;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM commandes WHERE etablissement_id IS NOT NULL;"
```

### Step 4: Verify RLS Policies

```bash
# Check RLS is enabled on all tables
psql $DATABASE_URL -c "
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = true;
"

# Check policy count
psql $DATABASE_URL -c "
SELECT COUNT(*) 
FROM pg_policies 
WHERE schemaname = 'public';
"
```

## Edge Function Deployment

### Step 1: Deploy Expiration Function

```bash
# Deploy the expire-subscriptions function
supabase functions deploy expire-subscriptions

# Or manually:
cd supabase/functions/expire-subscriptions
supabase functions deploy expire-subscriptions --project-ref your-project-ref
```

### Step 2: Set Environment Variables

```bash
# Set required environment variables for the function
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Step 3: Test Edge Function

```bash
# Invoke the function manually to test
supabase functions invoke expire-subscriptions --project-ref your-project-ref

# Check the response
# Expected: {"success": true, "expired_count": 0, "results": []}
```

## Cron Job Configuration

### Option 1: Using Supabase Dashboard

1. Go to Database > Cron Jobs
2. Create new cron job:
   - Name: `expire-subscriptions-daily`
   - Schedule: `0 0 * * *` (daily at midnight UTC)
   - Command: Call edge function via HTTP

### Option 2: Using SQL

```sql
-- The migration already includes this, but verify it's configured:
SELECT * FROM cron.job WHERE jobname = 'expire-subscriptions-daily';

-- If not configured, run:
SELECT cron.schedule(
  'expire-subscriptions-daily',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/expire-subscriptions',
    headers := jsonb_build_object(
      'Authorization', 
      'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
  $$
);
```

### Step 3: Verify Cron Job

```sql
-- Check cron job is scheduled
SELECT * FROM cron.job WHERE jobname = 'expire-subscriptions-daily';

-- Check cron job history (after first run)
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'expire-subscriptions-daily')
ORDER BY start_time DESC 
LIMIT 5;
```

## Admin User Creation

### Step 1: Create Admin Function

```bash
# Apply the admin function migration
psql $DATABASE_URL -f scripts/create-admin-function.sql
```

### Step 2: Create First Admin User

```bash
# Set environment variables
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Run the creation script
./scripts/create-admin-user.sh
```

Follow the prompts to enter:
- Admin email
- Admin password
- First name
- Last name

### Step 3: Verify Admin User

```sql
-- Check admin user was created
SELECT id, email, role, etablissement_id, actif
FROM profiles
WHERE role = 'admin';

-- Expected result:
-- role = 'admin'
-- etablissement_id = NULL
-- actif = true
```

## Application Deployment

### App-Admin (Admin Dashboard)

```bash
cd app-admin

# Install dependencies
npm install

# Build for production
npm run build

# Deploy to hosting (example: Vercel)
vercel --prod

# Or deploy to Netlify
netlify deploy --prod --dir=dist
```

### App-Patron (Owner Dashboard)

```bash
cd app-patron

# Install dependencies
npm install

# Build for production
npm run build

# Deploy
vercel --prod
```

### App-Comptoir (Counter Application)

```bash
cd app-comptoir

# Install dependencies
npm install

# Build for production
npm run build

# Deploy
vercel --prod
```

### App-Serveuse (Waitress Mobile App)

```bash
cd app-serveuse

# Install dependencies
npm install

# Build for production
npm run build

# Deploy or publish to app stores
```

### Environment Variables

Ensure all applications have correct environment variables:

```bash
# .env.production
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Post-Deployment Verification

### 1. Database Verification

```bash
# Check all migrations applied
psql $DATABASE_URL -c "SELECT * FROM supabase_migrations.schema_migrations ORDER BY version;"

# Check data integrity
psql $DATABASE_URL -c "
SELECT 
  (SELECT COUNT(*) FROM etablissements) as etablissements,
  (SELECT COUNT(*) FROM profiles WHERE etablissement_id IS NOT NULL) as users,
  (SELECT COUNT(*) FROM commandes WHERE etablissement_id IS NOT NULL) as commandes,
  (SELECT COUNT(*) FROM produits WHERE etablissement_id IS NOT NULL) as produits;
"
```

### 2. Admin Dashboard Test

1. Navigate to admin dashboard URL
2. Log in with admin credentials
3. Verify you can see:
   - Establishments list
   - Global statistics
   - Audit logs
4. Test creating a new establishment
5. Test payment confirmation workflow

### 3. Establishment User Test

1. Create a test user for the default establishment
2. Log in to app-patron
3. Verify:
   - Establishment name is displayed
   - Subscription status is shown
   - All existing features work
   - Data is filtered to establishment

### 4. Data Isolation Test

1. Create two test establishments
2. Create users for each establishment
3. Log in as user from establishment A
4. Verify you cannot see data from establishment B
5. Repeat for establishment B

### 5. Subscription Workflow Test

1. Create a test establishment
2. Set expiration date to past
3. Run expiration function manually
4. Verify establishment is marked as expired
5. Verify users cannot log in
6. Confirm payment as admin
7. Verify establishment is reactivated
8. Verify users can log in again

### 6. Cron Job Test

```sql
-- Check cron job ran successfully
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'expire-subscriptions-daily')
ORDER BY start_time DESC 
LIMIT 1;

-- Check audit logs for expiration events
SELECT * FROM audit_logs 
WHERE action = 'SUBSCRIPTION_EXPIRED'
ORDER BY date_action DESC 
LIMIT 5;
```

## Rollback Procedure

If issues are encountered during deployment:

### Step 1: Stop New Deployments

```bash
# Stop accepting new traffic
# Update status page
# Notify users
```

### Step 2: Restore Database

```bash
# Restore from backup
psql $DATABASE_URL < backup-YYYYMMDD-HHMMSS.sql

# Or use Supabase dashboard to restore from point-in-time backup
```

### Step 3: Rollback Applications

```bash
# Revert to previous deployment
vercel rollback

# Or redeploy previous version
git checkout previous-version
npm run build
vercel --prod
```

### Step 4: Verify Rollback

- Test all critical functionality
- Verify data integrity
- Check user access
- Monitor error logs

## Troubleshooting

### Migration Fails

**Issue**: Migration fails with foreign key constraint error

**Solution**:
```sql
-- Check for orphaned records
SELECT * FROM commandes WHERE etablissement_id IS NULL;

-- Fix orphaned records
UPDATE commandes 
SET etablissement_id = (SELECT id FROM etablissements LIMIT 1)
WHERE etablissement_id IS NULL;
```

### RLS Policies Block Access

**Issue**: Users cannot access their data after migration

**Solution**:
```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Check policies exist
SELECT * FROM pg_policies WHERE schemaname = 'public';

-- Verify user's etablissement_id
SELECT id, email, etablissement_id FROM profiles WHERE email = 'user@example.com';
```

### Admin Cannot Access Dashboard

**Issue**: Admin user cannot log in to admin dashboard

**Solution**:
```sql
-- Verify admin user configuration
SELECT id, email, role, etablissement_id FROM profiles WHERE role = 'admin';

-- Fix admin user if needed
UPDATE profiles 
SET role = 'admin', etablissement_id = NULL 
WHERE email = 'admin@example.com';
```

### Cron Job Not Running

**Issue**: Expiration cron job is not executing

**Solution**:
```sql
-- Check cron job exists
SELECT * FROM cron.job WHERE jobname = 'expire-subscriptions-daily';

-- Check for errors
SELECT * FROM cron.job_run_details 
WHERE status = 'failed' 
ORDER BY start_time DESC;

-- Manually trigger to test
SELECT cron.schedule(
  'test-expiration',
  '* * * * *',
  $$ SELECT net.http_post(...) $$
);
```

### Edge Function Errors

**Issue**: Edge function returns errors

**Solution**:
```bash
# Check function logs
supabase functions logs expire-subscriptions

# Test function locally
supabase functions serve expire-subscriptions

# Redeploy function
supabase functions deploy expire-subscriptions
```

## Monitoring

### Key Metrics to Monitor

1. **Database Performance**
   - Query execution time
   - Connection pool usage
   - RLS policy overhead

2. **Application Performance**
   - Page load times
   - API response times
   - Error rates

3. **Business Metrics**
   - Active establishments
   - Expired establishments
   - User logins per establishment
   - Subscription renewals

### Monitoring Queries

```sql
-- Active establishments
SELECT COUNT(*) FROM etablissements WHERE actif = true;

-- Expiring soon (within 30 days)
SELECT COUNT(*) FROM etablissements 
WHERE date_fin < NOW() + INTERVAL '30 days' 
AND statut_abonnement = 'actif';

-- Recent admin actions
SELECT * FROM audit_logs 
WHERE user_id IN (SELECT id FROM profiles WHERE role = 'admin')
ORDER BY date_action DESC 
LIMIT 10;

-- Failed login attempts
SELECT * FROM audit_logs 
WHERE action = 'LOGIN_FAILED'
ORDER BY date_action DESC 
LIMIT 10;
```

## Support

For issues during deployment:

1. Check this troubleshooting guide
2. Review audit logs for errors
3. Check Supabase dashboard for database issues
4. Review application logs
5. Contact development team

## Post-Deployment Tasks

After successful deployment:

1. ✅ Monitor system for 24 hours
2. ✅ Verify cron job runs successfully
3. ✅ Check audit logs for anomalies
4. ✅ Test all critical workflows
5. ✅ Update documentation with any issues found
6. ✅ Schedule follow-up review meeting
7. ✅ Archive deployment logs and backups

## Conclusion

This deployment guide provides a comprehensive process for migrating to the multi-tenant SaaS platform. Follow each step carefully and verify at each stage to ensure a smooth deployment.

For questions or issues, refer to the troubleshooting section or contact the development team.

