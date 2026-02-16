# Implementation Plan: Multi-Tenant SaaS Platform

## Overview

This implementation plan transforms the single-tenant snack bar management system into a multi-tenant SaaS platform. The approach follows a careful migration strategy: first add multi-tenancy infrastructure, then migrate existing data, then add admin features, and finally update existing applications.

## Tasks

- [x] 1. Create etablissements table and multi-tenancy infrastructure
  - Create migration `20240128000000_create_etablissements.sql`
  - Define `etablissements` table with subscription fields
  - Add indexes for status, date_fin, and actif columns
  - Enable RLS on etablissements table
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 1.1 Write property test for etablissement creation
  - **Property 8: Unique Establishment IDs**
  - **Property 9: Establishment Creation Defaults**
  - **Property 10: Valid Establishment Status Values**
  - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

- [x] 2. Add etablissement_id to all existing tables
  - Create migration `20240128000001_add_etablissement_id.sql`
  - Add `etablissement_id UUID` column to all tables (profiles, produits, stock, mouvements_stock, tables, commandes, commande_items, ravitaillements, ravitaillement_items, factures, encaissements, audit_logs)
  - Add foreign key constraints with ON DELETE RESTRICT
  - Create indexes on etablissement_id for all tables
  - Allow NULL temporarily for migration
  - _Requirements: 1.1, 1.5, 1.6_

- [x] 3. Modify profiles table for admin role support
  - Create migration `20240128000002_admin_role_support.sql`
  - Update role CHECK constraint to include 'admin'
  - Add CHECK constraint: admin users must have NULL etablissement_id, others must have non-NULL
  - Make etablissement_id nullable
  - _Requirements: 6.1, 6.3_

- [x] 3.1 Write property test for admin role constraints
  - **Property 19: Admin Role Validation**
  - **Validates: Requirements 6.1, 6.3, 14.2**

- [x] 4. Create data migration for existing single-tenant data
  - Create migration `20240128000003_migrate_existing_data.sql`
  - Create default establishment named "Établissement Principal"
  - Set subscription: actif, date_debut = NOW(), date_fin = NOW() + 12 months
  - Update all existing records to set etablissement_id to default establishment ID
  - Validate all records have etablissement_id (except admin users)
  - Make etablissement_id NOT NULL after migration (except profiles)
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.6_

- [x] 4.1 Write unit tests for data migration
  - Test default establishment is created
  - Test all records are assigned to default establishment
  - Test referential integrity is preserved
  - Test migration is idempotent
  - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6**

- [x] 5. Checkpoint - Verify schema changes
  - Run all migrations on test database
  - Verify all tables have etablissement_id column
  - Verify all existing data has been migrated
  - Verify existing tests still pass
  - Ask user if questions arise

- [x] 6. Create subscription management functions
  - Create migration `20240128000004_subscription_functions.sql`
  - Implement `confirm_payment_and_extend_subscription()` function
  - Implement `suspend_etablissement()` function
  - Implement `reactivate_etablissement()` function
  - All functions use SECURITY DEFINER and verify admin role
  - All functions log actions to audit_logs
  - _Requirements: 3.4, 3.5, 3.6, 12.3, 12.4, 12.5_

- [x] 6.1 Write property tests for subscription management
  - **Property 12: Payment Confirmation Extends Subscription**
  - **Property 13: Payment Confirmation Audit Fields**
  - **Property 14: Subscription Renewal Reactivates Expired Establishment**
  - **Validates: Requirements 3.4, 3.5, 3.6, 12.3, 12.4, 12.5**

- [x] 7. Modify all existing RLS policies for multi-tenancy
  - Create migration `20240128000005_multi_tenant_rls_policies.sql`
  - Drop all existing RLS policies
  - Recreate all policies with etablissement_id filtering
  - Pattern: Add `AND etablissement_id = (SELECT etablissement_id FROM profiles WHERE id = auth.uid())`
  - Apply to all tables: profiles, produits, stock, mouvements_stock, tables, commandes, commande_items, ravitaillements, ravitaillement_items, factures, encaissements, audit_logs
  - _Requirements: 1.3, 1.4, 8.1, 8.2, 8.3, 8.4, 8.5, 8.7_

- [x] 7.1 Write property tests for data isolation (SELECT)
  - **Property 1: Establishment Data Isolation (SELECT)**
  - **Validates: Requirements 1.3, 1.4, 8.1, 8.2, 11.1**

- [x] 7.2 Write property tests for data isolation (INSERT)
  - **Property 2: Establishment Data Isolation (INSERT)**
  - **Validates: Requirements 8.3, 9.1, 9.2**

- [x] 7.3 Write property tests for data isolation (UPDATE)
  - **Property 3: Establishment Data Isolation (UPDATE)**
  - **Validates: Requirements 8.4, 9.4, 11.2**

- [x] 7.4 Write property tests for data isolation (DELETE)
  - **Property 4: Establishment Data Isolation (DELETE)**
  - **Validates: Requirements 8.5, 11.3**

- [x] 7.5 Write property test for foreign key boundaries
  - **Property 5: Foreign Key Establishment Boundaries**
  - **Validates: Requirements 1.5, 1.6, 11.4**

- [x] 7.6 Write property test for user etablissement_id immutability
  - **Property 7: User Cannot Modify Own Etablissement ID**
  - **Validates: Requirements 8.7**

- [x] 8. Create admin RLS policies
  - Create migration `20240128000006_admin_rls_policies.sql`
  - Create admin read policies for all tables (bypass etablissement_id filter)
  - Create admin policies for etablissements table (full CRUD)
  - Ensure admin users cannot perform establishment-specific operations without context
  - _Requirements: 6.2, 6.4, 8.6_

- [x] 8.1 Write property tests for admin access
  - **Property 6: Admin Cross-Establishment Read Access**
  - **Property 20: Admin Operation Restrictions**
  - **Validates: Requirements 6.2, 6.4, 8.6, 11.5, 11.6**

- [x] 9. Checkpoint - Verify RLS policies
  - Run all migrations on test database
  - Run all property tests for data isolation
  - Verify users can only access their establishment's data
  - Verify admin users can access all establishments
  - Ask user if questions arise

- [x] 10. Create Edge Function for automatic expiration
  - Create `supabase/functions/expire-subscriptions/index.ts`
  - Implement expiration logic: query establishments where date_fin < NOW() and statut_abonnement = 'actif'
  - Update each expired establishment: set statut_abonnement = 'expire', actif = false
  - Log each expiration to audit_logs
  - Handle errors gracefully (continue on individual failures)
  - Return summary of expired establishments
  - _Requirements: 4.2, 4.3, 4.5, 13.3, 13.4, 13.5, 13.6_

- [x] 10.1 Write property tests for expiration logic
  - **Property 15: Expiration Status Updates**
  - **Property 16: Expiration Query Correctness**
  - **Property 17: Expiration Isolation**
  - **Property 18: Expiration Error Handling**
  - **Validates: Requirements 4.2, 4.3, 4.5, 11.7, 13.3, 13.4, 13.5, 13.6**

- [x] 11. Configure cron job for expiration
  - Create migration `20240128000007_configure_expiration_cron.sql`
  - Use pg_cron to schedule daily execution at 00:00 UTC
  - Configure to call expire-subscriptions Edge Function
  - _Requirements: 4.1, 4.6, 13.2_

- [x] 12. Enhance audit logging for multi-tenancy
  - Create migration `20240128000008_multi_tenant_audit_logging.sql`
  - Ensure audit_logs includes etablissement_id in all entries
  - Add audit logging for admin actions (create establishment, confirm payment, suspend, reactivate)
  - Add audit logging for automatic expiration
  - Distinguish admin actions from user actions in logs
  - _Requirements: 6.5, 10.1, 10.2, 10.3, 10.4, 10.6, 10.7_

- [x] 12.1 Write property tests for audit logging
  - **Property 21: Admin Action Audit Logging**
  - **Property 22: Expiration Audit Logging**
  - **Property 23: Audit Log Etablissement ID**
  - **Property 24: Audit Log Actor Distinction**
  - **Validates: Requirements 4.5, 6.5, 10.1, 10.2, 10.3, 10.4, 10.6, 10.7**

- [x] 13. Create admin dashboard application (app-admin)
  - Initialize React + TypeScript project with Vite
  - Set up project structure: components/, screens/, hooks/, store/, types/
  - Configure Supabase client
  - Set up routing with React Router
  - Copy shared utilities from app-patron (format.ts, etc.)
  - _Requirements: 5.1, 5.4_

- [x] 14. Implement admin authentication
  - Create LoginScreen component
  - Create authStore with Zustand (admin-specific)
  - Implement login with Supabase auth
  - Verify user has admin role after login
  - Redirect non-admin users
  - Add logout functionality
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

- [x] 14.1 Write property test for admin login audit logging
  - **Property 25: Admin Login Audit Logging**
  - **Validates: Requirements 14.7**

- [x] 15. Create admin dashboard layout and navigation
  - Create Layout component with navigation menu
  - Add routes: Dashboard, Establishments, Global Stats
  - Display admin user info in header
  - Add responsive design
  - _Requirements: 5.1_

- [x] 16. Implement establishments list screen
  - Create EtablissementsScreen component
  - Display all establishments with status indicators
  - Show subscription end dates
  - Add search and filter functionality (by status)
  - Add quick actions: view details, suspend, confirm payment
  - Use useSupabaseQuery hook for data fetching
  - _Requirements: 5.1, 5.2_

- [x] 17. Implement establishment detail screen
  - Create EtablissementDetailScreen component
  - Display full establishment information
  - Show subscription history
  - Show payment confirmation history
  - Display user list for the establishment
  - Show recent activity logs
  - Add actions: suspend, reactivate, confirm payment, edit details
  - _Requirements: 5.3_

- [x] 18. Implement create establishment screen
  - Create CreateEtablissementScreen component
  - Form fields: name, address, phone, email
  - Automatically set subscription dates (start = now, end = now + 12 months)
  - Call database function to create establishment
  - Redirect to establishment detail after creation
  - _Requirements: 5.4, 10.1_

- [x] 19. Implement global statistics screen
  - Create GlobalStatsScreen component
  - Display total establishments count
  - Display active/expired/suspended counts
  - Display total users across all establishments
  - Show establishments expiring within 30 days
  - Add charts for growth metrics (optional)
  - _Requirements: 5.6_

- [x] 20. Implement payment confirmation workflow
  - Add confirm payment button to establishment detail screen
  - Create confirmation dialog
  - Call `confirm_payment_and_extend_subscription()` function
  - Display success message with new end date
  - Refresh establishment data
  - _Requirements: 3.4, 3.5, 3.6, 5.7, 12.3_

- [x] 21. Implement suspend/reactivate workflows
  - Add suspend button to establishment detail screen
  - Create suspension dialog with reason field
  - Call `suspend_etablissement()` function
  - Add reactivate button for suspended establishments
  - Call `reactivate_etablissement()` function
  - Display success messages
  - _Requirements: 2.6, 10.3_

- [x] 22. Checkpoint - Test admin dashboard
  - Create test admin user
  - Test all admin dashboard screens
  - Test establishment creation
  - Test payment confirmation
  - Test suspend/reactivate
  - Verify audit logs are created
  - Ask user if questions arise

- [x] 23. Modify existing apps for multi-tenancy awareness
  - Update app-serveuse, app-comptoir, app-patron
  - Add establishment name display in Layout header
  - Query establishment info from profiles join
  - _Requirements: 15.1_

- [x] 24. Add subscription status display for patrons
  - Update app-patron DashboardScreen
  - Query establishment subscription status
  - Display warning if expiring within 30 days
  - Display expiration message if expired
  - Show subscription end date
  - _Requirements: 15.2, 15.3, 15.4, 15.5_

- [x] 25. Implement access denial for expired accounts
  - Add subscription status check to auth middleware
  - Check etablissement.actif and statut_abonnement on login
  - Deny access if not active
  - Display appropriate error message
  - Apply to all three apps (serveuse, comptoir, patron)
  - _Requirements: 2.6, 3.7, 4.4, 9.5, 11.1_

- [x] 25.1 Write property test for inactive establishment access denial
  - **Property 11: Inactive Establishment Access Denial**
  - **Validates: Requirements 2.6, 3.7, 4.4, 9.5, 15.4**

- [x] 26. Update user management for multi-tenancy
  - Modify user creation to inherit etablissement_id from creator
  - Update user list queries to filter by etablissement_id
  - Prevent cross-establishment user modifications
  - Apply to app-patron UtilisateursScreen
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 26.1 Write property tests for user management
  - **Property 26: User Establishment Inheritance**
  - **Property 27: User List Filtering**
  - **Validates: Requirements 9.1, 9.2, 9.3, 9.4**

- [x] 27. Verify existing functionality preservation
  - Run all existing tests
  - Test order creation and validation
  - Test ravitaillement recording
  - Test invoice generation
  - Test payment collection
  - Verify all operations work within establishment context
  - _Requirements: 15.6_

- [x] 27.1 Write property test for functionality preservation
  - **Property 30: Existing Functionality Preservation**
  - **Validates: Requirements 15.6**

- [x] 28. Update database types for all applications
  - Regenerate TypeScript types from Supabase schema
  - Update database.types.ts in all apps
  - Add Etablissement interface
  - Update Profile interface with etablissement_id
  - Update all table interfaces with etablissement_id
  - _Requirements: All_

- [x] 29. Create admin initialization script
  - Create script to create first admin user
  - Script should use Supabase service role key
  - Create user in auth.users
  - Create profile with role='admin', etablissement_id=NULL
  - Document the process in README
  - _Requirements: 14.1_

- [x] 30. Final checkpoint - End-to-end testing
  - Create multiple test establishments
  - Create users for each establishment
  - Test data isolation between establishments
  - Test admin dashboard functionality
  - Test subscription expiration (manually trigger)
  - Test payment confirmation and renewal
  - Verify audit logs
  - Run all property tests
  - Ensure all tests pass
  - Ask user if questions arise

- [x] 31. Documentation and deployment guide
  - Document multi-tenancy architecture
  - Document admin dashboard usage
  - Document subscription management workflow
  - Document migration process for production
  - Create deployment checklist
  - Update README with multi-tenant setup instructions
  - _Requirements: All_

## Notes

- All tasks are required for comprehensive multi-tenancy implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties (30 properties total)
- Unit tests validate specific examples, migrations, and edge cases
- All database changes are in migrations following the project's migration conventions
- Admin dashboard is a new React application following the same patterns as existing apps
- Existing applications are modified minimally to add multi-tenancy awareness
