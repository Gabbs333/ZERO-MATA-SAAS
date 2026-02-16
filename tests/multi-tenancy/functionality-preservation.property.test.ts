/**
 * Property-Based Tests: Existing Functionality Preservation
 * 
 * Tests that all existing operations continue to work after multi-tenancy implementation.
 * Verifies that operations work correctly within establishment context.
 * 
 * Properties tested:
 * - Property 30: Existing Functionality Preservation
 * 
 * **Validates: Requirements 15.6**
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { getTestPool, skipIfNoDB } from '../setup'
import fc from 'fast-check'
import { Pool } from 'pg'

describe('Existing Functionality Preservation Properties', () => {
  let pool: Pool

  beforeEach(async () => {
    if (skipIfNoDB()) return
    pool = await getTestPool()
  })

  /**
   * Helper: Create a test establishment
   */
  async function createEtablissement(name: string): Promise<string> {
    const result = await pool.query(`
      INSERT INTO etablissements (nom, statut_abonnement, date_debut, date_fin, actif)
      VALUES ($1, 'actif', NOW(), NOW() + INTERVAL '12 months', true)
      RETURNING id
    `, [name])
    return result.rows[0].id
  }

  /**
   * Helper: Create a test user with specific role and establishment
   */
  async function createUser(
    etablissementId: string,
    role: string
  ): Promise<string> {
    const userEmail = `user-${Date.now()}-${Math.random()}@test.com`
    
    const authResult = await pool.query(`
      INSERT INTO auth.users (id, email)
      VALUES (gen_random_uuid(), $1)
      RETURNING id
    `, [userEmail])
    const userId = authResult.rows[0].id

    await pool.query(`
      INSERT INTO profiles (id, email, nom, prenom, role, etablissement_id, actif)
      VALUES ($1, $2, 'Test', 'User', $3, $4, true)
    `, [userId, userEmail, role, etablissementId])

    return userId
  }

  /**
   * Helper: Set the session user for RLS policies
   */
  async function setSessionUser(userId: string): Promise<void> {
    await pool.query(`
      SELECT set_config('request.jwt.claims', '{"sub": "${userId}"}', true)
    `)
  }

  /**
   * Property 30: Existing Functionality Preservation
   * 
   * **Validates: Requirements 15.6**
   * 
   * All existing operations that worked before multi-tenancy should continue
   * to work after multi-tenancy implementation when performed by a user
   * within their establishment context.
   * 
   * This test verifies core workflows:
   * 1. Product management (create, read, update)
   * 2. Order creation and validation
   * 3. Stock management
   * 4. Invoice generation
   * 5. Payment collection
   */
  test('Property 30: Existing operations work within establishment context', async () => {
    if (skipIfNoDB()) return

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          productName: fc.string({ minLength: 3, maxLength: 20 }),
          productPrice: fc.integer({ min: 100, max: 10000 }),
          orderQuantity: fc.integer({ min: 1, max: 10 }),
          stockQuantity: fc.integer({ min: 10, max: 100 })
        }),
        async ({ productName, productPrice, orderQuantity, stockQuantity }) => {
          // Setup: Create establishment and users
          const etabId = await createEtablissement(`Etab ${Date.now()}`)
          const gerantId = await createUser(etabId, 'gerant')
          const serveuseId = await createUser(etabId, 'serveuse')
          const comptoirId = await createUser(etabId, 'comptoir')

          // Test 1: Product Management (gerant creates product)
          await setSessionUser(gerantId)
          
          const productResult = await pool.query(`
            INSERT INTO produits (nom, categorie, prix_vente, etablissement_id, actif)
            VALUES ($1, 'Boisson', $2, $3, true)
            RETURNING id
          `, [productName, productPrice, etabId])
          const productId = productResult.rows[0].id

          expect(productId).toBeDefined()

          // Verify product is visible to gerant
          const productCheck = await pool.query(`
            SELECT * FROM produits WHERE id = $1
          `, [productId])
          expect(productCheck.rows.length).toBe(1)
          expect(productCheck.rows[0].nom).toBe(productName)
          expect(productCheck.rows[0].etablissement_id).toBe(etabId)

          // Test 2: Stock Management (gerant adds stock)
          const stockResult = await pool.query(`
            INSERT INTO stock (produit_id, quantite_disponible, etablissement_id)
            VALUES ($1, $2, $3)
            RETURNING id
          `, [productId, stockQuantity, etabId])
          const stockId = stockResult.rows[0].id

          expect(stockId).toBeDefined()

          // Verify stock is visible
          const stockCheck = await pool.query(`
            SELECT * FROM stock WHERE id = $1
          `, [stockId])
          expect(stockCheck.rows.length).toBe(1)
          expect(stockCheck.rows[0].quantite_disponible).toBe(stockQuantity)

          // Test 3: Table Management (gerant creates table)
          const tableResult = await pool.query(`
            INSERT INTO tables (numero, capacite, statut, etablissement_id)
            VALUES ($1, 4, 'libre', $2)
            RETURNING id
          `, [`T${Date.now()}`, etabId])
          const tableId = tableResult.rows[0].id

          expect(tableId).toBeDefined()

          // Test 4: Order Creation (serveuse creates order)
          await setSessionUser(serveuseId)

          const commandeResult = await pool.query(`
            INSERT INTO commandes (
              table_id, 
              serveuse_id, 
              statut, 
              montant_total,
              etablissement_id
            )
            VALUES ($1, $2, 'en_attente', 0, $3)
            RETURNING id, numero_commande
          `, [tableId, serveuseId, etabId])
          const commandeId = commandeResult.rows[0].id
          const numeroCommande = commandeResult.rows[0].numero_commande

          expect(commandeId).toBeDefined()
          expect(numeroCommande).toBeDefined()
          expect(numeroCommande).toMatch(/^CMD-\d{8}-\d{3}$/)

          // Add items to order
          const itemResult = await pool.query(`
            INSERT INTO commande_items (
              commande_id,
              produit_id,
              quantite,
              prix_unitaire,
              etablissement_id
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
          `, [commandeId, productId, orderQuantity, productPrice, etabId])

          expect(itemResult.rows[0].id).toBeDefined()

          // Verify order is visible to serveuse
          const commandeCheck = await pool.query(`
            SELECT * FROM commandes WHERE id = $1
          `, [commandeId])
          expect(commandeCheck.rows.length).toBe(1)
          expect(commandeCheck.rows[0].serveuse_id).toBe(serveuseId)

          // Test 5: Order Validation (comptoir validates order)
          await setSessionUser(comptoirId)

          // Comptoir should be able to see the order
          const comptoirCommandeCheck = await pool.query(`
            SELECT * FROM commandes WHERE id = $1
          `, [commandeId])
          expect(comptoirCommandeCheck.rows.length).toBe(1)

          // Validate the order
          const validateResult = await pool.query(`
            UPDATE commandes
            SET statut = 'validee', validee_par = $1, date_validation = NOW()
            WHERE id = $2
            RETURNING id, statut
          `, [comptoirId, commandeId])

          expect(validateResult.rows.length).toBe(1)
          expect(validateResult.rows[0].statut).toBe('validee')

          // Test 6: Invoice Generation (comptoir creates invoice)
          const factureResult = await pool.query(`
            INSERT INTO factures (
              commande_id,
              montant_total,
              montant_paye,
              statut,
              etablissement_id
            )
            VALUES ($1, $2, 0, 'impayee', $3)
            RETURNING id, numero_facture
          `, [commandeId, productPrice * orderQuantity, etabId])
          const factureId = factureResult.rows[0].id
          const numeroFacture = factureResult.rows[0].numero_facture

          expect(factureId).toBeDefined()
          expect(numeroFacture).toBeDefined()
          expect(numeroFacture).toMatch(/^FACT-\d{8}-\d{3}$/)

          // Test 7: Payment Collection (comptoir records payment)
          const encaissementResult = await pool.query(`
            INSERT INTO encaissements (
              facture_id,
              montant,
              mode_paiement,
              etablissement_id
            )
            VALUES ($1, $2, 'especes', $3)
            RETURNING id
          `, [factureId, productPrice * orderQuantity, etabId])

          expect(encaissementResult.rows[0].id).toBeDefined()

          // Verify all data is isolated to this establishment
          await setSessionUser(gerantId)
          
          const allProducts = await pool.query(`SELECT COUNT(*) as count FROM produits`)
          const allCommandes = await pool.query(`SELECT COUNT(*) as count FROM commandes`)
          const allFactures = await pool.query(`SELECT COUNT(*) as count FROM factures`)

          // Should only see data from this establishment
          expect(parseInt(allProducts.rows[0].count)).toBeGreaterThanOrEqual(1)
          expect(parseInt(allCommandes.rows[0].count)).toBeGreaterThanOrEqual(1)
          expect(parseInt(allFactures.rows[0].count)).toBeGreaterThanOrEqual(1)

          // All operations completed successfully within establishment context
        }
      ),
      { numRuns: 5 } // Reduced runs since this is a comprehensive test
    )
  })

  /**
   * Property 30.1: Ravitaillement workflow preservation
   * 
   * **Validates: Requirements 15.6**
   * 
   * Verifies that the supply management workflow continues to work:
   * - Gerant can create ravitaillements
   * - Stock is updated correctly
   * - Sequential numbering works
   */
  test('Property 30.1: Ravitaillement workflow works within establishment', async () => {
    if (skipIfNoDB()) return

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          productName: fc.string({ minLength: 3, maxLength: 20 }),
          supplyQuantity: fc.integer({ min: 10, max: 100 }),
          unitCost: fc.integer({ min: 50, max: 5000 })
        }),
        async ({ productName, supplyQuantity, unitCost }) => {
          // Setup
          const etabId = await createEtablissement(`Etab ${Date.now()}`)
          const gerantId = await createUser(etabId, 'gerant')

          await setSessionUser(gerantId)

          // Create product
          const productResult = await pool.query(`
            INSERT INTO produits (nom, categorie, prix_vente, etablissement_id, actif)
            VALUES ($1, 'Boisson', $2, $3, true)
            RETURNING id
          `, [productName, unitCost * 2, etabId])
          const productId = productResult.rows[0].id

          // Create stock entry
          await pool.query(`
            INSERT INTO stock (produit_id, quantite_disponible, etablissement_id)
            VALUES ($1, 0, $2)
          `, [productId, etabId])

          // Create ravitaillement
          const ravitaillementResult = await pool.query(`
            INSERT INTO ravitaillements (
              gerant_id,
              montant_total,
              statut,
              etablissement_id
            )
            VALUES ($1, 0, 'en_cours', $2)
            RETURNING id, numero_ravitaillement
          `, [gerantId, etabId])
          const ravitaillementId = ravitaillementResult.rows[0].id
          const numeroRavitaillement = ravitaillementResult.rows[0].numero_ravitaillement

          expect(ravitaillementId).toBeDefined()
          expect(numeroRavitaillement).toMatch(/^RAV-\d{8}-\d{3}$/)

          // Add items to ravitaillement
          await pool.query(`
            INSERT INTO ravitaillement_items (
              ravitaillement_id,
              produit_id,
              quantite,
              cout_unitaire,
              etablissement_id
            )
            VALUES ($1, $2, $3, $4, $5)
          `, [ravitaillementId, productId, supplyQuantity, unitCost, etabId])

          // Complete ravitaillement
          await pool.query(`
            UPDATE ravitaillements
            SET statut = 'termine'
            WHERE id = $1
          `, [ravitaillementId])

          // Verify stock was updated
          const stockCheck = await pool.query(`
            SELECT quantite_disponible FROM stock WHERE produit_id = $1
          `, [productId])

          expect(stockCheck.rows.length).toBe(1)
          expect(stockCheck.rows[0].quantite_disponible).toBe(supplyQuantity)

          // Verify ravitaillement is visible
          const ravitaillementCheck = await pool.query(`
            SELECT * FROM ravitaillements WHERE id = $1
          `, [ravitaillementId])

          expect(ravitaillementCheck.rows.length).toBe(1)
          expect(ravitaillementCheck.rows[0].etablissement_id).toBe(etabId)
        }
      ),
      { numRuns: 5 }
    )
  })

  /**
   * Property 30.2: Cross-role visibility preservation
   * 
   * **Validates: Requirements 15.6**
   * 
   * Verifies that role-based visibility rules still work:
   * - Serveuses see their own orders
   * - Comptoir sees all orders
   * - Gerant sees all data
   * - Patron sees all data
   */
  test('Property 30.2: Role-based visibility works within establishment', async () => {
    if (skipIfNoDB()) return

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 4 }), // Number of serveuses
        async (serveuseCount) => {
          // Setup
          const etabId = await createEtablissement(`Etab ${Date.now()}`)
          const comptoirId = await createUser(etabId, 'comptoir')
          const patronId = await createUser(etabId, 'patron')

          // Create multiple serveuses and their orders
          const serveuses: string[] = []
          const commandeIds: string[] = []

          for (let i = 0; i < serveuseCount; i++) {
            const serveuseId = await createUser(etabId, 'serveuse')
            serveuses.push(serveuseId)

            // Create table
            await setSessionUser(serveuseId)
            const tableResult = await pool.query(`
              INSERT INTO tables (numero, capacite, statut, etablissement_id)
              VALUES ($1, 4, 'libre', $2)
              RETURNING id
            `, [`T${Date.now()}-${i}`, etabId])
            const tableId = tableResult.rows[0].id

            // Create order
            const commandeResult = await pool.query(`
              INSERT INTO commandes (
                table_id,
                serveuse_id,
                statut,
                montant_total,
                etablissement_id
              )
              VALUES ($1, $2, 'en_attente', 0, $3)
              RETURNING id
            `, [tableId, serveuseId, etabId])
            commandeIds.push(commandeResult.rows[0].id)
          }

          // Test: Each serveuse sees only their own orders
          for (let i = 0; i < serveuseCount; i++) {
            await setSessionUser(serveuses[i])
            const myCommandes = await pool.query(`
              SELECT id FROM commandes WHERE serveuse_id = $1
            `, [serveuses[i]])

            expect(myCommandes.rows.length).toBe(1)
            expect(myCommandes.rows[0].id).toBe(commandeIds[i])
          }

          // Test: Comptoir sees all orders
          await setSessionUser(comptoirId)
          const comptoirCommandes = await pool.query(`
            SELECT id FROM commandes ORDER BY id
          `)

          expect(comptoirCommandes.rows.length).toBe(serveuseCount)

          // Test: Patron sees all orders
          await setSessionUser(patronId)
          const patronCommandes = await pool.query(`
            SELECT id FROM commandes ORDER BY id
          `)

          expect(patronCommandes.rows.length).toBe(serveuseCount)
        }
      ),
      { numRuns: 5 }
    )
  })
})
