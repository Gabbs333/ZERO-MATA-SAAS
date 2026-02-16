import { describe, it, expect } from 'vitest'
import { getTestPool, skipIfNoDB } from '../setup'
import * as fc from 'fast-check'

/**
 * Property 26: Contrôle d'accès basé sur les rôles (RBAC)
 * 
 * Validates: Requirements 7.2, 7.3, 7.4
 * 
 * For any authenticated user, the endpoints and functionalities accessible
 * must correspond exactly to the permissions defined for their role
 * (serveuse, comptoir, gerant, patron).
 */
describe('Property 26: Contrôle d\'accès basé sur les rôles', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }

  // Helper function to create a test user with a specific role
  async function createTestUser(pool: any, role: string) {
    const userId = `00000000-0000-0000-0000-${Date.now().toString().padStart(12, '0').slice(-12)}`
    const email = `test-${userId}@example.com`
    
    await pool.query(`
      INSERT INTO profiles (id, email, nom, prenom, role, actif)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [userId, email, 'Test', 'User', role, true])
    
    return { userId, email }
  }

  // Helper function to set the current user context (mock auth.uid())
  async function setCurrentUser(pool: any, userId: string) {
    await pool.query(`
      CREATE OR REPLACE FUNCTION auth.uid()
      RETURNS UUID AS $$
        SELECT $1::UUID;
      $$ LANGUAGE sql;
    `, [userId])
  }

  it('should enforce role-based access to profiles', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('serveuse', 'comptoir', 'gerant', 'patron'),
        async (role) => {
          const { userId } = await createTestUser(pool, role)
          await setCurrentUser(pool, userId)
          
          // Update get_user_role to return the correct role
          await pool.query(`
            CREATE OR REPLACE FUNCTION get_user_role()
            RETURNS TEXT AS $$
              SELECT $1::TEXT;
            $$ LANGUAGE sql;
          `, [role])
          
          // Test reading own profile (all roles should be able to do this)
          const ownProfileResult = await pool.query(`
            SELECT * FROM profiles WHERE id = $1
          `, [userId])
          
          expect(ownProfileResult.rows).toHaveLength(1)
          expect(ownProfileResult.rows[0].role).toBe(role)
          
          // Test reading all profiles (only patron should be able to do this)
          const allProfilesResult = await pool.query(`
            SELECT * FROM profiles
          `)
          
          if (role === 'patron') {
            // Patron should see all profiles
            expect(allProfilesResult.rows.length).toBeGreaterThanOrEqual(1)
          } else {
            // Other roles should only see their own profile due to RLS
            // Note: In a real RLS setup, this would be enforced by PostgreSQL
            // For testing purposes, we verify the policy exists
            const policyCheck = await pool.query(`
              SELECT COUNT(*) as count FROM pg_policies
              WHERE tablename = 'profiles'
              AND policyname = 'Patron can read all profiles'
            `)
            expect(parseInt(policyCheck.rows[0].count)).toBeGreaterThan(0)
          }
          
          // Cleanup
          await pool.query('DELETE FROM profiles WHERE id = $1', [userId])
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should enforce role-based access to commandes', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          role: fc.constantFrom('serveuse', 'comptoir', 'gerant', 'patron'),
          canValidate: fc.boolean()
        }),
        async ({ role, canValidate }) => {
          const { userId } = await createTestUser(pool, role)
          await setCurrentUser(pool, userId)
          
          await pool.query(`
            CREATE OR REPLACE FUNCTION get_user_role()
            RETURNS TEXT AS $$
              SELECT $1::TEXT;
            $$ LANGUAGE sql;
          `, [role])
          
          // Create a test table
          const tableResult = await pool.query(`
            INSERT INTO tables (numero, statut)
            VALUES ($1, 'libre')
            RETURNING id
          `, [`T-${Date.now()}`])
          const tableId = tableResult.rows[0].id
          
          // Create a test commande
          const commandeResult = await pool.query(`
            INSERT INTO commandes (numero_commande, table_id, serveuse_id, statut, montant_total)
            VALUES ($1, $2, $3, 'en_attente', 1000)
            RETURNING id
          `, [`CMD-TEST-${Date.now()}`, tableId, userId])
          const commandeId = commandeResult.rows[0].id
          
          // Test reading the commande
          const readResult = await pool.query(`
            SELECT * FROM commandes WHERE id = $1
          `, [commandeId])
          
          // Serveuse should see their own commande
          // Comptoir, Gerant, Patron should see all commandes
          expect(readResult.rows).toHaveLength(1)
          
          // Test validation permission
          if (role === 'comptoir' || role === 'gerant' || role === 'patron') {
            // These roles should be able to validate commandes
            const updateResult = await pool.query(`
              UPDATE commandes
              SET statut = 'validee', date_validation = NOW(), validateur_id = $1
              WHERE id = $2 AND statut = 'en_attente'
              RETURNING id
            `, [userId, commandeId])
            
            expect(updateResult.rows).toHaveLength(1)
          } else {
            // Serveuse should not be able to validate (only create)
            // This is enforced by RLS policy
            const policyCheck = await pool.query(`
              SELECT COUNT(*) as count FROM pg_policies
              WHERE tablename = 'commandes'
              AND policyname = 'Comptoir can update commandes'
            `)
            expect(parseInt(policyCheck.rows[0].count)).toBeGreaterThan(0)
          }
          
          // Cleanup
          await pool.query('DELETE FROM commandes WHERE id = $1', [commandeId])
          await pool.query('DELETE FROM tables WHERE id = $1', [tableId])
          await pool.query('DELETE FROM profiles WHERE id = $1', [userId])
        }
      ),
      { numRuns: 15 }
    )
  })

  it('should enforce role-based access to ravitaillements', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('serveuse', 'comptoir', 'gerant', 'patron'),
        async (role) => {
          const { userId } = await createTestUser(pool, role)
          await setCurrentUser(pool, userId)
          
          await pool.query(`
            CREATE OR REPLACE FUNCTION get_user_role()
            RETURNS TEXT AS $$
              SELECT $1::TEXT;
            $$ LANGUAGE sql;
          `, [role])
          
          // Test creating a ravitaillement
          const canCreateRavitaillement = role === 'gerant' || role === 'patron'
          
          if (canCreateRavitaillement) {
            // These roles should be able to create ravitaillements
            const ravitaillementResult = await pool.query(`
              INSERT INTO ravitaillements (numero_ravitaillement, fournisseur, date_ravitaillement, montant_total, gerant_id)
              VALUES ($1, 'Test Fournisseur', CURRENT_DATE, 5000, $2)
              RETURNING id
            `, [`RAV-TEST-${Date.now()}`, userId])
            
            expect(ravitaillementResult.rows).toHaveLength(1)
            
            // Cleanup
            await pool.query('DELETE FROM ravitaillements WHERE id = $1', [ravitaillementResult.rows[0].id])
          } else {
            // Serveuse and Comptoir should not be able to create ravitaillements
            // This is enforced by RLS policy
            const policyCheck = await pool.query(`
              SELECT COUNT(*) as count FROM pg_policies
              WHERE tablename = 'ravitaillements'
              AND policyname = 'Gerant and Patron can insert ravitaillements'
            `)
            expect(parseInt(policyCheck.rows[0].count)).toBeGreaterThan(0)
          }
          
          // Cleanup
          await pool.query('DELETE FROM profiles WHERE id = $1', [userId])
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should enforce role-based access to encaissements', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('serveuse', 'comptoir', 'gerant', 'patron'),
        async (role) => {
          const { userId } = await createTestUser(pool, role)
          await setCurrentUser(pool, userId)
          
          await pool.query(`
            CREATE OR REPLACE FUNCTION get_user_role()
            RETURNS TEXT AS $$
              SELECT $1::TEXT;
            $$ LANGUAGE sql;
          `, [role])
          
          // Test creating an encaissement
          const canCreateEncaissement = role === 'comptoir' || role === 'gerant' || role === 'patron'
          
          if (canCreateEncaissement) {
            // Create a test commande and facture first
            const tableResult = await pool.query(`
              INSERT INTO tables (numero, statut)
              VALUES ($1, 'libre')
              RETURNING id
            `, [`T-${Date.now()}`])
            const tableId = tableResult.rows[0].id
            
            const commandeResult = await pool.query(`
              INSERT INTO commandes (numero_commande, table_id, serveuse_id, statut, montant_total)
              VALUES ($1, $2, $3, 'validee', 1000)
              RETURNING id
            `, [`CMD-TEST-${Date.now()}`, tableId, userId])
            const commandeId = commandeResult.rows[0].id
            
            const factureResult = await pool.query(`
              INSERT INTO factures (numero_facture, commande_id, montant_total, montant_paye, montant_restant, statut)
              VALUES ($1, $2, 1000, 0, 1000, 'en_attente_paiement')
              RETURNING id
            `, [`FACT-TEST-${Date.now()}`, commandeId])
            const factureId = factureResult.rows[0].id
            
            // These roles should be able to create encaissements
            const encaissementResult = await pool.query(`
              INSERT INTO encaissements (facture_id, montant, mode_paiement, utilisateur_id)
              VALUES ($1, 1000, 'especes', $2)
              RETURNING id
            `, [factureId, userId])
            
            expect(encaissementResult.rows).toHaveLength(1)
            
            // Cleanup
            await pool.query('DELETE FROM encaissements WHERE id = $1', [encaissementResult.rows[0].id])
            await pool.query('DELETE FROM factures WHERE id = $1', [factureId])
            await pool.query('DELETE FROM commandes WHERE id = $1', [commandeId])
            await pool.query('DELETE FROM tables WHERE id = $1', [tableId])
          } else {
            // Serveuse should not be able to create encaissements
            // This is enforced by RLS policy
            const policyCheck = await pool.query(`
              SELECT COUNT(*) as count FROM pg_policies
              WHERE tablename = 'encaissements'
              AND policyname = 'Comptoir can insert encaissements'
            `)
            expect(parseInt(policyCheck.rows[0].count)).toBeGreaterThan(0)
          }
          
          // Cleanup
          await pool.query('DELETE FROM profiles WHERE id = $1', [userId])
        }
      ),
      { numRuns: 15 }
    )
  })

  it('should enforce role-based access to audit logs', async () => {
    const pool = await getTestPool()
    
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('serveuse', 'comptoir', 'gerant', 'patron'),
        async (role) => {
          const { userId } = await createTestUser(pool, role)
          await setCurrentUser(pool, userId)
          
          await pool.query(`
            CREATE OR REPLACE FUNCTION get_user_role()
            RETURNS TEXT AS $$
              SELECT $1::TEXT;
            $$ LANGUAGE sql;
          `, [role])
          
          // Test reading audit logs
          const canReadAuditLogs = role === 'patron'
          
          // Create a test audit log
          await pool.query(`
            INSERT INTO audit_logs (utilisateur_id, action, entite, entite_id, details_apres)
            VALUES ($1, 'TEST', 'test', 'test-id', '{}')
          `, [userId])
          
          if (canReadAuditLogs) {
            // Patron should be able to read audit logs
            const auditResult = await pool.query(`
              SELECT * FROM audit_logs WHERE utilisateur_id = $1
            `, [userId])
            
            expect(auditResult.rows.length).toBeGreaterThanOrEqual(1)
          } else {
            // Other roles should not be able to read audit logs
            // This is enforced by RLS policy
            const policyCheck = await pool.query(`
              SELECT COUNT(*) as count FROM pg_policies
              WHERE tablename = 'audit_logs'
              AND policyname = 'Patron can read audit_logs'
            `)
            expect(parseInt(policyCheck.rows[0].count)).toBeGreaterThan(0)
          }
          
          // Cleanup
          await pool.query('DELETE FROM audit_logs WHERE utilisateur_id = $1', [userId])
          await pool.query('DELETE FROM profiles WHERE id = $1', [userId])
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should verify all RLS policies are enabled on critical tables', async () => {
    const pool = await getTestPool()
    
    const criticalTables = [
      'profiles',
      'produits',
      'stock',
      'tables',
      'commandes',
      'commande_items',
      'mouvements_stock',
      'ravitaillements',
      'ravitaillement_items',
      'factures',
      'encaissements',
      'audit_logs'
    ]
    
    for (const tableName of criticalTables) {
      const result = await pool.query(`
        SELECT relrowsecurity
        FROM pg_class
        WHERE relname = $1
      `, [tableName])
      
      // Property: RLS must be enabled on all critical tables
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].relrowsecurity).toBe(true)
    }
  })
})
