# Guide de Test - Dashboard Admin Multi-Tenant

## Prérequis

Avant de commencer les tests, assurez-vous que:

1. ✅ La base de données PostgreSQL est en cours d'exécution
2. ✅ Toutes les migrations multi-tenant sont appliquées (migrations 20240128000000 à 20240128000008)
3. ✅ Un utilisateur admin existe dans la base de données
4. ✅ Les variables d'environnement sont configurées dans `app-admin/.env`

## Configuration de l'Environnement

### 1. Fichier `.env`

Créez ou vérifiez le fichier `app-admin/.env`:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Créer un Utilisateur Admin de Test

Utilisez le script SQL suivant pour créer un utilisateur admin:

```sql
-- 1. Créer l'utilisateur dans auth.users (via Supabase Dashboard ou SQL)
-- Ou utilisez la commande Supabase CLI:
-- supabase auth users create admin@test.com --password "AdminTest123!"

-- 2. Mettre à jour le profil pour le rôle admin
UPDATE profiles 
SET 
  role = 'admin',
  etablissement_id = NULL,
  nom = 'Admin',
  prenom = 'Test'
WHERE email = 'admin@test.com';
```

**Identifiants de test:**
- Email: `admin@test.com`
- Mot de passe: `AdminTest123!`

## Démarrage de l'Application

```bash
cd app-admin
npm run dev
```

L'application devrait démarrer sur `http://localhost:5173`

## Plan de Test

### Test 1: Authentification Admin ✓

**Objectif:** Vérifier que seuls les utilisateurs admin peuvent accéder au dashboard

**Étapes:**
1. Ouvrir `http://localhost:5173`
2. Vérifier la redirection vers `/login`
3. Se connecter avec les identifiants admin
4. Vérifier la redirection vers le dashboard

**Résultats attendus:**
- ✓ Page de login affichée
- ✓ Connexion réussie
- ✓ Redirection vers le dashboard
- ✓ Nom de l'admin affiché dans le header

**Vérifications supplémentaires:**
- Tenter de se connecter avec un utilisateur non-admin → doit être rejeté
- Vérifier que le logout fonctionne

---

### Test 2: Page d'Accueil du Dashboard ✓

**Objectif:** Vérifier l'affichage de la page d'accueil

**Étapes:**
1. Après connexion, vérifier la page d'accueil
2. Cliquer sur les différentes cartes de navigation

**Résultats attendus:**
- ✓ Titre "Tableau de Bord Administrateur" affiché
- ✓ Carte "Établissements" avec boutons "Voir la liste" et "Nouveau"
- ✓ Carte "Statistiques" avec bouton "Voir les stats"
- ✓ Navigation fonctionnelle

---

### Test 3: Liste des Établissements ✓

**Objectif:** Vérifier l'affichage et le filtrage de la liste

**Étapes:**
1. Naviguer vers "Établissements"
2. Vérifier l'affichage de tous les établissements
3. Utiliser la barre de recherche
4. Tester les filtres par statut (Tous, Actifs, Expirés, Suspendus)
5. Cliquer sur "Détails" d'un établissement

**Résultats attendus:**
- ✓ Liste des établissements affichée avec cartes
- ✓ Informations visibles: nom, adresse, téléphone, email, statut, date de fin
- ✓ Recherche fonctionne en temps réel
- ✓ Filtres par statut fonctionnent
- ✓ Indicateur "Expire bientôt" pour les établissements < 30 jours
- ✓ Navigation vers les détails fonctionne

---

### Test 4: Création d'Établissement ✓

**Objectif:** Créer un nouvel établissement

**Étapes:**
1. Cliquer sur "Nouvel Établissement"
2. Remplir le formulaire:
   - Nom: "Restaurant Test"
   - Adresse: "123 Rue Test, Yaoundé"
   - Téléphone: "+237 6XX XX XX XX"
   - Email: "test@restaurant.cm"
3. Cliquer sur "Créer"
4. Vérifier la redirection vers la page de détails

**Résultats attendus:**
- ✓ Formulaire affiché avec tous les champs
- ✓ Message info sur l'abonnement automatique (12 mois)
- ✓ Validation des champs (nom requis, email valide)
- ✓ Création réussie
- ✓ Redirection vers la page de détails du nouvel établissement
- ✓ Abonnement configuré: statut "actif", date_fin = aujourd'hui + 12 mois

**Vérification en base de données:**
```sql
SELECT id, nom, statut_abonnement, date_debut, date_fin, actif
FROM etablissements
WHERE nom = 'Restaurant Test';
```

---

### Test 5: Détails d'un Établissement ✓

**Objectif:** Vérifier l'affichage complet des informations

**Étapes:**
1. Ouvrir la page de détails d'un établissement
2. Vérifier toutes les sections

**Résultats attendus:**
- ✓ **Informations générales:** nom, adresse, téléphone, email, date de création
- ✓ **Abonnement:** statut, date de début, date de fin, dernier paiement
- ✓ **Boutons d'action:** Confirmer Paiement, Suspendre/Réactiver
- ✓ **Liste des utilisateurs:** tableau avec nom, email, rôle, statut
- ✓ **Activité récente:** logs d'audit avec date, action, table, détails

---

### Test 6: Confirmation de Paiement ✓

**Objectif:** Tester l'extension d'abonnement

**Étapes:**
1. Sur la page de détails, cliquer sur "Confirmer Paiement"
2. Vérifier le dialogue de confirmation
3. Noter la date de fin actuelle et la nouvelle date calculée
4. Confirmer l'action
5. Vérifier la mise à jour

**Résultats attendus:**
- ✓ Dialogue affiché avec:
  - Message d'information
  - Date de fin actuelle
  - Nouvelle date de fin (actuelle + 12 mois)
- ✓ Confirmation réussie
- ✓ Date de fin mise à jour
- ✓ Statut_abonnement = 'actif'
- ✓ Actif = true
- ✓ Dernier_paiement_date mis à jour

**Vérification en base de données:**
```sql
SELECT 
  nom,
  statut_abonnement,
  date_fin,
  dernier_paiement_date,
  dernier_paiement_confirme_par
FROM etablissements
WHERE id = 'etablissement_id';

-- Vérifier le log d'audit
SELECT *
FROM audit_logs
WHERE action = 'PAYMENT_CONFIRMED'
ORDER BY date_creation DESC
LIMIT 1;
```

---

### Test 7: Suspension d'Établissement ✓

**Objectif:** Tester la suspension avec raison

**Étapes:**
1. Sur la page de détails, cliquer sur "Suspendre"
2. Vérifier le dialogue
3. Entrer une raison: "Non-paiement"
4. Confirmer
5. Vérifier la mise à jour

**Résultats attendus:**
- ✓ Dialogue affiché avec:
  - Message d'avertissement
  - Champ "Raison de la suspension" (obligatoire)
- ✓ Bouton "Suspendre" désactivé si raison vide
- ✓ Suspension réussie
- ✓ Statut_abonnement = 'suspendu'
- ✓ Actif = false
- ✓ Bouton "Réactiver" maintenant visible

**Vérification en base de données:**
```sql
SELECT nom, statut_abonnement, actif
FROM etablissements
WHERE id = 'etablissement_id';

-- Vérifier le log d'audit
SELECT *
FROM audit_logs
WHERE action = 'ESTABLISHMENT_SUSPENDED'
ORDER BY date_creation DESC
LIMIT 1;
```

---

### Test 8: Réactivation d'Établissement ✓

**Objectif:** Réactiver un établissement suspendu

**Étapes:**
1. Sur un établissement suspendu, cliquer sur "Réactiver"
2. Confirmer l'action
3. Vérifier la mise à jour

**Résultats attendus:**
- ✓ Réactivation réussie
- ✓ Statut_abonnement = 'actif'
- ✓ Actif = true
- ✓ Bouton "Suspendre" maintenant visible

**Vérification en base de données:**
```sql
SELECT nom, statut_abonnement, actif
FROM etablissements
WHERE id = 'etablissement_id';

-- Vérifier le log d'audit
SELECT *
FROM audit_logs
WHERE action = 'ESTABLISHMENT_REACTIVATED'
ORDER BY date_creation DESC
LIMIT 1;
```

---

### Test 9: Statistiques Globales ✓

**Objectif:** Vérifier l'affichage des statistiques

**Étapes:**
1. Naviguer vers "Statistiques"
2. Vérifier tous les compteurs
3. Vérifier la liste des établissements expirant bientôt

**Résultats attendus:**
- ✓ **Total:** Nombre total d'établissements
- ✓ **Actifs:** Nombre d'établissements avec statut 'actif'
- ✓ **Expirés:** Nombre d'établissements avec statut 'expire'
- ✓ **Suspendus:** Nombre d'établissements avec statut 'suspendu'
- ✓ **Utilisateurs:** Nombre total d'utilisateurs (hors admins)
- ✓ **Liste "Expirant dans les 30 jours":** Établissements actifs avec date_fin < 30 jours

**Vérification manuelle:**
```sql
-- Compter les établissements par statut
SELECT statut_abonnement, COUNT(*) as count
FROM etablissements
GROUP BY statut_abonnement;

-- Compter les utilisateurs (hors admins)
SELECT COUNT(*) as total_users
FROM profiles
WHERE etablissement_id IS NOT NULL;

-- Établissements expirant bientôt
SELECT nom, date_fin
FROM etablissements
WHERE statut_abonnement = 'actif'
  AND date_fin <= NOW() + INTERVAL '30 days'
  AND date_fin > NOW()
ORDER BY date_fin;
```

---

### Test 10: Logs d'Audit ✓

**Objectif:** Vérifier que toutes les actions sont loggées

**Étapes:**
1. Effectuer plusieurs actions (création, paiement, suspension)
2. Vérifier les logs dans la page de détails
3. Vérifier les logs en base de données

**Résultats attendus:**
- ✓ Chaque action admin crée un log
- ✓ Logs contiennent: date, action, table, détails
- ✓ user_id correspond à l'admin connecté
- ✓ etablissement_id est correctement renseigné

**Vérification en base de données:**
```sql
SELECT 
  date_creation,
  action,
  table_name,
  user_id,
  etablissement_id,
  details
FROM audit_logs
WHERE user_id = 'admin_user_id'
ORDER BY date_creation DESC
LIMIT 10;
```

---

## Tests de Navigation et UX

### Test 11: Navigation Responsive ✓

**Objectif:** Vérifier le comportement responsive

**Étapes:**
1. Tester sur différentes tailles d'écran
2. Vérifier le menu mobile (< 600px)
3. Vérifier le drawer temporaire

**Résultats attendus:**
- ✓ Desktop: Sidebar fixe visible
- ✓ Mobile: Sidebar cachée, bouton menu visible
- ✓ Drawer s'ouvre/ferme correctement
- ✓ Navigation fonctionne sur mobile

---

### Test 12: Gestion des Erreurs ✓

**Objectif:** Vérifier la gestion des erreurs

**Étapes:**
1. Tenter des actions avec des données invalides
2. Simuler des erreurs réseau (déconnecter)
3. Vérifier les messages d'erreur

**Résultats attendus:**
- ✓ Messages d'erreur clairs et en français
- ✓ Validation des formulaires
- ✓ Gestion des erreurs réseau
- ✓ Pas de crash de l'application

---

## Checklist Finale

Avant de marquer la tâche comme complète, vérifier:

- [ ] ✅ Authentification admin fonctionne
- [ ] ✅ Tous les écrans s'affichent correctement
- [ ] ✅ Création d'établissement fonctionne
- [ ] ✅ Confirmation de paiement fonctionne et étend l'abonnement
- [ ] ✅ Suspension/Réactivation fonctionnent
- [ ] ✅ Statistiques affichent les bonnes données
- [ ] ✅ Logs d'audit sont créés pour toutes les actions
- [ ] ✅ Navigation responsive fonctionne
- [ ] ✅ Gestion des erreurs est correcte
- [ ] ✅ Aucune erreur console critique

## Problèmes Connus

### Warnings TypeScript
- Définitions de types manquantes pour `@babel__generator` et `prop-types`
- **Impact:** Aucun, warnings uniquement
- **Solution:** Peut être ignoré ou résolu avec `npm install --save-dev @types/babel__generator @types/prop-types`

## Prochaines Étapes

Une fois tous les tests validés:
1. Marquer la tâche 22 comme complète
2. Passer à la tâche 23: Modifier les apps existantes pour la multi-tenancy
3. Implémenter l'affichage du nom d'établissement dans les apps
4. Ajouter les alertes d'expiration pour les patrons
5. Implémenter le blocage d'accès pour les comptes expirés
