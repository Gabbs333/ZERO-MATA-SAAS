/**
 * Property-Based Tests: Admin Cross-Establishment Access
 * 
 * Tests admin user access patterns across multiple establishments.
 * Verifies that admin users can read data from all establishments
 * but cannot perform establishment-specific operations.
 * 
 * Properties tested:
 * - Property 6: Admin Cross-Establishment Read Access
 * - Property 20: Admin Operation Restrictions
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { getTestPool, skipIfNoDB } from '../setup'
import fc from 'fast-check'
import { Pool } from 'pg'

describe('Admin Cross-Establishment Access Properties', () => {
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
    etablissementId: string | null,
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
   * Property 6: Admin Cross-Establishment Read Access
   * 
   * **Validates: Requirements 6.2, 6.4, 8.6, 11.5, 11.6**
   * 
   * For any user with role 'admin', when that user queries any table,
   * the results SHALL include records from all establishments
   * (no etablissement_id filtering applied).
   */
  test('Property 6: Admin users can read data from all establishments', async () => {
    if (skipIfNoDB()) return

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          numEstablishments: fc.integer({ min: 2, max: 4 }),
          productsPerEstab: fc.integer({ min: 1, max: 3 }),
          commandesPerEstab: fc.integer({ min: 1, max: 2 })
        }),
        async ({ numEstablishments, productsPerEstab, commandesPerEstab }) => {
          // Create admin user
          const adminId = await createUser(null, 'admin')

          // Create multiple establishments with data
          const etablissementIds: string[] = []
          const allProductIds: string[] = []
          const allCommandeIds: string[] = []

          for (let i = 0; i < numEstablishments; i++) {
            const etabId = await createEtablissement(`Restaurant ${i + 1}`)
            etablissementIds.push(etabId)

            // Create products for this establishment
            const productIds = await createProducts(etabId, productsPerEstab)
            allProductIds.push(...productIds)

            // Create commandes for this establishment
            const serveusId = await createUser(etabId, 'serveuse')
            const commandeIds = await createCommandes(etabId, serveusId, commandesPerEstab)
            allCommandeIds.push(...commandeIds)
          }

          // Set session as admin user
          await setSessionUser(adminId)

          // Test: Admin should see ALL products from ALL establishments
          const productsResult = await pool.query(`
            SELECT id, etablissement_id FROM produits
          `)

          expect(productsResult.rows.length).toBe(numEstablishments * productsPerEstab)
          
          // Verify products from all establishments are visible
          for (const etabId of etablissementIds) {
            const productsFromEtab = productsResult.rows.filter(
              p => p.etablissement_id === etabId
            )
            expect(productsFromEtab.length).toBe(productsPerEstab)
          }

          // Test: Admin should see ALL stock from ALL establishments
          const stockResult = await pool.query(`
            SELECT etablissement_id FROM stock
          `)

          expect(stockResult.rows.length).toBe(numEstablishments * productsPerEstab)
          
          // Verify stock from all establishments is visible
          for (const etabId of etablissementIds) {
            const stockFromEtab = stockResult.rows.filter(
              s => s.etablissement_id === etabId
            )
            expect(stockFromEtab.length).toBe(productsPerEstab)
          }

          // Test: Admin should see ALL commandes from ALL establishments
          const commandesResult = await pool.query(`
            SELECT id, etablissement_id FROM commandes
          `)

          expect(commandesResult.rows.length).toBe(numEstablishments * commandesPerEstab)
          
          // Verify commandes from all establishments are visible
          for (const etabId of etablissementIds) {
            const commandesFromEtab = commandesResult.rows.filter(
              c => c.etablissement_id === etabId
            )
            expect(commandesFromEtab.length).toBe(commandesPerEstab)
          }

          // Test: Admin should see ALL profiles from ALL establishments
          const profilesResult = await pool.query(`
            SELECT id, etablissement_id, role FROM profiles
            WHERE etablissement_id IS NOT NULL
          `)

          // Should see at least one serveuse per establishment
          expect(profilesResult.rows.length).toBeGreaterThanOrEqual(numEstablishments)
          
          // Verify profiles from all establishments are visible
          for (const etabId of etablissementIds) {
            const profilesFromEtab = profilesResult.rows.filter(
              p => p.etablissement_id === etabId
            )
            expect(profilesFromEtab.length).toBeGreaterThanOrEqual(1)
          }
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Additional Test: Admin can read all tables
   */
  test('Admin can read data from all major tables across establishments', async () => {
    if (skipIfNoDB()) return

    // Create admin user
    const adminId = await createUser(null, 'admin')

    // Create two establishments with comprehensive data
    const etabAId = await createEtablissement('Restaurant A')
    const etabBId = await createEtablissement('Restaurant B')

    // Create users for each establishment
    const gerantAId = await createUser(etabAId, 'gerant')
    const gerantBId = await createUser(etabBId, 'gerant')
    const serveusAId = await createUser(etabAId, 'serveuse')
    const serveusBId = await createUser(etabBId, 'serveuse')

    // Create products
    const productsA = await createProducts(etabAId, 2)
    const productsB = await createProducts(etabBId, 2)

    // Create ravitaillements
    await pool.query(`
      INSERT INTO ravitaillements (gerant_id, etablissement_id, montant_total)
      VALUES ($1, $2, 10000)
    `, [gerantAId, etabAId])

    await pool.query(`
      INSERT INTO ravitaillements (gerant_id, etablissement_id, montant_total)
      VALUES ($1, $2, 15000)
    `, [gerantBId, etabBId])

    // Create commandes
    await createCommandes(etabAId, serveusAId, 2)
    await createCommandes(etabBId, serveusBId, 2)

    // Set session as admin
    await setSessionUser(adminId)

    // Test: Admin can read all etablissements
    const etablissementsResult = await pool.query(`
      SELECT id FROM etablissements
    `)
    expect(etablissementsResult.rows.length).toBeGreaterThanOrEqual(2)

    // Test: Admin can read all produits
    const produitsResult = await pool.query(`
      SELECT etablissement_id FROM produits
    `)
    expect(produitsResult.rows.length).toBe(4)
    expect(produitsResult.rows.some(p => p.etablissement_id === etabAId)).toBe(true)
    expect(produitsResult.rows.some(p => p.etablissement_id === etabBId)).toBe(true)

    // Test: Admin can read all stock
    const stockResult = await pool.query(`
      SELECT etablissement_id FROM stock
    `)
    expect(stockResult.rows.length).toBe(4)
    expect(stockResult.rows.some(s => s.etablissement_id === etabAId)).toBe(true)
    expect(stockResult.rows.some(s => s.etablissement_id === etabBId)).toBe(true)

    // Test: Admin can read all ravitaillements
    const ravitaillementsResult = await pool.query(`
      SELECT etablissement_id FROM ravitaillements
    `)
    expect(ravitaillementsResult.rows.length).toBe(2)
    expect(ravitaillementsResult.rows.some(r => r.etablissement_id === etabAId)).toBe(true)
    expect(ravitaillementsResult.rows.some(r => r.etablissement_id === etabBId)).toBe(true)

    // Test: Admin can read all commandes
    const commandesResult = await pool.query(`
      SELECT etablissement_id FROM commandes
    `)
    expect(commandesResult.rows.length).toBe(4)
    expect(commandesResult.rows.some(c => c.etablissement_id === etabAId)).toBe(true)
    expect(commandesResult.rows.some(c => c.etablissement_id === etabBId)).toBe(true)

    // Test: Admin can read all profiles
    const profilesResult = await pool.query(`
      SELECT etablissement_id, role FROM profiles
      WHERE etablissement_id IS NOT NULL
    `)
    expect(profilesResult.rows.length).toBe(4) // 2 users per establishment
    expect(profilesResult.rows.some(p => p.etablissement_id === etabAId)).toBe(true)
    expect(profilesResult.rows.some(p => p.etablissement_id === etabBId)).toBe(true)
  })

  /**
   * Property 20: Admin Operation Restrictions
   * 
   * **Validates: Requirements 6.4, 11.6**
   * 
   * For any admin user, when that user attempts to perform an
   * establishment-specific operation (create commande, create ravitaillement, etc.)
   * without specifying an etablissement context, the operation SHALL be rejected.
   */
  test('Property 20: Admin cannot perform establishment-specific operations', async () => {
    if (skipIfNoDB()) return

    // Create admin user
    const adminId = await createUser(null, 'admin')

    // Create an establishment with necessary data
    const etabId = await createEtablissement('Restaurant Test')
    const productIds = await createProducts(etabId, 1)

    // Create a table
    const tableResult = await pool.query(`
      INSERT INTO tables (numero, capacite, etablissement_id, statut)
      VALUES (1, 4, $1, 'libre')
      RETURNING id
    `, [etabId])
    const tableId = tableResult.rows[0].id

    // Set session as admin
    await setSessionUser(adminId)

    // Test 1: Admin cannot create commandes (requires serveuse role in establishment)
    await expect(async () => {
      await pool.query(`
        INSERT INTO commandes (
          table_id,
          serveuse_id,
          etablissement_id,
          statut,
          montant_total
        )
        VALUES ($1, $2, $3, 'en_attente', 0)
      `, [tableId, adminId, etabId])
    }).rejects.toThrow()

    // Test 2: Admin cannot create ravitaillements (requires gerant role in establishment)
    await expect(async () => {
      await pool.query(`
        INSERT INTO ravitaillements (
          gerant_id,
          etablissement_id,
          montant_total
        )
        VALUES ($1, $2, 10000)
      `, [adminId, etabId])
    }).rejects.toThrow()

    // Test 3: Admin cannot create products (requires gerant/patron role in establishment)
    await expect(async () => {
      await pool.query(`
        INSERT INTO produits (
          nom,
          categorie,
          prix_vente,
          etablissement_id,
          actif
        )
        VALUES ('Test Product', 'Boisson', 500, $1, true)
      `, [etabId])
    }).rejects.toThrow()

    // Test 4: Admin cannot update stock (requires gerant/patron role in establishment)
    const stockResult = await pool.query(`
      SELECT id FROM stock WHERE etablissement_id = $1 LIMIT 1
    `, [etabId])
    
    if (stockResult.rows.length > 0) {
      await expect(async () => {
        await pool.query(`
          UPDATE stock
          SET quantite_disponible = 50
          WHERE id = $1
        `, [stockResult.rows[0].id])
      }).rejects.toThrow()
    }
  })

  /**
   * Additional Test: Admin can manage etablissements
   */
  test('Admin can perform CRUD operations on etablissements table', async () => {
    if (skipIfNoDB()) return

    // Create admin user
    const adminId = await createUser(null, 'admin')

    // Set session as admin
    await setSessionUser(adminId)

    // Test: Admin can create etablissements
    const createResult = await pool.query(`
      INSERT INTO etablissements (
        nom,
        adresse,
        telephone,
        email,
        statut_abonnement,
        date_debut,
        date_fin,
        actif
      )
      VALUES (
        'New Restaurant',
        '123 Main St',
        '+237123456789',
        'restaurant@test.com',
        'actif',
        NOW(),
        NOW() + INTERVAL '12 months',
        true
      )
      RETURNING id
    `)

    expect(createResult.rows.length).toBe(1)
    const newEtabId = createResult.rows[0].id

    // Test: Admin can read etablissements
    const readResult = await pool.query(`
      SELECT * FROM etablissements WHERE id = $1
    `, [newEtabId])

    expect(readResult.rows.length).toBe(1)
    expect(readResult.rows[0].nom).toBe('New Restaurant')

    // Test: Admin can update etablissements
    await pool.query(`
      UPDATE etablissements
      SET nom = 'Updated Restaurant'
      WHERE id = $1
    `, [newEtabId])

    const updateResult = await pool.query(`
      SELECT nom FROM etablissements WHERE id = $1
    `, [newEtabId])

    expect(updateResult.rows[0].nom).toBe('Updated Restaurant')

    // Test: Admin can delete etablissements (if no foreign key constraints)
    // Note: This will fail if there are related records, which is expected
    const deleteResult = await pool.query(`
      DELETE FROM etablissements WHERE id = $1
    `, [newEtabId])

    expect(deleteResult.rowCount).toBe(1)
  })

  /**
   * Additional Test: Admin can manage profiles across establishments
   */
  test('Admin can manage profiles across all establishments', async () => {
    if (skipIfNoDB()) return

    // Create admin user
    const adminId = await createUser(null, 'admin')

    // Create establishments
    const etabAId = await createEtablissement('Restaurant A')
    const etabBId = await createEtablissement('Restaurant B')

    // Set session as admin
    await setSessionUser(adminId)

    // Test: Admin can create profiles for any establishment
    const userAEmail = `user-a-${Date.now()}@test.com`
    const authAResult = await pool.query(`
      INSERT INTO auth.users (id, email)
      VALUES (gen_random_uuid(), $1)
      RETURNING id
    `, [userAEmail])
    const userAId = authAResult.rows[0].id

    await pool.query(`
      INSERT INTO profiles (id, email, nom, prenom, role, etablissement_id, actif)
      VALUES ($1, $2, 'User', 'A', 'serveuse', $3, true)
    `, [userAId, userAEmail, etabAId])

    // Test: Admin can read profiles from all establishments
    const profilesResult = await pool.query(`
      SELECT etablissement_id FROM profiles
      WHERE etablissement_id IS NOT NULL
    `)

    expect(profilesResult.rows.length).toBeGreaterThanOrEqual(1)

    // Test: Admin can update profiles from any establishment
    await pool.query(`
      UPDATE profiles
      SET nom = 'Updated User'
      WHERE id = $1
    `, [userAId])

    const updateResult = await pool.query(`
      SELECT nom FROM profiles WHERE id = $1
    `, [userAId])

    expect(updateResult.rows[0].nom).toBe('Updated User')
  })

  /**
   * Additional Test: Non-admin users cannot see data from other establishments
   */
  test('Non-admin users are restricted to their own establishment', async () => {
    if (skipIfNoDB()) return

    // Create two establishments
    const etabAId = await createEtablissement('Restaurant A')
    const etabBId = await createEtablissement('Restaurant B')

    // Create admin and regular users
    const adminId = await createUser(null, 'admin')
    const patronAId = await createUser(etabAId, 'patron')
    const patronBId = await createUser(etabBId, 'patron')

    // Create products for both establishments
    await createProducts(etabAId, 2)
    await createProducts(etabBId, 3)

    // Test as admin: should see all products
    await setSessionUser(adminId)
    const adminProductsResult = await pool.query(`
      SELECT id FROM produits
    `)
    expect(adminProductsResult.rows.length).toBe(5)

    // Test as patron A: should only see establishment A products
    await setSessionUser(patronAId)
    const patronAProductsResult = await pool.query(`
      SELECT id FROM produits
    `)
    expect(patronAProductsResult.rows.length).toBe(2)

    // Test as patron B: should only see establishment B products
    await setSessionUser(patronBId)
    const patronBProductsResult = await pool.query(`
      SELECT id FROM produits
    `)
    expect(patronBProductsResult.rows.length).toBe(3)
  })
})
