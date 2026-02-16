# Comptes de Test - Snack Bar Management

Les comptes suivants ont été créés dans votre base de données Supabase pour tester les applications.

## 🔐 Identifiants de Connexion

### App Patron (http://localhost:3002)
**Compte Patron** - Accès complet à toutes les fonctionnalités
- **Email**: `patron@snackbar.cm`
- **Mot de passe**: `password123`
- **Nom**: Jean Dupont
- **Rôle**: Patron

### App Comptoir (http://localhost:3001)
**Compte Comptoir** - Validation des commandes et gestion des paiements
- **Email**: `comptoir@snackbar.cm`
- **Mot de passe**: `password123`
- **Nom**: Sophie Martin
- **Rôle**: Comptoir

### App Serveuse (Mobile)
**Compte Serveuse** - Prise de commande
- **Email**: `serveuse@snackbar.cm`
- **Mot de passe**: `password123`
- **Nom**: Marie Kamga
- **Rôle**: Serveuse

### App Admin (http://localhost:3000)
**Compte Admin** - Gestion globale
- **Email**: `admin@snackbar.cm`
- **Mot de passe**: `password123`
- **Nom**: System Admin
- **Rôle**: Admin

## 📝 Notes

- Les emails sont confirmés automatiquement (pas besoin de vérification)
- Les comptes sont actifs et prêts à l'emploi
- Les mots de passe sont simples pour faciliter les tests (à changer en production)

## 🚀 Prochaines Étapes

1. **Tester app-patron** :
   - Connectez-vous avec le compte patron
   - Explorez le dashboard, les finances, le stock, etc.
   - Créez d'autres utilisateurs depuis l'écran "Utilisateurs"

2. **Tester app-comptoir** :
   - Connectez-vous avec le compte comptoir
   - Validez des commandes
   - Gérez les factures et encaissements

3. **Créer d'autres utilisateurs** :
   - Depuis app-patron, allez dans "Utilisateurs"
   - Créez des comptes serveuse, gérant, etc.
   - Ou utilisez le SQL Editor de Supabase pour créer plus d'utilisateurs

## 🔧 Créer Plus d'Utilisateurs via SQL

Si vous voulez créer d'autres utilisateurs de test (serveuse, gérant), utilisez ce template dans le SQL Editor de Supabase :

```sql
-- Créer un utilisateur serveuse
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, confirmation_token, email_change,
  email_change_token_new, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'serveuse@snackbar.cm',
  crypt('serveuse123', gen_salt('bf')),
  NOW(), NOW(), NOW(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  FALSE, '', '', '', ''
);

-- Mettre à jour le profil
UPDATE profiles
SET 
  nom = 'Kamga',
  prenom = 'Marie',
  role = 'serveuse',
  actif = true
WHERE id = (SELECT id FROM auth.users WHERE email = 'serveuse@snackbar.cm');
```

## 📊 Base de Données

- **Projet Supabase**: wgzbpgauajgxkxoezlqw
- **URL**: https://wgzbpgauajgxkxoezlqw.supabase.co
- **Dashboard**: https://supabase.com/dashboard/project/wgzbpgauajgxkxoezlqw

## ⚠️ Sécurité

Ces comptes sont pour le développement et les tests uniquement. En production :
- Utilisez des mots de passe forts
- Activez l'authentification à deux facteurs si disponible
- Limitez les accès selon les besoins réels
- Changez régulièrement les mots de passe
