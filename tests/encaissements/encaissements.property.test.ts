import { describe, it, expect, beforeEach } from 'vitest'
import { getTestPool, skipIfNoDB } from '../setup'
import * as fc from 'fast-check'

/**
 * Property-Based Tests for Encaissements
 * 
 * Tests Properties:
 * - Property 50: Validation des données d'encaissement (Requirement 14.1)
 * - Property 51: Mise à jour du statut de facture après encaissement total (Requirement 14.2)
 * - Property 52: Mise à jour du statut de facture après encaissement partiel (Requirement 14.3)
 * - Property 53: Traçabilité des encaissements (Requirement 14.4)
 * - Property 58: Cohérence des encaissements (invariant)
 */

// ============================================================================
// ARBITRARIES (Generators)
// ============================================================================

const uuidArbitrary = fc.uuid()

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
  
  await pool.query(`
    INSERT INTO stock (produit_id, quantite_disponible)
    VALUES ($1, $2)
  `, [produitId, 100])
  
  return result.rows[0]
}

async function createValidatedCommande(pool: any, userId: string, validateurId: string, tableId: string, produits: any[]) {
  const commandeResult = await pool.query(`
    INSERT INTO commandes (table_id, serveuse_id, statut, montant_total)
    VALUES ($1, $2, $3, $4)
    RETURNING id
  `, [tableId, userId, 'en_attente', 0])
  
  const commandeId = commandeResult.rows[0].id
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
  
  await pool.query(`
    UPDATE commandes 
    SET statut = 'validee', date_validation = NOW(), validateur_id = $1
    WHERE id = $2
  `, [validateurId, commandeId])
  
  const factureResult = await pool.query(`
    SELECT id, montant_total FROM factures WHERE commande_id = $1
  `, [commandeId])
  
  return {
    commande_id: commandeId,
    facture_id: factureResult.rows[0].id,
    montant_total: factureResult.rows[0].montant_total
  }
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
// PROPERTY 50: Validation des données d'encaissement
// Validates: Requirement 14.1
// ============================================================================

describe('Property 50: Validation des données d\'encaissement', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  beforeEach(async () => {
    const pool = await getTestPool()
    await cleanup(pool)
  })

  it('should record all required fields when creating an encaissement', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          produit: produitArbitrary,
          quantite: quantiteArbitrary,
          mode_paiement: modePaiementArbitrary
        }),
        async (testData) => {
          const userId = await createTestUser(pool, 'serveuse')
          const comptoirId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          const produit = await createTestProduit(pool, testData.produit)
          
          const { facture_id, montant_total } = await createValidatedCommande(
            pool, userId, comptoirId, tableId, 
            [{ ...produit, quantite: testData.quantite }]
          )
          
          const encaissementResult = await pool.query(`
            INSERT INTO encaissements (facture_id, montant, mode_paiement, utilisateur_id)
            VALUES ($1, $2, $3, $4)
            RETURNING id, facture_id, montant, mode_paiement, reference, utilisateur_id, date_encaissement
          `, [facture_id, montant_total, testData.mode_paiement, comptoirId])
          
          const encaissement = encaissementResult.rows[0]
          
          expect(encaissement.id).toBeDefined()
          expect(encaissement.facture_id).toBe(facture_id)
          expect(encaissement.montant).toBe(montant_total)
          expect(encaissement.mode_paiement).toBe(testData.mode_paiement)
          expect(encaissement.utilisateur_id).toBe(comptoirId)
          expect(encaissement.date_encaissement).toBeDefined()
          
          await cleanup(pool)
        }
      ),
      { numRuns: 25 }
    )
  })

  it('should reject encaissements with missing required fields', async () => {
    const pool = await getTestPool()
    
    await expect(
      pool.query(`
        INSERT INTO encaissements (montant, mode_paiement, utilisateur_id)
        VALUES ($1, $2, $3)
      `, [1000, 'especes', '00000000-0000-0000-0000-000000000001'])
    ).rejects.toThrow()
    
    await expect(
      pool.query(`
        INSERT INTO encaissements (facture_id, mode_paiement, utilisateur_id)
        VALUES ($1, $2, $3)
      `, ['00000000-0000-0000-0000-000000000001', 'especes', '00000000-0000-0000-0000-000000000001'])
    ).rejects.toThrow()
  })

  it('should reject encaissements with invalid mode_paiement', async () => {
    const pool = await getTestPool()
    
    await expect(
      pool.query(`
        INSERT INTO encaissements (facture_id, montant, mode_paiement, utilisateur_id)
        VALUES ($1, $2, $3, $4)
      `, ['00000000-0000-0000-0000-000000000001', 1000, 'invalid_mode', '00000000-0000-0000-0000-000000000001'])
    ).rejects.toThrow()
  })
})

// ============================================================================
// PROPERTY 51: Mise à jour du statut de facture après encaissement total
// Validates: Requirement 14.2
// ============================================================================

describe('Property 51: Mise à jour du statut de facture après encaissement total', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  beforeEach(async () => {
    const pool = await getTestPool()
    await cleanup(pool)
  })

  it('should update facture status to payee after full payment', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          produit: produitArbitrary,
          quantite: quantiteArbitrary,
          mode_paiement: modePaiementArbitrary
        }),
        async (testData) => {
          const userId = await createTestUser(pool, 'serveuse')
          const comptoirId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          const produit = await createTestProduit(pool, testData.produit)
          
          const { facture_id, montant_total } = await createValidatedCommande(
            pool, userId, comptoirId, tableId, 
            [{ ...produit, quantite: testData.quantite }]
          )
          
          const factureAvant = await pool.query(`
            SELECT statut, montant_paye, montant_restant, date_paiement_complet
            FROM factures WHERE id = $1
          `, [facture_id])
          
          expect(factureAvant.rows[0].statut).toBe('en_attente_paiement')
          expect(factureAvant.rows[0].montant_paye).toBe(0)
          expect(factureAvant.rows[0].montant_restant).toBe(montant_total)
          expect(factureAvant.rows[0].date_paiement_complet).toBeNull()
          
          await pool.query(`
            INSERT INTO encaissements (facture_id, montant, mode_paiement, utilisateur_id)
            VALUES ($1, $2, $3, $4)
          `, [facture_id, montant_total, testData.mode_paiement, comptoirId])
          
          const factureApres = await pool.query(`
            SELECT statut, montant_paye, montant_restant, date_paiement_complet
            FROM factures WHERE id = $1
          `, [facture_id])
          
          expect(factureApres.rows[0].statut).toBe('payee')
          expect(factureApres.rows[0].montant_paye).toBe(montant_total)
          expect(factureApres.rows[0].montant_restant).toBe(0)
          expect(factureApres.rows[0].date_paiement_complet).not.toBeNull()
          
          await cleanup(pool)
        }
      ),
      { numRuns: 25 }
    )
  })
})

// ============================================================================
// PROPERTY 52: Mise à jour du statut de facture après encaissement partiel
// Validates: Requirement 14.3
// ============================================================================

describe('Property 52: Mise à jour du statut de facture après encaissement partiel', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  beforeEach(async () => {
    const pool = await getTestPool()
    await cleanup(pool)
  })

  it('should update facture status to partiellement_payee after partial payment', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          produit: produitArbitrary,
          quantite: quantiteArbitrary,
          mode_paiement: modePaiementArbitrary,
          pourcentage_paiement: fc.integer({ min: 25, max: 75 })
        }),
        async (testData) => {
          const userId = await createTestUser(pool, 'serveuse')
          const comptoirId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          const produit = await createTestProduit(pool, testData.produit)
          
          const { facture_id, montant_total } = await createValidatedCommande(
            pool, userId, comptoirId, tableId, 
            [{ ...produit, quantite: testData.quantite }]
          )
          
          const montantPartiel = Math.floor(montant_total * testData.pourcentage_paiement / 100)
          
          await pool.query(`
            INSERT INTO encaissements (facture_id, montant, mode_paiement, utilisateur_id)
            VALUES ($1, $2, $3, $4)
          `, [facture_id, montantPartiel, testData.mode_paiement, comptoirId])
          
          const facture = await pool.query(`
            SELECT statut, montant_paye, montant_restant
            FROM factures WHERE id = $1
          `, [facture_id])
          
          expect(facture.rows[0].statut).toBe('partiellement_payee')
          expect(facture.rows[0].montant_paye).toBe(montantPartiel)
          expect(facture.rows[0].montant_restant).toBe(montant_total - montantPartiel)
          
          await cleanup(pool)
        }
      ),
      { numRuns: 25 }
    )
  })

  it('should handle multiple partial payments correctly', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          produit: produitArbitrary,
          quantite: quantiteArbitrary,
          paiements: fc.array(
            fc.record({
              pourcentage: fc.integer({ min: 10, max: 30 }),
              mode: modePaiementArbitrary
            }),
            { minLength: 2, maxLength: 4 }
          )
        }),
        async (testData) => {
          const userId = await createTestUser(pool, 'serveuse')
          const comptoirId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          const produit = await createTestProduit(pool, testData.produit)
          
          const { facture_id, montant_total } = await createValidatedCommande(
            pool, userId, comptoirId, tableId, 
            [{ ...produit, quantite: testData.quantite }]
          )
          
          let totalPaye = 0
          for (const paiement of testData.paiements) {
            const montant = Math.min(
              Math.floor(montant_total * paiement.pourcentage / 100),
              montant_total - totalPaye
            )
            
            if (montant > 0) {
              await pool.query(`
                INSERT INTO encaissements (facture_id, montant, mode_paiement, utilisateur_id)
                VALUES ($1, $2, $3, $4)
              `, [facture_id, montant, paiement.mode, comptoirId])
              
              totalPaye += montant
            }
          }
          
          const facture = await pool.query(`
            SELECT statut, montant_paye, montant_restant
            FROM factures WHERE id = $1
          `, [facture_id])
          
          expect(facture.rows[0].montant_paye).toBe(totalPaye)
          expect(facture.rows[0].montant_restant).toBe(montant_total - totalPaye)
          
          if (totalPaye === montant_total) {
            expect(facture.rows[0].statut).toBe('payee')
          } else if (totalPaye > 0) {
            expect(facture.rows[0].statut).toBe('partiellement_payee')
          }
          
          await cleanup(pool)
        }
      ),
      { numRuns: 20 }
    )
  })
})

// ============================================================================
// PROPERTY 53: Traçabilité des encaissements
// Validates: Requirement 14.4
// ============================================================================

describe('Property 53: Traçabilité des encaissements', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  beforeEach(async () => {
    const pool = await getTestPool()
    await cleanup(pool)
  })

  it('should record utilisateur_id and date_encaissement for all encaissements', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          produit: produitArbitrary,
          quantite: quantiteArbitrary,
          mode_paiement: modePaiementArbitrary
        }),
        async (testData) => {
          const userId = await createTestUser(pool, 'serveuse')
          const comptoirId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          const produit = await createTestProduit(pool, testData.produit)
          
          const { facture_id, montant_total } = await createValidatedCommande(
            pool, userId, comptoirId, tableId, 
            [{ ...produit, quantite: testData.quantite }]
          )
          
          const beforeTime = new Date()
          
          await pool.query(`
            INSERT INTO encaissements (facture_id, montant, mode_paiement, utilisateur_id)
            VALUES ($1, $2, $3, $4)
          `, [facture_id, montant_total, testData.mode_paiement, comptoirId])
          
          const afterTime = new Date()
          
          const encaissement = await pool.query(`
            SELECT utilisateur_id, date_encaissement
            FROM encaissements WHERE facture_id = $1
          `, [facture_id])
          
          expect(encaissement.rows).toHaveLength(1)
          expect(encaissement.rows[0].utilisateur_id).toBe(comptoirId)
          expect(encaissement.rows[0].date_encaissement).toBeDefined()
          
          const encaissementDate = new Date(encaissement.rows[0].date_encaissement)
          expect(encaissementDate.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime())
          expect(encaissementDate.getTime()).toBeLessThanOrEqual(afterTime.getTime())
          
          await cleanup(pool)
        }
      ),
      { numRuns: 25 }
    )
  })
})

// ============================================================================
// PROPERTY 58: Cohérence des encaissements (invariant)
// Validates: Data consistency
// ============================================================================

describe('Property 58: Cohérence des encaissements (invariant)', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  beforeEach(async () => {
    const pool = await getTestPool()
    await cleanup(pool)
  })

  it('should maintain sum of encaissements equal to facture montant_paye', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          produit: produitArbitrary,
          quantite: quantiteArbitrary,
          paiements: fc.array(
            fc.record({
              pourcentage: fc.integer({ min: 10, max: 40 }),
              mode: modePaiementArbitrary
            }),
            { minLength: 1, maxLength: 5 }
          )
        }),
        async (testData) => {
          const userId = await createTestUser(pool, 'serveuse')
          const comptoirId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          const produit = await createTestProduit(pool, testData.produit)
          
          const { facture_id, montant_total } = await createValidatedCommande(
            pool, userId, comptoirId, tableId, 
            [{ ...produit, quantite: testData.quantite }]
          )
          
          let totalPaye = 0
          for (const paiement of testData.paiements) {
            const montant = Math.min(
              Math.floor(montant_total * paiement.pourcentage / 100),
              montant_total - totalPaye
            )
            
            if (montant > 0) {
              await pool.query(`
                INSERT INTO encaissements (facture_id, montant, mode_paiement, utilisateur_id)
                VALUES ($1, $2, $3, $4)
              `, [facture_id, montant, paiement.mode, comptoirId])
              
              totalPaye += montant
            }
          }
          
          const sumEncaissements = await pool.query(`
            SELECT COALESCE(SUM(montant), 0) as total
            FROM encaissements WHERE facture_id = $1
          `, [facture_id])
          
          const facture = await pool.query(`
            SELECT montant_paye, montant_restant, montant_total
            FROM factures WHERE id = $1
          `, [facture_id])
          
          const sumTotal = parseInt(sumEncaissements.rows[0].total)
          const factureMontantPaye = facture.rows[0].montant_paye
          
          expect(sumTotal).toBe(factureMontantPaye)
          expect(factureMontantPaye + facture.rows[0].montant_restant).toBe(facture.rows[0].montant_total)
          
          await cleanup(pool)
        }
      ),
      { numRuns: 30 }
    )
  })

  it('should never allow encaissements to exceed facture montant_total', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          produit: produitArbitrary,
          quantite: quantiteArbitrary,
          mode_paiement: modePaiementArbitrary
        }),
        async (testData) => {
          const userId = await createTestUser(pool, 'serveuse')
          const comptoirId = await createTestUser(pool, 'comptoir')
          const tableId = await createTestTable(pool)
          const produit = await createTestProduit(pool, testData.produit)
          
          const { facture_id, montant_total } = await createValidatedCommande(
            pool, userId, comptoirId, tableId, 
            [{ ...produit, quantite: testData.quantite }]
          )
          
          await pool.query(`
            INSERT INTO encaissements (facture_id, montant, mode_paiement, utilisateur_id)
            VALUES ($1, $2, $3, $4)
          `, [facture_id, montant_total, testData.mode_paiement, comptoirId])
          
          await expect(
            pool.query(`
              INSERT INTO encaissements (facture_id, montant, mode_paiement, utilisateur_id)
              VALUES ($1, $2, $3, $4)
            `, [facture_id, 100, testData.mode_paiement, comptoirId])
          ).rejects.toThrow()
          
          const facture = await pool.query(`
            SELECT montant_paye, montant_restant
            FROM factures WHERE id = $1
          `, [facture_id])
          
          expect(facture.rows[0].montant_paye).toBe(montant_total)
          expect(facture.rows[0].montant_restant).toBe(0)
          
          await cleanup(pool)
        }
      ),
      { numRuns: 20 }
    )
  })
})
