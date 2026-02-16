# Guide de Démarrage Rapide - App Serveuse

## 🚀 Démarrage en 5 Minutes

### 1. Installer les Dépendances

```bash
cd app-serveuse
npm install
```

### 2. Configurer Supabase

Créer un fichier `.env` :

```env
EXPO_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=votre-anon-key
```

### 3. Démarrer l'Application

```bash
npm start
```

### 4. Tester sur Votre Téléphone

1. Installer **Expo Go** depuis le Play Store ou App Store
2. Scanner le QR code affiché dans le terminal
3. L'application se lance automatiquement

### 5. Se Connecter

Utiliser un compte avec le rôle `serveuse` :

```
Email: serveuse@example.com
Mot de passe: [votre mot de passe]
```

## ✅ Vérification

Si tout fonctionne, vous devriez voir :
- ✅ L'écran de connexion
- ✅ Après connexion : la liste des tables
- ✅ Les tables avec leur statut (libre/occupée)
- ✅ Possibilité de créer une commande

## 🐛 Problèmes Courants

### "Cannot connect to Metro"
```bash
# Redémarrer le serveur
npm start -- --clear
```

### "Network request failed"
- Vérifier que le fichier `.env` existe
- Vérifier que les valeurs Supabase sont correctes
- Vérifier la connexion internet

### "Authentication failed"
- Vérifier que l'utilisateur existe dans Supabase
- Vérifier que le rôle est bien `serveuse`

## 📱 Prochaines Étapes

1. Créer des utilisateurs de test dans Supabase
2. Ajouter des produits dans la base de données
3. Tester la création de commandes
4. Vérifier la synchronisation temps réel

## 📚 Documentation Complète

Voir [README.md](./README.md) pour la documentation complète.
