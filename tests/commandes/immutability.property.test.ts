import { describe, it, expect, beforeEach } from 'vitest'
import { getTestPool, skipIfNoDB } from '../setup'
import * as fc from 'fast-check'

/**
 * Property-Based Tests for Commande Immutability
 * 
 * Tests Properties:
 * - Property 30: Immutabilité des commandes validées (Requirement 8.3)
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

async function createValidatedCommande(pool: any, tableId: string, userId: string, items: any[]) {
  // Create commande
  const commandeResult = await pool.query(`
    INSERT INTO commandes (table_id, serveuse_id, statut, montant_total, 
                          date_validation, validateur_id)
    VALUES ($1, $2, $3, $4, NOW(), $5)
    RETURNING id
  `, [tableId, userId, 'validee', 0, userId])
  
  const commandeId = commandeResult.rows[0].id
  
  // Add items
  let total = 0
  for (const item of items) {
    const montantLigne = item.prix_unitaire * item.quantite
    total += montantLigne
    
    await pool.query(`
      INSERT INTO commande_items (commande_id, produit_id, nom_produit, 
                                 prix_unitaire, quantite, montant_ligne)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [commandeId, item.produit_id, item.nom_produit, item.prix_unitaire, 
        item.quantite, montantLigne])
  }
  
  // Update total
  await pool.query(`
    UPDATE commandes SET montant_total = $1 WHERE id = $2
  `, [total, commandeId])
  
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
// PROPERTY 30: Immutabilité des commandes validées
// Validates: Requirement 8.3
// ============================================================================

describe('Property 30: Immutabilité des commandes validées', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  beforeEach(async () => {
    const pool = await getTestPool()
    await cleanup(pool)
  })

  it('should prevent modification of validated commandes', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          produit: produitArbitrary,
          quantite: quantiteArbitrary,
          newMontant: fc.integer({ min: 1000, max: 50000 })
        }),
        async (testData) => {
          // Setup
          const userId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          const produit = await createTestProduit(pool, testData.produit, 100)
          
          // Create validated commande
          const items = [{
            produit_id: produit.id,
            nom_produit: produit.nom,
            prix_unitaire: produit.prix_vente,
            quantite: testData.quantite
          }]
          
          const commandeId = await createValidatedCommande(pool, tableId, userId, items)
          
          // Get original data
          const originalResult = await pool.query(`
            SELECT * FROM commandes WHERE id = $1
          `, [commandeId])
          
          const originalCommande = originalResult.rows[0]
          
          // Attempt to modify the validated commande
          const updateResult = await pool.query(`
            UPDATE commandes 
            SET montant_total = $1, statut = $2
            WHERE id = $3 AND statut = 'validee'
            RETURNING id
          `, [testData.newMontant, 'en_attente', commandeId])
          
          // Property: Update should not affect any rows (RLS policy prevents it)
          expect(updateResult.rows.length).toBe(0)
          
          // Verify commande data remains unchanged
          const afterUpdateResult = await pool.query(`
            SELECT * FROM commandes WHERE id = $1
          `, [commandeId])
          
          const afterUpdate = afterUpdateResult.rows[0]
          
          expect(afterUpdate.montant_total).toBe(originalCommande.montant_total)
          expect(afterUpdate.statut).toBe('validee')
          expect(afterUpdate.date_validation).toEqual(originalCommande.date_validation)
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 25 }
    )
  })

  it('should prevent deletion of validated commandes', async () => {
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
        async (itemsData) => {
          // Setup
          const userId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          
          // Create produits
          const produits = []
          for (const itemData of itemsData) {
            const produit = await createTestProduit(pool, itemData.produit, 100)
            produits.push({
              ...produit,
              quantite: itemData.quantite
            })
          }
          
          // Create validated commande
          const items = produits.map(p => ({
            produit_id: p.id,
            nom_produit: p.nom,
            prix_unitaire: p.prix_vente,
            quantite: p.quantite
          }))
          
          const commandeId = await createValidatedCommande(pool, tableId, userId, items)
          
          // Attempt to delete the validated commande
          const deleteResult = await pool.query(`
            DELETE FROM commandes WHERE id = $1 AND statut = 'validee'
            RETURNING id
          `, [commandeId])
          
          // Property: Delete should not affect any rows (RLS policy prevents it)
          expect(deleteResult.rows.length).toBe(0)
          
          // Verify commande still exists
          const checkResult = await pool.query(`
            SELECT id, statut FROM commandes WHERE id = $1
          `, [commandeId])
          
          expect(checkResult.rows.length).toBe(1)
          expect(checkResult.rows[0].statut).toBe('validee')
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should prevent modification of items in validated commandes', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          produit: produitArbitrary,
          originalQuantite: quantiteArbitrary,
          newQuantite: quantiteArbitrary
        }),
        async (testData) => {
          // Setup
          const userId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          const produit = await createTestProduit(pool, testData.produit, 100)
          
          // Create validated commande
          const items = [{
            produit_id: produit.id,
            nom_produit: produit.nom,
            prix_unitaire: produit.prix_vente,
            quantite: testData.originalQuantite
          }]
          
          const commandeId = await createValidatedCommande(pool, tableId, userId, items)
          
          // Get original item data
          const originalItemsResult = await pool.query(`
            SELECT * FROM commande_items WHERE commande_id = $1
          `, [commandeId])
          
          const originalItem = originalItemsResult.rows[0]
          
          // Attempt to modify the item
          const updateResult = await pool.query(`
            UPDATE commande_items 
            SET quantite = $1, montant_ligne = $2
            WHERE commande_id = $3
            RETURNING id
          `, [testData.newQuantite, produit.prix_vente * testData.newQuantite, commandeId])
          
          // Property: Update should not affect any rows (RLS policy prevents it)
          expect(updateResult.rows.length).toBe(0)
          
          // Verify item data remains unchanged
          const afterUpdateResult = await pool.query(`
            SELECT * FROM commande_items WHERE commande_id = $1
          `, [commandeId])
          
          const afterUpdate = afterUpdateResult.rows[0]
          
          expect(afterUpdate.quantite).toBe(originalItem.quantite)
          expect(afterUpdate.montant_ligne).toBe(originalItem.montant_ligne)
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should prevent deletion of items from validated commandes', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            produit: produitArbitrary,
            quantite: quantiteArbitrary
          }),
          { minLength: 2, maxLength: 5 }
        ),
        async (itemsData) => {
          // Setup
          const userId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          
          // Create produits
          const produits = []
          for (const itemData of itemsData) {
            const produit = await createTestProduit(pool, itemData.produit, 100)
            produits.push({
              ...produit,
              quantite: itemData.quantite
            })
          }
          
          // Create validated commande
          const items = produits.map(p => ({
            produit_id: p.id,
            nom_produit: p.nom,
            prix_unitaire: p.prix_vente,
            quantite: p.quantite
          }))
          
          const commandeId = await createValidatedCommande(pool, tableId, userId, items)
          
          // Get item count before deletion attempt
          const beforeResult = await pool.query(`
            SELECT COUNT(*) as count FROM commande_items WHERE commande_id = $1
          `, [commandeId])
          
          const itemCountBefore = parseInt(beforeResult.rows[0].count)
          
          // Attempt to delete an item
          const deleteResult = await pool.query(`
            DELETE FROM commande_items 
            WHERE commande_id = $1
            RETURNING id
          `, [commandeId])
          
          // Property: Delete should not affect any rows (RLS policy prevents it)
          expect(deleteResult.rows.length).toBe(0)
          
          // Verify all items still exist
          const afterResult = await pool.query(`
            SELECT COUNT(*) as count FROM commande_items WHERE commande_id = $1
          `, [commandeId])
          
          const itemCountAfter = parseInt(afterResult.rows[0].count)
          
          expect(itemCountAfter).toBe(itemCountBefore)
          expect(itemCountAfter).toBe(items.length)
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should allow modification of pending commandes but not validated ones', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          produit: produitArbitrary,
          quantite: quantiteArbitrary,
          newMontant: fc.integer({ min: 1000, max: 50000 })
        }),
        async (testData) => {
          // Setup
          const userId = await createTestUser(pool, 'serveuse')
          const tableId = await createTestTable(pool)
          const produit = await createTestProduit(pool, testData.produit, 100)
          
          // Create pending commande
          const pendingResult = await pool.query(`
            INSERT INTO commandes (table_id, serveuse_id, statut, montant_total)
            VALUES ($1, $2, $3, $4)
            RETURNING id
          `, [tableId, userId, 'en_attente', 1000])
          
          const pendingId = pendingResult.rows[0].id
          
          // Create validated commande
          const items = [{
            produit_id: produit.id,
            nom_produit: produit.nom,
            prix_unitaire: produit.prix_vente,
            quantite: testData.quantite
          }]
          
          const validatedId = await createValidatedCommande(pool, tableId, userId, items)
          
          // Attempt to modify pending commande (should succeed)
          const updatePendingResult = await pool.query(`
            UPDATE commandes 
            SET montant_total = $1
            WHERE id = $2 AND statut = 'en_attente'
            RETURNING id
          `, [testData.newMontant, pendingId])
          
          // Property: Pending commande should be modifiable
          expect(updatePendingResult.rows.length).toBe(1)
          
          // Verify the update was applied
          const checkPendingResult = await pool.query(`
            SELECT montant_total FROM commandes WHERE id = $1
          `, [pendingId])
          
          expect(checkPendingResult.rows[0].montant_total).toBe(testData.newMontant)
          
          // Attempt to modify validated commande (should fail)
          const updateValidatedResult = await pool.query(`
            UPDATE commandes 
            SET montant_total = $1
            WHERE id = $2 AND statut = 'validee'
            RETURNING id
          `, [testData.newMontant, validatedId])
          
          // Property: Validated commande should NOT be modifiable
          expect(updateValidatedResult.rows.length).toBe(0)
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should preserve all commande data after validation', async () => {
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
        async (itemsData) => {
          // Setup
          const userId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          
          // Create produits
          const produits = []
          for (const itemData of itemsData) {
            const produit = await createTestProduit(pool, itemData.produit, 100)
            produits.push({
              ...produit,
              quantite: itemData.quantite
            })
          }
          
          // Create validated commande
          const items = produits.map(p => ({
            produit_id: p.id,
            nom_produit: p.nom,
            prix_unitaire: p.prix_vente,
            quantite: p.quantite
          }))
          
          const commandeId = await createValidatedCommande(pool, tableId, userId, items)
          
          // Get commande data immediately after creation
          const immediateResult = await pool.query(`
            SELECT * FROM commandes WHERE id = $1
          `, [commandeId])
          
          const immediateData = immediateResult.rows[0]
          
          // Wait a bit and check again
          await new Promise(resolve => setTimeout(resolve, 100))
          
          const laterResult = await pool.query(`
            SELECT * FROM commandes WHERE id = $1
          `, [commandeId])
          
          const laterData = laterResult.rows[0]
          
          // Property: All data should remain exactly the same
          expect(laterData.id).toBe(immediateData.id)
          expect(laterData.numero_commande).toBe(immediateData.numero_commande)
          expect(laterData.table_id).toBe(immediateData.table_id)
          expect(laterData.serveuse_id).toBe(immediateData.serveuse_id)
          expect(laterData.statut).toBe(immediateData.statut)
          expect(laterData.montant_total).toBe(immediateData.montant_total)
          expect(laterData.validateur_id).toBe(immediateData.validateur_id)
          
          // Property: Items should also remain unchanged
          const itemsResult = await pool.query(`
            SELECT * FROM commande_items WHERE commande_id = $1 ORDER BY id
          `, [commandeId])
          
          expect(itemsResult.rows.length).toBe(items.length)
          
          for (let i = 0; i < itemsResult.rows.length; i++) {
            const item = itemsResult.rows[i]
            const expectedItem = items[i]
            
            expect(item.produit_id).toBe(expectedItem.produit_id)
            expect(item.nom_produit).toBe(expectedItem.nom_produit)
            expect(item.prix_unitaire).toBe(expectedItem.prix_unitaire)
            expect(item.quantite).toBe(expectedItem.quantite)
          }
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 15 }
    )
  })
})
