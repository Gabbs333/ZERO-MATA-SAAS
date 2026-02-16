# Document des Exigences

## Introduction

Le système de gestion de snack-bar est une solution numérique conçue pour résoudre le problème de détournement de stock dans les snack-bars au Cameroun. Le système crée une chaîne traçable depuis la commande client jusqu'au service effectif des boissons, rendant impossible la vente de produits hors du stock officiel. Il offre une visibilité complète au propriétaire sur les opérations, le chiffre d'affaires, et les mouvements de stock en temps réel.

## Glossaire

- **Système**: Le système de gestion de snack-bar
- **Application_Serveuse**: L'application mobile utilisée par les serveuses pour prendre les commandes
- **Système_Comptoir**: Le système de validation centralisé au comptoir
- **Tableau_Bord_Patron**: L'interface web/mobile pour le propriétaire et le gérant
- **Commande**: Une demande de produits effectuée par un client à une table
- **Stock_Officiel**: L'inventaire enregistré dans le système provenant des ravitaillements officiels
- **Mouvement_Stock**: Toute entrée (ravitaillement) ou sortie (vente) de produits
- **Serveuse**: Personnel qui prend les commandes et sert les clients
- **Comptoir**: Point de validation centralisé des commandes
- **Patron**: Propriétaire du snack-bar
- **Gérant**: Responsable opérationnel du snack-bar
- **Table**: Emplacement physique où sont assis les clients
- **Produit**: Article vendable (boisson, nourriture, etc.)
- **Ravitaillement**: Approvisionnement en produits provenant d'un fournisseur
- **Contingent**: Quantité de produits disponibles en stock
- **Facture**: Document généré pour une commande validée, indiquant le montant à payer
- **Encaissement**: Paiement effectif d'une facture par le client
- **Créance**: Montant des factures non encore encaissées
- **Mode_Paiement**: Méthode utilisée pour le paiement (espèces, mobile money, carte bancaire)

## Exigences

### Exigence 1: Prise de Commande Numérisée

**User Story:** En tant que serveuse, je veux enregistrer les commandes clients sur une application mobile, afin de garantir que toutes les ventes passent par le système officiel.

#### Critères d'Acceptation

1. QUAND une serveuse sélectionne une table et ajoute des produits, LE Système SHALL créer une commande avec un identifiant unique
2. QUAND une serveuse soumet une commande, L'Application_Serveuse SHALL transmettre la commande au Système_Comptoir en temps réel
3. QUAND une commande est créée, LE Système SHALL enregistrer l'horodatage, la table, la serveuse, et les produits commandés
4. QUAND une serveuse tente de soumettre une commande sans connexion réseau, L'Application_Serveuse SHALL afficher un message d'erreur et empêcher la soumission
5. LE Système SHALL afficher uniquement les produits disponibles en stock dans l'interface de commande

### Exigence 2: Validation Centralisée au Comptoir

**User Story:** En tant que responsable du comptoir, je veux valider les commandes de manière centralisée, afin de contrôler toutes les sorties de stock.

#### Critères d'Acceptation

1. QUAND une commande est reçue au comptoir, LE Système_Comptoir SHALL afficher la commande en attente de validation
2. QUAND le comptoir valide une commande, LE Système SHALL déduire automatiquement les quantités du Stock_Officiel
3. QUAND le comptoir valide une commande, LE Système SHALL enregistrer un Mouvement_Stock de type sortie avec l'horodatage
4. SI la quantité demandée dépasse le stock disponible, ALORS LE Système_Comptoir SHALL rejeter la validation et afficher un message d'erreur
5. QUAND une commande est validée, LE Système SHALL notifier l'Application_Serveuse de la validation

### Exigence 3: Suivi du Stock en Temps Réel

**User Story:** En tant que patron, je veux suivre mon stock en temps réel, afin de connaître précisément mes contingents disponibles.

#### Critères d'Acceptation

1. QUAND un ravitaillement est enregistré, LE Système SHALL ajouter les quantités au Stock_Officiel
2. QUAND une vente est validée, LE Système SHALL déduire les quantités du Stock_Officiel
3. LE Tableau_Bord_Patron SHALL afficher le niveau de stock actuel pour chaque produit
4. QUAND le stock d'un produit atteint un seuil minimum défini, LE Système SHALL générer une alerte de stock bas
5. LE Système SHALL enregistrer l'historique complet de tous les Mouvements_Stock avec horodatage, type (entrée/sortie), quantité, et utilisateur responsable

### Exigence 4: Enregistrement des Ravitaillements

**User Story:** En tant que gérant, je veux enregistrer les ravitaillements fournisseurs, afin de maintenir un inventaire précis du Stock_Officiel.

#### Critères d'Acceptation

1. QUAND un gérant enregistre un ravitaillement, LE Système SHALL exiger la saisie du fournisseur, de la date, des produits, et des quantités
2. QUAND un ravitaillement est enregistré, LE Système SHALL créer un Mouvement_Stock de type entrée
3. QUAND un ravitaillement est enregistré, LE Système SHALL mettre à jour le Stock_Officiel en ajoutant les quantités
4. LE Système SHALL enregistrer le coût d'achat unitaire pour chaque produit ravitaillé
5. LE Système SHALL permettre la consultation de l'historique des ravitaillements par période

### Exigence 5: Tableau de Bord Analytique

**User Story:** En tant que patron, je veux visualiser mon chiffre d'affaires et mes bénéfices en temps réel, afin de piloter mon business efficacement.

#### Critères d'Acceptation

1. LE Tableau_Bord_Patron SHALL afficher le chiffre d'affaires cumulé du jour en temps réel
2. LE Tableau_Bord_Patron SHALL calculer et afficher le bénéfice en soustrayant les coûts d'achat du chiffre d'affaires
3. LE Tableau_Bord_Patron SHALL permettre de filtrer les analyses par période (jour, semaine, mois, personnalisée)
4. LE Tableau_Bord_Patron SHALL afficher les ventes par produit avec quantités vendues et revenus générés
5. LE Tableau_Bord_Patron SHALL afficher le nombre de commandes traitées par période

### Exigence 6: Synchronisation des Données

**User Story:** En tant qu'utilisateur du système, je veux que mes données soient synchronisées en temps réel, afin d'avoir une information cohérente sur tous les appareils.

#### Critères d'Acceptation

1. QUAND une commande est créée sur l'Application_Serveuse, LE Système SHALL synchroniser la commande avec le Système_Comptoir dans un délai maximum de 2 secondes
2. QUAND une commande est validée au comptoir, LE Système SHALL synchroniser la mise à jour du stock avec le Tableau_Bord_Patron dans un délai maximum de 2 secondes
3. QUAND un ravitaillement est enregistré, LE Système SHALL synchroniser la mise à jour du stock avec toutes les applications connectées dans un délai maximum de 2 secondes
4. SI la synchronisation échoue, ALORS LE Système SHALL réessayer automatiquement jusqu'à 3 fois avec un délai exponentiel
5. SI la synchronisation échoue après 3 tentatives, ALORS LE Système SHALL enregistrer l'erreur et notifier l'administrateur

### Exigence 7: Gestion des Rôles et Accès

**User Story:** En tant que patron, je veux contrôler les accès selon les rôles, afin de garantir la sécurité et l'intégrité des données.

#### Critères d'Acceptation

1. LE Système SHALL authentifier chaque utilisateur avec un identifiant et un mot de passe avant d'accorder l'accès
2. QUAND un utilisateur avec le rôle Serveuse se connecte, LE Système SHALL autoriser uniquement l'accès à l'Application_Serveuse
3. QUAND un utilisateur avec le rôle Comptoir se connecte, LE Système SHALL autoriser uniquement l'accès au Système_Comptoir
4. QUAND un utilisateur avec le rôle Patron ou Gérant se connecte, LE Système SHALL autoriser l'accès au Tableau_Bord_Patron et aux fonctions d'administration
5. LE Système SHALL enregistrer toutes les actions utilisateur avec horodatage et identifiant pour audit

### Exigence 8: Traçabilité Complète des Ventes

**User Story:** En tant que patron, je veux une traçabilité complète de chaque vente, afin de détecter toute anomalie ou tentative de fraude.

#### Critères d'Acceptation

1. POUR CHAQUE commande validée, LE Système SHALL enregistrer la serveuse responsable, la table, l'heure de création, l'heure de validation, et le validateur au comptoir
2. LE Système SHALL générer un numéro de transaction unique pour chaque commande validée
3. LE Système SHALL interdire la modification ou la suppression des commandes validées
4. LE Tableau_Bord_Patron SHALL permettre de consulter l'historique complet des transactions avec tous les détails
5. LE Système SHALL permettre de rechercher des transactions par date, serveuse, table, ou produit

### Exigence 9: Interface Utilisateur Optimisée

**User Story:** En tant que serveuse, je veux une interface simple et rapide, afin de prendre les commandes efficacement pendant le service.

#### Critères d'Acceptation

1. L'Application_Serveuse SHALL afficher les produits organisés par catégories (boissons, nourriture, etc.)
2. QUAND une serveuse sélectionne un produit, L'Application_Serveuse SHALL l'ajouter à la commande en moins de 1 seconde
3. L'Application_Serveuse SHALL permettre de modifier les quantités d'un produit dans la commande avant soumission
4. L'Application_Serveuse SHALL afficher le montant total de la commande en temps réel
5. L'Application_Serveuse SHALL permettre d'annuler une commande avant sa soumission

### Exigence 10: Gestion des Tables

**User Story:** En tant que serveuse, je veux gérer l'état des tables, afin de savoir quelles tables sont occupées et lesquelles ont des commandes en attente.

#### Critères d'Acceptation

1. L'Application_Serveuse SHALL afficher la liste de toutes les tables avec leur état (libre, occupée, commande en attente)
2. QUAND une commande est créée pour une table, LE Système SHALL marquer la table comme "commande en attente"
3. QUAND une commande est validée, LE Système SHALL marquer la table comme "occupée"
4. L'Application_Serveuse SHALL permettre à une serveuse de marquer une table comme "libre" après le départ des clients
5. LE Système SHALL permettre d'associer plusieurs commandes successives à une même table avant sa libération

### Exigence 11: Rapports et Exports

**User Story:** En tant que patron, je veux exporter des rapports, afin d'analyser mes données avec des outils externes ou pour ma comptabilité.

#### Critères d'Acceptation

1. LE Tableau_Bord_Patron SHALL permettre d'exporter les données de ventes au format CSV
2. LE Tableau_Bord_Patron SHALL permettre d'exporter l'historique des mouvements de stock au format CSV
3. LE Tableau_Bord_Patron SHALL permettre de générer un rapport de synthèse quotidien au format PDF
4. QUAND un export est demandé, LE Système SHALL générer le fichier dans un délai maximum de 10 secondes
5. LE Système SHALL inclure dans les exports la période sélectionnée et la date de génération

### Exigence 12: Gestion des Produits

**User Story:** En tant que gérant, je veux gérer le catalogue de produits, afin d'ajouter, modifier ou retirer des articles de la vente.

#### Critères d'Acceptation

1. LE Système SHALL permettre d'ajouter un nouveau produit avec nom, catégorie, prix de vente, et seuil de stock minimum
2. LE Système SHALL permettre de modifier les informations d'un produit existant
3. LE Système SHALL permettre de désactiver un produit sans supprimer son historique
4. QUAND un produit est désactivé, LE Système SHALL le retirer de l'interface de commande des serveuses
5. LE Système SHALL conserver l'historique complet des modifications de produits avec horodatage et utilisateur responsable

### Exigence 13: Génération et Gestion des Factures

**User Story:** En tant que responsable du comptoir, je veux générer des factures pour chaque commande servie, afin de suivre précisément les encaissements.

#### Critères d'Acceptation

1. QUAND une commande est validée, LE Système_Comptoir SHALL générer automatiquement une facture avec un numéro unique
2. QUAND une facture est générée, LE Système SHALL enregistrer le montant total, la date de génération, et les détails de la commande associée
3. LE Système_Comptoir SHALL permettre d'imprimer ou d'afficher la facture pour remise au client
4. QUAND une facture est créée, LE Système SHALL marquer son statut comme "en_attente_paiement"
5. LE Système SHALL permettre de consulter la liste de toutes les factures avec leur statut de paiement

### Exigence 14: Suivi des Encaissements

**User Story:** En tant que responsable du comptoir, je veux enregistrer les encaissements des factures, afin de suivre les paiements effectifs et détecter les impayés.

#### Critères d'Acceptation

1. QUAND le comptoir enregistre un encaissement, LE Système SHALL exiger la saisie de la facture concernée, du montant payé, et du mode de paiement (espèces, mobile money, carte bancaire)
2. QUAND un encaissement est enregistré pour le montant total de la facture, LE Système SHALL marquer la facture comme "payee"
3. SI un encaissement partiel est enregistré, LE Système SHALL marquer la facture comme "partiellement_payee" et enregistrer le montant restant dû
4. LE Système SHALL enregistrer l'horodatage de chaque encaissement et l'utilisateur responsable
5. LE Tableau_Bord_Patron SHALL afficher le montant total des encaissements par période et par mode de paiement

### Exigence 15: Distinction Chiffre d'Affaires et Encaissements

**User Story:** En tant que patron, je veux distinguer le chiffre d'affaires (commandes servies) des encaissements réels, afin de suivre les créances et la trésorerie.

#### Critères d'Acceptation

1. LE Tableau_Bord_Patron SHALL afficher séparément le chiffre d'affaires (montant total des commandes validées) et les encaissements (montant total payé)
2. LE Tableau_Bord_Patron SHALL calculer et afficher le montant des créances (CA - Encaissements)
3. LE Tableau_Bord_Patron SHALL permettre de filtrer les factures par statut (en_attente_paiement, partiellement_payee, payee)
4. LE Tableau_Bord_Patron SHALL afficher la liste des factures impayées avec leur ancienneté
5. LE Système SHALL générer une alerte lorsqu'une facture reste impayée pendant plus de 24 heures
