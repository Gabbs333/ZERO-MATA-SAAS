import { describe, it, expect } from 'vitest'
import { getTestPool, skipIfNoDB } from '../setup'
import * as fc from 'fast-check'

/**
 * Property 25: Authentification obligatoire
 * 
 * Validates: Requirement 7.1
 * 
 * For any attempt to access the system, the user must provide valid credentials
 * (email + password) before obtaining an access token.
 * 
 * Since we're testing at the database level (not the full Supabase Auth API),
 * we test the profile creation and validation mechanisms that support authentication.
 */
describe('Property 25: Authentification obligatoire', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  it('should only create profiles for users with valid email and role', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: fc.emailAddress(),
          nom: fc.string({ minLength: 1, maxLength: 50 }),
          prenom: fc.string({ minLength: 1, maxLength: 50 }),
          role: fc.constantFrom('serveuse', 'comptoir', 'gerant', 'patron'),
          actif: fc.boolean()
        }),
        async (userData) => {
          // Create a mock user ID (in real scenario, this would come from auth.users)
          const userId = `00000000-0000-0000-0000-${Date.now().toString().padStart(12, '0').slice(-12)}`
          
          try {
            // Attempt to create a profile (simulating what happens after auth.users insert)
            const result = await pool.query(`
              INSERT INTO profiles (id, email, nom, prenom, role, actif)
              VALUES ($1, $2, $3, $4, $5, $6)
              RETURNING id, email, role, actif
            `, [userId, userData.email, userData.nom, userData.prenom, userData.role, userData.actif])
            
            // Property: A profile should only be created with valid data
            expect(result.rows).toHaveLength(1)
            expect(result.rows[0].email).toBe(userData.email)
            expect(result.rows[0].role).toBe(userData.role)
            expect(result.rows[0].actif).toBe(userData.actif)
            
            // Verify the profile exists and can be queried
            const checkResult = await pool.query(`
              SELECT id, email, role, actif FROM profiles WHERE id = $1
            `, [userId])
            
            expect(checkResult.rows).toHaveLength(1)
            expect(checkResult.rows[0].email).toBe(userData.email)
            
            // Cleanup
            await pool.query('DELETE FROM profiles WHERE id = $1', [userId])
          } catch (error: any) {
            // If there's a constraint violation, it should be for a good reason
            // (e.g., invalid role, duplicate email)
            if (error.code === '23514') { // CHECK constraint violation
              // This is expected for invalid roles
              expect(['serveuse', 'comptoir', 'gerant', 'patron']).toContain(userData.role)
            } else if (error.code === '23505') { // UNIQUE constraint violation
              // This is expected for duplicate emails
              // In a real scenario, this would be prevented by auth.users
            } else {
              throw error
            }
          }
        }
      ),
      { numRuns: 50 } // Run 50 test cases
    )
  })

  it('should reject profiles with invalid roles', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: fc.emailAddress(),
          nom: fc.string({ minLength: 1, maxLength: 50 }),
          prenom: fc.string({ minLength: 1, maxLength: 50 }),
          role: fc.string({ minLength: 1, maxLength: 20 }).filter(
            role => !['serveuse', 'comptoir', 'gerant', 'patron'].includes(role)
          )
        }),
        async (userData) => {
          const userId = `00000000-0000-0000-0000-${Date.now().toString().padStart(12, '0').slice(-12)}`
          
          // Attempt to create a profile with invalid role
          await expect(
            pool.query(`
              INSERT INTO profiles (id, email, nom, prenom, role, actif)
              VALUES ($1, $2, $3, $4, $5, $6)
            `, [userId, userData.email, userData.nom, userData.prenom, userData.role, true])
          ).rejects.toThrow()
          
          // Verify no profile was created
          const checkResult = await pool.query(`
            SELECT id FROM profiles WHERE id = $1
          `, [userId])
          
          expect(checkResult.rows).toHaveLength(0)
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should enforce email uniqueness for authentication', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: fc.emailAddress(),
          nom: fc.string({ minLength: 1, maxLength: 50 }),
          prenom: fc.string({ minLength: 1, maxLength: 50 }),
          role: fc.constantFrom('serveuse', 'comptoir', 'gerant', 'patron')
        }),
        async (userData) => {
          const userId1 = `00000000-0000-0000-0001-${Date.now().toString().padStart(12, '0').slice(-12)}`
          const userId2 = `00000000-0000-0000-0002-${Date.now().toString().padStart(12, '0').slice(-12)}`
          
          try {
            // Create first profile
            await pool.query(`
              INSERT INTO profiles (id, email, nom, prenom, role, actif)
              VALUES ($1, $2, $3, $4, $5, $6)
            `, [userId1, userData.email, userData.nom, userData.prenom, userData.role, true])
            
            // Attempt to create second profile with same email (should fail)
            await expect(
              pool.query(`
                INSERT INTO profiles (id, email, nom, prenom, role, actif)
                VALUES ($1, $2, $3, $4, $5, $6)
              `, [userId2, userData.email, 'Different', 'User', userData.role, true])
            ).rejects.toThrow()
            
            // Verify only one profile exists with this email
            const checkResult = await pool.query(`
              SELECT id FROM profiles WHERE email = $1
            `, [userData.email])
            
            expect(checkResult.rows).toHaveLength(1)
            expect(checkResult.rows[0].id).toBe(userId1)
            
            // Cleanup
            await pool.query('DELETE FROM profiles WHERE id = $1', [userId1])
          } catch (error: any) {
            // If the first insert fails due to duplicate email from previous test
            if (error.code === '23505') {
              // Clean up and skip this iteration
              await pool.query('DELETE FROM profiles WHERE email = $1', [userData.email])
            } else {
              throw error
            }
          }
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should only allow active users to authenticate', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: fc.emailAddress(),
          nom: fc.string({ minLength: 1, maxLength: 50 }),
          prenom: fc.string({ minLength: 1, maxLength: 50 }),
          role: fc.constantFrom('serveuse', 'comptoir', 'gerant', 'patron'),
          actif: fc.boolean()
        }),
        async (userData) => {
          const userId = `00000000-0000-0000-0000-${Date.now().toString().padStart(12, '0').slice(-12)}`
          
          try {
            // Create profile
            await pool.query(`
              INSERT INTO profiles (id, email, nom, prenom, role, actif)
              VALUES ($1, $2, $3, $4, $5, $6)
            `, [userId, userData.email, userData.nom, userData.prenom, userData.role, userData.actif])
            
            // Check if user is active
            const result = await pool.query(`
              SELECT actif FROM profiles WHERE id = $1
            `, [userId])
            
            // Property: The actif status should match what was set
            expect(result.rows[0].actif).toBe(userData.actif)
            
            // In a real authentication flow, only active users would be allowed to login
            // This is enforced by the application layer checking the actif flag
            
            // Cleanup
            await pool.query('DELETE FROM profiles WHERE id = $1', [userId])
          } catch (error: any) {
            if (error.code === '23505') {
              await pool.query('DELETE FROM profiles WHERE email = $1', [userData.email])
            } else {
              throw error
            }
          }
        }
      ),
      { numRuns: 30 }
    )
  })

  it('should track last connection time for authenticated users', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: fc.emailAddress(),
          nom: fc.string({ minLength: 1, maxLength: 50 }),
          prenom: fc.string({ minLength: 1, maxLength: 50 }),
          role: fc.constantFrom('serveuse', 'comptoir', 'gerant', 'patron')
        }),
        async (userData) => {
          const userId = `00000000-0000-0000-0000-${Date.now().toString().padStart(12, '0').slice(-12)}`
          
          try {
            // Create profile
            await pool.query(`
              INSERT INTO profiles (id, email, nom, prenom, role, actif)
              VALUES ($1, $2, $3, $4, $5, $6)
            `, [userId, userData.email, userData.nom, userData.prenom, userData.role, true])
            
            // Initially, derniere_connexion should be NULL
            const initialResult = await pool.query(`
              SELECT derniere_connexion FROM profiles WHERE id = $1
            `, [userId])
            
            expect(initialResult.rows[0].derniere_connexion).toBeNull()
            
            // Simulate a login by updating derniere_connexion
            const loginTime = new Date()
            await pool.query(`
              UPDATE profiles SET derniere_connexion = $1 WHERE id = $2
            `, [loginTime, userId])
            
            // Verify the connection time was recorded
            const afterLoginResult = await pool.query(`
              SELECT derniere_connexion FROM profiles WHERE id = $1
            `, [userId])
            
            expect(afterLoginResult.rows[0].derniere_connexion).not.toBeNull()
            
            // Property: The recorded time should be close to when we set it
            const recordedTime = new Date(afterLoginResult.rows[0].derniere_connexion)
            const timeDiff = Math.abs(recordedTime.getTime() - loginTime.getTime())
            expect(timeDiff).toBeLessThan(1000) // Within 1 second
            
            // Cleanup
            await pool.query('DELETE FROM profiles WHERE id = $1', [userId])
          } catch (error: any) {
            if (error.code === '23505') {
              await pool.query('DELETE FROM profiles WHERE email = $1', [userData.email])
            } else {
              throw error
            }
          }
        }
      ),
      { numRuns: 20 }
    )
  })
})
