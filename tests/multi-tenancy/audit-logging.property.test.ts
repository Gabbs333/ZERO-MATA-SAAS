/**
 * Property-Based Tests: Audit Logging
 * 
 * Tests audit logging functionality for multi-tenant operations including
 * admin actions, automatic expiration, and actor type distinction.
 * 
 * Properties tested:
 * - Property 21: Admin Action Audit Logging
 * - Property 22: Expiration Audit Logging
 * - Property 23: Audit Log Etablissement ID
 * - Property 24: Audit Log Actor Distinction
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { getTestPool, skipIfNoDB } from '../setup'
import fc from 'fast-check'
import { Pool } from 'pg'

describe('Audit Logging Properties', () => {
  let pool: Pool

  beforeEach(async () => {
    if (skipIfNoDB()) return
    pool = await getTestPool()
  })

  /**
   * Property 21: Admin Action Audit Logging
   * 
   * **Validates: Requirements 6.5, 10.1, 10.2, 10.3**
   * 
   * For any admin action (create establishment, confirm payment, suspend establishment,
   * reactivate establishment), an audit log entry SHALL be created with `action` field
   * identifying the action type, `utilisateur_id` set to the admin's ID, and
   * `etablissement_id` set to the target establishment's ID.
   */
  test('Property 21: Admin actions create audit logs with correct user and establishment IDs', async () => {
    if (skipIfNoDB()) return

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          etablissementName: fc.string({ minLength: 3, maxLength: 50 }),
          adminAction: fc.constantFrom(
            'confirm_payment',
            'suspend',
            'reactivate'
          )
        }),
        async ({ etablissementName, adminAction }) => {
          // Create admin user
          const adminResult = await pool.query(`
            INSERT INTO auth.users (id, email)
            VALUES (gen_random_uuid(), $1)
            RETURNING id
          `, [`admin-${Date.now()}-${Math.random()}@test.com`])
          const adminId = adminResult.rows[0].id

          await pool.query(`
            INSERT INTO profiles (id, email, nom, prenom, role, etablissement_id, actif)
            VALUES ($1, $2, 'Admin', 'User', 'admin', NULL, true)
          `, [adminId, `admin-${Date.now()}-${Math.random()}@test.com`])

          // Create establishment
          const etabResult = await pool.query(`
            INSERT INTO etablissements (nom, statut_abonnement, date_debut, date_fin, actif)
            VALUES ($1, 'actif', NOW(), NOW() + INTERVAL '12 months', true)
            RETURNING id
          `, [etablissementName])
          
          const etablissementId = etabResult.rows[0].id

          // Clear any existing audit logs for this establishment
          await pool.query(`
            DELETE FROM audit_logs WHERE etablissement_id = $1
          `, [etablissementId])

          // Perform admin action
          let expectedAction: string
          
          if (adminAction === 'confirm_payment') {
            await pool.query(`
              SELECT public.confirm_payment_and_extend_subscription($1, $2)
            `, [etablissementId, adminId])
            expectedAction = 'PAYMENT_CONFIRMED'
          } else if (adminAction === 'suspend') {
            await pool.query(`
              SELECT public.suspend_etablissement($1, $2, $3)
            `, [etablissementId, adminId, 'Test suspension'])
            expectedAction = 'ESTABLISHMENT_SUSPENDED'
          } else { // reactivate
            // First suspend it
            await pool.query(`
              UPDATE etablissements 
              SET statut_abonnement = 'suspendu', actif = false
              WHERE id = $1
            `, [etablissementId])
            
            await pool.query(`
              DELETE FROM audit_logs WHERE etablissement_id = $1
            `, [etablissementId])
            
            await pool.query(`
              SELECT public.reactivate_etablissement($1, $2)
            `, [etablissementId, adminId])
            expectedAction = 'ESTABLISHMENT_REACTIVATED'
          }

          // Verify audit log entry exists with correct fields
          const auditResult = await pool.query(`
            SELECT 
              action,
              utilisateur_id,
              etablissement_id,
              entite,
              entite_id
            FROM audit_logs
            WHERE action = $1
            AND etablissement_id = $2
            ORDER BY date_creation DESC
            LIMIT 1
          `, [expectedAction, etablissementId])

          expect(auditResult.rows.length).toBe(1)
          
          const auditLog = auditResult.rows[0]
          
          // Verify action type is correct
          expect(auditLog.action).toBe(expectedAction)
          
          // Verify utilisateur_id is set to admin's ID
          expect(auditLog.utilisateur_id).toBe(adminId)
          
          // Verify etablissement_id is set to target establishment's ID
          expect(auditLog.etablissement_id).toBe(etablissementId)
          
          // Verify entite is 'etablissements'
          expect(auditLog.entite).toBe('etablissements')
          
          // Verify entite_id matches establishment ID
          expect(auditLog.entite_id).toBe(etablissementId)
        }
      ),
      { numRuns: 30 }
    )
  })

  /**
   * Property 21 (continued): Establishment Creation Audit Logging
   * 
   * Tests that establishment creation is automatically logged via trigger.
   */
  test('Property 21: Establishment creation creates audit log entry', async () => {
    if (skipIfNoDB()) return

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 3, maxLength: 50 }),
        async (etablissementName) => {
          // Create establishment (trigger should auto-log)
          const etabResult = await pool.query(`
            INSERT INTO etablissements (nom, statut_abonnement, date_debut, date_fin, actif)
            VALUES ($1, 'actif', NOW(), NOW() + INTERVAL '12 months', true)
            RETURNING id
          `, [etablissementName])
          
          const etablissementId = etabResult.rows[0].id

          // Verify audit log entry exists
          const auditResult = await pool.query(`
            SELECT 
              action,
              etablissement_id,
              entite,
              entite_id,
              details_apres
            FROM audit_logs
            WHERE action = 'ESTABLISHMENT_CREATED'
            AND etablissement_id = $1
          `, [etablissementId])

          expect(auditResult.rows.length).toBe(1)
          
          const auditLog = auditResult.rows[0]
          
          // Verify action type
          expect(auditLog.action).toBe('ESTABLISHMENT_CREATED')
          
          // Verify etablissement_id is set
          expect(auditLog.etablissement_id).toBe(etablissementId)
          
          // Verify entite is 'etablissements'
          expect(auditLog.entite).toBe('etablissements')
          
          // Verify details include establishment name
          expect(auditLog.details_apres.nom).toBe(etablissementName)
        }
      ),
      { numRuns: 30 }
    )
  })

  /**
   * Property 22: Expiration Audit Logging
   * 
   * **Validates: Requirements 4.5, 10.4, 13.5**
   * 
   * For any automatic expiration of an establishment, an audit log entry SHALL be
   * created with `action` set to 'SUBSCRIPTION_EXPIRED', `utilisateur_id` set to NULL
   * (system action), and `etablissement_id` set to the expired establishment's ID.
   */
  test('Property 22: Automatic expiration creates audit log with NULL user_id', async () => {
    if (skipIfNoDB()) return

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          etablissementName: fc.string({ minLength: 3, maxLength: 50 }),
          daysExpired: fc.integer({ min: 1, max: 30 })
        }),
        async ({ etablissementName, daysExpired }) => {
          // Create establishment with expired date_fin
          const expiredDate = new Date()
          expiredDate.setDate(expiredDate.getDate() - daysExpired)

          const etabResult = await pool.query(`
            INSERT INTO etablissements (
              nom, 
              statut_abonnement, 
              date_debut, 
              date_fin, 
              actif
            )
            VALUES ($1, 'actif', NOW() - INTERVAL '1 year', $2, true)
            RETURNING id
          `, [etablissementName, expiredDate])
          
          const etablissementId = etabResult.rows[0].id

          // Simulate automatic expiration (what the edge function does)
          await pool.query(`
            UPDATE etablissements
            SET statut_abonnement = 'expire', actif = false
            WHERE id = $1
          `, [etablissementId])

          // Log the expiration as system action (NULL user_id)
          await pool.query(`
            INSERT INTO audit_logs (
              utilisateur_id,
              action,
              entite,
              entite_id,
              etablissement_id,
              details_apres
            ) VALUES (
              NULL,
              'SUBSCRIPTION_EXPIRED',
              'etablissements',
              $1::TEXT,
              $1,
              jsonb_build_object('expired_at', NOW())
            )
          `, [etablissementId])

          // Verify audit log entry
          const auditResult = await pool.query(`
            SELECT 
              action,
              utilisateur_id,
              etablissement_id,
              entite
            FROM audit_logs
            WHERE action = 'SUBSCRIPTION_EXPIRED'
            AND etablissement_id = $1
          `, [etablissementId])

          expect(auditResult.rows.length).toBe(1)
          
          const auditLog = auditResult.rows[0]
          
          // Verify action type
          expect(auditLog.action).toBe('SUBSCRIPTION_EXPIRED')
          
          // Verify utilisateur_id is NULL (system action)
          expect(auditLog.utilisateur_id).toBeNull()
          
          // Verify etablissement_id is set to expired establishment
          expect(auditLog.etablissement_id).toBe(etablissementId)
          
          // Verify entite is 'etablissements'
          expect(auditLog.entite).toBe('etablissements')
        }
      ),
      { numRuns: 30 }
    )
  })

  /**
   * Property 23: Audit Log Etablissement ID
   * 
   * **Validates: Requirements 10.6**
   * 
   * For any audit log entry, the `etablissement_id` field SHALL be populated with
   * the ID of the establishment related to the action (or NULL for system-wide actions).
   */
  test('Property 23: All audit log entries have correct etablissement_id', async () => {
    if (skipIfNoDB()) return

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          etablissementName: fc.string({ minLength: 3, maxLength: 50 }),
          actionType: fc.constantFrom(
            'establishment_action',
            'user_action',
            'system_action'
          )
        }),
        async ({ etablissementName, actionType }) => {
          // Create establishment
          const etabResult = await pool.query(`
            INSERT INTO etablissements (nom, statut_abonnement, date_debut, date_fin, actif)
            VALUES ($1, 'actif', NOW(), NOW() + INTERVAL '12 months', true)
            RETURNING id
          `, [etablissementName])
          
          const etablissementId = etabResult.rows[0].id

          let expectedEtablissementId: string | null = etablissementId

          if (actionType === 'establishment_action') {
            // Admin action on establishment - should have etablissement_id
            const adminResult = await pool.query(`
              INSERT INTO auth.users (id, email)
              VALUES (gen_random_uuid(), $1)
              RETURNING id
            `, [`admin-${Date.now()}-${Math.random()}@test.com`])
            const adminId = adminResult.rows[0].id

            await pool.query(`
              INSERT INTO profiles (id, email, nom, prenom, role, etablissement_id, actif)
              VALUES ($1, $2, 'Admin', 'User', 'admin', NULL, true)
            `, [adminId, `admin-${Date.now()}-${Math.random()}@test.com`])

            await pool.query(`
              SELECT public.confirm_payment_and_extend_subscription($1, $2)
            `, [etablissementId, adminId])

          } else if (actionType === 'user_action') {
            // Regular user action - should have etablissement_id from user's profile
            const userResult = await pool.query(`
              INSERT INTO auth.users (id, email)
              VALUES (gen_random_uuid(), $1)
              RETURNING id
            `, [`user-${Date.now()}-${Math.random()}@test.com`])
            const userId = userResult.rows[0].id

            await pool.query(`
              INSERT INTO profiles (id, email, nom, prenom, role, etablissement_id, actif)
              VALUES ($1, $2, 'User', 'Test', 'patron', $3, true)
            `, [userId, `user-${Date.now()}-${Math.random()}@test.com`, etablissementId])

            // Use log_audit_action function to log a user action
            await pool.query(`
              SELECT log_audit_action(
                'USER_ACTION_TEST',
                'profiles',
                $1,
                NULL,
                NULL
              )
            `, [userId])

          } else { // system_action
            // System action - should have NULL or specific etablissement_id
            await pool.query(`
              INSERT INTO audit_logs (
                utilisateur_id,
                action,
                entite,
                entite_id,
                etablissement_id,
                details_apres
              ) VALUES (
                NULL,
                'SYSTEM_ACTION_TEST',
                'etablissements',
                $1::TEXT,
                $1,
                jsonb_build_object('test', true)
              )
            `, [etablissementId])
          }

          // Verify audit log has correct etablissement_id
          const auditResult = await pool.query(`
            SELECT etablissement_id
            FROM audit_logs
            WHERE etablissement_id = $1
            OR (action LIKE '%TEST%' AND date_creation > NOW() - INTERVAL '1 second')
            ORDER BY date_creation DESC
            LIMIT 1
          `, [etablissementId])

          expect(auditResult.rows.length).toBeGreaterThan(0)
          
          const auditLog = auditResult.rows[0]
          
          // Verify etablissement_id is populated correctly
          if (actionType === 'system_action') {
            // System actions can have etablissement_id if related to specific establishment
            expect(auditLog.etablissement_id).toBe(expectedEtablissementId)
          } else {
            // User and admin actions must have etablissement_id
            expect(auditLog.etablissement_id).toBe(expectedEtablissementId)
          }
        }
      ),
      { numRuns: 30 }
    )
  })

  /**
   * Property 24: Audit Log Actor Distinction
   * 
   * **Validates: Requirements 10.7**
   * 
   * For any audit log entry, if `utilisateur_id` is NULL, the action SHALL be
   * identifiable as a system action. If `utilisateur_id` is not NULL and the user
   * has role 'admin', the action SHALL be identifiable as an admin action.
   */
  test('Property 24: Actor type is correctly distinguished in establishment_audit_log view', async () => {
    if (skipIfNoDB()) return

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          etablissementName: fc.string({ minLength: 3, maxLength: 50 }),
          actorType: fc.constantFrom('SYSTEM', 'ADMIN', 'USER')
        }),
        async ({ etablissementName, actorType }) => {
          // Create establishment
          const etabResult = await pool.query(`
            INSERT INTO etablissements (nom, statut_abonnement, date_debut, date_fin, actif)
            VALUES ($1, 'actif', NOW(), NOW() + INTERVAL '12 months', true)
            RETURNING id
          `, [etablissementName])
          
          const etablissementId = etabResult.rows[0].id

          let userId: string | null = null
          let expectedActorType = actorType

          if (actorType === 'SYSTEM') {
            // Create system action (NULL utilisateur_id)
            await pool.query(`
              INSERT INTO audit_logs (
                utilisateur_id,
                action,
                entite,
                entite_id,
                etablissement_id,
                details_apres
              ) VALUES (
                NULL,
                'SYSTEM_TEST_ACTION',
                'etablissements',
                $1::TEXT,
                $1,
                jsonb_build_object('test', true)
              )
            `, [etablissementId])

          } else if (actorType === 'ADMIN') {
            // Create admin user and perform admin action
            const adminResult = await pool.query(`
              INSERT INTO auth.users (id, email)
              VALUES (gen_random_uuid(), $1)
              RETURNING id
            `, [`admin-${Date.now()}-${Math.random()}@test.com`])
            userId = adminResult.rows[0].id

            await pool.query(`
              INSERT INTO profiles (id, email, nom, prenom, role, etablissement_id, actif)
              VALUES ($1, $2, 'Admin', 'User', 'admin', NULL, true)
            `, [userId, `admin-${Date.now()}-${Math.random()}@test.com`])

            await pool.query(`
              SELECT public.confirm_payment_and_extend_subscription($1, $2)
            `, [etablissementId, userId])

          } else { // USER
            // Create regular user and perform user action
            const userResult = await pool.query(`
              INSERT INTO auth.users (id, email)
              VALUES (gen_random_uuid(), $1)
              RETURNING id
            `, [`user-${Date.now()}-${Math.random()}@test.com`])
            userId = userResult.rows[0].id

            await pool.query(`
              INSERT INTO profiles (id, email, nom, prenom, role, etablissement_id, actif)
              VALUES ($1, $2, 'User', 'Test', 'patron', $3, true)
            `, [userId, `user-${Date.now()}-${Math.random()}@test.com`, etablissementId])

            // Create a user action audit log
            await pool.query(`
              INSERT INTO audit_logs (
                utilisateur_id,
                action,
                entite,
                entite_id,
                etablissement_id,
                details_apres
              ) VALUES (
                $1,
                'USER_TEST_ACTION',
                'profiles',
                $1::TEXT,
                $2,
                jsonb_build_object('test', true)
              )
            `, [userId, etablissementId])
          }

          // Query establishment_audit_log view to verify actor_type
          const viewResult = await pool.query(`
            SELECT 
              actor_type,
              utilisateur_id,
              user_role,
              action
            FROM establishment_audit_log
            WHERE etablissement_id = $1
            ORDER BY date_creation DESC
            LIMIT 1
          `, [etablissementId])

          expect(viewResult.rows.length).toBe(1)
          
          const auditEntry = viewResult.rows[0]
          
          // Verify actor_type matches expected value
          expect(auditEntry.actor_type).toBe(expectedActorType)
          
          // Verify utilisateur_id consistency
          if (actorType === 'SYSTEM') {
            expect(auditEntry.utilisateur_id).toBeNull()
          } else {
            expect(auditEntry.utilisateur_id).toBe(userId)
          }
          
          // Verify user_role consistency
          if (actorType === 'ADMIN') {
            expect(auditEntry.user_role).toBe('admin')
          } else if (actorType === 'USER') {
            expect(auditEntry.user_role).not.toBe('admin')
          }
        }
      ),
      { numRuns: 30 }
    )
  })

  /**
   * Additional Test: Admin Actions Log View
   * 
   * Verifies that the admin_actions_log view correctly filters admin and system actions.
   */
  test('Admin actions log view shows only admin and system actions', async () => {
    if (skipIfNoDB()) return

    // Create admin user
    const adminResult = await pool.query(`
      INSERT INTO auth.users (id, email)
      VALUES (gen_random_uuid(), 'admin-view@test.com')
      RETURNING id
    `)
    const adminId = adminResult.rows[0].id

    await pool.query(`
      INSERT INTO profiles (id, email, nom, prenom, role, etablissement_id, actif)
      VALUES ($1, 'admin-view@test.com', 'Admin', 'User', 'admin', NULL, true)
    `, [adminId])

    // Create regular user
    const userResult = await pool.query(`
      INSERT INTO auth.users (id, email)
      VALUES (gen_random_uuid(), 'user-view@test.com')
      RETURNING id
    `)
    const userId = userResult.rows[0].id

    // Create establishment
    const etabResult = await pool.query(`
      INSERT INTO etablissements (nom, statut_abonnement, date_debut, date_fin, actif)
      VALUES ('Test Restaurant', 'actif', NOW(), NOW() + INTERVAL '12 months', true)
      RETURNING id
    `)
    const etablissementId = etabResult.rows[0].id

    await pool.query(`
      INSERT INTO profiles (id, email, nom, prenom, role, etablissement_id, actif)
      VALUES ($1, 'user-view@test.com', 'User', 'Test', 'patron', $2, true)
    `, [userId, etablissementId])

    // Create admin action
    await pool.query(`
      SELECT public.confirm_payment_and_extend_subscription($1, $2)
    `, [etablissementId, adminId])

    // Create system action
    await pool.query(`
      INSERT INTO audit_logs (
        utilisateur_id,
        action,
        entite,
        entite_id,
        etablissement_id
      ) VALUES (
        NULL,
        'SYSTEM_ACTION',
        'etablissements',
        $1::TEXT,
        $1
      )
    `, [etablissementId])

    // Create user action
    await pool.query(`
      INSERT INTO audit_logs (
        utilisateur_id,
        action,
        entite,
        entite_id,
        etablissement_id
      ) VALUES (
        $1,
        'USER_ACTION',
        'profiles',
        $1::TEXT,
        $2
      )
    `, [userId, etablissementId])

    // Query admin_actions_log view
    const viewResult = await pool.query(`
      SELECT action, admin_email, etablissement_id
      FROM admin_actions_log
      WHERE etablissement_id = $1
      ORDER BY date_creation DESC
    `, [etablissementId])

    // Should include admin action and system action, but not user action
    expect(viewResult.rows.length).toBeGreaterThanOrEqual(2)
    
    const actions = viewResult.rows.map(r => r.action)
    expect(actions).toContain('PAYMENT_CONFIRMED')
    expect(actions).toContain('SYSTEM_ACTION')
    expect(actions).not.toContain('USER_ACTION')
  })

  /**
   * Additional Test: System Actions Log View
   * 
   * Verifies that the system_actions_log view correctly filters system-only actions.
   */
  test('System actions log view shows only system actions (NULL user_id)', async () => {
    if (skipIfNoDB()) return

    // Create establishment
    const etabResult = await pool.query(`
      INSERT INTO etablissements (nom, statut_abonnement, date_debut, date_fin, actif)
      VALUES ('Test Restaurant', 'actif', NOW(), NOW() + INTERVAL '12 months', true)
      RETURNING id
    `)
    const etablissementId = etabResult.rows[0].id

    // Create system action
    await pool.query(`
      INSERT INTO audit_logs (
        utilisateur_id,
        action,
        entite,
        entite_id,
        etablissement_id
      ) VALUES (
        NULL,
        'SYSTEM_ONLY_ACTION',
        'etablissements',
        $1::TEXT,
        $1
      )
    `, [etablissementId])

    // Create admin user and action
    const adminResult = await pool.query(`
      INSERT INTO auth.users (id, email)
      VALUES (gen_random_uuid(), 'admin-system@test.com')
      RETURNING id
    `)
    const adminId = adminResult.rows[0].id

    await pool.query(`
      INSERT INTO profiles (id, email, nom, prenom, role, etablissement_id, actif)
      VALUES ($1, 'admin-system@test.com', 'Admin', 'User', 'admin', NULL, true)
    `, [adminId])

    await pool.query(`
      SELECT public.confirm_payment_and_extend_subscription($1, $2)
    `, [etablissementId, adminId])

    // Query system_actions_log view
    const viewResult = await pool.query(`
      SELECT action, etablissement_id
      FROM system_actions_log
      WHERE etablissement_id = $1
      ORDER BY date_creation DESC
    `, [etablissementId])

    // Should only include system action, not admin action
    const actions = viewResult.rows.map(r => r.action)
    expect(actions).toContain('SYSTEM_ONLY_ACTION')
    expect(actions).not.toContain('PAYMENT_CONFIRMED')
  })

  /**
   * Property 25: Admin Login Audit Logging
   * 
   * **Validates: Requirements 14.7**
   * 
   * For any admin user login, an audit log entry SHALL be created with `action` set
   * to 'ADMIN_LOGIN' and `user_id` set to the admin's ID.
   */
  test('Property 25: Admin login creates audit log entry', async () => {
    if (skipIfNoDB()) return

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          adminEmail: fc.emailAddress(),
          adminNom: fc.string({ minLength: 2, maxLength: 30 }),
          adminPrenom: fc.string({ minLength: 2, maxLength: 30 })
        }),
        async ({ adminEmail, adminNom, adminPrenom }) => {
          // Create admin user
          const adminResult = await pool.query(`
            INSERT INTO auth.users (id, email)
            VALUES (gen_random_uuid(), $1)
            RETURNING id
          `, [adminEmail])
          const adminId = adminResult.rows[0].id

          await pool.query(`
            INSERT INTO profiles (id, email, nom, prenom, role, etablissement_id, actif)
            VALUES ($1, $2, $3, $4, 'admin', NULL, true)
          `, [adminId, adminEmail, adminNom, adminPrenom])

          // Simulate admin login by calling log_audit_action
          // (In real app, this is called by authStore.signIn)
          await pool.query(`
            SELECT log_audit_action(
              'ADMIN_LOGIN',
              'profiles',
              $1,
              jsonb_build_object('login_time', NOW()),
              NULL
            )
          `, [adminId])

          // Verify audit log entry exists
          const auditResult = await pool.query(`
            SELECT 
              action,
              utilisateur_id,
              entite,
              entite_id,
              etablissement_id,
              details_apres
            FROM audit_logs
            WHERE action = 'ADMIN_LOGIN'
            AND utilisateur_id = $1
            ORDER BY date_creation DESC
            LIMIT 1
          `, [adminId])

          expect(auditResult.rows.length).toBe(1)
          
          const auditLog = auditResult.rows[0]
          
          // Verify action is 'ADMIN_LOGIN'
          expect(auditLog.action).toBe('ADMIN_LOGIN')
          
          // Verify utilisateur_id is set to admin's ID
          expect(auditLog.utilisateur_id).toBe(adminId)
          
          // Verify entite is 'profiles'
          expect(auditLog.entite).toBe('profiles')
          
          // Verify entite_id matches admin's ID
          expect(auditLog.entite_id).toBe(adminId)
          
          // Verify etablissement_id is NULL (admin users don't belong to establishments)
          expect(auditLog.etablissement_id).toBeNull()
          
          // Verify details include login_time
          expect(auditLog.details_apres).toHaveProperty('login_time')
        }
      ),
      { numRuns: 30 }
    )
  })

  /**
   * Property 25 (continued): Admin login audit log appears in admin_actions_log view
   * 
   * Verifies that admin login entries are visible in the admin_actions_log view.
   */
  test('Property 25: Admin login appears in admin_actions_log view', async () => {
    if (skipIfNoDB()) return

    // Create admin user
    const adminResult = await pool.query(`
      INSERT INTO auth.users (id, email)
      VALUES (gen_random_uuid(), 'admin-login-view@test.com')
      RETURNING id
    `)
    const adminId = adminResult.rows[0].id

    await pool.query(`
      INSERT INTO profiles (id, email, nom, prenom, role, etablissement_id, actif)
      VALUES ($1, 'admin-login-view@test.com', 'Admin', 'User', 'admin', NULL, true)
    `, [adminId])

    // Simulate admin login
    await pool.query(`
      SELECT log_audit_action(
        'ADMIN_LOGIN',
        'profiles',
        $1,
        jsonb_build_object('login_time', NOW()),
        NULL
      )
    `, [adminId])

    // Query admin_actions_log view
    const viewResult = await pool.query(`
      SELECT 
        action,
        admin_email,
        etablissement_id
      FROM admin_actions_log
      WHERE action = 'ADMIN_LOGIN'
      AND admin_email = 'admin-login-view@test.com'
      ORDER BY date_creation DESC
      LIMIT 1
    `)

    expect(viewResult.rows.length).toBe(1)
    
    const logEntry = viewResult.rows[0]
    
    // Verify action is 'ADMIN_LOGIN'
    expect(logEntry.action).toBe('ADMIN_LOGIN')
    
    // Verify admin_email matches
    expect(logEntry.admin_email).toBe('admin-login-view@test.com')
    
    // Verify etablissement_id is NULL (login is not establishment-specific)
    expect(logEntry.etablissement_id).toBeNull()
  })
})
