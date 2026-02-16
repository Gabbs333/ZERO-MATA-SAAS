# Intégration Frontend-Backend - Mapping des Écrans UI aux Ressources Supabase

## Vue d'Ensemble

Ce document établit la correspondance exacte entre les 18 écrans de maquettes HTML et les ressources backend Supabase (tables, fonctions, RLS policies, subscriptions Realtime). Chaque écran est mappé avec :

- Les tables Supabase utilisées
- Les requêtes Supabase spécifiques
- Les fonctions PostgreSQL appelées
- Les subscriptions Realtime configurées
- Les RLS policies appliquées

## Application Manager (Gérant)

### 1. Manager Dashboard (#1)

**Description** : Tableau de bord principal du gérant avec KPIs et graphiques

**Tables Supabase** :
- `commandes` (lecture)
- `factures` (lecture)
- `encaissements` (lecture)
- `stock` (lecture)
- `ravitaillements` (lecture)

**Requêtes Supabase** :
```typescript
// KPIs principaux
const { data: kpis } = await supabase.rpc('get_kpis', {
  debut: startDate,
  fin: endDate
})

// Évolution du CA
const { data: evolutionCA } = await supabase
  .from('analytics_evolution_ca')
  .select('*')
  .gte('date', startDate)
  .lte('date', endDate)

// Ventes par produit
const { data: ventesParProduit } = await supabase
  .from('analytics_ventes_produits')
  .select('*')
  .gte('date', startDate)
  .lte('date', endDate)
  .order('quantite_vendue', { ascending: false })
```

**Fonctions PostgreSQL** :
- `get_kpis(debut, fin)` - Retourne CA, bénéfice, nombre commandes, panier moyen

**Subscriptions Realtime** :
```typescript
// Mise à jour en temps réel des commandes
const commandesSubscription = supabase
  .channel('commandes_realtime')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'commandes'
  }, (payload) => {
    // Rafraîchir les KPIs
    refreshKPIs()
  })
  .subscribe()
```

**RLS Policies** :
- `gerant_all_commandes` - Le gérant voit toutes les commandes
- `gerant_all_factures` - Le gérant voit toutes les factures

---

### 2. Stock Inventory (#2)

**Description** : Gestion complète du stock avec alertes

**Tables Supabase** :
- `stock` (lecture)
- `produits` (lecture)
- `mouvements_stock` (lecture)

**Requêtes Supabase** :
```typescript
// Liste du stock avec produits
const { data: stockList } = await supabase
  .from('stock')
  .select(`
    *,
    produits (
      id,
      nom,
      categorie,
      prix_vente,
      seuil_stock_minimum
    )
  `)
  .order('derniere_mise_a_jour', { ascending: false })

// Alertes de stock bas
const { data: alertes } = await supabase
  .rpc('check_stock_alerts')

// Historique des mouvements
const { data: mouvements } = await supabase
  .from('mouvements_stock')
  .select(`
    *,
    produits (nom),
    profiles (nom, prenom)
  `)
  .order('date_creation', { ascending: false })
  .limit(50)
```

**Fonctions PostgreSQL** :
- `check_stock_alerts()` - Retourne les produits avec stock <= seuil

**Subscriptions Realtime** :
```typescript
// Mise à jour en temps réel du stock
const stockSubscription = supabase
  .channel('stock_realtime')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'stock'
  }, (payload) => {
    // Mettre à jour la ligne de stock
    updateStockRow(payload.new)
  })
  .subscribe()
```

**RLS Policies** :
- `everyone_read_stock` - Tout le monde peut lire le stock
- `system_only_update_stock` - Seul le système (triggers) peut modifier

---


### 3. Financial Dashboard (#3)

**Description** : Tableau de bord financier avec CA, encaissements, créances

**Tables Supabase** :
- `factures` (lecture)
- `encaissements` (lecture)
- `commandes` (lecture)

**Requêtes Supabase** :
```typescript
// Vue analytique CA vs Encaissements
const { data: analytics } = await supabase
  .from('analytics_ca_encaissements')
  .select('*')
  .gte('date', startDate)
  .lte('date', endDate)

// Calcul des créances
const { data: creances } = await supabase
  .from('analytics_creances')
  .select('*')
  .single()

// Factures impayées
const { data: facturesImpayees } = await supabase
  .rpc('get_factures_impayees')

// Statistiques par mode de paiement
const { data: statsPaiement } = await supabase
  .from('analytics_by_payment_mode')
  .select('*')
  .gte('date', startDate)
  .lte('date', endDate)
```

**Fonctions PostgreSQL** :
- `get_factures_impayees()` - Retourne les factures non payées
- `get_kpis(debut, fin)` - Inclut CA et encaissements séparés

**Subscriptions Realtime** :
```typescript
// Mise à jour en temps réel des encaissements
const encaissementsSubscription = supabase
  .channel('encaissements_realtime')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'encaissements'
  }, (payload) => {
    // Rafraîchir les statistiques financières
    refreshFinancialStats()
  })
  .subscribe()
```

**RLS Policies** :
- `gerant_all_factures` - Le gérant voit toutes les factures
- `gerant_all_encaissements` - Le gérant voit tous les encaissements

---

### 4. Payment Entry (#4)

**Description** : Formulaire d'enregistrement d'encaissement

**Tables Supabase** :
- `factures` (lecture)
- `encaissements` (création)

**Requêtes Supabase** :
```typescript
// Récupérer la facture
const { data: facture } = await supabase
  .from('factures')
  .select(`
    *,
    commandes (
      numero_commande,
      montant_total,
      tables (numero)
    )
  `)
  .eq('id', factureId)
  .single()

// Créer un encaissement
const { data: encaissement, error } = await supabase
  .rpc('create_encaissement', {
    facture_id: factureId,
    montant: montantPaye,
    mode_paiement: modePaiement,
    reference: reference
  })

// Historique des encaissements de la facture
const { data: historique } = await supabase
  .from('encaissements')
  .select('*')
  .eq('facture_id', factureId)
  .order('date_encaissement', { ascending: false })
```

**Fonctions PostgreSQL** :
- `create_encaissement(facture_id, montant, mode_paiement, reference)` - Crée l'encaissement et met à jour la facture

**Triggers Automatiques** :
- `trigger_update_facture_status` - Met à jour le statut de la facture après encaissement

**RLS Policies** :
- `comptoir_create_encaissements` - Le comptoir peut créer des encaissements
- `gerant_create_encaissements` - Le gérant peut créer des encaissements

---

### 5. Supply History (#5)

**Description** : Historique des ravitaillements avec filtres

**Tables Supabase** :
- `ravitaillements` (lecture)
- `ravitaillement_items` (lecture)
- `produits` (lecture)

**Requêtes Supabase** :
```typescript
// Liste des ravitaillements avec filtres
const { data: ravitaillements } = await supabase
  .from('ravitaillements')
  .select(`
    *,
    profiles (nom, prenom),
    ravitaillement_items (
      *,
      produits (nom)
    )
  `)
  .gte('date_ravitaillement', startDate)
  .lte('date_ravitaillement', endDate)
  .order('date_creation', { ascending: false })

// Détails d'un ravitaillement
const { data: ravitaillement } = await supabase
  .from('ravitaillements')
  .select(`
    *,
    profiles (nom, prenom),
    ravitaillement_items (
      *,
      produits (nom, categorie)
    )
  `)
  .eq('id', ravitaillementId)
  .single()
```

**Fonctions PostgreSQL** :
- `get_ravitaillements_by_period(debut, fin)` - Filtre par période

**Subscriptions Realtime** :
```typescript
// Mise à jour en temps réel des ravitaillements
const ravitaillementsSubscription = supabase
  .channel('ravitaillements_realtime')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'ravitaillements'
  }, (payload) => {
    // Ajouter le nouveau ravitaillement à la liste
    addRavitaillementToList(payload.new)
  })
  .subscribe()
```

**RLS Policies** :
- `everyone_read_ravitaillements` - Tout le monde peut lire les ravitaillements
- `gerant_create_ravitaillements` - Seul le gérant peut créer

---

## Application Patron (Owner)

### 6. Profit & Loss (#6)

**Description** : Rapport de profits et pertes détaillé

**Tables Supabase** :
- `commandes` (lecture)
- `ravitaillements` (lecture)
- `mouvements_stock` (lecture)

**Requêtes Supabase** :
```typescript
// Calcul du bénéfice
const { data: benefice } = await supabase.rpc('get_kpis', {
  debut: startDate,
  fin: endDate
})

// Détail des coûts (ravitaillements)
const { data: couts } = await supabase
  .from('ravitaillements')
  .select('montant_total')
  .gte('date_ravitaillement', startDate)
  .lte('date_ravitaillement', endDate)

// Détail des revenus (commandes validées)
const { data: revenus } = await supabase
  .from('commandes')
  .select('montant_total')
  .eq('statut', 'validee')
  .gte('date_validation', startDate)
  .lte('date_validation', endDate)

// Marge par produit
const { data: marges } = await supabase
  .from('analytics_ventes_produits')
  .select('*')
  .gte('date', startDate)
  .lte('date', endDate)
```

**Fonctions PostgreSQL** :
- `get_kpis(debut, fin)` - Retourne le bénéfice calculé (CA - coûts)

**RLS Policies** :
- `patron_all_data` - Le patron voit toutes les données

---

### 7. Outstanding Debts (#7)

**Description** : Liste des créances et factures impayées

**Tables Supabase** :
- `factures` (lecture)
- `encaissements` (lecture)
- `commandes` (lecture)

**Requêtes Supabase** :
```typescript
// Factures impayées avec ancienneté
const { data: facturesImpayees } = await supabase
  .from('factures_overdue')
  .select(`
    *,
    commandes (
      numero_commande,
      tables (numero),
      profiles (nom, prenom)
    )
  `)
  .order('date_generation', { ascending: true })

// Alertes de factures > 24h
const { data: alertes } = await supabase
  .rpc('get_factures_impayees_alerts')

// Total des créances
const { data: totalCreances } = await supabase
  .from('factures')
  .select('montant_restant')
  .neq('statut', 'payee')
```

**Fonctions PostgreSQL** :
- `get_factures_impayees_alerts()` - Retourne les factures impayées > 24h

**Vues PostgreSQL** :
- `factures_overdue` - Vue avec calcul de l'ancienneté
- `factures_with_age` - Vue avec âge de la facture

**Subscriptions Realtime** :
```typescript
// Mise à jour en temps réel des factures
const facturesSubscription = supabase
  .channel('factures_realtime')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'factures'
  }, (payload) => {
    // Mettre à jour la liste des créances
    updateCreancesList(payload.new)
  })
  .subscribe()
```

**RLS Policies** :
- `patron_all_factures` - Le patron voit toutes les factures

---


## Application Comptoir (Counter)

### 8. Counter Validation (#8)

**Description** : Écran de validation des commandes en attente

**Tables Supabase** :
- `commandes` (lecture, mise à jour)
- `commande_items` (lecture)
- `stock` (lecture)
- `produits` (lecture)
- `tables` (lecture)
- `profiles` (lecture)

**Requêtes Supabase** :
```typescript
// Commandes en attente
const { data: commandesEnAttente } = await supabase
  .from('commandes')
  .select(`
    *,
    tables (numero),
    profiles!serveuse_id (nom, prenom),
    commande_items (
      *,
      produits (nom, prix_vente)
    )
  `)
  .eq('statut', 'en_attente')
  .order('date_creation', { ascending: true })

// Valider une commande
const { data, error } = await supabase
  .rpc('validate_commande', {
    commande_id: commandeId
  })

// Rejeter une commande
const { error } = await supabase
  .from('commandes')
  .update({ statut: 'annulee' })
  .eq('id', commandeId)
  .eq('statut', 'en_attente')
```

**Fonctions PostgreSQL** :
- `validate_commande(commande_id)` - Valide la commande, vérifie le stock, déduit, crée mouvements et facture

**Triggers Automatiques** :
- `trigger_update_stock_on_validation` - Déduit le stock automatiquement
- `trigger_create_facture_on_validation` - Crée la facture automatiquement
- `trigger_update_table_status` - Met à jour le statut de la table

**Subscriptions Realtime** :
```typescript
// Nouvelles commandes en temps réel
const commandesSubscription = supabase
  .channel('commandes_en_attente')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'commandes',
    filter: 'statut=eq.en_attente'
  }, (payload) => {
    // Ajouter la nouvelle commande à la liste
    addCommandeToList(payload.new)
    // Notification sonore
    playNotificationSound()
  })
  .subscribe()
```

**RLS Policies** :
- `comptoir_read_pending_commandes` - Le comptoir voit les commandes en attente
- `comptoir_validate_commandes` - Le comptoir peut valider les commandes

---

### 9. Product Catalog (#9)

**Description** : Catalogue des produits disponibles

**Tables Supabase** :
- `produits` (lecture)
- `stock` (lecture)

**Requêtes Supabase** :
```typescript
// Produits disponibles (actifs avec stock > 0)
const { data: produitsDisponibles } = await supabase
  .rpc('get_produits_disponibles')

// Tous les produits (pour le gérant)
const { data: tousProduits } = await supabase
  .from('produits')
  .select(`
    *,
    stock (quantite_disponible)
  `)
  .order('nom', { ascending: true })

// Produits par catégorie
const { data: produitsByCategorie } = await supabase
  .from('produits')
  .select(`
    *,
    stock (quantite_disponible)
  `)
  .eq('actif', true)
  .eq('categorie', categorie)
  .order('nom', { ascending: true })
```

**Fonctions PostgreSQL** :
- `get_produits_disponibles()` - Retourne les produits actifs avec stock > 0

**Subscriptions Realtime** :
```typescript
// Mise à jour en temps réel du stock
const stockSubscription = supabase
  .channel('stock_updates')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'stock'
  }, (payload) => {
    // Mettre à jour la quantité affichée
    updateProductStock(payload.new)
  })
  .subscribe()
```

**RLS Policies** :
- `everyone_read_active_products` - Tout le monde voit les produits actifs

---

## Application Serveuse (Waitress)

### 10. Order Entry (#10)

**Description** : Écran de prise de commande

**Tables Supabase** :
- `commandes` (création)
- `commande_items` (création)
- `produits` (lecture)
- `stock` (lecture)
- `tables` (lecture, mise à jour)

**Requêtes Supabase** :
```typescript
// Produits disponibles pour la commande
const { data: produits } = await supabase
  .rpc('get_produits_disponibles')

// Créer une commande
const { data: commande, error } = await supabase
  .rpc('create_commande', {
    table_id: tableId,
    items: [
      { produit_id: 'uuid', quantite: 2 },
      { produit_id: 'uuid', quantite: 1 }
    ]
  })

// Annuler une commande non validée
const { error } = await supabase
  .from('commandes')
  .delete()
  .eq('id', commandeId)
  .eq('statut', 'en_attente')
  .eq('serveuse_id', currentUserId)
```

**Fonctions PostgreSQL** :
- `create_commande(table_id, items)` - Crée la commande avec calcul automatique du montant total
- `get_produits_disponibles()` - Retourne les produits disponibles

**Triggers Automatiques** :
- `trigger_generate_numero_commande` - Génère le numéro de commande automatiquement
- `trigger_calculate_commande_total` - Calcule le montant total automatiquement
- `trigger_update_table_status` - Met à jour le statut de la table à "commande_en_attente"

**Subscriptions Realtime** :
```typescript
// Notification de validation en temps réel
const validationSubscription = supabase
  .channel('my_commandes')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'commandes',
    filter: `serveuse_id=eq.${currentUserId}`
  }, (payload) => {
    if (payload.new.statut === 'validee') {
      // Afficher notification de validation
      showValidationNotification(payload.new)
    }
  })
  .subscribe()
```

**RLS Policies** :
- `serveuses_create_commandes` - Les serveuses peuvent créer des commandes
- `serveuses_own_commandes` - Les serveuses voient uniquement leurs propres commandes

---

### 11. Table Management (#11)

**Description** : Gestion des tables et de leurs statuts

**Tables Supabase** :
- `tables` (lecture, mise à jour)
- `commandes` (lecture)

**Requêtes Supabase** :
```typescript
// Liste des tables avec statuts
const { data: tables } = await supabase
  .from('tables')
  .select('*')
  .order('numero', { ascending: true })

// Libérer une table
const { error } = await supabase
  .from('tables')
  .update({ statut: 'libre' })
  .eq('id', tableId)

// Commandes actives par table
const { data: commandesTable } = await supabase
  .from('commandes')
  .select(`
    *,
    commande_items (
      *,
      produits (nom)
    )
  `)
  .eq('table_id', tableId)
  .in('statut', ['en_attente', 'validee'])
  .order('date_creation', { ascending: false })
```

**Subscriptions Realtime** :
```typescript
// Mise à jour en temps réel des statuts de tables
const tablesSubscription = supabase
  .channel('tables_status')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'tables'
  }, (payload) => {
    // Mettre à jour le statut de la table
    updateTableStatus(payload.new)
  })
  .subscribe()
```

**RLS Policies** :
- `everyone_read_tables` - Tout le monde peut lire les tables
- `serveuses_update_table_status` - Les serveuses peuvent mettre à jour le statut

---

## Shared Screens (Toutes Applications)

### 12. User Management (#12)

**Description** : Gestion des utilisateurs (patron uniquement)

**Tables Supabase** :
- `profiles` (lecture, création, mise à jour)
- `auth.users` (via Supabase Auth Admin API)

**Requêtes Supabase** :
```typescript
// Liste des utilisateurs
const { data: users } = await supabase
  .from('profiles')
  .select('*')
  .order('nom', { ascending: true })

// Créer un utilisateur (Admin API)
const { data: newUser, error } = await supabase.auth.admin.createUser({
  email: email,
  password: password,
  email_confirm: true,
  user_metadata: {
    nom: nom,
    prenom: prenom,
    role: role
  }
})

// Mettre à jour un profil
const { error } = await supabase
  .from('profiles')
  .update({
    nom: nom,
    prenom: prenom,
    role: role,
    actif: actif
  })
  .eq('id', userId)

// Désactiver un utilisateur
const { error } = await supabase
  .from('profiles')
  .update({ actif: false })
  .eq('id', userId)
```

**Triggers Automatiques** :
- `trigger_create_profile_on_signup` - Crée automatiquement le profil après inscription

**RLS Policies** :
- `patron_manage_users` - Seul le patron peut gérer les utilisateurs
- `everyone_read_own_profile` - Chacun peut lire son propre profil

---

### 13. Product Editor (#13)

**Description** : Formulaire de création/modification de produit

**Tables Supabase** :
- `produits` (création, mise à jour)
- `stock` (création automatique via trigger)

**Requêtes Supabase** :
```typescript
// Créer un produit
const { data: produit, error } = await supabase
  .from('produits')
  .insert({
    nom: nom,
    categorie: categorie,
    prix_vente: prixVente,
    seuil_stock_minimum: seuilMin,
    actif: true
  })
  .select()
  .single()

// Mettre à jour un produit
const { error } = await supabase
  .from('produits')
  .update({
    nom: nom,
    categorie: categorie,
    prix_vente: prixVente,
    seuil_stock_minimum: seuilMin
  })
  .eq('id', produitId)

// Désactiver un produit (soft delete)
const { error } = await supabase
  .from('produits')
  .update({ actif: false })
  .eq('id', produitId)
```

**Triggers Automatiques** :
- `trigger_create_stock_on_product_insert` - Crée automatiquement une entrée stock avec quantité 0
- `trigger_update_produit_date` - Met à jour date_modification automatiquement
- `trigger_audit_product_changes` - Enregistre les modifications dans audit_logs

**RLS Policies** :
- `gerant_manage_products` - Le gérant peut créer/modifier des produits
- `patron_manage_products` - Le patron peut créer/modifier des produits

---

### 14. Supply Entry (#14)

**Description** : Formulaire d'enregistrement de ravitaillement

**Tables Supabase** :
- `ravitaillements` (création)
- `ravitaillement_items` (création)
- `stock` (mise à jour automatique via trigger)
- `mouvements_stock` (création automatique via trigger)

**Requêtes Supabase** :
```typescript
// Créer un ravitaillement
const { data: ravitaillement, error } = await supabase
  .rpc('create_ravitaillement', {
    fournisseur: fournisseur,
    date_ravitaillement: date,
    items: [
      {
        produit_id: 'uuid',
        quantite: 50,
        cout_unitaire: 200
      },
      {
        produit_id: 'uuid',
        quantite: 30,
        cout_unitaire: 150
      }
    ]
  })

// Liste des produits pour le formulaire
const { data: produits } = await supabase
  .from('produits')
  .select('id, nom, categorie')
  .eq('actif', true)
  .order('nom', { ascending: true })
```

**Fonctions PostgreSQL** :
- `create_ravitaillement(fournisseur, date, items)` - Crée le ravitaillement avec calcul automatique du montant total

**Triggers Automatiques** :
- `trigger_generate_numero_ravitaillement` - Génère le numéro automatiquement
- `trigger_update_stock_on_ravitaillement` - Incrémente le stock automatiquement
- `trigger_create_mouvement_stock` - Crée les mouvements de stock (type entrée)

**RLS Policies** :
- `gerant_create_ravitaillements` - Le gérant peut créer des ravitaillements
- `patron_create_ravitaillements` - Le patron peut créer des ravitaillements

---

### 15. Audit Log (#15)

**Description** : Historique complet des actions utilisateurs

**Tables Supabase** :
- `audit_logs` (lecture)
- `profiles` (lecture pour les noms)

**Requêtes Supabase** :
```typescript
// Logs d'audit avec filtres
const { data: logs } = await supabase
  .from('audit_logs')
  .select(`
    *,
    profiles (nom, prenom, role)
  `)
  .gte('date_creation', startDate)
  .lte('date_creation', endDate)
  .order('date_creation', { ascending: false })
  .limit(100)

// Filtrer par utilisateur
const { data: userLogs } = await supabase
  .from('audit_logs')
  .select('*')
  .eq('utilisateur_id', userId)
  .order('date_creation', { ascending: false })

// Filtrer par action
const { data: actionLogs } = await supabase
  .from('audit_logs')
  .select('*')
  .eq('action', action)
  .order('date_creation', { ascending: false })
```

**Triggers Automatiques** :
- `trigger_audit_commandes` - Enregistre les actions sur commandes
- `trigger_audit_products` - Enregistre les modifications de produits
- `trigger_audit_ravitaillements` - Enregistre les ravitaillements

**RLS Policies** :
- `patron_read_all_audit_logs` - Le patron voit tous les logs
- `gerant_read_all_audit_logs` - Le gérant voit tous les logs

---

### 16. User Profile (#16)

**Description** : Profil utilisateur et paramètres

**Tables Supabase** :
- `profiles` (lecture, mise à jour)

**Requêtes Supabase** :
```typescript
// Profil de l'utilisateur connecté
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', currentUserId)
  .single()

// Mettre à jour le profil
const { error } = await supabase
  .from('profiles')
  .update({
    nom: nom,
    prenom: prenom
  })
  .eq('id', currentUserId)

// Changer le mot de passe
const { error } = await supabase.auth.updateUser({
  password: newPassword
})
```

**RLS Policies** :
- `everyone_read_own_profile` - Chacun peut lire son propre profil
- `everyone_update_own_profile` - Chacun peut mettre à jour son propre profil

---

### 17. System Activity (#17)

**Description** : Activité système en temps réel

**Tables Supabase** :
- `commandes` (lecture)
- `encaissements` (lecture)
- `ravitaillements` (lecture)
- `profiles` (lecture)

**Requêtes Supabase** :
```typescript
// Activité récente (dernières 24h)
const { data: recentActivity } = await supabase
  .from('audit_logs')
  .select(`
    *,
    profiles (nom, prenom, role)
  `)
  .gte('date_creation', new Date(Date.now() - 24 * 60 * 60 * 1000))
  .order('date_creation', { ascending: false })
  .limit(50)

// Statistiques en temps réel
const { data: stats } = await supabase.rpc('get_realtime_stats')
```

**Subscriptions Realtime** :
```typescript
// Activité en temps réel (toutes les tables)
const activitySubscription = supabase
  .channel('system_activity')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'commandes'
  }, handleActivity)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'encaissements'
  }, handleActivity)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'ravitaillements'
  }, handleActivity)
  .subscribe()
```

**RLS Policies** :
- `patron_read_all_activity` - Le patron voit toute l'activité
- `gerant_read_all_activity` - Le gérant voit toute l'activité

---

### 18. Login Screen (#18)

**Description** : Écran de connexion (toutes applications)

**Tables Supabase** :
- `auth.users` (via Supabase Auth)
- `profiles` (lecture après connexion)

**Requêtes Supabase** :
```typescript
// Connexion
const { data, error } = await supabase.auth.signInWithPassword({
  email: email,
  password: password
})

// Récupérer le profil après connexion
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', data.user.id)
  .single()

// Déconnexion
const { error } = await supabase.auth.signOut()

// Vérifier la session
const { data: { session } } = await supabase.auth.getSession()
```

**Supabase Auth Configuration** :
- Email/Password provider activé
- JWT avec durée de vie : 1h (access token), 7j (refresh token)
- Refresh automatique géré par le client Supabase

**RLS Policies** :
- Toutes les policies vérifient `auth.uid()` pour l'authentification

---

## Patterns Communs d'Intégration

### 1. Pattern de Chargement Initial

```typescript
// Hook personnalisé pour charger les données avec cache
function useSupabaseQuery<T>(
  table: string,
  select: string,
  filters?: any
) {
  return useQuery({
    queryKey: [table, select, filters],
    queryFn: async () => {
      let query = supabase.from(table).select(select)
      
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          query = query.eq(key, value)
        })
      }
      
      const { data, error } = await query
      if (error) throw error
      return data as T
    },
    staleTime: 5000, // 5 secondes
    cacheTime: 300000 // 5 minutes
  })
}
```

### 2. Pattern de Subscription Realtime

```typescript
// Hook personnalisé pour les subscriptions
function useRealtimeSubscription(
  table: string,
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
  callback: (payload: any) => void,
  filter?: string
) {
  useEffect(() => {
    const channel = supabase
      .channel(`${table}_${event}`)
      .on('postgres_changes', {
        event,
        schema: 'public',
        table,
        filter
      }, callback)
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, event, filter])
}
```

### 3. Pattern de Mutation avec Optimistic Update

```typescript
// Hook personnalisé pour les mutations
function useSupabaseMutation<T>(
  mutationFn: (data: T) => Promise<any>,
  options?: {
    onSuccess?: (data: any) => void
    onError?: (error: any) => void
  }
) {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn,
    onMutate: async (newData) => {
      // Optimistic update
      await queryClient.cancelQueries()
      const previousData = queryClient.getQueryData(['key'])
      queryClient.setQueryData(['key'], newData)
      return { previousData }
    },
    onError: (err, newData, context) => {
      // Rollback on error
      queryClient.setQueryData(['key'], context?.previousData)
      options?.onError?.(err)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries()
      options?.onSuccess?.(data)
    }
  })
}
```

### 4. Pattern de Gestion d'Erreurs

```typescript
// Wrapper pour gérer les erreurs Supabase
async function handleSupabaseError<T>(
  operation: () => Promise<{ data: T | null, error: any }>
): Promise<T> {
  const { data, error } = await operation()
  
  if (error) {
    // Logger l'erreur
    console.error('Supabase error:', error)
    
    // Mapper les erreurs Supabase aux erreurs métier
    if (error.code === '23505') {
      throw new Error('Cette ressource existe déjà')
    } else if (error.code === '23503') {
      throw new Error('Référence invalide')
    } else if (error.message.includes('insufficient_stock')) {
      throw new Error('Stock insuffisant')
    }
    
    throw new Error(error.message)
  }
  
  if (!data) {
    throw new Error('Aucune donnée retournée')
  }
  
  return data
}
```

### 5. Pattern de Mode Offline

```typescript
// Queue locale pour les opérations offline
class OfflineQueue {
  private queue: Array<{
    id: string
    operation: () => Promise<any>
    timestamp: number
  }> = []
  
  async add(operation: () => Promise<any>) {
    const id = uuid()
    this.queue.push({ id, operation, timestamp: Date.now() })
    await this.saveToStorage()
    await this.sync()
  }
  
  async sync() {
    if (!navigator.onLine) return
    
    const operations = [...this.queue]
    
    for (const op of operations) {
      try {
        await op.operation()
        this.queue = this.queue.filter(o => o.id !== op.id)
        await this.saveToStorage()
      } catch (error) {
        console.error('Sync failed:', error)
      }
    }
  }
  
  private async saveToStorage() {
    await AsyncStorage.setItem('offline_queue', JSON.stringify(this.queue))
  }
}
```

---

## Résumé des Ressources Supabase Utilisées

### Tables (12)
1. `profiles` - Profils utilisateurs
2. `produits` - Catalogue produits
3. `stock` - Inventaire
4. `tables` - Tables physiques
5. `commandes` - Commandes
6. `commande_items` - Lignes de commande
7. `mouvements_stock` - Historique mouvements
8. `ravitaillements` - Ravitaillements
9. `ravitaillement_items` - Lignes de ravitaillement
10. `factures` - Factures
11. `encaissements` - Paiements
12. `audit_logs` - Logs d'audit

### Fonctions PostgreSQL (10)
1. `get_produits_disponibles()` - Produits disponibles
2. `create_commande(table_id, items)` - Créer commande
3. `validate_commande(commande_id)` - Valider commande
4. `create_ravitaillement(fournisseur, date, items)` - Créer ravitaillement
5. `create_encaissement(facture_id, montant, mode_paiement)` - Créer encaissement
6. `get_kpis(debut, fin)` - Calculer KPIs
7. `check_stock_alerts()` - Alertes stock bas
8. `get_factures_impayees()` - Factures impayées
9. `get_factures_impayees_alerts()` - Alertes factures > 24h
10. `search_transactions(filters)` - Recherche transactions

### Vues PostgreSQL (5)
1. `analytics_ca_encaissements` - CA vs Encaissements
2. `analytics_creances` - Créances
3. `analytics_by_payment_mode` - Stats par mode paiement
4. `factures_overdue` - Factures en retard
5. `analytics_ventes_produits` - Ventes par produit

### Triggers (15+)
- Génération numéros séquentiels (commandes, ravitaillements, factures)
- Calcul automatique montants totaux
- Mise à jour automatique du stock
- Génération automatique de factures
- Mise à jour statut factures
- Création mouvements de stock
- Mise à jour statuts tables
- Enregistrement audit logs

### RLS Policies (30+)
- Policies par rôle (serveuse, comptoir, gérant, patron)
- Policies par opération (SELECT, INSERT, UPDATE, DELETE)
- Policies par table (12 tables × 2-3 policies en moyenne)

### Realtime Subscriptions (8 channels principaux)
1. `commandes_realtime` - Nouvelles commandes
2. `stock_realtime` - Mises à jour stock
3. `factures_realtime` - Mises à jour factures
4. `encaissements_realtime` - Nouveaux encaissements
5. `tables_realtime` - Statuts tables
6. `ravitaillements_realtime` - Nouveaux ravitaillements
7. `validation_realtime` - Validations commandes
8. `system_activity` - Activité globale

---

## Conclusion

Ce mapping complet établit la correspondance exacte entre les 18 écrans de maquettes HTML et les ressources backend Supabase. Chaque écran est maintenant documenté avec :

✅ Les tables Supabase utilisées
✅ Les requêtes Supabase spécifiques avec exemples de code
✅ Les fonctions PostgreSQL appelées
✅ Les triggers automatiques qui s'exécutent
✅ Les subscriptions Realtime configurées
✅ Les RLS policies appliquées

Cette documentation servira de référence pour l'implémentation des Phases 9-11 (frontend) et garantit l'alignement complet entre le frontend (maquettes) et le backend (Supabase).
