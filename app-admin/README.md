# Application Administration - Plateforme Multi-Tenant SaaS

Application web d'administration pour la gestion de la plateforme multi-tenant SaaS du système de gestion de snack bar.

## Fonctionnalités

- **Gestion des établissements**: Créer, visualiser, modifier les établissements
- **Gestion des abonnements**: Confirmer les paiements, suspendre/réactiver les établissements
- **Statistiques globales**: Vue d'ensemble de tous les établissements
- **Logs d'audit**: Suivi de toutes les actions administratives et système
- **Gestion des utilisateurs**: Vue des utilisateurs par établissement

## Technologies

- **React 18** avec TypeScript
- **Vite** pour le build
- **Material-UI** pour l'interface
- **React Router** pour la navigation
- **TanStack Query** pour la gestion des données
- **Zustand** pour la gestion d'état
- **Supabase** pour le backend

## Installation

```bash
# Installer les dépendances
npm install

# Copier le fichier d'environnement
cp .env.example .env

# Configurer les variables d'environnement dans .env
# VITE_SUPABASE_URL=votre_url_supabase
# VITE_SUPABASE_ANON_KEY=votre_clé_anon
```

## Création du premier utilisateur admin

Avant de pouvoir utiliser le tableau de bord, vous devez créer un utilisateur admin. 

**Consultez le guide complet**: [Guide de création d'utilisateur admin](../docs/ADMIN_USER_SETUP.md)

### Méthode rapide (recommandée)

```bash
# Définir les variables d'environnement
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Exécuter le script
../scripts/create-admin-user.sh
```

### Méthode manuelle

Voir le fichier `create-admin-user.sql` pour les instructions SQL.

**Important**: Les utilisateurs admin doivent avoir:
- `role = 'admin'`
- `etablissement_id = NULL`
- Accès via le service role key de Supabase

## Développement

```bash
# Démarrer le serveur de développement
npm run dev

# L'application sera disponible sur http://localhost:3003
```

## Build

```bash
# Créer un build de production
npm run build

# Prévisualiser le build
npm run preview
```

## Structure du projet

```
app-admin/
├── src/
│   ├── components/       # Composants réutilisables
│   ├── screens/          # Écrans de l'application
│   ├── hooks/            # Hooks personnalisés
│   ├── store/            # Gestion d'état (Zustand)
│   ├── types/            # Types TypeScript
│   ├── utils/            # Fonctions utilitaires
│   ├── config/           # Configuration (Supabase)
│   ├── App.tsx           # Composant principal
│   └── main.tsx          # Point d'entrée
├── public/               # Fichiers statiques
├── index.html            # Template HTML
├── package.json          # Dépendances
├── tsconfig.json         # Configuration TypeScript
└── vite.config.ts        # Configuration Vite
```

## Authentification

L'application est réservée aux utilisateurs avec le rôle `admin`. Les utilisateurs non-admin seront automatiquement déconnectés.

## Fonctions principales

### Gestion des établissements

- Créer un nouvel établissement
- Visualiser la liste de tous les établissements
- Voir les détails d'un établissement
- Modifier les informations d'un établissement

### Gestion des abonnements

- Confirmer un paiement et étendre l'abonnement de 12 mois
- Suspendre un établissement (avec raison)
- Réactiver un établissement suspendu
- Voir les établissements expirant bientôt

### Statistiques

- Nombre total d'établissements
- Établissements actifs/expirés/suspendus
- Nombre total d'utilisateurs
- Établissements expirant dans les 30 prochains jours

### Logs d'audit

- Actions administratives (création, paiement, suspension, etc.)
- Actions système (expirations automatiques)
- Logs par établissement

## Sécurité

- Authentification requise pour toutes les routes
- Vérification du rôle admin au niveau de l'application
- RLS (Row Level Security) au niveau de la base de données
- Toutes les actions sensibles sont loggées

## Développement futur

Les écrans suivants seront implémentés dans les prochaines tâches :

- [ ] Écran de liste des établissements
- [ ] Écran de détails d'un établissement
- [ ] Écran de création d'établissement
- [ ] Écran de statistiques globales
- [ ] Composants de gestion des abonnements
- [ ] Interface de logs d'audit

## Support

Pour toute question ou problème, contactez l'équipe de développement.
