import { describe, it, expect } from 'vitest'
import { getTestPool, skipIfNoDB } from '../setup'
import * as fc from 'fast-check'

/**
 * Property-Based Tests for Etablissement Creation
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
 * 
 * Tests the following properties:
 * - Property 8: Unique Establishment IDs
 * - Property 9: Establishment Creation Defaults
 * - Property 10: Valid Establishment Status Values
 */

// Arbitraries (generators) for etablissement data
const statutArbitrary = fc.constantFrom('actif', 'expire', 'suspendu')

const etablissementArbitrary = fc.record({
  nom: fc.string({ minLength: 3, maxLength: 100 }),
  adresse: fc.option(fc.string({ minLength: 5, maxLength: 200 }), { nil: null }),
  telephone: fc.option(fc.string({ minLength: 8, maxLength: 20 }), { nil: null }),
  email: fc.option(fc.emailAddress(), { nil: null })
})

describe('Property 8: Unique Establishment IDs', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  it('should generate unique IDs for all establishment creation operations', async () => {
    /**
     * **Validates: Requirements 2.1**
     * 
     * Property: For any two establishment creation operations, 
     * the generated etablissement_id values SHALL be unique.
     */
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.array(etablissementArbitrary, { minLength: 2, maxLength: 10 }),
        async (etablissements) => {
          const createdIds: string[] = []
          
          try {
            // Create multiple establishments
            for (const etab of etablissements) {
              const result = await pool.query(`
                INSERT INTO etablissements (nom, adresse, telephone, email)
                VALUES ($1, $2, $3, $4)
                RETURNING id
              `, [etab.nom, etab.adresse, etab.telephone, etab.email])
              
              createdIds.push(result.rows[0].id)
            }
            
            // Property: All IDs must be unique
            const uniqueIds = new Set(createdIds)
            expect(uniqueIds.size).toBe(createdIds.length)
            
            // Verify all IDs are valid UUIDs
            for (const id of createdIds) {
              expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
            }
            
          } finally {
            // Cleanup
            for (const id of createdIds) {
              await pool.query('DELETE FROM etablissements WHERE id = $1', [id])
            }
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  it('should generate different IDs even for identical establishment data', async () => {
    /**
     * **Validates: Requirements 2.1**
     * 
     * Property: Even when creating establishments with identical data,
     * each should receive a unique ID.
     */
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        etablissementArbitrary,
        fc.integer({ min: 2, max: 5 }),
        async (etabData, count) => {
          const createdIds: string[] = []
          
          try {
            // Create multiple establishments with identical data
            for (let i = 0; i < count; i++) {
              const result = await pool.query(`
                INSERT INTO etablissements (nom, adresse, telephone, email)
                VALUES ($1, $2, $3, $4)
                RETURNING id
              `, [etabData.nom, etabData.adresse, etabData.telephone, etabData.email])
              
              createdIds.push(result.rows[0].id)
            }
            
            // Property: All IDs must be unique despite identical data
            const uniqueIds = new Set(createdIds)
            expect(uniqueIds.size).toBe(count)
            
          } finally {
            // Cleanup
            for (const id of createdIds) {
              await pool.query('DELETE FROM etablissements WHERE id = $1', [id])
            }
          }
        }
      ),
      { numRuns: 30 }
    )
  })
})

describe('Property 9: Establishment Creation Defaults', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  it('should set correct defaults for all establishment creations', async () => {
    /**
     * **Validates: Requirements 2.2, 2.4, 2.5, 3.1, 3.2**
     * 
     * Property: For any establishment creation, the record SHALL have:
     * - statut_abonnement set to 'actif'
     * - actif set to true
     * - date_debut set to current timestamp
     * - date_fin set to date_debut + 12 months
     */
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        etablissementArbitrary,
        async (etabData) => {
          let createdId: string | null = null
          
          try {
            const beforeCreation = new Date()
            
            // Create establishment without specifying defaults
            const result = await pool.query(`
              INSERT INTO etablissements (nom, adresse, telephone, email)
              VALUES ($1, $2, $3, $4)
              RETURNING id, statut_abonnement, actif, date_debut, date_fin, date_creation
            `, [etabData.nom, etabData.adresse, etabData.telephone, etabData.email])
            
            const afterCreation = new Date()
            const created = result.rows[0]
            createdId = created.id
            
            // Property 1: statut_abonnement should be 'actif'
            expect(created.statut_abonnement).toBe('actif')
            
            // Property 2: actif should be true
            expect(created.actif).toBe(true)
            
            // Property 3: date_debut should be set to current timestamp
            const dateDebut = new Date(created.date_debut)
            expect(dateDebut.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime() - 1000)
            expect(dateDebut.getTime()).toBeLessThanOrEqual(afterCreation.getTime() + 1000)
            
            // Property 4: date_fin should be date_debut + 12 months
            const dateFin = new Date(created.date_fin)
            const expectedDateFin = new Date(dateDebut)
            expectedDateFin.setMonth(expectedDateFin.getMonth() + 12)
            
            // Allow 1 second tolerance for timestamp precision
            const timeDiff = Math.abs(dateFin.getTime() - expectedDateFin.getTime())
            expect(timeDiff).toBeLessThan(2000) // 2 seconds tolerance
            
            // Property 5: date_creation should be set
            expect(created.date_creation).toBeDefined()
            const dateCreation = new Date(created.date_creation)
            expect(dateCreation.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime() - 1000)
            expect(dateCreation.getTime()).toBeLessThanOrEqual(afterCreation.getTime() + 1000)
            
          } finally {
            // Cleanup
            if (createdId) {
              await pool.query('DELETE FROM etablissements WHERE id = $1', [createdId])
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should set payment tracking fields to NULL by default', async () => {
    /**
     * **Validates: Requirements 2.2, 2.5**
     * 
     * Property: For any establishment creation, payment tracking fields
     * (dernier_paiement_date, dernier_paiement_confirme_par) should be NULL.
     */
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        etablissementArbitrary,
        async (etabData) => {
          let createdId: string | null = null
          
          try {
            const result = await pool.query(`
              INSERT INTO etablissements (nom, adresse, telephone, email)
              VALUES ($1, $2, $3, $4)
              RETURNING id, dernier_paiement_date, dernier_paiement_confirme_par
            `, [etabData.nom, etabData.adresse, etabData.telephone, etabData.email])
            
            const created = result.rows[0]
            createdId = created.id
            
            // Property: Payment tracking fields should be NULL
            expect(created.dernier_paiement_date).toBeNull()
            expect(created.dernier_paiement_confirme_par).toBeNull()
            
          } finally {
            // Cleanup
            if (createdId) {
              await pool.query('DELETE FROM etablissements WHERE id = $1', [createdId])
            }
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  it('should preserve explicitly set values over defaults', async () => {
    /**
     * **Validates: Requirements 2.2, 2.3, 2.4, 2.5**
     * 
     * Property: When explicitly setting values during creation,
     * those values should be preserved instead of using defaults.
     */
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        etablissementArbitrary,
        statutArbitrary,
        fc.boolean(),
        async (etabData, statut, actif) => {
          let createdId: string | null = null
          
          try {
            const customDateDebut = new Date('2024-01-01T00:00:00Z')
            const customDateFin = new Date('2025-01-01T00:00:00Z')
            
            const result = await pool.query(`
              INSERT INTO etablissements (
                nom, adresse, telephone, email,
                statut_abonnement, actif, date_debut, date_fin
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              RETURNING id, statut_abonnement, actif, date_debut, date_fin
            `, [
              etabData.nom, etabData.adresse, etabData.telephone, etabData.email,
              statut, actif, customDateDebut, customDateFin
            ])
            
            const created = result.rows[0]
            createdId = created.id
            
            // Property: Explicitly set values should be preserved
            expect(created.statut_abonnement).toBe(statut)
            expect(created.actif).toBe(actif)
            expect(new Date(created.date_debut).toISOString()).toBe(customDateDebut.toISOString())
            expect(new Date(created.date_fin).toISOString()).toBe(customDateFin.toISOString())
            
          } finally {
            // Cleanup
            if (createdId) {
              await pool.query('DELETE FROM etablissements WHERE id = $1', [createdId])
            }
          }
        }
      ),
      { numRuns: 50 }
    )
  })
})

describe('Property 10: Valid Establishment Status Values', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  it('should accept only valid statut_abonnement values', async () => {
    /**
     * **Validates: Requirements 2.3, 3.3**
     * 
     * Property: For any attempt to set statut_abonnement, the value SHALL be
     * one of: 'actif', 'expire', 'suspendu'. Any other value SHALL be rejected.
     */
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        etablissementArbitrary,
        statutArbitrary,
        async (etabData, validStatut) => {
          let createdId: string | null = null
          
          try {
            // Test with valid status - should succeed
            const result = await pool.query(`
              INSERT INTO etablissements (nom, adresse, telephone, email, statut_abonnement)
              VALUES ($1, $2, $3, $4, $5)
              RETURNING id, statut_abonnement
            `, [etabData.nom, etabData.adresse, etabData.telephone, etabData.email, validStatut])
            
            const created = result.rows[0]
            createdId = created.id
            
            // Property: Valid status should be accepted
            expect(created.statut_abonnement).toBe(validStatut)
            expect(['actif', 'expire', 'suspendu']).toContain(created.statut_abonnement)
            
          } finally {
            // Cleanup
            if (createdId) {
              await pool.query('DELETE FROM etablissements WHERE id = $1', [createdId])
            }
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  it('should reject invalid statut_abonnement values', async () => {
    /**
     * **Validates: Requirements 2.3, 3.3**
     * 
     * Property: Any attempt to set statut_abonnement to a value other than
     * 'actif', 'expire', or 'suspendu' SHALL be rejected by CHECK constraint.
     */
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        etablissementArbitrary,
        fc.string({ minLength: 1, maxLength: 20 }).filter(
          s => !['actif', 'expire', 'suspendu'].includes(s)
        ),
        async (etabData, invalidStatut) => {
          // Attempt to create establishment with invalid status
          await expect(
            pool.query(`
              INSERT INTO etablissements (nom, adresse, telephone, email, statut_abonnement)
              VALUES ($1, $2, $3, $4, $5)
            `, [etabData.nom, etabData.adresse, etabData.telephone, etabData.email, invalidStatut])
          ).rejects.toThrow()
        }
      ),
      { numRuns: 50 }
    )
  })

  it('should reject NULL statut_abonnement values', async () => {
    /**
     * **Validates: Requirements 2.3, 3.3**
     * 
     * Property: statut_abonnement is a required field and SHALL NOT accept NULL.
     */
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        etablissementArbitrary,
        async (etabData) => {
          // Attempt to create establishment with NULL status (bypassing default)
          await expect(
            pool.query(`
              INSERT INTO etablissements (nom, adresse, telephone, email, statut_abonnement)
              VALUES ($1, $2, $3, $4, NULL)
            `, [etabData.nom, etabData.adresse, etabData.telephone, etabData.email])
          ).rejects.toThrow()
        }
      ),
      { numRuns: 30 }
    )
  })

  it('should allow updating statut_abonnement to any valid value', async () => {
    /**
     * **Validates: Requirements 2.3, 3.3**
     * 
     * Property: An establishment's statut_abonnement can be updated to any
     * valid value ('actif', 'expire', 'suspendu').
     */
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        etablissementArbitrary,
        statutArbitrary,
        statutArbitrary,
        async (etabData, initialStatut, newStatut) => {
          let createdId: string | null = null
          
          try {
            // Create establishment with initial status
            const createResult = await pool.query(`
              INSERT INTO etablissements (nom, adresse, telephone, email, statut_abonnement)
              VALUES ($1, $2, $3, $4, $5)
              RETURNING id
            `, [etabData.nom, etabData.adresse, etabData.telephone, etabData.email, initialStatut])
            
            createdId = createResult.rows[0].id
            
            // Update to new status
            const updateResult = await pool.query(`
              UPDATE etablissements
              SET statut_abonnement = $1
              WHERE id = $2
              RETURNING statut_abonnement
            `, [newStatut, createdId])
            
            // Property: Status should be updated successfully
            expect(updateResult.rows[0].statut_abonnement).toBe(newStatut)
            
          } finally {
            // Cleanup
            if (createdId) {
              await pool.query('DELETE FROM etablissements WHERE id = $1', [createdId])
            }
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  it('should reject updating statut_abonnement to invalid values', async () => {
    /**
     * **Validates: Requirements 2.3, 3.3**
     * 
     * Property: Attempting to update statut_abonnement to an invalid value
     * SHALL be rejected by CHECK constraint.
     */
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        etablissementArbitrary,
        fc.string({ minLength: 1, maxLength: 20 }).filter(
          s => !['actif', 'expire', 'suspendu'].includes(s)
        ),
        async (etabData, invalidStatut) => {
          let createdId: string | null = null
          
          try {
            // Create establishment with valid status
            const createResult = await pool.query(`
              INSERT INTO etablissements (nom, adresse, telephone, email)
              VALUES ($1, $2, $3, $4)
              RETURNING id
            `, [etabData.nom, etabData.adresse, etabData.telephone, etabData.email])
            
            createdId = createResult.rows[0].id
            
            // Attempt to update to invalid status
            await expect(
              pool.query(`
                UPDATE etablissements
                SET statut_abonnement = $1
                WHERE id = $2
              `, [invalidStatut, createdId])
            ).rejects.toThrow()
            
          } finally {
            // Cleanup
            if (createdId) {
              await pool.query('DELETE FROM etablissements WHERE id = $1', [createdId])
            }
          }
        }
      ),
      { numRuns: 30 }
    )
  })
})
