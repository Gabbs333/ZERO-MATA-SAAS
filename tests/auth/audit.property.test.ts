import { describe, it, expect } from 'vitest'
import { getTestPool, skipIfNoDB } from '../setup'
import * as fc from 'fast-check'

/**
 * Property 27: Traçabilité des actions utilisateur
 * 
 * Validates: Requirement 7.5
 * 
 * For any action that modifies the system state (creation, modification, deletion),
 * an audit record must be created with the user identifier, timestamp, and action details.
 */
describe('Property 27: Traçabilité des actions utilisateur', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  // Helper function to create a test user
  async function createTestUser(pool: any, role: string = 'patron') {
    const userId = `00000000-0000-0000-0000-${Date.now().toString().padStart(12, '0').slice(-12)}`
    const email = `test-${userId}@example.com`
    
    await pool.query(`
      INSERT INTO profiles (id, email, nom, prenom, role, actif)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [userId, email, 'Test', 'User', role, true])
    
    return { userId, email }
  }

  // Helper function to set the current user context
  async function setCurrentUser(pool: any, userId: string) {
    await pool.query(`
      CREATE OR REPLACE FUNCTION auth.uid()
      RETURNS UUID AS $$
        SELECT $1::UUID;
      $$ LANGUAGE sql;
    `, [userId])
  }

  // Helper function to count audit logs for a specific entity
  async function countAuditLogs(pool: any, entite: string, entiteId: string) {
    const result = await pool.query(`
      SELECT COUNT(*) as count FROM audit_logs
      WHERE entite = $1 AND entite_id = $2
    `, [entite, entiteId])
    return parseInt(result.rows[0].count)
  }

  it('should create audit log for INSERT operations', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          nom: fc.string({ minLength: 1, maxLength: 50 }),
          categorie: fc.constantFrom('boisson', 'nourriture', 'autre'),
          prix_vente: fc.integer({ min: 100, max: 10000 }),
          seuil_stock_minimum: fc.integer({ min: 0, max: 50 })
        }),
        async (produitData) => {
          const { userId } = await createTestUser(pool, 'patron')
          await setCurrentUser(pool, userId)
          
          // Get initial audit log count
          const initialAuditCount = await pool.query(`
            SELECT COUNT(*) as count FROM audit_logs
          `)
          const initialCount = parseInt(initialAuditCount.rows[0].count)
          
          // Insert a product (should trigger audit log)
          const produitResult = await pool.query(`
            INSERT INTO produits (nom, categorie, prix_vente, seuil_stock_minimum, actif)
            VALUES ($1, $2, $3, $4, true)
            RETURNING id
          `, [produitData.nom, produitData.categorie, produitData.prix_vente, produitData.seuil_stock_minimum])
          
          const produitId = produitResult.rows[0].id
          
          // Wait a bit for trigger to execute
          await new Promise(resolve => setTimeout(resolve, 100))
          
          // Check that an audit log was created
          const auditLogs = await pool.query(`
            SELECT * FROM audit_logs
            WHERE entite = 'produits' AND entite_id = $1
            ORDER BY date_creation DESC
            LIMIT 1
          `, [produitId])
          
          // Property: An audit log must be created for INSERT operations
          expect(auditLogs.rows.length).toBeGreaterThanOrEqual(1)
          
          if (auditLogs.rows.length > 0) {
            const auditLog = auditLogs.rows[0]
            
            // Verify audit log contains required fields
            expect(auditLog.utilisateur_id).toBe(userId)
            expect(auditLog.action).toBe('produits.created')
            expect(auditLog.entite).toBe('produits')
            expect(auditLog.entite_id).toBe(produitId)
            expect(auditLog.details_avant).toBeNull()
            expect(auditLog.details_apres).not.toBeNull()
            expect(auditLog.date_creation).not.toBeNull()
            
            // Verify details_apres contains the inserted data
            expect(auditLog.details_apres.nom).toBe(produitData.nom)
            expect(auditLog.details_apres.categorie).toBe(produitData.categorie)
            expect(auditLog.details_apres.prix_vente).toBe(produitData.prix_vente)
          }
          
          // Cleanup
          await pool.query('DELETE FROM produits WHERE id = $1', [produitId])
          await pool.query('DELETE FROM audit_logs WHERE entite_id = $1', [produitId])
          await pool.query('DELETE FROM profiles WHERE id = $1', [userId])
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should create audit log for UPDATE operations', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          initialPrix: fc.integer({ min: 100, max: 5000 }),
          newPrix: fc.integer({ min: 100, max: 5000 })
        }),
        async ({ initialPrix, newPrix }) => {
          const { userId } = await createTestUser(pool, 'patron')
          await setCurrentUser(pool, userId)
          
          // Create a product
          const produitResult = await pool.query(`
            INSERT INTO produits (nom, categorie, prix_vente, seuil_stock_minimum, actif)
            VALUES ($1, 'boisson', $2, 10, true)
            RETURNING id
          `, [`Produit-${Date.now()}`, initialPrix])
          
          const produitId = produitResult.rows[0].id
          
          // Clear any audit logs from the insert
          await pool.query('DELETE FROM audit_logs WHERE entite_id = $1', [produitId])
          
          // Update the product (should trigger audit log)
          await pool.query(`
            UPDATE produits
            SET prix_vente = $1
            WHERE id = $2
          `, [newPrix, produitId])
          
          // Wait a bit for trigger to execute
          await new Promise(resolve => setTimeout(resolve, 100))
          
          // Check that an audit log was created for the update
          const auditLogs = await pool.query(`
            SELECT * FROM audit_logs
            WHERE entite = 'produits' AND entite_id = $1 AND action = 'produits.updated'
            ORDER BY date_creation DESC
            LIMIT 1
          `, [produitId])
          
          // Property: An audit log must be created for UPDATE operations
          expect(auditLogs.rows.length).toBeGreaterThanOrEqual(1)
          
          if (auditLogs.rows.length > 0) {
            const auditLog = auditLogs.rows[0]
            
            // Verify audit log contains required fields
            expect(auditLog.utilisateur_id).toBe(userId)
            expect(auditLog.action).toBe('produits.updated')
            expect(auditLog.entite).toBe('produits')
            expect(auditLog.entite_id).toBe(produitId)
            expect(auditLog.details_avant).not.toBeNull()
            expect(auditLog.details_apres).not.toBeNull()
            expect(auditLog.date_creation).not.toBeNull()
            
            // Verify details_avant and details_apres show the change
            expect(auditLog.details_avant.prix_vente).toBe(initialPrix)
            expect(auditLog.details_apres.prix_vente).toBe(newPrix)
          }
          
          // Cleanup
          await pool.query('DELETE FROM produits WHERE id = $1', [produitId])
          await pool.query('DELETE FROM audit_logs WHERE entite_id = $1', [produitId])
          await pool.query('DELETE FROM profiles WHERE id = $1', [userId])
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should create audit log for DELETE operations', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          nom: fc.string({ minLength: 1, maxLength: 50 }),
          prix_vente: fc.integer({ min: 100, max: 10000 })
        }),
        async (produitData) => {
          const { userId } = await createTestUser(pool, 'patron')
          await setCurrentUser(pool, userId)
          
          // Create a product
          const produitResult = await pool.query(`
            INSERT INTO produits (nom, categorie, prix_vente, seuil_stock_minimum, actif)
            VALUES ($1, 'boisson', $2, 10, true)
            RETURNING id
          `, [produitData.nom, produitData.prix_vente])
          
          const produitId = produitResult.rows[0].id
          
          // Clear any audit logs from the insert
          await pool.query('DELETE FROM audit_logs WHERE entite_id = $1', [produitId])
          
          // Delete the product (should trigger audit log)
          await pool.query(`
            DELETE FROM produits WHERE id = $1
          `, [produitId])
          
          // Wait a bit for trigger to execute
          await new Promise(resolve => setTimeout(resolve, 100))
          
          // Check that an audit log was created for the delete
          const auditLogs = await pool.query(`
            SELECT * FROM audit_logs
            WHERE entite = 'produits' AND entite_id = $1 AND action = 'produits.deleted'
            ORDER BY date_creation DESC
            LIMIT 1
          `, [produitId])
          
          // Property: An audit log must be created for DELETE operations
          expect(auditLogs.rows.length).toBeGreaterThanOrEqual(1)
          
          if (auditLogs.rows.length > 0) {
            const auditLog = auditLogs.rows[0]
            
            // Verify audit log contains required fields
            expect(auditLog.utilisateur_id).toBe(userId)
            expect(auditLog.action).toBe('produits.deleted')
            expect(auditLog.entite).toBe('produits')
            expect(auditLog.entite_id).toBe(produitId)
            expect(auditLog.details_avant).not.toBeNull()
            expect(auditLog.details_apres).toBeNull()
            expect(auditLog.date_creation).not.toBeNull()
            
            // Verify details_avant contains the deleted data
            expect(auditLog.details_avant.nom).toBe(produitData.nom)
            expect(auditLog.details_avant.prix_vente).toBe(produitData.prix_vente)
          }
          
          // Cleanup
          await pool.query('DELETE FROM audit_logs WHERE entite_id = $1', [produitId])
          await pool.query('DELETE FROM profiles WHERE id = $1', [userId])
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should track user identity in audit logs', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('serveuse', 'comptoir', 'gerant', 'patron'),
        async (role) => {
          const { userId } = await createTestUser(pool, role)
          await setCurrentUser(pool, userId)
          
          // Perform an action (create a table)
          const tableResult = await pool.query(`
            INSERT INTO tables (numero, statut)
            VALUES ($1, 'libre')
            RETURNING id
          `, [`T-${Date.now()}`])
          
          const tableId = tableResult.rows[0].id
          
          // Wait a bit for trigger to execute
          await new Promise(resolve => setTimeout(resolve, 100))
          
          // Check audit log
          const auditLogs = await pool.query(`
            SELECT * FROM audit_logs
            WHERE entite = 'tables' AND entite_id = $1
            ORDER BY date_creation DESC
            LIMIT 1
          `, [tableId])
          
          // Property: Audit log must contain the user who performed the action
          expect(auditLogs.rows.length).toBeGreaterThanOrEqual(1)
          
          if (auditLogs.rows.length > 0) {
            const auditLog = auditLogs.rows[0]
            expect(auditLog.utilisateur_id).toBe(userId)
          }
          
          // Cleanup
          await pool.query('DELETE FROM tables WHERE id = $1', [tableId])
          await pool.query('DELETE FROM audit_logs WHERE entite_id = $1', [tableId])
          await pool.query('DELETE FROM profiles WHERE id = $1', [userId])
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should record timestamp for all audit logs', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        async (produitNom) => {
          const { userId } = await createTestUser(pool, 'patron')
          await setCurrentUser(pool, userId)
          
          const beforeAction = new Date()
          
          // Perform an action
          const produitResult = await pool.query(`
            INSERT INTO produits (nom, categorie, prix_vente, seuil_stock_minimum, actif)
            VALUES ($1, 'boisson', 1000, 10, true)
            RETURNING id
          `, [produitNom])
          
          const produitId = produitResult.rows[0].id
          const afterAction = new Date()
          
          // Wait a bit for trigger to execute
          await new Promise(resolve => setTimeout(resolve, 100))
          
          // Check audit log
          const auditLogs = await pool.query(`
            SELECT * FROM audit_logs
            WHERE entite = 'produits' AND entite_id = $1
            ORDER BY date_creation DESC
            LIMIT 1
          `, [produitId])
          
          // Property: Audit log must have a timestamp
          expect(auditLogs.rows.length).toBeGreaterThanOrEqual(1)
          
          if (auditLogs.rows.length > 0) {
            const auditLog = auditLogs.rows[0]
            expect(auditLog.date_creation).not.toBeNull()
            
            // Verify timestamp is reasonable (within a few seconds of the action)
            const auditTime = new Date(auditLog.date_creation)
            expect(auditTime.getTime()).toBeGreaterThanOrEqual(beforeAction.getTime() - 1000)
            expect(auditTime.getTime()).toBeLessThanOrEqual(afterAction.getTime() + 5000)
          }
          
          // Cleanup
          await pool.query('DELETE FROM produits WHERE id = $1', [produitId])
          await pool.query('DELETE FROM audit_logs WHERE entite_id = $1', [produitId])
          await pool.query('DELETE FROM profiles WHERE id = $1', [userId])
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should audit all critical tables', async () => {
    const pool = await getTestPool()
    
    const criticalTables = [
      'profiles',
      'produits',
      'commandes',
      'ravitaillements',
      'factures',
      'encaissements',
      'stock',
      'mouvements_stock'
    ]
    
    for (const tableName of criticalTables) {
      // Check that audit trigger exists for this table
      const triggerCheck = await pool.query(`
        SELECT COUNT(*) as count
        FROM pg_trigger
        WHERE tgname = $1
      `, [`audit_${tableName}_trigger`])
      
      // Property: All critical tables must have audit triggers
      expect(parseInt(triggerCheck.rows[0].count)).toBeGreaterThan(0)
    }
  })

  it('should preserve audit logs even when entity is deleted', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        async (produitNom) => {
          const { userId } = await createTestUser(pool, 'patron')
          await setCurrentUser(pool, userId)
          
          // Create a product
          const produitResult = await pool.query(`
            INSERT INTO produits (nom, categorie, prix_vente, seuil_stock_minimum, actif)
            VALUES ($1, 'boisson', 1000, 10, true)
            RETURNING id
          `, [produitNom])
          
          const produitId = produitResult.rows[0].id
          
          // Wait for audit log
          await new Promise(resolve => setTimeout(resolve, 100))
          
          // Delete the product
          await pool.query('DELETE FROM produits WHERE id = $1', [produitId])
          
          // Wait for delete audit log
          await new Promise(resolve => setTimeout(resolve, 100))
          
          // Check that audit logs still exist
          const auditLogs = await pool.query(`
            SELECT * FROM audit_logs
            WHERE entite = 'produits' AND entite_id = $1
            ORDER BY date_creation ASC
          `, [produitId])
          
          // Property: Audit logs must be preserved even after entity deletion
          expect(auditLogs.rows.length).toBeGreaterThanOrEqual(2) // INSERT + DELETE
          
          // Verify we have both create and delete logs
          const actions = auditLogs.rows.map(log => log.action)
          expect(actions).toContain('produits.created')
          expect(actions).toContain('produits.deleted')
          
          // Cleanup
          await pool.query('DELETE FROM audit_logs WHERE entite_id = $1', [produitId])
          await pool.query('DELETE FROM profiles WHERE id = $1', [userId])
        }
      ),
      { numRuns: 15 }
    )
  })
})
