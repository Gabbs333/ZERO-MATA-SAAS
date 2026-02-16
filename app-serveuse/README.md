# Application Mobile Serveuse - Snack Bar Management

Application mobile React Native pour les serveuses du système de gestion de snack-bar.

## 📱 Fonctionnalités

- **Authentification** : Connexion sécurisée avec Supabase Auth
- **Gestion des Tables** : Vue en temps réel de toutes les tables et leur statut
- **Création de Commandes** : Interface intuitive pour prendre les commandes
- **Filtrage par Catégorie** : Boissons, Nourriture, Autre
- **Historique** : Consultation de l'historique des commandes
- **Synchronisation Temps Réel** : Mise à jour automatique via Supabase Realtime
- **Mode Offline** : Support basique avec TanStack Query (retry automatique)

## 🛠️ Technologies

- **React Native** : Framework mobile
- **Expo** : Plateforme de développement
- **TypeScript** : Typage statique
- **Supabase** : Backend serverless (Auth, Database, Realtime)
- **Zustand** : Gestion d'état
- **TanStack Query** : Gestion des données et cache
- **React Navigation** : Navigation entre écrans
- **React Native Paper** : Composants UI Material Design

## 📋 Prérequis

- Node.js 18+ (recommandé: 20+)
- npm ou yarn
- Expo CLI (`npm install -g expo-cli`)
- Un projet Supabase configuré

## 🚀 Installation

1. **Cloner le projet** (si ce n'est pas déjà fait)

2. **Installer les dépendances**
```bash
cd app-serveuse
npm install
```

3. **Configurer Supabase**

Créer un fichier `.env` à la racine du projet :

```env
EXPO_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=votre-anon-key
```

Vous pouvez trouver ces valeurs dans votre projet Supabase :
- Aller sur https://app.supabase.com
- Sélectionner votre projet
- Aller dans Settings > API
- Copier l'URL et la clé `anon` (public)

## 🏃 Démarrage

### Mode Développement

```bash
# Démarrer le serveur Expo
npm start

# Ou directement sur un émulateur/appareil
npm run android  # Pour Android
npm run ios      # Pour iOS (Mac uniquement)
```

### Scanner le QR Code

1. Installer l'application **Expo Go** sur votre téléphone
   - [Android](https://play.google.com/store/apps/details?id=host.exp.exponent)
   - [iOS](https://apps.apple.com/app/expo-go/id982107779)

2. Scanner le QR code affiché dans le terminal

## 📱 Utilisation

### 1. Connexion

- Ouvrir l'application
- Entrer l'email et le mot de passe
- Seuls les utilisateurs avec le rôle `serveuse` peuvent se connecter

### 2. Gestion des Tables

- Vue d'ensemble de toutes les tables
- Statuts : Libre (vert), Occupée (orange), Commande en attente (bleu)
- Cliquer sur une table libre pour créer une commande
- Maintenir appuyé sur une table occupée pour la libérer

### 3. Création de Commande

- Sélectionner une table
- Filtrer les produits par catégorie (Tous, Boissons, Nourriture, Autre)
- Ajouter des produits avec les boutons +/-
- Le montant total se calcule automatiquement
- Soumettre la commande ou annuler

### 4. Historique

- Accéder via le bouton FAB (en bas à droite) sur l'écran des tables
- Voir toutes vos commandes passées
- Rechercher par numéro de commande ou numéro de table
- Voir les détails de chaque commande

## 🏗️ Structure du Projet

```
app-serveuse/
├── App.tsx                      # Point d'entrée avec navigation
├── src/
│   ├── components/              # Composants réutilisables
│   │   ├── TableCard.tsx        # Carte de table
│   │   ├── ProductItem.tsx      # Item de produit
│   │   └── CommandeSummary.tsx  # Résumé de commande
│   ├── config/
│   │   └── supabase.ts          # Configuration Supabase
│   ├── hooks/                   # Hooks personnalisés
│   │   ├── useSupabaseQuery.ts  # Hooks de requêtes
│   │   ├── useSupabaseMutation.ts # Hooks de mutations
│   │   └── useRealtimeSubscription.ts # Hook Realtime
│   ├── screens/                 # Écrans de l'application
│   │   ├── LoginScreen.tsx      # Écran de connexion
│   │   ├── TablesScreen.tsx     # Écran des tables
│   │   ├── CommandeScreen.tsx   # Écran de commande
│   │   └── HistoriqueScreen.tsx # Écran d'historique
│   ├── services/                # Services
│   │   └── OfflineQueue.ts      # File d'attente offline
│   ├── store/                   # Gestion d'état Zustand
│   │   ├── authStore.ts         # Store d'authentification
│   │   └── commandeStore.ts     # Store de commande
│   └── types/
│       └── database.types.ts    # Types TypeScript
├── .env                         # Variables d'environnement
└── package.json
```

## 🔧 Configuration Backend

L'application nécessite que le backend Supabase soit configuré avec :

### Tables Requises
- `profiles` : Profils utilisateurs avec rôles
- `tables` : Tables du restaurant
- `produits` : Catalogue de produits
- `stock` : Inventaire
- `commandes` : Commandes
- `commande_items` : Lignes de commande

### Fonctions PostgreSQL
- `get_produits_disponibles()` : Retourne les produits en stock
- `create_commande(p_table_id, p_items)` : Crée une commande

### RLS Policies
- Les serveuses peuvent créer des commandes
- Les serveuses voient uniquement leurs propres commandes
- Les serveuses peuvent lire les tables et produits

### Realtime
- Activé sur les tables : `commandes`, `tables`, `stock`

## 🧪 Tests

Pour exécuter les tests (à implémenter) :

```bash
npm test
```

## 📦 Build Production

### Android

```bash
# Build APK
eas build --platform android --profile preview

# Build AAB pour Google Play
eas build --platform android --profile production
```

### iOS

```bash
# Build pour TestFlight
eas build --platform ios --profile production
```

## 🐛 Dépannage

### Problème : "Supabase credentials not found"

**Solution** : Vérifier que le fichier `.env` existe et contient les bonnes valeurs.

### Problème : "Network request failed"

**Solution** : 
- Vérifier la connexion internet
- Vérifier que l'URL Supabase est correcte
- Vérifier que le backend Supabase est accessible

### Problème : "Authentication failed"

**Solution** :
- Vérifier que l'utilisateur existe dans Supabase Auth
- Vérifier que l'utilisateur a le rôle `serveuse` dans la table `profiles`
- Vérifier que les RLS policies sont correctement configurées

### Problème : "Cannot read property 'id' of null"

**Solution** : L'utilisateur n'est pas authentifié. Se reconnecter.

## 📝 Notes de Développement

### Mode Offline

L'application utilise TanStack Query avec `networkMode: 'offlineFirst'` pour gérer les requêtes offline. Les mutations sont automatiquement retentées 3 fois avec un délai exponentiel.

Un service `OfflineQueue` est disponible pour une gestion plus avancée de la file d'attente offline (non activé par défaut).

### Realtime

Les subscriptions Realtime sont gérées via le hook `useRealtimeSubscription`. Les écrans s'abonnent automatiquement aux changements pertinents :
- TablesScreen : changements sur la table `tables`
- CommandeScreen : changements sur `stock` et `produits`

### Performance

- Les requêtes sont mises en cache pendant 5 minutes
- Les données sont conservées en mémoire pendant 10 minutes
- Les images et assets sont optimisés pour mobile

## 🔐 Sécurité

- Les tokens JWT sont stockés de manière sécurisée dans AsyncStorage
- Les tokens sont automatiquement rafraîchis
- Les RLS policies Supabase garantissent la sécurité des données
- Aucune donnée sensible n'est stockée en clair

## 📄 Licence

Propriétaire - Tous droits réservés

## 👥 Support

Pour toute question ou problème, contacter l'équipe de développement.
