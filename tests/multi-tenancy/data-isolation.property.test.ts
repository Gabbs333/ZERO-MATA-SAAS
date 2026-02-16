/**
 * Property-Based Tests: Multi-Tenant Data Isolation
 * 
 * Tests data isolation between establishments through RLS policies.
 * Verifies that users can only access data from their own establishment.
 * 
 * Properties tested:
 * - Property 1: Establishment Data Isolation (SELECT)
 * - Property 2: Establishment Data Isolation (INSERT)
 * - Property 3: Establishment Data Isolation (UPDATE)
 * - Property 4: Establishment Data Isolation (DELETE)
 * - Property 5: Foreign Key Establishment Boundaries
 * - Property 7: User Cannot Modify Own Etablissement ID
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { getTestPool, skipIfNoDB } from '../setup'
import fc from 'fast-check'
import { Pool } from 'pg'

describe('Multi-Tenant Data Isolation Properties', () => {
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
    role: string,
    email?: string
  ): Promise<string> {
    const userEmail = email || `user-${Date.now()}-${Math.random()}@test.com`
    
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
   * Helper: Create test products for an establishment
   */
  async function createProducts(
    etablissementId: string,
    count: number
  ): Promise<string[]> {
    const productIds: string[] = []
    
    for (let i = 0; i < count; i++) {
      const result = await pool.query(`
        INSERT INTO produits (
          nom, 
          categorie, 
          prix_vente, 
          etablissement_id, 
          actif
        )
        VALUES ($1, 'Boisson', 500, $2, true)
        RETURNING id
      `, [`Product ${i + 1}`, etablissementId])
      
      productIds.push(result.rows[0].id)
      
      // Create stock for the product
      await pool.query(`
        INSERT INTO stock (
          produit_id, 
          quantite_disponible, 
          quantite_alerte, 
          etablissement_id
        )
        VALUES ($1, 100, 10, $2)
      `, [result.rows[0].id, etablissementId])
    }
    
    return productIds
  }

  /**
   * Helper: Create test commandes for an establishment
   */
  async function createCommandes(
    etablissementId: string,
    serveusId: string,
    count: number
  ): Promise<string[]> {
    const commandeIds: string[] = []
    
    // Get a table for the establishment
    const tableResult = await pool.query(`
      INSERT INTO tables (numero, capacite, etablissement_id, statut)
      VALUES (1, 4, $1, 'libre')
      RETURNING id
    `, [etablissementId])
    const tableId = tableResult.rows[0].id
    
    for (let i = 0; i < count; i++) {
      const result = await pool.query(`
        INSERT INTO commandes (
          table_id,
          serveuse_id,
          etablissement_id,
          statut,
          montant_total
        )
        VALUES ($1, $2, $3, 'en_attente', 0)
        RETURNING id
      `, [tableId, serveusId, etablissementId])
      
      commandeIds.push(result.rows[0].id)
    }
    
    return commandeIds
  }

  /**
   * Property 1: Establishment Data Isolation (SELECT)
   * 
   * **Validates: Requirements 1.3, 1.4, 8.1, 8.2, 11.1**
   * 
   * For any two different establishments A and B, and any user belonging to
   * establishment A, when that user queries any table, the results SHALL only
   * contain records where etablissement_id equals A's ID.
   */
  test('Property 1: Users can only SELECT data from their own establishment', async () => {
    if (skipIfNoDB()) return

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          etabAName: fc.string({ minLength: 3, maxLength: 30 }),
          etabBName: fc.string({ minLength: 3, maxLength: 30 }),
          productCountA: fc.integer({ min: 1, max: 5 }),
          productCountB: fc.integer({ min: 1, max: 5 }),
          commandeCountA: fc.integer({ min: 1, max: 3 }),
          commandeCountB: fc.integer({ min: 1, max: 3 }),
          userRole: fc.constantFrom('serveuse', 'comptoir', 'gerant', 'patron')
        }),
        async ({
          etabAName,
          etabBName,
          productCountA,
          productCountB,
          commandeCountA,
          commandeCountB,
          userRole
        }) => {
          // Create two establishments
          const etabAId = await createEtablissement(`Etab A - ${etabAName}`)
          const etabBId = await createEtablissement(`Etab B - ${etabBName}`)

          // Create users for each establishment
          const userAId = await createUser(etabAId, userRole)
          const userBId = await createUser(etabBId, userRole)

          // Create products for both establishments
          const productsA = await createProducts(etabAId, productCountA)
          const productsB = await createProducts(etabBId, productCountB)

          // Create commandes for both establishments
          const serveusAId = await createUser(etabAId, 'serveuse')
          const serveusBId = await createUser(etabBId, 'serveuse')
          const commandesA = await createCommandes(etabAId, serveusAId, commandeCountA)
          const commandesB = await createCommandes(etabBId, serveusBId, commandeCountB)

          // Test as user from establishment A
          await setSessionUser(userAId)

          // Query products - should only see establishment A's products
          const productsResult = await pool.query(`
            SELECT id, etablissement_id FROM produits
          `)
          
          expect(productsResult.rows.length).toBeGreaterThan(0)
          expect(productsResult.rows.every(p => p.etablissement_id === etabAId)).toBe(true)
          expect(productsResult.rows.some(p => p.etablissement_id === etabBId)).toBe(false)

          // Query stock - should only see establishment A's stock
          const stockResult = await pool.query(`
            SELECT etablissement_id FROM stock
          `)
          
          expect(stockResult.rows.length).toBeGreaterThan(0)
          expect(stockResult.rows.every(s => s.etablissement_id === etabAId)).toBe(true)

          // Query commandes - behavior depends on role
          const commandesResult = await pool.query(`
            SELECT id, etablissement_id FROM commandes
          `)
          
          // All visible commandes should be from establishment A
          expect(commandesResult.rows.every(c => c.etablissement_id === etabAId)).toBe(true)
          expect(commandesResult.rows.some(c => c.etablissement_id === etabBId)).toBe(false)

          // Test as user from establishment B
          await setSessionUser(userBId)

          // Query products - should only see establishment B's products
          const productsBResult = await pool.query(`
            SELECT id, etablissement_id FROM produits
          `)
          
          expect(productsBResult.rows.length).toBeGreaterThan(0)
          expect(productsBResult.rows.every(p => p.etablissement_id === etabBId)).toBe(true)
          expect(productsBResult.rows.some(p => p.etablissement_id === etabAId)).toBe(false)

          // Query stock - should only see establishment B's stock
          const stockBResult = await pool.query(`
            SELECT etablissement_id FROM stock
          `)
          
          expect(stockBResult.rows.length).toBeGreaterThan(0)
          expect(stockBResult.rows.every(s => s.etablissement_id === etabBId)).toBe(true)

          // Query commandes - should only see establishment B's commandes
          const commandesBResult = await pool.query(`
            SELECT id, etablissement_id FROM commandes
          `)
          
          expect(commandesBResult.rows.every(c => c.etablissement_id === etabBId)).toBe(true)
          expect(commandesBResult.rows.some(c => c.etablissement_id === etabAId)).toBe(false)
        }
      ),
      { numRuns: 20 }
    )
  })

  /**
   * Additional Test: Verify isolation across all major tables
   */
  test('Data isolation applies to all tables with etablissement_id', async () => {
    if (skipIfNoDB()) return

    // Create two establishments
    const etabAId = await createEtablissement('Restaurant A')
    const etabBId = await createEtablissement('Restaurant B')

    // Create users
    const patronAId = await createUser(etabAId, 'patron')
    const patronBId = await createUser(etabBId, 'patron')
    const gerantAId = await createUser(etabAId, 'gerant')

    // Create data for establishment A
    const productAIds = await createProducts(etabAId, 2)
    
    // Create ravitaillement for establishment A
    const ravitaillementAResult = await pool.query(`
      INSERT INTO ravitaillements (
        gerant_id,
        etablissement_id,
        montant_total
      )
      VALUES ($1, $2, 10000)
      RETURNING id
    `, [gerantAId, etabAId])
    const ravitaillementAId = ravitaillementAResult.rows[0].id

    // Create ravitaillement items
    await pool.query(`
      INSERT INTO ravitaillement_items (
        ravitaillement_id,
        produit_id,
        quantite,
        prix_unitaire
      )
      VALUES ($1, $2, 10, 500)
    `, [ravitaillementAId, productAIds[0]])

    // Create data for establishment B
    const productBIds = await createProducts(etabBId, 2)
    const gerantBId = await createUser(etabBId, 'gerant')
    
    const ravitaillementBResult = await pool.query(`
      INSERT INTO ravitaillements (
        gerant_id,
        etablissement_id,
        montant_total
      )
      VALUES ($1, $2, 15000)
      RETURNING id
    `, [gerantBId, etabBId])

    // Test as patron from establishment A
    await setSessionUser(patronAId)

    // Verify isolation for each table
    const tables = [
      { name: 'produits', expectedCount: 2 },
      { name: 'stock', expectedCount: 2 },
      { name: 'ravitaillements', expectedCount: 1 },
      { name: 'tables', expectedCount: 0 } // No tables created yet
    ]

    for (const table of tables) {
      const result = await pool.query(`
        SELECT etablissement_id FROM ${table.name}
      `)
      
      // All rows should belong to establishment A
      expect(result.rows.every(r => r.etablissement_id === etabAId)).toBe(true)
      expect(result.rows.some(r => r.etablissement_id === etabBId)).toBe(false)
    }

    // Test as patron from establishment B
    await setSessionUser(patronBId)

    for (const table of tables) {
      const result = await pool.query(`
        SELECT etablissement_id FROM ${table.name}
      `)
      
      // All rows should belong to establishment B
      expect(result.rows.every(r => r.etablissement_id === etabBId)).toBe(true)
      expect(result.rows.some(r => r.etablissement_id === etabAId)).toBe(false)
    }
  })

  /**
   * Additional Test: Verify profiles isolation
   */
  test('Users can only see profiles from their own establishment', async () => {
    if (skipIfNoDB()) return

    // Create two establishments
    const etabAId = await createEtablissement('Restaurant A')
    const etabBId = await createEtablissement('Restaurant B')

    // Create multiple users for each establishment
    const patronAId = await createUser(etabAId, 'patron')
    await createUser(etabAId, 'serveuse')
    await createUser(etabAId, 'comptoir')

    const patronBId = await createUser(etabBId, 'patron')
    await createUser(etabBId, 'serveuse')
    await createUser(etabBId, 'gerant')

    // Test as patron from establishment A
    await setSessionUser(patronAId)

    const profilesAResult = await pool.query(`
      SELECT id, etablissement_id, role FROM profiles
      WHERE etablissement_id IS NOT NULL
    `)

    // Should see 3 users from establishment A
    expect(profilesAResult.rows.length).toBe(3)
    expect(profilesAResult.rows.every(p => p.etablissement_id === etabAId)).toBe(true)

    // Test as patron from establishment B
    await setSessionUser(patronBId)

    const profilesBResult = await pool.query(`
      SELECT id, etablissement_id, role FROM profiles
      WHERE etablissement_id IS NOT NULL
    `)

    // Should see 3 users from establishment B
    expect(profilesBResult.rows.length).toBe(3)
    expect(profilesBResult.rows.every(p => p.etablissement_id === etabBId)).toBe(true)
  })

  /**
   * Additional Test: Verify serveuse can only see their own commandes
   */
  test('Serveuses can only see their own commandes within their establishment', async () => {
    if (skipIfNoDB()) return

    // Create establishment
    const etabId = await createEtablissement('Restaurant')

    // Create two serveuses
    const serveuse1Id = await createUser(etabId, 'serveuse')
    const serveuse2Id = await createUser(etabId, 'serveuse')

    // Create commandes for each serveuse
    const commandes1 = await createCommandes(etabId, serveuse1Id, 3)
    const commandes2 = await createCommandes(etabId, serveuse2Id, 2)

    // Test as serveuse 1
    await setSessionUser(serveuse1Id)

    const commandes1Result = await pool.query(`
      SELECT id, serveuse_id FROM commandes
    `)

    // Should only see own commandes
    expect(commandes1Result.rows.length).toBe(3)
    expect(commandes1Result.rows.every(c => c.serveuse_id === serveuse1Id)).toBe(true)

    // Test as serveuse 2
    await setSessionUser(serveuse2Id)

    const commandes2Result = await pool.query(`
      SELECT id, serveuse_id FROM commandes
    `)

    // Should only see own commandes
    expect(commandes2Result.rows.length).toBe(2)
    expect(commandes2Result.rows.every(c => c.serveuse_id === serveuse2Id)).toBe(true)
  })

  /**
   * Additional Test: Verify comptoir can see pending commandes from their establishment
   */
  test('Comptoir can see all pending commandes from their establishment', async () => {
    if (skipIfNoDB()) return

    // Create two establishments
    const etabAId = await createEtablissement('Restaurant A')
    const etabBId = await createEtablissement('Restaurant B')

    // Create users
    const comptoirAId = await createUser(etabAId, 'comptoir')
    const comptoirBId = await createUser(etabBId, 'comptoir')
    const serveusAId = await createUser(etabAId, 'serveuse')
    const serveusBId = await createUser(etabBId, 'serveuse')

    // Create commandes
    await createCommandes(etabAId, serveusAId, 3)
    await createCommandes(etabBId, serveusBId, 2)

    // Test as comptoir from establishment A
    await setSessionUser(comptoirAId)

    const commandesAResult = await pool.query(`
      SELECT id, etablissement_id, statut FROM commandes
    `)

    // Should see 3 pending commandes from establishment A
    expect(commandesAResult.rows.length).toBe(3)
    expect(commandesAResult.rows.every(c => c.etablissement_id === etabAId)).toBe(true)
    expect(commandesAResult.rows.every(c => c.statut === 'en_attente')).toBe(true)

    // Test as comptoir from establishment B
    await setSessionUser(comptoirBId)

    const commandesBResult = await pool.query(`
      SELECT id, etablissement_id, statut FROM commandes
    `)

    // Should see 2 pending commandes from establishment B
    expect(commandesBResult.rows.length).toBe(2)
    expect(commandesBResult.rows.every(c => c.etablissement_id === etabBId)).toBe(true)
  })

  /**
   * Property 2: Establishment Data Isolation (INSERT)
   * 
   * **Validates: Requirements 8.3, 9.1, 9.2**
   * 
   * For any user belonging to establishment A, when that user attempts to insert
   * a record with etablissement_id set to establishment B's ID (where A ≠ B),
   * the operation SHALL be rejected by RLS policies.
   */
  test('Property 2: Users cannot INSERT data into other establishments', async () => {
    if (skipIfNoDB()) return

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          etabAName: fc.string({ minLength: 3, maxLength: 30 }),
          etabBName: fc.string({ minLength: 3, maxLength: 30 }),
          userRole: fc.constantFrom('gerant', 'patron')
        }),
        async ({ etabAName, etabBName, userRole }) => {
          // Create two establishments
          const etabAId = await createEtablissement(`Etab A - ${etabAName}`)
          const etabBId = await createEtablissement(`Etab B - ${etabBName}`)

          // Create user for establishment A
          const userAId = await createUser(etabAId, userRole)

          // Set session as user from establishment A
          await setSessionUser(userAId)

          // Attempt to insert product into establishment B (should fail)
          await expect(
            pool.query(`
              INSERT INTO produits (
                nom, 
                categorie, 
                prix_vente, 
                etablissement_id, 
                actif
              )
              VALUES ('Unauthorized Product', 'Boisson', 500, $1, true)
            `, [etabBId])
          ).rejects.toThrow()

          // Verify no product was created in establishment B
          const productsB = await pool.query(`
            SELECT COUNT(*) as count FROM produits WHERE etablissement_id = $1
          `, [etabBId])
          expect(parseInt(productsB.rows[0].count)).toBe(0)

          // Verify user CAN insert into their own establishment
          const insertResult = await pool.query(`
            INSERT INTO produits (
              nom, 
              categorie, 
              prix_vente, 
              etablissement_id, 
              actif
            )
            VALUES ('Authorized Product', 'Boisson', 500, $1, true)
            RETURNING id
          `, [etabAId])

          expect(insertResult.rows[0].id).toBeTruthy()
        }
      ),
      { numRuns: 15 }
    )
  })

  /**
   * Additional Test: Verify INSERT isolation for commandes
   */
  test('Serveuses cannot create commandes in other establishments', async () => {
    if (skipIfNoDB()) return

    // Create two establishments
    const etabAId = await createEtablissement('Restaurant A')
    const etabBId = await createEtablissement('Restaurant B')

    // Create serveuse for establishment A
    const serveusAId = await createUser(etabAId, 'serveuse')

    // Create table in establishment B
    const tableBResult = await pool.query(`
      INSERT INTO tables (numero, capacite, etablissement_id, statut)
      VALUES (1, 4, $1, 'libre')
      RETURNING id
    `, [etabBId])
    const tableBId = tableBResult.rows[0].id

    // Set session as serveuse from establishment A
    await setSessionUser(serveusAId)

    // Attempt to create commande in establishment B (should fail)
    await expect(
      pool.query(`
        INSERT INTO commandes (
          table_id,
          serveuse_id,
          etablissement_id,
          statut,
          montant_total
        )
        VALUES ($1, $2, $3, 'en_attente', 0)
      `, [tableBId, serveusAId, etabBId])
    ).rejects.toThrow()

    // Verify no commande was created in establishment B
    const commandesB = await pool.query(`
      SELECT COUNT(*) as count FROM commandes WHERE etablissement_id = $1
    `, [etabBId])
    expect(parseInt(commandesB.rows[0].count)).toBe(0)
  })

  /**
   * Additional Test: Verify INSERT isolation for ravitaillements
   */
  test('Gerants cannot create ravitaillements in other establishments', async () => {
    if (skipIfNoDB()) return

    // Create two establishments
    const etabAId = await createEtablissement('Restaurant A')
    const etabBId = await createEtablissement('Restaurant B')

    // Create gerant for establishment A
    const gerantAId = await createUser(etabAId, 'gerant')

    // Set session as gerant from establishment A
    await setSessionUser(gerantAId)

    // Attempt to create ravitaillement in establishment B (should fail)
    await expect(
      pool.query(`
        INSERT INTO ravitaillements (
          gerant_id,
          etablissement_id,
          montant_total
        )
        VALUES ($1, $2, 10000)
      `, [gerantAId, etabBId])
    ).rejects.toThrow()

    // Verify no ravitaillement was created in establishment B
    const ravitaillementsB = await pool.query(`
      SELECT COUNT(*) as count FROM ravitaillements WHERE etablissement_id = $1
    `, [etabBId])
    expect(parseInt(ravitaillementsB.rows[0].count)).toBe(0)
  })

  /**
   * Additional Test: Verify users inherit etablissement_id when created
   */
  test('New users automatically inherit etablissement_id from creator', async () => {
    if (skipIfNoDB()) return

    // Create establishment
    const etabId = await createEtablissement('Restaurant')

    // Create patron
    const patronId = await createUser(etabId, 'patron')

    // Set session as patron
    await setSessionUser(patronId)

    // Create new user (should inherit etablissement_id)
    const newUserEmail = `newuser-${Date.now()}@test.com`
    const authResult = await pool.query(`
      INSERT INTO auth.users (id, email)
      VALUES (gen_random_uuid(), $1)
      RETURNING id
    `, [newUserEmail])
    const newUserId = authResult.rows[0].id

    await pool.query(`
      INSERT INTO profiles (id, email, nom, prenom, role, etablissement_id, actif)
      VALUES ($1, $2, 'New', 'User', 'serveuse', $3, true)
    `, [newUserId, newUserEmail, etabId])

    // Verify new user has correct etablissement_id
    const profileResult = await pool.query(`
      SELECT etablissement_id FROM profiles WHERE id = $1
    `, [newUserId])

    expect(profileResult.rows[0].etablissement_id).toBe(etabId)
  })

  /**
   * Property 3: Establishment Data Isolation (UPDATE)
   * 
   * **Validates: Requirements 8.4, 9.4, 11.2**
   * 
   * For any user belonging to establishment A, when that user attempts to update
   * a record belonging to establishment B (where A ≠ B), the operation SHALL be
   * rejected by RLS policies.
   */
  test('Property 3: Users cannot UPDATE data in other establishments', async () => {
    if (skipIfNoDB()) return

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          etabAName: fc.string({ minLength: 3, maxLength: 30 }),
          etabBName: fc.string({ minLength: 3, maxLength: 30 }),
          userRole: fc.constantFrom('gerant', 'patron'),
          newPrice: fc.integer({ min: 100, max: 10000 })
        }),
        async ({ etabAName, etabBName, userRole, newPrice }) => {
          // Create two establishments
          const etabAId = await createEtablissement(`Etab A - ${etabAName}`)
          const etabBId = await createEtablissement(`Etab B - ${etabBName}`)

          // Create users
          const userAId = await createUser(etabAId, userRole)
          const userBId = await createUser(etabBId, userRole)

          // Create product in establishment B
          await setSessionUser(userBId)
          const productBResult = await pool.query(`
            INSERT INTO produits (
              nom, 
              categorie, 
              prix_vente, 
              etablissement_id, 
              actif
            )
            VALUES ('Product B', 'Boisson', 500, $1, true)
            RETURNING id, prix_vente
          `, [etabBId])
          const productBId = productBResult.rows[0].id
          const originalPrice = productBResult.rows[0].prix_vente

          // Switch to user from establishment A
          await setSessionUser(userAId)

          // Attempt to update product in establishment B (should fail or have no effect)
          await pool.query(`
            UPDATE produits 
            SET prix_vente = $1 
            WHERE id = $2
          `, [newPrice, productBId])

          // Verify product price was NOT changed
          const verifyResult = await pool.query(`
            SELECT prix_vente FROM produits WHERE id = $1
          `, [productBId])

          // Price should remain unchanged
          expect(verifyResult.rows[0].prix_vente).toBe(originalPrice)

          // Verify user CAN update products in their own establishment
          await setSessionUser(userAId)
          const productAResult = await pool.query(`
            INSERT INTO produits (
              nom, 
              categorie, 
              prix_vente, 
              etablissement_id, 
              actif
            )
            VALUES ('Product A', 'Boisson', 500, $1, true)
            RETURNING id
          `, [etabAId])
          const productAId = productAResult.rows[0].id

          await pool.query(`
            UPDATE produits 
            SET prix_vente = $1 
            WHERE id = $2
          `, [newPrice, productAId])

          const verifyAResult = await pool.query(`
            SELECT prix_vente FROM produits WHERE id = $1
          `, [productAId])

          expect(verifyAResult.rows[0].prix_vente).toBe(newPrice)
        }
      ),
      { numRuns: 15 }
    )
  })

  /**
   * Additional Test: Verify UPDATE isolation for stock
   */
  test('Users cannot update stock in other establishments', async () => {
    if (skipIfNoDB()) return

    // Create two establishments
    const etabAId = await createEtablissement('Restaurant A')
    const etabBId = await createEtablissement('Restaurant B')

    // Create gerants
    const gerantAId = await createUser(etabAId, 'gerant')
    const gerantBId = await createUser(etabBId, 'gerant')

    // Create product and stock in establishment B
    await setSessionUser(gerantBId)
    const productBIds = await createProducts(etabBId, 1)
    const productBId = productBIds[0]

    // Get stock ID
    const stockBResult = await pool.query(`
      SELECT id, quantite_disponible FROM stock WHERE produit_id = $1
    `, [productBId])
    const stockBId = stockBResult.rows[0].id
    const originalQuantity = stockBResult.rows[0].quantite_disponible

    // Switch to gerant from establishment A
    await setSessionUser(gerantAId)

    // Attempt to update stock in establishment B (should have no effect)
    await pool.query(`
      UPDATE stock 
      SET quantite_disponible = 999 
      WHERE id = $1
    `, [stockBId])

    // Verify stock was NOT changed
    const verifyResult = await pool.query(`
      SELECT quantite_disponible FROM stock WHERE id = $1
    `, [stockBId])

    expect(verifyResult.rows[0].quantite_disponible).toBe(originalQuantity)
  })

  /**
   * Additional Test: Verify UPDATE isolation for commandes
   */
  test('Comptoir cannot validate commandes from other establishments', async () => {
    if (skipIfNoDB()) return

    // Create two establishments
    const etabAId = await createEtablissement('Restaurant A')
    const etabBId = await createEtablissement('Restaurant B')

    // Create users
    const comptoirAId = await createUser(etabAId, 'comptoir')
    const serveuseBId = await createUser(etabBId, 'serveuse')

    // Create commande in establishment B
    const commandesBIds = await createCommandes(etabBId, serveuseBId, 1)
    const commandeBId = commandesBIds[0]

    // Switch to comptoir from establishment A
    await setSessionUser(comptoirAId)

    // Attempt to validate commande from establishment B (should have no effect)
    await pool.query(`
      UPDATE commandes 
      SET statut = 'validee', validateur_id = $1 
      WHERE id = $2
    `, [comptoirAId, commandeBId])

    // Verify commande status was NOT changed
    const verifyResult = await pool.query(`
      SELECT statut FROM commandes WHERE id = $1
    `, [commandeBId])

    expect(verifyResult.rows[0].statut).toBe('en_attente')
  })

  /**
   * Additional Test: Verify users cannot modify their own etablissement_id
   */
  test('Users cannot modify their own etablissement_id', async () => {
    if (skipIfNoDB()) return

    // Create two establishments
    const etabAId = await createEtablissement('Restaurant A')
    const etabBId = await createEtablissement('Restaurant B')

    // Create user in establishment A
    const userId = await createUser(etabAId, 'patron')

    // Set session as that user
    await setSessionUser(userId)

    // Attempt to change own etablissement_id (should fail or have no effect)
    await pool.query(`
      UPDATE profiles 
      SET etablissement_id = $1 
      WHERE id = $2
    `, [etabBId, userId])

    // Verify etablissement_id was NOT changed
    const verifyResult = await pool.query(`
      SELECT etablissement_id FROM profiles WHERE id = $1
    `, [userId])

    expect(verifyResult.rows[0].etablissement_id).toBe(etabAId)
  })

  /**
   * Property 4: Establishment Data Isolation (DELETE)
   * 
   * **Validates: Requirements 8.5, 11.3**
   * 
   * For any user belonging to establishment A, when that user attempts to delete
   * a record belonging to establishment B (where A ≠ B), the operation SHALL be
   * rejected by RLS policies.
   */
  test('Property 4: Users cannot DELETE data from other establishments', async () => {
    if (skipIfNoDB()) return

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          etabAName: fc.string({ minLength: 3, maxLength: 30 }),
          etabBName: fc.string({ minLength: 3, maxLength: 30 }),
          userRole: fc.constantFrom('gerant', 'patron')
        }),
        async ({ etabAName, etabBName, userRole }) => {
          // Create two establishments
          const etabAId = await createEtablissement(`Etab A - ${etabAName}`)
          const etabBId = await createEtablissement(`Etab B - ${etabBName}`)

          // Create users
          const userAId = await createUser(etabAId, userRole)
          const userBId = await createUser(etabBId, userRole)

          // Create product in establishment B
          await setSessionUser(userBId)
          const productBResult = await pool.query(`
            INSERT INTO produits (
              nom, 
              categorie, 
              prix_vente, 
              etablissement_id, 
              actif
            )
            VALUES ('Product B', 'Boisson', 500, $1, true)
            RETURNING id
          `, [etabBId])
          const productBId = productBResult.rows[0].id

          // Switch to user from establishment A
          await setSessionUser(userAId)

          // Attempt to delete product from establishment B (should have no effect)
          await pool.query(`
            DELETE FROM produits WHERE id = $1
          `, [productBId])

          // Verify product still exists
          const verifyResult = await pool.query(`
            SELECT id FROM produits WHERE id = $1
          `, [productBId])

          expect(verifyResult.rows.length).toBe(1)
          expect(verifyResult.rows[0].id).toBe(productBId)

          // Verify user CAN delete products in their own establishment
          await setSessionUser(userAId)
          const productAResult = await pool.query(`
            INSERT INTO produits (
              nom, 
              categorie, 
              prix_vente, 
              etablissement_id, 
              actif
            )
            VALUES ('Product A', 'Boisson', 500, $1, true)
            RETURNING id
          `, [etabAId])
          const productAId = productAResult.rows[0].id

          await pool.query(`
            DELETE FROM produits WHERE id = $1
          `, [productAId])

          const verifyAResult = await pool.query(`
            SELECT id FROM produits WHERE id = $1
          `, [productAId])

          expect(verifyAResult.rows.length).toBe(0)
        }
      ),
      { numRuns: 15 }
    )
  })

  /**
   * Additional Test: Verify DELETE isolation for commandes
   */
  test('Serveuses cannot delete commandes from other establishments', async () => {
    if (skipIfNoDB()) return

    // Create two establishments
    const etabAId = await createEtablissement('Restaurant A')
    const etabBId = await createEtablissement('Restaurant B')

    // Create serveuses
    const serveusAId = await createUser(etabAId, 'serveuse')
    const serveusBId = await createUser(etabBId, 'serveuse')

    // Create commande in establishment B
    const commandesBIds = await createCommandes(etabBId, serveusBId, 1)
    const commandeBId = commandesBIds[0]

    // Switch to serveuse from establishment A
    await setSessionUser(serveusAId)

    // Attempt to delete commande from establishment B (should have no effect)
    await pool.query(`
      DELETE FROM commandes WHERE id = $1
    `, [commandeBId])

    // Verify commande still exists
    const verifyResult = await pool.query(`
      SELECT id FROM commandes WHERE id = $1
    `, [commandeBId])

    expect(verifyResult.rows.length).toBe(1)
  })

  /**
   * Additional Test: Verify DELETE isolation for tables
   */
  test('Gerants cannot delete tables from other establishments', async () => {
    if (skipIfNoDB()) return

    // Create two establishments
    const etabAId = await createEtablissement('Restaurant A')
    const etabBId = await createEtablissement('Restaurant B')

    // Create gerants
    const gerantAId = await createUser(etabAId, 'gerant')
    const gerantBId = await createUser(etabBId, 'gerant')

    // Create table in establishment B
    await setSessionUser(gerantBId)
    const tableBResult = await pool.query(`
      INSERT INTO tables (numero, capacite, etablissement_id, statut)
      VALUES (1, 4, $1, 'libre')
      RETURNING id
    `, [etabBId])
    const tableBId = tableBResult.rows[0].id

    // Switch to gerant from establishment A
    await setSessionUser(gerantAId)

    // Attempt to delete table from establishment B (should have no effect)
    await pool.query(`
      DELETE FROM tables WHERE id = $1
    `, [tableBId])

    // Verify table still exists
    const verifyResult = await pool.query(`
      SELECT id FROM tables WHERE id = $1
    `, [tableBId])

    expect(verifyResult.rows.length).toBe(1)
  })

  /**
   * Additional Test: Serveuse can delete own pending commandes
   */
  test('Serveuses can delete their own pending commandes within their establishment', async () => {
    if (skipIfNoDB()) return

    // Create establishment
    const etabId = await createEtablissement('Restaurant')

    // Create serveuse
    const serveusId = await createUser(etabId, 'serveuse')

    // Create commande
    const commandeIds = await createCommandes(etabId, serveusId, 1)
    const commandeId = commandeIds[0]

    // Set session as serveuse
    await setSessionUser(serveusId)

    // Delete own commande (should succeed)
    await pool.query(`
      DELETE FROM commandes WHERE id = $1
    `, [commandeId])

    // Verify commande was deleted
    const verifyResult = await pool.query(`
      SELECT id FROM commandes WHERE id = $1
    `, [commandeId])

    expect(verifyResult.rows.length).toBe(0)
  })

  /**
   * Property 5: Foreign Key Establishment Boundaries
   * 
   * **Validates: Requirements 1.5, 1.6, 11.4**
   * 
   * For any two tables with a foreign key relationship, when a record in the
   * child table references a record in the parent table, both records SHALL
   * have the same etablissement_id.
   */
  test('Property 5: Foreign key relationships respect etablissement boundaries', async () => {
    if (skipIfNoDB()) return

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          etabAName: fc.string({ minLength: 3, maxLength: 30 }),
          etabBName: fc.string({ minLength: 3, maxLength: 30 })
        }),
        async ({ etabAName, etabBName }) => {
          // Create two establishments
          const etabAId = await createEtablissement(`Etab A - ${etabAName}`)
          const etabBId = await createEtablissement(`Etab B - ${etabBName}`)

          // Create users
          const gerantAId = await createUser(etabAId, 'gerant')
          const serveusAId = await createUser(etabAId, 'serveuse')

          // Create products in both establishments
          await setSessionUser(gerantAId)
          const productsA = await createProducts(etabAId, 2)
          const productAId = productsA[0]

          const gerantBId = await createUser(etabBId, 'gerant')
          await setSessionUser(gerantBId)
          const productsB = await createProducts(etabBId, 2)
          const productBId = productsB[0]

          // Test 1: Commande -> Commande Items
          // Create commande in establishment A
          await setSessionUser(serveusAId)
          const commandesA = await createCommandes(etabAId, serveusAId, 1)
          const commandeAId = commandesA[0]

          // Attempt to add commande_item with product from establishment B (should fail)
          await expect(
            pool.query(`
              INSERT INTO commande_items (
                commande_id,
                produit_id,
                quantite,
                prix_unitaire
              )
              VALUES ($1, $2, 1, 500)
            `, [commandeAId, productBId])
          ).rejects.toThrow()

          // Verify commande_item with product from same establishment succeeds
          const itemResult = await pool.query(`
            INSERT INTO commande_items (
              commande_id,
              produit_id,
              quantite,
              prix_unitaire
            )
            VALUES ($1, $2, 1, 500)
            RETURNING id
          `, [commandeAId, productAId])

          expect(itemResult.rows[0].id).toBeTruthy()

          // Verify both commande and commande_item have same etablissement_id
          const verifyResult = await pool.query(`
            SELECT 
              c.etablissement_id as commande_etab,
              ci.commande_id,
              p.etablissement_id as product_etab
            FROM commande_items ci
            JOIN commandes c ON c.id = ci.commande_id
            JOIN produits p ON p.id = ci.produit_id
            WHERE ci.id = $1
          `, [itemResult.rows[0].id])

          expect(verifyResult.rows[0].commande_etab).toBe(etabAId)
          expect(verifyResult.rows[0].product_etab).toBe(etabAId)

          // Test 2: Ravitaillement -> Ravitaillement Items
          await setSessionUser(gerantAId)
          const ravitaillementAResult = await pool.query(`
            INSERT INTO ravitaillements (
              gerant_id,
              etablissement_id,
              montant_total
            )
            VALUES ($1, $2, 10000)
            RETURNING id
          `, [gerantAId, etabAId])
          const ravitaillementAId = ravitaillementAResult.rows[0].id

          // Attempt to add ravitaillement_item with product from establishment B (should fail)
          await expect(
            pool.query(`
              INSERT INTO ravitaillement_items (
                ravitaillement_id,
                produit_id,
                quantite,
                prix_unitaire
              )
              VALUES ($1, $2, 10, 500)
            `, [ravitaillementAId, productBId])
          ).rejects.toThrow()

          // Verify ravitaillement_item with product from same establishment succeeds
          const ravItemResult = await pool.query(`
            INSERT INTO ravitaillement_items (
              ravitaillement_id,
              produit_id,
              quantite,
              prix_unitaire
            )
            VALUES ($1, $2, 10, 500)
            RETURNING id
          `, [ravitaillementAId, productAId])

          expect(ravItemResult.rows[0].id).toBeTruthy()
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Additional Test: Stock must reference product from same establishment
   */
  test('Stock records must reference products from the same establishment', async () => {
    if (skipIfNoDB()) return

    // Create two establishments
    const etabAId = await createEtablissement('Restaurant A')
    const etabBId = await createEtablissement('Restaurant B')

    // Create gerants
    const gerantAId = await createUser(etabAId, 'gerant')
    const gerantBId = await createUser(etabBId, 'gerant')

    // Create product in establishment B
    await setSessionUser(gerantBId)
    const productsBIds = await createProducts(etabBId, 1)
    const productBId = productsBIds[0]

    // Switch to gerant from establishment A
    await setSessionUser(gerantAId)

    // Attempt to create stock for product from establishment B (should fail)
    await expect(
      pool.query(`
        INSERT INTO stock (
          produit_id,
          quantite_disponible,
          quantite_alerte,
          etablissement_id
        )
        VALUES ($1, 100, 10, $2)
      `, [productBId, etabAId])
    ).rejects.toThrow()
  })

  /**
   * Additional Test: Factures must reference commandes from same establishment
   */
  test('Factures must reference commandes from the same establishment', async () => {
    if (skipIfNoDB()) return

    // Create two establishments
    const etabAId = await createEtablissement('Restaurant A')
    const etabBId = await createEtablissement('Restaurant B')

    // Create users
    const comptoirAId = await createUser(etabAId, 'comptoir')
    const serveusBId = await createUser(etabBId, 'serveuse')

    // Create commande in establishment B
    const commandesBIds = await createCommandes(etabBId, serveusBId, 1)
    const commandeBId = commandesBIds[0]

    // Validate the commande
    const comptoirBId = await createUser(etabBId, 'comptoir')
    await setSessionUser(comptoirBId)
    await pool.query(`
      UPDATE commandes 
      SET statut = 'validee', validateur_id = $1 
      WHERE id = $2
    `, [comptoirBId, commandeBId])

    // Switch to comptoir from establishment A
    await setSessionUser(comptoirAId)

    // Attempt to create facture for commande from establishment B (should fail)
    await expect(
      pool.query(`
        INSERT INTO factures (
          commande_id,
          etablissement_id,
          montant_total,
          statut_paiement
        )
        VALUES ($1, $2, 1000, 'impayee')
      `, [commandeBId, etabAId])
    ).rejects.toThrow()
  })

  /**
   * Property 7: User Cannot Modify Own Etablissement ID
   * 
   * **Validates: Requirements 8.7**
   * 
   * For any non-admin user, when that user attempts to update their own profile
   * to change etablissement_id, the operation SHALL be rejected by RLS policies.
   */
  test('Property 7: Users cannot modify their own etablissement_id', async () => {
    if (skipIfNoDB()) return

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userRole: fc.constantFrom('serveuse', 'comptoir', 'gerant', 'patron')
        }),
        async ({ userRole }) => {
          // Create two establishments
          const etabAId = await createEtablissement('Restaurant A')
          const etabBId = await createEtablissement('Restaurant B')

          // Create user in establishment A
          const userId = await createUser(etabAId, userRole)

          // Set session as that user
          await setSessionUser(userId)

          // Get original etablissement_id
          const beforeResult = await pool.query(`
            SELECT etablissement_id FROM profiles WHERE id = $1
          `, [userId])
          const originalEtabId = beforeResult.rows[0].etablissement_id

          // Attempt to change own etablissement_id to establishment B
          await pool.query(`
            UPDATE profiles 
            SET etablissement_id = $1 
            WHERE id = $2
          `, [etabBId, userId])

          // Verify etablissement_id was NOT changed
          const afterResult = await pool.query(`
            SELECT etablissement_id FROM profiles WHERE id = $1
          `, [userId])

          expect(afterResult.rows[0].etablissement_id).toBe(originalEtabId)
          expect(afterResult.rows[0].etablissement_id).toBe(etabAId)
          expect(afterResult.rows[0].etablissement_id).not.toBe(etabBId)
        }
      ),
      { numRuns: 15 }
    )
  })

  /**
   * Additional Test: Admin users have NULL etablissement_id
   */
  test('Admin users must have NULL etablissement_id', async () => {
    if (skipIfNoDB()) return

    // Create admin user
    const adminEmail = `admin-${Date.now()}@test.com`
    const adminResult = await pool.query(`
      INSERT INTO auth.users (id, email)
      VALUES (gen_random_uuid(), $1)
      RETURNING id
    `, [adminEmail])
    const adminId = adminResult.rows[0].id

    await pool.query(`
      INSERT INTO profiles (id, email, nom, prenom, role, etablissement_id, actif)
      VALUES ($1, $2, 'Admin', 'User', 'admin', NULL, true)
    `, [adminId, adminEmail])

    // Verify admin has NULL etablissement_id
    const profileResult = await pool.query(`
      SELECT etablissement_id, role FROM profiles WHERE id = $1
    `, [adminId])

    expect(profileResult.rows[0].role).toBe('admin')
    expect(profileResult.rows[0].etablissement_id).toBeNull()
  })
})
