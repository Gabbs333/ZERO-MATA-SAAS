import { describe, it, expect, beforeEach } from 'vitest'
import { getTestPool, skipIfNoDB } from '../setup'
import * as fc from 'fast-check'

/**
 * Property-Based Tests for Commande Validation
 * 
 * Tests Properties:
 * - Property 4: Déduction automatique du stock (Requirements 2.2, 3.2)
 * - Property 5: Création de mouvement de stock pour les ventes (Requirement 2.3)
 * - Property 6: Rejet des commandes avec stock insuffisant (Requirement 2.4)
 */

// ============================================================================
// ARBITRARIES (Generators)
// ============================================================================

const prixArbitrary = fc.integer({ min: 100, max: 10000 })
  .map(n => Math.round(n / 25) * 25)

const quantiteArbitrary = fc.integer({ min: 1, max: 20 })

const categorieArbitrary = fc.constantFrom('boisson', 'nourriture', 'autre')

const produitArbitrary = fc.record({
  nom: fc.string({ minLength: 3, maxLength: 50 }),
  categorie: categorieArbitrary,
  prix_vente: prixArbitrary,
  seuil_stock_minimum: fc.integer({ min: 0, max: 10 }),
  actif: fc.constant(true)
})

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function createTestUser(pool: any, role: string = 'serveuse') {
  const userId = `00000000-0000-0000-0000-${Date.now().toString().padStart(12, '0').slice(-12)}`
  const email = `test-${userId}@example.com`
  
  await pool.query(`
    INSERT INTO profiles (id, email, nom, prenom, role, actif)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [userId, email, 'Test', 'User', role, true])
  
  return userId
}

async function createTestTable(pool: any) {
  const tableId = `00000000-0000-0000-0001-${Date.now().toString().padStart(12, '0').slice(-12)}`
  const numero = `T${Date.now()}`
  
  await pool.query(`
    INSERT INTO tables (id, numero, statut)
    VALUES ($1, $2, $3)
  `, [tableId, numero, 'libre'])
  
  return tableId
}

async function createTestProduit(pool: any, produitData: any, initialStock: number = 100) {
  const produitId = `00000000-0000-0000-0002-${Date.now().toString().padStart(12, '0').slice(-12)}`
  
  const result = await pool.query(`
    INSERT INTO produits (id, nom, categorie, prix_vente, seuil_stock_minimum, actif)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, nom, prix_vente
  `, [produitId, produitData.nom, produitData.categorie, produitData.prix_vente, 
      produitData.seuil_stock_minimum, produitData.actif])
  
  // Create stock entry
  await pool.query(`
    INSERT INTO stock (produit_id, quantite_disponible)
    VALUES ($1, $2)
  `, [produitId, initialStock])
  
  return result.rows[0]
}

async function createTestCommande(pool: any, tableId: string, userId: string, items: any[]) {
  const commandeResult = await pool.query(`
    INSERT INTO commandes (table_id, serveuse_id, statut, montant_total)
    VALUES ($1, $2, $3, $4)
    RETURNING id
  `, [tableId, userId, 'en_attente', 0])
  
  const commandeId = commandeResult.rows[0].id
  
  // Add items
  for (const item of items) {
    await pool.query(`
      INSERT INTO commande_items (commande_id, produit_id, nom_produit, 
                                 prix_unitaire, quantite, montant_ligne)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [commandeId, item.produit_id, item.nom_produit, item.prix_unitaire, 
        item.quantite, item.prix_unitaire * item.quantite])
  }
  
  return commandeId
}

async function cleanup(pool: any) {
  await pool.query('DELETE FROM mouvements_stock WHERE TRUE')
  await pool.query('DELETE FROM commande_items WHERE TRUE')
  await pool.query('DELETE FROM commandes WHERE TRUE')
  await pool.query('DELETE FROM stock WHERE TRUE')
  await pool.query('DELETE FROM produits WHERE TRUE')
  await pool.query('DELETE FROM tables WHERE TRUE')
  await pool.query('DELETE FROM profiles WHERE TRUE')
}

// ============================================================================
// PROPERTY 4: Déduction automatique du stock
// Validates: Requirements 2.2, 3.2
// ============================================================================

describe('Property 4: Déduction automatique du stock', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  beforeEach(async () => {
    const pool = await getTestPool()
    await cleanup(pool)
  })

  it('should deduct stock quantities when validating a commande', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          produits: fc.array(
            fc.record({
              produit: produitArbitrary,
              quantite: quantiteArbitrary,
              initialStock: fc.integer({ min: 50, max: 200 })
            }),
            { minLength: 1, maxLength: 5 }
          )
        }),
        async (testData) => {
          // Setup
          const userId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          
          // Create produits with specific stock levels
          const produitsWithStock = []
          for (const item of testData.produits) {
            const produit = await createTestProduit(pool, item.produit, item.initialStock)
            produitsWithStock.push({
              ...produit,
              quantite: item.quantite,
              initialStock: item.initialStock
            })
          }
          
          // Create commande
          const items = produitsWithStock.map(p => ({
            produit_id: p.id,
            nom_produit: p.nom,
            prix_unitaire: p.prix_vente,
            quantite: p.quantite
          }))
          
          const commandeId = await createTestCommande(pool, tableId, userId, items)
          
          // Get stock before validation
          const stockBefore = []
          for (const produit of produitsWithStock) {
            const result = await pool.query(`
              SELECT quantite_disponible FROM stock WHERE produit_id = $1
            `, [produit.id])
            stockBefore.push({
              produit_id: produit.id,
              quantite: result.rows[0].quantite_disponible
            })
          }
          
          // Validate commande using the function
          const validationResult = await pool.query(`
            SELECT validate_commande($1) as result
          `, [commandeId])
          
          const result = validationResult.rows[0].result
          
          // If validation succeeded
          if (result.success) {
            // Property: Stock should be deducted by exact quantities ordered
            for (const produit of produitsWithStock) {
              const stockAfterResult = await pool.query(`
                SELECT quantite_disponible FROM stock WHERE produit_id = $1
              `, [produit.id])
              
              const stockAfter = stockAfterResult.rows[0].quantite_disponible
              const stockBeforeValue = stockBefore.find(s => s.produit_id === produit.id)!.quantite
              
              expect(stockAfter).toBe(stockBeforeValue - produit.quantite)
            }
          }
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 30 }
    )
  })

  it('should deduct stock for multiple items in a single commande', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            produit: produitArbitrary,
            quantite: fc.integer({ min: 1, max: 10 })
          }),
          { minLength: 2, maxLength: 5 }
        ),
        async (items) => {
          // Setup
          const userId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          
          // Create produits with sufficient stock
          const produitsWithStock = []
          for (const item of items) {
            const produit = await createTestProduit(pool, item.produit, 100)
            produitsWithStock.push({
              ...produit,
              quantite: item.quantite
            })
          }
          
          // Create commande
          const commandeItems = produitsWithStock.map(p => ({
            produit_id: p.id,
            nom_produit: p.nom,
            prix_unitaire: p.prix_vente,
            quantite: p.quantite
          }))
          
          const commandeId = await createTestCommande(pool, tableId, userId, commandeItems)
          
          // Record initial stock
          const initialStocks = new Map()
          for (const produit of produitsWithStock) {
            const result = await pool.query(`
              SELECT quantite_disponible FROM stock WHERE produit_id = $1
            `, [produit.id])
            initialStocks.set(produit.id, result.rows[0].quantite_disponible)
          }
          
          // Validate commande
          await pool.query(`SELECT validate_commande($1)`, [commandeId])
          
          // Property: Each product's stock should be reduced by its ordered quantity
          for (const produit of produitsWithStock) {
            const result = await pool.query(`
              SELECT quantite_disponible FROM stock WHERE produit_id = $1
            `, [produit.id])
            
            const finalStock = result.rows[0].quantite_disponible
            const initialStock = initialStocks.get(produit.id)
            
            expect(finalStock).toBe(initialStock - produit.quantite)
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
// PROPERTY 5: Création de mouvement de stock pour les ventes
// Validates: Requirement 2.3
// ============================================================================

describe('Property 5: Création de mouvement de stock pour les ventes', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  beforeEach(async () => {
    const pool = await getTestPool()
    await cleanup(pool)
  })

  it('should create stock movement records when validating a commande', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            produit: produitArbitrary,
            quantite: quantiteArbitrary
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (items) => {
          // Setup
          const userId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          
          // Create produits
          const produitsWithStock = []
          for (const item of items) {
            const produit = await createTestProduit(pool, item.produit, 100)
            produitsWithStock.push({
              ...produit,
              quantite: item.quantite
            })
          }
          
          // Create commande
          const commandeItems = produitsWithStock.map(p => ({
            produit_id: p.id,
            nom_produit: p.nom,
            prix_unitaire: p.prix_vente,
            quantite: p.quantite
          }))
          
          const commandeId = await createTestCommande(pool, tableId, userId, commandeItems)
          
          // Validate commande
          await pool.query(`SELECT validate_commande($1)`, [commandeId])
          
          // Property: A stock movement should be created for each item
          const movementsResult = await pool.query(`
            SELECT * FROM mouvements_stock 
            WHERE reference = $1 AND type_reference = 'commande'
          `, [commandeId])
          
          expect(movementsResult.rows.length).toBe(produitsWithStock.length)
          
          // Property: Each movement should have correct data
          for (const movement of movementsResult.rows) {
            expect(movement.type).toBe('sortie')
            expect(movement.quantite).toBeGreaterThan(0)
            expect(movement.reference).toBe(commandeId)
            expect(movement.type_reference).toBe('commande')
            expect(movement.utilisateur_id).toBe(userId)
            expect(movement.date_creation).toBeDefined()
            
            // Verify the movement quantity matches the ordered quantity
            const orderedItem = produitsWithStock.find(p => p.id === movement.produit_id)
            expect(orderedItem).toBeDefined()
            expect(movement.quantite).toBe(orderedItem!.quantite)
          }
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 25 }
    )
  })

  it('should record complete movement data with timestamp and user', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        produitArbitrary,
        quantiteArbitrary,
        async (produitData, quantite) => {
          // Setup
          const userId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          const produit = await createTestProduit(pool, produitData, 100)
          
          // Create and validate commande
          const commandeId = await createTestCommande(pool, tableId, userId, [{
            produit_id: produit.id,
            nom_produit: produit.nom,
            prix_unitaire: produit.prix_vente,
            quantite: quantite
          }])
          
          const beforeValidation = new Date()
          await pool.query(`SELECT validate_commande($1)`, [commandeId])
          const afterValidation = new Date()
          
          // Property: Movement should have complete traceability data
          const movementResult = await pool.query(`
            SELECT * FROM mouvements_stock 
            WHERE reference = $1 AND type_reference = 'commande'
          `, [commandeId])
          
          expect(movementResult.rows.length).toBe(1)
          
          const movement = movementResult.rows[0]
          
          // Verify all required fields
          expect(movement.produit_id).toBe(produit.id)
          expect(movement.type).toBe('sortie')
          expect(movement.quantite).toBe(quantite)
          expect(movement.utilisateur_id).toBe(userId)
          expect(movement.reference).toBe(commandeId)
          expect(movement.type_reference).toBe('commande')
          
          // Verify timestamp is within reasonable range
          const movementDate = new Date(movement.date_creation)
          expect(movementDate.getTime()).toBeGreaterThanOrEqual(beforeValidation.getTime())
          expect(movementDate.getTime()).toBeLessThanOrEqual(afterValidation.getTime() + 1000)
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 20 }
    )
  })
})

// ============================================================================
// PROPERTY 6: Rejet des commandes avec stock insuffisant
// Validates: Requirement 2.4
// ============================================================================

describe('Property 6: Rejet des commandes avec stock insuffisant', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  beforeEach(async () => {
    const pool = await getTestPool()
    await cleanup(pool)
  })

  it('should reject validation when stock is insufficient', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          produit: produitArbitrary,
          stockAvailable: fc.integer({ min: 1, max: 20 }),
          quantiteRequested: fc.integer({ min: 21, max: 50 })
        }),
        async (testData) => {
          // Setup
          const userId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          const produit = await createTestProduit(pool, testData.produit, testData.stockAvailable)
          
          // Create commande requesting more than available
          const commandeId = await createTestCommande(pool, tableId, userId, [{
            produit_id: produit.id,
            nom_produit: produit.nom,
            prix_unitaire: produit.prix_vente,
            quantite: testData.quantiteRequested
          }])
          
          // Get stock before validation attempt
          const stockBeforeResult = await pool.query(`
            SELECT quantite_disponible FROM stock WHERE produit_id = $1
          `, [produit.id])
          const stockBefore = stockBeforeResult.rows[0].quantite_disponible
          
          // Attempt to validate commande
          const validationResult = await pool.query(`
            SELECT validate_commande($1) as result
          `, [commandeId])
          
          const result = validationResult.rows[0].result
          
          // Property: Validation should fail
          expect(result.success).toBe(false)
          expect(result.error).toBeDefined()
          expect(result.error).toContain('Insufficient stock')
          
          // Property: Stock should remain unchanged
          const stockAfterResult = await pool.query(`
            SELECT quantite_disponible FROM stock WHERE produit_id = $1
          `, [produit.id])
          const stockAfter = stockAfterResult.rows[0].quantite_disponible
          
          expect(stockAfter).toBe(stockBefore)
          
          // Property: Commande status should remain en_attente
          const commandeResult = await pool.query(`
            SELECT statut FROM commandes WHERE id = $1
          `, [commandeId])
          
          expect(commandeResult.rows[0].statut).toBe('en_attente')
          
          // Property: No stock movements should be created
          const movementsResult = await pool.query(`
            SELECT * FROM mouvements_stock WHERE reference = $1
          `, [commandeId])
          
          expect(movementsResult.rows.length).toBe(0)
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 25 }
    )
  })

  it('should reject when any item in multi-item commande has insufficient stock', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          produits: fc.array(produitArbitrary, { minLength: 2, maxLength: 4 }),
          insufficientIndex: fc.integer({ min: 0, max: 3 })
        }),
        async (testData) => {
          // Ensure insufficientIndex is within bounds
          const insufficientIndex = testData.insufficientIndex % testData.produits.length
          
          // Setup
          const userId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          
          // Create produits - one with insufficient stock
          const produitsWithStock = []
          for (let i = 0; i < testData.produits.length; i++) {
            const stock = i === insufficientIndex ? 5 : 100
            const produit = await createTestProduit(pool, testData.produits[i], stock)
            produitsWithStock.push({
              ...produit,
              quantite: i === insufficientIndex ? 10 : 5, // Request more than available for one item
              initialStock: stock
            })
          }
          
          // Create commande
          const items = produitsWithStock.map(p => ({
            produit_id: p.id,
            nom_produit: p.nom,
            prix_unitaire: p.prix_vente,
            quantite: p.quantite
          }))
          
          const commandeId = await createTestCommande(pool, tableId, userId, items)
          
          // Attempt validation
          const validationResult = await pool.query(`
            SELECT validate_commande($1) as result
          `, [commandeId])
          
          const result = validationResult.rows[0].result
          
          // Property: Validation should fail
          expect(result.success).toBe(false)
          
          // Property: ALL stock levels should remain unchanged (atomic operation)
          for (const produit of produitsWithStock) {
            const stockResult = await pool.query(`
              SELECT quantite_disponible FROM stock WHERE produit_id = $1
            `, [produit.id])
            
            expect(stockResult.rows[0].quantite_disponible).toBe(produit.initialStock)
          }
          
          // Property: No stock movements should be created for any item
          const movementsResult = await pool.query(`
            SELECT * FROM mouvements_stock WHERE reference = $1
          `, [commandeId])
          
          expect(movementsResult.rows.length).toBe(0)
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should allow validation when stock is exactly equal to requested quantity', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          produit: produitArbitrary,
          quantite: fc.integer({ min: 1, max: 50 })
        }),
        async (testData) => {
          // Setup - stock exactly equals requested quantity
          const userId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          const produit = await createTestProduit(pool, testData.produit, testData.quantite)
          
          // Create commande
          const commandeId = await createTestCommande(pool, tableId, userId, [{
            produit_id: produit.id,
            nom_produit: produit.nom,
            prix_unitaire: produit.prix_vente,
            quantite: testData.quantite
          }])
          
          // Validate commande
          const validationResult = await pool.query(`
            SELECT validate_commande($1) as result
          `, [commandeId])
          
          const result = validationResult.rows[0].result
          
          // Property: Validation should succeed
          expect(result.success).toBe(true)
          
          // Property: Stock should be reduced to 0
          const stockResult = await pool.query(`
            SELECT quantite_disponible FROM stock WHERE produit_id = $1
          `, [produit.id])
          
          expect(stockResult.rows[0].quantite_disponible).toBe(0)
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 20 }
    )
  })
})
