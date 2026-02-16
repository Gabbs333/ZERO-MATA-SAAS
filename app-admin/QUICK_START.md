# Quick Start - Application Administration

## Installation

```bash
cd app-admin
npm install
```

## Configuration

Le fichier `.env` est déjà configuré pour le développement local avec Supabase local.

Pour la production, modifiez les variables :
```
VITE_SUPABASE_URL=votre_url_supabase_production
VITE_SUPABASE_ANON_KEY=votre_clé_anon_production
```

## Démarrage

```bash
npm run dev
```

L'application sera disponible sur http://localhost:3003

## Connexion

Pour vous connecter, vous devez avoir un utilisateur avec le rôle `admin` dans la base de données.

### Créer un utilisateur admin (via SQL)

```sql
-- 1. Créer l'utilisateur dans auth.users
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
VALUES (
  gen_random_uuid(),
  'admin@example.com',
  crypt('votre_mot_de_passe', gen_salt('bf')),
  NOW()
);

-- 2. Mettre à jour le profil avec le rôle admin
UPDATE profiles
SET 
  role = 'admin',
  etablissement_id = NULL,
  nom = 'Admin',
  prenom = 'System',
  actif = true
WHERE email = 'admin@example.com';
```

## Structure de l'application

```
app-admin/
├── src/
│   ├── components/       # Composants réutilisables (à implémenter)
│   ├── screens/          # Écrans de l'application
│   │   ├── LoginScreen.tsx
│   │   └── DashboardScreen.tsx
│   ├── hooks/            # Hooks personnalisés
│   │   ├── useSupabaseQuery.ts
│   │   └── useSupabaseMutation.ts
│   ├── store/            # Gestion d'état
│   │   └── authStore.ts
│   ├── types/            # Types TypeScript
│   │   └── database.types.ts
│   ├── utils/            # Utilitaires
│   │   └── format.ts
│   ├── config/           # Configuration
│   │   └── supabase.ts
│   ├── App.tsx           # Composant principal
│   └── main.tsx          # Point d'entrée
└── README.md             # Documentation complète
```

## Fonctionnalités implémentées

✅ Structure de base de l'application
✅ Configuration Supabase
✅ Authentification admin
✅ Types TypeScript pour multi-tenancy
✅ Hooks pour les requêtes et mutations
✅ Utilitaires de formatage
✅ Écran de connexion
✅ Écran de dashboard (placeholder)

## Prochaines étapes

Les écrans suivants seront implémentés dans les tâches suivantes :

- [ ] Écran de liste des établissements
- [ ] Écran de détails d'un établissement
- [ ] Écran de création d'établissement
- [ ] Écran de statistiques globales
- [ ] Composants de gestion des abonnements
- [ ] Interface de logs d'audit

## Notes importantes

- L'application est réservée aux utilisateurs avec le rôle `admin`
- Les utilisateurs non-admin seront automatiquement déconnectés
- Toutes les actions sensibles sont loggées dans `audit_logs`
- Les RLS policies au niveau de la base de données assurent la sécurité

## Support

Pour toute question, consultez le README.md principal ou contactez l'équipe de développement.
