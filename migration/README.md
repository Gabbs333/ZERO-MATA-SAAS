
# Guide de Migration Complète (Sans Auth/RLS)

Ce dossier contient les outils pour migrer votre projet vers une nouvelle instance Supabase, en conservant la structure, les données (y compris les utilisateurs et leurs IDs), les Edge Functions et le Realtime, mais en EXCLUANT la configuration Auth cassée et les politiques RLS.

## Étape 1 : Préparation du Schéma

Le fichier `schema.sql` a été généré automatiquement à partir de vos migrations existantes, en filtrant les politiques RLS et les triggers Auth défectueux.

1.  Allez dans le **SQL Editor** de votre **nouveau** projet Supabase.
2.  Copiez-collez le contenu de `migration/schema.sql`.
3.  Exécutez le script pour créer toutes les tables, fonctions et triggers (sauf Auth/RLS).

## Étape 2 : Export des Données (depuis l'ancien projet)

Vous devez exporter les données de l'ancien projet.
**Prérequis** : Vous avez besoin de la clé `SERVICE_ROLE_KEY` de l'ancien projet pour exporter les utilisateurs (auth.users). Si vous ne l'avez pas, seuls les profils publics seront exportés (ce qui peut poser problème pour les liaisons).

1.  Ouvrez un terminal dans le dossier du projet.
2.  Exécutez :
    ```bash
    node migration/export_data.js
    ```
3.  Entrez l'URL et la clé SERVICE_ROLE (ou Anon si vous n'avez pas mieux) quand demandé.
4.  Les données seront sauvegardées dans `migration/data.json`.

## Étape 3 : Import des Données (vers le nouveau projet)

1.  Exécutez :
    ```bash
    node migration/import_data.js
    ```
2.  Entrez l'URL et la clé **SERVICE_ROLE** du **nouveau** projet (trouvable dans Project Settings > API).
3.  Le script va :
    - Recréer les utilisateurs dans `auth.users` avec leurs IDs d'origine (mot de passe temporaire : `password123`).
    - Importer toutes les données des tables publiques en respectant l'ordre des dépendances.
    - **Note** : Le script utilise `upsert` pour gérer les conflits potentiels avec les triggers automatiques de création de profil.

## Étape 4 : Déploiement des Edge Functions

Assurez-vous d'avoir le CLI Supabase installé et d'être connecté (`supabase login`).

1.  Liez votre projet local au nouveau projet distant :
    ```bash
    supabase link --project-ref <votre-nouveau-project-id>
    ```
2.  Déployez les fonctions :
    ```bash
    sh migration/deploy_functions.sh
    ```
    (Ou `chmod +x migration/deploy_functions.sh` puis `./migration/deploy_functions.sh`)

## Étape 5 : Configuration Finale

1.  **Realtime** : Le script `schema.sql` a déjà activé le Realtime sur les tables critiques :
    - `commandes` (pour les validations et mises à jour en cuisine/comptoir)
    - `stock` (pour le suivi des quantités)
    - `tables` (pour le statut libre/occupée)
    - `factures` & `encaissements` (pour le suivi financier)
    - `ravitaillements`
    - *Note : `REPLICA IDENTITY FULL` est activé sur ces tables pour garantir que les événements UPDATE contiennent toutes les données.*

2.  **Storage** : Si vous utilisiez Supabase Storage, vous devrez recréer les buckets (ex: `exports`) et migrer les fichiers manuellement ou via un script (non inclus ici).
    - Le fichier `schema.sql` inclut la création du bucket `exports` via SQL si le script de migration le prévoyait.
3.  **RLS** : Le RLS est actuellement désactivé ou sans politiques. Vous devrez redéfinir vos règles de sécurité proprement.

## Résolution des Problèmes Courants

- **Erreur de Foreign Key (FK)** : Si `import_data.js` échoue sur `profiles`, c'est que les utilisateurs n'ont pas pu être créés dans `auth.users`. Assurez-vous d'avoir utilisé la clé SERVICE_ROLE lors de l'export ET de l'import.
- **Erreur de taille** : Si l'import échoue pour cause de payload trop gros, réduisez le `chunkSize` dans `import_data.js`.
