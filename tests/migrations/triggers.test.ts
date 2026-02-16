import { describe, it, expect, beforeEach } from 'vitest'
import { getTestPool } from '../setup'

describe('Database Triggers - Sequential Number Generation', () => {
  let pool: any
  
  beforeEach(async () => {
    pool = await getTestPool()
  })

  it('should generate sequential numero_commande automatically', async () => {
    const table = await pool.query(`
      INSERT INTO tables (numero) VALUES ('T10') RETURNING id
    `)
    const profile = await pool.query(`
      INSERT INTO profiles (id, email, nom, prenom, role)
      VALUES (gen_random_uuid(), 'trigger1@test.com', 'Test', 'User', 'serveuse')
      RETURNING id
    `)
    
    // Insert first commande without numero_commande
    const result1 = await pool.query(`
      INSERT INTO commandes (table_id, serveuse_id)
      VALUES ($1, $2)
      RETURNING numero_commande
    `, [table.rows[0].id, profile.rows[0].id])
    
    expect(result1.rows[0].numero_commande).toMatch(/^CMD-\d{8}-\d{3}$/)
    
    // Insert second commande
    const result2 = await pool.query(`
      INSERT INTO commandes (table_id, serveuse_id)
      VALUES ($1, $2)
      RETURNING numero_commande
    `, [table.rows[0].id, profile.rows[0].id])
    
    expect(result2.rows[0].numero_commande).toMatch(/^CMD-\d{8}-\d{3}$/)
    
    // Extract numbers and verify they're sequential
    const num1 = parseInt(result1.rows[0].numero_commande.split('-')[2])
    const num2 = parseInt(result2.rows[0].numero_commande.split('-')[2])
    
    expect(num2).toBe(num1 + 1)
  })

  it('should generate sequential numero_ravitaillement automatically', async () => {
    const profile = await pool.query(`
      INSERT INTO profiles (id, email, nom, prenom, role)
      VALUES (gen_random_uuid(), 'trigger2@test.com', 'Test', 'User', 'gerant')
      RETURNING id
    `)
    
    // Insert first ravitaillement
    const result1 = await pool.query(`
      INSERT INTO ravitaillements (fournisseur, date_ravitaillement, gerant_id)
      VALUES ('Fournisseur A', CURRENT_DATE, $1)
      RETURNING numero_ravitaillement
    `, [profile.rows[0].id])
    
    expect(result1.rows[0].numero_ravitaillement).toMatch(/^RAV-\d{8}-\d{3}$/)
    
    // Insert second ravitaillement
    const result2 = await pool.query(`
      INSERT INTO ravitaillements (fournisseur, date_ravitaillement, gerant_id)
      VALUES ('Fournisseur B', CURRENT_DATE, $1)
      RETURNING numero_ravitaillement
    `, [profile.rows[0].id])
    
    expect(result2.rows[0].numero_ravitaillement).toMatch(/^RAV-\d{8}-\d{3}$/)
    
    // Extract numbers and verify they're sequential
    const num1 = parseInt(result1.rows[0].numero_ravitaillement.split('-')[2])
    const num2 = parseInt(result2.rows[0].numero_ravitaillement.split('-')[2])
    
    expect(num2).toBe(num1 + 1)
  })

  it('should generate sequential numero_facture automatically', async () => {
    const table = await pool.query(`
      INSERT INTO tables (numero) VALUES ('T11') RETURNING id
    `)
    const profile = await pool.query(`
      INSERT INTO profiles (id, email, nom, prenom, role)
      VALUES (gen_random_uuid(), 'trigger3@test.com', 'Test', 'User', 'serveuse')
      RETURNING id
    `)
    const commande1 = await pool.query(`
      INSERT INTO commandes (numero_commande, table_id, serveuse_id)
      VALUES ('CMD-TRIG-001', $1, $2) RETURNING id
    `, [table.rows[0].id, profile.rows[0].id])
    const commande2 = await pool.query(`
      INSERT INTO commandes (numero_commande, table_id, serveuse_id)
      VALUES ('CMD-TRIG-002', $1, $2) RETURNING id
    `, [table.rows[0].id, profile.rows[0].id])
    
    // Insert first facture
    const result1 = await pool.query(`
      INSERT INTO factures (commande_id, montant_total, montant_restant)
      VALUES ($1, 1000, 1000)
      RETURNING numero_facture
    `, [commande1.rows[0].id])
    
    expect(result1.rows[0].numero_facture).toMatch(/^FACT-\d{8}-\d{3}$/)
    
    // Insert second facture
    const result2 = await pool.query(`
      INSERT INTO factures (commande_id, montant_total, montant_restant)
      VALUES ($1, 2000, 2000)
      RETURNING numero_facture
    `, [commande2.rows[0].id])
    
    expect(result2.rows[0].numero_facture).toMatch(/^FACT-\d{8}-\d{3}$/)
    
    // Extract numbers and verify they're sequential
    const num1 = parseInt(result1.rows[0].numero_facture.split('-')[2])
    const num2 = parseInt(result2.rows[0].numero_facture.split('-')[2])
    
    expect(num2).toBe(num1 + 1)
  })

  it('should not override manually provided numero_commande', async () => {
    const table = await pool.query(`
      INSERT INTO tables (numero) VALUES ('T12') RETURNING id
    `)
    const profile = await pool.query(`
      INSERT INTO profiles (id, email, nom, prenom, role)
      VALUES (gen_random_uuid(), 'trigger4@test.com', 'Test', 'User', 'serveuse')
      RETURNING id
    `)
    
    const customNumero = 'CMD-CUSTOM-999'
    const result = await pool.query(`
      INSERT INTO commandes (numero_commande, table_id, serveuse_id)
      VALUES ($1, $2, $3)
      RETURNING numero_commande
    `, [customNumero, table.rows[0].id, profile.rows[0].id])
    
    expect(result.rows[0].numero_commande).toBe(customNumero)
  })
})

describe('Database Triggers - Commande Total Calculation', () => {
  let pool: any
  let commandeId: string
  let produitId: string
  
  beforeEach(async () => {
    pool = await getTestPool()
    
    // Setup test data
    const table = await pool.query(`
      INSERT INTO tables (numero) VALUES ('T13') RETURNING id
    `)
    const profile = await pool.query(`
      INSERT INTO profiles (id, email, nom, prenom, role)
      VALUES (gen_random_uuid(), 'trigger5@test.com', 'Test', 'User', 'serveuse')
      RETURNING id
    `)
    const produit = await pool.query(`
      INSERT INTO produits (nom, categorie, prix_vente)
      VALUES ('Trigger Product', 'boisson', 500) RETURNING id
    `)
    const commande = await pool.query(`
      INSERT INTO commandes (numero_commande, table_id, serveuse_id)
      VALUES ('CMD-CALC-001', $1, $2) RETURNING id
    `, [table.rows[0].id, profile.rows[0].id])
    
    commandeId = commande.rows[0].id
    produitId = produit.rows[0].id
  })

  it('should calculate montant_total when commande_items are inserted', async () => {
    // Insert first item
    await pool.query(`
      INSERT INTO commande_items (commande_id, produit_id, nom_produit, prix_unitaire, quantite, montant_ligne)
      VALUES ($1, $2, 'Trigger Product', 500, 2, 1000)
    `, [commandeId, produitId])
    
    let result = await pool.query(`
      SELECT montant_total FROM commandes WHERE id = $1
    `, [commandeId])
    
    expect(result.rows[0].montant_total).toBe(1000)
    
    // Insert second item
    await pool.query(`
      INSERT INTO commande_items (commande_id, produit_id, nom_produit, prix_unitaire, quantite, montant_ligne)
      VALUES ($1, $2, 'Trigger Product', 500, 3, 1500)
    `, [commandeId, produitId])
    
    result = await pool.query(`
      SELECT montant_total FROM commandes WHERE id = $1
    `, [commandeId])
    
    expect(result.rows[0].montant_total).toBe(2500)
  })

  it('should update montant_total when commande_items are updated', async () => {
    // Insert item
    const item = await pool.query(`
      INSERT INTO commande_items (commande_id, produit_id, nom_produit, prix_unitaire, quantite, montant_ligne)
      VALUES ($1, $2, 'Trigger Product', 500, 2, 1000)
      RETURNING id
    `, [commandeId, produitId])
    
    // Update item
    await pool.query(`
      UPDATE commande_items
      SET quantite = 5, montant_ligne = 2500
      WHERE id = $1
    `, [item.rows[0].id])
    
    const result = await pool.query(`
      SELECT montant_total FROM commandes WHERE id = $1
    `, [commandeId])
    
    expect(result.rows[0].montant_total).toBe(2500)
  })

  it('should update montant_total when commande_items are deleted', async () => {
    // Insert two items
    const item1 = await pool.query(`
      INSERT INTO commande_items (commande_id, produit_id, nom_produit, prix_unitaire, quantite, montant_ligne)
      VALUES ($1, $2, 'Trigger Product', 500, 2, 1000)
      RETURNING id
    `, [commandeId, produitId])
    
    await pool.query(`
      INSERT INTO commande_items (commande_id, produit_id, nom_produit, prix_unitaire, quantite, montant_ligne)
      VALUES ($1, $2, 'Trigger Product', 500, 3, 1500)
    `, [commandeId, produitId])
    
    let result = await pool.query(`
      SELECT montant_total FROM commandes WHERE id = $1
    `, [commandeId])
    
    expect(result.rows[0].montant_total).toBe(2500)
    
    // Delete first item
    await pool.query(`
      DELETE FROM commande_items WHERE id = $1
    `, [item1.rows[0].id])
    
    result = await pool.query(`
      SELECT montant_total FROM commandes WHERE id = $1
    `, [commandeId])
    
    expect(result.rows[0].montant_total).toBe(1500)
  })
})

describe('Database Triggers - Product Modification Date', () => {
  let pool: any
  
  beforeEach(async () => {
    pool = await getTestPool()
  })

  it('should update date_modification when product is updated', async () => {
    // Insert product
    const result1 = await pool.query(`
      INSERT INTO produits (nom, categorie, prix_vente)
      VALUES ('Date Test', 'boisson', 500)
      RETURNING id, date_modification
    `)
    
    const produitId = result1.rows[0].id
    const dateModification1 = new Date(result1.rows[0].date_modification)
    
    // Wait a bit to ensure time difference
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Update product
    await pool.query(`
      UPDATE produits SET prix_vente = 600 WHERE id = $1
    `, [produitId])
    
    const result2 = await pool.query(`
      SELECT date_modification FROM produits WHERE id = $1
    `, [produitId])
    
    const dateModification2 = new Date(result2.rows[0].date_modification)
    
    expect(dateModification2.getTime()).toBeGreaterThan(dateModification1.getTime())
  })
})
