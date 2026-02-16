# Application Web Comptoir - Snack Bar Management

Application web React pour le personnel du comptoir du système de gestion de snack-bar.

## 📱 Fonctionnalités

- **Validation des Commandes** : Validation en temps réel des commandes des serveuses
- **Gestion des Factures** : Consultation et gestion des factures
- **Enregistrement des Encaissements** : Enregistrement des paiements (espèces, carte, mobile money, chèque)
- **Consultation du Stock** : Vue en temps réel du stock avec alertes
- **Synchronisation Temps Réel** : Mise à jour automatique via Supabase Realtime
- **Alertes** : Notifications pour stock bas et factures impayées

## 🛠️ Technologies

- **React 18** : Framework frontend
- **TypeScript** : Typage statique
- **Vite** : Build tool rapide
- **Material-UI (MUI)** : Composants UI
- **Supabase** : Backend serverless (Auth, Database, Realtime)
- **Zustand** : Gestion d'état
- **TanStack Query** : Gestion des données et cache
- **React Router** : Navigation

## 📋 Prérequis

- Node.js 18+ (recommandé: 20+)
- npm ou yarn
- Un projet Supabase configuré
- Les migrations de la base de données appliquées (Phases 1-8)

## 🚀 Installation

1. **Installer les dépendances**
```bash
cd app-comptoir
npm install
```

2. **Configurer Supabase**

Créer un fichier `.env` à la racine du projet :

```env
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-anon-key
```

Vous pouvez trouver ces valeurs dans votre projet Supabase :
- Aller sur https://app.supabase.com
- Sélectionner votre projet
- Aller dans Settings > API
- Copier l'URL et la clé `anon` (public)

## 🏃 Démarrage

### Mode Développement

```bash
npm run dev
```

L'application sera accessible sur http://localhost:3001

### Build Production

```bash
npm run build
npm run preview
```

## 📱 Utilisation

### 1. Connexion

- Ouvrir http://localhost:3001
- Entrer l'email et le mot de passe
- Seuls les utilisateurs avec le rôle `comptoir`, `gerant` ou `patron` peuvent se connecter

### 2. Validation des Commandes

- Vue d'ensemble de toutes les commandes en attente
- Détails de chaque commande (table, serveuse, produits, montant)
- Bouton de validation
- Gestion des erreurs (stock insuffisant)
- Mise à jour en temps réel

### 3. Gestion des Factures

- Onglets : Toutes / En attente / Payées
- Détails de chaque facture
- Historique des encaissements
- Enregistrement de nouveaux paiements
- Alertes pour factures impayées > 24h

### 4. Consultation du Stock

- Tableau complet du stock
- Indicateurs visuels pour stock bas
- Alertes en haut de page
- Mise à jour en temps réel

## 🏗️ Structure du Projet

```
app-comptoir/
├── src/
│   ├── components/          # Composants réutilisables
│   │   └── Layout.tsx       # Layout principal avec navigation
│   ├── config/
│   │   └── supabase.ts      # Configuration Supabase
│   ├── hooks/               # Hooks personnalisés
│   │   ├── useSupabaseQuery.ts
│   │   ├── useSupabaseMutation.ts
│   │   └── useRealtimeSubscription.ts
│   ├── screens/             # Écrans de l'application
│   │   ├── LoginScreen.tsx
│   │   ├── ValidationScreen.tsx
│   │   ├── FacturesScreen.tsx
│   │   └── StockScreen.tsx
│   ├── store/               # Gestion d'état Zustand
│   │   └── authStore.ts
│   ├── types/
│   │   └── database.types.ts
│   ├── App.tsx              # Composant principal
│   └── main.tsx             # Point d'entrée
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 🔧 Configuration Backend

L'application nécessite que le backend Supabase soit configuré avec :

### Tables Requises
- `profiles` : Profils utilisateurs avec rôles
- `commandes` : Commandes
- `commande_items` : Lignes de commande
- `tables` : Tables du restaurant
- `produits` : Catalogue de produits
- `stock` : Inventaire
- `factures` : Factures
- `encaissements` : Paiements

### Fonctions PostgreSQL
- `validate_commande(p_commande_id)` : Valide une commande
- `create_encaissement(p_facture_id, p_montant, p_mode_paiement, p_reference)` : Crée un encaissement
- `check_stock_alerts()` : Retourne les produits en stock bas
- `get_factures_impayees_alerts()` : Retourne les factures impayées > 24h

### RLS Policies
- Le comptoir peut lire toutes les commandes en attente
- Le comptoir peut valider les commandes
- Le comptoir peut créer des encaissements
- Le comptoir peut lire les factures et le stock

### Realtime
- Activé sur les tables : `commandes`, `factures`, `encaissements`, `stock`

## 🧪 Tests

```bash
npm test
```

## 📦 Build et Déploiement

### Build

```bash
npm run build
```

Les fichiers de production seront dans le dossier `dist/`.

### Déploiement sur Vercel

1. Installer Vercel CLI :
```bash
npm install -g vercel
```

2. Déployer :
```bash
vercel
```

3. Configurer les variables d'environnement dans Vercel Dashboard :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

### Déploiement sur Netlify

1. Build le projet :
```bash
npm run build
```

2. Déployer le dossier `dist/` sur Netlify

3. Configurer les variables d'environnement dans Netlify Dashboard

## 🐛 Dépannage

### Problème : "Supabase credentials not found"

**Solution** : Vérifier que le fichier `.env` existe et contient les bonnes valeurs.

### Problème : "Network request failed"

**Solution** : 
- Vérifier la connexion internet
- Vérifier que l'URL Supabase est correcte
- Vérifier que le backend Supabase est accessible

### Problème : "Accès non autorisé"

**Solution** :
- Vérifier que l'utilisateur a le rôle `comptoir`, `gerant` ou `patron`
- Vérifier que les RLS policies sont correctement configurées

### Problème : "Cannot validate commande"

**Solution** :
- Vérifier que la fonction `validate_commande` existe
- Vérifier que le stock est suffisant
- Vérifier les logs Supabase

## 📝 Notes de Développement

### Realtime

Les subscriptions Realtime sont gérées via le hook `useRealtimeSubscription`. Les écrans s'abonnent automatiquement aux changements pertinents.

### Performance

- Les requêtes sont mises en cache pendant 30 secondes
- Les données sont automatiquement rafraîchies lors du focus de la fenêtre
- Les mutations invalident automatiquement les caches pertinents

## 🔐 Sécurité

- Les tokens JWT sont stockés de manière sécurisée
- Les tokens sont automatiquement rafraîchis
- Les RLS policies Supabase garantissent la sécurité des données
- Validation du rôle à la connexion

## 📄 Licence

Propriétaire - Tous droits réservés

## 👥 Support

Pour toute question ou problème, contacter l'équipe de développement.
