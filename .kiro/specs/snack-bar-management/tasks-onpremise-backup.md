# Plan d'Implémentation - Système de Gestion de Snack-Bar

## Vue d'Ensemble

Ce plan d'implémentation découpe le développement du système de gestion de snack-bar en tâches incrémentales et testables. Chaque tâche construit sur les précédentes et se termine par une validation fonctionnelle.

Le développement suit une approche backend-first pour établir les fondations, puis intègre progressivement les applications clientes.

## Tâches

### Phase 1 : Infrastructure et Base de Données

- [ ] 1. Configurer l'environnement de développement et la base de données
  - Initialiser le projet Node.js avec TypeScript et NestJS
  - Configurer PostgreSQL et Redis avec Docker Compose
  - Mettre en place Prisma ORM avec le schéma de base de données
  - Créer les migrations pour toutes les entités (User, Produit, Stock, Commande, CommandeItem, MouvementStock, Ravitaillement, RavitaillementItem, Table, Facture, Encaissement, AuditLog)
  - Configurer les contraintes d'intégrité, index, et triggers PostgreSQL
  - _Exigences : Toutes (infrastructure de base)_

- [ ] 1.1 Écrire les tests unitaires pour les migrations
  - Tester la création de toutes les tables
  - Tester les contraintes d'unicité et de clés étrangères
  - Tester les valeurs par défaut
  - _Exigences : Intégrité des données_

### Phase 2 : Authentification et Autorisation

- [ ] 2. Implémenter le système d'authentification
  - [ ] 2.1 Créer le module d'authentification avec Passport.js et JWT
    - Implémenter l'endpoint POST /api/auth/login
    - Implémenter l'endpoint POST /api/auth/logout
    - Implémenter l'endpoint GET /api/auth/me
    - Hashage des mots de passe avec bcrypt (salt rounds = 12)
    - Génération de JWT avec durée de vie 8 heures
    - _Exigences : 7.1_

  - [ ] 2.2 Écrire le test property-based pour l'authentification
    - **Propriété 25 : Authentification obligatoire**
    - **Valide : Exigence 7.1**
    - Générer des tentatives de connexion valides et invalides
    - Vérifier que seules les tentatives valides obtiennent un token
    - _Exigences : 7.1_

  - [ ] 2.3 Implémenter le contrôle d'accès basé sur les rôles (RBAC)
    - Créer les middlewares authMiddleware et roleMiddleware
    - Implémenter la vérification des permissions par rôle
    - Configurer les permissions pour chaque rôle (serveuse, comptoir, gérant, patron)
    - _Exigences : 7.2, 7.3, 7.4_

  - [ ] 2.4 Écrire le test property-based pour le RBAC
    - **Propriété 26 : Contrôle d'accès basé sur les rôles**
    - **Valide : Exigences 7.2, 7.3, 7.4**
    - Générer des utilisateurs avec différents rôles
    - Vérifier que chaque rôle accède uniquement aux endpoints autorisés
    - _Exigences : 7.2, 7.3, 7.4_

  - [ ] 2.5 Implémenter le système d'audit
    - Créer le service AuditService
    - Implémenter l'enregistrement automatique des actions utilisateur
    - Créer un middleware pour capturer les actions
    - _Exigences : 7.5, 8.1_

  - [ ] 2.6 Écrire le test property-based pour l'audit
    - **Propriété 27 : Traçabilité des actions utilisateur**
    - **Valide : Exigence 7.5**
    - Générer des actions aléatoires
    - Vérifier qu'un log d'audit est créé pour chaque action
    - _Exigences : 7.5_

### Phase 3 : Gestion des Produits et du Stock

- [ ] 3. Implémenter la gestion des produits
  - [ ] 3.1 Créer le module Produit avec CRUD complet
    - Implémenter POST /api/produits (création)
    - Implémenter GET /api/produits (liste avec filtres)
    - Implémenter GET /api/produits/:id (détail)
    - Implémenter PUT /api/produits/:id (modification)
    - Implémenter DELETE /api/produits/:id (soft delete)
    - Validation avec Zod (nom, catégorie, prix, seuil requis)
    - _Exigences : 12.1, 12.2, 12.3_

  - [ ] 3.2 Écrire les tests property-based pour les produits
    - **Propriété 40 : Validation des données de produit**
    - **Valide : Exigence 12.1**
    - **Propriété 42 : Désactivation sans suppression**
    - **Valide : Exigence 12.3**
    - **Propriété 44 : Audit des modifications de produits**
    - **Valide : Exigence 12.5**
    - _Exigences : 12.1, 12.3, 12.5_

  - [ ] 3.3 Implémenter la gestion du stock
    - Créer le module Stock avec StockService
    - Implémenter GET /api/stock (liste complète)
    - Implémenter GET /api/stock/:produitId (stock d'un produit)
    - Implémenter GET /api/stock/mouvements (historique)
    - Créer le trigger PostgreSQL pour mise à jour automatique du stock
    - _Exigences : 3.1, 3.2, 3.5_

  - [ ] 3.4 Écrire les tests property-based pour le stock
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
  - Demander à l'utilisateur si des questions se posent

### Phase 4 : Gestion des Commandes

- [ ] 5. Implémenter la création et gestion des commandes
  - [ ] 5.1 Créer le module Commande
    - Implémenter POST /api/commandes (création)
    - Implémenter GET /api/commandes (liste avec filtres)
    - Implémenter GET /api/commandes/:id (détail)
    - Implémenter DELETE /api/commandes/:id (annulation avant validation)
    - Génération automatique du numéro de commande (CMD-YYYYMMDD-XXX)
    - Calcul automatique du montant total
    - _Exigences : 1.1, 1.3, 9.5_

  - [ ] 5.2 Écrire les tests property-based pour les commandes
    - **Propriété 1 : Unicité des identifiants de commande**
    - **Valide : Exigence 1.1**
    - **Propriété 2 : Complétude des données de commande**
    - **Valide : Exigence 1.3**
    - **Propriété 7 : Calcul correct du montant total**
    - **Valide : Exigence 9.4**
    - **Propriété 8 : Annulation de commande non soumise**
    - **Valide : Exigence 9.5**
    - _Exigences : 1.1, 1.3, 9.4, 9.5_

  - [ ] 5.3 Implémenter la validation des commandes au comptoir
    - Implémenter PUT /api/commandes/:id/valider
    - Vérifier le stock disponible avant validation
    - Déduire automatiquement les quantités du stock
    - Créer les mouvements de stock (type sortie)
    - Rejeter si stock insuffisant
    - _Exigences : 2.2, 2.3, 2.4_

  - [ ] 5.4 Écrire les tests property-based pour la validation
    - **Propriété 4 : Déduction automatique du stock**
    - **Valide : Exigences 2.2, 3.2**
    - **Propriété 5 : Création de mouvement de stock pour les ventes**
    - **Valide : Exigence 2.3**
    - **Propriété 6 : Rejet des commandes avec stock insuffisant**
    - **Valide : Exigence 2.4**
    - _Exigences : 2.2, 2.3, 2.4_

  - [ ] 5.5 Implémenter le filtrage des produits disponibles
    - Créer l'endpoint GET /api/produits/disponibles
    - Filtrer les produits avec quantité > 0 et actif = true
    - _Exigences : 1.5, 12.4_

  - [ ] 5.6 Écrire les tests property-based pour le filtrage
    - **Propriété 3 : Filtrage des produits disponibles**
    - **Valide : Exigence 1.5**
    - **Propriété 43 : Exclusion des produits inactifs**
    - **Valide : Exigence 12.4**
    - _Exigences : 1.5, 12.4_

  - [ ] 5.7 Implémenter l'immutabilité des commandes validées
    - Ajouter la vérification du statut avant modification/suppression
    - Retourner une erreur 422 si tentative de modification
    - _Exigences : 8.3_

  - [ ] 5.8 Écrire le test property-based pour l'immutabilité
    - **Propriété 30 : Immutabilité des commandes validées**
    - **Valide : Exigence 8.3**
    - _Exigences : 8.3_

### Phase 5 : Gestion des Ravitaillements

- [ ] 6. Implémenter la gestion des ravitaillements
  - [ ] 6.1 Créer le module Ravitaillement
    - Implémenter POST /api/ravitaillements (création)
    - Implémenter GET /api/ravitaillements (liste avec filtres par période)
    - Implémenter GET /api/ravitaillements/:id (détail)
    - Validation des champs obligatoires (fournisseur, date, produits, quantités, coûts)
    - Génération automatique du numéro de ravitaillement (RAV-YYYYMMDD-XXX)
    - Création automatique des mouvements de stock (type entrée)
    - Mise à jour automatique du stock
    - _Exigences : 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ] 6.2 Écrire les tests property-based pour les ravitaillements
    - **Propriété 9 : Incrémentation du stock lors des ravitaillements**
    - **Valide : Exigences 3.1, 4.3**
    - **Propriété 13 : Validation des données de ravitaillement**
    - **Valide : Exigences 4.1, 4.4**
    - **Propriété 14 : Création de mouvement de stock pour les ravitaillements**
    - **Valide : Exigence 4.2**
    - **Propriété 15 : Filtrage des ravitaillements par période**
    - **Valide : Exigence 4.5**
    - _Exigences : 3.1, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ] 6.3 Implémenter les alertes de stock bas
    - Créer le service AlerteService
    - Vérifier le seuil minimum après chaque mouvement de stock
    - Générer une alerte si quantité <= seuil
    - _Exigences : 3.4_

  - [ ] 6.4 Écrire le test property-based pour les alertes
    - **Propriété 10 : Génération d'alertes de stock bas**
    - **Valide : Exigence 3.4**
    - _Exigences : 3.4_

- [ ] 7. Checkpoint - Vérifier que tous les tests passent
  - Exécuter la suite complète de tests
  - Vérifier la couverture de code (objectif : 80%)
  - Demander à l'utilisateur si des questions se posent

### Phase 5.5 : Gestion des Factures et Encaissements

- [ ] 7.1 Implémenter la gestion des factures
  - [ ] 7.1.1 Créer le module Facture
    - Implémenter GET /api/factures (liste avec filtres par statut)
    - Implémenter GET /api/factures/:id (détail)
    - Implémenter GET /api/factures/commande/:commandeId (facture d'une commande)
    - Implémenter GET /api/factures/impayees (liste des factures impayées)
    - Implémenter POST /api/factures/:id/imprimer (génération pour impression)
    - Créer le trigger PostgreSQL pour génération automatique de facture lors de la validation de commande
    - Génération automatique du numéro de facture (FACT-YYYYMMDD-XXX)
    - _Exigences : 13.1, 13.2, 13.3, 13.4, 13.5_

  - [ ] 7.1.2 Écrire les tests property-based pour les factures
    - **Propriété 47 : Génération automatique de facture**
    - **Valide : Exigence 13.1**
    - **Propriété 48 : Unicité des numéros de facture**
    - **Valide : Exigence 13.1**
    - **Propriété 49 : Complétude des données de facture**
    - **Valide : Exigence 13.2**
    - **Propriété 57 : Cohérence facture-commande (invariant)**
    - **Valide : Cohérence des données**
    - _Exigences : 13.1, 13.2_

- [ ] 7.2 Implémenter la gestion des encaissements
  - [ ] 7.2.1 Créer le module Encaissement
    - Implémenter POST /api/encaissements (enregistrement d'un paiement)
    - Implémenter GET /api/encaissements (liste avec filtres)
    - Implémenter GET /api/encaissements/facture/:factureId (encaissements d'une facture)
    - Implémenter GET /api/encaissements/stats (statistiques par mode de paiement et période)
    - Validation des champs obligatoires (facture, montant, mode de paiement)
    - Créer le trigger PostgreSQL pour mise à jour automatique du statut de facture après encaissement
    - _Exigences : 14.1, 14.2, 14.3, 14.4, 14.5_

  - [ ] 7.2.2 Écrire les tests property-based pour les encaissements
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

- [ ] 7.3 Implémenter la distinction CA et encaissements dans l'analytique
  - [ ] 7.3.1 Mettre à jour le service AnalyticsService
    - Ajouter le calcul séparé du CA et des encaissements
    - Ajouter le calcul des créances (CA - Encaissements)
    - Ajouter les statistiques d'encaissements par mode de paiement
    - Implémenter le filtrage des factures par statut
    - Implémenter la liste des factures impayées avec ancienneté
    - _Exigences : 15.1, 15.2, 15.3, 15.4_

  - [ ] 7.3.2 Écrire les tests property-based pour la distinction CA/encaissements
    - **Propriété 54 : Distinction CA et encaissements**
    - **Valide : Exigence 15.1**
    - **Propriété 55 : Calcul des créances**
    - **Valide : Exigence 15.2**
    - _Exigences : 15.1, 15.2_

- [ ] 7.4 Implémenter les alertes de factures impayées
  - [ ] 7.4.1 Créer le service AlerteFactureService
    - Vérifier quotidiennement les factures impayées > 24h
    - Générer une alerte visible dans le tableau de bord
    - Envoyer une notification au patron/gérant
    - _Exigences : 15.5_

  - [ ] 7.4.2 Écrire le test property-based pour les alertes de factures impayées
    - **Propriété 56 : Génération d'alerte pour factures impayées**
    - **Valide : Exigence 15.5**
    - _Exigences : 15.5_

- [ ] 7.5 Checkpoint - Vérifier que tous les tests passent
  - Exécuter la suite complète de tests
  - Vérifier la couverture de code (objectif : 80%)
  - Demander à l'utilisateur si des questions se posent


### Phase 6 : Gestion des Tables

- [ ] 8. Implémenter la gestion des tables
  - [ ] 8.1 Créer le module Table
    - Implémenter GET /api/tables (liste avec statuts)
    - Implémenter PUT /api/tables/:id/statut (changement de statut)
    - Créer les triggers pour mise à jour automatique du statut lors des commandes
    - _Exigences : 10.1, 10.2, 10.3, 10.4_

  - [ ] 8.2 Écrire les tests property-based pour les tables
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

- [ ] 9. Implémenter le module d'analytique
  - [ ] 9.1 Créer le service AnalyticsService
    - Implémenter GET /api/analytics/kpis (CA, bénéfice, nombre commandes, panier moyen)
    - Implémenter GET /api/analytics/ventes-produits (agrégation par produit)
    - Implémenter GET /api/analytics/evolution-ca (évolution temporelle)
    - Supporter les filtres par période (jour, semaine, mois, personnalisée)
    - _Exigences : 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 9.2 Écrire les tests property-based pour l'analytique
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

  - [ ] 9.3 Implémenter la recherche de transactions
    - Implémenter GET /api/commandes/recherche avec filtres (date, serveuse, table, produit)
    - Supporter la pagination (50 résultats par page)
    - _Exigences : 8.5_

  - [ ] 9.4 Écrire le test property-based pour la recherche
    - **Propriété 31 : Recherche de transactions**
    - **Valide : Exigence 8.5**
    - _Exigences : 8.5_

- [ ] 10. Implémenter le module d'export
  - [ ] 10.1 Créer le service ExportService
    - Implémenter GET /api/exports/ventes-csv (export CSV des ventes)
    - Implémenter GET /api/exports/stock-csv (export CSV des mouvements de stock)
    - Implémenter GET /api/exports/rapport-pdf (génération PDF avec jsPDF)
    - Inclure les métadonnées (période, date de génération)
    - _Exigences : 11.1, 11.2, 11.3, 11.5_

  - [ ] 10.2 Écrire les tests property-based pour les exports
    - **Propriété 36 : Complétude des exports CSV de ventes**
    - **Valide : Exigence 11.1**
    - **Propriété 37 : Complétude des exports CSV de mouvements de stock**
    - **Valide : Exigence 11.2**
    - **Propriété 38 : Génération de rapport PDF**
    - **Valide : Exigence 11.3**
    - **Propriété 39 : Métadonnées des exports**
    - **Valide : Exigence 11.5**
    - _Exigences : 11.1, 11.2, 11.3, 11.5_

- [ ] 11. Checkpoint - Vérifier que tous les tests passent
  - Exécuter la suite complète de tests
  - Vérifier la couverture de code (objectif : 80%)
  - Demander à l'utilisateur si des questions se posent

### Phase 8 : Synchronisation en Temps Réel

- [ ] 12. Implémenter le système de synchronisation WebSocket
  - [ ] 12.1 Configurer Socket.io sur le backend
    - Installer et configurer Socket.io
    - Créer le WebSocketServer avec gestion des rooms
    - Implémenter l'authentification WebSocket (vérification JWT)
    - Créer les gestionnaires d'événements (EventHandlers)
    - _Exigences : 6.1, 6.2, 6.3_

  - [ ] 12.2 Implémenter les événements de synchronisation
    - Événement `commande.created` : Broadcast au comptoir
    - Événement `commande.validated` : Broadcast aux serveuses et tableau de bord
    - Événement `stock.updated` : Broadcast à toutes les applications
    - Événement `ravitaillement.created` : Broadcast à toutes les applications
    - _Exigences : 1.2, 2.5, 6.1, 6.2, 6.3_

  - [ ] 12.3 Écrire les tests property-based pour la synchronisation
    - **Propriété 21 : Synchronisation des commandes en temps réel**
    - **Valide : Exigences 1.2, 6.1**
    - **Propriété 22 : Synchronisation des validations en temps réel**
    - **Valide : Exigences 2.5, 6.2**
    - **Propriété 23 : Synchronisation des ravitaillements en temps réel**
    - **Valide : Exigence 6.3**
    - _Exigences : 1.2, 2.5, 6.1, 6.2, 6.3_

  - [ ] 12.4 Implémenter le mécanisme de retry
    - Créer le service SyncService avec logique de retry
    - Implémenter le retry avec délai exponentiel (1s, 2s, 4s)
    - Implémenter la file d'attente locale pour événements non synchronisés
    - Implémenter la notification administrateur après 3 échecs
    - _Exigences : 6.4, 6.5_

  - [ ] 12.5 Écrire le test property-based pour le retry
    - **Propriété 24 : Mécanisme de retry avec délai exponentiel**
    - **Valide : Exigence 6.4**
    - _Exigences : 6.4_

### Phase 9 : Application Mobile Serveuse (React Native)

- [ ] 13. Créer l'application mobile pour les serveuses
  - [ ] 13.1 Initialiser le projet React Native avec Expo
    - Configurer le projet avec TypeScript
    - Installer les dépendances (Redux Toolkit, React Navigation, Socket.io-client, React Native Paper)
    - Configurer la structure de dossiers (screens, components, services, store)
    - _Exigences : Infrastructure mobile_

  - [ ] 13.2 Implémenter l'écran de connexion
    - Créer LoginScreen avec formulaire email/mot de passe
    - Implémenter AuthService pour appeler l'API
    - Stocker le token JWT dans AsyncStorage sécurisé
    - Gérer les erreurs d'authentification
    - _Exigences : 7.1_

  - [ ] 13.3 Implémenter l'écran de gestion des tables
    - Créer TablesScreen avec liste des tables
    - Afficher le statut de chaque table (libre, occupée, commande en attente)
    - Implémenter la sélection d'une table pour créer une commande
    - Implémenter le bouton pour libérer une table
    - _Exigences : 10.1, 10.4_

  - [ ] 13.4 Implémenter l'écran de création de commande
    - Créer CommandeScreen avec liste des produits par catégorie
    - Implémenter l'ajout de produits à la commande
    - Implémenter la modification des quantités
    - Afficher le montant total en temps réel
    - Implémenter le bouton de soumission
    - Implémenter le bouton d'annulation
    - _Exigences : 1.1, 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ] 13.5 Implémenter la connexion WebSocket
    - Créer WebSocketService pour gérer la connexion
    - Connecter au serveur avec le token JWT
    - Écouter les événements `commande.validated`
    - Afficher les notifications de validation
    - Gérer la reconnexion automatique
    - _Exigences : 1.2, 2.5_

  - [ ] 13.6 Implémenter la gestion d'état avec Redux
    - Créer les slices (auth, commandes, produits, tables)
    - Implémenter les actions et reducers
    - Intégrer Redux Persist pour le cache local
    - _Exigences : Gestion d'état_

  - [ ] 13.7 Écrire les tests unitaires pour l'application mobile
    - Tester les composants principaux (TableCard, ProductList, CommandeSummary)
    - Tester les services (AuthService, CommandeService, WebSocketService)
    - Tester les reducers Redux
    - _Exigences : Tests mobile_

- [ ] 14. Checkpoint - Tester l'application mobile
  - Tester sur émulateur iOS et Android
  - Vérifier la création et soumission de commandes
  - Vérifier la réception des notifications
  - Demander à l'utilisateur si des questions se posent

### Phase 10 : Application Web Comptoir (React)

- [ ] 15. Créer l'application web pour le comptoir
  - [ ] 15.1 Initialiser le projet React avec Vite
    - Configurer le projet avec TypeScript
    - Installer les dépendances (Redux Toolkit, React Router, Socket.io-client, Material-UI)
    - Configurer la structure de dossiers (screens, components, services, hooks)
    - _Exigences : Infrastructure web_

  - [ ] 15.2 Implémenter l'écran de connexion
    - Créer LoginScreen avec formulaire
    - Implémenter AuthService
    - Stocker le token JWT dans HttpOnly cookie
    - _Exigences : 7.1_

  - [ ] 15.3 Implémenter l'écran de validation des commandes
    - Créer ValidationScreen avec liste des commandes en attente
    - Afficher les détails de chaque commande (table, serveuse, produits, montant)
    - Implémenter le bouton de validation
    - Implémenter le bouton de rejet avec raison
    - Afficher les alertes de stock insuffisant
    - _Exigences : 2.1, 2.2, 2.4_

  - [ ] 15.4 Implémenter l'écran de gestion des factures et encaissements
    - Créer FacturesScreen avec liste des factures
    - Afficher le statut de chaque facture (en_attente_paiement, partiellement_payee, payee)
    - Implémenter le formulaire d'encaissement (montant, mode de paiement)
    - Afficher l'historique des encaissements pour chaque facture
    - Afficher les alertes de factures impayées
    - Implémenter le bouton d'impression de facture
    - _Exigences : 13.3, 13.5, 14.1, 14.5, 15.3, 15.4_

  - [ ] 15.5 Implémenter l'écran de consultation du stock
    - Créer StockScreen avec tableau du stock
    - Afficher les alertes de stock bas
    - Afficher l'historique des mouvements de stock
    - _Exigences : 3.3, 3.4_

  - [ ] 15.6 Implémenter la connexion WebSocket
    - Créer WebSocketService
    - Écouter les événements `commande.created`
    - Mettre à jour la liste des commandes en attente en temps réel
    - Écouter les événements `stock.updated`
    - _Exigences : 2.1, 6.1_

  - [ ] 15.7 Écrire les tests unitaires pour l'application comptoir
    - Tester les composants principaux
    - Tester les hooks personnalisés
    - Tester les services
    - _Exigences : Tests comptoir_

- [ ] 16. Checkpoint - Tester l'application comptoir
  - Tester la réception des commandes en temps réel
  - Tester la validation et le rejet de commandes
  - Vérifier la mise à jour du stock
  - Demander à l'utilisateur si des questions se posent

### Phase 11 : Application Web Tableau de Bord Patron (React)

- [ ] 17. Créer l'application web pour le patron
  - [ ] 17.1 Initialiser le projet React avec Vite
    - Configurer le projet avec TypeScript
    - Installer les dépendances (Redux Toolkit, React Router, Socket.io-client, Material-UI, Recharts)
    - Configurer la structure de dossiers
    - _Exigences : Infrastructure web_

  - [ ] 17.2 Implémenter l'écran de connexion
    - Créer LoginScreen
    - Implémenter AuthService
    - _Exigences : 7.1_

  - [ ] 17.3 Implémenter le tableau de bord principal
    - Créer DashboardScreen avec KPIs (CA, encaissements, créances, bénéfice, nombre commandes, panier moyen)
    - Afficher séparément le CA et les encaissements
    - Afficher le montant des créances (CA - Encaissements)
    - Afficher les graphiques d'évolution du CA et des encaissements
    - Afficher les ventes par produit
    - Afficher les statistiques d'encaissements par mode de paiement
    - Implémenter les filtres par période (jour, semaine, mois, personnalisée)
    - Mettre à jour en temps réel via WebSocket
    - _Exigences : 5.1, 5.2, 5.3, 5.4, 5.5, 14.5, 15.1, 15.2_

  - [ ] 17.4 Implémenter l'écran de gestion du stock
    - Créer StockScreen avec tableau du stock
    - Afficher les alertes de stock bas
    - Afficher l'historique des mouvements
    - _Exigences : 3.3, 3.4, 3.5_

  - [ ] 17.5 Implémenter l'écran de ravitaillement
    - Créer RavitaillementScreen avec formulaire
    - Permettre l'ajout de plusieurs produits
    - Calculer le montant total automatiquement
    - Afficher l'historique des ravitaillements
    - _Exigences : 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ] 17.6 Implémenter l'écran de gestion des produits
    - Créer ProduitsScreen avec tableau des produits
    - Implémenter le formulaire de création/modification
    - Implémenter la désactivation de produits
    - Afficher l'historique des modifications
    - _Exigences : 12.1, 12.2, 12.3, 12.4, 12.5_

  - [ ] 17.7 Implémenter l'écran de gestion des factures et créances
    - Créer FacturesScreen avec liste de toutes les factures
    - Implémenter le filtrage par statut (en_attente_paiement, partiellement_payee, payee)
    - Afficher la liste des factures impayées avec ancienneté
    - Afficher les alertes pour factures impayées > 24h
    - Afficher l'historique des encaissements
    - Permettre la consultation des détails de chaque facture
    - _Exigences : 13.5, 15.3, 15.4, 15.5_

  - [ ] 17.8 Implémenter l'écran de rapports et exports
    - Créer RapportsScreen
    - Implémenter les boutons d'export CSV (ventes, stock, encaissements)
    - Implémenter la génération de rapport PDF
    - Afficher la progression de génération
    - _Exigences : 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ] 17.9 Implémenter l'écran de gestion des utilisateurs
    - Créer UtilisateursScreen (accessible uniquement au patron)
    - Implémenter le CRUD des utilisateurs
    - Gérer les rôles et permissions
    - _Exigences : 7.2, 7.3, 7.4_

  - [ ] 17.10 Implémenter l'écran de consultation des transactions
    - Créer TransactionsScreen
    - Afficher l'historique complet avec tous les détails
    - Implémenter la recherche par critères (date, serveuse, table, produit)
    - Implémenter la pagination
    - _Exigences : 8.1, 8.2, 8.4, 8.5_

  - [ ] 17.11 Implémenter la connexion WebSocket
    - Créer WebSocketService
    - Écouter tous les événements de mise à jour
    - Mettre à jour les KPIs et graphiques en temps réel
    - _Exigences : 6.2, 6.3_

  - [ ] 17.12 Écrire les tests unitaires pour l'application patron
    - Tester les composants principaux
    - Tester les calculs analytiques
    - Tester les services
    - _Exigences : Tests patron_

- [ ] 18. Checkpoint - Tester l'application patron
  - Tester tous les écrans et fonctionnalités
  - Vérifier les mises à jour en temps réel
  - Vérifier les exports et rapports
  - Demander à l'utilisateur si des questions se posent

### Phase 12 : Tests d'Intégration et Déploiement

- [ ] 19. Tests d'intégration end-to-end
  - [ ] 19.1 Écrire les tests d'intégration
    - Tester le flux complet : création commande → validation → mise à jour stock
    - Tester le flux de ravitaillement complet
    - Tester la synchronisation entre toutes les applications
    - Tester les scénarios d'erreur (stock insuffisant, perte de connexion)
    - _Exigences : Toutes_

  - [ ] 19.2 Tester la performance et la charge
    - Tester avec plusieurs serveuses simultanées
    - Tester avec un grand volume de commandes
    - Vérifier les temps de réponse (< 2 secondes pour la sync)
    - _Exigences : 6.1, 6.2, 6.3_

- [ ] 20. Préparer le déploiement
  - [ ] 20.1 Configurer Docker et Docker Compose
    - Créer les Dockerfiles pour backend et frontend
    - Créer le docker-compose.yml complet
    - Configurer les variables d'environnement
    - _Exigences : Infrastructure_

  - [ ] 20.2 Configurer le backup automatique
    - Créer le script de backup PostgreSQL
    - Configurer le cron job pour backup quotidien
    - Tester la restauration depuis backup
    - _Exigences : Sécurité des données_

  - [ ] 20.3 Configurer le monitoring et les logs
    - Configurer Winston pour les logs structurés
    - Configurer la rotation des logs
    - Optionnel : Configurer Sentry pour le monitoring d'erreurs
    - _Exigences : Monitoring_

  - [ ] 20.4 Créer la documentation de déploiement
    - Rédiger le guide d'installation on-premise
    - Rédiger le guide de configuration réseau
    - Rédiger le guide de maintenance et backup
    - _Exigences : Documentation_

- [ ] 21. Checkpoint final - Validation complète du système
  - Exécuter tous les tests (unitaires, property-based, intégration)
  - Vérifier la couverture de code finale (objectif : 80%)
  - Tester le déploiement complet avec Docker Compose
  - Valider toutes les exigences fonctionnelles
  - Demander à l'utilisateur si le système est prêt pour le déploiement pilote

## Notes

- Toutes les tâches sont obligatoires pour garantir une couverture de test complète
- Chaque tâche référence les exigences spécifiques qu'elle implémente
- Les checkpoints permettent une validation incrémentale
- Les tests property-based valident les propriétés de correction universelles (58 propriétés au total)
- Les tests unitaires valident les exemples spécifiques et cas limites
- La configuration minimale recommandée pour les tests property-based est de 100 itérations par test
- La gestion des factures et encaissements permet un suivi financier précis avec distinction CA/encaissements et détection des impayés

