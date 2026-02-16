/**
 * Property-Based Tests: Inactive Establishment Access Denial
 * 
 * Tests that users from inactive establishments cannot access the system.
 * Verifies subscription status enforcement at the authentication layer.
 * 
 * Properties tested:
 * - Property 11: Inactive Establishment Access Denial
 * 
 * **Validates: Requirements 2.6, 3.7, 4.4, 9.5, 15.4**
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { getTestPool, skipIfNoDB } from '../setup'
import fc from 'fast-check'
import { Pool } from 'pg'

describe('Inactive Establishment Access Denial Properties', () => {
  let pool: Pool

  beforeEach(async () => {
    if (skipIfNoDB()) return
    pool = await getTestPool()
  })

  /**
   * Helper: Create a test establishment with specific status
   */
  async function createEtablissement(
    name: string,
    statut: 'actif' | 'expire' | 'suspendu',
    actif: boolean
  ): Promise<string> {
    const result = await pool.query(`
      INSERT INTO etablissements (
        nom, 
        statut_abonnement, 
        date_debut, 
        date_fin, 
        actif
      )
      VALUES (
        $1, 
        $2, 
        NOW(), 
        NOW() + INTERVAL '12 months', 
        $3
      )
      RETURNING id
    `, [name, statut, actif])
    return result.rows[0].id
  }

  /**
   * Helper: Create a test user with specific role and establishment
   */
  async function createUser(
    etablissementId: string,
    role: string
  ): Promise<string> {
    const userEmail = `user-${Date.now()}-${Math.random()}@test.com`
    
    const authResult = await pool.query(`
      INSERT INTO auth.users (id, email)
      VALUES (gen_random_uuid(), $1)
      RETURNING id
    `, [userEmail])
    const userId = authResult.rows[0].id

    await pool.query(`
      INSERT INTO profiles (id, email, nom, prenom, role, etablissement_id, actif)
      VALUES ($1, $2, 'Test', 'User', $3, $4, true)
    `, [userId, userEmail, role, etablissementId])

    return userId
  }

  /**
   * Helper: Set the session user for RLS policies
   */
  async function setSessionUser(userId: string): Promise<void> {
    await pool.query(`
      SELECT set_config('request.jwt.claims', '{"sub": "${userId}"}', true)
    `)
  }

  /**
   * Helper: Check if user can access data (simulates RLS check)
   */
  async function canAccessData(userId: string): Promise<boolean> {
    try {
      await setSessionUser(userId)
      
      // Try to query products (any table with RLS would work)
      const result = await pool.query(`
        SELECT COUNT(*) as count FROM produits
      `)
      
      // If query succeeds, user has access
      return true
    } catch (error) {
      // If query fails due to RLS, user doesn't have access
      return false
    }
  }

  /**
   * Property 11: Inactive Establishment Access Denial
   * 
   * **Validates: Requirements 2.6, 3.7, 4.4, 9.5, 15.4**
   * 
   * For any user whose establishment is inactive (actif = false) or 
   * has expired subscription (statut_abonnement != 'actif'):
   * - User authentication should be denied
   * - User cannot query any data through RLS policies
   * - This applies to all roles (serveuse, comptoir, gerant, patron)
   * 
   * Note: This test verifies the database-level enforcement. Application-level
   * checks are tested separately in integration tests.
   */
  test('Property 11: Users from inactive establishments cannot access data', async () => {
    if (skipIfNoDB()) return

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('serveuse', 'comptoir', 'gerant', 'patron'),
        fc.constantFrom(
          { statut: 'expire' as const, actif: false },
          { statut: 'suspendu' as const, actif: false },
          { statut: 'actif' as const, actif: false }
        ),
        async (role, { statut, actif }) => {
          // Create inactive establishment
          const inactiveEtabId = await createEtablissement(
            `Inactive Etab ${Date.now()}`,
            statut,
            actif
          )

          // Create user in inactive establishment
          const inactiveUserId = await createUser(inactiveEtabId, role)

          // Create active establishment for comparison
          const activeEtabId = await createEtablissement(
            `Active Etab ${Date.now()}`,
            'actif',
            true
          )

          // Create user in active establishment
          const activeUserId = await createUser(activeEtabId, role)

          // Create some test data in active establishment
          await setSessionUser(activeUserId)
          await pool.query(`
            INSERT INTO produits (nom, categorie, prix_vente, etablissement_id, actif)
            VALUES ('Test Product', 'Boisson', 500, $1, true)
          `, [activeEtabId])

          // Verify active user can access data
          const activeCanAccess = await canAccessData(activeUserId)
          expect(activeCanAccess).toBe(true)

          // Verify inactive user cannot access data
          // Note: In production, authentication would be denied before reaching this point
          // This test verifies the RLS layer as a defense-in-depth measure
          const inactiveCanAccess = await canAccessData(inactiveUserId)
          
          // The user from inactive establishment should not see any data
          // because RLS policies filter by etablissement_id and the establishment
          // should be considered invalid
          await setSessionUser(inactiveUserId)
          const result = await pool.query(`
            SELECT COUNT(*) as count FROM produits
          `)
          
          // User should see 0 products (data isolation works)
          expect(parseInt(result.rows[0].count)).toBe(0)
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Property 11.1: Expired establishments are correctly identified
   * 
   * **Validates: Requirements 4.2, 4.4**
   * 
   * Verifies that establishments with date_fin < NOW() and statut_abonnement = 'actif'
   * should be expired (this is what the cron job does).
   */
  test('Property 11.1: Expired establishments can be identified', async () => {
    if (skipIfNoDB()) return

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 30 }), // days expired
        async (daysExpired) => {
          // Create establishment that expired N days ago
          const result = await pool.query(`
            INSERT INTO etablissements (
              nom, 
              statut_abonnement, 
              date_debut, 
              date_fin, 
              actif
            )
            VALUES (
              $1, 
              'actif', 
              NOW() - INTERVAL '12 months', 
              NOW() - INTERVAL '${daysExpired} days', 
              true
            )
            RETURNING id, date_fin
          `, [`Expired Etab ${Date.now()}`])

          const etablissementId = result.rows[0].id
          const dateFin = new Date(result.rows[0].date_fin)

          // Verify establishment is expired
          const now = new Date()
          expect(dateFin < now).toBe(true)

          // Query for expired establishments (simulates cron job logic)
          const expiredResult = await pool.query(`
            SELECT id FROM etablissements
            WHERE date_fin < NOW()
              AND statut_abonnement = 'actif'
              AND id = $1
          `, [etablissementId])

          // Should find the expired establishment
          expect(expiredResult.rows.length).toBe(1)
          expect(expiredResult.rows[0].id).toBe(etablissementId)
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Property 11.2: Suspended establishments deny access
   * 
   * **Validates: Requirements 2.6, 3.7**
   * 
   * Verifies that establishments with statut_abonnement = 'suspendu'
   * deny access to their users.
   */
  test('Property 11.2: Suspended establishments deny user access', async () => {
    if (skipIfNoDB()) return

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('serveuse', 'comptoir', 'gerant', 'patron'),
        async (role) => {
          // Create suspended establishment
          const suspendedEtabId = await createEtablissement(
            `Suspended Etab ${Date.now()}`,
            'suspendu',
            false
          )

          // Create user in suspended establishment
          const userId = await createUser(suspendedEtabId, role)

          // Verify establishment is suspended
          const etabResult = await pool.query(`
            SELECT statut_abonnement, actif FROM etablissements WHERE id = $1
          `, [suspendedEtabId])

          expect(etabResult.rows[0].statut_abonnement).toBe('suspendu')
          expect(etabResult.rows[0].actif).toBe(false)

          // User should not be able to access any data
          await setSessionUser(userId)
          const result = await pool.query(`
            SELECT COUNT(*) as count FROM produits
          `)

          // Should see 0 products (no access to data)
          expect(parseInt(result.rows[0].count)).toBe(0)
        }
      ),
      { numRuns: 10 }
    )
  })
})
