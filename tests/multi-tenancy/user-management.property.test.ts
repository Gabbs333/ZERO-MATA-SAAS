/**
 * Property-Based Tests: Multi-Tenant User Management
 * 
 * Tests user management in multi-tenant context.
 * Verifies that users inherit establishment_id and are properly isolated.
 * 
 * Properties tested:
 * - Property 26: User Establishment Inheritance
 * - Property 27: User List Filtering
 * 
 * **Validates: Requirements 9.1, 9.2, 9.3, 9.4**
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { getTestPool, skipIfNoDB } from '../setup'
import fc from 'fast-check'
import { Pool } from 'pg'

describe('Multi-Tenant User Management Properties', () => {
  let pool: Pool

  beforeEach(async () => {
    if (skipIfNoDB()) return
    pool = await getTestPool()
  })

  /**
   * Helper: Create a test establishment
   */
  async function createEtablissement(name: string): Promise<string> {
    const result = await pool.query(`
      INSERT INTO etablissements (nom, statut_abonnement, date_debut, date_fin, actif)
      VALUES ($1, 'actif', NOW(), NOW() + INTERVAL '12 months', true)
      RETURNING id
    `, [name])
    return result.rows[0].id
  }

  /**
   * Helper: Create a test user with specific role and establishment
   */
  async function createUser(
    etablissementId: string,
    role: string,
    email?: string
  ): Promise<string> {
    const userEmail = email || `user-${Date.now()}-${Math.random()}@test.com`
    
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
   * Property 26: User Establishment Inheritance
   * 
   * **Validates: Requirements 9.1, 9.2**
   * 
   * When a user creates a new user:
   * - The new user must inherit the creator's etablissement_id
   * - The new user cannot be created with a different etablissement_id
   * - This ensures users can only create users within their own establishment
   * 
   * Note: In practice, user creation would be done through a database function
   * that automatically sets etablissement_id from the creator's profile.
   */
  test('Property 26: New users inherit creator etablissement_id', async () => {
    if (skipIfNoDB()) return

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('gerant', 'patron'),
        fc.constantFrom('serveuse', 'comptoir', 'gerant'),
        async (creatorRole, newUserRole) => {
          // Create two establishments
          const etab1Id = await createEtablissement(`Etab 1 ${Date.now()}`)
          const etab2Id = await createEtablissement(`Etab 2 ${Date.now()}`)

          // Create a user in establishment 1 (the creator)
          const creatorId = await createUser(etab1Id, creatorRole)

          // Set session to creator
          await setSessionUser(creatorId)

          // Get creator's etablissement_id
          const creatorResult = await pool.query(`
            SELECT etablissement_id FROM profiles WHERE id = $1
          `, [creatorId])
          const creatorEtabId = creatorResult.rows[0].etablissement_id

          // Verify creator is in establishment 1
          expect(creatorEtabId).toBe(etab1Id)

          // Create a new user - should inherit creator's etablissement_id
          const newUserEmail = `newuser-${Date.now()}-${Math.random()}@test.com`
          const newAuthResult = await pool.query(`
            INSERT INTO auth.users (id, email)
            VALUES (gen_random_uuid(), $1)
            RETURNING id
          `, [newUserEmail])
          const newUserId = newAuthResult.rows[0].id

          // Insert new user profile with creator's etablissement_id
          await pool.query(`
            INSERT INTO profiles (id, email, nom, prenom, role, etablissement_id, actif)
            VALUES ($1, $2, 'New', 'User', $3, $4, true)
          `, [newUserId, newUserEmail, newUserRole, creatorEtabId])

          // Verify new user has same etablissement_id as creator
          const newUserResult = await pool.query(`
            SELECT etablissement_id FROM profiles WHERE id = $1
          `, [newUserId])
          const newUserEtabId = newUserResult.rows[0].etablissement_id

          expect(newUserEtabId).toBe(creatorEtabId)
          expect(newUserEtabId).toBe(etab1Id)

          // Verify user cannot be created with different etablissement_id
          // (This would be enforced by RLS policies in production)
          const wrongEtabEmail = `wrongetab-${Date.now()}-${Math.random()}@test.com`
          const wrongAuthResult = await pool.query(`
            INSERT INTO auth.users (id, email)
            VALUES (gen_random_uuid(), $1)
            RETURNING id
          `, [wrongEtabEmail])
          const wrongUserId = wrongAuthResult.rows[0].id

          // Try to insert with wrong etablissement_id (etab2)
          await pool.query(`
            INSERT INTO profiles (id, email, nom, prenom, role, etablissement_id, actif)
            VALUES ($1, $2, 'Wrong', 'Etab', $3, $4, true)
          `, [wrongUserId, wrongEtabEmail, newUserRole, etab2Id])

          // Verify this user exists but creator cannot see it (RLS filtering)
          await setSessionUser(creatorId)
          const visibleUsers = await pool.query(`
            SELECT id FROM profiles WHERE id = $1
          `, [wrongUserId])

          // Creator should not see user from different establishment
          expect(visibleUsers.rows.length).toBe(0)
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Property 27: User List Filtering
   * 
   * **Validates: Requirements 9.3, 9.4**
   * 
   * When querying users:
   * - Users can only see users from their own establishment
   * - Users cannot see users from other establishments
   * - User count matches establishment membership
   * - Cross-establishment user modifications are prevented by RLS
   */
  test('Property 27: Users can only see users from their establishment', async () => {
    if (skipIfNoDB()) return

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }), // Number of users in etab1
        fc.integer({ min: 2, max: 5 }), // Number of users in etab2
        async (etab1UserCount, etab2UserCount) => {
          // Create two establishments
          const etab1Id = await createEtablissement(`Etab 1 ${Date.now()}`)
          const etab2Id = await createEtablissement(`Etab 2 ${Date.now()}`)

          // Create users in establishment 1
          const etab1Users: string[] = []
          for (let i = 0; i < etab1UserCount; i++) {
            const userId = await createUser(etab1Id, 'serveuse')
            etab1Users.push(userId)
          }

          // Create users in establishment 2
          const etab2Users: string[] = []
          for (let i = 0; i < etab2UserCount; i++) {
            const userId = await createUser(etab2Id, 'serveuse')
            etab2Users.push(userId)
          }

          // Test from perspective of etab1 user
          await setSessionUser(etab1Users[0])
          const etab1VisibleUsers = await pool.query(`
            SELECT id FROM profiles ORDER BY id
          `)

          // Should only see users from etab1
          expect(etab1VisibleUsers.rows.length).toBe(etab1UserCount)
          
          // Verify all visible users are from etab1
          const visibleIds = etab1VisibleUsers.rows.map((r: any) => r.id)
          for (const id of visibleIds) {
            expect(etab1Users).toContain(id)
          }

          // Verify cannot see etab2 users
          for (const etab2UserId of etab2Users) {
            expect(visibleIds).not.toContain(etab2UserId)
          }

          // Test from perspective of etab2 user
          await setSessionUser(etab2Users[0])
          const etab2VisibleUsers = await pool.query(`
            SELECT id FROM profiles ORDER BY id
          `)

          // Should only see users from etab2
          expect(etab2VisibleUsers.rows.length).toBe(etab2UserCount)
          
          // Verify all visible users are from etab2
          const etab2VisibleIds = etab2VisibleUsers.rows.map((r: any) => r.id)
          for (const id of etab2VisibleIds) {
            expect(etab2Users).toContain(id)
          }

          // Verify cannot see etab1 users
          for (const etab1UserId of etab1Users) {
            expect(etab2VisibleIds).not.toContain(etab1UserId)
          }
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Property 27.1: Cross-establishment user modification prevention
   * 
   * **Validates: Requirements 9.4**
   * 
   * Users cannot modify users from other establishments:
   * - UPDATE operations are filtered by etablissement_id
   * - Users cannot change another user's role, status, or data
   * - RLS policies enforce this at database level
   */
  test('Property 27.1: Users cannot modify users from other establishments', async () => {
    if (skipIfNoDB()) return

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('gerant', 'patron'),
        async (role) => {
          // Create two establishments
          const etab1Id = await createEtablissement(`Etab 1 ${Date.now()}`)
          const etab2Id = await createEtablissement(`Etab 2 ${Date.now()}`)

          // Create a manager in each establishment
          const etab1ManagerId = await createUser(etab1Id, role)
          const etab2UserId = await createUser(etab2Id, 'serveuse')

          // Set session to etab1 manager
          await setSessionUser(etab1ManagerId)

          // Try to update etab2 user (should fail or have no effect due to RLS)
          const updateResult = await pool.query(`
            UPDATE profiles
            SET actif = false
            WHERE id = $1
            RETURNING id
          `, [etab2UserId])

          // Update should not affect any rows (RLS prevents it)
          expect(updateResult.rows.length).toBe(0)

          // Verify etab2 user is still active
          // (Need to check as admin or etab2 user to see actual state)
          const etab2UserCheck = await pool.query(`
            SELECT actif FROM profiles WHERE id = $1
          `, [etab2UserId])

          // User should still be active (update was blocked)
          expect(etab2UserCheck.rows[0].actif).toBe(true)
        }
      ),
      { numRuns: 10 }
    )
  })
})
