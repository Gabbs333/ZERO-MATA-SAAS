import { describe, it, expect, beforeEach } from 'vitest'
import { getTestPool, skipIfNoDB } from '../setup'
import * as fc from 'fast-check'

/**
 * Property-Based Tests for Tables Management
 * 
 * Tests Properties:
 * - Property 32: Changement d'état lors de la création de commande (Requirement 10.2)
 * - Property 33: Changement d'état lors de la validation (Requirement 10.3)
 * - Property 34: Libération manuelle des tables (Requirement 10.4)
 * - Property 35: Commandes multiples par table (Requirement 10.5)
 */

// ============================================================================
// ARBITRARIES (Generators)
// ============================================================================

const prixArbitrary = fc.integer({ min: 100, max: 10000 })
  .map(n => Math.round(n / 25) * 25) // Multiples of 25 FCFA

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

async function createTestProduit(pool: any, produitData: any) {
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
  `, [produitId, 100]) // Start with 100 units
  
  return result.rows[0]
}

async function createTestCommande(pool: any, tableId: string, serveuseId: string, produits: any[]) {
  // Create commande
  const commandeResult = await pool.query(`
    INSERT INTO commandes (table_id, serveuse_id, statut, montant_total)
    VALUES ($1, $2, 'en_attente', 0)
    RETURNING id, numero_commande
  `, [tableId, serveuseId])
  
  const commandeId = commandeResult.rows[0].id
  
  // Add items
  let montantTotal = 0
  for (const produit of produits) {
    const montantLigne = produit.prix_vente * produit.quantite
    montantTotal += montantLigne
    
    await pool.query(`
      INSERT INTO commande_items (commande_id, produit_id, nom_produit, prix_unitaire, quantite, montant_ligne)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [commandeId, produit.id, produit.nom, produit.prix_vente, produit.quantite, montantLigne])
  }
  
  // Update total
  await pool.query(`
    UPDATE commandes SET montant_total = $1 WHERE id = $2
  `, [montantTotal, commandeId])
  
  return commandeResult.rows[0]
}

async function cleanup(pool: any) {
  await pool.query('DELETE FROM commande_items WHERE TRUE')
  await pool.query('DELETE FROM commandes WHERE TRUE')
  await pool.query('DELETE FROM mouvements_stock WHERE TRUE')
  await pool.query('DELETE FROM stock WHERE TRUE')
  await pool.query('DELETE FROM produits WHERE TRUE')
  await pool.query('DELETE FROM tables WHERE TRUE')
  await pool.query('DELETE FROM profiles WHERE TRUE')
}

// ============================================================================
// PROPERTY-BASED TESTS
// ============================================================================

describe('Tables Management - Property-Based Tests', () => {
  let pool: any

  beforeEach(async () => {
    pool = getTestPool()
    if (!pool) return
    await cleanup(pool)
  })

  /**
   * Property 32: Changement d'état lors de la création de commande
   * **Validates: Requirement 10.2**
   * 
   * For any order created for a table, the table status must change to 
   * "commande_en_attente" immediately after creation.
   */
  it('Property 32: Table status changes to commande_en_attente when order is created', async () => {
    skipIfNoDB()
    
    await fc.assert(
      fc.asyncProperty(
        produitArbitrary,
        quantiteArbitrary,
        async (produitData, quantite) => {
          // Setup
          const serveuseId = await createTestUser(pool, 'serveuse')
          const tableId = await createTestTable(pool)
          const produit = await createTestProduit(pool, produitData)
          
          // Verify initial state
          const initialTable = await pool.query(
            'SELECT statut FROM tables WHERE id = $1',
            [tableId]
          )
          expect(initialTable.rows[0].statut).toBe('libre')
          
          // Create commande
          await createTestCommande(pool, tableId, serveuseId, [
            { ...produit, quantite }
          ])
          
          // Verify table status changed
          const updatedTable = await pool.query(
            'SELECT statut FROM tables WHERE id = $1',
            [tableId]
          )
          expect(updatedTable.rows[0].statut).toBe('commande_en_attente')
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 20 }
    )
  })

  /**
   * Property 33: Changement d'état lors de la validation
   * **Validates: Requirement 10.3**
   * 
   * For any validated order, the associated table status must change to 
   * "occupee" immediately after validation.
   */
  it('Property 33: Table status changes to occupee when order is validated', async () => {
    skipIfNoDB()
    
    await fc.assert(
      fc.asyncProperty(
        produitArbitrary,
        quantiteArbitrary.filter(q => q <= 10), // Ensure we have enough stock
        async (produitData, quantite) => {
          // Setup
          const serveuseId = await createTestUser(pool, 'serveuse')
          const comptoirId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          const produit = await createTestProduit(pool, produitData)
          
          // Create commande
          const commande = await createTestCommande(pool, tableId, serveuseId, [
            { ...produit, quantite }
          ])
          
          // Verify table is in commande_en_attente
          const tableBeforeValidation = await pool.query(
            'SELECT statut FROM tables WHERE id = $1',
            [tableId]
          )
          expect(tableBeforeValidation.rows[0].statut).toBe('commande_en_attente')
          
          // Validate commande
          await pool.query(`
            UPDATE commandes 
            SET statut = 'validee', 
                date_validation = NOW(), 
                validateur_id = $1
            WHERE id = $2
          `, [comptoirId, commande.id])
          
          // Verify table status changed to occupee
          const tableAfterValidation = await pool.query(
            'SELECT statut FROM tables WHERE id = $1',
            [tableId]
          )
          expect(tableAfterValidation.rows[0].statut).toBe('occupee')
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 20 }
    )
  })

  /**
   * Property 34: Libération manuelle des tables
   * **Validates: Requirement 10.4**
   * 
   * For any table marked as "libre" by a waitress, the status must be updated 
   * and the table must be available for new orders.
   */
  it('Property 34: Waitress can manually mark table as libre', async () => {
    skipIfNoDB()
    
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('commande_en_attente', 'occupee'),
        async (initialStatus) => {
          // Setup
          const serveuseId = await createTestUser(pool, 'serveuse')
          const tableId = await createTestTable(pool)
          
          // Set table to initial status
          await pool.query(`
            UPDATE tables SET statut = $1 WHERE id = $2
          `, [initialStatus, tableId])
          
          // Set session context for RLS
          await pool.query(`
            SELECT set_config('request.jwt.claims', '{"sub": "${serveuseId}"}', true)
          `)
          
          // Waitress marks table as libre
          await pool.query(`
            UPDATE tables SET statut = 'libre' WHERE id = $1
          `, [tableId])
          
          // Verify table is now libre
          const updatedTable = await pool.query(
            'SELECT statut FROM tables WHERE id = $1',
            [tableId]
          )
          expect(updatedTable.rows[0].statut).toBe('libre')
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 20 }
    )
  })

  /**
   * Property 35: Commandes multiples par table
   * **Validates: Requirement 10.5**
   * 
   * For any table, the system must allow creation of multiple successive orders 
   * as long as the table is not marked as "libre".
   */
  it('Property 35: Multiple orders can be created for same table before liberation', async () => {
    skipIfNoDB()
    
    await fc.assert(
      fc.asyncProperty(
        fc.array(produitArbitrary, { minLength: 2, maxLength: 5 }),
        fc.integer({ min: 2, max: 4 }), // Number of orders
        async (produitsData, numOrders) => {
          // Setup
          const serveuseId = await createTestUser(pool, 'serveuse')
          const comptoirId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          
          // Create products
          const produits = []
          for (const produitData of produitsData) {
            const produit = await createTestProduit(pool, produitData)
            produits.push(produit)
          }
          
          const commandeIds = []
          
          // Create multiple orders for the same table
          for (let i = 0; i < numOrders; i++) {
            // Select a random product
            const produit = produits[i % produits.length]
            const quantite = Math.floor(Math.random() * 5) + 1
            
            const commande = await createTestCommande(pool, tableId, serveuseId, [
              { ...produit, quantite }
            ])
            commandeIds.push(commande.id)
            
            // Validate the order
            await pool.query(`
              UPDATE commandes 
              SET statut = 'validee', 
                  date_validation = NOW(), 
                  validateur_id = $1
              WHERE id = $2
            `, [comptoirId, commande.id])
          }
          
          // Verify all orders were created for the same table
          const orders = await pool.query(`
            SELECT id, table_id, statut 
            FROM commandes 
            WHERE id = ANY($1)
          `, [commandeIds])
          
          expect(orders.rows.length).toBe(numOrders)
          
          // All orders should be for the same table
          const uniqueTables = new Set(orders.rows.map((r: any) => r.table_id))
          expect(uniqueTables.size).toBe(1)
          expect(uniqueTables.has(tableId)).toBe(true)
          
          // All orders should be validated
          const allValidated = orders.rows.every((r: any) => r.statut === 'validee')
          expect(allValidated).toBe(true)
          
          // Table should still be occupee (not libre)
          const finalTable = await pool.query(
            'SELECT statut FROM tables WHERE id = $1',
            [tableId]
          )
          expect(finalTable.rows[0].statut).toBe('occupee')
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 15 }
    )
  })
})
