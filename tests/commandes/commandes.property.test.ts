import { describe, it, expect, beforeEach } from 'vitest'
import { getTestPool, skipIfNoDB } from '../setup'
import * as fc from 'fast-check'

/**
 * Property-Based Tests for Commandes
 * 
 * Tests Properties:
 * - Property 1: Unicité des identifiants de commande (Requirement 1.1)
 * - Property 2: Complétude des données de commande (Requirement 1.3)
 * - Property 7: Calcul correct du montant total (Requirement 9.4)
 * - Property 8: Annulation de commande non soumise (Requirement 9.5)
 */

// ============================================================================
// ARBITRARIES (Generators)
// ============================================================================

const uuidArbitrary = fc.uuid()

const prixArbitrary = fc.integer({ min: 100, max: 10000 })
  .map(n => Math.round(n / 25) * 25) // Multiples of 25 FCFA

const quantiteArbitrary = fc.integer({ min: 1, max: 20 })

const categorieArbitrary = fc.constantFrom('boisson', 'nourriture', 'autre')

const roleArbitrary = fc.constantFrom('serveuse', 'comptoir', 'gerant', 'patron')

const produitArbitrary = fc.record({
  nom: fc.string({ minLength: 3, maxLength: 50 }),
  categorie: categorieArbitrary,
  prix_vente: prixArbitrary,
  seuil_stock_minimum: fc.integer({ min: 0, max: 10 }),
  actif: fc.constant(true)
})

const commandeItemInputArbitrary = fc.record({
  produit_id: uuidArbitrary,
  quantite: quantiteArbitrary
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
// PROPERTY 1: Unicité des identifiants de commande
// Validates: Requirement 1.1
// ============================================================================

describe('Property 1: Unicité des identifiants de commande', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  beforeEach(async () => {
    const pool = await getTestPool()
    await cleanup(pool)
  })

  it('should generate unique commande IDs for multiple commandes', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 10 }),
        async (numCommandes) => {
          // Setup
          const userId = await createTestUser(pool, 'serveuse')
          const tableId = await createTestTable(pool)
          
          const commandeIds: string[] = []
          
          // Create multiple commandes
          for (let i = 0; i < numCommandes; i++) {
            const result = await pool.query(`
              INSERT INTO commandes (table_id, serveuse_id, statut, montant_total)
              VALUES ($1, $2, $3, $4)
              RETURNING id, numero_commande
            `, [tableId, userId, 'en_attente', 1000])
            
            commandeIds.push(result.rows[0].id)
          }
          
          // Property: All IDs should be unique
          const uniqueIds = new Set(commandeIds)
          expect(uniqueIds.size).toBe(commandeIds.length)
          
          // Property: All numero_commande should be unique
          const numeros = await pool.query(`
            SELECT numero_commande FROM commandes WHERE table_id = $1
          `, [tableId])
          
          const uniqueNumeros = new Set(numeros.rows.map((r: any) => r.numero_commande))
          expect(uniqueNumeros.size).toBe(numCommandes)
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should never reuse commande IDs even after deletion', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }),
        async (numCycles) => {
          // Setup
          const userId = await createTestUser(pool, 'serveuse')
          const tableId = await createTestTable(pool)
          
          const allIds: string[] = []
          
          // Create and delete commandes multiple times
          for (let cycle = 0; cycle < numCycles; cycle++) {
            const result = await pool.query(`
              INSERT INTO commandes (table_id, serveuse_id, statut, montant_total)
              VALUES ($1, $2, $3, $4)
              RETURNING id
            `, [tableId, userId, 'en_attente', 1000])
            
            const commandeId = result.rows[0].id
            allIds.push(commandeId)
            
            // Delete the commande (only allowed for en_attente)
            await pool.query('DELETE FROM commandes WHERE id = $1', [commandeId])
          }
          
          // Property: All IDs should be unique (no reuse)
          const uniqueIds = new Set(allIds)
          expect(uniqueIds.size).toBe(allIds.length)
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 15 }
    )
  })
})

// ============================================================================
// PROPERTY 2: Complétude des données de commande
// Validates: Requirement 1.3
// ============================================================================

describe('Property 2: Complétude des données de commande', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  beforeEach(async () => {
    const pool = await getTestPool()
    await cleanup(pool)
  })

  it('should record all required fields when creating a commande', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          produits: fc.array(produitArbitrary, { minLength: 1, maxLength: 5 })
        }),
        async (testData) => {
          // Setup
          const userId = await createTestUser(pool, 'serveuse')
          const tableId = await createTestTable(pool)
          
          // Create produits
          const produits = []
          for (const produitData of testData.produits) {
            const produit = await createTestProduit(pool, produitData)
            produits.push(produit)
          }
          
          // Create commande with items
          const items = produits.map(p => ({
            produit_id: p.id,
            quantite: 2
          }))
          
          const commandeResult = await pool.query(`
            INSERT INTO commandes (table_id, serveuse_id, statut, montant_total)
            VALUES ($1, $2, $3, $4)
            RETURNING id, numero_commande, table_id, serveuse_id, statut, 
                      montant_total, date_creation
          `, [tableId, userId, 'en_attente', 0])
          
          const commande = commandeResult.rows[0]
          
          // Add items
          for (const item of items) {
            const produit = produits.find(p => p.id === item.produit_id)
            await pool.query(`
              INSERT INTO commande_items (commande_id, produit_id, nom_produit, 
                                         prix_unitaire, quantite, montant_ligne)
              VALUES ($1, $2, $3, $4, $5, $6)
            `, [commande.id, item.produit_id, produit.nom, produit.prix_vente, 
                item.quantite, produit.prix_vente * item.quantite])
          }
          
          // Property: All required fields should be present and not null
          expect(commande.id).toBeDefined()
          expect(commande.numero_commande).toBeDefined()
          expect(commande.table_id).toBe(tableId)
          expect(commande.serveuse_id).toBe(userId)
          expect(commande.statut).toBe('en_attente')
          expect(commande.date_creation).toBeDefined()
          expect(commande.date_creation).not.toBeNull()
          
          // Property: Commande should have items
          const itemsResult = await pool.query(`
            SELECT * FROM commande_items WHERE commande_id = $1
          `, [commande.id])
          
          expect(itemsResult.rows.length).toBe(items.length)
          
          // Property: Each item should have complete data
          for (const item of itemsResult.rows) {
            expect(item.produit_id).toBeDefined()
            expect(item.nom_produit).toBeDefined()
            expect(item.prix_unitaire).toBeGreaterThan(0)
            expect(item.quantite).toBeGreaterThan(0)
            expect(item.montant_ligne).toBeGreaterThan(0)
          }
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should reject commandes with missing required fields', async () => {
    const pool = await getTestPool()
    
    // Test missing table_id
    await expect(
      pool.query(`
        INSERT INTO commandes (serveuse_id, statut, montant_total)
        VALUES ($1, $2, $3)
      `, ['00000000-0000-0000-0000-000000000001', 'en_attente', 1000])
    ).rejects.toThrow()
    
    // Test missing serveuse_id
    await expect(
      pool.query(`
        INSERT INTO commandes (table_id, statut, montant_total)
        VALUES ($1, $2, $3)
      `, ['00000000-0000-0000-0001-000000000001', 'en_attente', 1000])
    ).rejects.toThrow()
  })
})

// ============================================================================
// PROPERTY 7: Calcul correct du montant total
// Validates: Requirement 9.4
// ============================================================================

describe('Property 7: Calcul correct du montant total', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  beforeEach(async () => {
    const pool = await getTestPool()
    await cleanup(pool)
  })

  it('should calculate montant_total as sum of all item montant_ligne', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            produit: produitArbitrary,
            quantite: quantiteArbitrary
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (items) => {
          // Setup
          const userId = await createTestUser(pool, 'serveuse')
          const tableId = await createTestTable(pool)
          
          // Create produits
          const produitsWithIds = []
          for (const item of items) {
            const produit = await createTestProduit(pool, item.produit)
            produitsWithIds.push({ ...produit, quantite: item.quantite })
          }
          
          // Create commande
          const commandeResult = await pool.query(`
            INSERT INTO commandes (table_id, serveuse_id, statut, montant_total)
            VALUES ($1, $2, $3, $4)
            RETURNING id
          `, [tableId, userId, 'en_attente', 0])
          
          const commandeId = commandeResult.rows[0].id
          
          // Add items and calculate expected total
          let expectedTotal = 0
          for (const produit of produitsWithIds) {
            const montantLigne = produit.prix_vente * produit.quantite
            expectedTotal += montantLigne
            
            await pool.query(`
              INSERT INTO commande_items (commande_id, produit_id, nom_produit, 
                                         prix_unitaire, quantite, montant_ligne)
              VALUES ($1, $2, $3, $4, $5, $6)
            `, [commandeId, produit.id, produit.nom, produit.prix_vente, 
                produit.quantite, montantLigne])
          }
          
          // Get actual total (trigger should have updated it)
          const result = await pool.query(`
            SELECT montant_total FROM commandes WHERE id = $1
          `, [commandeId])
          
          const actualTotal = result.rows[0].montant_total
          
          // Property: montant_total should equal sum of all montant_ligne
          expect(actualTotal).toBe(expectedTotal)
          
          // Verify by manual calculation
          const itemsResult = await pool.query(`
            SELECT SUM(montant_ligne) as total FROM commande_items WHERE commande_id = $1
          `, [commandeId])
          
          const manualTotal = parseInt(itemsResult.rows[0].total)
          expect(actualTotal).toBe(manualTotal)
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 30 }
    )
  })

  it('should update montant_total when items are modified', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          initialItems: fc.array(
            fc.record({
              produit: produitArbitrary,
              quantite: quantiteArbitrary
            }),
            { minLength: 2, maxLength: 5 }
          ),
          newQuantite: quantiteArbitrary
        }),
        async (testData) => {
          // Setup
          const userId = await createTestUser(pool, 'serveuse')
          const tableId = await createTestTable(pool)
          
          // Create produits and commande
          const produitsWithIds = []
          for (const item of testData.initialItems) {
            const produit = await createTestProduit(pool, item.produit)
            produitsWithIds.push({ ...produit, quantite: item.quantite })
          }
          
          const commandeResult = await pool.query(`
            INSERT INTO commandes (table_id, serveuse_id, statut, montant_total)
            VALUES ($1, $2, $3, $4)
            RETURNING id
          `, [tableId, userId, 'en_attente', 0])
          
          const commandeId = commandeResult.rows[0].id
          
          // Add initial items
          const itemIds = []
          for (const produit of produitsWithIds) {
            const result = await pool.query(`
              INSERT INTO commande_items (commande_id, produit_id, nom_produit, 
                                         prix_unitaire, quantite, montant_ligne)
              VALUES ($1, $2, $3, $4, $5, $6)
              RETURNING id
            `, [commandeId, produit.id, produit.nom, produit.prix_vente, 
                produit.quantite, produit.prix_vente * produit.quantite])
            itemIds.push(result.rows[0].id)
          }
          
          // Get initial total
          const initialResult = await pool.query(`
            SELECT montant_total FROM commandes WHERE id = $1
          `, [commandeId])
          const initialTotal = initialResult.rows[0].montant_total
          
          // Update first item quantity
          const firstProduit = produitsWithIds[0]
          const newMontantLigne = firstProduit.prix_vente * testData.newQuantite
          
          await pool.query(`
            UPDATE commande_items 
            SET quantite = $1, montant_ligne = $2
            WHERE id = $3
          `, [testData.newQuantite, newMontantLigne, itemIds[0]])
          
          // Get updated total
          const updatedResult = await pool.query(`
            SELECT montant_total FROM commandes WHERE id = $1
          `, [commandeId])
          const updatedTotal = updatedResult.rows[0].montant_total
          
          // Calculate expected new total
          const oldItemTotal = firstProduit.prix_vente * firstProduit.quantite
          const expectedTotal = initialTotal - oldItemTotal + newMontantLigne
          
          // Property: montant_total should be updated correctly
          expect(updatedTotal).toBe(expectedTotal)
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 20 }
    )
  })
})

// ============================================================================
// PROPERTY 8: Annulation de commande non soumise
// Validates: Requirement 9.5
// ============================================================================

describe('Property 8: Annulation de commande non soumise', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  beforeEach(async () => {
    const pool = await getTestPool()
    await cleanup(pool)
  })

  it('should allow deletion of commandes with statut en_attente', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.array(produitArbitrary, { minLength: 1, maxLength: 5 }),
        async (produits) => {
          // Setup
          const userId = await createTestUser(pool, 'serveuse')
          const tableId = await createTestTable(pool)
          
          // Create produits
          const produitsWithIds = []
          for (const produitData of produits) {
            const produit = await createTestProduit(pool, produitData)
            produitsWithIds.push(produit)
          }
          
          // Create commande
          const commandeResult = await pool.query(`
            INSERT INTO commandes (table_id, serveuse_id, statut, montant_total)
            VALUES ($1, $2, $3, $4)
            RETURNING id
          `, [tableId, userId, 'en_attente', 0])
          
          const commandeId = commandeResult.rows[0].id
          
          // Add items
          for (const produit of produitsWithIds) {
            await pool.query(`
              INSERT INTO commande_items (commande_id, produit_id, nom_produit, 
                                         prix_unitaire, quantite, montant_ligne)
              VALUES ($1, $2, $3, $4, $5, $6)
            `, [commandeId, produit.id, produit.nom, produit.prix_vente, 
                2, produit.prix_vente * 2])
          }
          
          // Property: Should be able to delete commande with en_attente status
          await pool.query('DELETE FROM commandes WHERE id = $1', [commandeId])
          
          // Verify commande is deleted
          const checkCommande = await pool.query(`
            SELECT id FROM commandes WHERE id = $1
          `, [commandeId])
          expect(checkCommande.rows).toHaveLength(0)
          
          // Property: Items should also be deleted (CASCADE)
          const checkItems = await pool.query(`
            SELECT id FROM commande_items WHERE commande_id = $1
          `, [commandeId])
          expect(checkItems.rows).toHaveLength(0)
          
          // Property: No stock movements should have been created
          const checkMovements = await pool.query(`
            SELECT id FROM mouvements_stock WHERE reference = $1
          `, [commandeId])
          expect(checkMovements.rows).toHaveLength(0)
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should prevent deletion of validated commandes', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        produitArbitrary,
        async (produitData) => {
          // Setup
          const userId = await createTestUser(pool, 'serveuse')
          const tableId = await createTestTable(pool)
          const produit = await createTestProduit(pool, produitData)
          
          // Create and validate commande
          const commandeResult = await pool.query(`
            INSERT INTO commandes (table_id, serveuse_id, statut, montant_total, 
                                  date_validation, validateur_id)
            VALUES ($1, $2, $3, $4, NOW(), $5)
            RETURNING id
          `, [tableId, userId, 'validee', produit.prix_vente * 2, userId])
          
          const commandeId = commandeResult.rows[0].id
          
          // Add item
          await pool.query(`
            INSERT INTO commande_items (commande_id, produit_id, nom_produit, 
                                       prix_unitaire, quantite, montant_ligne)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [commandeId, produit.id, produit.nom, produit.prix_vente, 
              2, produit.prix_vente * 2])
          
          // Property: Should NOT be able to delete validated commande
          // This is enforced by RLS policy
          const deleteResult = await pool.query(`
            DELETE FROM commandes WHERE id = $1 AND statut = 'validee'
          `, [commandeId])
          
          // Verify commande still exists
          const checkCommande = await pool.query(`
            SELECT id, statut FROM commandes WHERE id = $1
          `, [commandeId])
          
          expect(checkCommande.rows).toHaveLength(1)
          expect(checkCommande.rows[0].statut).toBe('validee')
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 15 }
    )
  })
})
