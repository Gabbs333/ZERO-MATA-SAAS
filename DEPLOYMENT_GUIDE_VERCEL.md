# Guide de Déploiement Vercel (Gratuit)

Ce document explique comment déployer les applications **app-patron**, **app-comptoir** et **app-admin** sur Vercel gratuitement pour des tests en environnement de production.

Vercel est idéal pour les applications React (Vite) car il offre un hébergement performant, un certificat SSL (HTTPS) automatique et une configuration simple.

## Prérequis

1.  Un compte [Vercel](https://vercel.com/signup) (gratuit).
2.  Node.js et npm installés sur votre machine.
3.  (Optionnel) Un compte GitHub/GitLab/Bitbucket si vous souhaitez automatiser les déploiements via Git.

---

## Configuration Préalable (Déjà effectuée)

J'ai ajouté un fichier `vercel.json` dans chaque dossier d'application (`app-patron`, `app-comptoir`, `app-admin`). Ce fichier est crucial pour les applications "Single Page Application" (SPA) comme React, car il redirige toutes les requêtes vers `index.html`, évitant ainsi les erreurs 404 lors du rafraîchissement d'une page.

**Contenu du fichier `vercel.json` :**
```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

---

## Méthode 1 : Déploiement Manuel via CLI (Recommandé pour un test rapide)

Cette méthode permet de déployer directement depuis votre terminal sans passer par GitHub. C'est le moyen le plus rapide de mettre en ligne une version de test.

### 1. Installer Vercel CLI

Ouvrez votre terminal et exécutez :

```bash
npm install -g vercel
```

### 2. Se connecter à Vercel

```bash
vercel login
```
Suivez les instructions à l'écran (généralement via e-mail ou GitHub).

### 3. Déployer chaque application

Vous devez déployer chaque application séparément.

#### Pour app-patron :

1.  Naviguez dans le dossier :
    ```bash
    cd app-patron
    ```
2.  Lancez le déploiement :
    ```bash
    vercel
    ```
3.  Répondez aux questions :
    - **Set up and deploy "~/Documents/Verrouillage/app-patron"?** `y`
    - **Which scope do you want to deploy to?** (Sélectionnez votre compte personnel)
    - **Link to existing project?** `n`
    - **What’s your project’s name?** `zero-mata-patron` (ou un autre nom unique)
    - **In which directory is your code located?** `./` (Appuyez simplement sur Entrée)
    - **Want to modify these settings?** `n` (Vercel détecte automatiquement Vite)

4.  **Important : Ajouter les variables d'environnement**
    Une fois le projet créé, vous devez ajouter les clés Supabase pour que l'app fonctionne.
    
    Allez sur le dashboard Vercel de votre projet `zero-mata-patron` -> **Settings** -> **Environment Variables**.
    Ajoutez les variables suivantes (valeurs trouvées dans votre fichier `.env` local) :
    - `VITE_SUPABASE_URL`
    - `VITE_SUPABASE_ANON_KEY`

    Alternativement, lors de la commande `vercel`, si on vous demande d'importer les variables d'environnement, vous pouvez dire `y`.

5.  Redéployer pour prendre en compte les variables :
    ```bash
    vercel --prod
    ```

#### Pour app-comptoir :

Répétez les mêmes étapes :
1.  `cd ../app-comptoir`
2.  `vercel`
    - Nom du projet : `zero-mata-comptoir`
3.  Configurez les variables d'environnement sur Vercel.
4.  `vercel --prod`

#### Pour app-admin :

Répétez les mêmes étapes :
1.  `cd ../app-admin`
2.  `vercel`
    - Nom du projet : `zero-mata-admin`
3.  Configurez les variables d'environnement sur Vercel.
4.  `vercel --prod`

---

## Méthode 2 : Déploiement via Git (Recommandé pour la production)

Cette méthode connecte votre dépôt GitHub à Vercel. Chaque "push" sur la branche principale déclenchera un nouveau déploiement automatique.

1.  Poussez votre code complet (`Verrouillage`) sur un dépôt GitHub (privé ou public).
2.  Allez sur le [Dashboard Vercel](https://vercel.com/dashboard) et cliquez sur **"Add New..."** -> **"Project"**.
3.  Importez votre dépôt Git `Verrouillage`.
4.  **Configuration du Monorepo** :
    Comme vous avez plusieurs apps dans un seul dépôt, vous devez configurer 3 projets Vercel distincts liés au même dépôt, mais avec des "Root Directory" différents.

    **Projet 1 (Patron) :**
    - **Root Directory** : Cliquez sur "Edit" et sélectionnez `app-patron`.
    - **Environment Variables** : Ajoutez `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.
    - Cliquez sur **Deploy**.

    **Projet 2 (Comptoir) :**
    - Refaites "Add New Project" -> Importez le même dépôt.
    - **Root Directory** : Sélectionnez `app-comptoir`.
    - Ajoutez les variables d'environnement.
    - Cliquez sur **Deploy**.

    **Projet 3 (Admin) :**
    - Refaites "Add New Project" -> Importez le même dépôt.
    - **Root Directory** : Sélectionnez `app-admin`.
    - Ajoutez les variables d'environnement.
    - Cliquez sur **Deploy**.

---

## Résumé des URLs

Une fois déployées, vos applications seront accessibles via des URLs du type :
- Patron : `https://zero-mata-patron.vercel.app`
- Comptoir : `https://zero-mata-comptoir.vercel.app`
- Admin : `https://zero-mata-admin.vercel.app`

Ces URLs sont sécurisées (HTTPS) et peuvent être partagées avec vos testeurs.
