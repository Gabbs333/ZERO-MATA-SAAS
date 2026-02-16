# Guide de Démarrage Rapide - App Patron

## 🚀 Installation en 5 Minutes

### 1. Prérequis
```bash
# Vérifier Node.js (version 18+)
node --version

# Vérifier npm
npm --version
```

### 2. Installation
```bash
# Aller dans le dossier
cd app-patron

# Installer les dépendances
npm install
```

### 3. Configuration
```bash
# Copier le fichier d'environnement
cp .env.example .env

# Éditer .env avec vos credentials Supabase
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Lancement
```bash
# Démarrer en mode développement
npm run dev

# L'application sera disponible sur http://localhost:3002
```

### 5. Connexion
- Ouvrir http://localhost:3002
- Se connecter avec un compte gérant ou patron
- Profiter de l'application!

## 📋 Comptes de Test

Créer des comptes via l'écran "Utilisateurs" (patron uniquement) ou via Supabase Dashboard.

### Rôles Disponibles
- **Patron**: Accès complet à toutes les fonctionnalités
- **Gérant**: Accès à la plupart des fonctionnalités (sauf gestion utilisateurs et audit)

## 🎯 Fonctionnalités Principales

### Dashboard
- Vue d'ensemble des KPIs
- Graphiques en temps réel
- Filtres par période

### Stock
- Consultation du stock
- Alertes de stock bas
- Historique des mouvements

### Finances
- CA vs Encaissements
- Créances
- Statistiques détaillées

### Ravitaillements
- Enregistrement de nouveaux ravitaillements
- Historique complet
- Filtres par période

### Produits
- Création/Modification de produits
- Désactivation (soft delete)
- Historique des modifications

### Rapports
- Export CSV des ventes
- Export CSV du stock
- Génération de rapports PDF

## 🔧 Commandes Utiles

```bash
# Développement
npm run dev

# Build production
npm run build

# Preview du build
npm run preview

# Tests
npm test

# Tests avec UI
npm run test:ui

# Linter (si configuré)
npm run lint
```

## 🐛 Dépannage

### Erreur de connexion Supabase
- Vérifier les variables d'environnement dans `.env`
- Vérifier que le projet Supabase est actif
- Vérifier les RLS policies

### Erreur "Cannot find module"
```bash
# Réinstaller les dépendances
rm -rf node_modules package-lock.json
npm install
```

### Port déjà utilisé
```bash
# Changer le port dans vite.config.ts
server: {
  port: 3003, // Nouveau port
}
```

## 📚 Documentation

- [README complet](./README.md)
- [Documentation Supabase](https://supabase.com/docs)
- [Documentation Material-UI](https://mui.com/)
- [Documentation Recharts](https://recharts.org/)

## 🆘 Support

Pour toute question:
1. Consulter le README.md
2. Vérifier la documentation Supabase
3. Consulter les logs de la console

## ✅ Checklist de Démarrage

- [ ] Node.js 18+ installé
- [ ] Dépendances npm installées
- [ ] Fichier .env configuré
- [ ] Projet Supabase créé et configuré
- [ ] Migrations Supabase exécutées
- [ ] Compte gérant/patron créé
- [ ] Application démarrée avec `npm run dev`
- [ ] Connexion réussie

Bon développement! 🎉
