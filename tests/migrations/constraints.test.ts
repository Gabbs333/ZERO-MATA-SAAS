import { describe, it, expect, beforeEach } from 'vitest'
import { getTestPool } from '../setup'

describe('Database Constraints - Uniqueness', () => {
  let pool: any
  
  beforeEach(async () => {
    pool = await getTestPool()
  })

  it('should enforce unique constraint on produits.nom', async () => {
    await pool.query(`
      INSERT INTO produits (nom, categorie, prix_vente)
      VALUES ('Coca-Cola', 'boisson', 500)
    `)
    
    await expect(
      pool.query(`
        INSERT INTO produits (nom, categorie, prix_vente)
        VALUES ('Coca-Cola', 'boisson', 600)
      `)
    ).rejects.toThrow()
  })

  it('should enforce unique constraint on tables.numero', async () => {
    await pool.query(`
      INSERT INTO tables (numero) VALUES ('T1')
    `)
    
    await expect(
      pool.query(`INSERT INTO tables (numero) VALUES ('T1')`)
    ).rejects.toThrow()
  })

  it('should enforce unique constraint on commandes.numero_commande', async () => {
    // Create dependencies
    const table = await pool.query(`
      INSERT INTO tables (numero) VALUES ('T1') RETURNING id
    `)
    const profile = await pool.query(`
      INSERT INTO profiles (id, email, nom, prenom, role)
      VALUES (gen_random_uuid(), 'test@test.com', 'Test', 'User', 'serveuse')
      RETURNING id
    `)
    
    await pool.query(`
      INSERT INTO commandes (numero_commande, table_id, serveuse_id)
      VALUES ('CMD-20240115-001', $1, $2)
    `, [table.rows[0].id, profile.rows[0].id])
    
    await expect(
      pool.query(`
        INSERT INTO commandes (numero_commande, table_id, serveuse_id)
        VALUES ('CMD-20240115-001', $1, $2)
      `, [table.rows[0].id, profile.rows[0].id])
    ).rejects.toThrow()
  })

  it('should enforce unique constraint on factures.numero_facture', async () => {
    // Create dependencies
    const table = await pool.query(`
      INSERT INTO tables (numero) VALUES ('T1') RETURNING id
    `)
    const profile = await pool.query(`
      INSERT INTO profiles (id, email, nom, prenom, role)
      VALUES (gen_random_uuid(), 'test2@test.com', 'Test', 'User', 'serveuse')
      RETURNING id
    `)
    const commande1 = await pool.query(`
      INSERT INTO commandes (numero_commande, table_id, serveuse_id)
      VALUES ('CMD-20240115-002', $1, $2) RETURNING id
    `, [table.rows[0].id, profile.rows[0].id])
    const commande2 = await pool.query(`
      INSERT INTO commandes (numero_commande, table_id, serveuse_id)
      VALUES ('CMD-20240115-003', $1, $2) RETURNING id
    `, [table.rows[0].id, profile.rows[0].id])
    
    await pool.query(`
      INSERT INTO factures (numero_facture, commande_id, montant_total, montant_restant)
      VALUES ('FACT-20240115-001', $1, 1000, 1000)
    `, [commande1.rows[0].id])
    
    await expect(
      pool.query(`
        INSERT INTO factures (numero_facture, commande_id, montant_total, montant_restant)
        VALUES ('FACT-20240115-001', $1, 1000, 1000)
      `, [commande2.rows[0].id])
    ).rejects.toThrow()
  })
})

describe('Database Constraints - Foreign Keys', () => {
  let pool: any
  
  beforeEach(async () => {
    pool = await getTestPool()
  })

  it('should enforce foreign key constraint on commandes.table_id', async () => {
    const profile = await pool.query(`
      INSERT INTO profiles (id, email, nom, prenom, role)
      VALUES (gen_random_uuid(), 'fk1@test.com', 'Test', 'User', 'serveuse')
      RETURNING id
    `)
    
    await expect(
      pool.query(`
        INSERT INTO commandes (numero_commande, table_id, serveuse_id)
        VALUES ('CMD-TEST-001', gen_random_uuid(), $1)
      `, [profile.rows[0].id])
    ).rejects.toThrow()
  })

  it('should enforce foreign key constraint on commande_items.produit_id', async () => {
    const table = await pool.query(`
      INSERT INTO tables (numero) VALUES ('T2') RETURNING id
    `)
    const profile = await pool.query(`
      INSERT INTO profiles (id, email, nom, prenom, role)
      VALUES (gen_random_uuid(), 'fk2@test.com', 'Test', 'User', 'serveuse')
      RETURNING id
    `)
    const commande = await pool.query(`
      INSERT INTO commandes (numero_commande, table_id, serveuse_id)
      VALUES ('CMD-TEST-002', $1, $2) RETURNING id
    `, [table.rows[0].id, profile.rows[0].id])
    
    await expect(
      pool.query(`
        INSERT INTO commande_items (commande_id, produit_id, nom_produit, prix_unitaire, quantite, montant_ligne)
        VALUES ($1, gen_random_uuid(), 'Test', 500, 1, 500)
      `, [commande.rows[0].id])
    ).rejects.toThrow()
  })

  it('should enforce foreign key constraint on factures.commande_id', async () => {
    await expect(
      pool.query(`
        INSERT INTO factures (numero_facture, commande_id, montant_total, montant_restant)
        VALUES ('FACT-TEST-001', gen_random_uuid(), 1000, 1000)
      `)
    ).rejects.toThrow()
  })

  it('should cascade delete commande_items when commande is deleted', async () => {
    const table = await pool.query(`
      INSERT INTO tables (numero) VALUES ('T3') RETURNING id
    `)
    const profile = await pool.query(`
      INSERT INTO profiles (id, email, nom, prenom, role)
      VALUES (gen_random_uuid(), 'fk3@test.com', 'Test', 'User', 'serveuse')
      RETURNING id
    `)
    const produit = await pool.query(`
      INSERT INTO produits (nom, categorie, prix_vente)
      VALUES ('Test Product', 'boisson', 500) RETURNING id
    `)
    const commande = await pool.query(`
      INSERT INTO commandes (numero_commande, table_id, serveuse_id)
      VALUES ('CMD-TEST-003', $1, $2) RETURNING id
    `, [table.rows[0].id, profile.rows[0].id])
    
    await pool.query(`
      INSERT INTO commande_items (commande_id, produit_id, nom_produit, prix_unitaire, quantite, montant_ligne)
      VALUES ($1, $2, 'Test Product', 500, 2, 1000)
    `, [commande.rows[0].id, produit.rows[0].id])
    
    // Delete commande
    await pool.query(`DELETE FROM commandes WHERE id = $1`, [commande.rows[0].id])
    
    // Check that commande_items were deleted
    const result = await pool.query(`
      SELECT COUNT(*) FROM commande_items WHERE commande_id = $1
    `, [commande.rows[0].id])
    
    expect(parseInt(result.rows[0].count)).toBe(0)
  })
})

describe('Database Constraints - Check Constraints', () => {
  let pool: any
  
  beforeEach(async () => {
    pool = await getTestPool()
  })

  it('should enforce check constraint on produits.prix_vente > 0', async () => {
    await expect(
      pool.query(`
        INSERT INTO produits (nom, categorie, prix_vente)
        VALUES ('Invalid Product', 'boisson', 0)
      `)
    ).rejects.toThrow()
    
    await expect(
      pool.query(`
        INSERT INTO produits (nom, categorie, prix_vente)
        VALUES ('Invalid Product 2', 'boisson', -100)
      `)
    ).rejects.toThrow()
  })

  it('should enforce check constraint on stock.quantite_disponible >= 0', async () => {
    const produit = await pool.query(`
      INSERT INTO produits (nom, categorie, prix_vente)
      VALUES ('Stock Test', 'boisson', 500) RETURNING id
    `)
    
    await expect(
      pool.query(`
        INSERT INTO stock (produit_id, quantite_disponible)
        VALUES ($1, -10)
      `, [produit.rows[0].id])
    ).rejects.toThrow()
  })

  it('should enforce check constraint on commande_items.quantite > 0', async () => {
    const table = await pool.query(`
      INSERT INTO tables (numero) VALUES ('T4') RETURNING id
    `)
    const profile = await pool.query(`
      INSERT INTO profiles (id, email, nom, prenom, role)
      VALUES (gen_random_uuid(), 'check1@test.com', 'Test', 'User', 'serveuse')
      RETURNING id
    `)
    const produit = await pool.query(`
      INSERT INTO produits (nom, categorie, prix_vente)
      VALUES ('Check Product', 'boisson', 500) RETURNING id
    `)
    const commande = await pool.query(`
      INSERT INTO commandes (numero_commande, table_id, serveuse_id)
      VALUES ('CMD-CHECK-001', $1, $2) RETURNING id
    `, [table.rows[0].id, profile.rows[0].id])
    
    await expect(
      pool.query(`
        INSERT INTO commande_items (commande_id, produit_id, nom_produit, prix_unitaire, quantite, montant_ligne)
        VALUES ($1, $2, 'Check Product', 500, 0, 0)
      `, [commande.rows[0].id, produit.rows[0].id])
    ).rejects.toThrow()
  })

  it('should enforce check constraint on profiles.role', async () => {
    await expect(
      pool.query(`
        INSERT INTO profiles (id, email, nom, prenom, role)
        VALUES (gen_random_uuid(), 'invalid@test.com', 'Test', 'User', 'invalid_role')
      `)
    ).rejects.toThrow()
  })

  it('should enforce check constraint on factures.montant_paye <= montant_total', async () => {
    const table = await pool.query(`
      INSERT INTO tables (numero) VALUES ('T5') RETURNING id
    `)
    const profile = await pool.query(`
      INSERT INTO profiles (id, email, nom, prenom, role)
      VALUES (gen_random_uuid(), 'check2@test.com', 'Test', 'User', 'serveuse')
      RETURNING id
    `)
    const commande = await pool.query(`
      INSERT INTO commandes (numero_commande, table_id, serveuse_id)
      VALUES ('CMD-CHECK-002', $1, $2) RETURNING id
    `, [table.rows[0].id, profile.rows[0].id])
    
    await expect(
      pool.query(`
        INSERT INTO factures (numero_facture, commande_id, montant_total, montant_paye, montant_restant)
        VALUES ('FACT-CHECK-001', $1, 1000, 1500, -500)
      `, [commande.rows[0].id])
    ).rejects.toThrow()
  })
})
