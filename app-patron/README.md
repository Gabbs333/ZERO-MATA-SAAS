# Application Tableau de Bord Patron/Gérant - Snack Bar

Application web React pour la gestion complète du snack-bar par les gérants et patrons.

## 🚀 Fonctionnalités

### Pour Gérants et Patrons
- **Tableau de Bord**: KPIs en temps réel (CA, encaissements, créances, bénéfice)
- **Gestion du Stock**: Consultation du stock, alertes, historique des mouvements
- **Finances**: Analyse CA vs Encaissements, créances, statistiques
- **Ravitaillements**: Enregistrement et historique des ravitaillements
- **Produits**: CRUD complet avec historique des modifications
- **Rapports**: Exports CSV et PDF
- **Transactions**: Recherche avancée de transactions
- **Profil**: Gestion du profil utilisateur

### Pour Patrons Uniquement
- **Profits & Pertes**: Analyse détaillée de la rentabilité
- **Créances**: Gestion des factures impayées
- **Utilisateurs**: Création et gestion des comptes utilisateurs
- **Audit**: Journal complet des actions
- **Activité Système**: Monitoring en temps réel

## 📦 Technologies

- **React 18** avec TypeScript
- **Vite** pour le build
- **Material-UI** pour l'interface
- **Recharts** pour les graphiques
- **TanStack Query** pour la gestion des données
- **Zustand** pour l'état global
- **Supabase** pour le backend
- **React Router** pour la navigation
- **Vitest** pour les tests

## 🛠️ Installation

```bash
# Installer les dépendances
npm install

# Créer le fichier .env
cp .env.example .env

# Configurer les variables d'environnement
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 🚀 Démarrage

```bash
# Mode développement
npm run dev

# Build production
npm run build

# Preview production
npm run preview

# Tests
npm test

# Tests avec UI
npm run test:ui
```

## 📁 Structure du Projet

```
app-patron/
├── src/
│   ├── components/        # Composants réutilisables
│   │   ├── Layout.tsx     # Layout principal avec navigation
│   │   └── KPICard.tsx    # Carte de KPI
│   ├── screens/           # Écrans de l'application
│   │   ├── LoginScreen.tsx
│   │   ├── DashboardScreen.tsx
│   │   ├── StockScreen.tsx
│   │   ├── FinancialDashboardScreen.tsx
│   │   ├── RavitaillementScreen.tsx
│   │   ├── SupplyHistoryScreen.tsx
│   │   ├── ProduitsScreen.tsx
│   │   ├── ProfitLossScreen.tsx
│   │   ├── CreancesScreen.tsx
│   │   ├── RapportsScreen.tsx
│   │   ├── UtilisateursScreen.tsx
│   │   ├── TransactionsScreen.tsx
│   │   ├── AuditLogScreen.tsx
│   │   ├── UserProfileScreen.tsx
│   │   └── SystemActivityScreen.tsx
│   ├── hooks/             # Hooks personnalisés
│   │   ├── useSupabaseQuery.ts
│   │   ├── useSupabaseMutation.ts
│   │   └── useRealtimeSubscription.ts
│   ├── store/             # État global (Zustand)
│   │   └── authStore.ts
│   ├── types/             # Types TypeScript
│   │   └── database.types.ts
│   ├── utils/             # Utilitaires
│   │   └── format.ts
│   ├── config/            # Configuration
│   │   └── supabase.ts
│   ├── test/              # Configuration des tests
│   │   └── setup.ts
│   ├── App.tsx            # Composant principal
│   └── main.tsx           # Point d'entrée
├── package.json
├── vite.config.ts
├── vitest.config.ts
└── tsconfig.json
```

## 🔐 Authentification

L'application utilise Supabase Auth avec validation de rôle:
- Seuls les utilisateurs avec le rôle `gerant` ou `patron` peuvent se connecter
- Les comptes inactifs sont automatiquement rejetés
- Session persistante avec refresh automatique

## 📊 Graphiques et Analytics

L'application utilise Recharts pour afficher:
- Évolution du CA vs Encaissements (LineChart)
- Top 5 produits vendus (BarChart)
- Répartition des encaissements par mode de paiement (PieChart)
- Comparaisons temporelles (BarChart)

## 🔄 Temps Réel

Toutes les données sont synchronisées en temps réel via Supabase Realtime:
- KPIs mis à jour automatiquement
- Notifications de nouvelles commandes
- Alertes de stock bas
- Activité système en direct

## 🧪 Tests

```bash
# Lancer tous les tests
npm test

# Tests en mode watch
npm test -- --watch

# Tests avec couverture
npm test -- --coverage

# Tests avec UI
npm run test:ui
```

## 📱 Responsive Design

L'application est entièrement responsive et s'adapte à tous les écrans:
- Desktop (> 1200px)
- Tablet (768px - 1200px)
- Mobile (< 768px)

## 🌐 Déploiement

### Vercel (Recommandé)

```bash
# Installer Vercel CLI
npm i -g vercel

# Déployer
vercel

# Production
vercel --prod
```

### Variables d'Environnement

Configurer dans Vercel:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 📝 Conventions de Code

- **TypeScript strict mode** activé
- **ESLint** pour le linting
- **Prettier** pour le formatage
- **Composants fonctionnels** avec hooks
- **Nommage**: PascalCase pour composants, camelCase pour fonctions

## 🔧 Configuration Supabase

L'application nécessite:
- Tables: produits, stock, commandes, factures, encaissements, ravitaillements, profiles, audit_logs
- RLS policies configurées pour gérant/patron
- Functions: get_kpis, get_analytics, create_ravitaillement, etc.
- Realtime activé sur les tables critiques
- Edge Functions pour les exports

## 📚 Documentation

- [Supabase Docs](https://supabase.com/docs)
- [Material-UI Docs](https://mui.com/)
- [Recharts Docs](https://recharts.org/)
- [TanStack Query Docs](https://tanstack.com/query)

## 🤝 Support

Pour toute question ou problème, consulter la documentation du projet principal.

## 📄 Licence

Propriétaire - Tous droits réservés
