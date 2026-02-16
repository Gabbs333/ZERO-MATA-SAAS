# Admin User Setup Guide

This guide explains how to create the first admin user for the multi-tenant SaaS platform.

## Overview

Admin users are special users who:
- Have `role = 'admin'` in the profiles table
- Have `etablissement_id = NULL` (they don't belong to any establishment)
- Can view data from all establishments
- Can manage establishments, subscriptions, and payments
- Cannot perform establishment-specific operations (create orders, etc.)

## Prerequisites

Before creating an admin user, ensure:
1. All migrations have been applied to the database
2. You have access to Supabase project credentials:
   - Project URL
   - Service role key (found in Project Settings > API)
3. The `update_admin_profile` function has been created (see `scripts/create-admin-function.sql`)

## Method 1: Using the Shell Script (Recommended)

The easiest way to create an admin user is using the provided shell script:

```bash
# Set environment variables
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Run the script
chmod +x scripts/create-admin-user.sh
./scripts/create-admin-user.sh
```

The script will prompt you for:
- Admin email
- Admin password
- First name
- Last name

It will then:
1. Create the user in Supabase Auth
2. Update the profile to set admin role
3. Set etablissement_id to NULL
4. Log the admin creation

## Method 2: Using Supabase Dashboard + SQL

### Step 1: Create User in Supabase Auth

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** > **Users**
3. Click **Add User**
4. Enter:
   - Email: `admin@yourdomain.com`
   - Password: (choose a strong password)
   - Auto Confirm User: **Yes**
5. Click **Create User**

### Step 2: Update Profile to Admin Role

After the user is created, a profile will be automatically created by the trigger. You need to update it to admin role:

```sql
-- Update the profile to admin role
UPDATE profiles 
SET 
  role = 'admin',
  etablissement_id = NULL,
  nom = 'Admin',
  prenom = 'System'
WHERE email = 'admin@yourdomain.com';
```

### Step 3: Verify Admin User

```sql
-- Verify the admin user was created correctly
SELECT 
  id,
  email,
  nom,
  prenom,
  role,
  etablissement_id,
  actif
FROM profiles
WHERE role = 'admin';
```

Expected result:
- `role` should be `'admin'`
- `etablissement_id` should be `NULL`
- `actif` should be `true`

## Method 3: Using Supabase CLI

If you have Supabase CLI installed:

```bash
# Create user
supabase auth users create admin@yourdomain.com --password "YourStrongPassword123!"

# Get the user ID from the output, then run SQL to update profile
supabase db execute "
UPDATE profiles 
SET role = 'admin', etablissement_id = NULL, nom = 'Admin', prenom = 'System'
WHERE email = 'admin@yourdomain.com';
"
```

## Verification

After creating the admin user, verify it works:

1. **Check Database**:
   ```sql
   SELECT id, email, role, etablissement_id 
   FROM profiles 
   WHERE role = 'admin';
   ```

2. **Test Login**:
   - Go to the admin dashboard application
   - Log in with the admin credentials
   - You should see the admin dashboard with all establishments

3. **Check Permissions**:
   - Try viewing establishments list
   - Try viewing data from multiple establishments
   - Verify you can access admin-only features

## Security Considerations

1. **Strong Password**: Always use a strong password for admin users
2. **Secure Storage**: Store admin credentials securely (password manager)
3. **Service Role Key**: Never commit the service role key to version control
4. **Audit Logging**: All admin actions are logged in the audit_logs table
5. **Limited Admin Users**: Create only the minimum number of admin users needed

## Troubleshooting

### Profile Not Created Automatically

If the profile wasn't created automatically after user creation:

```sql
-- Manually create profile
INSERT INTO profiles (id, email, nom, prenom, role, etablissement_id, actif)
VALUES (
  'user-id-from-auth-users',
  'admin@yourdomain.com',
  'Admin',
  'System',
  'admin',
  NULL,
  true
);
```

### Admin Cannot Access Dashboard

Check:
1. Profile has `role = 'admin'`
2. Profile has `etablissement_id = NULL`
3. User is confirmed in auth.users
4. User is active (`actif = true`)

### Admin Cannot See All Establishments

Check:
1. RLS policies for admin are correctly configured
2. Admin policies exist for all tables
3. Run the admin access property tests to verify

## Creating Additional Admin Users

To create additional admin users, repeat any of the methods above with different email addresses.

## Removing Admin Access

To revoke admin access from a user:

```sql
-- This will fail because admin users must have NULL etablissement_id
-- You need to assign them to an establishment first
UPDATE profiles
SET 
  role = 'patron',  -- or another role
  etablissement_id = 'some-etablissement-id'
WHERE id = 'user-id';
```

## Next Steps

After creating the admin user:
1. Log in to the admin dashboard
2. Create your first establishment
3. Create users for that establishment
4. Test the multi-tenant functionality

## Related Documentation

- [Multi-Tenant Architecture](../README.md)
- [Admin Dashboard Guide](../app-admin/README.md)
- [RLS Policies](../docs/RLS_POLICIES.md)

