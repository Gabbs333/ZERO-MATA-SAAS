# Subscription Management Workflow

This guide explains how to manage establishment subscriptions in the multi-tenant SaaS platform.

## Overview

Each establishment has an annual subscription that must be renewed manually by an admin after receiving payment. Subscriptions automatically expire after 12 months if not renewed.

## Subscription Lifecycle

```
[Created] → [Active] → [Expiring Soon] → [Expired] → [Renewed] → [Active]
                ↓
           [Suspended] → [Reactivated] → [Active]
```

## Subscription States

### 1. Active (`statut_abonnement = 'actif'`, `actif = true`)

**Description**: Establishment has valid subscription and full access

**User Access**: ✅ All users can log in and use the system

**Admin Actions Available**:
- Confirm payment (extends subscription)
- Suspend establishment

**Automatic Transitions**:
- To "Expired" when `date_fin < NOW()` (via daily cron job)

### 2. Expiring Soon (Active but `date_fin` within 30 days)

**Description**: Subscription is still active but will expire soon

**User Access**: ✅ All users can log in (warning shown to patron)

**Patron Dashboard**: Shows warning message with days remaining

**Admin Actions Available**:
- Confirm payment (extends subscription)
- Suspend establishment

**Automatic Transitions**:
- To "Expired" when `date_fin < NOW()`

### 3. Expired (`statut_abonnement = 'expire'`, `actif = false`)

**Description**: Subscription has passed `date_fin` without renewal

**User Access**: ❌ All users denied access on login

**Admin Actions Available**:
- Confirm payment (reactivates and extends subscription)
- Suspend establishment (if needed)

**How It Happens**:
- Automatic: Daily cron job at 00:00 UTC
- Manual: Admin can manually expire (not recommended)

### 4. Suspended (`statut_abonnement = 'suspendu'`, `actif = false`)

**Description**: Admin has manually suspended the establishment

**User Access**: ❌ All users denied access on login

**Admin Actions Available**:
- Reactivate establishment
- Confirm payment (if reactivating)

**How It Happens**:
- Manual: Admin suspends via admin dashboard

**Common Reasons**:
- Payment dispute
- Terms of service violation
- Establishment request
- Fraud prevention

## Admin Workflows

### Workflow 1: Confirm Payment and Renew Subscription

**When**: After receiving payment from establishment

**Steps**:

1. **Verify Payment Received**
   - Check bank account or payment processor
   - Verify amount matches subscription fee
   - Confirm payment is from correct establishment

2. **Log in to Admin Dashboard**
   ```
   URL: https://your-domain.com/admin
   Credentials: Admin user credentials
   ```

3. **Navigate to Establishment**
   - Go to "Establishments" page
   - Search for establishment by name
   - Click on establishment to view details

4. **Confirm Payment**
   - Click "Confirm Payment" button
   - Review current subscription end date
   - Confirm action

5. **Verify Renewal**
   - Check new `date_fin` is 12 months from previous `date_fin`
   - Verify `statut_abonnement` is 'actif'
   - Verify `actif` is true
   - Check audit log entry was created

**Result**:
- Subscription extended by 12 months
- If expired, establishment is reactivated
- Users can access system immediately
- Payment confirmation logged

**SQL Equivalent**:
```sql
SELECT confirm_payment_and_extend_subscription(
  'establishment-id',
  'admin-user-id'
);
```

### Workflow 2: Suspend Establishment

**When**: Need to temporarily disable establishment access

**Steps**:

1. **Log in to Admin Dashboard**

2. **Navigate to Establishment**
   - Go to "Establishments" page
   - Find establishment
   - Click to view details

3. **Suspend Establishment**
   - Click "Suspend" button
   - Enter reason for suspension
   - Confirm action

4. **Verify Suspension**
   - Check `statut_abonnement` is 'suspendu'
   - Check `actif` is false
   - Verify audit log entry

**Result**:
- Establishment access disabled immediately
- All users denied access on next login
- Suspension reason logged

**SQL Equivalent**:
```sql
SELECT suspend_etablissement(
  'establishment-id',
  'admin-user-id',
  'Reason for suspension'
);
```

### Workflow 3: Reactivate Suspended Establishment

**When**: Ready to restore access to suspended establishment

**Steps**:

1. **Log in to Admin Dashboard**

2. **Navigate to Establishment**
   - Go to "Establishments" page
   - Filter by "Suspended" status
   - Find establishment
   - Click to view details

3. **Reactivate Establishment**
   - Click "Reactivate" button
   - Confirm action

4. **Verify Reactivation**
   - Check `statut_abonnement` is 'actif'
   - Check `actif` is true
   - Verify audit log entry

**Result**:
- Establishment access enabled immediately
- Users can log in again
- Reactivation logged

**Note**: If subscription has expired, you may need to confirm payment first to extend the subscription.

**SQL Equivalent**:
```sql
SELECT reactivate_etablissement(
  'establishment-id',
  'admin-user-id'
);
```

### Workflow 4: Create New Establishment

**When**: Onboarding new client

**Steps**:

1. **Log in to Admin Dashboard**

2. **Navigate to Create Establishment**
   - Click "Create Establishment" button

3. **Fill in Details**
   - Name: Establishment name
   - Address: Physical address
   - Phone: Contact phone
   - Email: Contact email

4. **Submit**
   - Click "Create" button
   - System automatically sets:
     - `date_debut` = NOW()
     - `date_fin` = NOW() + 12 months
     - `statut_abonnement` = 'actif'
     - `actif` = true

5. **Create Initial User**
   - Create patron user for the establishment
   - Provide credentials to client

**Result**:
- New establishment created with 12-month subscription
- Ready for users to be added
- Creation logged

### Workflow 5: Handle Expired Establishment

**When**: Establishment subscription has expired

**Automatic Process**:
1. Daily cron job runs at 00:00 UTC
2. Identifies establishments where `date_fin < NOW()`
3. Sets `statut_abonnement = 'expire'`
4. Sets `actif = false`
5. Logs expiration event

**Admin Actions**:

**Option A: Renew Subscription**
1. Contact establishment for payment
2. Receive payment
3. Confirm payment via admin dashboard
4. Establishment reactivated automatically

**Option B: Keep Expired**
1. No action needed
2. Establishment remains expired
3. Data preserved but inaccessible

**Option C: Delete Establishment** (Not Recommended)
1. Export establishment data if needed
2. Delete establishment (cascades to all data)
3. Permanent deletion

## User Experience

### Patron (Owner) Experience

**Active Subscription**:
- Full access to all features
- No warnings or restrictions

**Expiring Soon (< 30 days)**:
- Warning banner on dashboard
- Message: "Votre abonnement expire dans X jours. Contactez l'administrateur pour renouveler."
- Full access continues

**Expired**:
- Login denied
- Error message: "Votre abonnement a expiré. Contactez l'administrateur."
- Cannot access any features

**Suspended**:
- Login denied
- Error message: "Votre compte a été suspendu. Contactez l'administrateur."
- Cannot access any features

### Other Roles (Serveuse, Comptoir, Gerant)

**Active Subscription**:
- Full access to role-specific features
- No subscription information shown

**Expired or Suspended**:
- Login denied
- Error message: "Accès refusé. Contactez votre responsable."
- Cannot access any features

## Monitoring and Alerts

### Admin Dashboard Alerts

**Expiring Soon**:
- List of establishments expiring within 30 days
- Sorted by expiration date
- Quick action: Confirm payment

**Recently Expired**:
- List of establishments expired in last 7 days
- Highlight for follow-up
- Quick action: Confirm payment

**Suspended**:
- List of all suspended establishments
- Suspension reason shown
- Quick action: Reactivate

### Audit Log Monitoring

**Key Events to Monitor**:
- `PAYMENT_CONFIRMED`: Payment confirmations
- `SUBSCRIPTION_EXPIRED`: Automatic expirations
- `ESTABLISHMENT_SUSPENDED`: Manual suspensions
- `ESTABLISHMENT_REACTIVATED`: Reactivations

**Query Examples**:
```sql
-- Recent payment confirmations
SELECT * FROM audit_logs 
WHERE action = 'PAYMENT_CONFIRMED'
ORDER BY date_action DESC 
LIMIT 10;

-- Establishments expired today
SELECT * FROM audit_logs 
WHERE action = 'SUBSCRIPTION_EXPIRED'
AND date_action::date = CURRENT_DATE;

-- Suspended establishments
SELECT e.nom, a.details->>'reason' as reason, a.date_action
FROM audit_logs a
JOIN etablissements e ON e.id = a.etablissement_id
WHERE a.action = 'ESTABLISHMENT_SUSPENDED'
ORDER BY a.date_action DESC;
```

## Best Practices

### For Admins

1. **Proactive Renewal**
   - Contact establishments 30 days before expiration
   - Send payment reminders
   - Confirm payment promptly after receipt

2. **Clear Communication**
   - Explain subscription terms clearly
   - Provide advance notice of expiration
   - Document suspension reasons

3. **Regular Monitoring**
   - Check expiring establishments daily
   - Review audit logs weekly
   - Monitor for unusual patterns

4. **Data Preservation**
   - Never delete establishments without backup
   - Keep expired establishments for grace period
   - Document data retention policy

### For Establishment Owners

1. **Track Expiration Date**
   - Note subscription end date
   - Set calendar reminders
   - Plan for renewal in advance

2. **Maintain Payment**
   - Pay before expiration
   - Keep payment method current
   - Confirm payment with admin

3. **Monitor Warnings**
   - Check dashboard regularly
   - Act on expiration warnings
   - Contact admin if issues

## Troubleshooting

### Issue: Payment Confirmed but Establishment Still Expired

**Possible Causes**:
- Payment confirmation failed
- Database transaction rolled back
- Cron job ran after confirmation

**Solution**:
```sql
-- Check establishment status
SELECT id, nom, statut_abonnement, date_fin, actif 
FROM etablissements 
WHERE id = 'establishment-id';

-- Check audit logs
SELECT * FROM audit_logs 
WHERE etablissement_id = 'establishment-id'
AND action = 'PAYMENT_CONFIRMED'
ORDER BY date_action DESC;

-- Manually fix if needed
UPDATE etablissements
SET statut_abonnement = 'actif', actif = true
WHERE id = 'establishment-id';
```

### Issue: Cron Job Not Expiring Establishments

**Possible Causes**:
- Cron job not configured
- Edge function not deployed
- Database permissions issue

**Solution**:
```sql
-- Check cron job exists
SELECT * FROM cron.job WHERE jobname = 'expire-subscriptions-daily';

-- Check recent runs
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'expire-subscriptions-daily')
ORDER BY start_time DESC 
LIMIT 5;

-- Manually trigger expiration
SELECT net.http_post(
  url := 'https://your-project.supabase.co/functions/v1/expire-subscriptions',
  headers := jsonb_build_object('Authorization', 'Bearer ' || 'service-role-key')
);
```

### Issue: Users Can Access Expired Establishment

**Possible Causes**:
- RLS policies not applied
- Cached authentication token
- Application not checking status

**Solution**:
```sql
-- Verify establishment status
SELECT id, nom, statut_abonnement, actif FROM etablissements WHERE id = 'establishment-id';

-- Force user logout (they'll need to re-authenticate)
-- This happens automatically on next login attempt

-- Verify RLS policies
SELECT * FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles';
```

## Related Documentation

- [Multi-Tenant Architecture](MULTI_TENANT_ARCHITECTURE.md)
- [Admin User Setup](ADMIN_USER_SETUP.md)
- [Deployment Guide](MULTI_TENANT_DEPLOYMENT.md)
- [Admin Dashboard Guide](../app-admin/README.md)

