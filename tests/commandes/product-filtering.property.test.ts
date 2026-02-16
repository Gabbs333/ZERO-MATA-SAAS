import { describe, it, expect, beforeEach } from 'vitest'
import { getTestPool, skipIfNoDB } from '../setup'
import * as fc from 'fast-check'

/**
 * Property-Based Tests for Product Filtering
 * 
 * Tests Properties:
 * - Property 3: Filtrage des produits disponibles (Requirement 1.5)
 * - Property 43: Exclusion des produits inactifs (Requirement 12.4)
 */

// ============================================================================
// ARBITRARIES (Generators)
// ============================================================================

const prixArbitrary = fc.integer({ min: 100, max: 10000 })
  .map(n => Math.round(n / 25) * 25)

const categorieArbitrary = fc.constantFrom('boisson', 'nourriture', 'autre')

const produitArbitrary = fc.record({
  nom: fc.string({ minLength: 3, maxLength: 50 }),
  categorie: categorieArbitrary,
  prix_vente: prixArbitrary,
  seuil_stock_minimum: fc.integer({ min: 0, max: 10 }),
  actif: fc.boolean()
})

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function createTestProduit(pool: any, produitData: any, stock: number) {
  const produitId = `00000000-0000-0000-0002-${Date.now().toString().padStart(12, '0').slice(-12)}`
  
  const result = await pool.query(`
    INSERT INTO produits (id, nom, categorie, prix_vente, seuil_stock_minimum, actif)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, nom, prix_vente, actif
  `, [produitId, produitData.nom, produitData.categorie, produitData.prix_vente, 
      produitData.seuil_stock_minimum, produitData.actif])
  
  // Create stock entry
  await pool.query(`
    INSERT INTO stock (produit_id, quantite_disponible)
    VALUES ($1, $2)
  `, [produitId, stock])
  
  return { ...result.rows[0], stock }
}

async function cleanup(pool: any) {
  await pool.query('DELETE FROM stock WHERE TRUE')
  await pool.query('DELETE FROM produits WHERE TRUE')
}

// ============================================================================
// PROPERTY 3: Filtrage des produits disponibles
// Validates: Requirement 1.5
// ============================================================================

describe('Property 3: Filtrage des produits disponibles', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  beforeEach(async () => {
    const pool = await getTestPool()
    await cleanup(pool)
  })

  it('should only return products with stock > 0', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            produit: produitArbitrary,
            stock: fc.integer({ min: 0, max: 100 })
          }),
          { minLength: 5, maxLength: 20 }
        ),
        async (produits) => {
          // Create produits with various stock levels
          const createdProduits = []
          for (const item of produits) {
            const produit = await createTestProduit(pool, item.produit, item.stock)
            createdProduits.push(produit)
          }
          
          // Get available products using the function
          const result = await pool.query(`
            SELECT * FROM get_produits_disponibles()
          `)
          
          const availableProducts = result.rows
          
          // Property: All returned products should have stock > 0
          for (const product of availableProducts) {
            expect(product.quantite_disponible).toBeGreaterThan(0)
          }
          
          // Property: Products with stock = 0 should NOT be in results
          const productsWithZeroStock = createdProduits.filter(p => p.stock === 0)
          for (const zeroStockProduct of productsWithZeroStock) {
            const found = availableProducts.find((p: any) => p.id === zeroStockProduct.id)
            expect(found).toBeUndefined()
          }
          
          // Property: Products with stock > 0 and actif = true should be in results
          const productsWithStock = createdProduits.filter(p => p.stock > 0 && p.actif)
          for (const stockedProduct of productsWithStock) {
            const found = availableProducts.find((p: any) => p.id === stockedProduct.id)
            expect(found).toBeDefined()
            if (found) {
              expect(found.quantite_disponible).toBe(stockedProduct.stock)
            }
          }
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 30 }
    )
  })

  it('should exclude products with exactly 0 stock', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.array(produitArbitrary, { minLength: 3, maxLength: 10 }),
        async (produits) => {
          // Create produits - all with 0 stock
          for (const produitData of produits) {
            await createTestProduit(pool, produitData, 0)
          }
          
          // Get available products
          const result = await pool.query(`
            SELECT * FROM get_produits_disponibles()
          `)
          
          // Property: No products should be returned when all have 0 stock
          expect(result.rows.length).toBe(0)
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should include products with stock = 1 (boundary case)', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            produit: produitArbitrary,
            stock: fc.constantFrom(0, 1, 2)
          }),
          { minLength: 3, maxLength: 10 }
        ),
        async (produits) => {
          // Create produits with boundary stock values
          const createdProduits = []
          for (const item of produits) {
            const produit = await createTestProduit(pool, item.produit, item.stock)
            createdProduits.push(produit)
          }
          
          // Get available products
          const result = await pool.query(`
            SELECT * FROM get_produits_disponibles()
          `)
          
          const availableProducts = result.rows
          
          // Property: Products with stock >= 1 and actif = true should be included
          const productsWithOneOrMore = createdProduits.filter(p => p.stock >= 1 && p.actif)
          for (const product of productsWithOneOrMore) {
            const found = availableProducts.find((p: any) => p.id === product.id)
            expect(found).toBeDefined()
          }
          
          // Property: Products with stock = 0 should be excluded
          const productsWithZero = createdProduits.filter(p => p.stock === 0)
          for (const product of productsWithZero) {
            const found = availableProducts.find((p: any) => p.id === product.id)
            expect(found).toBeUndefined()
          }
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 25 }
    )
  })

  it('should update available products list when stock changes', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          produit: produitArbitrary,
          initialStock: fc.integer({ min: 5, max: 20 }),
          deduction: fc.integer({ min: 1, max: 10 })
        }),
        async (testData) => {
          // Create product with initial stock
          const produit = await createTestProduit(pool, testData.produit, testData.initialStock)
          
          // Get available products - should include this product
          const result1 = await pool.query(`
            SELECT * FROM get_produits_disponibles()
          `)
          
          if (produit.actif) {
            const found1 = result1.rows.find((p: any) => p.id === produit.id)
            expect(found1).toBeDefined()
          }
          
          // Reduce stock
          const newStock = testData.initialStock - testData.deduction
          await pool.query(`
            UPDATE stock SET quantite_disponible = $1 WHERE produit_id = $2
          `, [newStock, produit.id])
          
          // Get available products again
          const result2 = await pool.query(`
            SELECT * FROM get_produits_disponibles()
          `)
          
          const found2 = result2.rows.find((p: any) => p.id === produit.id)
          
          // Property: Product should be in list only if stock > 0 and actif = true
          if (newStock > 0 && produit.actif) {
            expect(found2).toBeDefined()
            expect(found2.quantite_disponible).toBe(newStock)
          } else {
            expect(found2).toBeUndefined()
          }
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 20 }
    )
  })
})

// ============================================================================
// PROPERTY 43: Exclusion des produits inactifs
// Validates: Requirement 12.4
// ============================================================================

describe('Property 43: Exclusion des produits inactifs', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  beforeEach(async () => {
    const pool = await getTestPool()
    await cleanup(pool)
  })

  it('should exclude products with actif = false even if they have stock', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            produit: produitArbitrary,
            stock: fc.integer({ min: 1, max: 100 })
          }),
          { minLength: 5, maxLength: 15 }
        ),
        async (produits) => {
          // Create produits with various actif states
          const createdProduits = []
          for (const item of produits) {
            const produit = await createTestProduit(pool, item.produit, item.stock)
            createdProduits.push(produit)
          }
          
          // Get available products
          const result = await pool.query(`
            SELECT * FROM get_produits_disponibles()
          `)
          
          const availableProducts = result.rows
          
          // Property: All returned products should have actif = true
          for (const product of availableProducts) {
            expect(product.actif).toBe(true)
          }
          
          // Property: Inactive products should NOT be in results
          const inactiveProducts = createdProduits.filter(p => !p.actif)
          for (const inactiveProduct of inactiveProducts) {
            const found = availableProducts.find((p: any) => p.id === inactiveProduct.id)
            expect(found).toBeUndefined()
          }
          
          // Property: Active products with stock > 0 should be in results
          const activeProductsWithStock = createdProduits.filter(p => p.actif && p.stock > 0)
          for (const activeProduct of activeProductsWithStock) {
            const found = availableProducts.find((p: any) => p.id === activeProduct.id)
            expect(found).toBeDefined()
          }
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 30 }
    )
  })

  it('should exclude inactive products even with high stock levels', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            nom: fc.string({ minLength: 3, maxLength: 50 }),
            categorie: categorieArbitrary,
            prix_vente: prixArbitrary,
            stock: fc.integer({ min: 50, max: 200 })
          }),
          { minLength: 3, maxLength: 10 }
        ),
        async (produits) => {
          // Create inactive products with high stock
          const createdProduits = []
          for (const item of produits) {
            const produit = await createTestProduit(pool, {
              ...item,
              seuil_stock_minimum: 5,
              actif: false // All inactive
            }, item.stock)
            createdProduits.push(produit)
          }
          
          // Get available products
          const result = await pool.query(`
            SELECT * FROM get_produits_disponibles()
          `)
          
          // Property: No products should be returned (all are inactive)
          expect(result.rows.length).toBe(0)
          
          // Verify all created products have high stock but are inactive
          for (const produit of createdProduits) {
            expect(produit.stock).toBeGreaterThanOrEqual(50)
            expect(produit.actif).toBe(false)
          }
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should include products when reactivated', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          produit: fc.record({
            nom: fc.string({ minLength: 3, maxLength: 50 }),
            categorie: categorieArbitrary,
            prix_vente: prixArbitrary,
            seuil_stock_minimum: fc.integer({ min: 0, max: 10 })
          }),
          stock: fc.integer({ min: 10, max: 100 })
        }),
        async (testData) => {
          // Create inactive product with stock
          const produit = await createTestProduit(pool, {
            ...testData.produit,
            actif: false
          }, testData.stock)
          
          // Get available products - should not include this product
          const result1 = await pool.query(`
            SELECT * FROM get_produits_disponibles()
          `)
          
          const found1 = result1.rows.find((p: any) => p.id === produit.id)
          expect(found1).toBeUndefined()
          
          // Reactivate the product
          await pool.query(`
            UPDATE produits SET actif = true WHERE id = $1
          `, [produit.id])
          
          // Get available products again - should now include this product
          const result2 = await pool.query(`
            SELECT * FROM get_produits_disponibles()
          `)
          
          const found2 = result2.rows.find((p: any) => p.id === produit.id)
          
          // Property: Product should now be available
          expect(found2).toBeDefined()
          expect(found2.actif).toBe(true)
          expect(found2.quantite_disponible).toBe(testData.stock)
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should apply both filters: actif = true AND stock > 0', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            produit: produitArbitrary,
            stock: fc.integer({ min: 0, max: 50 })
          }),
          { minLength: 8, maxLength: 16 }
        ),
        async (produits) => {
          // Create produits with all combinations of actif and stock
          const createdProduits = []
          for (const item of produits) {
            const produit = await createTestProduit(pool, item.produit, item.stock)
            createdProduits.push(produit)
          }
          
          // Get available products
          const result = await pool.query(`
            SELECT * FROM get_produits_disponibles()
          `)
          
          const availableProducts = result.rows
          
          // Property: Only products with BOTH actif = true AND stock > 0 should be returned
          for (const product of availableProducts) {
            expect(product.actif).toBe(true)
            expect(product.quantite_disponible).toBeGreaterThan(0)
          }
          
          // Property: Count should match products meeting both criteria
          const expectedCount = createdProduits.filter(p => p.actif && p.stock > 0).length
          expect(availableProducts.length).toBe(expectedCount)
          
          // Property: Products failing either criterion should be excluded
          const excludedProducts = createdProduits.filter(p => !p.actif || p.stock === 0)
          for (const excluded of excludedProducts) {
            const found = availableProducts.find((p: any) => p.id === excluded.id)
            expect(found).toBeUndefined()
          }
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 25 }
    )
  })

  it('should return products ordered by category and name', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            nom: fc.string({ minLength: 3, maxLength: 50 }),
            categorie: categorieArbitrary,
            prix_vente: prixArbitrary
          }),
          { minLength: 5, maxLength: 10 }
        ),
        async (produits) => {
          // Create active products with stock
          for (const produitData of produits) {
            await createTestProduit(pool, {
              ...produitData,
              seuil_stock_minimum: 5,
              actif: true
            }, 10)
          }
          
          // Get available products
          const result = await pool.query(`
            SELECT * FROM get_produits_disponibles()
          `)
          
          const availableProducts = result.rows
          
          // Property: Products should be ordered by category, then by name
          for (let i = 1; i < availableProducts.length; i++) {
            const prev = availableProducts[i - 1]
            const curr = availableProducts[i]
            
            // Either category is different (and properly ordered) or same category with name ordered
            const categoryComparison = prev.categorie.localeCompare(curr.categorie)
            if (categoryComparison === 0) {
              // Same category - names should be ordered
              expect(prev.nom.localeCompare(curr.nom)).toBeLessThanOrEqual(0)
            } else {
              // Different categories - should be ordered
              expect(categoryComparison).toBeLessThanOrEqual(0)
            }
          }
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 15 }
    )
  })
})
