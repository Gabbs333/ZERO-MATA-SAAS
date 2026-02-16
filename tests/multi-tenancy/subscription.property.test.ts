/**
 * Property-Based Tests: Subscription Management
 * 
 * Tests subscription management functions including payment confirmation,
 * suspension, and reactivation.
 * 
 * Properties tested:
 * - Property 12: Payment Confirmation Extends Subscription
 * - Property 13: Payment Confirmation Audit Fields
 * - Property 14: Subscription Renewal Reactivates Expired Establishment
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { getTestPool, skipIfNoDB } from '../setup'
import fc from 'fast-check'
import { Pool } from 'pg'

describe('Subscription Management Properties', () => {
  let pool: Pool

  beforeEach(async () => {
    if (skipIfNoDB()) return
    pool = await getTestPool()
  })

  /**
   * Property 12: Payment Confirmation Extends Subscription
   * 
   * **Validates: Requirements 3.4, 3.5, 12.3**
   * 
   * For any establishment with current date_fin value D, when an admin confirms payment,
   * the new date_fin SHALL equal D + 12 months, statut_abonnement SHALL be 'actif',
   * and actif SHALL be true.
   */
  test('Property 12: Payment confirmation extends subscription by exactly 12 months', async () => {
    if (skipIfNoDB()) return

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          etablissementName: fc.string({ minLength: 3, maxLength: 50 }),
          initialMonthsOffset: fc.integer({ min: -6, max: 24 }), // Can be expired or future
          initialStatus: fc.constantFrom('actif', 'expire', 'suspendu')
        }),
        async ({ etablissementName, initialMonthsOffset, initialStatus }) => {
          // Create admin user
          const adminResult = await pool.query(`
            INSERT INTO auth.users (id, email)
            VALUES (gen_random_uuid(), $1)
            RETURNING id
          `, [`admin-${Date.now()}@test.com`])
          const adminId = adminResult.rows[0].id

          await pool.query(`
            INSERT INTO profiles (id, email, nom, prenom, role, etablissement_id, actif)
            VALUES ($1, $2, 'Admin', 'User', 'admin', NULL, true)
          `, [adminId, `admin-${Date.now()}@test.com`])

          // Create establishment with specific date_fin
          const initialDateFin = new Date()
          initialDateFin.setMonth(initialDateFin.getMonth() + initialMonthsOffset)

          const etabResult = await pool.query(`
            INSERT INTO etablissements (nom, statut_abonnement, date_debut, date_fin, actif)
            VALUES ($1, $2, NOW(), $3, $4)
            RETURNING id, date_fin
          `, [etablissementName, initialStatus, initialDateFin, initialStatus === 'actif'])
          
          const etablissementId = etabResult.rows[0].id
          const originalDateFin = new Date(etabResult.rows[0].date_fin)

          // Confirm payment
          await pool.query(`
            SELECT public.confirm_payment_and_extend_subscription($1, $2)
          `, [etablissementId, adminId])

          // Verify subscription extended by exactly 12 months
          const result = await pool.query(`
            SELECT 
              date_fin,
              statut_abonnement,
              actif,
              EXTRACT(EPOCH FROM (date_fin - $2::timestamptz)) / (30.44 * 24 * 60 * 60) as months_difference
            FROM etablissements
            WHERE id = $1
          `, [etablissementId, originalDateFin])

          const etab = result.rows[0]

          // Verify date_fin extended by 12 months (allow 1 day tolerance for month calculation)
          expect(Math.abs(etab.months_difference - 12)).toBeLessThan(0.1)
          
          // Verify status is active
          expect(etab.statut_abonnement).toBe('actif')
          expect(etab.actif).toBe(true)
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * Property 13: Payment Confirmation Audit Fields
   * 
   * **Validates: Requirements 3.6, 12.5**
   * 
   * For any payment confirmation operation, the establishment record SHALL have
   * dernier_paiement_date set to current timestamp and dernier_paiement_confirme_par
   * set to the confirming admin's user ID.
   */
  test('Property 13: Payment confirmation updates audit fields correctly', async () => {
    if (skipIfNoDB()) return

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 3, maxLength: 50 }),
        async (etablissementName) => {
          // Create admin user
          const adminResult = await pool.query(`
            INSERT INTO auth.users (id, email)
            VALUES (gen_random_uuid(), $1)
            RETURNING id
          `, [`admin-${Date.now()}@test.com`])
          const adminId = adminResult.rows[0].id

          await pool.query(`
            INSERT INTO profiles (id, email, nom, prenom, role, etablissement_id, actif)
            VALUES ($1, $2, 'Admin', 'User', 'admin', NULL, true)
          `, [adminId, `admin-${Date.now()}@test.com`])

          // Create establishment
          const etabResult = await pool.query(`
            INSERT INTO etablissements (nom, statut_abonnement, date_debut, date_fin, actif)
            VALUES ($1, 'actif', NOW(), NOW() + INTERVAL '12 months', true)
            RETURNING id
          `, [etablissementName])
          
          const etablissementId = etabResult.rows[0].id

          // Record time before payment confirmation
          const beforePayment = new Date()

          // Small delay to ensure timestamp difference
          await new Promise(resolve => setTimeout(resolve, 10))

          // Confirm payment
          await pool.query(`
            SELECT public.confirm_payment_and_extend_subscription($1, $2)
          `, [etablissementId, adminId])

          // Verify audit fields
          const result = await pool.query(`
            SELECT 
              dernier_paiement_date,
              dernier_paiement_confirme_par
            FROM etablissements
            WHERE id = $1
          `, [etablissementId])

          const etab = result.rows[0]

          // Verify payment date is set and recent
          expect(etab.dernier_paiement_date).toBeTruthy()
          const paymentDate = new Date(etab.dernier_paiement_date)
          expect(paymentDate.getTime()).toBeGreaterThanOrEqual(beforePayment.getTime())
          expect(paymentDate.getTime()).toBeLessThanOrEqual(new Date().getTime())

          // Verify confirming admin is recorded
          expect(etab.dernier_paiement_confirme_par).toBe(adminId)

          // Verify audit log entry exists
          const auditResult = await pool.query(`
            SELECT action, user_id, etablissement_id, details
            FROM audit_logs
            WHERE action = 'PAYMENT_CONFIRMED'
            AND record_id = $1
          `, [etablissementId])

          expect(auditResult.rows.length).toBe(1)
          expect(auditResult.rows[0].user_id).toBe(adminId)
          expect(auditResult.rows[0].etablissement_id).toBe(etablissementId)
        }
      ),
      { numRuns: 30 }
    )
  })

  /**
   * Property 14: Subscription Renewal Reactivates Expired Establishment
   * 
   * **Validates: Requirements 12.4**
   * 
   * For any establishment with statut_abonnement equal to 'expire', when an admin
   * confirms payment, the statut_abonnement SHALL change to 'actif' and actif
   * SHALL change to true.
   */
  test('Property 14: Payment confirmation reactivates expired establishments', async () => {
    if (skipIfNoDB()) return

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          etablissementName: fc.string({ minLength: 3, maxLength: 50 }),
          daysExpired: fc.integer({ min: 1, max: 365 })
        }),
        async ({ etablissementName, daysExpired }) => {
          // Create admin user
          const adminResult = await pool.query(`
            INSERT INTO auth.users (id, email)
            VALUES (gen_random_uuid(), $1)
            RETURNING id
          `, [`admin-${Date.now()}@test.com`])
          const adminId = adminResult.rows[0].id

          await pool.query(`
            INSERT INTO profiles (id, email, nom, prenom, role, etablissement_id, actif)
            VALUES ($1, $2, 'Admin', 'User', 'admin', NULL, true)
          `, [adminId, `admin-${Date.now()}@test.com`])

          // Create expired establishment
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
            VALUES ($1, 'expire', NOW() - INTERVAL '1 year', $2, false)
            RETURNING id
          `, [etablissementName, expiredDate])
          
          const etablissementId = etabResult.rows[0].id

          // Verify initial state is expired
          const beforeResult = await pool.query(`
            SELECT statut_abonnement, actif
            FROM etablissements
            WHERE id = $1
          `, [etablissementId])

          expect(beforeResult.rows[0].statut_abonnement).toBe('expire')
          expect(beforeResult.rows[0].actif).toBe(false)

          // Confirm payment (should reactivate)
          await pool.query(`
            SELECT public.confirm_payment_and_extend_subscription($1, $2)
          `, [etablissementId, adminId])

          // Verify establishment is now active
          const afterResult = await pool.query(`
            SELECT statut_abonnement, actif, date_fin
            FROM etablissements
            WHERE id = $1
          `, [etablissementId])

          const etab = afterResult.rows[0]

          // Verify reactivation
          expect(etab.statut_abonnement).toBe('actif')
          expect(etab.actif).toBe(true)

          // Verify new date_fin is in the future
          const newDateFin = new Date(etab.date_fin)
          expect(newDateFin.getTime()).toBeGreaterThan(new Date().getTime())
        }
      ),
      { numRuns: 30 }
    )
  })

  /**
   * Additional Test: Suspension Function
   * 
   * Verifies that suspension correctly updates status and logs the action.
   */
  test('Suspension sets correct status and creates audit log', async () => {
    if (skipIfNoDB()) return

    // Create admin user
    const adminResult = await pool.query(`
      INSERT INTO auth.users (id, email)
      VALUES (gen_random_uuid(), 'admin-suspend@test.com')
      RETURNING id
    `)
    const adminId = adminResult.rows[0].id

    await pool.query(`
      INSERT INTO profiles (id, email, nom, prenom, role, etablissement_id, actif)
      VALUES ($1, 'admin-suspend@test.com', 'Admin', 'User', 'admin', NULL, true)
    `, [adminId])

    // Create active establishment
    const etabResult = await pool.query(`
      INSERT INTO etablissements (nom, statut_abonnement, date_debut, date_fin, actif)
      VALUES ('Test Restaurant', 'actif', NOW(), NOW() + INTERVAL '12 months', true)
      RETURNING id
    `)
    const etablissementId = etabResult.rows[0].id

    // Suspend establishment
    await pool.query(`
      SELECT public.suspend_etablissement($1, $2, $3)
    `, [etablissementId, adminId, 'Non-payment'])

    // Verify suspension
    const result = await pool.query(`
      SELECT statut_abonnement, actif
      FROM etablissements
      WHERE id = $1
    `, [etablissementId])

    expect(result.rows[0].statut_abonnement).toBe('suspendu')
    expect(result.rows[0].actif).toBe(false)

    // Verify audit log
    const auditResult = await pool.query(`
      SELECT action, user_id, details
      FROM audit_logs
      WHERE action = 'ESTABLISHMENT_SUSPENDED'
      AND record_id = $1
    `, [etablissementId])

    expect(auditResult.rows.length).toBe(1)
    expect(auditResult.rows[0].user_id).toBe(adminId)
    expect(auditResult.rows[0].details.reason).toBe('Non-payment')
  })

  /**
   * Additional Test: Reactivation Function
   * 
   * Verifies that reactivation works for suspended (but not expired) establishments.
   */
  test('Reactivation works for suspended establishments with valid subscription', async () => {
    if (skipIfNoDB()) return

    // Create admin user
    const adminResult = await pool.query(`
      INSERT INTO auth.users (id, email)
      VALUES (gen_random_uuid(), 'admin-reactivate@test.com')
      RETURNING id
    `)
    const adminId = adminResult.rows[0].id

    await pool.query(`
      INSERT INTO profiles (id, email, nom, prenom, role, etablissement_id, actif)
      VALUES ($1, 'admin-reactivate@test.com', 'Admin', 'User', 'admin', NULL, true)
    `, [adminId])

    // Create suspended establishment with valid subscription
    const etabResult = await pool.query(`
      INSERT INTO etablissements (nom, statut_abonnement, date_debut, date_fin, actif)
      VALUES ('Test Restaurant', 'suspendu', NOW(), NOW() + INTERVAL '6 months', false)
      RETURNING id
    `)
    const etablissementId = etabResult.rows[0].id

    // Reactivate establishment
    await pool.query(`
      SELECT public.reactivate_etablissement($1, $2)
    `, [etablissementId, adminId])

    // Verify reactivation
    const result = await pool.query(`
      SELECT statut_abonnement, actif
      FROM etablissements
      WHERE id = $1
    `, [etablissementId])

    expect(result.rows[0].statut_abonnement).toBe('actif')
    expect(result.rows[0].actif).toBe(true)

    // Verify audit log
    const auditResult = await pool.query(`
      SELECT action, user_id
      FROM audit_logs
      WHERE action = 'ESTABLISHMENT_REACTIVATED'
      AND record_id = $1
    `, [etablissementId])

    expect(auditResult.rows.length).toBe(1)
    expect(auditResult.rows[0].user_id).toBe(adminId)
  })

  /**
   * Additional Test: Reactivation Fails for Expired Establishments
   * 
   * Verifies that reactivation is rejected for expired establishments.
   */
  test('Reactivation fails for expired establishments', async () => {
    if (skipIfNoDB()) return

    // Create admin user
    const adminResult = await pool.query(`
      INSERT INTO auth.users (id, email)
      VALUES (gen_random_uuid(), 'admin-fail@test.com')
      RETURNING id
    `)
    const adminId = adminResult.rows[0].id

    await pool.query(`
      INSERT INTO profiles (id, email, nom, prenom, role, etablissement_id, actif)
      VALUES ($1, 'admin-fail@test.com', 'Admin', 'User', 'admin', NULL, true)
    `, [adminId])

    // Create expired establishment
    const etabResult = await pool.query(`
      INSERT INTO etablissements (nom, statut_abonnement, date_debut, date_fin, actif)
      VALUES ('Expired Restaurant', 'expire', NOW() - INTERVAL '1 year', NOW() - INTERVAL '1 day', false)
      RETURNING id
    `)
    const etablissementId = etabResult.rows[0].id

    // Attempt to reactivate (should fail)
    await expect(
      pool.query(`
        SELECT public.reactivate_etablissement($1, $2)
      `, [etablissementId, adminId])
    ).rejects.toThrow(/Cannot reactivate expired establishment/)
  })

  /**
   * Additional Test: Non-Admin Cannot Confirm Payment
   * 
   * Verifies that only admin users can confirm payments.
   */
  test('Non-admin users cannot confirm payments', async () => {
    if (skipIfNoDB()) return

    // Create establishment
    const etabResult = await pool.query(`
      INSERT INTO etablissements (nom, statut_abonnement, date_debut, date_fin, actif)
      VALUES ('Test Restaurant', 'actif', NOW(), NOW() + INTERVAL '12 months', true)
      RETURNING id
    `)
    const etablissementId = etabResult.rows[0].id

    // Create non-admin user
    const userResult = await pool.query(`
      INSERT INTO auth.users (id, email)
      VALUES (gen_random_uuid(), 'patron@test.com')
      RETURNING id
    `)
    const userId = userResult.rows[0].id

    await pool.query(`
      INSERT INTO profiles (id, email, nom, prenom, role, etablissement_id, actif)
      VALUES ($1, 'patron@test.com', 'Patron', 'User', 'patron', $2, true)
    `, [userId, etablissementId])

    // Attempt to confirm payment as non-admin (should fail)
    await expect(
      pool.query(`
        SELECT public.confirm_payment_and_extend_subscription($1, $2)
      `, [etablissementId, userId])
    ).rejects.toThrow(/Only active admin users can confirm payments/)
  })
})
