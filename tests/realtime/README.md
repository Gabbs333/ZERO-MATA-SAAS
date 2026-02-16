# Tests de Synchronisation Realtime

## Vue d'Ensemble

Ce document décrit la configuration et les tests de synchronisation en temps réel pour le système de gestion de snack-bar. La synchronisation utilise **Supabase Realtime**, un service managé basé sur les publications PostgreSQL.

## Configuration Realtime

### Tables Activées

Les tables suivantes sont configurées pour la synchronisation en temps réel :

1. **commandes** - Notifications de création et validation de commandes
2. **stock** - Mises à jour du niveau de stock
3. **factures** - Génération de factures
4. **encaissements** - Enregistrement des paiements
5. **tables** - Changements de statut des tables
6. **ravitaillements** - Enregistrement des ravitaillements
7. **commande_items** - Détails des commandes
8. **ravitaillement_items** - Détails des ravitaillements
9. **mouvements_stock** - Historique des mouvements

### Configuration PostgreSQL

Toutes les tables ont été configurées avec :
- **REPLICA IDENTITY FULL** : Permet de recevoir les anciennes et nouvelles valeurs lors des UPDATE
- **Publication supabase_realtime** : Toutes les tables sont ajoutées à la publication Realtime

```sql
-- Vérifier la configuration
SELECT 
  c.relname as table_name,
  CASE c.relreplident 
    WHEN 'f' THEN 'FULL' 
    WHEN 'd' THEN 'DEFAULT' 
  END as replica_identity,
  EXISTS(
    SELECT 1 FROM pg_publication_tables pt 
    WHERE pt.pubname = 'supabase_realtime' 
    AND pt.tablename = c.relname
  ) as in_publication
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
AND c.relname IN ('commandes', 'stock', 'factures', 'encaissements', 'tables', 'ravitaillements')
ORDER BY c.relname;
```

## Propriétés de Synchronisation

### Propriété 21 : Synchronisation des commandes en temps réel

**Validates: Requirements 1.2, 6.1**

**Description** : Pour toute commande créée sur l'application serveuse, le système comptoir doit recevoir la notification dans un délai maximum de 2 secondes.

**Test Manuel** :
1. Ouvrir l'application serveuse sur un appareil
2. Ouvrir le système comptoir sur un autre appareil
3. Créer une commande sur l'application serveuse
4. Vérifier que la commande apparaît au comptoir en moins de 2 secondes

**Code Client (JavaScript)** :
```javascript
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// S'abonner aux nouvelles commandes
const channel = supabase
  .channel('commandes-changes')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'commandes',
    },
    (payload) => {
      console.log('Nouvelle commande reçue:', payload.new)
      // Mettre à jour l'interface utilisateur
    }
  )
  .subscribe()
```

### Propriété 22 : Synchronisation des validations en temps réel

**Validates: Requirements 2.5, 6.2**

**Description** : Pour toute commande validée au comptoir, toutes les applications connectées (serveuse, tableau de bord) doivent recevoir la mise à jour du stock dans un délai maximum de 2 secondes.

**Test Manuel** :
1. Ouvrir l'application serveuse, le comptoir et le tableau de bord patron
2. Créer une commande sur l'application serveuse
3. Valider la commande au comptoir
4. Vérifier que :
   - Le statut de la commande est mis à jour sur l'application serveuse (< 2s)
   - Le stock est mis à jour sur le tableau de bord patron (< 2s)
   - La facture est générée et visible (< 2s)

**Code Client (JavaScript)** :
```javascript
// S'abonner aux mises à jour de commandes
const commandesChannel = supabase
  .channel('commandes-updates')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'commandes',
    },
    (payload) => {
      console.log('Commande mise à jour:', payload.new)
      // Mettre à jour l'interface utilisateur
    }
  )
  .subscribe()

// S'abonner aux mises à jour du stock
const stockChannel = supabase
  .channel('stock-updates')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'stock',
    },
    (payload) => {
      console.log('Stock mis à jour:', payload.new)
      // Mettre à jour l'interface utilisateur
    }
  )
  .subscribe()
```

### Propriété 23 : Synchronisation des ravitaillements en temps réel

**Validates: Requirement 6.3**

**Description** : Pour tout ravitaillement enregistré, toutes les applications connectées doivent recevoir la mise à jour du stock dans un délai maximum de 2 secondes.

**Test Manuel** :
1. Ouvrir le tableau de bord patron et l'application serveuse
2. Enregistrer un ravitaillement sur le tableau de bord
3. Vérifier que :
   - Le stock est mis à jour sur le tableau de bord (< 2s)
   - Le stock est mis à jour sur l'application serveuse (< 2s)
   - Les produits ravitaillés deviennent disponibles pour commande

**Code Client (JavaScript)** :
```javascript
// S'abonner aux nouveaux ravitaillements
const ravitaillementsChannel = supabase
  .channel('ravitaillements-changes')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'ravitaillements',
    },
    (payload) => {
      console.log('Nouveau ravitaillement:', payload.new)
      // Mettre à jour l'interface utilisateur
    }
  )
  .subscribe()

// S'abonner aux mises à jour du stock
const stockChannel = supabase
  .channel('stock-updates-ravitaillement')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'stock',
    },
    (payload) => {
      console.log('Stock mis à jour après ravitaillement:', payload.new)
      // Mettre à jour l'interface utilisateur
    }
  )
  .subscribe()
```

## Tests d'Intégration Recommandés

### Test 1 : Flux Complet de Commande

**Scénario** : Créer une commande, la valider, et vérifier la synchronisation

**Étapes** :
1. Créer une commande avec 2 produits
2. Vérifier que la commande apparaît au comptoir
3. Valider la commande au comptoir
4. Vérifier que :
   - Le statut de la commande passe à "validee"
   - Le stock est déduit pour les 2 produits
   - Une facture est générée
   - Tous les changements sont synchronisés en < 2s

### Test 2 : Flux Complet de Ravitaillement

**Scénario** : Enregistrer un ravitaillement et vérifier la synchronisation

**Étapes** :
1. Noter le stock actuel d'un produit
2. Enregistrer un ravitaillement de 10 unités
3. Vérifier que :
   - Le stock est incrémenté de 10 unités
   - Le mouvement de stock est enregistré
   - Tous les changements sont synchronisés en < 2s

### Test 3 : Concurrence Multiple

**Scénario** : Plusieurs serveuses créent des commandes simultanément

**Étapes** :
1. Ouvrir 3 applications serveuses
2. Créer une commande sur chaque application en même temps
3. Vérifier que :
   - Toutes les commandes apparaissent au comptoir
   - Aucune commande n'est perdue
   - L'ordre de réception est cohérent

## Métriques de Performance

### Délai de Synchronisation Attendu

- **Création de commande** : < 500ms (typique), < 2s (maximum)
- **Validation de commande** : < 1s (typique), < 2s (maximum)
- **Mise à jour du stock** : < 500ms (typique), < 2s (maximum)
- **Ravitaillement** : < 1s (typique), < 2s (maximum)

### Facteurs Affectant la Performance

1. **Latence réseau** : WiFi local vs Internet
2. **Charge du serveur** : Nombre de clients connectés
3. **Complexité des RLS policies** : Vérifications de sécurité
4. **Taille des données** : Nombre de lignes dans les tables

## Dépannage

### Problème : Les événements ne sont pas reçus

**Solutions** :
1. Vérifier que les tables sont dans la publication `supabase_realtime`
2. Vérifier que `REPLICA IDENTITY` est configuré sur `FULL`
3. Vérifier les RLS policies (elles s'appliquent aussi au Realtime)
4. Vérifier la connexion réseau
5. Vérifier les logs Supabase dans le Dashboard

### Problème : Délai de synchronisation > 2 secondes

**Solutions** :
1. Vérifier la latence réseau
2. Optimiser les RLS policies (ajouter des index)
3. Réduire le nombre de subscriptions simultanées
4. Utiliser des filtres pour limiter les événements reçus

### Problème : Événements dupliqués

**Solutions** :
1. Utiliser un identifiant unique pour déduplication côté client
2. Vérifier qu'il n'y a pas de subscriptions multiples au même canal
3. Implémenter une logique de déduplication basée sur `id` et `updated_at`

## Ressources

- [Supabase Realtime Documentation](https://supabase.com/docs/guides/realtime)
- [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

## Notes Importantes

1. **Supabase Realtime est un service managé** : Les tests de synchronisation doivent être effectués dans les applications clientes, pas dans des tests unitaires backend.

2. **RLS s'applique au Realtime** : Les utilisateurs ne reçoivent que les événements pour lesquels ils ont les permissions SELECT.

3. **REPLICA IDENTITY FULL est requis** : Pour recevoir les anciennes valeurs lors des UPDATE et DELETE.

4. **Pas de tests automatisés pour le délai** : Le délai de synchronisation dépend de facteurs externes (réseau, charge serveur). Les tests doivent être manuels ou dans des tests d'intégration end-to-end.

5. **Utiliser des canaux dédiés** : Créer un canal par type d'événement pour une meilleure organisation et performance.
