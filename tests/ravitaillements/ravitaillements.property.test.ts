import { describe, it, expect, beforeEach } from 'vitest'
import { getTestPool, skipIfNoDB } from '../setup'
import * as fc from 'fast-check'

/**
 * Property-Based Tests for Ravitaillements Management
 * 
 * Tests the following properties:
 * - Property 9: Incrémentation du stock lors des ravitaillements (Requirements 3.1, 4.3)
 * - Property 13: Validation des données de ravitaillement (Requirements 4.1, 4.4)
 * - Property 14: Création de mouvement de stock pour les ravitaillements (Requirement 4.2)
 * - Property 15: Filtrage des ravitaillements par période (Requirement 4.5)
 */

// Arbitraries (generators) for ravitaillement data
const fournisseurArbitrary = fc.string({ minLength: 3, maxLength: 50 })
const dateArbitrary = fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') })
const quantiteArbitrary = fc.integer({ min: 1, max: 100 })
const coutUnitaireArbitrary = fc.integer({ min: 0, max: 10000 })

const ravitaillementItemArbitrary = fc.record({
  quantite: quantiteArbitrary,
  cout_unitaire: coutUnitaireArbitrary
})

const ravitaillementArbitrary = fc.record({
  fournisseur: fournisseurArbitrary,
  date_ravitaillement: dateArbitrary,
  items: fc.array(ravitaillementItemArbitrary, { minLength: 1, maxLength: 10 })
})

// Helper function to create a test user with gerant role
async function createTestGerant(pool: any) {
  const userId = '00000000-0000-0000-0000-000000000001'
  
  await pool.query(`
    INSERT INTO auth.users (id, email) VALUES ($1, $2)
    ON CONFLICT (id) DO NOTHING
  `, [userId, 'gerant@example.com'])
  
  await pool.query(`
    INSERT INTO profiles (id, email, nom, prenom, role)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (id) DO UPDATE SET role = $5, actif = true
  `, [userId, 'gerant@example.com', 'Test', 'Gerant', 'gerant'])
  
  return userId
}

// Helper function to create a test product
async function createTestProduct(pool: any, name: string) {
  const result = await pool.query(`
    INSERT INTO produits (nom, categorie, prix_vente)
    VALUES ($1, $2, $3)
    RETURNING id
  `, [name, 'boisson', 1000])
  
  return result.rows[0].id
}

describe('Property 9: Incrémentation du stock lors des ravitaillements', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  it('should increment stock by the exact quantity supplied', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        ravitaillementArbitrary,
        async (ravitaillementData) => {
          try {
            // Setup: Create gerant and products
            const gerantId = await createTestGerant(pool)
            
            // Create products and track initial stock
            const productIds: string[] = []
            const initialStocks: Map<string, number> = new Map()
            
            for (let i = 0; i < ravitaillementData.items.length; i++) {
              const productId = await createTestProduct(pool, `Product-${Date.now()}-${i}`)
              productIds.push(productId)
              
              // Initialize stock at 0
              await pool.query(`
                INSERT INTO stock (produit_id, quantite_disponible)
                VALUES ($1, $2)
              `, [productId, 0])
              
              initialStocks.set(productId, 0)
            }
            
            // Prepare items with product IDs
            const items = ravitaillementData.items.map((item, index) => ({
              produit_id: productIds[index],
              quantite: item.quantite,
              cout_unitaire: item.cout_unitaire
            }))
            
            // Act: Create ravitaillement using the function
            await pool.query(`
              SELECT * FROM create_ravitaillement($1, $2, $3)
            `, [
              ravitaillementData.fournisseur,
              ravitaillementData.date_ravitaillement.toISOString().split('T')[0],
              JSON.stringify(items)
            ])
            
            // Assert: Verify stock was incremented correctly for each product
            for (let i = 0; i < productIds.length; i++) {
              const productId = productIds[i]
              const expectedQuantity = items[i].quantite
              
              const stockResult = await pool.query(`
                SELECT quantite_disponible FROM stock WHERE produit_id = $1
              `, [productId])
              
              expect(stockResult.rows).toHaveLength(1)
              expect(stockResult.rows[0].quantite_disponible).toBe(expectedQuantity)
            }
            
            // Cleanup
            for (const productId of productIds) {
              await pool.query('DELETE FROM produits WHERE id = $1', [productId])
            }
          } catch (error: any) {
            if (error.code !== '23505') {
              throw error
            }
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  it('should accumulate stock across multiple ravitaillements', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.array(ravitaillementItemArbitrary, { minLength: 2, maxLength: 5 }),
        async (items) => {
          try {
            // Setup: Create gerant and product
            const gerantId = await createTestGerant(pool)
            const productId = await createTestProduct(pool, `Product-${Date.now()}`)
            
            // Initialize stock at 0
            await pool.query(`
              INSERT INTO stock (produit_id, quantite_disponible)
              VALUES ($1, $2)
            `, [productId, 0])
            
            let expectedTotal = 0
            
            // Act: Create multiple ravitaillements for the same product
            for (const item of items) {
              const ravItems = [{
                produit_id: productId,
                quantite: item.quantite,
                cout_unitaire: item.cout_unitaire
              }]
              
              await pool.query(`
                SELECT * FROM create_ravitaillement($1, $2, $3)
              `, [
                'Fournisseur Test',
                '2024-01-15',
                JSON.stringify(ravItems)
              ])
              
              expectedTotal += item.quantite
            }
            
            // Assert: Stock should be sum of all ravitaillements
            const stockResult = await pool.query(`
              SELECT quantite_disponible FROM stock WHERE produit_id = $1
            `, [productId])
            
            expect(stockResult.rows[0].quantite_disponible).toBe(expectedTotal)
            
            // Cleanup
            await pool.query('DELETE FROM produits WHERE id = $1', [productId])
          } catch (error: any) {
            if (error.code !== '23505') {
              throw error
            }
          }
        }
      ),
      { numRuns: 30 }
    )
  })
})

describe('Property 13: Validation des données de ravitaillement', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  it('should reject ravitaillement with missing fournisseur', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        ravitaillementItemArbitrary,
        async (item) => {
          try {
            // Setup
            const gerantId = await createTestGerant(pool)
            const productId = await createTestProduct(pool, `Product-${Date.now()}`)
            
            const items = [{
              produit_id: productId,
              quantite: item.quantite,
              cout_unitaire: item.cout_unitaire
            }]
            
            // Act & Assert: Should reject with null or empty fournisseur
            await expect(
              pool.query(`
                SELECT * FROM create_ravitaillement($1, $2, $3)
              `, [null, '2024-01-15', JSON.stringify(items)])
            ).rejects.toThrow()
            
            await expect(
              pool.query(`
                SELECT * FROM create_ravitaillement($1, $2, $3)
              `, ['', '2024-01-15', JSON.stringify(items)])
            ).rejects.toThrow()
            
            // Cleanup
            await pool.query('DELETE FROM produits WHERE id = $1', [productId])
          } catch (error: any) {
            if (error.code !== '23505') {
              throw error
            }
          }
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should reject ravitaillement with missing date', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fournisseurArbitrary,
        ravitaillementItemArbitrary,
        async (fournisseur, item) => {
          try {
            // Setup
            const gerantId = await createTestGerant(pool)
            const productId = await createTestProduct(pool, `Product-${Date.now()}`)
            
            const items = [{
              produit_id: productId,
              quantite: item.quantite,
              cout_unitaire: item.cout_unitaire
            }]
            
            // Act & Assert: Should reject with null date
            await expect(
              pool.query(`
                SELECT * FROM create_ravitaillement($1, $2, $3)
              `, [fournisseur, null, JSON.stringify(items)])
            ).rejects.toThrow()
            
            // Cleanup
            await pool.query('DELETE FROM produits WHERE id = $1', [productId])
          } catch (error: any) {
            if (error.code !== '23505') {
              throw error
            }
          }
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should reject ravitaillement with empty items array', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fournisseurArbitrary,
        dateArbitrary,
        async (fournisseur, date) => {
          try {
            // Setup
            await createTestGerant(pool)
            
            // Act & Assert: Should reject with empty items
            await expect(
              pool.query(`
                SELECT * FROM create_ravitaillement($1, $2, $3)
              `, [fournisseur, date.toISOString().split('T')[0], JSON.stringify([])])
            ).rejects.toThrow()
            
            await expect(
              pool.query(`
                SELECT * FROM create_ravitaillement($1, $2, $3)
              `, [fournisseur, date.toISOString().split('T')[0], null])
            ).rejects.toThrow()
          } catch (error: any) {
            if (error.code !== '23505') {
              throw error
            }
          }
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should reject ravitaillement items with invalid quantities', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fournisseurArbitrary,
        fc.integer({ min: -100, max: 0 }),
        async (fournisseur, invalidQuantity) => {
          try {
            // Setup
            await createTestGerant(pool)
            const productId = await createTestProduct(pool, `Product-${Date.now()}`)
            
            const items = [{
              produit_id: productId,
              quantite: invalidQuantity,
              cout_unitaire: 1000
            }]
            
            // Act & Assert: Should reject with zero or negative quantity
            await expect(
              pool.query(`
                SELECT * FROM create_ravitaillement($1, $2, $3)
              `, [fournisseur, '2024-01-15', JSON.stringify(items)])
            ).rejects.toThrow()
            
            // Cleanup
            await pool.query('DELETE FROM produits WHERE id = $1', [productId])
          } catch (error: any) {
            if (error.code !== '23505') {
              throw error
            }
          }
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should reject ravitaillement items with negative unit cost', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fournisseurArbitrary,
        fc.integer({ min: -10000, max: -1 }),
        async (fournisseur, negativeCost) => {
          try {
            // Setup
            await createTestGerant(pool)
            const productId = await createTestProduct(pool, `Product-${Date.now()}`)
            
            const items = [{
              produit_id: productId,
              quantite: 10,
              cout_unitaire: negativeCost
            }]
            
            // Act & Assert: Should reject with negative cost
            await expect(
              pool.query(`
                SELECT * FROM create_ravitaillement($1, $2, $3)
              `, [fournisseur, '2024-01-15', JSON.stringify(items)])
            ).rejects.toThrow()
            
            // Cleanup
            await pool.query('DELETE FROM produits WHERE id = $1', [productId])
          } catch (error: any) {
            if (error.code !== '23505') {
              throw error
            }
          }
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should accept valid ravitaillement with all required fields', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        ravitaillementArbitrary,
        async (ravitaillementData) => {
          try {
            // Setup
            const gerantId = await createTestGerant(pool)
            
            const productIds: string[] = []
            for (let i = 0; i < ravitaillementData.items.length; i++) {
              const productId = await createTestProduct(pool, `Product-${Date.now()}-${i}`)
              productIds.push(productId)
            }
            
            const items = ravitaillementData.items.map((item, index) => ({
              produit_id: productIds[index],
              quantite: item.quantite,
              cout_unitaire: item.cout_unitaire
            }))
            
            // Act: Create ravitaillement
            const result = await pool.query(`
              SELECT * FROM create_ravitaillement($1, $2, $3)
            `, [
              ravitaillementData.fournisseur,
              ravitaillementData.date_ravitaillement.toISOString().split('T')[0],
              JSON.stringify(items)
            ])
            
            // Assert: Should succeed and return ravitaillement info
            expect(result.rows).toHaveLength(1)
            expect(result.rows[0].ravitaillement_id).toBeDefined()
            expect(result.rows[0].numero_ravitaillement).toBeDefined()
            expect(result.rows[0].montant_total).toBeGreaterThanOrEqual(0)
            
            // Cleanup
            for (const productId of productIds) {
              await pool.query('DELETE FROM produits WHERE id = $1', [productId])
            }
          } catch (error: any) {
            if (error.code !== '23505') {
              throw error
            }
          }
        }
      ),
      { numRuns: 50 }
    )
  })
})

describe('Property 14: Création de mouvement de stock pour les ravitaillements', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  it('should create stock movement of type "entree" for each item', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        ravitaillementArbitrary,
        async (ravitaillementData) => {
          try {
            // Setup
            const gerantId = await createTestGerant(pool)
            
            const productIds: string[] = []
            for (let i = 0; i < ravitaillementData.items.length; i++) {
              const productId = await createTestProduct(pool, `Product-${Date.now()}-${i}`)
              productIds.push(productId)
            }
            
            const items = ravitaillementData.items.map((item, index) => ({
              produit_id: productIds[index],
              quantite: item.quantite,
              cout_unitaire: item.cout_unitaire
            }))
            
            // Act: Create ravitaillement
            const result = await pool.query(`
              SELECT * FROM create_ravitaillement($1, $2, $3)
            `, [
              ravitaillementData.fournisseur,
              ravitaillementData.date_ravitaillement.toISOString().split('T')[0],
              JSON.stringify(items)
            ])
            
            const numeroRavitaillement = result.rows[0].numero_ravitaillement
            
            // Assert: Verify stock movements were created
            for (let i = 0; i < productIds.length; i++) {
              const productId = productIds[i]
              const expectedQuantity = items[i].quantite
              const expectedCost = items[i].cout_unitaire
              
              const movementResult = await pool.query(`
                SELECT * FROM mouvements_stock
                WHERE produit_id = $1
                  AND reference = $2
                  AND type_reference = 'ravitaillement'
              `, [productId, numeroRavitaillement])
              
              expect(movementResult.rows).toHaveLength(1)
              const movement = movementResult.rows[0]
              
              expect(movement.type).toBe('entree')
              expect(movement.quantite).toBe(expectedQuantity)
              expect(movement.cout_unitaire).toBe(expectedCost)
              expect(movement.utilisateur_id).toBe(gerantId)
              expect(movement.date_creation).toBeDefined()
            }
            
            // Cleanup
            for (const productId of productIds) {
              await pool.query('DELETE FROM produits WHERE id = $1', [productId])
            }
          } catch (error: any) {
            if (error.code !== '23505') {
              throw error
            }
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  it('should record complete movement data with timestamp and user', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        ravitaillementArbitrary,
        async (ravitaillementData) => {
          try {
            // Setup
            const gerantId = await createTestGerant(pool)
            const productId = await createTestProduct(pool, `Product-${Date.now()}`)
            
            const items = [{
              produit_id: productId,
              quantite: ravitaillementData.items[0].quantite,
              cout_unitaire: ravitaillementData.items[0].cout_unitaire
            }]
            
            const beforeCreate = new Date()
            
            // Act: Create ravitaillement
            const result = await pool.query(`
              SELECT * FROM create_ravitaillement($1, $2, $3)
            `, [
              ravitaillementData.fournisseur,
              ravitaillementData.date_ravitaillement.toISOString().split('T')[0],
              JSON.stringify(items)
            ])
            
            const afterCreate = new Date()
            const numeroRavitaillement = result.rows[0].numero_ravitaillement
            
            // Assert: Verify movement has all required fields
            const movementResult = await pool.query(`
              SELECT * FROM mouvements_stock
              WHERE reference = $1 AND type_reference = 'ravitaillement'
            `, [numeroRavitaillement])
            
            expect(movementResult.rows).toHaveLength(1)
            const movement = movementResult.rows[0]
            
            // Check all mandatory fields
            expect(movement.produit_id).toBe(productId)
            expect(movement.type).toBe('entree')
            expect(movement.quantite).toBe(items[0].quantite)
            expect(movement.cout_unitaire).toBe(items[0].cout_unitaire)
            expect(movement.reference).toBe(numeroRavitaillement)
            expect(movement.type_reference).toBe('ravitaillement')
            expect(movement.utilisateur_id).toBe(gerantId)
            
            // Check timestamp is recent
            const timestamp = new Date(movement.date_creation)
            expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime() - 1000)
            expect(timestamp.getTime()).toBeLessThanOrEqual(afterCreate.getTime() + 1000)
            
            // Cleanup
            await pool.query('DELETE FROM produits WHERE id = $1', [productId])
          } catch (error: any) {
            if (error.code !== '23505') {
              throw error
            }
          }
        }
      ),
      { numRuns: 30 }
    )
  })
})

describe('Property 15: Filtrage des ravitaillements par période', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  it('should return only ravitaillements within the specified period', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            fournisseur: fournisseurArbitrary,
            date: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
            item: ravitaillementItemArbitrary
          }),
          { minLength: 5, maxLength: 15 }
        ),
        async (ravitaillementsData) => {
          try {
            // Setup
            const gerantId = await createTestGerant(pool)
            
            // Create ravitaillements with different dates
            const createdDates: Date[] = []
            
            for (const ravData of ravitaillementsData) {
              const productId = await createTestProduct(pool, `Product-${Date.now()}-${Math.random()}`)
              
              const items = [{
                produit_id: productId,
                quantite: ravData.item.quantite,
                cout_unitaire: ravData.item.cout_unitaire
              }]
              
              await pool.query(`
                SELECT * FROM create_ravitaillement($1, $2, $3)
              `, [
                ravData.fournisseur,
                ravData.date.toISOString().split('T')[0],
                JSON.stringify(items)
              ])
              
              createdDates.push(ravData.date)
            }
            
            // Define a period (middle third of the date range)
            const sortedDates = [...createdDates].sort((a, b) => a.getTime() - b.getTime())
            const startIndex = Math.floor(sortedDates.length / 3)
            const endIndex = Math.floor(2 * sortedDates.length / 3)
            
            if (startIndex < endIndex) {
              const dateDebut = sortedDates[startIndex].toISOString().split('T')[0]
              const dateFin = sortedDates[endIndex].toISOString().split('T')[0]
              
              // Act: Filter ravitaillements by period
              const result = await pool.query(`
                SELECT * FROM get_ravitaillements_by_period($1, $2)
              `, [dateDebut, dateFin])
              
              // Assert: All returned ravitaillements should be within the period
              for (const rav of result.rows) {
                const ravDate = new Date(rav.date_ravitaillement)
                const debut = new Date(dateDebut)
                const fin = new Date(dateFin)
                
                expect(ravDate.getTime()).toBeGreaterThanOrEqual(debut.getTime())
                expect(ravDate.getTime()).toBeLessThanOrEqual(fin.getTime())
              }
              
              // Count expected ravitaillements in period
              const expectedCount = createdDates.filter(date => {
                const debut = new Date(dateDebut)
                const fin = new Date(dateFin)
                return date.getTime() >= debut.getTime() && date.getTime() <= fin.getTime()
              }).length
              
              expect(result.rows.length).toBe(expectedCount)
            }
            
            // Cleanup
            await pool.query(`
              DELETE FROM produits WHERE nom LIKE 'Product-%'
            `)
          } catch (error: any) {
            if (error.code !== '23505') {
              throw error
            }
          }
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should reject invalid date ranges', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.date({ min: new Date('2024-06-01'), max: new Date('2024-12-31') }),
        fc.date({ min: new Date('2024-01-01'), max: new Date('2024-05-31') }),
        async (laterDate, earlierDate) => {
          try {
            // Setup
            await createTestGerant(pool)
            
            // Act & Assert: Should reject when start date > end date
            await expect(
              pool.query(`
                SELECT * FROM get_ravitaillements_by_period($1, $2)
              `, [
                laterDate.toISOString().split('T')[0],
                earlierDate.toISOString().split('T')[0]
              ])
            ).rejects.toThrow()
          } catch (error: any) {
            if (error.code !== '23505') {
              throw error
            }
          }
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should handle empty results for periods with no ravitaillements', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.date({ min: new Date('2025-01-01'), max: new Date('2025-12-31') }),
        fc.date({ min: new Date('2025-01-01'), max: new Date('2025-12-31') }),
        async (date1, date2) => {
          try {
            // Setup
            await createTestGerant(pool)
            
            const dateDebut = date1 < date2 ? date1 : date2
            const dateFin = date1 < date2 ? date2 : date1
            
            // Act: Query period with no ravitaillements (future dates)
            const result = await pool.query(`
              SELECT * FROM get_ravitaillements_by_period($1, $2)
            `, [
              dateDebut.toISOString().split('T')[0],
              dateFin.toISOString().split('T')[0]
            ])
            
            // Assert: Should return empty array, not error
            expect(result.rows).toHaveLength(0)
          } catch (error: any) {
            if (error.code !== '23505') {
              throw error
            }
          }
        }
      ),
      { numRuns: 20 }
    )
  })
})
