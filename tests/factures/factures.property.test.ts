import { describe, it, expect, beforeEach } from 'vitest'
import { getTestPool, skipIfNoDB } from '../setup'
import * as fc from 'fast-check'

/**
 * Property-Based Tests for Factures
 * 
 * Tests Properties:
 * - Property 47: Génération automatique de facture (Requirement 13.1)
 * - Property 48: Unicité des numéros de facture (Requirement 13.1)
 * - Property 49: Complétude des données de facture (Requirement 13.2)
 * - Property 57: Cohérence facture-commande (invariant)
 */

// ============================================================================
// ARBITRARIES (Generators)
// ============================================================================

const uuidArbitrary = fc.uuid()

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

async function createTestCommande(pool: any, userId: string, tableId: string, produits: any[]) {
  // Create commande
  const commandeResult = await pool.query(`
    INSERT INTO commandes (table_id, serveuse_id, statut, montant_total)
    VALUES ($1, $2, $3, $4)
    RETURNING id, numero_commande
  `, [tableId, userId, 'en_attente', 0])
  
  const commandeId = commandeResult.rows[0].id
  
  // Add items
  let totalMontant = 0
  for (const produit of produits) {
    const montantLigne = produit.prix_vente * produit.quantite
    totalMontant += montantLigne
    
    await pool.query(`
      INSERT INTO commande_items (commande_id, produit_id, nom_produit, 
                                 prix_unitaire, quantite, montant_ligne)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [commandeId, produit.id, produit.nom, produit.prix_vente, 
        produit.quantite, montantLigne])
  }
  
  return { id: commandeId, numero_commande: commandeResult.rows[0].numero_commande, montant_total: totalMontant }
}

async function cleanup(pool: any) {
  await pool.query('DELETE FROM encaissements WHERE TRUE')
  await pool.query('DELETE FROM factures WHERE TRUE')
  await pool.query('DELETE FROM commande_items WHERE TRUE')
  await pool.query('DELETE FROM commandes WHERE TRUE')
  await pool.query('DELETE FROM mouvements_stock WHERE TRUE')
  await pool.query('DELETE FROM stock WHERE TRUE')
  await pool.query('DELETE FROM produits WHERE TRUE')
  await pool.query('DELETE FROM tables WHERE TRUE')
  await pool.query('DELETE FROM profiles WHERE TRUE')
}

// ============================================================================
// PROPERTY 47: Génération automatique de facture
// Validates: Requirement 13.1
// ============================================================================

describe('Property 47: Génération automatique de facture', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  beforeEach(async () => {
    const pool = await getTestPool()
    await cleanup(pool)
  })

  it('should automatically generate a facture when commande is validated', async () => {
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
          const userId = await createTestUser(pool, 'serveuse')
          const validateurId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          
          // Create produits
          const produitsWithIds = []
          for (const item of items) {
            const produit = await createTestProduit(pool, item.produit)
            produitsWithIds.push({ ...produit, quantite: item.quantite })
          }
          
          // Create commande
          const commande = await createTestCommande(pool, userId, tableId, produitsWithIds)
          
          // Verify no facture exists yet
          const beforeValidation = await pool.query(`
            SELECT id FROM factures WHERE commande_id = $1
          `, [commande.id])
          expect(beforeValidation.rows).toHaveLength(0)
          
          // Validate commande
          await pool.query(`
            UPDATE commandes 
            SET statut = 'validee', date_validation = NOW(), validateur_id = $1
            WHERE id = $2
          `, [validateurId, commande.id])
          
          // Property: Facture should be automatically generated
          const afterValidation = await pool.query(`
            SELECT * FROM factures WHERE commande_id = $1
          `, [commande.id])
          
          expect(afterValidation.rows).toHaveLength(1)
          
          const facture = afterValidation.rows[0]
          
          // Property: Facture should have correct initial values
          expect(facture.numero_facture).toBeDefined()
          expect(facture.numero_facture).toMatch(/^FACT-\d{8}-\d{3}$/)
          expect(facture.montant_total).toBe(commande.montant_total)
          expect(facture.montant_paye).toBe(0)
          expect(facture.montant_restant).toBe(commande.montant_total)
          expect(facture.statut).toBe('en_attente_paiement')
          expect(facture.date_generation).toBeDefined()
          expect(facture.date_paiement_complet).toBeNull()
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 25 }
    )
  })

  it('should not generate facture for non-validated commandes', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          produit: produitArbitrary,
          quantite: quantiteArbitrary
        }),
        async (item) => {
          // Setup
          const userId = await createTestUser(pool, 'serveuse')
          const tableId = await createTestTable(pool)
          const produit = await createTestProduit(pool, item.produit)
          
          // Create commande (en_attente)
          const commande = await createTestCommande(pool, userId, tableId, [
            { ...produit, quantite: item.quantite }
          ])
          
          // Property: No facture should exist for en_attente commande
          const result = await pool.query(`
            SELECT id FROM factures WHERE commande_id = $1
          `, [commande.id])
          
          expect(result.rows).toHaveLength(0)
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should not generate duplicate factures for already validated commandes', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          produit: produitArbitrary,
          quantite: quantiteArbitrary
        }),
        async (item) => {
          // Setup
          const userId = await createTestUser(pool, 'serveuse')
          const validateurId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          const produit = await createTestProduit(pool, item.produit)
          
          // Create and validate commande
          const commande = await createTestCommande(pool, userId, tableId, [
            { ...produit, quantite: item.quantite }
          ])
          
          await pool.query(`
            UPDATE commandes 
            SET statut = 'validee', date_validation = NOW(), validateur_id = $1
            WHERE id = $2
          `, [validateurId, commande.id])
          
          // Try to update again (should not create duplicate facture)
          await pool.query(`
            UPDATE commandes 
            SET validateur_id = $1
            WHERE id = $2
          `, [validateurId, commande.id])
          
          // Property: Should still have only one facture
          const result = await pool.query(`
            SELECT id FROM factures WHERE commande_id = $1
          `, [commande.id])
          
          expect(result.rows).toHaveLength(1)
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 15 }
    )
  })
})

// ============================================================================
// PROPERTY 48: Unicité des numéros de facture
// Validates: Requirement 13.1
// ============================================================================

describe('Property 48: Unicité des numéros de facture', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  beforeEach(async () => {
    const pool = await getTestPool()
    await cleanup(pool)
  })

  it('should generate unique facture numbers for multiple factures', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 10 }),
        async (numFactures) => {
          // Setup
          const userId = await createTestUser(pool, 'serveuse')
          const validateurId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          const produit = await createTestProduit(pool, {
            nom: `Produit-${Date.now()}`,
            categorie: 'boisson',
            prix_vente: 1000,
            seuil_stock_minimum: 5,
            actif: true
          })
          
          const factureNumeros: string[] = []
          
          // Create multiple validated commandes (which generate factures)
          for (let i = 0; i < numFactures; i++) {
            const commande = await createTestCommande(pool, userId, tableId, [
              { ...produit, quantite: 2 }
            ])
            
            await pool.query(`
              UPDATE commandes 
              SET statut = 'validee', date_validation = NOW(), validateur_id = $1
              WHERE id = $2
            `, [validateurId, commande.id])
            
            const factureResult = await pool.query(`
              SELECT numero_facture FROM factures WHERE commande_id = $1
            `, [commande.id])
            
            factureNumeros.push(factureResult.rows[0].numero_facture)
          }
          
          // Property: All facture numbers should be unique
          const uniqueNumeros = new Set(factureNumeros)
          expect(uniqueNumeros.size).toBe(factureNumeros.length)
          
          // Property: All facture IDs should be unique
          const allFactures = await pool.query(`
            SELECT id FROM factures
          `)
          
          const uniqueIds = new Set(allFactures.rows.map((r: any) => r.id))
          expect(uniqueIds.size).toBe(numFactures)
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should never reuse facture numbers', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }),
        async (numCycles) => {
          // Setup
          const userId = await createTestUser(pool, 'serveuse')
          const validateurId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          const produit = await createTestProduit(pool, {
            nom: `Produit-${Date.now()}`,
            categorie: 'boisson',
            prix_vente: 1000,
            seuil_stock_minimum: 5,
            actif: true
          })
          
          const allNumeros: string[] = []
          
          // Create factures multiple times
          for (let cycle = 0; cycle < numCycles; cycle++) {
            const commande = await createTestCommande(pool, userId, tableId, [
              { ...produit, quantite: 2 }
            ])
            
            await pool.query(`
              UPDATE commandes 
              SET statut = 'validee', date_validation = NOW(), validateur_id = $1
              WHERE id = $2
            `, [validateurId, commande.id])
            
            const factureResult = await pool.query(`
              SELECT numero_facture FROM factures WHERE commande_id = $1
            `, [commande.id])
            
            allNumeros.push(factureResult.rows[0].numero_facture)
          }
          
          // Property: All numbers should be unique (no reuse)
          const uniqueNumeros = new Set(allNumeros)
          expect(uniqueNumeros.size).toBe(allNumeros.length)
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 15 }
    )
  })
})

// ============================================================================
// PROPERTY 49: Complétude des données de facture
// Validates: Requirement 13.2
// ============================================================================

describe('Property 49: Complétude des données de facture', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  beforeEach(async () => {
    const pool = await getTestPool()
    await cleanup(pool)
  })

  it('should record all required fields when generating a facture', async () => {
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
          const userId = await createTestUser(pool, 'serveuse')
          const validateurId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          
          // Create produits
          const produitsWithIds = []
          for (const item of items) {
            const produit = await createTestProduit(pool, item.produit)
            produitsWithIds.push({ ...produit, quantite: item.quantite })
          }
          
          // Create and validate commande
          const commande = await createTestCommande(pool, userId, tableId, produitsWithIds)
          
          await pool.query(`
            UPDATE commandes 
            SET statut = 'validee', date_validation = NOW(), validateur_id = $1
            WHERE id = $2
          `, [validateurId, commande.id])
          
          // Get generated facture
          const factureResult = await pool.query(`
            SELECT * FROM factures WHERE commande_id = $1
          `, [commande.id])
          
          expect(factureResult.rows).toHaveLength(1)
          const facture = factureResult.rows[0]
          
          // Property: All required fields should be present and not null
          expect(facture.id).toBeDefined()
          expect(facture.id).not.toBeNull()
          
          expect(facture.numero_facture).toBeDefined()
          expect(facture.numero_facture).not.toBeNull()
          expect(facture.numero_facture).toMatch(/^FACT-\d{8}-\d{3}$/)
          
          expect(facture.commande_id).toBe(commande.id)
          expect(facture.commande_id).not.toBeNull()
          
          expect(facture.montant_total).toBeDefined()
          expect(facture.montant_total).not.toBeNull()
          expect(facture.montant_total).toBeGreaterThan(0)
          
          expect(facture.montant_paye).toBeDefined()
          expect(facture.montant_paye).not.toBeNull()
          expect(facture.montant_paye).toBeGreaterThanOrEqual(0)
          
          expect(facture.montant_restant).toBeDefined()
          expect(facture.montant_restant).not.toBeNull()
          expect(facture.montant_restant).toBeGreaterThanOrEqual(0)
          
          expect(facture.statut).toBeDefined()
          expect(facture.statut).not.toBeNull()
          expect(['en_attente_paiement', 'partiellement_payee', 'payee']).toContain(facture.statut)
          
          expect(facture.date_generation).toBeDefined()
          expect(facture.date_generation).not.toBeNull()
          
          // Property: Reference to commande should be valid
          const commandeCheck = await pool.query(`
            SELECT id FROM commandes WHERE id = $1
          `, [facture.commande_id])
          
          expect(commandeCheck.rows).toHaveLength(1)
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 25 }
    )
  })

  it('should reject factures with missing required fields', async () => {
    const pool = await getTestPool()
    
    // Test missing commande_id
    await expect(
      pool.query(`
        INSERT INTO factures (montant_total, montant_paye, montant_restant, statut)
        VALUES ($1, $2, $3, $4)
      `, [1000, 0, 1000, 'en_attente_paiement'])
    ).rejects.toThrow()
    
    // Test missing montant_total
    await expect(
      pool.query(`
        INSERT INTO factures (commande_id, montant_paye, montant_restant, statut)
        VALUES ($1, $2, $3, $4)
      `, ['00000000-0000-0000-0000-000000000001', 0, 1000, 'en_attente_paiement'])
    ).rejects.toThrow()
  })
})

// ============================================================================
// PROPERTY 57: Cohérence facture-commande (invariant)
// Validates: Data consistency
// ============================================================================

describe('Property 57: Cohérence facture-commande (invariant)', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  beforeEach(async () => {
    const pool = await getTestPool()
    await cleanup(pool)
  })

  it('should maintain facture montant_total equal to commande montant_total', async () => {
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
          const validateurId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          
          // Create produits
          const produitsWithIds = []
          for (const item of items) {
            const produit = await createTestProduit(pool, item.produit)
            produitsWithIds.push({ ...produit, quantite: item.quantite })
          }
          
          // Create and validate commande
          const commande = await createTestCommande(pool, userId, tableId, produitsWithIds)
          
          await pool.query(`
            UPDATE commandes 
            SET statut = 'validee', date_validation = NOW(), validateur_id = $1
            WHERE id = $2
          `, [validateurId, commande.id])
          
          // Get commande and facture
          const commandeResult = await pool.query(`
            SELECT montant_total FROM commandes WHERE id = $1
          `, [commande.id])
          
          const factureResult = await pool.query(`
            SELECT montant_total FROM factures WHERE commande_id = $1
          `, [commande.id])
          
          const commandeMontant = commandeResult.rows[0].montant_total
          const factureMontant = factureResult.rows[0].montant_total
          
          // Property: Facture montant_total should equal commande montant_total
          expect(factureMontant).toBe(commandeMontant)
          
          // Property: Both should equal sum of commande items
          const itemsResult = await pool.query(`
            SELECT SUM(montant_ligne) as total FROM commande_items WHERE commande_id = $1
          `, [commande.id])
          
          const itemsTotal = parseInt(itemsResult.rows[0].total)
          expect(commandeMontant).toBe(itemsTotal)
          expect(factureMontant).toBe(itemsTotal)
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 30 }
    )
  })

  it('should maintain consistency even with complex commandes', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            produit: produitArbitrary,
            quantite: quantiteArbitrary
          }),
          { minLength: 5, maxLength: 15 }
        ),
        async (items) => {
          // Setup
          const userId = await createTestUser(pool, 'serveuse')
          const validateurId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          
          // Create produits
          const produitsWithIds = []
          for (const item of items) {
            const produit = await createTestProduit(pool, item.produit)
            produitsWithIds.push({ ...produit, quantite: item.quantite })
          }
          
          // Create and validate commande
          const commande = await createTestCommande(pool, userId, tableId, produitsWithIds)
          
          await pool.query(`
            UPDATE commandes 
            SET statut = 'validee', date_validation = NOW(), validateur_id = $1
            WHERE id = $2
          `, [validateurId, commande.id])
          
          // Calculate expected total manually
          let expectedTotal = 0
          for (const produit of produitsWithIds) {
            expectedTotal += produit.prix_vente * produit.quantite
          }
          
          // Get facture
          const factureResult = await pool.query(`
            SELECT montant_total, montant_paye, montant_restant FROM factures WHERE commande_id = $1
          `, [commande.id])
          
          const facture = factureResult.rows[0]
          
          // Property: Facture montant_total should match expected total
          expect(facture.montant_total).toBe(expectedTotal)
          
          // Property: Initial state should be correct
          expect(facture.montant_paye).toBe(0)
          expect(facture.montant_restant).toBe(expectedTotal)
          
          // Property: montant_restant = montant_total - montant_paye
          expect(facture.montant_restant).toBe(facture.montant_total - facture.montant_paye)
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 25 }
    )
  })

  it('should maintain one-to-one relationship between commande and facture', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          produit: produitArbitrary,
          quantite: quantiteArbitrary
        }),
        async (item) => {
          // Setup
          const userId = await createTestUser(pool, 'serveuse')
          const validateurId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          const produit = await createTestProduit(pool, item.produit)
          
          // Create and validate commande
          const commande = await createTestCommande(pool, userId, tableId, [
            { ...produit, quantite: item.quantite }
          ])
          
          await pool.query(`
            UPDATE commandes 
            SET statut = 'validee', date_validation = NOW(), validateur_id = $1
            WHERE id = $2
          `, [validateurId, commande.id])
          
          // Property: Should have exactly one facture for the commande
          const factureResult = await pool.query(`
            SELECT id FROM factures WHERE commande_id = $1
          `, [commande.id])
          
          expect(factureResult.rows).toHaveLength(1)
          
          // Property: Facture should reference the correct commande
          const factureCheck = await pool.query(`
            SELECT commande_id FROM factures WHERE id = $1
          `, [factureResult.rows[0].id])
          
          expect(factureCheck.rows[0].commande_id).toBe(commande.id)
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 20 }
    )
  })
})


// ============================================================================
// PROPERTY 56: Génération d'alerte pour factures impayées
// Validates: Requirement 15.5
// ============================================================================

describe('Property 56: Génération d\'alerte pour factures impayées', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  beforeEach(async () => {
    const pool = await getTestPool()
    await cleanup(pool)
  })

  it('should generate alerts for factures unpaid for more than 24 hours', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 25, max: 72 }), // Hours overdue (> 24h)
        async (numFactures, hoursOverdue) => {
          // Setup
          const userId = await createTestUser(pool, 'serveuse')
          const validateurId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          const produit = await createTestProduit(pool, {
            nom: `Produit-${Date.now()}`,
            categorie: 'boisson',
            prix_vente: 1000,
            seuil_stock_minimum: 5,
            actif: true
          })
          
          const factureIds: string[] = []
          
          // Create multiple overdue factures
          for (let i = 0; i < numFactures; i++) {
            const commande = await createTestCommande(pool, userId, tableId, [
              { ...produit, quantite: 2 }
            ])
            
            // Validate commande to generate facture
            await pool.query(`
              UPDATE commandes 
              SET statut = 'validee', date_validation = NOW()
              WHERE id = $1
            `, [commande.id])
            
            // Get the generated facture
            const factureResult = await pool.query(`
              SELECT id FROM factures WHERE commande_id = $1
            `, [commande.id])
            
            const factureId = factureResult.rows[0].id
            factureIds.push(factureId)
            
            // Backdate the facture to make it overdue
            await pool.query(`
              UPDATE factures 
              SET date_generation = NOW() - INTERVAL '1 hour' * $1
              WHERE id = $2
            `, [hoursOverdue, factureId])
          }
          
          // Property: get_factures_impayees_alerts() should return all overdue factures
          const alertsResult = await pool.query(`
            SELECT * FROM get_factures_impayees_alerts()
          `)
          
          expect(alertsResult.rows.length).toBe(numFactures)
          
          // Property: All returned factures should be in our list
          const returnedIds = alertsResult.rows.map((r: any) => r.id)
          for (const factureId of factureIds) {
            expect(returnedIds).toContain(factureId)
          }
          
          // Property: All factures should have age > 24 hours
          for (const row of alertsResult.rows) {
            expect(parseFloat(row.age_heures)).toBeGreaterThan(24)
            expect(row.statut).not.toBe('payee')
          }
          
          // Property: factures_overdue view should return the same factures
          const viewResult = await pool.query(`
            SELECT * FROM factures_overdue
          `)
          
          expect(viewResult.rows.length).toBe(numFactures)
          
          // Property: View should include severity level
          for (const row of viewResult.rows) {
            expect(row.niveau_alerte).toBeDefined()
            expect(['faible', 'moyen', 'eleve', 'critique']).toContain(row.niveau_alerte)
            
            // Verify severity level is correct based on age
            const ageHeures = parseFloat(row.age_heures)
            if (ageHeures > 168) {
              expect(row.niveau_alerte).toBe('critique')
            } else if (ageHeures > 72) {
              expect(row.niveau_alerte).toBe('eleve')
            } else if (ageHeures > 24) {
              expect(row.niveau_alerte).toBe('moyen')
            }
          }
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should not generate alerts for factures less than 24 hours old', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 23 }), // Hours (< 24h)
        async (hoursOld) => {
          // Setup
          const userId = await createTestUser(pool, 'serveuse')
          const validateurId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          const produit = await createTestProduit(pool, {
            nom: `Produit-${Date.now()}`,
            categorie: 'boisson',
            prix_vente: 1000,
            seuil_stock_minimum: 5,
            actif: true
          })
          
          // Create commande and validate to generate facture
          const commande = await createTestCommande(pool, userId, tableId, [
            { ...produit, quantite: 2 }
          ])
          
          await pool.query(`
            UPDATE commandes 
            SET statut = 'validee', date_validation = NOW()
            WHERE id = $1
          `, [commande.id])
          
          // Get the generated facture
          const factureResult = await pool.query(`
            SELECT id FROM factures WHERE commande_id = $1
          `, [commande.id])
          
          const factureId = factureResult.rows[0].id
          
          // Backdate the facture but keep it under 24 hours
          await pool.query(`
            UPDATE factures 
            SET date_generation = NOW() - INTERVAL '1 hour' * $1
            WHERE id = $2
          `, [hoursOld, factureId])
          
          // Property: get_factures_impayees_alerts() should NOT return this facture
          const alertsResult = await pool.query(`
            SELECT * FROM get_factures_impayees_alerts()
          `)
          
          const returnedIds = alertsResult.rows.map((r: any) => r.id)
          expect(returnedIds).not.toContain(factureId)
          
          // Property: factures_overdue view should NOT return this facture
          const viewResult = await pool.query(`
            SELECT * FROM factures_overdue WHERE id = $1
          `, [factureId])
          
          expect(viewResult.rows).toHaveLength(0)
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 15 }
    )
  })

  it('should not generate alerts for paid factures regardless of age', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 25, max: 168 }), // Hours overdue (> 24h)
        async (hoursOverdue) => {
          // Setup
          const userId = await createTestUser(pool, 'serveuse')
          const validateurId = await createTestUser(pool, 'comptoir')
          const comptoirId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          const produit = await createTestProduit(pool, {
            nom: `Produit-${Date.now()}`,
            categorie: 'boisson',
            prix_vente: 1000,
            seuil_stock_minimum: 5,
            actif: true
          })
          
          // Create commande and validate to generate facture
          const commande = await createTestCommande(pool, userId, tableId, [
            { ...produit, quantite: 2 }
          ])
          
          await pool.query(`
            UPDATE commandes 
            SET statut = 'validee', date_validation = NOW()
            WHERE id = $1
          `, [commande.id])
          
          // Get the generated facture
          const factureResult = await pool.query(`
            SELECT id, montant_total FROM factures WHERE commande_id = $1
          `, [commande.id])
          
          const facture = factureResult.rows[0]
          
          // Backdate the facture to make it old
          await pool.query(`
            UPDATE factures 
            SET date_generation = NOW() - INTERVAL '1 hour' * $1
            WHERE id = $2
          `, [hoursOverdue, facture.id])
          
          // Pay the facture completely
          await pool.query(`
            INSERT INTO encaissements (facture_id, montant, mode_paiement, utilisateur_id)
            VALUES ($1, $2, $3, $4)
          `, [facture.id, facture.montant_total, 'especes', comptoirId])
          
          // Verify facture is marked as paid
          const paidCheck = await pool.query(`
            SELECT statut FROM factures WHERE id = $1
          `, [facture.id])
          
          expect(paidCheck.rows[0].statut).toBe('payee')
          
          // Property: get_factures_impayees_alerts() should NOT return paid facture
          const alertsResult = await pool.query(`
            SELECT * FROM get_factures_impayees_alerts()
          `)
          
          const returnedIds = alertsResult.rows.map((r: any) => r.id)
          expect(returnedIds).not.toContain(facture.id)
          
          // Property: factures_overdue view should NOT return paid facture
          const viewResult = await pool.query(`
            SELECT * FROM factures_overdue WHERE id = $1
          `, [facture.id])
          
          expect(viewResult.rows).toHaveLength(0)
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 15 }
    )
  })

  it('should include partially paid factures in alerts if overdue', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 25, max: 72 }), // Hours overdue
        fc.integer({ min: 10, max: 90 }), // Percentage paid (not 100%)
        async (hoursOverdue, percentagePaid) => {
          // Setup
          const userId = await createTestUser(pool, 'serveuse')
          const validateurId = await createTestUser(pool, 'comptoir')
          const comptoirId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          const produit = await createTestProduit(pool, {
            nom: `Produit-${Date.now()}`,
            categorie: 'boisson',
            prix_vente: 1000,
            seuil_stock_minimum: 5,
            actif: true
          })
          
          // Create commande and validate to generate facture
          const commande = await createTestCommande(pool, userId, tableId, [
            { ...produit, quantite: 5 }
          ])
          
          await pool.query(`
            UPDATE commandes 
            SET statut = 'validee', date_validation = NOW()
            WHERE id = $1
          `, [commande.id])
          
          // Get the generated facture
          const factureResult = await pool.query(`
            SELECT id, montant_total FROM factures WHERE commande_id = $1
          `, [commande.id])
          
          const facture = factureResult.rows[0]
          
          // Backdate the facture
          await pool.query(`
            UPDATE factures 
            SET date_generation = NOW() - INTERVAL '1 hour' * $1
            WHERE id = $2
          `, [hoursOverdue, facture.id])
          
          // Make partial payment
          const partialAmount = Math.floor(facture.montant_total * percentagePaid / 100)
          await pool.query(`
            INSERT INTO encaissements (facture_id, montant, mode_paiement, utilisateur_id)
            VALUES ($1, $2, $3, $4)
          `, [facture.id, partialAmount, 'especes', comptoirId])
          
          // Verify facture is partially paid
          const statusCheck = await pool.query(`
            SELECT statut FROM factures WHERE id = $1
          `, [facture.id])
          
          expect(statusCheck.rows[0].statut).toBe('partiellement_payee')
          
          // Property: get_factures_impayees_alerts() SHOULD return partially paid facture
          const alertsResult = await pool.query(`
            SELECT * FROM get_factures_impayees_alerts()
          `)
          
          const returnedIds = alertsResult.rows.map((r: any) => r.id)
          expect(returnedIds).toContain(facture.id)
          
          // Property: factures_overdue view SHOULD return partially paid facture
          const viewResult = await pool.query(`
            SELECT * FROM factures_overdue WHERE id = $1
          `, [facture.id])
          
          expect(viewResult.rows).toHaveLength(1)
          expect(viewResult.rows[0].statut).toBe('partiellement_payee')
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 15 }
    )
  })

  it('should order alerts by date_generation (oldest first)', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.integer({ min: 25, max: 168 }),
          { minLength: 3, maxLength: 8 }
        ),
        async (hoursOverdueArray) => {
          // Setup
          const userId = await createTestUser(pool, 'serveuse')
          const validateurId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          const produit = await createTestProduit(pool, {
            nom: `Produit-${Date.now()}`,
            categorie: 'boisson',
            prix_vente: 1000,
            seuil_stock_minimum: 5,
            actif: true
          })
          
          const facturesWithAge: Array<{ id: string; hoursOverdue: number }> = []
          
          // Create multiple factures with different ages
          for (const hoursOverdue of hoursOverdueArray) {
            const commande = await createTestCommande(pool, userId, tableId, [
              { ...produit, quantite: 2 }
            ])
            
            await pool.query(`
              UPDATE commandes 
              SET statut = 'validee', date_validation = NOW()
              WHERE id = $1
            `, [commande.id])
            
            const factureResult = await pool.query(`
              SELECT id FROM factures WHERE commande_id = $1
            `, [commande.id])
            
            const factureId = factureResult.rows[0].id
            
            // Backdate the facture
            await pool.query(`
              UPDATE factures 
              SET date_generation = NOW() - INTERVAL '1 hour' * $1
              WHERE id = $2
            `, [hoursOverdue, factureId])
            
            facturesWithAge.push({ id: factureId, hoursOverdue })
          }
          
          // Property: Alerts should be ordered by date_generation (oldest first = highest hoursOverdue first)
          const alertsResult = await pool.query(`
            SELECT id, age_heures FROM get_factures_impayees_alerts()
          `)
          
          // Verify ordering: each facture should have age >= next facture
          for (let i = 0; i < alertsResult.rows.length - 1; i++) {
            const currentAge = parseFloat(alertsResult.rows[i].age_heures)
            const nextAge = parseFloat(alertsResult.rows[i + 1].age_heures)
            expect(currentAge).toBeGreaterThanOrEqual(nextAge)
          }
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 15 }
    )
  })
})
