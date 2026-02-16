import { describe, it, expect, beforeEach } from 'vitest'
import { getTestPool } from '../setup'

describe('Database Defaults - Default Values', () => {
  let pool: any
  
  beforeEach(async () => {
    pool = await getTestPool()
  })

  it('should set default value for produits.actif to true', async () => {
    const result = await pool.query(`
      INSERT INTO produits (nom, categorie, prix_vente)
      VALUES ('Default Test', 'boisson', 500)
      RETURNING actif
    `)
    
    expect(result.rows[0].actif).toBe(true)
  })

  it('should set default value for produits.seuil_stock_minimum to 0', async () => {
    const result = await pool.query(`
      INSERT INTO produits (nom, categorie, prix_vente)
      VALUES ('Default Test 2', 'boisson', 500)
      RETURNING seuil_stock_minimum
    `)
    
    expect(result.rows[0].seuil_stock_minimum).toBe(0)
  })

  it('should set default value for produits.date_creation to NOW()', async () => {
    const before = new Date()
    
    const result = await pool.query(`
      INSERT INTO produits (nom, categorie, prix_vente)
      VALUES ('Default Test 3', 'boisson', 500)
      RETURNING date_creation
    `)
    
    const after = new Date()
    const dateCreation = new Date(result.rows[0].date_creation)
    
    expect(dateCreation.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(dateCreation.getTime()).toBeLessThanOrEqual(after.getTime())
  })

  it('should set default value for stock.quantite_disponible to 0', async () => {
    const produit = await pool.query(`
      INSERT INTO produits (nom, categorie, prix_vente)
      VALUES ('Stock Default', 'boisson', 500) RETURNING id
    `)
    
    const result = await pool.query(`
      INSERT INTO stock (produit_id)
      VALUES ($1)
      RETURNING quantite_disponible
    `, [produit.rows[0].id])
    
    expect(result.rows[0].quantite_disponible).toBe(0)
  })

  it('should set default value for tables.statut to libre', async () => {
    const result = await pool.query(`
      INSERT INTO tables (numero)
      VALUES ('T-DEFAULT')
      RETURNING statut
    `)
    
    expect(result.rows[0].statut).toBe('libre')
  })

  it('should set default value for commandes.statut to en_attente', async () => {
    const table = await pool.query(`
      INSERT INTO tables (numero) VALUES ('T6') RETURNING id
    `)
    const profile = await pool.query(`
      INSERT INTO profiles (id, email, nom, prenom, role)
      VALUES (gen_random_uuid(), 'default1@test.com', 'Test', 'User', 'serveuse')
      RETURNING id
    `)
    
    const result = await pool.query(`
      INSERT INTO commandes (numero_commande, table_id, serveuse_id)
      VALUES ('CMD-DEFAULT-001', $1, $2)
      RETURNING statut
    `, [table.rows[0].id, profile.rows[0].id])
    
    expect(result.rows[0].statut).toBe('en_attente')
  })

  it('should set default value for commandes.montant_total to 0', async () => {
    const table = await pool.query(`
      INSERT INTO tables (numero) VALUES ('T7') RETURNING id
    `)
    const profile = await pool.query(`
      INSERT INTO profiles (id, email, nom, prenom, role)
      VALUES (gen_random_uuid(), 'default2@test.com', 'Test', 'User', 'serveuse')
      RETURNING id
    `)
    
    const result = await pool.query(`
      INSERT INTO commandes (numero_commande, table_id, serveuse_id)
      VALUES ('CMD-DEFAULT-002', $1, $2)
      RETURNING montant_total
    `, [table.rows[0].id, profile.rows[0].id])
    
    expect(result.rows[0].montant_total).toBe(0)
  })

  it('should set default value for factures.statut to en_attente_paiement', async () => {
    const table = await pool.query(`
      INSERT INTO tables (numero) VALUES ('T8') RETURNING id
    `)
    const profile = await pool.query(`
      INSERT INTO profiles (id, email, nom, prenom, role)
      VALUES (gen_random_uuid(), 'default3@test.com', 'Test', 'User', 'serveuse')
      RETURNING id
    `)
    const commande = await pool.query(`
      INSERT INTO commandes (numero_commande, table_id, serveuse_id)
      VALUES ('CMD-DEFAULT-003', $1, $2) RETURNING id
    `, [table.rows[0].id, profile.rows[0].id])
    
    const result = await pool.query(`
      INSERT INTO factures (numero_facture, commande_id, montant_total, montant_restant)
      VALUES ('FACT-DEFAULT-001', $1, 1000, 1000)
      RETURNING statut
    `, [commande.rows[0].id])
    
    expect(result.rows[0].statut).toBe('en_attente_paiement')
  })

  it('should set default value for factures.montant_paye to 0', async () => {
    const table = await pool.query(`
      INSERT INTO tables (numero) VALUES ('T9') RETURNING id
    `)
    const profile = await pool.query(`
      INSERT INTO profiles (id, email, nom, prenom, role)
      VALUES (gen_random_uuid(), 'default4@test.com', 'Test', 'User', 'serveuse')
      RETURNING id
    `)
    const commande = await pool.query(`
      INSERT INTO commandes (numero_commande, table_id, serveuse_id)
      VALUES ('CMD-DEFAULT-004', $1, $2) RETURNING id
    `, [table.rows[0].id, profile.rows[0].id])
    
    const result = await pool.query(`
      INSERT INTO factures (numero_facture, commande_id, montant_total, montant_restant)
      VALUES ('FACT-DEFAULT-002', $1, 1000, 1000)
      RETURNING montant_paye
    `, [commande.rows[0].id])
    
    expect(result.rows[0].montant_paye).toBe(0)
  })

  it('should generate UUID for id columns by default', async () => {
    const result = await pool.query(`
      INSERT INTO produits (nom, categorie, prix_vente)
      VALUES ('UUID Test', 'boisson', 500)
      RETURNING id
    `)
    
    expect(result.rows[0].id).toBeTruthy()
    expect(typeof result.rows[0].id).toBe('string')
    // UUID v4 format check
    expect(result.rows[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })
})
