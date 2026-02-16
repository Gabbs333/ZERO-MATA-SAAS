import { describe, it, expect, beforeEach } from 'vitest'
import { getTestPool, skipIfNoDB } from '../setup'
import * as fc from 'fast-check'

/**
 * Property-Based Tests for CA and Encaissements Analytics
 * 
 * Tests Properties:
 * - Property 54: Distinction CA et encaissements (Requirement 15.1)
 * - Property 55: Calcul des créances (Requirement 15.2)
 */

// ============================================================================
// ARBITRARIES (Generators)
// ============================================================================

const prixArbitrary = fc.integer({ min: 100, max: 10000 })
  .map(n => Math.round(n / 25) * 25) // Multiples of 25 FCFA

const quantiteArbitrary = fc.integer({ min: 1, max: 20 })

const categorieArbitrary = fc.constantFrom('boisson', 'nourriture', 'autre')

const modePaiementArbitrary = fc.constantFrom('especes', 'mobile_money', 'carte_bancaire')

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

async function validateCommande(pool: any, commandeId: string, validateurId: string) {
  await pool.query(`
    UPDATE commandes 
    SET statut = 'validee', date_validation = NOW(), validateur_id = $1
    WHERE id = $2
  `, [validateurId, commandeId])
}

async function createEncaissement(pool: any, factureId: string, montant: number, modePaiement: string, userId: string) {
  const result = await pool.query(`
    INSERT INTO encaissements (facture_id, montant, mode_paiement, utilisateur_id)
    VALUES ($1, $2, $3, $4)
    RETURNING id, montant, date_encaissement
  `, [factureId, montant, modePaiement, userId])
  
  return result.rows[0]
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
// PROPERTY 54: Distinction CA et encaissements
// Validates: Requirement 15.1
// ============================================================================

describe('Property 54: Distinction CA et encaissements', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  beforeEach(async () => {
    const pool = await getTestPool()
    await cleanup(pool)
  })

  it('should correctly distinguish CA (validated commandes) from encaissements (payments received)', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            produit: produitArbitrary,
            quantite: quantiteArbitrary,
            paymentPercentage: fc.integer({ min: 0, max: 100 }) // 0-100% paid
          }),
          { minLength: 2, maxLength: 10 }
        ),
        async (items) => {
          // Setup
          const serveuseId = await createTestUser(pool, 'serveuse')
          const comptoirId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)

          
          let totalCA = 0
          let totalEncaissements = 0
          
          // Create multiple commandes with varying payment status
          for (const item of items) {
            const produit = await createTestProduit(pool, item.produit)
            const commande = await createTestCommande(pool, serveuseId, tableId, [
              { ...produit, quantite: item.quantite }
            ])
            
            // Validate commande (generates CA)
            await validateCommande(pool, commande.id, comptoirId)
            totalCA += commande.montant_total
            
            // Get generated facture
            const factureResult = await pool.query(`
              SELECT id, montant_total FROM factures WHERE commande_id = $1
            `, [commande.id])
            
            const facture = factureResult.rows[0]
            
            // Create partial or full payment based on paymentPercentage
            if (item.paymentPercentage > 0) {
              const montantPaye = Math.floor((facture.montant_total * item.paymentPercentage) / 100)
              if (montantPaye > 0) {
                await createEncaissement(pool, facture.id, montantPaye, 'especes', comptoirId)
                totalEncaissements += montantPaye
              }
            }
          }
          
          // Query analytics view
          const analyticsResult = await pool.query(`
            SELECT 
              COALESCE(SUM(chiffre_affaires), 0) as total_ca,
              COALESCE(SUM(encaissements), 0) as total_encaissements
            FROM analytics_ca_encaissements
          `)
          
          const analytics = analyticsResult.rows[0]
          
          // Property: CA should equal sum of all validated commandes
          expect(parseInt(analytics.total_ca)).toBe(totalCA)
          
          // Property: Encaissements should equal sum of all payments
          expect(parseInt(analytics.total_encaissements)).toBe(totalEncaissements)
          
          // Property: CA and Encaissements should be calculated separately
          // (CA can be greater than encaissements when there are unpaid factures)
          expect(parseInt(analytics.total_ca)).toBeGreaterThanOrEqual(parseInt(analytics.total_encaissements))
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 20 }
    )
  })


  it('should show CA even when no encaissements have been made', async () => {
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
          const serveuseId = await createTestUser(pool, 'serveuse')
          const comptoirId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          
          let totalCA = 0
          
          // Create validated commandes without any payments
          for (const item of items) {
            const produit = await createTestProduit(pool, item.produit)
            const commande = await createTestCommande(pool, serveuseId, tableId, [
              { ...produit, quantite: item.quantite }
            ])
            
            await validateCommande(pool, commande.id, comptoirId)
            totalCA += commande.montant_total
          }
          
          // Query analytics
          const analyticsResult = await pool.query(`
            SELECT 
              COALESCE(SUM(chiffre_affaires), 0) as total_ca,
              COALESCE(SUM(encaissements), 0) as total_encaissements
            FROM analytics_ca_encaissements
          `)
          
          const analytics = analyticsResult.rows[0]
          
          // Property: CA should be recorded even without payments
          expect(parseInt(analytics.total_ca)).toBe(totalCA)
          expect(parseInt(analytics.total_ca)).toBeGreaterThan(0)
          
          // Property: Encaissements should be zero
          expect(parseInt(analytics.total_encaissements)).toBe(0)
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 15 }
    )
  })

  it('should correctly track CA and encaissements over time', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }),
        async (numCommandes) => {
          // Setup
          const serveuseId = await createTestUser(pool, 'serveuse')
          const comptoirId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          const produit = await createTestProduit(pool, {
            nom: `Produit-${Date.now()}`,
            categorie: 'boisson',
            prix_vente: 1000,
            seuil_stock_minimum: 5,
            actif: true
          })
          
          let expectedCA = 0
          let expectedEncaissements = 0
          
          // Create commandes and payments progressively
          for (let i = 0; i < numCommandes; i++) {
            const commande = await createTestCommande(pool, serveuseId, tableId, [
              { ...produit, quantite: 2 }
            ])
            
            await validateCommande(pool, commande.id, comptoirId)
            expectedCA += commande.montant_total
            
            // Pay 50% of commandes
            if (i % 2 === 0) {
              const factureResult = await pool.query(`
                SELECT id FROM factures WHERE commande_id = $1
              `, [commande.id])
              
              await createEncaissement(pool, factureResult.rows[0].id, commande.montant_total, 'especes', comptoirId)
              expectedEncaissements += commande.montant_total
            }
          }
          
          // Query analytics
          const analyticsResult = await pool.query(`
            SELECT 
              COALESCE(SUM(chiffre_affaires), 0) as total_ca,
              COALESCE(SUM(encaissements), 0) as total_encaissements
            FROM analytics_ca_encaissements
          `)
          
          const analytics = analyticsResult.rows[0]
          
          // Property: CA and encaissements should match expected values
          expect(parseInt(analytics.total_ca)).toBe(expectedCA)
          expect(parseInt(analytics.total_encaissements)).toBe(expectedEncaissements)
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 15 }
    )
  })
})


// ============================================================================
// PROPERTY 55: Calcul des créances
// Validates: Requirement 15.2
// ============================================================================

describe('Property 55: Calcul des créances', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  beforeEach(async () => {
    const pool = await getTestPool()
    await cleanup(pool)
  })

  it('should correctly calculate créances as CA minus encaissements', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            produit: produitArbitrary,
            quantite: quantiteArbitrary,
            paymentPercentage: fc.integer({ min: 0, max: 100 })
          }),
          { minLength: 3, maxLength: 10 }
        ),
        async (items) => {
          // Setup
          const serveuseId = await createTestUser(pool, 'serveuse')
          const comptoirId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          
          let totalCA = 0
          let totalEncaissements = 0
          
          // Create commandes with varying payment status
          for (const item of items) {
            const produit = await createTestProduit(pool, item.produit)
            const commande = await createTestCommande(pool, serveuseId, tableId, [
              { ...produit, quantite: item.quantite }
            ])
            
            await validateCommande(pool, commande.id, comptoirId)
            totalCA += commande.montant_total
            
            // Create partial payment
            if (item.paymentPercentage > 0) {
              const factureResult = await pool.query(`
                SELECT id, montant_total FROM factures WHERE commande_id = $1
              `, [commande.id])
              
              const facture = factureResult.rows[0]
              const montantPaye = Math.floor((facture.montant_total * item.paymentPercentage) / 100)
              
              if (montantPaye > 0) {
                await createEncaissement(pool, facture.id, montantPaye, 'especes', comptoirId)
                totalEncaissements += montantPaye
              }
            }
          }
          
          const expectedCreances = totalCA - totalEncaissements
          
          // Query créances view
          const creancesResult = await pool.query(`
            SELECT 
              chiffre_affaires_total,
              encaissements_total,
              creances_total
            FROM analytics_creances
          `)
          
          const creances = creancesResult.rows[0]
          
          // Property: Créances = CA - Encaissements
          expect(parseInt(creances.creances_total)).toBe(expectedCreances)
          
          // Property: CA should match
          expect(parseInt(creances.chiffre_affaires_total)).toBe(totalCA)
          
          // Property: Encaissements should match
          expect(parseInt(creances.encaissements_total)).toBe(totalEncaissements)
          
          // Property: Créances should be non-negative
          expect(parseInt(creances.creances_total)).toBeGreaterThanOrEqual(0)
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 20 }
    )
  })


  it('should show zero créances when all factures are fully paid', async () => {
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
          const serveuseId = await createTestUser(pool, 'serveuse')
          const comptoirId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          
          let totalCA = 0
          
          // Create commandes and pay them all fully
          for (const item of items) {
            const produit = await createTestProduit(pool, item.produit)
            const commande = await createTestCommande(pool, serveuseId, tableId, [
              { ...produit, quantite: item.quantite }
            ])
            
            await validateCommande(pool, commande.id, comptoirId)
            totalCA += commande.montant_total
            
            // Get facture and pay it fully
            const factureResult = await pool.query(`
              SELECT id FROM factures WHERE commande_id = $1
            `, [commande.id])
            
            await createEncaissement(pool, factureResult.rows[0].id, commande.montant_total, 'especes', comptoirId)
          }
          
          // Query créances
          const creancesResult = await pool.query(`
            SELECT creances_total FROM analytics_creances
          `)
          
          // Property: Créances should be zero when all factures are paid
          expect(parseInt(creancesResult.rows[0].creances_total)).toBe(0)
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 15 }
    )
  })

  it('should correctly track unpaid factures count and amount', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 8 }),
        fc.integer({ min: 0, max: 100 }), // percentage to pay
        async (numCommandes, paymentPercentage) => {
          // Setup
          const serveuseId = await createTestUser(pool, 'serveuse')
          const comptoirId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          const produit = await createTestProduit(pool, {
            nom: `Produit-${Date.now()}`,
            categorie: 'boisson',
            prix_vente: 1000,
            seuil_stock_minimum: 5,
            actif: true
          })
          
          let expectedUnpaidCount = 0
          let expectedUnpaidAmount = 0
          
          // Create commandes with partial payments
          for (let i = 0; i < numCommandes; i++) {
            const commande = await createTestCommande(pool, serveuseId, tableId, [
              { ...produit, quantite: 2 }
            ])
            
            await validateCommande(pool, commande.id, comptoirId)
            
            const factureResult = await pool.query(`
              SELECT id, montant_total FROM factures WHERE commande_id = $1
            `, [commande.id])
            
            const facture = factureResult.rows[0]
            const montantPaye = Math.floor((facture.montant_total * paymentPercentage) / 100)
            
            if (montantPaye > 0 && montantPaye < facture.montant_total) {
              // Partial payment
              await createEncaissement(pool, facture.id, montantPaye, 'especes', comptoirId)
              expectedUnpaidCount++
              expectedUnpaidAmount += (facture.montant_total - montantPaye)
            } else if (montantPaye === 0) {
              // No payment
              expectedUnpaidCount++
              expectedUnpaidAmount += facture.montant_total
            }
            // If montantPaye === montant_total, facture is fully paid (not counted)
          }
          
          // Query créances
          const creancesResult = await pool.query(`
            SELECT nombre_factures_impayees, montant_factures_impayees
            FROM analytics_creances
          `)
          
          const creances = creancesResult.rows[0]
          
          // Property: Number of unpaid factures should match
          expect(parseInt(creances.nombre_factures_impayees)).toBe(expectedUnpaidCount)
          
          // Property: Amount of unpaid factures should match
          expect(parseInt(creances.montant_factures_impayees)).toBe(expectedUnpaidAmount)
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should maintain créances invariant: créances = CA - encaissements', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            produit: produitArbitrary,
            quantite: quantiteArbitrary,
            paymentPercentage: fc.integer({ min: 0, max: 100 })
          }),
          { minLength: 5, maxLength: 15 }
        ),
        async (items) => {
          // Setup
          const serveuseId = await createTestUser(pool, 'serveuse')
          const comptoirId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          
          // Create commandes with varying payment status
          for (const item of items) {
            const produit = await createTestProduit(pool, item.produit)
            const commande = await createTestCommande(pool, serveuseId, tableId, [
              { ...produit, quantite: item.quantite }
            ])
            
            await validateCommande(pool, commande.id, comptoirId)
            
            if (item.paymentPercentage > 0) {
              const factureResult = await pool.query(`
                SELECT id, montant_total FROM factures WHERE commande_id = $1
              `, [commande.id])
              
              const facture = factureResult.rows[0]
              const montantPaye = Math.floor((facture.montant_total * item.paymentPercentage) / 100)
              
              if (montantPaye > 0) {
                await createEncaissement(pool, facture.id, montantPaye, 'especes', comptoirId)
              }
            }
          }
          
          // Query créances
          const creancesResult = await pool.query(`
            SELECT 
              chiffre_affaires_total,
              encaissements_total,
              creances_total
            FROM analytics_creances
          `)
          
          const creances = creancesResult.rows[0]
          const ca = parseInt(creances.chiffre_affaires_total)
          const enc = parseInt(creances.encaissements_total)
          const cre = parseInt(creances.creances_total)
          
          // Property: Invariant must hold: créances = CA - encaissements
          expect(cre).toBe(ca - enc)
          
          // Property: Créances should never be negative
          expect(cre).toBeGreaterThanOrEqual(0)
          
          // Cleanup
          await cleanup(pool)
        }
      ),
      { numRuns: 25 }
    )
  })
})
