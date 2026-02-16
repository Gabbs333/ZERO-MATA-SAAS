import { describe, it, expect } from 'vitest'
import { getTestPool, skipIfNoDB } from '../setup'
import * as fc from 'fast-check'

/**
 * Property-Based Tests for Admin Role Constraints
 * 
 * **Validates: Requirements 6.1, 6.3, 14.2**
 * 
 * Tests the following property:
 * - Property 19: Admin Role Validation
 */

// Arbitraries for test data
const roleArbitrary = fc.constantFrom('serveuse', 'comptoir', 'gerant', 'patron', 'admin')
const nonAdminRoleArbitrary = fc.constantFrom('serveuse', 'comptoir', 'gerant', 'patron')

const profileDataArbitrary = fc.record({
  email: fc.emailAddress(),
  nom: fc.string({ minLength: 2, maxLength: 50 }),
  prenom: fc.string({ minLength: 2, maxLength: 50 })
})

describe('Property 19: Admin Role Validation', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  it('should enforce that admin users have NULL etablissement_id', async () => {
    /**
     * **Validates: Requirements 6.1, 6.3, 14.2**
     * 
     * Property: For any profile with role set to 'admin', 
     * the etablissement_id SHALL be NULL.
     */
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        profileDataArbitrary,
        async (profileData) => {
          let userId: string | null = null
          let etablissementId: string | null = null
          
          try {
            // Create a test etablissement
            const etabResult = await pool.query(`
              INSERT INTO etablissements (nom)
              VALUES ('Test Etablissement')
              RETURNING id
            `)
            etablissementId = etabResult.rows[0].id
            
            // Create a test user in auth.users
            const authResult = await pool.query(`
              INSERT INTO auth.users (id, email)
              VALUES (uuid_generate_v4(), $1)
              RETURNING id
            `, [profileData.email])
            userId = authResult.rows[0].id
            
            // Attempt to create admin profile with non-NULL etablissement_id
            // This should be rejected by the CHECK constraint
            await expect(
              pool.query(`
                INSERT INTO profiles (id, email, nom, prenom, role, etablissement_id)
                VALUES ($1, $2, $3, $4, 'admin', $5)
              `, [userId, profileData.email, profileData.nom, profileData.prenom, etablissementId])
            ).rejects.toThrow()
            
            // Now create admin profile with NULL etablissement_id
            // This should succeed
            const result = await pool.query(`
              INSERT INTO profiles (id, email, nom, prenom, role, etablissement_id)
              VALUES ($1, $2, $3, $4, 'admin', NULL)
              RETURNING id, role, etablissement_id
            `, [userId, profileData.email, profileData.nom, profileData.prenom])
            
            // Property: Admin user should have NULL etablissement_id
            expect(result.rows[0].role).toBe('admin')
            expect(result.rows[0].etablissement_id).toBeNull()
            
          } finally {
            // Cleanup
            if (userId) {
              await pool.query('DELETE FROM profiles WHERE id = $1', [userId])
              await pool.query('DELETE FROM auth.users WHERE id = $1', [userId])
            }
            if (etablissementId) {
              await pool.query('DELETE FROM etablissements WHERE id = $1', [etablissementId])
            }
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  it('should enforce that non-admin users have non-NULL etablissement_id', async () => {
    /**
     * **Validates: Requirements 6.1, 6.3, 14.2**
     * 
     * Property: For any profile with role not equal to 'admin',
     * the etablissement_id SHALL NOT be NULL.
     */
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        profileDataArbitrary,
        nonAdminRoleArbitrary,
        async (profileData, role) => {
          let userId: string | null = null
          let etablissementId: string | null = null
          
          try {
            // Create a test etablissement
            const etabResult = await pool.query(`
              INSERT INTO etablissements (nom)
              VALUES ('Test Etablissement')
              RETURNING id
            `)
            etablissementId = etabResult.rows[0].id
            
            // Create a test user in auth.users
            const authResult = await pool.query(`
              INSERT INTO auth.users (id, email)
              VALUES (uuid_generate_v4(), $1)
              RETURNING id
            `, [profileData.email])
            userId = authResult.rows[0].id
            
            // Attempt to create non-admin profile with NULL etablissement_id
            // This should be rejected by the CHECK constraint
            await expect(
              pool.query(`
                INSERT INTO profiles (id, email, nom, prenom, role, etablissement_id)
                VALUES ($1, $2, $3, $4, $5, NULL)
              `, [userId, profileData.email, profileData.nom, profileData.prenom, role])
            ).rejects.toThrow()
            
            // Now create non-admin profile with non-NULL etablissement_id
            // This should succeed
            const result = await pool.query(`
              INSERT INTO profiles (id, email, nom, prenom, role, etablissement_id)
              VALUES ($1, $2, $3, $4, $5, $6)
              RETURNING id, role, etablissement_id
            `, [userId, profileData.email, profileData.nom, profileData.prenom, role, etablissementId])
            
            // Property: Non-admin user should have non-NULL etablissement_id
            expect(result.rows[0].role).toBe(role)
            expect(result.rows[0].etablissement_id).not.toBeNull()
            expect(result.rows[0].etablissement_id).toBe(etablissementId)
            
          } finally {
            // Cleanup
            if (userId) {
              await pool.query('DELETE FROM profiles WHERE id = $1', [userId])
              await pool.query('DELETE FROM auth.users WHERE id = $1', [userId])
            }
            if (etablissementId) {
              await pool.query('DELETE FROM etablissements WHERE id = $1', [etablissementId])
            }
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  it('should allow updating role from non-admin to admin only if etablissement_id is set to NULL', async () => {
    /**
     * **Validates: Requirements 6.1, 6.3, 14.2**
     * 
     * Property: When updating a profile's role from non-admin to admin,
     * the etablissement_id must be set to NULL in the same operation.
     */
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        profileDataArbitrary,
        nonAdminRoleArbitrary,
        async (profileData, initialRole) => {
          let userId: string | null = null
          let etablissementId: string | null = null
          
          try {
            // Create a test etablissement
            const etabResult = await pool.query(`
              INSERT INTO etablissements (nom)
              VALUES ('Test Etablissement')
              RETURNING id
            `)
            etablissementId = etabResult.rows[0].id
            
            // Create a test user in auth.users
            const authResult = await pool.query(`
              INSERT INTO auth.users (id, email)
              VALUES (uuid_generate_v4(), $1)
              RETURNING id
            `, [profileData.email])
            userId = authResult.rows[0].id
            
            // Create non-admin profile with etablissement_id
            await pool.query(`
              INSERT INTO profiles (id, email, nom, prenom, role, etablissement_id)
              VALUES ($1, $2, $3, $4, $5, $6)
            `, [userId, profileData.email, profileData.nom, profileData.prenom, initialRole, etablissementId])
            
            // Attempt to update role to admin without setting etablissement_id to NULL
            // This should be rejected
            await expect(
              pool.query(`
                UPDATE profiles
                SET role = 'admin'
                WHERE id = $1
              `, [userId])
            ).rejects.toThrow()
            
            // Update role to admin AND set etablissement_id to NULL
            // This should succeed
            const result = await pool.query(`
              UPDATE profiles
              SET role = 'admin', etablissement_id = NULL
              WHERE id = $1
              RETURNING id, role, etablissement_id
            `, [userId])
            
            // Property: Admin role should have NULL etablissement_id
            expect(result.rows[0].role).toBe('admin')
            expect(result.rows[0].etablissement_id).toBeNull()
            
          } finally {
            // Cleanup
            if (userId) {
              await pool.query('DELETE FROM profiles WHERE id = $1', [userId])
              await pool.query('DELETE FROM auth.users WHERE id = $1', [userId])
            }
            if (etablissementId) {
              await pool.query('DELETE FROM etablissements WHERE id = $1', [etablissementId])
            }
          }
        }
      ),
      { numRuns: 30 }
    )
  })

  it('should allow updating role from admin to non-admin only if etablissement_id is set to non-NULL', async () => {
    /**
     * **Validates: Requirements 6.1, 6.3, 14.2**
     * 
     * Property: When updating a profile's role from admin to non-admin,
     * the etablissement_id must be set to a non-NULL value in the same operation.
     */
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        profileDataArbitrary,
        nonAdminRoleArbitrary,
        async (profileData, newRole) => {
          let userId: string | null = null
          let etablissementId: string | null = null
          
          try {
            // Create a test etablissement
            const etabResult = await pool.query(`
              INSERT INTO etablissements (nom)
              VALUES ('Test Etablissement')
              RETURNING id
            `)
            etablissementId = etabResult.rows[0].id
            
            // Create a test user in auth.users
            const authResult = await pool.query(`
              INSERT INTO auth.users (id, email)
              VALUES (uuid_generate_v4(), $1)
              RETURNING id
            `, [profileData.email])
            userId = authResult.rows[0].id
            
            // Create admin profile with NULL etablissement_id
            await pool.query(`
              INSERT INTO profiles (id, email, nom, prenom, role, etablissement_id)
              VALUES ($1, $2, $3, $4, 'admin', NULL)
            `, [userId, profileData.email, profileData.nom, profileData.prenom])
            
            // Attempt to update role to non-admin without setting etablissement_id
            // This should be rejected
            await expect(
              pool.query(`
                UPDATE profiles
                SET role = $1
                WHERE id = $2
              `, [newRole, userId])
            ).rejects.toThrow()
            
            // Update role to non-admin AND set etablissement_id to non-NULL
            // This should succeed
            const result = await pool.query(`
              UPDATE profiles
              SET role = $1, etablissement_id = $2
              WHERE id = $3
              RETURNING id, role, etablissement_id
            `, [newRole, etablissementId, userId])
            
            // Property: Non-admin role should have non-NULL etablissement_id
            expect(result.rows[0].role).toBe(newRole)
            expect(result.rows[0].etablissement_id).not.toBeNull()
            expect(result.rows[0].etablissement_id).toBe(etablissementId)
            
          } finally {
            // Cleanup
            if (userId) {
              await pool.query('DELETE FROM profiles WHERE id = $1', [userId])
              await pool.query('DELETE FROM auth.users WHERE id = $1', [userId])
            }
            if (etablissementId) {
              await pool.query('DELETE FROM etablissements WHERE id = $1', [etablissementId])
            }
          }
        }
      ),
      { numRuns: 30 }
    )
  })

  it('should maintain constraint across all role values', async () => {
    /**
     * **Validates: Requirements 6.1, 6.3, 14.2**
     * 
     * Property: The admin/etablissement_id constraint should hold
     * for all possible role values.
     */
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        profileDataArbitrary,
        roleArbitrary,
        async (profileData, role) => {
          let userId: string | null = null
          let etablissementId: string | null = null
          
          try {
            // Create a test etablissement
            const etabResult = await pool.query(`
              INSERT INTO etablissements (nom)
              VALUES ('Test Etablissement')
              RETURNING id
            `)
            etablissementId = etabResult.rows[0].id
            
            // Create a test user in auth.users
            const authResult = await pool.query(`
              INSERT INTO auth.users (id, email)
              VALUES (uuid_generate_v4(), $1)
              RETURNING id
            `, [profileData.email])
            userId = authResult.rows[0].id
            
            // Determine correct etablissement_id based on role
            const correctEtablissementId = role === 'admin' ? null : etablissementId
            
            // Create profile with correct etablissement_id for role
            const result = await pool.query(`
              INSERT INTO profiles (id, email, nom, prenom, role, etablissement_id)
              VALUES ($1, $2, $3, $4, $5, $6)
              RETURNING id, role, etablissement_id
            `, [userId, profileData.email, profileData.nom, profileData.prenom, role, correctEtablissementId])
            
            // Property: Constraint should be satisfied
            if (role === 'admin') {
              expect(result.rows[0].etablissement_id).toBeNull()
            } else {
              expect(result.rows[0].etablissement_id).not.toBeNull()
              expect(result.rows[0].etablissement_id).toBe(etablissementId)
            }
            
          } finally {
            // Cleanup
            if (userId) {
              await pool.query('DELETE FROM profiles WHERE id = $1', [userId])
              await pool.query('DELETE FROM auth.users WHERE id = $1', [userId])
            }
            if (etablissementId) {
              await pool.query('DELETE FROM etablissements WHERE id = $1', [etablissementId])
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
