import { describe, it, expect, beforeEach } from 'vitest'
import { getTestPool, skipIfNoDB } from '../setup'
import * as fc from 'fast-check'

/**
 * Property-Based Tests for Analytics Functions
 * 
 * Tests Properties:
 * - Property 16: Calcul du chiffre d'affaires (Requirement 5.1)
 * - Property 17: Calcul du bénéfice (Requirement 5.2)
 * - Property 18: Filtrage des analyses par période (Requirement 5.3)
 * - Property 19: Agrégation des ventes par produit (Requirement 5.4)
 * - Property 20: Comptage des commandes par période (Requirement 5.5)
 * - Property 31: Recherche de transactions (Requirement 8.5)
 */

// ============================================================================
// ARBITRARIES (Generators)
// ============================================================================

const prixArbitrary = fc.integer({ min: 100, max: 10000 })
  .map(n => Math.round(n / 25) * 25) // Multiples of 25 FCFA

const coutArbitrary = fc.integer({ min: 50, max: 5000 })
  .map(n => Math.round(n / 25) * 25) // Multiples of 25 FCFA

const quantiteArbitrary = fc.integer({ min: 1, max: 20 })

const categorieArbitrary = fc.constantFrom('boisson', 'nourriture', 'autre')

const produitArbitrary = fc.record({
  nom: fc.string({ minLength: 3, maxLength: 50 }),
  categorie: categorieArbitrary,
  prix_vente: prixArbitrary,
  cout_unitaire: coutArbitrary,
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
    INSERT INTO profiles (id, nom, prenom, role, actif)
    VALUES ($1, $2, $3, $4, $5)
  `, [userId, 'Test', 'User', role, true])
  
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
  
  return { ...result.rows[0], cout_unitaire: produitData.cout_unitaire }
}

async function createRavitaillement(pool: any, produitId: string, quantite: number, coutUnitaire: number, userId: string) {
  // Create ravitaillement
  const ravResult = await pool.query(`
    INSERT INTO ravitaillements (fournisseur, date_ravitaillement, montant_total, gerant_id)
    VALUES ($1, $2, $3, $4)
    RETURNING id
  `, ['Fournisseur Test', new Date(), quantite * coutUnitaire, userId])
  
  const ravId = ravResult.rows[0].id
  
  // Add item
  await pool.query(`
    INSERT INTO ravitaillement_items (ravitaillement_id, produit_id, quantite, cout_unitaire, montant_ligne)
    VALUES ($1, $2, $3, $4, $5)
  `, [ravId, produitId, quantite, coutUnitaire, quantite * coutUnitaire])
  
  // Create mouvement stock
  await pool.query(`
    INSERT INTO mouvements_stock (produit_id, type, quantite, cout_unitaire, reference, type_reference, utilisateur_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [produitId, 'entree', quantite, coutUnitaire, ravId, 'ravitaillement', userId])
  
  return ravId
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

async function validateCommande(pool: any, commandeId: string, validateurId: string) {
  await pool.query(`
    UPDATE commandes 
    SET statut = 'validee', date_validation = NOW(), validateur_id = $1
    WHERE id = $2
  `, [validateurId, commandeId])
  
  // Create mouvements stock for validated commande
  const items = await pool.query(`
    SELECT produit_id, quantite FROM commande_items WHERE commande_id = $1
  `, [commandeId])
  
  for (const item of items.rows) {
    await pool.query(`
      INSERT INTO mouvements_stock (produit_id, type, quantite, reference, type_reference, utilisateur_id)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [item.produit_id, 'sortie', item.quantite, commandeId, 'commande', validateurId])
  }
}

async function cleanup(pool: any) {
  await pool.query('DELETE FROM encaissements WHERE TRUE')
  await pool.query('DELETE FROM factures WHERE TRUE')
  await pool.query('DELETE FROM commande_items WHERE TRUE')
  await pool.query('DELETE FROM commandes WHERE TRUE')
  await pool.query('DELETE FROM ravitaillement_items WHERE TRUE')
  await pool.query('DELETE FROM ravitaillements WHERE TRUE')
  await pool.query('DELETE FROM mouvements_stock WHERE TRUE')
  await pool.query('DELETE FROM stock WHERE TRUE')
  await pool.query('DELETE FROM produits WHERE TRUE')
  await pool.query('DELETE FROM tables WHERE TRUE')
  await pool.query('DELETE FROM profiles WHERE TRUE')
}

// ============================================================================
// PROPERTY 16: Calcul du chiffre d'affaires
// **Validates: Requirements 5.1**
// ============================================================================

describe('Property 16: Calcul du chiffre d\'affaires', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  beforeEach(async () => {
    const pool = await getTestPool()
    await cleanup(pool)
  })

  it('should correctly calculate CA as sum of all validated commandes', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            produit: produitArbitrary,
            quantite: quantiteArbitrary
          }),
          { minLength: 2, maxLength: 10 }
        ),
        async (items) => {
          // Setup
          const serveuseId = await createTestUser(pool, 'serveuse')
          const comptoirId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          
          let expectedCA = 0
          
          // Create and validate commandes
          for (const item of items) {
            const produit = await createTestProduit(pool, item.produit)
            const commande = await createTestCommande(pool, serveuseId, tableId, [
              { ...produit, quantite: item.quantite }
            ])
            
            await validateCommande(pool, commande.id, comptoirId)
            expectedCA += commande.montant_total
          }
          
          // Query analytics_kpis view
          const result = await pool.query('SELECT chiffre_affaires FROM analytics_kpis')
          const ca = parseInt(result.rows[0].chiffre_affaires)
          
          // Property: CA should equal sum of all validated commandes
          expect(ca).toBe(expectedCA)
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should not include non-validated commandes in CA calculation', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }),
        fc.integer({ min: 2, max: 5 }),
        async (numValidated, numPending) => {
          // Setup
          const serveuseId = await createTestUser(pool, 'serveuse')
          const comptoirId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          const produit = await createTestProduit(pool, {
            nom: `Produit-${Date.now()}`,
            categorie: 'boisson',
            prix_vente: 1000,
            cout_unitaire: 500,
            seuil_stock_minimum: 5,
            actif: true
          })
          
          let expectedCA = 0
          
          // Create validated commandes
          for (let i = 0; i < numValidated; i++) {
            const commande = await createTestCommande(pool, serveuseId, tableId, [
              { ...produit, quantite: 2 }
            ])
            await validateCommande(pool, commande.id, comptoirId)
            expectedCA += commande.montant_total
          }
          
          // Create pending commandes (should not be counted)
          for (let i = 0; i < numPending; i++) {
            await createTestCommande(pool, serveuseId, tableId, [
              { ...produit, quantite: 2 }
            ])
          }
          
          // Query CA
          const result = await pool.query('SELECT chiffre_affaires FROM analytics_kpis')
          const ca = parseInt(result.rows[0].chiffre_affaires)
          
          // Property: Only validated commandes should be counted
          expect(ca).toBe(expectedCA)
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 15 }
    )
  })
})

// ============================================================================
// PROPERTY 17: Calcul du bénéfice
// **Validates: Requirements 5.2**
// ============================================================================

describe('Property 17: Calcul du bénéfice', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  beforeEach(async () => {
    const pool = await getTestPool()
    await cleanup(pool)
  })

  it('should correctly calculate benefice as CA minus costs', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            produit: produitArbitrary,
            quantite: quantiteArbitrary
          }),
          { minLength: 2, maxLength: 8 }
        ),
        async (items) => {
          // Setup
          const serveuseId = await createTestUser(pool, 'serveuse')
          const comptoirId = await createTestUser(pool, 'comptoir')
          const gerantId = await createTestUser(pool, 'gerant')
          const tableId = await createTestTable(pool)
          
          let expectedCA = 0
          let expectedCosts = 0
          
          // Create ravitaillements and commandes
          for (const item of items) {
            const produit = await createTestProduit(pool, item.produit)
            
            // Create ravitaillement to establish cost
            await createRavitaillement(pool, produit.id, item.quantite, produit.cout_unitaire, gerantId)
            
            // Create and validate commande
            const commande = await createTestCommande(pool, serveuseId, tableId, [
              { ...produit, quantite: item.quantite }
            ])
            
            await validateCommande(pool, commande.id, comptoirId)
            expectedCA += commande.montant_total
            expectedCosts += (item.quantite * produit.cout_unitaire)
          }
          
          const expectedBenefice = expectedCA - expectedCosts
          
          // Query analytics
          const result = await pool.query('SELECT chiffre_affaires, benefice FROM analytics_kpis')
          const analytics = result.rows[0]
          
          // Property: Benefice = CA - Costs
          expect(parseInt(analytics.benefice)).toBe(expectedBenefice)
          expect(parseInt(analytics.chiffre_affaires)).toBe(expectedCA)
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 20 }
    )
  })
})

// ============================================================================
// PROPERTY 18: Filtrage des analyses par période
// **Validates: Requirements 5.3**
// ============================================================================

describe('Property 18: Filtrage des analyses par période', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  beforeEach(async () => {
    const pool = await getTestPool()
    await cleanup(pool)
  })

  it('should only include commandes within the specified period', async () => {
    const pool = await getTestPool()
    
    // Setup
    const serveuseId = await createTestUser(pool, 'serveuse')
    const comptoirId = await createTestUser(pool, 'comptoir')
    const tableId = await createTestTable(pool)
    const produit = await createTestProduit(pool, {
      nom: `Produit-${Date.now()}`,
      categorie: 'boisson',
      prix_vente: 1000,
      cout_unitaire: 500,
      seuil_stock_minimum: 5,
      actif: true
    })
    
    // Create commandes at different times
    const commande1 = await createTestCommande(pool, serveuseId, tableId, [
      { ...produit, quantite: 2 }
    ])
    await validateCommande(pool, commande1.id, comptoirId)
    
    // Set date_validation to yesterday
    await pool.query(`
      UPDATE commandes 
      SET date_validation = NOW() - INTERVAL '1 day'
      WHERE id = $1
    `, [commande1.id])
    
    const commande2 = await createTestCommande(pool, serveuseId, tableId, [
      { ...produit, quantite: 3 }
    ])
    await validateCommande(pool, commande2.id, comptoirId)
    
    // Query with period filter (today only)
    const debut = new Date()
    debut.setHours(0, 0, 0, 0)
    const fin = new Date()
    fin.setHours(23, 59, 59, 999)
    
    const result = await pool.query(`
      SELECT get_analytics($1::timestamptz, $2::timestamptz, 'jour')
    `, [debut.toISOString(), fin.toISOString()])
    
    const analytics = result.rows[0].get_analytics
    
    // Property: Only commande2 (today) should be included
    expect(analytics.kpis.chiffre_affaires).toBe(commande2.montant_total)
    expect(analytics.kpis.nombre_commandes).toBe(1)
    
    // Cleanup
    await cleanup(pool)
  })
})

// ============================================================================
// PROPERTY 19: Agrégation des ventes par produit
// **Validates: Requirements 5.4**
// ============================================================================

describe('Property 19: Agrégation des ventes par produit', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  beforeEach(async () => {
    const pool = await getTestPool()
    await cleanup(pool)
  })

  it('should correctly aggregate sales by product', async () => {
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
        async (items) => {
          // Setup
          const serveuseId = await createTestUser(pool, 'serveuse')
          const comptoirId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          
          const productSales = new Map<string, { quantite: number, revenu: number }>()
          
          // Create commandes
          for (const item of items) {
            const produit = await createTestProduit(pool, item.produit)
            const commande = await createTestCommande(pool, serveuseId, tableId, [
              { ...produit, quantite: item.quantite }
            ])
            
            await validateCommande(pool, commande.id, comptoirId)
            
            // Track expected sales
            const existing = productSales.get(produit.id) || { quantite: 0, revenu: 0 }
            productSales.set(produit.id, {
              quantite: existing.quantite + item.quantite,
              revenu: existing.revenu + (item.quantite * produit.prix_vente)
            })
          }
          
          // Query ventes par produit
          const result = await pool.query('SELECT * FROM analytics_ventes_produits WHERE quantite_vendue > 0')
          
          // Property: Each product should have correct aggregated sales
          for (const row of result.rows) {
            const expected = productSales.get(row.produit_id)
            if (expected) {
              expect(parseInt(row.quantite_vendue)).toBe(expected.quantite)
              expect(parseInt(row.revenu_total)).toBe(expected.revenu)
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

// ============================================================================
// PROPERTY 20: Comptage des commandes par période
// **Validates: Requirements 5.5**
// ============================================================================

describe('Property 20: Comptage des commandes par période', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  beforeEach(async () => {
    const pool = await getTestPool()
    await cleanup(pool)
  })

  it('should correctly count validated commandes', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        async (numCommandes) => {
          // Setup
          const serveuseId = await createTestUser(pool, 'serveuse')
          const comptoirId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          const produit = await createTestProduit(pool, {
            nom: `Produit-${Date.now()}`,
            categorie: 'boisson',
            prix_vente: 1000,
            cout_unitaire: 500,
            seuil_stock_minimum: 5,
            actif: true
          })
          
          // Create validated commandes
          for (let i = 0; i < numCommandes; i++) {
            const commande = await createTestCommande(pool, serveuseId, tableId, [
              { ...produit, quantite: 2 }
            ])
            await validateCommande(pool, commande.id, comptoirId)
          }
          
          // Query count
          const result = await pool.query('SELECT nombre_commandes FROM analytics_kpis')
          const count = parseInt(result.rows[0].nombre_commandes)
          
          // Property: Count should match number of validated commandes
          expect(count).toBe(numCommandes)
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 15 }
    )
  })
})

// ============================================================================
// PROPERTY 31: Recherche de transactions
// **Validates: Requirements 8.5**
// ============================================================================

describe('Property 31: Recherche de transactions', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  beforeEach(async () => {
    const pool = await getTestPool()
    await cleanup(pool)
  })

  it('should return transactions matching all specified filters', async () => {
    const pool = await getTestPool()
    
    // Setup
    const serveuse1Id = await createTestUser(pool, 'serveuse')
    const serveuse2Id = await createTestUser(pool, 'serveuse')
    const comptoirId = await createTestUser(pool, 'comptoir')
    const table1Id = await createTestTable(pool)
    const table2Id = await createTestTable(pool)
    const produit1 = await createTestProduit(pool, {
      nom: `Produit1-${Date.now()}`,
      categorie: 'boisson',
      prix_vente: 1000,
      cout_unitaire: 500,
      seuil_stock_minimum: 5,
      actif: true
    })
    const produit2 = await createTestProduit(pool, {
      nom: `Produit2-${Date.now()}`,
      categorie: 'nourriture',
      prix_vente: 2000,
      cout_unitaire: 1000,
      seuil_stock_minimum: 5,
      actif: true
    })
    
    // Create commandes with different combinations
    const commande1 = await createTestCommande(pool, serveuse1Id, table1Id, [
      { ...produit1, quantite: 2 }
    ])
    await validateCommande(pool, commande1.id, comptoirId)
    
    const commande2 = await createTestCommande(pool, serveuse2Id, table2Id, [
      { ...produit2, quantite: 1 }
    ])
    await validateCommande(pool, commande2.id, comptoirId)
    
    const commande3 = await createTestCommande(pool, serveuse1Id, table1Id, [
      { ...produit1, quantite: 1 }
    ])
    await validateCommande(pool, commande3.id, comptoirId)
    
    // Test filter by serveuse
    const result1 = await pool.query(`
      SELECT search_transactions(NULL, NULL, $1::uuid, NULL, NULL, 1, 50)
    `, [serveuse1Id])
    
    const transactions1 = result1.rows[0].search_transactions.transactions
    
    // Property: Should only return commandes from serveuse1
    expect(transactions1.length).toBe(2)
    expect(transactions1.every((t: any) => t.serveuse.id === serveuse1Id)).toBe(true)
    
    // Test filter by table
    const result2 = await pool.query(`
      SELECT search_transactions(NULL, NULL, NULL, $1::uuid, NULL, 1, 50)
    `, [table1Id])
    
    const transactions2 = result2.rows[0].search_transactions.transactions
    
    // Property: Should only return commandes from table1
    expect(transactions2.length).toBe(2)
    expect(transactions2.every((t: any) => t.table.id === table1Id)).toBe(true)
    
    // Test filter by produit
    const result3 = await pool.query(`
      SELECT search_transactions(NULL, NULL, NULL, NULL, $1::uuid, 1, 50)
    `, [produit1.id])
    
    const transactions3 = result3.rows[0].search_transactions.transactions
    
    // Property: Should only return commandes containing produit1
    expect(transactions3.length).toBe(2)
    
    // Test pagination
    const result4 = await pool.query(`
      SELECT search_transactions(NULL, NULL, NULL, NULL, NULL, 1, 2)
    `)
    
    const search4 = result4.rows[0].search_transactions
    
    // Property: Should respect pagination limit
    expect(search4.transactions.length).toBeLessThanOrEqual(2)
    expect(search4.pagination.total).toBe(3)
    expect(search4.pagination.total_pages).toBe(2)
    
    // Cleanup
    await cleanup(pool)
  })
})
