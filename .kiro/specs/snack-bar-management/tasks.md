# Plan d'Implémentation - Système de Gestion de Snack-Bar (Supabase)

## Vue d'Ensemble

Ce plan d'implémentation découpe le développement du système de gestion de snack-bar en tâches incrémentales et testables. Le système utilise **Supabase** comme backend serverless, éliminant le besoin de coder un backend custom et de gérer l'infrastructure.

Le développement suit une approche **database-first** avec Supabase, puis intègre progressivement les applications clientes.

## Avantages de l'Approche Supabase

- ✅ **Pas de backend à coder** : API REST auto-générée depuis le schéma PostgreSQL
- ✅ **Authentification intégrée** : Supabase Auth avec JWT et RBAC
- ✅ **Realtime natif** : Subscriptions PostgreSQL pour la synchronisation
- ✅ **Row Level Security** : Permissions au niveau base de données
- ✅ **Pas de DevOps** : Infrastructure managée par Supabase
- ✅ **Déploiement rapide** : Quelques heures vs plusieurs jours

## Tâches

### Phase 1 : Configuration Supabase et Base de Données

- [ ] 1. Créer et configurer le projet Supabase
  - Créer un compte Supabase (https://supabase.com)
  - Créer un nouveau projet (choisir région proche : Europe West)
  - Noter l'URL du projet et les clés API (anon key, service_role key)
  - Configurer les paramètres du projet (nom, mot de passe base de données)
  - _Exigences : Toutes (infrastructure de base)_

- [ ] 1.1 Créer le schéma de base de données
  - Créer les tables via l'éditeur SQL Supabase
  - Tables : users, produits, stock, commandes, commande_items, mouvements_stock, ravitaillements, ravitaillement_items, tables, factures, encaissements, audit_logs
  - Définir les types de données, contraintes, et clés étrangères
  - Créer les index pour performance
  - _Exigences : Toutes (modèle de données)_


- [x] 1.2 Créer les fonctions et triggers PostgreSQL
  - Trigger : Génération automatique des numéros séquentiels (commandes, ravitaillements, factures)
  - Trigger : Mise à jour automatique du stock après validation de commande
  - Trigger : Génération automatique de facture après validation de commande
  - Trigger : Mise à jour du statut de facture après encaissement
  - Fonction : Calcul du montant total d'une commande
  - Fonction : Calcul des créances (CA - Encaissements)
  - _Exigences : 2.2, 2.3, 3.1, 3.2, 13.1, 14.2, 14.3_

- [x] 1.3 Écrire les tests unitaires pour les migrations
  - Tester la création de toutes les tables
  - Tester les contraintes d'unicité et de clés étrangères
  - Tester les valeurs par défaut
  - Tester les triggers (génération numéros, mise à jour stock)
  - _Exigences : Intégrité des données_

### Phase 2 : Authentification et Row Level Security (RLS)

- [x] 2. Configurer Supabase Auth
  - [x] 2.1 Activer l'authentification email/password
    - Activer le provider Email dans Supabase Auth settings
    - Configurer les templates d'emails (confirmation, reset password)
    - Définir la durée de vie des tokens (1h access, 7j refresh)
    - Configurer la politique de mots de passe (min 8 caractères)
    - _Exigences : 7.1_

  - [x] 2.2 Créer la table des profils utilisateurs
    - Créer la table `profiles` liée à `auth.users`
    - Champs : id (FK auth.users), role, nom, prenom, actif
    - Trigger : Création automatique du profil après inscription
    - _Exigences : 7.1_

  - [x] 2.3 Écrire le test property-based pour l'authentification
    - **Propriété 25 : Authentification obligatoire**
    - **Valide : Exigence 7.1**
    - Générer des tentatives de connexion valides et invalides
    - Vérifier que seules les tentatives valides obtiennent un token
    - _Exigences : 7.1_


  - [x] 2.4 Implémenter les Row Level Security (RLS) policies
    - Activer RLS sur toutes les tables
    - Policy : Les serveuses voient uniquement leurs propres commandes
    - Policy : Le comptoir voit toutes les commandes en attente
    - Policy : Le comptoir peut valider les commandes
    - Policy : Le patron/gérant voit tout
    - Policy : Seul le patron peut gérer les utilisateurs
    - Policy : Seul le gérant/patron peut créer des ravitaillements
    - Policy : Seul le comptoir peut enregistrer des encaissements
    - _Exigences : 7.2, 7.3, 7.4_

  - [x] 2.5 Écrire le test property-based pour le RBAC
    - **Propriété 26 : Contrôle d'accès basé sur les rôles**
    - **Valide : Exigences 7.2, 7.3, 7.4**
    - Générer des utilisateurs avec différents rôles
    - Vérifier que chaque rôle accède uniquement aux données autorisées
    - Tester les tentatives d'accès non autorisées
    - _Exigences : 7.2, 7.3, 7.4_

  - [x] 2.6 Implémenter le système d'audit
    - Créer la table `audit_logs` avec RLS
    - Créer un trigger pour enregistrer automatiquement les actions
    - Trigger sur INSERT/UPDATE/DELETE des tables critiques
    - Enregistrer : utilisateur, action, entité, détails avant/après, timestamp
    - _Exigences : 7.5, 8.1_

  - [x] 2.7 Écrire le test property-based pour l'audit
    - **Propriété 27 : Traçabilité des actions utilisateur**
    - **Valide : Exigence 7.5**
    - Générer des actions aléatoires (INSERT, UPDATE, DELETE)
    - Vérifier qu'un log d'audit est créé pour chaque action
    - _Exigences : 7.5_

### Phase 3 : Gestion des Produits et du Stock

- [x] 3. Configurer les tables Produits et Stock
  - [x] 3.1 Créer les RLS policies pour les produits
    - Policy : Tout le monde peut lire les produits actifs
    - Policy : Seul le gérant/patron peut créer/modifier/désactiver des produits
    - Policy : Les serveuses voient uniquement les produits actifs avec stock > 0
    - _Exigences : 12.1, 12.2, 12.3, 12.4_

  - [x] 3.2 Écrire les tests property-based pour les produits
    - **Propriété 40 : Validation des données de produit**
    - **Valide : Exigence 12.1**
    - **Propriété 42 : Désactivation sans suppression**
    - **Valide : Exigence 12.3**
    - **Propriété 44 : Audit des modifications de produits**
    - **Valide : Exigence 12.5**
    - _Exigences : 12.1, 12.3, 12.5_


  - [x] 3.3 Créer les RLS policies pour le stock
    - Policy : Tout le monde peut lire le stock
    - Policy : Seul le système (via triggers) peut modifier le stock
    - Policy : Tout le monde peut lire l'historique des mouvements de stock
    - _Exigences : 3.1, 3.2, 3.5_

  - [x] 3.4 Écrire les tests property-based pour le stock
    - **Propriété 11 : Complétude des mouvements de stock**
    - **Valide : Exigence 3.5**
    - **Propriété 12 : Non-négativité du stock**
    - **Valide : Contrainte métier**
    - **Propriété 45 : Cohérence du stock (invariant)**
    - **Valide : Cohérence globale**
    - _Exigences : 3.5, Invariants système_

- [ ] 4. Checkpoint - Vérifier que tous les tests passent
  - Exécuter la suite complète de tests
  - Vérifier la couverture de code (objectif : 80%)
  - Tester les RLS policies via Supabase client
  - Demander à l'utilisateur si des questions se posent

### Phase 4 : Gestion des Commandes

- [x] 5. Configurer les tables Commandes et CommandeItems
  - [x] 5.1 Créer les RLS policies pour les commandes
    - Policy : Les serveuses peuvent créer des commandes
    - Policy : Les serveuses voient uniquement leurs propres commandes
    - Policy : Le comptoir voit toutes les commandes en attente
    - Policy : Le comptoir peut valider les commandes en attente
    - Policy : Le patron/gérant voit toutes les commandes
    - Policy : Les commandes validées sont immuables (pas de UPDATE/DELETE)
    - _Exigences : 1.1, 1.3, 2.1, 2.2, 8.3, 9.5_

  - [x] 5.2 Créer les fonctions PostgreSQL pour les commandes
    - Fonction : `create_commande(table_id, items)` - Crée une commande avec calcul du montant total
    - Fonction : `validate_commande(commande_id)` - Valide une commande (vérifie stock, déduit, crée mouvements)
    - Fonction : `get_produits_disponibles()` - Retourne les produits avec stock > 0 et actif = true
    - _Exigences : 1.1, 1.5, 2.2, 2.3, 2.4_

  - [x] 5.3 Écrire les tests property-based pour les commandes
    - **Propriété 1 : Unicité des identifiants de commande**
    - **Valide : Exigence 1.1**
    - **Propriété 2 : Complétude des données de commande**
    - **Valide : Exigence 1.3**
    - **Propriété 7 : Calcul correct du montant total**
    - **Valide : Exigence 9.4**
    - **Propriété 8 : Annulation de commande non soumise**
    - **Valide : Exigence 9.5**
    - _Exigences : 1.1, 1.3, 9.4, 9.5_


  - [x] 5.4 Écrire les tests property-based pour la validation
    - **Propriété 4 : Déduction automatique du stock**
    - **Valide : Exigences 2.2, 3.2**
    - **Propriété 5 : Création de mouvement de stock pour les ventes**
    - **Valide : Exigence 2.3**
    - **Propriété 6 : Rejet des commandes avec stock insuffisant**
    - **Valide : Exigence 2.4**
    - _Exigences : 2.2, 2.3, 2.4_

  - [x] 5.5 Écrire le test property-based pour le filtrage des produits
    - **Propriété 3 : Filtrage des produits disponibles**
    - **Valide : Exigence 1.5**
    - **Propriété 43 : Exclusion des produits inactifs**
    - **Valide : Exigence 12.4**
    - _Exigences : 1.5, 12.4_

  - [x] 5.6 Écrire le test property-based pour l'immutabilité
    - **Propriété 30 : Immutabilité des commandes validées**
    - **Valide : Exigence 8.3**
    - _Exigences : 8.3_

### Phase 5 : Gestion des Ravitaillements

- [x] 6. Configurer les tables Ravitaillements et RavitaillementItems
  - [x] 6.1 Créer les RLS policies pour les ravitaillements
    - Policy : Seul le gérant/patron peut créer des ravitaillements
    - Policy : Tout le monde peut lire les ravitaillements
    - Policy : Les ravitaillements sont immuables après création
    - _Exigences : 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 6.2 Créer les fonctions PostgreSQL pour les ravitaillements
    - Fonction : `create_ravitaillement(fournisseur, date, items)` - Crée un ravitaillement avec mise à jour du stock
    - Fonction : `get_ravitaillements_by_period(debut, fin)` - Filtre par période
    - Trigger : Création automatique des mouvements de stock (type entrée)
    - Trigger : Mise à jour automatique du stock
    - _Exigences : 4.1, 4.2, 4.3, 4.5_

  - [x] 6.3 Écrire les tests property-based pour les ravitaillements
    - **Propriété 9 : Incrémentation du stock lors des ravitaillements**
    - **Valide : Exigences 3.1, 4.3**
    - **Propriété 13 : Validation des données de ravitaillement**
    - **Valide : Exigences 4.1, 4.4**
    - **Propriété 14 : Création de mouvement de stock pour les ravitaillements**
    - **Valide : Exigence 4.2**
    - **Propriété 15 : Filtrage des ravitaillements par période**
    - **Valide : Exigence 4.5**
    - _Exigences : 3.1, 4.1, 4.2, 4.3, 4.4, 4.5_


  - [x] 6.4 Implémenter les alertes de stock bas
    - Créer une fonction PostgreSQL `check_stock_alerts()`
    - Fonction retourne les produits avec quantité <= seuil
    - Créer une vue `stock_alerts` pour faciliter les requêtes
    - _Exigences : 3.4_

  - [x] 6.5 Écrire le test property-based pour les alertes
    - **Propriété 10 : Génération d'alertes de stock bas**
    - **Valide : Exigence 3.4**
    - _Exigences : 3.4_

- [ ] 7. Checkpoint - Vérifier que tous les tests passent
  - Exécuter la suite complète de tests
  - Vérifier la couverture de code (objectif : 80%)
  - Tester les fonctions PostgreSQL via Supabase client
  - Demander à l'utilisateur si des questions se posent

### Phase 5.5 : Gestion des Factures et Encaissements

- [x] 7.1 Configurer les tables Factures et Encaissements
  - [x] 7.1.1 Créer les RLS policies pour les factures
    - Policy : Le comptoir et le patron/gérant peuvent lire toutes les factures
    - Policy : Les factures sont créées automatiquement (via trigger)
    - Policy : Les factures sont immuables (pas de modification manuelle)
    - Trigger : Génération automatique de facture après validation de commande
    - _Exigences : 13.1, 13.2, 13.3, 13.4, 13.5_

  - [x] 7.1.2 Créer les fonctions PostgreSQL pour les factures
    - Fonction : `get_factures_impayees()` - Retourne les factures avec statut != 'payee'
    - Fonction : `get_factures_by_status(status)` - Filtre par statut
    - Vue : `factures_with_age` - Factures avec calcul de l'ancienneté
    - _Exigences : 13.5, 15.3, 15.4_

  - [x] 7.1.3 Écrire les tests property-based pour les factures
    - **Propriété 47 : Génération automatique de facture**
    - **Valide : Exigence 13.1**
    - **Propriété 48 : Unicité des numéros de facture**
    - **Valide : Exigence 13.1**
    - **Propriété 49 : Complétude des données de facture**
    - **Valide : Exigence 13.2**
    - **Propriété 57 : Cohérence facture-commande (invariant)**
    - **Valide : Cohérence des données**
    - _Exigences : 13.1, 13.2_

- [x] 7.2 Configurer la gestion des encaissements
  - [x] 7.2.1 Créer les RLS policies pour les encaissements
    - Policy : Seul le comptoir peut créer des encaissements
    - Policy : Le comptoir et le patron/gérant peuvent lire les encaissements
    - Policy : Les encaissements sont immuables après création
    - Trigger : Mise à jour automatique du statut de facture après encaissement
    - _Exigences : 14.1, 14.2, 14.3, 14.4, 14.5_


  - [x] 7.2.2 Créer les fonctions PostgreSQL pour les encaissements
    - Fonction : `create_encaissement(facture_id, montant, mode_paiement)` - Crée un encaissement et met à jour la facture
    - Fonction : `get_encaissements_stats(debut, fin)` - Statistiques par mode de paiement
    - Vue : `encaissements_summary` - Résumé des encaissements par période
    - _Exigences : 14.1, 14.5_

  - [x] 7.2.3 Écrire les tests property-based pour les encaissements
    - **Propriété 50 : Validation des données d'encaissement**
    - **Valide : Exigence 14.1**
    - **Propriété 51 : Mise à jour du statut de facture après encaissement total**
    - **Valide : Exigence 14.2**
    - **Propriété 52 : Mise à jour du statut de facture après encaissement partiel**
    - **Valide : Exigence 14.3**
    - **Propriété 53 : Traçabilité des encaissements**
    - **Valide : Exigence 14.4**
    - **Propriété 58 : Cohérence des encaissements (invariant)**
    - **Valide : Cohérence des paiements**
    - _Exigences : 14.1, 14.2, 14.3, 14.4_

- [x] 7.3 Créer les vues analytiques pour CA et encaissements
  - [x] 7.3.1 Créer les vues PostgreSQL pour l'analytique
    - Vue : `analytics_ca_encaissements` - CA vs Encaissements par période
    - Vue : `analytics_creances` - Calcul des créances (CA - Encaissements)
    - Vue : `analytics_by_payment_mode` - Statistiques par mode de paiement
    - Fonction : `get_kpis(debut, fin)` - Retourne tous les KPIs (CA, encaissements, créances, bénéfice)
    - _Exigences : 15.1, 15.2, 15.3, 15.4_

  - [x] 7.3.2 Écrire les tests property-based pour la distinction CA/encaissements
    - **Propriété 54 : Distinction CA et encaissements**
    - **Valide : Exigence 15.1**
    - **Propriété 55 : Calcul des créances**
    - **Valide : Exigence 15.2**
    - _Exigences : 15.1, 15.2_

- [x] 7.4 Implémenter les alertes de factures impayées
  - [x] 7.4.1 Créer une fonction PostgreSQL pour les alertes
    - Fonction : `get_factures_impayees_alerts()` - Retourne les factures impayées > 24h
    - Vue : `factures_overdue` - Factures en retard avec ancienneté
    - _Exigences : 15.5_

  - [x] 7.4.2 Écrire le test property-based pour les alertes de factures impayées
    - **Propriété 56 : Génération d'alerte pour factures impayées**
    - **Valide : Exigence 15.5**
    - _Exigences : 15.5_

- [x] 7.5 Checkpoint - Vérifier que tous les tests passent
  - Exécuter la suite complète de tests
  - Vérifier la couverture de code (objectif : 80%)
  - Tester les triggers et fonctions via Supabase client
  - Demander à l'utilisateur si des questions se posent


### Phase 6 : Gestion des Tables

- [x] 8. Configurer la table Tables
  - [x] 8.1 Créer les RLS policies pour les tables
    - Policy : Tout le monde peut lire les tables
    - Policy : Les serveuses peuvent mettre à jour le statut des tables
    - Trigger : Mise à jour automatique du statut lors de la création de commande
    - Trigger : Mise à jour automatique du statut lors de la validation de commande
    - _Exigences : 10.1, 10.2, 10.3, 10.4_

  - [x] 8.2 Écrire les tests property-based pour les tables
    - **Propriété 32 : Changement d'état lors de la création de commande**
    - **Valide : Exigence 10.2**
    - **Propriété 33 : Changement d'état lors de la validation**
    - **Valide : Exigence 10.3**
    - **Propriété 34 : Libération manuelle des tables**
    - **Valide : Exigence 10.4**
    - **Propriété 35 : Commandes multiples par table**
    - **Valide : Exigence 10.5**
    - _Exigences : 10.2, 10.3, 10.4, 10.5_

### Phase 7 : Analytique et Rapports

- [x] 9. Créer les vues et fonctions analytiques
  - [x] 9.1 Créer les vues PostgreSQL pour l'analytique
    - Vue : `analytics_kpis` - KPIs principaux (CA, bénéfice, nombre commandes, panier moyen)
    - Vue : `analytics_ventes_produits` - Agrégation des ventes par produit
    - Vue : `analytics_evolution_ca` - Évolution temporelle du CA
    - Fonction : `get_analytics(debut, fin, granularite)` - Retourne toutes les analytics
    - _Exigences : 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 9.2 Écrire les tests property-based pour l'analytique
    - **Propriété 16 : Calcul du chiffre d'affaires**
    - **Valide : Exigence 5.1**
    - **Propriété 17 : Calcul du bénéfice**
    - **Valide : Exigence 5.2**
    - **Propriété 18 : Filtrage des analyses par période**
    - **Valide : Exigence 5.3**
    - **Propriété 19 : Agrégation des ventes par produit**
    - **Valide : Exigence 5.4**
    - **Propriété 20 : Comptage des commandes par période**
    - **Valide : Exigence 5.5**
    - _Exigences : 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 9.3 Créer la fonction de recherche de transactions
    - Fonction : `search_transactions(filters)` - Recherche avec filtres multiples
    - Support des filtres : date, serveuse, table, produit
    - Support de la pagination (50 résultats par page)
    - _Exigences : 8.5_

  - [x] 9.4 Écrire le test property-based pour la recherche
    - **Propriété 31 : Recherche de transactions**
    - **Valide : Exigence 8.5**
    - _Exigences : 8.5_


- [x] 10. Configurer Supabase Storage pour les exports
  - [x] 10.1 Créer les buckets de stockage
    - Créer le bucket `exports` pour les fichiers CSV et PDF
    - Configurer les RLS policies : Seul le patron/gérant peut uploader/télécharger
    - Configurer la taille maximale des fichiers (50 MB)
    - Configurer la rétention (30 jours)
    - _Exigences : 11.1, 11.2, 11.3_

  - [x] 10.2 Créer les Edge Functions pour la génération d'exports
    - Edge Function : `generate-ventes-csv` - Génère CSV des ventes
    - Edge Function : `generate-stock-csv` - Génère CSV des mouvements de stock
    - Edge Function : `generate-rapport-pdf` - Génère rapport PDF avec jsPDF
    - Inclure les métadonnées (période, date de génération)
    - Upload automatique vers Supabase Storage
    - _Exigences : 11.1, 11.2, 11.3, 11.5_

  - [x] 10.3 Écrire les tests property-based pour les exports
    - **Propriété 36 : Complétude des exports CSV de ventes**
    - **Valide : Exigence 11.1**
    - **Propriété 37 : Complétude des exports CSV de mouvements de stock**
    - **Valide : Exigence 11.2**
    - **Propriété 38 : Génération de rapport PDF**
    - **Valide : Exigence 11.3**
    - **Propriété 39 : Métadonnées des exports**
    - **Valide : Exigence 11.5**
    - _Exigences : 11.1, 11.2, 11.3, 11.5_

- [x] 11. Checkpoint - Vérifier que tous les tests passent
  - Exécuter la suite complète de tests
  - Vérifier la couverture de code (objectif : 80%)
  - Tester les Edge Functions localement
  - Demander à l'utilisateur si des questions se posent

### Phase 8 : Configuration Realtime pour la Synchronisation

- [x] 12. Configurer Supabase Realtime
  - [x] 12.1 Activer Realtime sur les tables critiques
    - Activer Realtime sur : commandes, stock, factures, encaissements, tables
    - Configurer les événements : INSERT, UPDATE, DELETE
    - Configurer les filtres par rôle (RLS s'applique aussi au Realtime)
    - _Exigences : 6.1, 6.2, 6.3_

  - [x] 12.2 Tester la synchronisation en temps réel
    - Tester la réception des événements `commande.created`
    - Tester la réception des événements `commande.validated`
    - Tester la réception des événements `stock.updated`
    - Tester la réception des événements `ravitaillement.created`
    - Vérifier le délai de synchronisation (< 2 secondes)
    - _Exigences : 1.2, 2.5, 6.1, 6.2, 6.3_

  - [x] 12.3 Écrire les tests property-based pour la synchronisation
    - **Propriété 21 : Synchronisation des commandes en temps réel**
    - **Valide : Exigences 1.2, 6.1**
    - **Propriété 22 : Synchronisation des validations en temps réel**
    - **Valide : Exigences 2.5, 6.2**
    - **Propriété 23 : Synchronisation des ravitaillements en temps réel**
    - **Valide : Exigence 6.3**
    - _Exigences : 1.2, 2.5, 6.1, 6.2, 6.3_


### Phase 9 : Application Mobile Serveuse (React Native + Supabase)

**Note** : Cette phase implémente les écrans #10 (Order Entry) et #11 (Table Management) des maquettes HTML (voir `UI_mock_up.md`). Pour les détails complets d'intégration backend, consulter `FRONTEND_BACKEND_MAPPING.md`.

- [x] 13. Créer l'application mobile pour les serveuses
  - [x] 13.1 Initialiser le projet React Native avec Expo
    - Configurer le projet avec TypeScript
    - Installer les dépendances : @supabase/supabase-js, zustand, @tanstack/react-query, react-navigation, react-native-paper
    - Configurer la structure de dossiers (screens, components, services, store, hooks)
    - Configurer le client Supabase avec les clés API
    - _Exigences : Infrastructure mobile_

  - [x] 13.2 Implémenter l'écran de connexion (#18 Login Screen)
    - **Référence Mockup** : UI_mock_up.md - Screen #18 (Login Screen)
    - **Référence Backend** : FRONTEND_BACKEND_MAPPING.md - Section "Login Screen"
    - Créer LoginScreen avec formulaire email/mot de passe
    - Utiliser `supabase.auth.signInWithPassword()`
    - Stocker la session dans AsyncStorage (géré automatiquement par Supabase)
    - Gérer les erreurs d'authentification
    - Redirection automatique si déjà connecté
    - _Exigences : 7.1_

  - [x] 13.3 Implémenter l'écran de gestion des tables (#11 Table Management)
    - **Référence Mockup** : UI_mock_up.md - Screen #11 (Table Management)
    - **Référence Backend** : FRONTEND_BACKEND_MAPPING.md - Section "Table Management"
    - Créer TablesScreen avec liste des tables
    - Utiliser `supabase.from('tables').select('*')`
    - Afficher le statut de chaque table (libre, occupée, commande en attente)
    - Implémenter la sélection d'une table pour créer une commande
    - Implémenter le bouton pour libérer une table
    - Subscription Realtime pour mise à jour automatique des statuts
    - _Exigences : 10.1, 10.4_

  - [x] 13.4 Implémenter l'écran de création de commande (#10 Order Entry)
    - **Référence Mockup** : UI_mock_up.md - Screen #10 (Order Entry)
    - **Référence Backend** : FRONTEND_BACKEND_MAPPING.md - Section "Order Entry"
    - Créer CommandeScreen avec liste des produits par catégorie
    - Utiliser `supabase.rpc('get_produits_disponibles')`
    - Implémenter l'ajout de produits à la commande (state local)
    - Implémenter la modification des quantités
    - Afficher le montant total en temps réel (calcul local)
    - Implémenter le bouton de soumission : `supabase.rpc('create_commande', { table_id, items })`
    - Implémenter le bouton d'annulation (clear state local)
    - _Exigences : 1.1, 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 13.5 Implémenter la synchronisation Realtime
    - Créer un hook `useRealtimeSubscription(table, event, callback)`
    - S'abonner aux événements `commandes` avec filtre `serveuse_id = current_user`
    - Afficher les notifications de validation en temps réel
    - Gérer la reconnexion automatique (géré par Supabase)
    - _Exigences : 1.2, 2.5_

  - [x] 13.6 Implémenter le mode offline avec TanStack Query
    - Configurer TanStack Query avec cache persistant
    - Implémenter la queue locale pour les commandes offline
    - Utiliser `useMutation` avec `retry` pour synchronisation automatique
    - Afficher un indicateur de statut de connexion
    - _Exigences : 1.4, Mode offline_

  - [x] 13.7 Écrire les tests unitaires pour l'application mobile
    - Tester les composants principaux (TableCard, ProductList, CommandeSummary)
    - Tester les hooks personnalisés (useRealtimeSubscription, useOfflineQueue)
    - Tester les écrans avec React Native Testing Library
    - _Exigences : Tests mobile_

- [ ] 14. Checkpoint - Tester l'application mobile
  - Tester sur émulateur iOS et Android
  - Vérifier la création et soumission de commandes
  - Vérifier la réception des notifications Realtime
  - Tester le mode offline
  - Demander à l'utilisateur si des questions se posent


### Phase 10 : Application Web Comptoir (React + Supabase)

**Note** : Cette phase implémente les écrans #8 (Counter Validation) et #9 (Product Catalog) des maquettes HTML (voir `UI_mock_up.md`). Pour les détails complets d'intégration backend, consulter `FRONTEND_BACKEND_MAPPING.md`.

- [x] 15. Créer l'application web pour le comptoir
  - [x] 15.1 Initialiser le projet React avec Vite
    - Configurer le projet avec TypeScript
    - Installer les dépendances : @supabase/supabase-js, zustand, @tanstack/react-query, react-router-dom, @mui/material
    - Configurer la structure de dossiers (screens, components, hooks, utils)
    - Configurer le client Supabase avec les clés API
    - _Exigences : Infrastructure web_

  - [x] 15.2 Implémenter l'écran de connexion (#18 Login Screen)
    - **Référence Mockup** : UI_mock_up.md - Screen #18 (Login Screen)
    - **Référence Backend** : FRONTEND_BACKEND_MAPPING.md - Section "Login Screen"
    - Créer LoginScreen avec formulaire
    - Utiliser `supabase.auth.signInWithPassword()`
    - Redirection automatique selon le rôle
    - _Exigences : 7.1_

  - [x] 15.3 Implémenter l'écran de validation des commandes (#8 Counter Validation)
    - **Référence Mockup** : UI_mock_up.md - Screen #8 (Counter Validation)
    - **Référence Backend** : FRONTEND_BACKEND_MAPPING.md - Section "Counter Validation"
    - Créer ValidationScreen avec liste des commandes en attente
    - Utiliser `supabase.from('commandes').select('*, commande_items(*), tables(*), profiles(*)').eq('statut', 'en_attente')`
    - Afficher les détails de chaque commande (table, serveuse, produits, montant)
    - Implémenter le bouton de validation : `supabase.rpc('validate_commande', { commande_id })`
    - Gérer les erreurs de stock insuffisant
    - Subscription Realtime pour mise à jour automatique de la liste
    - _Exigences : 2.1, 2.2, 2.4_

  - [x] 15.4 Implémenter l'écran de gestion des factures et encaissements (#4 Payment Entry)
    - **Référence Mockup** : UI_mock_up.md - Screen #4 (Payment Entry)
    - **Référence Backend** : FRONTEND_BACKEND_MAPPING.md - Section "Payment Entry"
    - Créer FacturesScreen avec liste des factures
    - Utiliser `supabase.from('factures').select('*, commandes(*)')`
    - Afficher le statut de chaque facture (en_attente_paiement, partiellement_payee, payee)
    - Implémenter le formulaire d'encaissement : `supabase.rpc('create_encaissement', { facture_id, montant, mode_paiement })`
    - Afficher l'historique des encaissements pour chaque facture
    - Afficher les alertes de factures impayées : `supabase.rpc('get_factures_impayees_alerts')`
    - Implémenter le bouton d'impression de facture (génération PDF côté client)
    - _Exigences : 13.3, 13.5, 14.1, 14.5, 15.3, 15.4_

  - [x] 15.5 Implémenter l'écran de consultation du stock (#2 Stock Inventory)
    - **Référence Mockup** : UI_mock_up.md - Screen #2 (Stock Inventory)
    - **Référence Backend** : FRONTEND_BACKEND_MAPPING.md - Section "Stock Inventory"
    - Créer StockScreen avec tableau du stock
    - Utiliser `supabase.from('stock').select('*, produits(*)')`
    - Afficher les alertes de stock bas : `supabase.rpc('check_stock_alerts')`
    - Afficher l'historique des mouvements de stock
    - Subscription Realtime pour mise à jour automatique
    - _Exigences : 3.3, 3.4_

  - [x] 15.6 Écrire les tests unitaires pour l'application comptoir
    - Tester les composants principaux
    - Tester les hooks personnalisés
    - Tester les écrans avec React Testing Library
    - _Exigences : Tests comptoir_

- [ ] 16. Checkpoint - Tester l'application comptoir
  - Tester la réception des commandes en temps réel
  - Tester la validation et le rejet de commandes
  - Vérifier la mise à jour du stock
  - Tester l'enregistrement des encaissements
  - Demander à l'utilisateur si des questions se posent


### Phase 11 : Application Web Tableau de Bord Patron (React + Supabase)

**Note** : Cette phase implémente les écrans Manager (#1-5), Patron (#6-7), et Shared (#12-17) des maquettes HTML (voir `UI_mock_up.md`). Pour les détails complets d'intégration backend, consulter `FRONTEND_BACKEND_MAPPING.md`.

- [ ] 17. Créer l'application web pour le patron et le gérant
  - [x] 17.1 Initialiser le projet React avec Vite
    - Configurer le projet avec TypeScript
    - Installer les dépendances : @supabase/supabase-js, zustand, @tanstack/react-query, react-router-dom, @mui/material, recharts
    - Configurer la structure de dossiers
    - Configurer le client Supabase
    - _Exigences : Infrastructure web_

  - [x] 17.2 Implémenter l'écran de connexion (#18 Login Screen)
    - **Référence Mockup** : UI_mock_up.md - Screen #18 (Login Screen)
    - **Référence Backend** : FRONTEND_BACKEND_MAPPING.md - Section "Login Screen"
    - Créer LoginScreen
    - Utiliser Supabase Auth
    - _Exigences : 7.1_

  - [x] 17.3 Implémenter le tableau de bord principal (#1 Manager Dashboard)
    - **Référence Mockup** : UI_mock_up.md - Screen #1 (Manager Dashboard)
    - **Référence Backend** : FRONTEND_BACKEND_MAPPING.md - Section "Manager Dashboard"
    - Créer DashboardScreen avec KPIs
    - Utiliser `supabase.rpc('get_kpis', { debut, fin })` pour CA, encaissements, créances, bénéfice
    - Afficher séparément le CA et les encaissements
    - Afficher le montant des créances (CA - Encaissements)
    - Utiliser `supabase.rpc('get_analytics', { debut, fin, granularite })` pour les graphiques
    - Afficher les graphiques d'évolution du CA et des encaissements (Recharts)
    - Afficher les ventes par produit
    - Afficher les statistiques d'encaissements par mode de paiement
    - Implémenter les filtres par période (jour, semaine, mois, personnalisée)
    - Subscription Realtime pour mise à jour automatique des KPIs
    - _Exigences : 5.1, 5.2, 5.3, 5.4, 5.5, 14.5, 15.1, 15.2_

  - [x] 17.4 Implémenter l'écran de gestion du stock (#2 Stock Inventory)
    - **Référence Mockup** : UI_mock_up.md - Screen #2 (Stock Inventory)
    - **Référence Backend** : FRONTEND_BACKEND_MAPPING.md - Section "Stock Inventory"
    - Créer StockScreen avec tableau du stock
    - Utiliser `supabase.from('stock').select('*, produits(*)')`
    - Afficher les alertes de stock bas
    - Afficher l'historique des mouvements
    - Subscription Realtime pour mise à jour automatique
    - _Exigences : 3.3, 3.4, 3.5_

  - [x] 17.5 Implémenter l'écran de tableau de bord financier (#3 Financial Dashboard)
    - **Référence Mockup** : UI_mock_up.md - Screen #3 (Financial Dashboard)
    - **Référence Backend** : FRONTEND_BACKEND_MAPPING.md - Section "Financial Dashboard"
    - Créer FinancialDashboardScreen avec analytics CA vs Encaissements
    - Utiliser `supabase.from('analytics_ca_encaissements').select('*')`
    - Afficher les créances : `supabase.from('analytics_creances').select('*')`
    - Afficher les statistiques par mode de paiement
    - Graphiques d'évolution temporelle
    - _Exigences : 15.1, 15.2, 14.5_

  - [x] 17.6 Implémenter l'écran de ravitaillement (#14 Supply Entry)
    - **Référence Mockup** : UI_mock_up.md - Screen #14 (Supply Entry)
    - **Référence Backend** : FRONTEND_BACKEND_MAPPING.md - Section "Supply Entry"
    - Créer RavitaillementScreen avec formulaire
    - Utiliser `supabase.rpc('create_ravitaillement', { fournisseur, date, items })`
    - Permettre l'ajout de plusieurs produits
    - Calculer le montant total automatiquement
    - Afficher l'historique des ravitaillements
    - _Exigences : 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 17.7 Implémenter l'écran d'historique des ravitaillements (#5 Supply History)
    - **Référence Mockup** : UI_mock_up.md - Screen #5 (Supply History)
    - **Référence Backend** : FRONTEND_BACKEND_MAPPING.md - Section "Supply History"
    - Créer SupplyHistoryScreen avec liste des ravitaillements
    - Utiliser `supabase.from('ravitaillements').select('*, ravitaillement_items(*), profiles(*)')`
    - Filtres par période et fournisseur
    - Détails de chaque ravitaillement
    - _Exigences : 4.5_

  - [x] 17.8 Implémenter l'écran de gestion des produits (#13 Product Editor)
    - **Référence Mockup** : UI_mock_up.md - Screen #13 (Product Editor)
    - **Référence Backend** : FRONTEND_BACKEND_MAPPING.md - Section "Product Editor"
    - Créer ProduitsScreen avec tableau des produits
    - Utiliser `supabase.from('produits').select('*')`
    - Implémenter le formulaire de création/modification (INSERT/UPDATE)
    - Implémenter la désactivation de produits (UPDATE actif = false)
    - Afficher l'historique des modifications (depuis audit_logs)
    - _Exigences : 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 17.9 Implémenter l'écran de profits et pertes (#6 Profit & Loss)
    - **Référence Mockup** : UI_mock_up.md - Screen #6 (Profit & Loss)
    - **Référence Backend** : FRONTEND_BACKEND_MAPPING.md - Section "Profit & Loss"
    - Créer ProfitLossScreen avec rapport détaillé
    - Utiliser `supabase.rpc('get_kpis', { debut, fin })` pour le bénéfice
    - Détail des coûts (ravitaillements) et revenus (commandes)
    - Marge par produit
    - _Exigences : 5.2_

  - [x] 17.10 Implémenter l'écran de gestion des créances (#7 Outstanding Debts)
    - **Référence Mockup** : UI_mock_up.md - Screen #7 (Outstanding Debts)
    - **Référence Backend** : FRONTEND_BACKEND_MAPPING.md - Section "Outstanding Debts"
    - Créer FacturesScreen avec liste de toutes les factures
    - Utiliser `supabase.from('factures').select('*, commandes(*)')`
    - Implémenter le filtrage par statut
    - Afficher la liste des factures impayées avec ancienneté : `supabase.from('factures_overdue').select('*')`
    - Afficher les alertes pour factures impayées > 24h
    - Afficher l'historique des encaissements
    - Permettre la consultation des détails de chaque facture
    - _Exigences : 13.5, 15.3, 15.4, 15.5_

  - [x] 17.11 Implémenter l'écran de rapports et exports
    - **Référence Backend** : Edge Functions (generate-ventes-csv, generate-stock-csv, generate-rapport-pdf)
    - Créer RapportsScreen
    - Implémenter les boutons d'export : appeler les Edge Functions
    - `supabase.functions.invoke('generate-ventes-csv', { body: { debut, fin } })`
    - `supabase.functions.invoke('generate-stock-csv', { body: { debut, fin } })`
    - `supabase.functions.invoke('generate-rapport-pdf', { body: { debut, fin } })`
    - Télécharger les fichiers depuis Supabase Storage
    - Afficher la progression de génération
    - _Exigences : 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 17.12 Implémenter l'écran de gestion des utilisateurs (#12 User Management)
    - **Référence Mockup** : UI_mock_up.md - Screen #12 (User Management)
    - **Référence Backend** : FRONTEND_BACKEND_MAPPING.md - Section "User Management"
    - Créer UtilisateursScreen (accessible uniquement au patron)
    - Utiliser `supabase.auth.admin.createUser()` pour créer des utilisateurs
    - Utiliser `supabase.from('profiles').update()` pour modifier les profils
    - Gérer les rôles et permissions
    - Afficher la liste de tous les utilisateurs
    - _Exigences : 7.2, 7.3, 7.4_

  - [x] 17.13 Implémenter l'écran de consultation des transactions
    - **Référence Backend** : Fonction `search_transactions(filters)`
    - Créer TransactionsScreen
    - Utiliser `supabase.rpc('search_transactions', { filters })`
    - Afficher l'historique complet avec tous les détails
    - Implémenter la recherche par critères (date, serveuse, table, produit)
    - Implémenter la pagination (50 résultats par page)
    - _Exigences : 8.1, 8.2, 8.4, 8.5_

  - [x] 17.14 Implémenter l'écran d'audit log (#15 Audit Log)
    - **Référence Mockup** : UI_mock_up.md - Screen #15 (Audit Log)
    - **Référence Backend** : FRONTEND_BACKEND_MAPPING.md - Section "Audit Log"
    - Créer AuditLogScreen avec historique complet
    - Utiliser `supabase.from('audit_logs').select('*, profiles(*)')`
    - Filtres par utilisateur, action, période
    - Affichage détaillé des changements (avant/après)
    - _Exigences : 7.5, 8.1_

  - [x] 17.15 Implémenter l'écran de profil utilisateur (#16 User Profile)
    - **Référence Mockup** : UI_mock_up.md - Screen #16 (User Profile)
    - **Référence Backend** : FRONTEND_BACKEND_MAPPING.md - Section "User Profile"
    - Créer UserProfileScreen
    - Utiliser `supabase.from('profiles').select('*').eq('id', currentUserId)`
    - Permettre la modification du profil
    - Changement de mot de passe via `supabase.auth.updateUser()`
    - _Exigences : 7.1_

  - [x] 17.16 Implémenter l'écran d'activité système (#17 System Activity)
    - **Référence Mockup** : UI_mock_up.md - Screen #17 (System Activity)
    - **Référence Backend** : FRONTEND_BACKEND_MAPPING.md - Section "System Activity"
    - Créer SystemActivityScreen avec activité en temps réel
    - Utiliser `supabase.from('audit_logs').select('*')` pour activité récente
    - Subscriptions Realtime sur toutes les tables critiques
    - Statistiques en temps réel
    - _Exigences : Monitoring système_

  - [x] 17.17 Écrire les tests unitaires pour l'application patron/gérant
    - Tester les composants principaux
    - Tester les calculs analytiques
    - Tester les hooks personnalisés
    - _Exigences : Tests patron_

- [ ] 18. Checkpoint - Tester l'application patron
  - Tester tous les écrans et fonctionnalités
  - Vérifier les mises à jour en temps réel
  - Vérifier les exports et rapports
  - Tester l'accès depuis différents appareils
  - Demander à l'utilisateur si des questions se posent

### Phase 12 : Tests d'Intégration et Déploiement

- [ ] 19. Tests d'intégration end-to-end
  - [ ] 19.1 Écrire les tests d'intégration avec Playwright
    - Tester le flux complet : création commande → validation → mise à jour stock → génération facture → encaissement
    - Tester le flux de ravitaillement complet
    - Tester la synchronisation Realtime entre toutes les applications
    - Tester les scénarios d'erreur (stock insuffisant, perte de connexion)
    - Tester le mode offline et la resynchronisation
    - _Exigences : Toutes_

  - [ ] 19.2 Tester la performance et la charge
    - Tester avec plusieurs serveuses simultanées (10+)
    - Tester avec un grand volume de commandes (100+ par heure)
    - Vérifier les temps de réponse Supabase (< 2 secondes pour la sync)
    - Vérifier la latence Realtime (< 500ms)
    - _Exigences : 6.1, 6.2, 6.3_


- [ ] 20. Préparer le déploiement
  - [ ] 20.1 Configurer les environnements Supabase
    - Créer un projet Supabase de staging (pour tests)
    - Créer un projet Supabase de production
    - Configurer les variables d'environnement pour chaque environnement
    - Documenter les URLs et clés API
    - _Exigences : Infrastructure_

  - [ ] 20.2 Déployer les applications frontend sur Vercel
    - Connecter les repos GitHub à Vercel
    - Configurer les variables d'environnement (SUPABASE_URL, SUPABASE_ANON_KEY)
    - Déployer l'app web comptoir
    - Déployer l'app web tableau de bord patron
    - Configurer les domaines personnalisés (optionnel)
    - _Exigences : Déploiement frontend_

  - [ ] 20.3 Publier l'application mobile
    - Configurer les builds Expo (EAS Build)
    - Générer les builds iOS et Android
    - Tester les builds sur appareils réels
    - Préparer les assets (icônes, splash screens)
    - Soumettre sur Google Play Store (Android)
    - Soumettre sur Apple App Store (iOS) - optionnel
    - _Exigences : Déploiement mobile_

  - [ ] 20.4 Configurer le monitoring et les alertes
    - Activer les alertes Supabase (usage, erreurs, performance)
    - Configurer Sentry pour le monitoring d'erreurs frontend (optionnel)
    - Créer un dashboard de monitoring personnalisé
    - Configurer les notifications email/SMS pour les alertes critiques
    - _Exigences : Monitoring_

  - [ ] 20.5 Créer la documentation de déploiement et d'utilisation
    - Rédiger le guide d'installation pour les snack-bars
    - Rédiger le guide d'utilisation pour les serveuses
    - Rédiger le guide d'utilisation pour le comptoir
    - Rédiger le guide d'utilisation pour le patron
    - Rédiger le guide de dépannage (troubleshooting)
    - Créer des vidéos de formation (optionnel)
    - _Exigences : Documentation_

- [ ] 21. Checkpoint final - Validation complète du système
  - Exécuter tous les tests (unitaires, property-based, intégration)
  - Vérifier la couverture de code finale (objectif : 80%)
  - Tester le déploiement complet en staging
  - Valider toutes les exigences fonctionnelles
  - Effectuer un test pilote dans 1-2 snack-bars
  - Recueillir les retours utilisateurs
  - Ajuster si nécessaire
  - Demander à l'utilisateur si le système est prêt pour le déploiement production

## Notes

- Toutes les tâches sont obligatoires pour garantir une couverture de test complète
- Chaque tâche référence les exigences spécifiques qu'elle implémente
- Les checkpoints permettent une validation incrémentale
- Les tests property-based valident les propriétés de correction universelles (58 propriétés au total)
- Les tests unitaires valident les exemples spécifiques et cas limites
- La configuration minimale recommandée pour les tests property-based est de 100 itérations par test
- **Supabase élimine le besoin de coder un backend custom** : API REST auto-générée, Auth intégré, Realtime natif
- **Row Level Security (RLS)** remplace les middlewares d'autorisation traditionnels
- **Edge Functions** sont utilisées uniquement pour la logique métier complexe (exports)
- **Pas de Docker, pas de serveur** : Tout est managé par Supabase et Vercel

## Différences Clés avec l'Architecture On-Premise

| Aspect | On-Premise (backup) | Supabase (actuel) |
|--------|---------------------|-------------------|
| **Backend** | Node.js + NestJS à coder | API auto-générée par Supabase |
| **Auth** | Passport.js + JWT à coder | Supabase Auth intégré |
| **Realtime** | Socket.io à configurer | Realtime natif PostgreSQL |
| **Permissions** | Middlewares à coder | Row Level Security (RLS) |
| **Déploiement** | Docker Compose | Supabase Cloud + Vercel |
| **Temps de dev** | 3-4 mois | 1-2 mois |
| **Compétences** | Backend + DevOps | Frontend uniquement |

## Ressources Utiles

- **Documentation Supabase** : https://supabase.com/docs
- **Supabase Auth** : https://supabase.com/docs/guides/auth
- **Row Level Security** : https://supabase.com/docs/guides/auth/row-level-security
- **Realtime** : https://supabase.com/docs/guides/realtime
- **Edge Functions** : https://supabase.com/docs/guides/functions
- **React Native + Supabase** : https://supabase.com/docs/guides/getting-started/tutorials/with-react-native
- **Vercel Deployment** : https://vercel.com/docs

