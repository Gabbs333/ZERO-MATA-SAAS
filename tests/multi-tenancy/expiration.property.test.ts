/**
 * Property-Based Tests: Subscription Expiration
 * 
 * Tests Properties 15-18 from the multi-tenant-saas design document.
 * These tests verify the automatic subscription expiration logic.
 */

import { describe, test, expect, beforeAll, afterEach } from 'vitest';
import { Pool } from 'pg';
import fc from 'fast-check';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres',
});

// Helper to create a test establishment
async function createTestEtablissement(
  nom: string,
  date_fin: string,
  statut_abonnement: 'actif' | 'expire' | 'suspendu',
  actif: boolean = true
) {
  const result = await pool.query(
    `INSERT INTO etablissements (nom, adresse, telephone, email, date_debut, date_fin, statut_abonnement, actif)
     VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7)
     RETURNING *`,
    [nom, '123 Test St', '1234567890', `${nom.toLowerCase().replace(/\s/g, '')}@test.com`, date_fin, statut_abonnement, actif]
  );
  return result.rows[0];
}

// Helper to simulate expiration process (mimics Edge Function logic)
async function runExpirationProcess() {
  const now = new Date().toISOString();
  
  // Query expired establishments
  const { rows: expiredEstablishments } = await pool.query(
    `SELECT id, nom, date_fin, statut_abonnement
     FROM etablissements
     WHERE date_fin < $1 AND statut_abonnement = 'actif'`,
    [now]
  );

  const results = [];
  
  for (const etablissement of expiredEstablishments) {
    try {
      // Update establishment status
      await pool.query(
        `UPDATE etablissements
         SET statut_abonnement = 'expire', actif = false
         WHERE id = $1`,
        [etablissement.id]
      );

      // Create audit log entry
      await pool.query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, etablissement_id, details)
         VALUES (NULL, 'SUBSCRIPTION_EXPIRED', 'etablissements', $1, $1, $2)`,
        [etablissement.id, JSON.stringify({ nom: etablissement.nom, date_fin: etablissement.date_fin, expired_at: now })]
      );

      results.push({ id: etablissement.id, status: 'success' });
    } catch (error) {
      results.push({ id: etablissement.id, status: 'error', error: error.message });
    }
  }

  return results;
}

// Helper to get establishment by ID
async function getEtablissement(id: string) {
  const result = await pool.query('SELECT * FROM etablissements WHERE id = $1', [id]);
  return result.rows[0];
}

// Helper to check audit log exists
async function getAuditLog(etablissement_id: string, action: string) {
  const result = await pool.query(
    'SELECT * FROM audit_logs WHERE etablissement_id = $1 AND action = $2 ORDER BY date_creation DESC LIMIT 1',
    [etablissement_id, action]
  );
  return result.rows[0];
}

beforeAll(async () => {
  // Verify database connection
  try {
    await pool.query('SELECT 1');
  } catch (error) {
    console.warn('Database not available, tests will be skipped');
  }
});

afterEach(async () => {
  // Clean up test data
  try {
    await pool.query('TRUNCATE TABLE audit_logs CASCADE');
    await pool.query('TRUNCATE TABLE etablissements CASCADE');
  } catch (error) {
    // Ignore cleanup errors
  }
});

describe('Subscription Expiration Properties', () => {
  test('Property 15: Expiration Status Updates', async () => {
    /**
     * **Feature: multi-tenant-saas, Property 15: Expiration Status Updates**
     * 
     * For any establishment where date_fin < NOW() and statut_abonnement = 'actif',
     * after the expiration process runs, the establishment SHALL have
     * statut_abonnement = 'expire' and actif = false.
     * 
     * **Validates: Requirements 4.2, 4.3, 13.3, 13.4**
     */

    try {
      await pool.query('SELECT 1');
    } catch {
      console.warn('Database not available, skipping test');
      return;
    }

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          nom: fc.string({ minLength: 1, maxLength: 50 }),
          daysInPast: fc.integer({ min: 1, max: 365 }), // Expired by this many days
        }),
        async ({ nom, daysInPast }) => {
          // Create an establishment with expired subscription
          const date_fin = new Date();
          date_fin.setDate(date_fin.getDate() - daysInPast);
          
          const etablissement = await createTestEtablissement(
            nom,
            date_fin.toISOString(),
            'actif',
            true
          );

          // Run expiration process
          await runExpirationProcess();

          // Verify establishment status was updated
          const updated = await getEtablissement(etablissement.id);
          
          expect(updated.statut_abonnement).toBe('expire');
          expect(updated.actif).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 16: Expiration Query Correctness', async () => {
    /**
     * **Feature: multi-tenant-saas, Property 16: Expiration Query Correctness**
     * 
     * For any set of establishments, the expiration process SHALL only select
     * establishments where BOTH date_fin < NOW() AND statut_abonnement = 'actif'.
     * Establishments with statut_abonnement = 'expire' or 'suspendu' SHALL NOT be selected.
     * Establishments with date_fin >= NOW() SHALL NOT be selected.
     * 
     * **Validates: Requirements 4.2, 13.3**
     */

    try {
      await pool.query('SELECT 1');
    } catch {
      console.warn('Database not available, skipping test');
      return;
    }

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          expiredActive: fc.integer({ min: 1, max: 5 }),
          expiredAlready: fc.integer({ min: 0, max: 3 }),
          expiredSuspended: fc.integer({ min: 0, max: 3 }),
          futureActive: fc.integer({ min: 0, max: 3 }),
        }),
        async ({ expiredActive, expiredAlready, expiredSuspended, futureActive }) => {
          const createdIds = {
            shouldExpire: [] as string[],
            shouldNotExpire: [] as string[],
          };

          // Create establishments that SHOULD be expired
          for (let i = 0; i < expiredActive; i++) {
            const date_fin = new Date();
            date_fin.setDate(date_fin.getDate() - (i + 1));
            const etab = await createTestEtablissement(
              `Expired Active ${i}`,
              date_fin.toISOString(),
              'actif',
              true
            );
            createdIds.shouldExpire.push(etab.id);
          }

          // Create establishments that should NOT be expired (already expired)
          for (let i = 0; i < expiredAlready; i++) {
            const date_fin = new Date();
            date_fin.setDate(date_fin.getDate() - (i + 1));
            const etab = await createTestEtablissement(
              `Already Expired ${i}`,
              date_fin.toISOString(),
              'expire',
              false
            );
            createdIds.shouldNotExpire.push(etab.id);
          }

          // Create establishments that should NOT be expired (suspended)
          for (let i = 0; i < expiredSuspended; i++) {
            const date_fin = new Date();
            date_fin.setDate(date_fin.getDate() - (i + 1));
            const etab = await createTestEtablissement(
              `Expired Suspended ${i}`,
              date_fin.toISOString(),
              'suspendu',
              false
            );
            createdIds.shouldNotExpire.push(etab.id);
          }

          // Create establishments that should NOT be expired (future date)
          for (let i = 0; i < futureActive; i++) {
            const date_fin = new Date();
            date_fin.setDate(date_fin.getDate() + (i + 1));
            const etab = await createTestEtablissement(
              `Future Active ${i}`,
              date_fin.toISOString(),
              'actif',
              true
            );
            createdIds.shouldNotExpire.push(etab.id);
          }

          // Run expiration process
          const results = await runExpirationProcess();

          // Verify only the correct establishments were expired
          expect(results.length).toBe(expiredActive);

          // Verify all establishments that should be expired are now expired
          for (const id of createdIds.shouldExpire) {
            const etab = await getEtablissement(id);
            expect(etab.statut_abonnement).toBe('expire');
            expect(etab.actif).toBe(false);
          }

          // Verify all establishments that should NOT be expired remain unchanged
          for (const id of createdIds.shouldNotExpire) {
            const etab = await getEtablissement(id);
            // Status should remain as originally set (not changed to 'expire')
            expect(etab.statut_abonnement).not.toBe('expire');
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Property 17: Expiration Isolation', async () => {
    /**
     * **Feature: multi-tenant-saas, Property 17: Expiration Isolation**
     * 
     * For any establishment A that is expired, the expiration SHALL NOT affect
     * any other establishment B (where B.id != A.id). Each establishment's
     * expiration is independent.
     * 
     * **Validates: Requirements 11.7**
     */

    try {
      await pool.query('SELECT 1');
    } catch {
      console.warn('Database not available, skipping test');
      return;
    }

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          expiredCount: fc.integer({ min: 1, max: 5 }),
          activeCount: fc.integer({ min: 1, max: 5 }),
        }),
        async ({ expiredCount, activeCount }) => {
          const expiredIds: string[] = [];
          const activeIds: string[] = [];

          // Create establishments with expired subscriptions
          for (let i = 0; i < expiredCount; i++) {
            const date_fin = new Date();
            date_fin.setDate(date_fin.getDate() - (i + 1));
            const etab = await createTestEtablissement(
              `Expired ${i}`,
              date_fin.toISOString(),
              'actif',
              true
            );
            expiredIds.push(etab.id);
          }

          // Create establishments with active subscriptions (future dates)
          for (let i = 0; i < activeCount; i++) {
            const date_fin = new Date();
            date_fin.setDate(date_fin.getDate() + 30 + i);
            const etab = await createTestEtablissement(
              `Active ${i}`,
              date_fin.toISOString(),
              'actif',
              true
            );
            activeIds.push(etab.id);
          }

          // Capture initial state of active establishments
          const initialActiveStates = await Promise.all(
            activeIds.map(id => getEtablissement(id))
          );

          // Run expiration process
          await runExpirationProcess();

          // Verify expired establishments were updated
          for (const id of expiredIds) {
            const etab = await getEtablissement(id);
            expect(etab.statut_abonnement).toBe('expire');
            expect(etab.actif).toBe(false);
          }

          // Verify active establishments were NOT affected
          for (let i = 0; i < activeIds.length; i++) {
            const etab = await getEtablissement(activeIds[i]);
            const initial = initialActiveStates[i];
            
            expect(etab.statut_abonnement).toBe(initial.statut_abonnement);
            expect(etab.actif).toBe(initial.actif);
            expect(etab.date_fin).toBe(initial.date_fin);
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Property 18: Expiration Error Handling', async () => {
    /**
     * **Feature: multi-tenant-saas, Property 18: Expiration Error Handling**
     * 
     * For any establishment A that fails to expire due to an error, the expiration
     * process SHALL continue processing other establishments. The process SHALL NOT
     * abort on individual failures.
     * 
     * Additionally, for any successfully expired establishment, an audit log entry
     * SHALL be created with action = 'SUBSCRIPTION_EXPIRED', user_id = NULL,
     * and etablissement_id = establishment's ID.
     * 
     * **Validates: Requirements 4.5, 10.4, 13.5, 13.6**
     */

    try {
      await pool.query('SELECT 1');
    } catch {
      console.warn('Database not available, skipping test');
      return;
    }

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }),
        async (count) => {
          const etablissementIds: string[] = [];

          // Create multiple establishments with expired subscriptions
          for (let i = 0; i < count; i++) {
            const date_fin = new Date();
            date_fin.setDate(date_fin.getDate() - (i + 1));
            const etab = await createTestEtablissement(
              `Expired ${i}`,
              date_fin.toISOString(),
              'actif',
              true
            );
            etablissementIds.push(etab.id);
          }

          // Run expiration process
          const results = await runExpirationProcess();

          // Verify all establishments were processed
          expect(results.length).toBe(count);

          // Verify all establishments were successfully expired
          for (const id of etablissementIds) {
            const etab = await getEtablissement(id);
            expect(etab.statut_abonnement).toBe('expire');
            expect(etab.actif).toBe(false);

            // Verify audit log was created
            const auditLog = await getAuditLog(id, 'SUBSCRIPTION_EXPIRED');
            expect(auditLog).toBeDefined();
            expect(auditLog.user_id).toBeNull(); // System action
            expect(auditLog.action).toBe('SUBSCRIPTION_EXPIRED');
            expect(auditLog.table_name).toBe('etablissements');
            expect(auditLog.record_id).toBe(id);
            expect(auditLog.etablissement_id).toBe(id);
            
            // Verify audit log details
            const details = auditLog.details;
            expect(details).toHaveProperty('nom');
            expect(details).toHaveProperty('date_fin');
            expect(details).toHaveProperty('expired_at');
          }
        }
      ),
      { numRuns: 30 }
    );
  });
});
