# Requirements Document: Multi-Tenant SaaS Platform

## Introduction

This specification defines the transformation of the single-tenant snack bar management system into a multi-tenant SaaS platform. The platform will enable a SaaS provider to manage multiple snack bar establishments as separate clients, each with isolated data, annual subscriptions, and manual payment confirmation.

## Glossary

- **Etablissement**: A snack bar establishment (client account in the SaaS)
- **SaaS_Provider**: The company operating the multi-tenant platform
- **Admin**: User with administrative privileges to manage all establishments
- **Subscription**: Annual contract for one establishment
- **Multi_Tenant_Architecture**: Database design where multiple clients share infrastructure but have isolated data
- **RLS**: Row Level Security - PostgreSQL security mechanism for data isolation
- **Edge_Function**: Supabase serverless function for background tasks
- **Etablissement_ID**: Unique identifier used to isolate data per establishment

## Requirements

### Requirement 1: Multi-Tenant Database Architecture

**User Story:** As a SaaS provider, I want complete data isolation between establishments, so that each client's data remains private and secure.

#### Acceptance Criteria

1. THE System SHALL add an `etablissement_id` column to all existing tables (profiles, produits, stock, tables, commandes, commande_items, ravitaillements, ravitaillement_items, factures, encaissements, mouvements_stock, audit_logs)
2. THE System SHALL create an `etablissements` table to store client establishment information
3. WHEN any user queries data, THE System SHALL automatically filter results by their `etablissement_id` through RLS policies
4. WHEN a user attempts to access data from another establishment, THE System SHALL deny access through RLS policies
5. THE System SHALL ensure foreign key relationships respect `etablissement_id` boundaries
6. THE System SHALL maintain referential integrity within each establishment's data scope

### Requirement 2: Establishment Management

**User Story:** As an admin, I want to create and manage establishment accounts, so that I can onboard new clients to the platform.

#### Acceptance Criteria

1. WHEN an admin creates a new establishment, THE System SHALL generate a unique `etablissement_id`
2. WHEN creating an establishment, THE System SHALL record the establishment name, contact information, and subscription details
3. THE System SHALL support establishment status values: 'actif', 'expire', 'suspendu'
4. WHEN an establishment is created, THE System SHALL set the initial status to 'actif'
5. THE System SHALL store establishment metadata including creation date, address, phone, and email
6. WHEN an establishment is suspended, THE System SHALL prevent all users from that establishment from accessing the system

### Requirement 3: Subscription Management

**User Story:** As an admin, I want to manage annual subscriptions for each establishment, so that I can control access based on payment status.

#### Acceptance Criteria

1. WHEN a subscription is created, THE System SHALL set `date_debut` to the current date
2. WHEN a subscription is created, THE System SHALL calculate `date_fin` as `date_debut + 12 months`
3. THE System SHALL track subscription status: 'actif', 'expire', 'suspendu'
4. WHEN an admin confirms manual payment, THE System SHALL extend `date_fin` by 12 months from the current `date_fin`
5. WHEN an admin confirms payment, THE System SHALL set `statut_abonnement` to 'actif' and `actif` to true
6. THE System SHALL record payment confirmation date and confirming admin user ID
7. WHEN a subscription expires, THE System SHALL prevent establishment users from accessing the system

### Requirement 4: Automatic Subscription Expiration

**User Story:** As a SaaS provider, I want subscriptions to automatically expire after 12 months if not renewed, so that unpaid accounts are automatically closed.

#### Acceptance Criteria

1. THE System SHALL run a daily cron job to check for expired subscriptions
2. WHEN the current date exceeds an establishment's `date_fin`, THE Cron_Job SHALL set `statut_abonnement` to 'expire'
3. WHEN a subscription expires, THE Cron_Job SHALL set `actif` to false
4. WHEN an establishment is marked as expired, THE System SHALL prevent all users from that establishment from logging in
5. THE System SHALL log all automatic expiration actions in the audit log
6. THE Cron_Job SHALL run at 00:00 UTC daily

### Requirement 5: Admin Dashboard Application

**User Story:** As an admin, I want a dedicated dashboard to manage all establishments, so that I can efficiently operate the SaaS platform.

#### Acceptance Criteria

1. WHEN an admin logs in, THE System SHALL display a list of all establishments with their status
2. THE Admin_Dashboard SHALL display establishment details: name, status, subscription dates, user count
3. WHEN viewing an establishment, THE Admin_Dashboard SHALL show subscription history and payment confirmations
4. THE Admin_Dashboard SHALL provide a form to create new establishments
5. THE Admin_Dashboard SHALL allow admins to suspend or reactivate establishments
6. THE Admin_Dashboard SHALL display global statistics: total establishments, active subscriptions, expired subscriptions, revenue metrics
7. WHEN an admin confirms payment, THE Admin_Dashboard SHALL update the subscription and log the action

### Requirement 6: Admin Role and Permissions

**User Story:** As a SaaS provider, I want a separate admin role with elevated privileges, so that admins can manage the platform without belonging to any establishment.

#### Acceptance Criteria

1. THE System SHALL support a new role value 'admin' in the profiles table
2. WHEN a user has role 'admin', THE System SHALL grant access to all establishments' data (read-only for viewing, write for management actions)
3. WHEN an admin user is created, THE System SHALL set `etablissement_id` to NULL
4. THE System SHALL prevent admin users from performing establishment-specific operations (creating orders, managing stock for a specific establishment)
5. THE System SHALL log all admin actions in the audit log with admin user identification
6. WHEN an admin views establishment data, THE System SHALL clearly indicate which establishment is being viewed

### Requirement 7: Data Migration for Existing System

**User Story:** As a SaaS provider, I want to migrate the existing single-tenant data to the multi-tenant structure, so that the current system can continue operating.

#### Acceptance Criteria

1. THE Migration SHALL create a default establishment for existing data
2. THE Migration SHALL set `etablissement_id` for all existing records to the default establishment ID
3. THE Migration SHALL preserve all existing data integrity and relationships
4. THE Migration SHALL set the default establishment's subscription to 'actif' with a 12-month period
5. THE Migration SHALL be idempotent and reversible
6. WHEN the migration completes, THE System SHALL validate that all records have a valid `etablissement_id`

### Requirement 8: Modified RLS Policies

**User Story:** As a developer, I want all RLS policies to enforce establishment-level data isolation, so that multi-tenancy is secure at the database level.

#### Acceptance Criteria

1. WHEN any RLS policy evaluates, THE System SHALL include an `etablissement_id` filter matching the user's establishment
2. THE System SHALL modify all existing SELECT policies to filter by `etablissement_id`
3. THE System SHALL modify all existing INSERT policies to validate `etablissement_id` matches the user's establishment
4. THE System SHALL modify all existing UPDATE policies to prevent cross-establishment modifications
5. THE System SHALL modify all existing DELETE policies to prevent cross-establishment deletions
6. WHEN an admin queries data, THE System SHALL allow cross-establishment read access through special admin policies
7. THE System SHALL ensure that users cannot modify their own `etablissement_id`

### Requirement 9: Establishment User Management

**User Story:** As an establishment owner, I want to manage users within my establishment, so that I can control who has access to my data.

#### Acceptance Criteria

1. WHEN a new user is created, THE System SHALL automatically assign the user to the establishment of the creating user
2. THE System SHALL prevent users from creating accounts in other establishments
3. WHEN viewing users, THE System SHALL only show users from the same establishment
4. THE System SHALL prevent users from modifying users in other establishments
5. WHEN an establishment is suspended or expired, THE System SHALL prevent all users from that establishment from logging in
6. THE System SHALL maintain the existing role hierarchy (serveuse, comptoir, gerant, patron) within each establishment

### Requirement 10: Audit Logging for Multi-Tenancy

**User Story:** As a SaaS provider, I want comprehensive audit logs for all admin actions and cross-establishment operations, so that I can monitor platform security and usage.

#### Acceptance Criteria

1. WHEN an admin creates an establishment, THE System SHALL log the action with establishment details
2. WHEN an admin confirms payment, THE System SHALL log the payment confirmation with amount and date
3. WHEN an admin suspends an establishment, THE System SHALL log the suspension with reason
4. WHEN a subscription automatically expires, THE System SHALL log the expiration event
5. WHEN an admin views another establishment's data, THE System SHALL log the access
6. THE System SHALL include `etablissement_id` in all audit log entries
7. THE System SHALL distinguish between admin actions and establishment user actions in audit logs

### Requirement 11: Establishment Isolation Validation

**User Story:** As a SaaS provider, I want automated tests to verify data isolation between establishments, so that I can ensure multi-tenancy security.

#### Acceptance Criteria

1. THE Test_Suite SHALL verify that users from establishment A cannot read data from establishment B
2. THE Test_Suite SHALL verify that users from establishment A cannot modify data from establishment B
3. THE Test_Suite SHALL verify that users from establishment A cannot delete data from establishment B
4. THE Test_Suite SHALL verify that foreign key relationships respect establishment boundaries
5. THE Test_Suite SHALL verify that admin users can read data from all establishments
6. THE Test_Suite SHALL verify that admin users cannot perform establishment-specific operations without specifying an establishment
7. THE Test_Suite SHALL verify that automatic expiration only affects the target establishment

### Requirement 12: Subscription Renewal Workflow

**User Story:** As an admin, I want a clear workflow to renew subscriptions after receiving manual payment, so that I can efficiently process renewals.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL display establishments with subscriptions expiring within 30 days
2. THE Admin_Dashboard SHALL highlight establishments with expired subscriptions
3. WHEN an admin confirms payment for renewal, THE System SHALL extend `date_fin` by 12 months from the previous `date_fin`
4. WHEN renewing an expired subscription, THE System SHALL reactivate the establishment (set `actif` to true, `statut_abonnement` to 'actif')
5. THE System SHALL record the renewal date and payment confirmation details
6. THE System SHALL send a notification (audit log entry) when a subscription is renewed
7. THE Admin_Dashboard SHALL display subscription renewal history for each establishment

### Requirement 13: Edge Function for Expiration Cron

**User Story:** As a SaaS provider, I want an automated background job to handle subscription expiration, so that the system operates without manual intervention.

#### Acceptance Criteria

1. THE Edge_Function SHALL be deployed as a Supabase Edge Function
2. THE Edge_Function SHALL be triggered daily via Supabase cron configuration
3. WHEN the Edge_Function runs, THE System SHALL query all establishments where `date_fin < NOW()` and `statut_abonnement = 'actif'`
4. FOR EACH expired establishment, THE Edge_Function SHALL update `statut_abonnement` to 'expire' and `actif` to false
5. THE Edge_Function SHALL log each expiration action in the audit log
6. THE Edge_Function SHALL handle errors gracefully and log failures
7. THE Edge_Function SHALL complete execution within 60 seconds

### Requirement 14: Admin Authentication and Authorization

**User Story:** As a SaaS provider, I want secure admin authentication separate from establishment users, so that admin access is properly controlled.

#### Acceptance Criteria

1. THE System SHALL support admin user creation through a secure initialization script
2. WHEN an admin user is created, THE System SHALL set `role` to 'admin' and `etablissement_id` to NULL
3. THE System SHALL prevent non-admin users from accessing admin dashboard routes
4. THE System SHALL validate admin role on all admin API endpoints
5. THE System SHALL use Supabase authentication for admin users
6. THE System SHALL support admin password reset through Supabase auth flows
7. THE System SHALL log all admin login attempts

### Requirement 15: Establishment Dashboard Modifications

**User Story:** As an establishment user, I want to see my establishment information in the app, so that I know which establishment I'm managing.

#### Acceptance Criteria

1. WHEN a user logs in, THE System SHALL display the establishment name in the app header
2. THE System SHALL display establishment status (actif, expire, suspendu) to establishment owners (patron role)
3. WHEN a subscription is expiring within 30 days, THE System SHALL display a warning to establishment owners
4. WHEN a subscription has expired, THE System SHALL display an expiration message and prevent access
5. THE System SHALL display subscription end date to establishment owners
6. THE System SHALL maintain all existing functionality within the establishment context
7. THE System SHALL not display establishment information to non-owner roles (serveuse, comptoir, gerant)
