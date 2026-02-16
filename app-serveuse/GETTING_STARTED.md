# Guide de Démarrage - Application Mobile Serveuse

## 🎯 Objectif

Ce guide vous accompagne pas à pas pour installer, configurer et tester l'application mobile des serveuses.

## ⚡ Démarrage Rapide (5 minutes)

### 1. Prérequis

Vérifier que vous avez :
- ✅ Node.js 18+ installé (`node --version`)
- ✅ npm ou yarn installé (`npm --version`)
- ✅ Un projet Supabase configuré
- ✅ Les migrations de la base de données appliquées (Phases 1-8)

### 2. Installation

```bash
# Aller dans le dossier de l'app
cd app-serveuse

# Installer les dépendances
npm install

# Cela peut prendre 2-3 minutes
```

### 3. Configuration Supabase

**Étape 3.1** : Récupérer vos credentials Supabase

1. Aller sur https://app.supabase.com
2. Sélectionner votre projet
3. Aller dans **Settings** > **API**
4. Copier :
   - **Project URL** (ex: `https://abcdefgh.supabase.co`)
   - **anon public** key (la clé publique, pas la service_role)

**Étape 3.2** : Créer le fichier `.env`

```bash
# Créer le fichier .env à la racine de app-serveuse
touch .env
```

**Étape 3.3** : Ajouter vos credentials

Ouvrir `.env` et ajouter :

```env
EXPO_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

⚠️ **Important** : Remplacer par vos vraies valeurs !

### 4. Démarrer l'Application

```bash
npm start
```

Vous devriez voir :

```
› Metro waiting on exp://192.168.x.x:8081
› Scan the QR code above with Expo Go (Android) or the Camera app (iOS)
```

### 5. Tester sur Votre Téléphone

**Option A : Avec Expo Go (Recommandé pour le développement)**

1. Installer **Expo Go** sur votre téléphone :
   - [Android - Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)
   - [iOS - App Store](https://apps.apple.com/app/expo-go/id982107779)

2. Scanner le QR code affiché dans le terminal
   - Android : Ouvrir Expo Go et scanner
   - iOS : Ouvrir l'app Appareil Photo et scanner

3. L'application se lance automatiquement

**Option B : Avec un Émulateur**

Android :
```bash
npm run android
```

iOS (Mac uniquement) :
```bash
npm run ios
```

## 🧪 Tester l'Application

### Créer un Utilisateur de Test

**Étape 1** : Aller dans Supabase Dashboard

1. Aller sur https://app.supabase.com
2. Sélectionner votre projet
3. Aller dans **Authentication** > **Users**
4. Cliquer sur **Add user** > **Create new user**

**Étape 2** : Créer l'utilisateur

```
Email: serveuse.test@example.com
Password: Test123456!
```

Cliquer sur **Create user**

**Étape 3** : Ajouter le profil

Aller dans **Table Editor** > **profiles** et ajouter une ligne :

```sql
INSERT INTO profiles (id, role, nom, prenom, actif)
VALUES (
  'l-uuid-de-l-utilisateur-créé',
  'serveuse',
  'Test',
  'Serveuse',
  true
);
```

Ou via l'interface :
- id : Copier l'UUID de l'utilisateur créé
- role : `serveuse`
- nom : `Test`
- prenom : `Serveuse`
- actif : `true`

### Ajouter des Données de Test

**Tables**

```sql
INSERT INTO tables (numero, capacite, statut)
VALUES 
  (1, 4, 'libre'),
  (2, 2, 'libre'),
  (3, 6, 'libre'),
  (4, 4, 'occupee'),
  (5, 2, 'commande_en_attente');
```

**Produits**

```sql
INSERT INTO produits (nom, categorie, prix_vente, actif)
VALUES 
  ('Coca Cola', 'boisson', 500, true),
  ('Fanta', 'boisson', 500, true),
  ('Eau Minérale', 'boisson', 300, true),
  ('Sandwich Poulet', 'nourriture', 1500, true),
  ('Omelette', 'nourriture', 1000, true),
  ('Chips', 'autre', 500, true);
```

**Stock**

```sql
INSERT INTO stock (produit_id, quantite_actuelle, seuil_alerte)
SELECT id, 50, 10 FROM produits;
```

### Scénario de Test Complet

**1. Connexion**
- Ouvrir l'app
- Entrer : `serveuse.test@example.com` / `Test123456!`
- Cliquer sur **Se connecter**
- ✅ Vous devriez voir l'écran des tables

**2. Voir les Tables**
- ✅ Vous devriez voir 5 tables
- ✅ Table 1, 2, 3 : vertes (libres)
- ✅ Table 4 : orange (occupée)
- ✅ Table 5 : bleue (commande en attente)

**3. Créer une Commande**
- Cliquer sur **Table 1**
- ✅ Vous devriez voir l'écran de commande
- ✅ Vous devriez voir 6 produits
- Cliquer sur **Boissons**
- ✅ Vous devriez voir 3 produits (Coca, Fanta, Eau)
- Cliquer sur **+** à côté de Coca Cola (2 fois)
- Cliquer sur **+** à côté de Fanta (1 fois)
- ✅ Le résumé devrait afficher : 3 articles, 1500 FCFA
- Cliquer sur **Soumettre la commande**
- Confirmer
- ✅ Message de succès
- ✅ Retour à l'écran des tables
- ✅ Table 1 devrait maintenant être bleue (commande en attente)

**4. Voir l'Historique**
- Cliquer sur le bouton **+** en bas à droite
- Cliquer sur **Historique**
- ✅ Vous devriez voir votre commande
- ✅ Statut : En attente
- ✅ Détails : 2x Coca Cola, 1x Fanta, Total 1500 FCFA

**5. Tester la Recherche**
- Dans l'historique, taper "CMD" dans la barre de recherche
- ✅ Votre commande devrait apparaître
- Taper "Table 1"
- ✅ Votre commande devrait apparaître

**6. Libérer une Table**
- Retour à l'écran des tables
- Maintenir appuyé sur **Table 4** (occupée)
- Confirmer la libération
- ✅ Table 4 devrait devenir verte (libre)

**7. Déconnexion**
- Cliquer sur le bouton de déconnexion (en haut à droite)
- ✅ Retour à l'écran de connexion

## 🔧 Dépannage

### Problème : "Cannot connect to Metro"

**Cause** : Le serveur Metro n'est pas démarré ou bloqué

**Solution** :
```bash
# Arrêter le serveur (Ctrl+C)
# Nettoyer le cache et redémarrer
npm start -- --clear
```

### Problème : "Network request failed"

**Cause** : L'app ne peut pas se connecter à Supabase

**Solutions** :
1. Vérifier que le fichier `.env` existe
2. Vérifier que les valeurs sont correctes (pas d'espaces, pas de guillemets)
3. Redémarrer l'app (secouer le téléphone > Reload)
4. Vérifier la connexion internet

### Problème : "Authentication failed"

**Cause** : Identifiants incorrects ou utilisateur non configuré

**Solutions** :
1. Vérifier l'email et le mot de passe
2. Vérifier que l'utilisateur existe dans Supabase Auth
3. Vérifier que le profil existe avec role = 'serveuse'
4. Vérifier que actif = true

### Problème : "Aucune table trouvée"

**Cause** : Pas de données dans la table `tables`

**Solution** : Exécuter les requêtes SQL de test ci-dessus

### Problème : "Aucun produit disponible"

**Cause** : Pas de produits ou stock = 0

**Solutions** :
1. Vérifier que des produits existent
2. Vérifier que actif = true
3. Vérifier que le stock > 0

### Problème : L'app se ferme au démarrage

**Cause** : Erreur JavaScript

**Solution** :
1. Secouer le téléphone
2. Ouvrir le menu Dev
3. Activer "Debug Remote JS"
4. Voir les erreurs dans la console du navigateur

### Problème : Les changements ne s'affichent pas

**Cause** : Cache non rafraîchi

**Solution** :
1. Secouer le téléphone
2. Cliquer sur "Reload"
3. Ou redémarrer avec `npm start -- --clear`

## 📱 Fonctionnalités Avancées

### Mode Offline

L'app fonctionne en mode offline grâce à TanStack Query :
- Les données sont mises en cache
- Les requêtes échouées sont automatiquement retentées
- Les mutations sont retentées jusqu'à 3 fois

Pour tester :
1. Créer une commande en ligne
2. Activer le mode avion
3. Essayer de créer une commande
4. ❌ Erreur après 3 tentatives
5. Désactiver le mode avion
6. L'app se reconnecte automatiquement

### Synchronisation Realtime

Les changements sont synchronisés en temps réel :
- Statuts des tables
- Validation des commandes
- Mise à jour du stock

Pour tester :
1. Ouvrir l'app sur 2 appareils
2. Sur l'appareil 1 : créer une commande pour Table 1
3. Sur l'appareil 2 : ✅ Table 1 passe en "commande en attente"
4. Sur Supabase Dashboard : valider la commande
5. Sur les 2 appareils : ✅ Table 1 passe en "occupée"

## 🚀 Prochaines Étapes

### Développement

1. **Personnaliser l'UI**
   - Modifier les couleurs dans `App.tsx`
   - Ajouter un logo dans `assets/`
   - Personnaliser les icônes

2. **Ajouter des Fonctionnalités**
   - Notifications push
   - Scan de QR code pour les tables
   - Mode sombre
   - Multi-langue

3. **Améliorer les Tests**
   - Ajouter des tests pour les hooks
   - Ajouter des tests pour les screens
   - Augmenter la couverture à 80%+

### Production

1. **Configurer EAS Build**
```bash
npm install -g eas-cli
eas login
eas build:configure
```

2. **Build Android**
```bash
eas build --platform android --profile production
```

3. **Build iOS**
```bash
eas build --platform ios --profile production
```

4. **Publier**
   - Android : Google Play Console
   - iOS : App Store Connect

## 📚 Ressources

- [Documentation Expo](https://docs.expo.dev/)
- [Documentation React Native](https://reactnative.dev/)
- [Documentation Supabase](https://supabase.com/docs)
- [Documentation React Navigation](https://reactnavigation.org/)
- [Documentation React Native Paper](https://callstack.github.io/react-native-paper/)

## 💬 Support

Pour toute question :
1. Consulter le [README.md](./README.md)
2. Consulter le [QUICK_START.md](./QUICK_START.md)
3. Consulter les tests dans `src/__tests__/`
4. Contacter l'équipe de développement

---

**Bon développement ! 🚀**
