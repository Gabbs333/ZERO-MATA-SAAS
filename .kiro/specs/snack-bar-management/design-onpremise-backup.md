# Document de Design - Système de Gestion de Snack-Bar

## Vue d'Ensemble

Le système de gestion de snack-bar est une solution distribuée en temps réel composée de trois applications principales interconnectées : une application mobile pour les serveuses, un système de validation au comptoir, et un tableau de bord analytique pour le patron. L'architecture repose sur une synchronisation en temps réel des données pour garantir la cohérence et la traçabilité complète de toutes les opérations.

### Objectifs Principaux

- **Traçabilité totale** : Chaque vente est enregistrée avec tous les détails (qui, quand, quoi, où)
- **Contrôle du stock** : Impossible de vendre hors du stock officiel
- **Visibilité en temps réel** : Le patron voit instantanément le CA, les bénéfices et le stock
- **Simplicité d'utilisation** : Interface optimisée pour un service rapide

### Contraintes Techniques

- Synchronisation en temps réel (< 2 secondes)
- Fonctionnement sur réseau local (WiFi du snack-bar)
- Support mobile (Android/iOS) pour les serveuses
- Interface web responsive pour le patron
- Gestion de la concurrence (plusieurs serveuses simultanées)

## Architecture

### Architecture Globale

Le système adopte une architecture client-serveur avec synchronisation en temps réel basée sur WebSocket.

```mermaid
graph TB
    subgraph "Applications Clientes"
        AS1[App Serveuse 1]
        AS2[App Serveuse 2]
        ASN[App Serveuse N]
        SC[Système Comptoir]
        TBP[Tableau Bord Patron]
    end
    
    subgraph "Backend"
        API[API REST + WebSocket]
        AUTH[Service Auth]
        SYNC[Service Sync]
        BL[Logique Métier]
    end
    
    subgraph "Données"
        DB[(Base de Données)]
        CACHE[Cache Redis]
    end
    
    AS1 <-->|WebSocket| API
    AS2 <-->|WebSocket| API
    ASN <-->|WebSocket| API
    SC <-->|WebSocket| API
    TBP <-->|WebSocket| API
    
    API --> AUTH
    API --> SYNC
    API --> BL
    
    BL --> DB
    SYNC --> CACHE
    SYNC --> DB
```

### Flux de Données Principaux

#### Flux 1 : Création et Validation de Commande

```mermaid
sequenceDiagram
    participant S as Serveuse
    participant AS as App Serveuse
    participant API as Backend API
    participant SC as Système Comptoir
    participant DB as Base de Données
    
    S->>AS: Sélectionne table + produits
    AS->>AS: Calcule total
    S->>AS: Soumet commande
    AS->>API: POST /commandes
    API->>DB: Enregistre commande (statut: en_attente)
    API-->>AS: Confirmation + ID commande
    API->>SC: WebSocket: Nouvelle commande
    SC->>SC: Affiche commande en attente
    
    Note over SC: Validation au comptoir
    SC->>API: PUT /commandes/{id}/valider
    API->>DB: Vérifie stock disponible
    alt Stock suffisant
        API->>DB: Déduit stock + change statut (validée)
        API->>DB: Crée mouvement_stock (sortie)
        API-->>SC: Confirmation validation
        API->>AS: WebSocket: Commande validée
        AS->>S: Notification validation
    else Stock insuffisant
        API-->>SC: Erreur stock insuffisant
    end
```

#### Flux 2 : Ravitaillement

```mermaid
sequenceDiagram
    participant G as Gérant
    participant TBP as Tableau Bord
    participant API as Backend API
    participant DB as Base de Données
    participant AS as App Serveuse
    
    G->>TBP: Enregistre ravitaillement
    TBP->>API: POST /ravitaillements
    API->>DB: Crée ravitaillement
    API->>DB: Crée mouvements_stock (entrées)
    API->>DB: Met à jour stock
    API-->>TBP: Confirmation
    API->>AS: WebSocket: Mise à jour stock
    API->>TBP: WebSocket: Mise à jour stock
```

### Stratégie de Synchronisation

**Mécanisme de Synchronisation en Temps Réel**

- **WebSocket bidirectionnel** : Connexion persistante entre chaque client et le serveur
- **Événements typés** : Chaque changement d'état génère un événement spécifique
- **Broadcast sélectif** : Les événements sont envoyés uniquement aux clients concernés

**Types d'Événements**

| Événement | Émetteur | Destinataires | Données |
|-----------|----------|---------------|---------|
| `commande.created` | App Serveuse | Comptoir | Détails commande |
| `commande.validated` | Comptoir | App Serveuse, Tableau Bord | ID commande, stock mis à jour |
| `stock.updated` | Backend | Toutes les apps | Produit ID, nouvelle quantité |
| `ravitaillement.created` | Tableau Bord | Toutes les apps | Produits ravitaillés |

**Gestion des Échecs de Synchronisation**

1. **Tentatives automatiques** : 3 tentatives avec délai exponentiel (1s, 2s, 4s)
2. **File d'attente locale** : Les événements non synchronisés sont mis en file
3. **Notification administrateur** : Après 3 échecs, alerte envoyée au gérant
4. **Réconciliation** : Au retour de la connexion, synchronisation complète de l'état

## Composants et Interfaces

### 1. Application Serveuse (Mobile)

**Technologies Recommandées**
- React Native (support iOS + Android)
- Redux pour la gestion d'état
- Socket.io-client pour WebSocket
- AsyncStorage pour cache local

**Composants Principaux**

```
AppServeuse/
├── screens/
│   ├── LoginScreen
│   ├── TablesScreen          # Liste des tables avec statuts
│   ├── CommandeScreen        # Création de commande
│   └── HistoriqueScreen      # Historique des commandes
├── components/
│   ├── TableCard             # Carte d'une table
│   ├── ProductList           # Liste des produits par catégorie
│   ├── ProductItem           # Item produit avec quantité
│   ├── CommandeSummary       # Résumé de la commande
│   └── NotificationBanner    # Notifications en temps réel
├── services/
│   ├── AuthService           # Authentification
│   ├── CommandeService       # Gestion des commandes
│   ├── WebSocketService      # Connexion temps réel
│   └── CacheService          # Cache local
└── store/
    ├── authSlice
    ├── commandesSlice
    ├── produitsSlice
    └── tablesSlice
```

**Interfaces Clés**

```typescript
interface CommandeService {
  // Crée une nouvelle commande
  creerCommande(tableId: string, items: CommandeItem[]): Promise<Commande>
  
  // Récupère les commandes de la serveuse
  getCommandesServeuse(serveuseId: string): Promise<Commande[]>
  
  // Annule une commande non validée
  annulerCommande(commandeId: string): Promise<void>
}

interface WebSocketService {
  // Établit la connexion WebSocket
  connect(token: string): void
  
  // Écoute un type d'événement
  on(event: string, callback: (data: any) => void): void
  
  // Émet un événement
  emit(event: string, data: any): void
  
  // Ferme la connexion
  disconnect(): void
}
```

### 2. Système Comptoir (Desktop/Tablette)

**Technologies Recommandées**
- React (application web)
- Material-UI pour l'interface
- Socket.io-client pour WebSocket
- React Query pour la gestion des requêtes

**Composants Principaux**

```
SystemeComptoir/
├── screens/
│   ├── LoginScreen
│   ├── ValidationScreen       # Écran principal de validation
│   └── StockScreen            # Vue du stock en temps réel
├── components/
│   ├── CommandeEnAttente      # Carte commande à valider
│   ├── ValidationModal        # Modal de confirmation
│   ├── StockAlert             # Alerte stock bas
│   └── HistoriqueValidations  # Historique des validations
├── services/
│   ├── AuthService
│   ├── ValidationService      # Validation des commandes
│   ├── StockService           # Consultation du stock
│   └── WebSocketService
└── hooks/
    ├── useCommandesEnAttente
    ├── useValidation
    └── useStock
```

**Interfaces Clés**

```typescript
interface ValidationService {
  // Valide une commande
  validerCommande(commandeId: string): Promise<ValidationResult>
  
  // Rejette une commande
  rejeterCommande(commandeId: string, raison: string): Promise<void>
  
  // Récupère les commandes en attente
  getCommandesEnAttente(): Promise<Commande[]>
}

interface ValidationResult {
  success: boolean
  commande: Commande
  stockMisAJour: StockUpdate[]
  mouvementStock: MouvementStock
  error?: string
}
```

### 3. Tableau de Bord Patron (Web/Mobile)

**Technologies Recommandées**
- React (application web responsive)
- Chart.js ou Recharts pour les graphiques
- Material-UI ou Ant Design
- Socket.io-client pour WebSocket

**Composants Principaux**

```
TableauBordPatron/
├── screens/
│   ├── LoginScreen
│   ├── DashboardScreen        # Vue d'ensemble CA/bénéfices
│   ├── StockScreen            # Gestion du stock
│   ├── RavitaillementScreen   # Enregistrement ravitaillements
│   ├── RapportsScreen         # Rapports et exports
│   ├── ProduitsScreen         # Gestion du catalogue
│   ├── UtilisateursScreen     # Gestion des utilisateurs
│   └── TransactionsScreen     # Historique des transactions
├── components/
│   ├── KPICard                # Carte indicateur (CA, bénéfice, etc.)
│   ├── SalesChart             # Graphique des ventes
│   ├── StockTable             # Tableau du stock
│   ├── RavitaillementForm     # Formulaire ravitaillement
│   ├── ProductForm            # Formulaire produit
│   ├── ExportButton           # Bouton d'export
│   └── TransactionList        # Liste des transactions
├── services/
│   ├── AuthService
│   ├── AnalyticsService       # Calculs analytiques
│   ├── StockService           # Gestion du stock
│   ├── RavitaillementService  # Gestion des ravitaillements
│   ├── ProduitService         # Gestion des produits
│   ├── ExportService          # Génération d'exports
│   └── WebSocketService
└── utils/
    ├── dateUtils              # Utilitaires de dates
    ├── calculUtils            # Calculs CA/bénéfices
    └── exportUtils            # Génération CSV/PDF
```

**Interfaces Clés**

```typescript
interface AnalyticsService {
  // Récupère les KPIs pour une période
  getKPIs(debut: Date, fin: Date): Promise<KPIs>
  
  // Récupère les ventes par produit
  getVentesParProduit(debut: Date, fin: Date): Promise<VenteProduit[]>
  
  // Récupère l'évolution du CA
  getEvolutionCA(debut: Date, fin: Date, granularite: 'heure' | 'jour'): Promise<EvolutionCA[]>
}

interface KPIs {
  chiffreAffaires: number
  benefice: number
  nombreCommandes: number
  panierMoyen: number
  produitsVendus: number
}

interface RavitaillementService {
  // Enregistre un nouveau ravitaillement
  creerRavitaillement(ravitaillement: RavitaillementInput): Promise<Ravitaillement>
  
  // Récupère l'historique des ravitaillements
  getHistorique(debut: Date, fin: Date): Promise<Ravitaillement[]>
}

interface ExportService {
  // Exporte les ventes en CSV
  exporterVentesCSV(debut: Date, fin: Date): Promise<Blob>
  
  // Exporte les mouvements de stock en CSV
  exporterStockCSV(debut: Date, fin: Date): Promise<Blob>
  
  // Génère un rapport PDF
  genererRapportPDF(debut: Date, fin: Date): Promise<Blob>
}
```

### 4. Backend API

**Technologies Recommandées**
- Node.js + Express (ou NestJS pour plus de structure)
- Socket.io pour WebSocket
- PostgreSQL pour la base de données
- Redis pour le cache et les sessions
- JWT pour l'authentification
- Prisma ou TypeORM pour l'ORM

**Architecture Backend**

```
Backend/
├── src/
│   ├── controllers/
│   │   ├── AuthController
│   │   ├── CommandeController
│   │   ├── StockController
│   │   ├── RavitaillementController
│   │   ├── ProduitController
│   │   ├── AnalyticsController
│   │   └── ExportController
│   ├── services/
│   │   ├── AuthService
│   │   ├── CommandeService
│   │   ├── StockService
│   │   ├── RavitaillementService
│   │   ├── ProduitService
│   │   ├── AnalyticsService
│   │   ├── SyncService          # Gestion de la synchronisation
│   │   └── AuditService         # Traçabilité
│   ├── websocket/
│   │   ├── WebSocketServer
│   │   ├── EventHandlers
│   │   └── RoomManager          # Gestion des rooms WebSocket
│   ├── middleware/
│   │   ├── authMiddleware
│   │   ├── roleMiddleware
│   │   └── errorMiddleware
│   ├── models/
│   │   ├── User
│   │   ├── Commande
│   │   ├── CommandeItem
│   │   ├── Produit
│   │   ├── Stock
│   │   ├── MouvementStock
│   │   ├── Ravitaillement
│   │   ├── Table
│   │   └── AuditLog
│   ├── repositories/
│   │   ├── CommandeRepository
│   │   ├── StockRepository
│   │   ├── ProduitRepository
│   │   └── AuditRepository
│   └── utils/
│       ├── validation
│       ├── encryption
│       └── retry              # Logique de retry
└── tests/
    ├── unit/
    ├── integration/
    └── properties/            # Tests property-based
```

**Interfaces API REST**

```typescript
// Authentification
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

// Commandes
POST   /api/commandes
GET    /api/commandes
GET    /api/commandes/:id
PUT    /api/commandes/:id/valider
PUT    /api/commandes/:id/rejeter
DELETE /api/commandes/:id

// Stock
GET    /api/stock
GET    /api/stock/:produitId
GET    /api/stock/mouvements

// Ravitaillements
POST   /api/ravitaillements
GET    /api/ravitaillements
GET    /api/ravitaillements/:id

// Produits
POST   /api/produits
GET    /api/produits
GET    /api/produits/:id
PUT    /api/produits/:id
DELETE /api/produits/:id

// Analytics
GET    /api/analytics/kpis?debut=...&fin=...
GET    /api/analytics/ventes-produits?debut=...&fin=...
GET    /api/analytics/evolution-ca?debut=...&fin=...

// Exports
GET    /api/exports/ventes-csv?debut=...&fin=...
GET    /api/exports/stock-csv?debut=...&fin=...
GET    /api/exports/rapport-pdf?debut=...&fin=...

// Factures
GET    /api/factures
GET    /api/factures/:id
GET    /api/factures/commande/:commandeId
GET    /api/factures/impayees
POST   /api/factures/:id/imprimer

// Encaissements
POST   /api/encaissements
GET    /api/encaissements
GET    /api/encaissements/facture/:factureId
GET    /api/encaissements/stats?debut=...&fin=...

// Tables
GET    /api/tables
PUT    /api/tables/:id/statut

// Utilisateurs (admin)
POST   /api/utilisateurs
GET    /api/utilisateurs
PUT    /api/utilisateurs/:id
DELETE /api/utilisateurs/:id
```

## Modèle de Données

### Schéma de Base de Données

```mermaid
erDiagram
    User ||--o{ Commande : "crée"
    User ||--o{ Ravitaillement : "enregistre"
    User ||--o{ Encaissement : "enregistre"
    User ||--o{ AuditLog : "génère"
    
    Commande ||--|{ CommandeItem : "contient"
    Commande }o--|| Table : "associée à"
    Commande }o--|| User : "validée par"
    Commande ||--|| Facture : "génère"
    
    Facture ||--o{ Encaissement : "reçoit"
    
    CommandeItem }o--|| Produit : "référence"
    
    Produit ||--|| Stock : "a"
    Produit ||--o{ MouvementStock : "concerne"
    Produit }o--|| Categorie : "appartient à"
    
    Ravitaillement ||--|{ RavitaillementItem : "contient"
    RavitaillementItem }o--|| Produit : "référence"
    RavitaillementItem ||--|| MouvementStock : "génère"
    
    CommandeItem ||--|| MouvementStock : "génère"
```

### Entités Principales

#### User (Utilisateur)

```typescript
interface User {
  id: string                    // UUID
  email: string                 // Unique
  motDePasse: string            // Hashé (bcrypt)
  nom: string
  prenom: string
  role: 'serveuse' | 'comptoir' | 'gerant' | 'patron'
  actif: boolean
  dateCreation: Date
  derniereConnexion: Date | null
}
```

#### Produit

```typescript
interface Produit {
  id: string                    // UUID
  nom: string
  categorie: string             // 'boisson', 'nourriture', 'autre'
  prixVente: number             // En FCFA
  seuilStockMinimum: number
  actif: boolean                // Produit disponible à la vente
  dateCreation: Date
  dateModification: Date
}
```

#### Stock

```typescript
interface Stock {
  id: string                    // UUID
  produitId: string             // FK vers Produit
  quantiteDisponible: number
  derniereMiseAJour: Date
}
```

#### Commande

```typescript
interface Commande {
  id: string                    // UUID
  numeroCommande: string        // Numéro séquentiel (ex: CMD-20240115-001)
  tableId: string               // FK vers Table
  serveuseId: string            // FK vers User
  statut: 'en_attente' | 'validee' | 'annulee'
  montantTotal: number          // En FCFA
  dateCreation: Date
  dateValidation: Date | null
  validateurId: string | null   // FK vers User (comptoir)
}
```

#### CommandeItem

```typescript
interface CommandeItem {
  id: string                    // UUID
  commandeId: string            // FK vers Commande
  produitId: string             // FK vers Produit
  nomProduit: string            // Snapshot du nom (pour historique)
  prixUnitaire: number          // Snapshot du prix (pour historique)
  quantite: number
  montantLigne: number          // prixUnitaire * quantite
}
```

#### MouvementStock

```typescript
interface MouvementStock {
  id: string                    // UUID
  produitId: string             // FK vers Produit
  type: 'entree' | 'sortie'
  quantite: number
  coutUnitaire: number | null   // Pour les entrées (ravitaillements)
  reference: string             // ID de la commande ou du ravitaillement
  typeReference: 'commande' | 'ravitaillement'
  utilisateurId: string         // FK vers User
  dateCreation: Date
}
```

#### Ravitaillement

```typescript
interface Ravitaillement {
  id: string                    // UUID
  numeroRavitaillement: string  // Numéro séquentiel (ex: RAV-20240115-001)
  fournisseur: string
  dateRavitaillement: Date
  montantTotal: number          // Coût total du ravitaillement
  gerantId: string              // FK vers User
  dateCreation: Date
}
```

#### RavitaillementItem

```typescript
interface RavitaillementItem {
  id: string                    // UUID
  ravitaillementId: string      // FK vers Ravitaillement
  produitId: string             // FK vers Produit
  quantite: number
  coutUnitaire: number          // Coût d'achat unitaire
  montantLigne: number          // coutUnitaire * quantite
}
```

#### Table

```typescript
interface Table {
  id: string                    // UUID
  numero: string                // Numéro de la table (ex: "T1", "T2")
  statut: 'libre' | 'occupee' | 'commande_en_attente'
  derniereMiseAJour: Date
}
```

#### Facture

```typescript
interface Facture {
  id: string                    // UUID
  numeroFacture: string         // Numéro séquentiel (ex: FACT-20240115-001)
  commandeId: string            // FK vers Commande
  montantTotal: number          // Montant total à payer (en FCFA)
  montantPaye: number           // Montant déjà payé (en FCFA)
  montantRestant: number        // Montant restant dû (en FCFA)
  statut: 'en_attente_paiement' | 'partiellement_payee' | 'payee'
  dateGeneration: Date
  datePaiementComplet: Date | null
}
```

#### Encaissement

```typescript
interface Encaissement {
  id: string                    // UUID
  factureId: string             // FK vers Facture
  montant: number               // Montant encaissé (en FCFA)
  modePaiement: 'especes' | 'mobile_money' | 'carte_bancaire'
  reference: string | null      // Référence de transaction (pour mobile money / carte)
  utilisateurId: string         // FK vers User (comptoir)
  dateEncaissement: Date
}
```

#### AuditLog

```typescript
interface AuditLog {
  id: string                    // UUID
  utilisateurId: string         // FK vers User
  action: string                // Type d'action (ex: 'commande.created', 'stock.updated')
  entite: string                // Type d'entité concernée
  entiteId: string              // ID de l'entité
  detailsAvant: object | null   // État avant modification (JSON)
  detailsApres: object          // État après modification (JSON)
  adresseIP: string
  dateCreation: Date
}
```

### Contraintes d'Intégrité

**Contraintes de Base de Données**

1. **Unicité**
   - `User.email` : UNIQUE
   - `Produit.nom` : UNIQUE
   - `Table.numero` : UNIQUE
   - `Commande.numeroCommande` : UNIQUE
   - `Ravitaillement.numeroRavitaillement` : UNIQUE
   - `Facture.numeroFacture` : UNIQUE

2. **Clés Étrangères avec CASCADE**
   - `CommandeItem.commandeId` → `Commande.id` (ON DELETE CASCADE)
   - `RavitaillementItem.ravitaillementId` → `Ravitaillement.id` (ON DELETE CASCADE)
   - `Stock.produitId` → `Produit.id` (ON DELETE CASCADE)
   - `Facture.commandeId` → `Commande.id` (ON DELETE RESTRICT)
   - `Encaissement.factureId` → `Facture.id` (ON DELETE RESTRICT)

3. **Contraintes de Validation**
   - `Stock.quantiteDisponible` >= 0
   - `Produit.prixVente` > 0
   - `Produit.seuilStockMinimum` >= 0
   - `CommandeItem.quantite` > 0
   - `RavitaillementItem.quantite` > 0
   - `Facture.montantPaye` >= 0
   - `Facture.montantPaye` <= `Facture.montantTotal`
   - `Facture.montantRestant` = `Facture.montantTotal` - `Facture.montantPaye`
   - `Encaissement.montant` > 0

4. **Index pour Performance**
   - Index sur `Commande.serveuseId`
   - Index sur `Commande.dateCreation`
   - Index sur `MouvementStock.produitId`
   - Index sur `MouvementStock.dateCreation`
   - Index sur `AuditLog.utilisateurId`
   - Index sur `AuditLog.dateCreation`
   - Index sur `Facture.commandeId`
   - Index sur `Facture.statut`
   - Index sur `Facture.dateGeneration`
   - Index sur `Encaissement.factureId`
   - Index sur `Encaissement.dateEncaissement`

### Règles Métier au Niveau Base de Données

**Triggers PostgreSQL**

1. **Trigger : Mise à jour automatique du stock**
   - Après insertion dans `CommandeItem` (commande validée) → Décrémenter `Stock.quantiteDisponible`
   - Après insertion dans `RavitaillementItem` → Incrémenter `Stock.quantiteDisponible`

2. **Trigger : Génération des numéros séquentiels**
   - Avant insertion dans `Commande` → Générer `numeroCommande`
   - Avant insertion dans `Ravitaillement` → Générer `numeroRavitaillement`
   - Avant insertion dans `Facture` → Générer `numeroFacture`

3. **Trigger : Génération automatique de facture**
   - Après validation d'une commande (statut = 'validee') → Créer une facture avec statut 'en_attente_paiement'

4. **Trigger : Mise à jour du statut de facture**
   - Après insertion dans `Encaissement` → Mettre à jour `Facture.montantPaye`, `Facture.montantRestant`, et `Facture.statut`
   - Si `montantRestant` = 0 → statut = 'payee' et `datePaiementComplet` = NOW()
   - Si 0 < `montantRestant` < `montantTotal` → statut = 'partiellement_payee'

5. **Trigger : Audit automatique**
   - Après UPDATE sur tables critiques → Créer entrée dans `AuditLog`

## Sécurité

### Authentification et Autorisation

**Mécanisme d'Authentification**

- **JWT (JSON Web Tokens)** pour l'authentification stateless
- **Durée de vie** : 8 heures (durée d'un service typique)
- **Refresh tokens** : 7 jours pour renouvellement automatique
- **Stockage** : 
  - Mobile : Secure Storage (Keychain iOS / Keystore Android)
  - Web : HttpOnly cookies

**Hashage des Mots de Passe**

- Algorithme : **bcrypt** avec salt rounds = 12
- Politique de mots de passe : Minimum 8 caractères

**Contrôle d'Accès Basé sur les Rôles (RBAC)**

| Rôle | Permissions |
|------|-------------|
| **Serveuse** | Créer commandes, Voir ses commandes, Gérer statut tables |
| **Comptoir** | Valider/Rejeter commandes, Voir stock en temps réel |
| **Gérant** | Toutes permissions Comptoir + Enregistrer ravitaillements, Gérer produits, Voir rapports |
| **Patron** | Toutes permissions + Gérer utilisateurs, Accès complet analytics, Exports |

**Middleware de Vérification**

```typescript
interface AuthMiddleware {
  // Vérifie la validité du token JWT
  verifyToken(req, res, next): void
  
  // Vérifie que l'utilisateur a le rôle requis
  requireRole(roles: string[]): Middleware
  
  // Vérifie que l'utilisateur accède à ses propres ressources
  requireOwnership(resourceType: string): Middleware
}
```

### Protection des Données

**Chiffrement**

- **En transit** : TLS 1.3 pour toutes les communications (HTTPS + WSS)
- **Au repos** : Chiffrement de la base de données PostgreSQL (AES-256)
- **Données sensibles** : Mots de passe hashés avec bcrypt

**Validation des Entrées**

- Validation côté client (UX)
- **Validation stricte côté serveur** (sécurité)
- Utilisation de bibliothèques de validation (Joi, Yup, ou Zod)
- Protection contre les injections SQL (ORM avec requêtes paramétrées)
- Sanitization des entrées utilisateur

**Protection contre les Attaques**

1. **Injection SQL** : Utilisation d'ORM avec requêtes paramétrées
2. **XSS** : Sanitization des entrées, Content Security Policy
3. **CSRF** : Tokens CSRF pour les requêtes modifiant l'état
4. **Rate Limiting** : Limitation du nombre de requêtes par IP/utilisateur
5. **Brute Force** : Verrouillage temporaire après 5 tentatives échouées

### Audit et Traçabilité

**Journalisation Complète**

- Toutes les actions utilisateur enregistrées dans `AuditLog`
- Informations enregistrées :
  - Qui (utilisateurId)
  - Quoi (action, entité, détails)
  - Quand (dateCreation)
  - D'où (adresseIP)
  - État avant/après (pour les modifications)

**Immutabilité des Données Critiques**

- Les commandes validées ne peuvent pas être modifiées ou supprimées
- Les mouvements de stock sont immuables
- Soft delete pour les produits (flag `actif` au lieu de suppression)

**Rétention des Logs**

- Logs d'audit : Conservation 2 ans minimum
- Logs applicatifs : Conservation 90 jours
- Rotation automatique des logs


## Propriétés de Correction

### Introduction aux Propriétés

Une propriété est une caractéristique ou un comportement qui doit être vrai pour toutes les exécutions valides d'un système - essentiellement, une déclaration formelle sur ce que le système doit faire. Les propriétés servent de pont entre les spécifications lisibles par l'homme et les garanties de correction vérifiables par machine.

Les propriétés suivantes sont dérivées des critères d'acceptation des exigences et seront implémentées sous forme de tests property-based pour valider la correction du système.

### Réflexion sur les Redondances

Après analyse des 60 critères d'acceptation, plusieurs redondances ont été identifiées :

- **Critères 3.2 et 2.2** : Les deux testent la déduction du stock lors de la validation d'une commande
- **Critères 4.3 et 3.1** : Les deux testent l'ajout au stock lors d'un ravitaillement
- **Critères 7.2, 7.3, 7.4** : Peuvent être combinés en une seule propriété de contrôle d'accès basé sur les rôles

Ces redondances seront éliminées dans les propriétés ci-dessous pour éviter les tests dupliqués.

### Propriétés de Gestion des Commandes

**Propriété 1 : Unicité des identifiants de commande**
*Pour toute* commande créée dans le système, l'identifiant généré doit être unique et ne jamais être réutilisé pour une autre commande.
**Valide : Exigence 1.1**

**Propriété 2 : Complétude des données de commande**
*Pour toute* commande créée, le système doit enregistrer tous les champs obligatoires : horodatage de création, identifiant de table, identifiant de serveuse, et liste des produits avec quantités.
**Valide : Exigence 1.3**

**Propriété 3 : Filtrage des produits disponibles**
*Pour tout* produit affiché dans l'interface de commande, la quantité en stock doit être strictement supérieure à zéro.
**Valide : Exigence 1.5**

**Propriété 4 : Déduction automatique du stock**
*Pour toute* commande validée, la quantité de chaque produit dans le stock officiel doit être décrémentée exactement de la quantité commandée.
**Valide : Exigences 2.2, 3.2**

**Propriété 5 : Création de mouvement de stock pour les ventes**
*Pour toute* commande validée, le système doit créer un mouvement de stock de type "sortie" avec horodatage, quantité, et référence à la commande.
**Valide : Exigence 2.3**


**Propriété 6 : Rejet des commandes avec stock insuffisant**
*Pour toute* commande dont au moins un produit a une quantité demandée supérieure au stock disponible, la validation doit être rejetée et le stock doit rester inchangé.
**Valide : Exigence 2.4**

**Propriété 7 : Calcul correct du montant total**
*Pour toute* commande, le montant total doit être égal à la somme des (prix unitaire × quantité) de tous les produits de la commande.
**Valide : Exigence 9.4**

**Propriété 8 : Annulation de commande non soumise**
*Pour toute* commande annulée avant soumission, aucun enregistrement ne doit être créé dans la base de données et aucun mouvement de stock ne doit être généré.
**Valide : Exigence 9.5**

### Propriétés de Gestion du Stock

**Propriété 9 : Incrémentation du stock lors des ravitaillements**
*Pour tout* ravitaillement enregistré, la quantité de chaque produit dans le stock officiel doit être incrémentée exactement de la quantité ravitaillée.
**Valide : Exigences 3.1, 4.3**

**Propriété 10 : Génération d'alertes de stock bas**
*Pour tout* produit dont la quantité en stock devient inférieure ou égale au seuil minimum défini, le système doit générer une alerte de stock bas.
**Valide : Exigence 3.4**

**Propriété 11 : Complétude des mouvements de stock**
*Pour tout* mouvement de stock enregistré, les champs obligatoires doivent être présents : horodatage, type (entrée/sortie), quantité, produit concerné, et utilisateur responsable.
**Valide : Exigence 3.5**

**Propriété 12 : Non-négativité du stock**
*Pour tout* produit à tout moment, la quantité en stock doit être supérieure ou égale à zéro (invariant du système).
**Valide : Contrainte d'intégrité métier**

### Propriétés de Gestion des Ravitaillements

**Propriété 13 : Validation des données de ravitaillement**
*Pour tout* ravitaillement soumis, le système doit rejeter la création si l'un des champs obligatoires est manquant : fournisseur, date, produits, quantités, ou coûts unitaires.
**Valide : Exigences 4.1, 4.4**

**Propriété 14 : Création de mouvement de stock pour les ravitaillements**
*Pour tout* ravitaillement enregistré, le système doit créer un mouvement de stock de type "entrée" pour chaque produit ravitaillé avec la quantité et le coût unitaire.
**Valide : Exigence 4.2**

**Propriété 15 : Filtrage des ravitaillements par période**
*Pour toute* requête de consultation de l'historique des ravitaillements avec une période [début, fin], tous les ravitaillements retournés doivent avoir une date comprise dans cet intervalle.
**Valide : Exigence 4.5**


### Propriétés d'Analytique et Rapports

**Propriété 16 : Calcul du chiffre d'affaires**
*Pour toute* période donnée, le chiffre d'affaires calculé doit être égal à la somme des montants totaux de toutes les commandes validées dans cette période.
**Valide : Exigence 5.1**

**Propriété 17 : Calcul du bénéfice**
*Pour toute* période donnée, le bénéfice calculé doit être égal au chiffre d'affaires moins la somme des coûts d'achat de tous les produits vendus dans cette période.
**Valide : Exigence 5.2**

**Propriété 18 : Filtrage des analyses par période**
*Pour toute* requête d'analyse avec une période [début, fin], toutes les données retournées (ventes, commandes, mouvements) doivent avoir un horodatage compris dans cet intervalle.
**Valide : Exigence 5.3**

**Propriété 19 : Agrégation des ventes par produit**
*Pour toute* période donnée, la somme des quantités vendues par produit doit être égale à la somme des quantités de ce produit dans toutes les commandes validées de la période.
**Valide : Exigence 5.4**

**Propriété 20 : Comptage des commandes par période**
*Pour toute* période donnée, le nombre de commandes retourné doit être égal au nombre exact de commandes validées dont l'horodatage de validation est dans la période.
**Valide : Exigence 5.5**

### Propriétés de Synchronisation

**Propriété 21 : Synchronisation des commandes en temps réel**
*Pour toute* commande créée sur l'application serveuse, le système comptoir doit recevoir la notification dans un délai maximum de 2 secondes.
**Valide : Exigences 1.2, 6.1**

**Propriété 22 : Synchronisation des validations en temps réel**
*Pour toute* commande validée au comptoir, toutes les applications connectées (serveuse, tableau de bord) doivent recevoir la mise à jour du stock dans un délai maximum de 2 secondes.
**Valide : Exigences 2.5, 6.2**

**Propriété 23 : Synchronisation des ravitaillements en temps réel**
*Pour tout* ravitaillement enregistré, toutes les applications connectées doivent recevoir la mise à jour du stock dans un délai maximum de 2 secondes.
**Valide : Exigence 6.3**

**Propriété 24 : Mécanisme de retry avec délai exponentiel**
*Pour toute* tentative de synchronisation échouée, le système doit réessayer automatiquement jusqu'à 3 fois avec des délais exponentiels (1s, 2s, 4s).
**Valide : Exigence 6.4**


### Propriétés de Sécurité et Contrôle d'Accès

**Propriété 25 : Authentification obligatoire**
*Pour toute* tentative d'accès au système, l'utilisateur doit fournir des identifiants valides (email + mot de passe) avant d'obtenir un token d'accès.
**Valide : Exigence 7.1**

**Propriété 26 : Contrôle d'accès basé sur les rôles (RBAC)**
*Pour tout* utilisateur authentifié, les endpoints et fonctionnalités accessibles doivent correspondre exactement aux permissions définies pour son rôle (serveuse, comptoir, gérant, patron).
**Valide : Exigences 7.2, 7.3, 7.4**

**Propriété 27 : Traçabilité des actions utilisateur**
*Pour toute* action modifiant l'état du système (création, modification, suppression), un enregistrement d'audit doit être créé avec l'identifiant utilisateur, l'horodatage, et les détails de l'action.
**Valide : Exigence 7.5**

### Propriétés de Traçabilité

**Propriété 28 : Complétude des données de traçabilité**
*Pour toute* commande validée, les informations de traçabilité complètes doivent être enregistrées : serveuse responsable, table, heure de création, heure de validation, et validateur au comptoir.
**Valide : Exigence 8.1**

**Propriété 29 : Unicité des numéros de transaction**
*Pour toute* commande validée, le numéro de transaction généré doit être unique dans tout le système et ne jamais être réutilisé.
**Valide : Exigence 8.2**

**Propriété 30 : Immutabilité des commandes validées**
*Pour toute* commande dont le statut est "validée", toute tentative de modification ou de suppression doit être rejetée par le système.
**Valide : Exigence 8.3**

**Propriété 31 : Recherche de transactions**
*Pour toute* recherche de transactions avec des critères (date, serveuse, table, produit), tous les résultats retournés doivent correspondre exactement aux critères spécifiés.
**Valide : Exigence 8.5**

### Propriétés de Gestion des Tables

**Propriété 32 : Changement d'état lors de la création de commande**
*Pour toute* commande créée pour une table, le statut de la table doit passer à "commande_en_attente" immédiatement après la création.
**Valide : Exigence 10.2**

**Propriété 33 : Changement d'état lors de la validation**
*Pour toute* commande validée, le statut de la table associée doit passer à "occupee" immédiatement après la validation.
**Valide : Exigence 10.3**

**Propriété 34 : Libération manuelle des tables**
*Pour toute* table marquée comme "libre" par une serveuse, le statut doit être mis à jour et la table doit être disponible pour de nouvelles commandes.
**Valide : Exigence 10.4**

**Propriété 35 : Commandes multiples par table**
*Pour toute* table, le système doit permettre la création de plusieurs commandes successives tant que la table n'est pas marquée comme "libre".
**Valide : Exigence 10.5**


### Propriétés d'Export et Rapports

**Propriété 36 : Complétude des exports CSV de ventes**
*Pour tout* export CSV de ventes généré pour une période, toutes les commandes validées de cette période doivent être présentes dans le fichier avec toutes leurs informations.
**Valide : Exigence 11.1**

**Propriété 37 : Complétude des exports CSV de mouvements de stock**
*Pour tout* export CSV de mouvements de stock généré pour une période, tous les mouvements de cette période doivent être présents dans le fichier avec toutes leurs informations.
**Valide : Exigence 11.2**

**Propriété 38 : Génération de rapport PDF**
*Pour tout* rapport PDF généré pour une période, le fichier doit contenir les KPIs calculés (CA, bénéfice, nombre de commandes) et être un PDF valide.
**Valide : Exigence 11.3**

**Propriété 39 : Métadonnées des exports**
*Pour tout* export généré (CSV ou PDF), le fichier doit inclure la période sélectionnée et la date/heure de génération dans les métadonnées ou en-tête.
**Valide : Exigence 11.5**

### Propriétés de Gestion des Produits

**Propriété 40 : Validation des données de produit**
*Pour tout* nouveau produit créé, le système doit rejeter la création si l'un des champs obligatoires est manquant : nom, catégorie, prix de vente, ou seuil de stock minimum.
**Valide : Exigence 12.1**

**Propriété 41 : Modification des produits**
*Pour tout* produit existant, les modifications apportées (nom, prix, seuil) doivent être appliquées immédiatement et visibles dans toutes les applications.
**Valide : Exigence 12.2**

**Propriété 42 : Désactivation sans suppression (soft delete)**
*Pour tout* produit désactivé, le champ "actif" doit être mis à false, mais l'enregistrement doit rester dans la base de données avec tout son historique de mouvements de stock.
**Valide : Exigence 12.3**

**Propriété 43 : Exclusion des produits inactifs**
*Pour tout* produit dont le champ "actif" est false, ce produit ne doit pas apparaître dans l'interface de commande des serveuses.
**Valide : Exigence 12.4**

**Propriété 44 : Audit des modifications de produits**
*Pour toute* modification apportée à un produit (création, modification, désactivation), un enregistrement d'audit doit être créé avec l'horodatage, l'utilisateur responsable, et les valeurs avant/après.
**Valide : Exigence 12.5**

### Propriétés de Gestion des Factures et Encaissements

**Propriété 47 : Génération automatique de facture**
*Pour toute* commande validée, une facture doit être générée automatiquement avec un numéro unique et le statut "en_attente_paiement".
**Valide : Exigence 13.1**

**Propriété 48 : Unicité des numéros de facture**
*Pour toute* facture créée dans le système, le numéro de facture généré doit être unique et ne jamais être réutilisé.
**Valide : Exigence 13.1**

**Propriété 49 : Complétude des données de facture**
*Pour toute* facture générée, les champs obligatoires doivent être présents : montant total, date de génération, et référence à la commande associée.
**Valide : Exigence 13.2**

**Propriété 50 : Validation des données d'encaissement**
*Pour tout* encaissement soumis, le système doit rejeter la création si l'un des champs obligatoires est manquant : facture concernée, montant payé, ou mode de paiement.
**Valide : Exigence 14.1**

**Propriété 51 : Mise à jour du statut de facture après encaissement total**
*Pour toute* facture dont le montant total a été encaissé, le statut doit être mis à jour à "payee" et la date de paiement complet doit être enregistrée.
**Valide : Exigence 14.2**

**Propriété 52 : Mise à jour du statut de facture après encaissement partiel**
*Pour toute* facture ayant reçu un encaissement partiel, le statut doit être "partiellement_payee" et le montant restant dû doit être calculé correctement.
**Valide : Exigence 14.3**

**Propriété 53 : Traçabilité des encaissements**
*Pour tout* encaissement enregistré, l'horodatage et l'identifiant de l'utilisateur responsable doivent être enregistrés.
**Valide : Exigence 14.4**

**Propriété 54 : Distinction CA et encaissements**
*Pour toute* période donnée, le chiffre d'affaires (somme des commandes validées) et les encaissements (somme des paiements reçus) doivent être calculés séparément et correctement.
**Valide : Exigence 15.1**

**Propriété 55 : Calcul des créances**
*Pour toute* période donnée, le montant des créances doit être égal au chiffre d'affaires moins les encaissements.
**Valide : Exigence 15.2**

**Propriété 56 : Génération d'alerte pour factures impayées**
*Pour toute* facture restant impayée pendant plus de 24 heures, le système doit générer une alerte visible dans le tableau de bord patron.
**Valide : Exigence 15.5**

### Propriétés Transversales (Invariants du Système)

**Propriété 45 : Cohérence du stock (invariant)**
*À tout moment*, pour tout produit, la quantité en stock doit être égale à la somme des entrées (ravitaillements) moins la somme des sorties (ventes validées).
**Valide : Cohérence globale du système**

**Propriété 46 : Cohérence des montants (invariant)**
*Pour toute* commande, la somme des montants des lignes de commande (CommandeItem.montantLigne) doit être égale au montant total de la commande.
**Valide : Cohérence des calculs**

**Propriété 57 : Cohérence facture-commande (invariant)**
*Pour toute* facture, le montant total de la facture doit être égal au montant total de la commande associée.
**Valide : Cohérence des données**

**Propriété 58 : Cohérence des encaissements (invariant)**
*Pour toute* facture, la somme des montants de tous les encaissements associés doit être égale au montant payé de la facture.
**Valide : Cohérence des paiements**


## Gestion des Erreurs

### Stratégie Globale

Le système adopte une approche défensive avec gestion explicite des erreurs à tous les niveaux :

1. **Validation côté client** : Feedback immédiat à l'utilisateur (UX)
2. **Validation côté serveur** : Sécurité et intégrité des données
3. **Gestion des erreurs réseau** : Retry automatique et notifications
4. **Logging centralisé** : Traçabilité de toutes les erreurs

### Types d'Erreurs et Gestion

#### Erreurs de Validation

**Cas d'usage** : Données invalides soumises par l'utilisateur

**Exemples** :
- Commande avec quantité négative
- Produit sans nom ou prix
- Ravitaillement sans fournisseur

**Gestion** :
- Code HTTP : 400 Bad Request
- Réponse JSON structurée avec détails de l'erreur
- Message d'erreur clair affiché à l'utilisateur
- Aucune modification de l'état du système

```typescript
interface ValidationError {
  code: 'VALIDATION_ERROR'
  message: string
  field: string
  value: any
}
```

#### Erreurs Métier

**Cas d'usage** : Violation des règles métier

**Exemples** :
- Stock insuffisant pour valider une commande
- Tentative de modification d'une commande validée
- Tentative d'accès à une ressource non autorisée

**Gestion** :
- Code HTTP : 422 Unprocessable Entity ou 403 Forbidden
- Message d'erreur explicite
- Logging de la tentative
- État du système préservé

```typescript
interface BusinessError {
  code: 'INSUFFICIENT_STOCK' | 'IMMUTABLE_RESOURCE' | 'UNAUTHORIZED_ACCESS'
  message: string
  details?: object
}
```

#### Erreurs de Synchronisation

**Cas d'usage** : Échec de la synchronisation en temps réel

**Exemples** :
- Perte de connexion WebSocket
- Timeout de synchronisation
- Échec après 3 tentatives de retry

**Gestion** :
- Retry automatique avec délai exponentiel (1s, 2s, 4s)
- Mise en file d'attente locale des événements non synchronisés
- Notification à l'administrateur après échecs multiples
- Réconciliation automatique au retour de la connexion

```typescript
interface SyncError {
  code: 'SYNC_FAILED'
  message: string
  event: string
  attemptCount: number
  nextRetryIn?: number
}
```

#### Erreurs Système

**Cas d'usage** : Erreurs techniques inattendues

**Exemples** :
- Erreur de base de données
- Erreur de serveur interne
- Timeout de requête

**Gestion** :
- Code HTTP : 500 Internal Server Error
- Message générique à l'utilisateur (pas de détails techniques)
- Logging détaillé côté serveur avec stack trace
- Notification immédiate à l'équipe technique
- Rollback des transactions en cours

```typescript
interface SystemError {
  code: 'INTERNAL_ERROR'
  message: string
  requestId: string  // Pour traçabilité
}
```

### Codes d'Erreur Standardisés

| Code | Description | Action Utilisateur |
|------|-------------|-------------------|
| `VALIDATION_ERROR` | Données invalides | Corriger les données |
| `INSUFFICIENT_STOCK` | Stock insuffisant | Réduire la quantité ou choisir autre produit |
| `IMMUTABLE_RESOURCE` | Ressource non modifiable | Aucune action possible |
| `UNAUTHORIZED_ACCESS` | Accès non autorisé | Vérifier les permissions |
| `SYNC_FAILED` | Échec de synchronisation | Attendre la reconnexion |
| `NETWORK_ERROR` | Erreur réseau | Vérifier la connexion |
| `INTERNAL_ERROR` | Erreur système | Contacter le support |
| `RESOURCE_NOT_FOUND` | Ressource introuvable | Vérifier l'identifiant |
| `DUPLICATE_RESOURCE` | Ressource déjà existante | Utiliser un autre identifiant |

### Logging et Monitoring

**Niveaux de Log**

- **ERROR** : Erreurs système nécessitant une intervention
- **WARN** : Situations anormales mais gérées (ex: retry de sync)
- **INFO** : Événements importants (ex: commande validée)
- **DEBUG** : Informations détaillées pour le développement

**Informations Loggées**

```typescript
interface LogEntry {
  level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG'
  timestamp: Date
  requestId: string
  userId?: string
  action: string
  message: string
  error?: Error
  context?: object
}
```

**Alertes Automatiques**

- Échec de synchronisation après 3 tentatives → Email au gérant
- Erreur système critique → SMS au support technique
- Stock bas → Notification dans le tableau de bord patron
- Tentative d'accès non autorisé → Log d'audit + alerte sécurité


## Stratégie de Test

### Approche Duale : Tests Unitaires + Tests Property-Based

Le système sera validé par une approche complémentaire combinant tests unitaires et tests property-based (PBT) :

- **Tests unitaires** : Valident des exemples spécifiques, cas limites, et conditions d'erreur
- **Tests property-based** : Valident les propriétés universelles sur des milliers d'entrées générées aléatoirement
- **Ensemble** : Couverture complète (tests unitaires détectent les bugs concrets, tests property-based vérifient la correction générale)

### Configuration des Tests Property-Based

**Bibliothèque Recommandée**

Pour un backend Node.js/TypeScript :
- **fast-check** : Bibliothèque PBT mature pour JavaScript/TypeScript
- Installation : `npm install --save-dev fast-check`

**Configuration Standard**

```typescript
import fc from 'fast-check'

// Configuration globale
const PBT_CONFIG = {
  numRuns: 100,        // Minimum 100 itérations par test
  seed: Date.now(),    // Seed aléatoire pour reproductibilité
  verbose: true        // Affichage détaillé en cas d'échec
}
```

**Format des Tags**

Chaque test property-based DOIT être tagué avec un commentaire référençant la propriété du design :

```typescript
// Feature: snack-bar-management, Property 1: Unicité des identifiants de commande
test('Les identifiants de commande doivent être uniques', () => {
  fc.assert(
    fc.property(
      fc.array(commandeArbitrary, { minLength: 2, maxLength: 100 }),
      (commandes) => {
        const ids = commandes.map(c => c.id)
        const uniqueIds = new Set(ids)
        return ids.length === uniqueIds.size
      }
    ),
    PBT_CONFIG
  )
})
```

### Générateurs (Arbitraries) pour Property-Based Testing

**Générateurs de Base**

```typescript
// Générateur d'UUID
const uuidArbitrary = fc.uuid()

// Générateur de prix (en FCFA, multiples de 25)
const prixArbitrary = fc.integer({ min: 25, max: 50000 })
  .map(n => Math.round(n / 25) * 25)

// Générateur de quantité
const quantiteArbitrary = fc.integer({ min: 1, max: 100 })

// Générateur de date récente
const dateRecenteArbitrary = fc.date({
  min: new Date('2024-01-01'),
  max: new Date('2024-12-31')
})

// Générateur de rôle utilisateur
const roleArbitrary = fc.constantFrom(
  'serveuse', 'comptoir', 'gerant', 'patron'
)

// Générateur de catégorie produit
const categorieArbitrary = fc.constantFrom(
  'boisson', 'nourriture', 'autre'
)
```

**Générateurs d'Entités**

```typescript
// Générateur de Produit
const produitArbitrary = fc.record({
  id: uuidArbitrary,
  nom: fc.string({ minLength: 3, maxLength: 50 }),
  categorie: categorieArbitrary,
  prixVente: prixArbitrary,
  seuilStockMinimum: fc.integer({ min: 0, max: 50 }),
  actif: fc.boolean()
})

// Générateur de CommandeItem
const commandeItemArbitrary = fc.record({
  id: uuidArbitrary,
  produitId: uuidArbitrary,
  nomProduit: fc.string({ minLength: 3, maxLength: 50 }),
  prixUnitaire: prixArbitrary,
  quantite: quantiteArbitrary
}).map(item => ({
  ...item,
  montantLigne: item.prixUnitaire * item.quantite
}))

// Générateur de Commande
const commandeArbitrary = fc.record({
  id: uuidArbitrary,
  numeroCommande: fc.string({ minLength: 10, maxLength: 20 }),
  tableId: uuidArbitrary,
  serveuseId: uuidArbitrary,
  statut: fc.constantFrom('en_attente', 'validee', 'annulee'),
  items: fc.array(commandeItemArbitrary, { minLength: 1, maxLength: 10 }),
  dateCreation: dateRecenteArbitrary
}).map(cmd => ({
  ...cmd,
  montantTotal: cmd.items.reduce((sum, item) => sum + item.montantLigne, 0)
}))

// Générateur de Stock
const stockArbitrary = fc.record({
  id: uuidArbitrary,
  produitId: uuidArbitrary,
  quantiteDisponible: fc.integer({ min: 0, max: 1000 })
})
```

### Exemples de Tests Property-Based

**Exemple 1 : Propriété 4 - Déduction automatique du stock**

```typescript
// Feature: snack-bar-management, Property 4: Déduction automatique du stock
test('La validation d\'une commande déduit correctement le stock', () => {
  fc.assert(
    fc.property(
      commandeArbitrary,
      stockArbitrary,
      async (commande, stockInitial) => {
        // Arrange : Stock initial suffisant
        const stockAvant = { ...stockInitial, quantiteDisponible: 100 }
        await stockRepository.save(stockAvant)
        
        // Act : Valider la commande
        await commandeService.validerCommande(commande.id)
        
        // Assert : Stock déduit correctement
        const stockApres = await stockRepository.findByProduitId(stockAvant.produitId)
        const quantiteCommandee = commande.items
          .filter(item => item.produitId === stockAvant.produitId)
          .reduce((sum, item) => sum + item.quantite, 0)
        
        return stockApres.quantiteDisponible === 
               stockAvant.quantiteDisponible - quantiteCommandee
      }
    ),
    PBT_CONFIG
  )
})
```

**Exemple 2 : Propriété 12 - Non-négativité du stock**

```typescript
// Feature: snack-bar-management, Property 12: Non-négativité du stock
test('Le stock ne peut jamais être négatif', () => {
  fc.assert(
    fc.property(
      fc.array(commandeArbitrary, { minLength: 1, maxLength: 50 }),
      fc.array(ravitaillementArbitrary, { minLength: 1, maxLength: 20 }),
      async (commandes, ravitaillements) => {
        // Arrange : Initialiser avec ravitaillements
        for (const rav of ravitaillements) {
          await ravitaillementService.creer(rav)
        }
        
        // Act : Valider toutes les commandes possibles
        for (const cmd of commandes) {
          try {
            await commandeService.validerCommande(cmd.id)
          } catch (e) {
            // Ignorer les rejets pour stock insuffisant
          }
        }
        
        // Assert : Tous les stocks >= 0
        const stocks = await stockRepository.findAll()
        return stocks.every(s => s.quantiteDisponible >= 0)
      }
    ),
    PBT_CONFIG
  )
})
```

**Exemple 3 : Propriété 45 - Cohérence du stock (invariant)**

```typescript
// Feature: snack-bar-management, Property 45: Cohérence du stock
test('Le stock est toujours égal aux entrées moins les sorties', () => {
  fc.assert(
    fc.property(
      fc.array(mouvementStockArbitrary, { minLength: 10, maxLength: 100 }),
      async (mouvements) => {
        // Arrange : Appliquer tous les mouvements
        const produitId = fc.sample(uuidArbitrary, 1)[0]
        for (const mvt of mouvements) {
          await mouvementStockRepository.save({ ...mvt, produitId })
        }
        
        // Act : Calculer le stock théorique
        const entrees = mouvements
          .filter(m => m.type === 'entree')
          .reduce((sum, m) => sum + m.quantite, 0)
        const sorties = mouvements
          .filter(m => m.type === 'sortie')
          .reduce((sum, m) => sum + m.quantite, 0)
        const stockTheorique = entrees - sorties
        
        // Assert : Stock réel = stock théorique
        const stock = await stockRepository.findByProduitId(produitId)
        return stock.quantiteDisponible === stockTheorique
      }
    ),
    PBT_CONFIG
  )
})
```

### Tests Unitaires Complémentaires

Les tests unitaires se concentrent sur :

1. **Exemples spécifiques** : Cas d'usage concrets avec données réalistes
2. **Cas limites** : Valeurs extrêmes (0, MAX_INT, chaînes vides)
3. **Conditions d'erreur** : Validation des messages d'erreur et codes HTTP
4. **Intégration** : Points de connexion entre composants

**Exemple de Test Unitaire**

```typescript
describe('CommandeService', () => {
  describe('validerCommande', () => {
    it('devrait rejeter une commande avec stock insuffisant', async () => {
      // Arrange
      const produit = await createProduit({ nom: 'Coca-Cola' })
      await createStock({ produitId: produit.id, quantite: 5 })
      const commande = await createCommande({
        items: [{ produitId: produit.id, quantite: 10 }]
      })
      
      // Act & Assert
      await expect(
        commandeService.validerCommande(commande.id)
      ).rejects.toThrow('Stock insuffisant')
      
      // Vérifier que le stock n'a pas changé
      const stock = await stockRepository.findByProduitId(produit.id)
      expect(stock.quantiteDisponible).toBe(5)
    })
  })
})
```

### Couverture de Test

**Objectifs de Couverture**

- **Couverture de code** : Minimum 80% (lignes, branches)
- **Couverture des propriétés** : 100% des 46 propriétés testées
- **Couverture des exigences** : 100% des critères d'acceptation validés

**Outils de Mesure**

- Jest avec coverage : `jest --coverage`
- Rapport HTML généré automatiquement
- Intégration CI/CD pour bloquer les PR avec couverture < 80%

### Stratégie d'Exécution

**Développement Local**

- Tests unitaires : Exécution rapide à chaque modification
- Tests property-based : Exécution avant chaque commit

**CI/CD Pipeline**

1. **Phase 1** : Tests unitaires (rapides)
2. **Phase 2** : Tests property-based (plus longs)
3. **Phase 3** : Tests d'intégration
4. **Phase 4** : Génération du rapport de couverture

**Fréquence**

- À chaque commit : Tests unitaires
- À chaque PR : Suite complète (unitaires + PBT + intégration)
- Nightly : Suite complète avec 1000 itérations PBT (au lieu de 100)


## Choix Technologiques Recommandés

### Stack Technique Complète

#### Backend

**Runtime et Framework**
- **Node.js 20 LTS** : Runtime JavaScript côté serveur
- **NestJS** : Framework structuré avec TypeScript, DI, et architecture modulaire
- Alternative : Express.js (plus léger mais moins structuré)

**Base de Données**
- **PostgreSQL 15+** : Base de données relationnelle robuste
  - Support natif des transactions ACID
  - Triggers et contraintes d'intégrité
  - Performance excellente pour les requêtes analytiques
- **Redis 7+** : Cache en mémoire et gestion des sessions
  - Cache des données fréquemment accédées (stock, produits)
  - Gestion des sessions utilisateur
  - Pub/Sub pour la synchronisation

**ORM et Migrations**
- **Prisma** : ORM moderne avec génération de types TypeScript
- Alternative : TypeORM (plus mature mais moins type-safe)

**Authentification**
- **Passport.js** : Middleware d'authentification flexible
- **jsonwebtoken** : Génération et validation de JWT
- **bcrypt** : Hashage des mots de passe

**WebSocket**
- **Socket.io** : Bibliothèque WebSocket avec fallback automatique
  - Reconnexion automatique
  - Gestion des rooms pour broadcast sélectif
  - Support des événements typés

**Validation**
- **Zod** : Validation de schémas avec inférence de types TypeScript
- Alternative : Joi, Yup

**Tests**
- **Jest** : Framework de test avec mocking intégré
- **fast-check** : Property-based testing
- **Supertest** : Tests d'API HTTP

#### Frontend Mobile (Application Serveuse)

**Framework**
- **React Native** : Framework cross-platform (iOS + Android)
- **Expo** : Toolchain pour simplifier le développement React Native

**Gestion d'État**
- **Redux Toolkit** : Gestion d'état prévisible avec moins de boilerplate
- **Redux Persist** : Persistance de l'état local

**UI Components**
- **React Native Paper** : Composants Material Design
- Alternative : NativeBase, React Native Elements

**Navigation**
- **React Navigation** : Navigation native pour React Native

**WebSocket Client**
- **socket.io-client** : Client Socket.io pour React Native

**Stockage Local**
- **AsyncStorage** : Stockage clé-valeur asynchrone
- **react-native-keychain** : Stockage sécurisé des tokens

#### Frontend Web (Comptoir et Tableau de Bord)

**Framework**
- **React 18+** : Bibliothèque UI avec hooks et concurrent rendering
- **Vite** : Build tool rapide pour le développement

**Gestion d'État**
- **Redux Toolkit** : Cohérence avec l'app mobile
- **React Query (TanStack Query)** : Gestion du cache et des requêtes serveur

**UI Components**
- **Material-UI (MUI)** : Composants Material Design pour React
- Alternative : Ant Design, Chakra UI

**Graphiques**
- **Recharts** : Bibliothèque de graphiques déclarative
- Alternative : Chart.js avec react-chartjs-2

**Routing**
- **React Router v6** : Routing côté client

**WebSocket Client**
- **socket.io-client** : Client Socket.io pour React

**Exports**
- **jsPDF** : Génération de PDF côté client
- **papaparse** : Parsing et génération de CSV

#### DevOps et Infrastructure

**Conteneurisation**
- **Docker** : Conteneurisation de l'application
- **Docker Compose** : Orchestration locale (dev)

**CI/CD**
- **GitHub Actions** : Pipeline CI/CD automatisé
- Alternative : GitLab CI, CircleCI

**Monitoring et Logging**
- **Winston** : Logging structuré pour Node.js
- **Sentry** : Monitoring d'erreurs en production
- **Prometheus + Grafana** : Métriques et dashboards (optionnel)

**Déploiement**
- **Option 1 - Cloud** : AWS (EC2 + RDS + ElastiCache) ou DigitalOcean
- **Option 2 - On-Premise** : Serveur local dans le snack-bar
  - Recommandé pour éviter les coûts récurrents
  - Backup automatique vers cloud

### Architecture de Déploiement Recommandée

#### Option 1 : Déploiement On-Premise (Recommandé)

**Avantages**
- Pas de coûts mensuels cloud
- Données restent locales (confidentialité)
- Pas de dépendance à Internet pour le fonctionnement
- Latence minimale (réseau local)

**Infrastructure**
- **Serveur local** : Mini-PC ou NUC (Intel NUC, Raspberry Pi 4 8GB)
- **Réseau** : WiFi local du snack-bar
- **Backup** : Synchronisation quotidienne vers cloud (Dropbox, Google Drive)

**Configuration Serveur**
```yaml
# docker-compose.yml
version: '3.8'

services:
  backend:
    image: snackbar-backend:latest
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/snackbar
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=snackbar
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl

volumes:
  postgres_data:
  redis_data:
```

#### Option 2 : Déploiement Cloud

**Avantages**
- Accès depuis n'importe où
- Scalabilité automatique
- Maintenance simplifiée

**Infrastructure AWS**
- **EC2** : Instance t3.small pour le backend
- **RDS PostgreSQL** : Base de données managée
- **ElastiCache Redis** : Cache managé
- **S3** : Stockage des exports et backups
- **CloudFront** : CDN pour les applications web

**Coût Estimé** : ~50-100 USD/mois

### Considérations de Performance

**Optimisations Backend**

1. **Indexation Base de Données**
   - Index sur les colonnes fréquemment requêtées
   - Index composites pour les requêtes complexes

2. **Cache Redis**
   - Cache du stock (TTL: 5 secondes)
   - Cache des produits actifs (TTL: 1 minute)
   - Cache des KPIs (TTL: 10 secondes)

3. **Connection Pooling**
   - Pool de connexions PostgreSQL (max: 20)
   - Réutilisation des connexions

4. **Pagination**
   - Pagination de l'historique des transactions
   - Limite de 50 résultats par page

**Optimisations Frontend**

1. **Code Splitting**
   - Lazy loading des routes
   - Chargement différé des composants lourds

2. **Memoization**
   - React.memo pour les composants purs
   - useMemo pour les calculs coûteux

3. **Optimistic Updates**
   - Mise à jour immédiate de l'UI
   - Rollback en cas d'erreur serveur

### Sécurité Réseau

**Configuration Réseau Local**

1. **Isolation du Réseau**
   - VLAN dédié pour le système de gestion
   - Séparation du réseau client WiFi

2. **Firewall**
   - Bloquer tous les ports sauf 80/443
   - Whitelist des adresses IP autorisées

3. **HTTPS Obligatoire**
   - Certificat SSL auto-signé (on-premise)
   - Let's Encrypt (cloud)

4. **VPN pour Accès Distant**
   - WireGuard ou OpenVPN
   - Accès sécurisé pour le patron depuis l'extérieur

### Plan de Backup et Récupération

**Stratégie de Backup**

1. **Backup Automatique Quotidien**
   - Dump PostgreSQL complet
   - Export vers stockage externe (cloud ou disque USB)
   - Rétention : 30 jours

2. **Backup Incrémental Horaire**
   - WAL (Write-Ahead Logging) PostgreSQL
   - Permet de restaurer à n'importe quel point dans le temps

3. **Test de Restauration**
   - Test mensuel de restauration
   - Validation de l'intégrité des backups

**Plan de Récupération**

1. **Panne Serveur** : Restauration sur nouveau serveur (< 2 heures)
2. **Corruption Base de Données** : Restauration depuis dernier backup (< 30 minutes)
3. **Perte de Données** : Restauration point-in-time avec WAL (< 1 heure)

### Évolutivité Future

**Fonctionnalités Futures Possibles**

1. **Multi-établissements**
   - Gestion de plusieurs snack-bars
   - Consolidation des données

2. **Paiement Mobile**
   - Intégration MTN Mobile Money / Orange Money
   - Paiement direct depuis l'application

3. **Programme de Fidélité**
   - Points de fidélité
   - Récompenses automatiques

4. **Prévisions de Stock**
   - Machine Learning pour prédire les besoins
   - Suggestions de ravitaillement

5. **Application Client**
   - Commande depuis la table (QR code)
   - Paiement en ligne

**Architecture Évolutive**

- Microservices : Séparation des domaines métier
- Event Sourcing : Historique complet des événements
- CQRS : Séparation lecture/écriture pour performance


## Conclusion

Ce document de design présente une architecture complète et réalisable pour le système de gestion de snack-bar. Les choix techniques privilégient :

1. **Simplicité** : Stack moderne et bien documentée (Node.js, React, PostgreSQL)
2. **Fiabilité** : Synchronisation en temps réel avec mécanismes de retry
3. **Sécurité** : Authentification JWT, RBAC, audit complet
4. **Traçabilité** : Chaque action est enregistrée et immuable
5. **Testabilité** : 58 propriétés de correction avec tests property-based
6. **Gestion financière** : Distinction claire entre CA et encaissements, suivi des créances

Le système répond à toutes les exigences définies dans le document requirements.md et propose une solution technique concrète, sécurisée et évolutive pour résoudre le problème de détournement de stock dans les snack-bars. L'ajout de la gestion des factures et encaissements permet un suivi financier précis et la détection des impayés.

### Prochaines Étapes

1. **Validation du design** : Revue et approbation par les parties prenantes
2. **Création du plan d'implémentation** : Découpage en tâches de développement
3. **Mise en place de l'environnement** : Configuration des outils et infrastructure
4. **Développement itératif** : Implémentation par fonctionnalité avec tests
5. **Déploiement pilote** : Test dans un snack-bar pilote
6. **Déploiement production** : Rollout progressif

