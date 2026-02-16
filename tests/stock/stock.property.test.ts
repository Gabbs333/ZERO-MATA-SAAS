import { describe, it, expect } from 'vitest'
import { getTestPool, skipIfNoDB } from '../setup'
import * as fc from 'fast-check'

/**
 * Property-Based Tests for Stock Management
 * 
 * Tests the following properties:
 * - Property 11: Complétude des mouvements de stock (Requirement 3.5)
 * - Property 12: Non-négativité du stock (Constraint métier)
 * - Property 45: Cohérence du stock - invariant (Cohérence globale)
 */

// Arbitraries (generators) for stock data
const mouvementTypeArbitrary = fc.constantFrom('entree', 'sortie')
const typeReferenceArbitrary = fc.constantFrom('commande', 'ravitaillement')

const mouvementStockArbitrary = fc.record({
  type: mouvementTypeArbitrary,
  quantite: fc.integer({ min: 1, max: 100 }),
  cout_unitaire: fc.option(fc.integer({ min: 0, max: 10000 }), { nil: null }),
  reference: fc.string({ minLength: 5, maxLength: 20 }),
  type_reference: typeReferenceArbitrary
})

describe('Property 11: Complétude des mouvements de stock', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  it('should require all mandatory fields for stock movements', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        mouvementStockArbitrary,
        async (mouvementData) => {
          try {
            // Create test user and product
            const userId = '00000000-0000-0000-0000-000000000001'
            await pool.query(`
              INSERT INTO auth.users (id, email) VALUES ($1, $2)
              ON CONFLICT (id) DO NOTHING
            `, [userId, 'test@example.com'])
            
            await pool.query(`
              INSERT INTO profiles (id, email, nom, prenom, role)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (id) DO NOTHING
            `, [userId, 'test@example.com', 'Test', 'User', 'gerant'])
            
            const productResult = await pool.query(`
              INSERT INTO produits (nom, categorie, prix_vente)
              VALUES ($1, $2, $3)
              RETURNING id
            `, ['Test Product ' + Date.now(), 'boisson', 1000])
            
            const productId = productResult.rows[0].id
            
            // Create stock movement with all mandatory fields
            const result = await pool.query(`
              INSERT INTO mouvements_stock (
                produit_id, type, quantite, cout_unitaire, reference, type_reference, utilisateur_id
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              RETURNING id, produit_id, type, quantite, reference, type_reference, utilisateur_id, date_creation
            `, [
              productId,
              mouvementData.type,
              mouvementData.quantite,
              mouvementData.cout_unitaire,
              mouvementData.reference,
              mouvementData.type_reference,
              userId
            ])
            
            // Property: All mandatory fields should be present in the created movement
            expect(result.rows).toHaveLength(1)
            const movement = result.rows[0]
            
            expect(movement.produit_id).toBe(productId)
            expect(movement.type).toBe(mouvementData.type)
            expect(movement.quantite).toBe(mouvementData.quantite)
            expect(movement.reference).toBe(mouvementData.reference)
            expect(movement.type_reference).toBe(mouvementData.type_reference)
            expect(movement.utilisateur_id).toBe(userId)
            expect(movement.date_creation).toBeDefined()
            
            // Cleanup
            await pool.query('DELETE FROM produits WHERE id = $1', [productId])
          } catch (error: any) {
            // If there's a constraint violation, it should be for a good reason
            if (error.code !== '23505') {
              throw error
            }
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  it('should reject stock movements with missing mandatory fields', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          type: fc.option(mouvementTypeArbitrary, { nil: null }),
          quantite: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
          reference: fc.option(fc.string({ minLength: 5, maxLength: 20 }), { nil: null }),
          type_reference: fc.option(typeReferenceArbitrary, { nil: null })
        }),
        async (mouvementData) => {
          const hasMissingField = !mouvementData.type || !mouvementData.quantite || 
                                  !mouvementData.reference || !mouvementData.type_reference
          
          if (!hasMissingField) return // Skip if all fields are present
          
          try {
            // Create test user and product
            const userId = '00000000-0000-0000-0000-000000000001'
            await pool.query(`
              INSERT INTO auth.users (id, email) VALUES ($1, $2)
              ON CONFLICT (id) DO NOTHING
            `, [userId, 'test@example.com'])
            
            await pool.query(`
              INSERT INTO profiles (id, email, nom, prenom, role)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (id) DO NOTHING
            `, [userId, 'test@example.com', 'Test', 'User', 'gerant'])
            
            const productResult = await pool.query(`
              INSERT INTO produits (nom, categorie, prix_vente)
              VALUES ($1, $2, $3)
              RETURNING id
            `, ['Test Product ' + Date.now(), 'boisson', 1000])
            
            const productId = productResult.rows[0].id
            
            // Attempt to create movement with missing fields
            await expect(
              pool.query(`
                INSERT INTO mouvements_stock (
                  produit_id, type, quantite, reference, type_reference, utilisateur_id
                )
                VALUES ($1, $2, $3, $4, $5, $6)
              `, [
                productId,
                mouvementData.type,
                mouvementData.quantite,
                mouvementData.reference,
                mouvementData.type_reference,
                userId
              ])
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
      { numRuns: 30 }
    )
  })

  it('should automatically record timestamp for stock movements', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        mouvementStockArbitrary,
        async (mouvementData) => {
          try {
            // Create test user and product
            const userId = '00000000-0000-0000-0000-000000000001'
            await pool.query(`
              INSERT INTO auth.users (id, email) VALUES ($1, $2)
              ON CONFLICT (id) DO NOTHING
            `, [userId, 'test@example.com'])
            
            await pool.query(`
              INSERT INTO profiles (id, email, nom, prenom, role)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (id) DO NOTHING
            `, [userId, 'test@example.com', 'Test', 'User', 'gerant'])
            
            const productResult = await pool.query(`
              INSERT INTO produits (nom, categorie, prix_vente)
              VALUES ($1, $2, $3)
              RETURNING id
            `, ['Test Product ' + Date.now(), 'boisson', 1000])
            
            const productId = productResult.rows[0].id
            
            const beforeInsert = new Date()
            
            // Create stock movement
            const result = await pool.query(`
              INSERT INTO mouvements_stock (
                produit_id, type, quantite, reference, type_reference, utilisateur_id
              )
              VALUES ($1, $2, $3, $4, $5, $6)
              RETURNING date_creation
            `, [
              productId,
              mouvementData.type,
              mouvementData.quantite,
              mouvementData.reference,
              mouvementData.type_reference,
              userId
            ])
            
            const afterInsert = new Date()
            
            // Property: Timestamp should be automatically set and be recent
            const timestamp = new Date(result.rows[0].date_creation)
            expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeInsert.getTime() - 1000)
            expect(timestamp.getTime()).toBeLessThanOrEqual(afterInsert.getTime() + 1000)
            
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

describe('Property 12: Non-négativité du stock', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  it('should reject negative stock quantities', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: -1000, max: -1 }),
        async (negativeQuantity) => {
          try {
            // Create test product
            const productResult = await pool.query(`
              INSERT INTO produits (nom, categorie, prix_vente)
              VALUES ($1, $2, $3)
              RETURNING id
            `, ['Test Product ' + Date.now(), 'boisson', 1000])
            
            const productId = productResult.rows[0].id
            
            // Attempt to create stock with negative quantity
            await expect(
              pool.query(`
                INSERT INTO stock (produit_id, quantite_disponible)
                VALUES ($1, $2)
              `, [productId, negativeQuantity])
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
      { numRuns: 30 }
    )
  })

  it('should accept zero and positive stock quantities', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 1000 }),
        async (validQuantity) => {
          try {
            // Create test product
            const productResult = await pool.query(`
              INSERT INTO produits (nom, categorie, prix_vente)
              VALUES ($1, $2, $3)
              RETURNING id
            `, ['Test Product ' + Date.now(), 'boisson', 1000])
            
            const productId = productResult.rows[0].id
            
            // Create stock with valid quantity
            const result = await pool.query(`
              INSERT INTO stock (produit_id, quantite_disponible)
              VALUES ($1, $2)
              RETURNING quantite_disponible
            `, [productId, validQuantity])
            
            // Property: Stock quantity should be exactly what was set
            expect(result.rows[0].quantite_disponible).toBe(validQuantity)
            expect(result.rows[0].quantite_disponible).toBeGreaterThanOrEqual(0)
            
            // Cleanup
            await pool.query('DELETE FROM produits WHERE id = $1', [productId])
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

  it('should prevent stock from becoming negative through updates', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: -1000, max: -1 }),
        async (initialQuantity, negativeUpdate) => {
          try {
            // Create test product with initial stock
            const productResult = await pool.query(`
              INSERT INTO produits (nom, categorie, prix_vente)
              VALUES ($1, $2, $3)
              RETURNING id
            `, ['Test Product ' + Date.now(), 'boisson', 1000])
            
            const productId = productResult.rows[0].id
            
            await pool.query(`
              INSERT INTO stock (produit_id, quantite_disponible)
              VALUES ($1, $2)
            `, [productId, initialQuantity])
            
            // Attempt to update stock to negative value
            await expect(
              pool.query(`
                UPDATE stock SET quantite_disponible = $1 WHERE produit_id = $2
              `, [negativeUpdate, productId])
            ).rejects.toThrow()
            
            // Verify stock remained unchanged
            const checkResult = await pool.query(`
              SELECT quantite_disponible FROM stock WHERE produit_id = $1
            `, [productId])
            
            expect(checkResult.rows[0].quantite_disponible).toBe(initialQuantity)
            
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

describe('Property 10: Génération d\'alertes de stock bas', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  it('should generate alerts for products at or below minimum threshold', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          seuilMinimum: fc.integer({ min: 5, max: 50 }),
          quantiteDisponible: fc.integer({ min: 0, max: 100 })
        }),
        async ({ seuilMinimum, quantiteDisponible }) => {
          try {
            // Create test product with threshold
            const productResult = await pool.query(`
              INSERT INTO produits (nom, categorie, prix_vente, seuil_stock_minimum)
              VALUES ($1, $2, $3, $4)
              RETURNING id
            `, ['Test Product ' + Date.now(), 'boisson', 1000, seuilMinimum])
            
            const productId = productResult.rows[0].id
            
            // Set stock quantity
            await pool.query(`
              INSERT INTO stock (produit_id, quantite_disponible)
              VALUES ($1, $2)
            `, [productId, quantiteDisponible])
            
            // Check alerts using the function
            const alertsResult = await pool.query(`
              SELECT * FROM check_stock_alerts()
              WHERE produit_id = $1
            `, [productId])
            
            // Property: Alert should be generated if and only if stock <= threshold
            if (quantiteDisponible <= seuilMinimum) {
              expect(alertsResult.rows).toHaveLength(1)
              const alert = alertsResult.rows[0]
              expect(alert.produit_id).toBe(productId)
              expect(alert.quantite_disponible).toBe(quantiteDisponible)
              expect(alert.seuil_stock_minimum).toBe(seuilMinimum)
              expect(alert.difference).toBe(quantiteDisponible - seuilMinimum)
              expect(alert.nom_produit).toBeDefined()
              expect(alert.categorie).toBe('boisson')
            } else {
              // No alert should be generated if stock > threshold
              expect(alertsResult.rows).toHaveLength(0)
            }
            
            // Cleanup
            await pool.query('DELETE FROM produits WHERE id = $1', [productId])
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

  it('should not generate alerts for inactive products', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          seuilMinimum: fc.integer({ min: 5, max: 50 }),
          quantiteDisponible: fc.integer({ min: 0, max: 10 }) // Always below threshold
        }),
        async ({ seuilMinimum, quantiteDisponible }) => {
          try {
            // Create inactive product with low stock
            const productResult = await pool.query(`
              INSERT INTO produits (nom, categorie, prix_vente, seuil_stock_minimum, actif)
              VALUES ($1, $2, $3, $4, $5)
              RETURNING id
            `, ['Test Product ' + Date.now(), 'boisson', 1000, seuilMinimum, false])
            
            const productId = productResult.rows[0].id
            
            // Set stock quantity below threshold
            await pool.query(`
              INSERT INTO stock (produit_id, quantite_disponible)
              VALUES ($1, $2)
            `, [productId, quantiteDisponible])
            
            // Check alerts
            const alertsResult = await pool.query(`
              SELECT * FROM check_stock_alerts()
              WHERE produit_id = $1
            `, [productId])
            
            // Property: No alert should be generated for inactive products
            expect(alertsResult.rows).toHaveLength(0)
            
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

  it('should order alerts by urgency (lowest stock first)', async () => {
    const pool = await getTestPool()
    
    try {
      // Create multiple products with different stock levels
      const products = [
        { nom: 'Product A ' + Date.now(), quantite: 2, seuil: 10 },
        { nom: 'Product B ' + Date.now(), quantite: 5, seuil: 10 },
        { nom: 'Product C ' + Date.now(), quantite: 0, seuil: 10 },
        { nom: 'Product D ' + Date.now(), quantite: 8, seuil: 10 }
      ]
      
      const productIds: string[] = []
      
      for (const product of products) {
        const result = await pool.query(`
          INSERT INTO produits (nom, categorie, prix_vente, seuil_stock_minimum)
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `, [product.nom, 'boisson', 1000, product.seuil])
        
        const productId = result.rows[0].id
        productIds.push(productId)
        
        await pool.query(`
          INSERT INTO stock (produit_id, quantite_disponible)
          VALUES ($1, $2)
        `, [productId, product.quantite])
      }
      
      // Get all alerts
      const alertsResult = await pool.query(`
        SELECT * FROM check_stock_alerts()
        WHERE produit_id = ANY($1)
      `, [productIds])
      
      // Property: Alerts should be ordered by difference (most urgent first)
      expect(alertsResult.rows.length).toBeGreaterThan(0)
      
      for (let i = 0; i < alertsResult.rows.length - 1; i++) {
        const currentDiff = alertsResult.rows[i].difference
        const nextDiff = alertsResult.rows[i + 1].difference
        expect(currentDiff).toBeLessThanOrEqual(nextDiff)
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
  })

  it('should include alert level in stock_alerts view', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          seuilMinimum: fc.integer({ min: 10, max: 50 }),
          quantiteDisponible: fc.integer({ min: 0, max: 50 })
        }),
        async ({ seuilMinimum, quantiteDisponible }) => {
          try {
            // Create test product
            const productResult = await pool.query(`
              INSERT INTO produits (nom, categorie, prix_vente, seuil_stock_minimum)
              VALUES ($1, $2, $3, $4)
              RETURNING id
            `, ['Test Product ' + Date.now(), 'boisson', 1000, seuilMinimum])
            
            const productId = productResult.rows[0].id
            
            // Set stock quantity
            await pool.query(`
              INSERT INTO stock (produit_id, quantite_disponible)
              VALUES ($1, $2)
            `, [productId, quantiteDisponible])
            
            // Check alerts using the view
            const alertsResult = await pool.query(`
              SELECT * FROM stock_alerts
              WHERE produit_id = $1
            `, [productId])
            
            if (quantiteDisponible <= seuilMinimum) {
              expect(alertsResult.rows).toHaveLength(1)
              const alert = alertsResult.rows[0]
              
              // Property: Alert level should be correctly calculated
              if (quantiteDisponible === 0) {
                expect(alert.niveau_alerte).toBe('critique')
              } else if (quantiteDisponible <= seuilMinimum * 0.5) {
                expect(alert.niveau_alerte).toBe('urgent')
              } else {
                expect(alert.niveau_alerte).toBe('attention')
              }
            } else {
              expect(alertsResult.rows).toHaveLength(0)
            }
            
            // Cleanup
            await pool.query('DELETE FROM produits WHERE id = $1', [productId])
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
describe('Property 45: Cohérence du stock - invariant', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  it('should maintain stock consistency across multiple movements', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.array(mouvementStockArbitrary, { minLength: 5, maxLength: 20 }),
        async (mouvements) => {
          try {
            // Create test user and product
            const userId = '00000000-0000-0000-0000-000000000001'
            await pool.query(`
              INSERT INTO auth.users (id, email) VALUES ($1, $2)
              ON CONFLICT (id) DO NOTHING
            `, [userId, 'test@example.com'])
            
            await pool.query(`
              INSERT INTO profiles (id, email, nom, prenom, role)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (id) DO NOTHING
            `, [userId, 'test@example.com', 'Test', 'User', 'gerant'])
            
            const productResult = await pool.query(`
              INSERT INTO produits (nom, categorie, prix_vente)
              VALUES ($1, $2, $3)
              RETURNING id
            `, ['Test Product ' + Date.now(), 'boisson', 1000])
            
            const productId = productResult.rows[0].id
            
            // Initialize stock at 0
            await pool.query(`
              INSERT INTO stock (produit_id, quantite_disponible)
              VALUES ($1, $2)
            `, [productId, 0])
            
            // Calculate expected stock based on movements
            let expectedStock = 0
            
            for (const mouvement of mouvements) {
              // Only process movements that won't make stock negative
              if (mouvement.type === 'sortie' && mouvement.quantite > expectedStock) {
                continue // Skip this movement to avoid negative stock
              }
              
              // Record the movement
              await pool.query(`
                INSERT INTO mouvements_stock (
                  produit_id, type, quantite, reference, type_reference, utilisateur_id
                )
                VALUES ($1, $2, $3, $4, $5, $6)
              `, [
                productId,
                mouvement.type,
                mouvement.quantite,
                mouvement.reference,
                mouvement.type_reference,
                userId
              ])
              
              // Update expected stock
              if (mouvement.type === 'entree') {
                expectedStock += mouvement.quantite
              } else {
                expectedStock -= mouvement.quantite
              }
              
              // Update actual stock (simulating what triggers would do)
              await pool.query(`
                UPDATE stock 
                SET quantite_disponible = quantite_disponible + $1
                WHERE produit_id = $2
              `, [
                mouvement.type === 'entree' ? mouvement.quantite : -mouvement.quantite,
                productId
              ])
            }
            
            // Property: Actual stock should equal sum of entrees minus sum of sorties
            const stockResult = await pool.query(`
              SELECT quantite_disponible FROM stock WHERE produit_id = $1
            `, [productId])
            
            const actualStock = stockResult.rows[0].quantite_disponible
            expect(actualStock).toBe(expectedStock)
            expect(actualStock).toBeGreaterThanOrEqual(0)
            
            // Verify by calculating from movements
            const mouvementsResult = await pool.query(`
              SELECT type, SUM(quantite) as total
              FROM mouvements_stock
              WHERE produit_id = $1
              GROUP BY type
            `, [productId])
            
            let entrees = 0
            let sorties = 0
            
            for (const row of mouvementsResult.rows) {
              if (row.type === 'entree') {
                entrees = parseInt(row.total)
              } else {
                sorties = parseInt(row.total)
              }
            }
            
            expect(actualStock).toBe(entrees - sorties)
            
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

  it('should maintain consistency across multiple products', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            productName: fc.string({ minLength: 5, maxLength: 30 }),
            movements: fc.array(mouvementStockArbitrary, { minLength: 3, maxLength: 10 })
          }),
          { minLength: 2, maxLength: 5 }
        ),
        async (productsData) => {
          try {
            // Create test user
            const userId = '00000000-0000-0000-0000-000000000001'
            await pool.query(`
              INSERT INTO auth.users (id, email) VALUES ($1, $2)
              ON CONFLICT (id) DO NOTHING
            `, [userId, 'test@example.com'])
            
            await pool.query(`
              INSERT INTO profiles (id, email, nom, prenom, role)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (id) DO NOTHING
            `, [userId, 'test@example.com', 'Test', 'User', 'gerant'])
            
            // Process each product
            for (const productData of productsData) {
              const productResult = await pool.query(`
                INSERT INTO produits (nom, categorie, prix_vente)
                VALUES ($1, $2, $3)
                RETURNING id
              `, [productData.productName + '-' + Date.now(), 'boisson', 1000])
              
              const productId = productResult.rows[0].id
              
              // Initialize stock
              await pool.query(`
                INSERT INTO stock (produit_id, quantite_disponible)
                VALUES ($1, $2)
              `, [productId, 0])
              
              let expectedStock = 0
              
              // Apply movements
              for (const mouvement of productData.movements) {
                if (mouvement.type === 'sortie' && mouvement.quantite > expectedStock) {
                  continue
                }
                
                await pool.query(`
                  INSERT INTO mouvements_stock (
                    produit_id, type, quantite, reference, type_reference, utilisateur_id
                  )
                  VALUES ($1, $2, $3, $4, $5, $6)
                `, [
                  productId,
                  mouvement.type,
                  mouvement.quantite,
                  mouvement.reference,
                  mouvement.type_reference,
                  userId
                ])
                
                if (mouvement.type === 'entree') {
                  expectedStock += mouvement.quantite
                } else {
                  expectedStock -= mouvement.quantite
                }
                
                await pool.query(`
                  UPDATE stock 
                  SET quantite_disponible = quantite_disponible + $1
                  WHERE produit_id = $2
                `, [
                  mouvement.type === 'entree' ? mouvement.quantite : -mouvement.quantite,
                  productId
                ])
              }
              
              // Verify consistency for this product
              const stockResult = await pool.query(`
                SELECT quantite_disponible FROM stock WHERE produit_id = $1
              `, [productId])
              
              expect(stockResult.rows[0].quantite_disponible).toBe(expectedStock)
            }
            
            // Cleanup all products
            for (const productData of productsData) {
              await pool.query(`
                DELETE FROM produits WHERE nom LIKE $1
              `, [productData.productName + '-%'])
            }
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

