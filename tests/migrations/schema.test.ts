import { describe, it, expect } from 'vitest'
import { getTestPool, skipIfNoDB } from '../setup'

describe('Database Schema - Table Creation', () => {
  if (skipIfNoDB()) {
    it.skip('Database not available - tests skipped', () => {})
    return
  }
  it('should create all required tables', async () => {
    const pool = await getTestPool()
    
    const expectedTables = [
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
    
    for (const tableName of expectedTables) {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [tableName])
      
      expect(result.rows[0].exists).toBe(true)
    }
  })

  it('should create profiles table with correct columns', async () => {
    const pool = await getTestPool()
    
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'profiles'
      ORDER BY ordinal_position
    `)
    
    const columns = result.rows.map(r => r.column_name)
    expect(columns).toContain('id')
    expect(columns).toContain('email')
    expect(columns).toContain('nom')
    expect(columns).toContain('prenom')
    expect(columns).toContain('role')
    expect(columns).toContain('actif')
    expect(columns).toContain('date_creation')
    expect(columns).toContain('derniere_connexion')
  })

  it('should create produits table with correct columns', async () => {
    const pool = await getTestPool()
    
    const result = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'produits'
      ORDER BY ordinal_position
    `)
    
    const columns = result.rows.map(r => r.column_name)
    expect(columns).toContain('id')
    expect(columns).toContain('nom')
    expect(columns).toContain('categorie')
    expect(columns).toContain('prix_vente')
    expect(columns).toContain('seuil_stock_minimum')
    expect(columns).toContain('actif')
    expect(columns).toContain('date_creation')
    expect(columns).toContain('date_modification')
  })

  it('should create commandes table with correct columns', async () => {
    const pool = await getTestPool()
    
    const result = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'commandes'
      ORDER BY ordinal_position
    `)
    
    const columns = result.rows.map(r => r.column_name)
    expect(columns).toContain('id')
    expect(columns).toContain('numero_commande')
    expect(columns).toContain('table_id')
    expect(columns).toContain('serveuse_id')
    expect(columns).toContain('statut')
    expect(columns).toContain('montant_total')
    expect(columns).toContain('date_creation')
    expect(columns).toContain('date_validation')
    expect(columns).toContain('validateur_id')
  })

  it('should create factures table with correct columns', async () => {
    const pool = await getTestPool()
    
    const result = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'factures'
      ORDER BY ordinal_position
    `)
    
    const columns = result.rows.map(r => r.column_name)
    expect(columns).toContain('id')
    expect(columns).toContain('numero_facture')
    expect(columns).toContain('commande_id')
    expect(columns).toContain('montant_total')
    expect(columns).toContain('montant_paye')
    expect(columns).toContain('montant_restant')
    expect(columns).toContain('statut')
    expect(columns).toContain('date_generation')
    expect(columns).toContain('date_paiement_complet')
  })

  it('should create encaissements table with correct columns', async () => {
    const pool = await getTestPool()
    
    const result = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'encaissements'
      ORDER BY ordinal_position
    `)
    
    const columns = result.rows.map(r => r.column_name)
    expect(columns).toContain('id')
    expect(columns).toContain('facture_id')
    expect(columns).toContain('montant')
    expect(columns).toContain('mode_paiement')
    expect(columns).toContain('reference')
    expect(columns).toContain('utilisateur_id')
    expect(columns).toContain('date_encaissement')
  })
})
