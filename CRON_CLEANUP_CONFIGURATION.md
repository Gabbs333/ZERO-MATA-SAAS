# Configuration du Cron Job pour le Nettoyage Automatique des Exports

## Vue d'Ensemble

Le système de nettoyage automatique supprime les fichiers d'export de plus de 30 jours du bucket `exports` pour optimiser l'utilisation du stockage.

**Edge Function déployée** : `cleanup-exports`  
**URL** : `https://wgzbpgauajgxkxoezlqw.supabase.co/functions/v1/cleanup-exports`  
**Status** : ACTIVE ✅

---

## Configuration du Cron Job

### Recommandations de Planification

**Fréquence recommandée** : Quotidienne  
**Heure recommandée** : 2:00 AM UTC (heures creuses)  
**Expression Cron** : `0 2 * * *`

**Justification** :
- **Quotidien** : Assure un nettoyage régulier sans surcharge
- **2:00 AM UTC** : Correspond généralement aux heures de faible trafic
- **30 jours de rétention** : Équilibre entre disponibilité et optimisation du stockage

### Options de Configuration

#### Option 1 : Cron-job.org (Recommandé - Gratuit)

**Service** : [cron-job.org](https://cron-job.org)

**Étapes de configuration** :

1. **Créer un compte** sur cron-job.org

2. **Créer un nouveau cron job** :
   - **Title** : Cleanup Supabase Exports
   - **URL** : `https://wgzbpgauajgxkxoezlqw.supabase.co/functions/v1/cleanup-exports`
   - **Schedule** : `0 2 * * *` (Every day at 2:00 AM)
   - **Request Method** : POST
   - **Request Timeout** : 30 seconds

3. **Configurer l'authentification** :
   - **Headers** :
     ```
     Authorization: Bearer YOUR_CLEANUP_SECRET_KEY
     Content-Type: application/json
     ```

4. **Configurer les notifications** (optionnel) :
   - Email en cas d'échec
   - Webhook pour monitoring

5. **Activer le job**

**Avantages** :
- ✅ Gratuit pour usage basique
- ✅ Interface simple
- ✅ Notifications d'échec
- ✅ Historique des exécutions
- ✅ Pas de maintenance

#### Option 2 : EasyCron (Alternative)

**Service** : [easycron.com](https://www.easycron.com)

**Configuration similaire** :
- URL : `https://wgzbpgauajgxkxoezlqw.supabase.co/functions/v1/cleanup-exports`
- Cron Expression : `0 2 * * *`
- Custom Headers : `Authorization: Bearer YOUR_CLEANUP_SECRET_KEY`

**Avantages** :
- ✅ Plan gratuit disponible
- ✅ Interface intuitive
- ✅ Logs détaillés

#### Option 3 : GitHub Actions (Pour projets open source)

**Fichier** : `.github/workflows/cleanup-exports.yml`

```yaml
name: Cleanup Exports

on:
  schedule:
    # Runs at 2:00 AM UTC every day
    - cron: '0 2 * * *'
  workflow_dispatch: # Allow manual trigger

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Call Cleanup Edge Function
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.CLEANUP_SECRET_KEY }}" \
            -H "Content-Type: application/json" \
            https://wgzbpgauajgxkxoezlqw.supabase.co/functions/v1/cleanup-exports
```

**Configuration** :
1. Ajouter le secret `CLEANUP_SECRET_KEY` dans GitHub Secrets
2. Commit le fichier workflow
3. Le job s'exécutera automatiquement

**Avantages** :
- ✅ Gratuit pour projets publics
- ✅ Intégré au repository
- ✅ Logs dans GitHub Actions
- ✅ Déclenchement manuel possible

#### Option 4 : Service Cloud (AWS EventBridge, Google Cloud Scheduler)

**AWS EventBridge** :
```json
{
  "schedule": "cron(0 2 * * ? *)",
  "target": {
    "url": "https://wgzbpgauajgxkxoezlqw.supabase.co/functions/v1/cleanup-exports",
    "headers": {
      "Authorization": "Bearer YOUR_CLEANUP_SECRET_KEY"
    }
  }
}
```

**Google Cloud Scheduler** :
```bash
gcloud scheduler jobs create http cleanup-exports \
  --schedule="0 2 * * *" \
  --uri="https://wgzbpgauajgxkxoezlqw.supabase.co/functions/v1/cleanup-exports" \
  --http-method=POST \
  --headers="Authorization=Bearer YOUR_CLEANUP_SECRET_KEY"
```

**Avantages** :
- ✅ Haute disponibilité
- ✅ Monitoring intégré
- ✅ Scalabilité

**Inconvénients** :
- ❌ Coût (généralement faible mais non gratuit)
- ❌ Configuration plus complexe

---

## Configuration de la Clé Secrète

### Génération de la Clé Secrète

**Méthode 1 : Ligne de commande**
```bash
# Générer une clé aléatoire sécurisée (32 caractères)
openssl rand -base64 32
```

**Méthode 2 : Node.js**
```javascript
require('crypto').randomBytes(32).toString('base64')
```

**Méthode 3 : En ligne**
- Utiliser un générateur de mots de passe sécurisé
- Minimum 32 caractères
- Inclure lettres, chiffres et caractères spéciaux

### Configuration dans Supabase

1. **Accéder au Dashboard Supabase** :
   - Projet : monsnack
   - URL : https://supabase.com/dashboard/project/wgzbpgauajgxkxoezlqw

2. **Naviguer vers Settings > Edge Functions**

3. **Ajouter une variable d'environnement** :
   - **Name** : `CLEANUP_SECRET_KEY`
   - **Value** : [Votre clé générée]
   - **Scope** : All functions (ou spécifiquement cleanup-exports)

4. **Sauvegarder**

**⚠️ Important** : 
- Ne jamais committer la clé secrète dans le code
- Utiliser la même clé dans le service cron et dans Supabase
- Changer la clé régulièrement (tous les 6 mois)

---

## Test du Cron Job

### Test Manuel

**Commande curl** :
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_CLEANUP_SECRET_KEY" \
  -H "Content-Type: application/json" \
  https://wgzbpgauajgxkxoezlqw.supabase.co/functions/v1/cleanup-exports
```

**Réponse attendue (aucun fichier à supprimer)** :
```json
{
  "success": true,
  "message": "No files older than 30 days found",
  "filesDeleted": 0,
  "totalFiles": 0,
  "cutoffDate": "2025-12-23T02:00:00.000Z"
}
```

**Réponse attendue (fichiers supprimés)** :
```json
{
  "success": true,
  "message": "Cleanup completed successfully",
  "filesDeleted": 5,
  "totalFiles": 10,
  "cutoffDate": "2025-12-23T02:00:00.000Z",
  "deletedFiles": [
    "ventes_2025-11-01_2025-11-30_1234567890.csv",
    "stock_2025-11-01_2025-11-30_1234567891.csv",
    ...
  ]
}
```

### Vérification des Logs

**Via Supabase Dashboard** :
1. Aller dans Edge Functions > cleanup-exports
2. Cliquer sur "Logs"
3. Vérifier les exécutions récentes

**Via CLI Supabase** (si installé) :
```bash
supabase functions logs cleanup-exports
```

### Vérification dans Audit Logs

**Requête SQL** :
```sql
SELECT * FROM audit_logs
WHERE action = 'CLEANUP_EXPORTS'
ORDER BY created_at DESC
LIMIT 10;
```

---

## Monitoring et Alertes

### Métriques à Surveiller

1. **Taux de succès** : Doit être > 99%
2. **Nombre de fichiers supprimés** : Varie selon l'utilisation
3. **Durée d'exécution** : Doit être < 30 secondes
4. **Erreurs** : Doit être proche de 0

### Configuration des Alertes

**Alertes recommandées** :
- ✉️ Email si le job échoue 2 fois consécutives
- ✉️ Email si aucun fichier n'est supprimé pendant 60 jours (peut indiquer un problème)
- ✉️ Email si la durée d'exécution dépasse 60 secondes

**Services de monitoring** :
- Cron-job.org (intégré)
- UptimeRobot
- Pingdom
- Datadog (pour monitoring avancé)

---

## Maintenance

### Vérifications Mensuelles

- [ ] Vérifier que le cron job s'exécute correctement
- [ ] Vérifier les logs pour détecter des erreurs
- [ ] Vérifier l'espace de stockage utilisé
- [ ] Vérifier que les fichiers de plus de 30 jours sont bien supprimés

### Vérifications Trimestrielles

- [ ] Revoir la politique de rétention (30 jours toujours approprié ?)
- [ ] Vérifier les coûts de stockage
- [ ] Mettre à jour la clé secrète si nécessaire
- [ ] Tester manuellement le nettoyage

### En Cas de Problème

**Problème** : Le cron job ne s'exécute pas
- Vérifier que le service cron est actif
- Vérifier l'URL de l'Edge Function
- Vérifier la clé secrète

**Problème** : Erreur 401/403
- Vérifier que la clé secrète est correcte
- Vérifier que la variable d'environnement est configurée dans Supabase

**Problème** : Erreur 500
- Vérifier les logs de l'Edge Function
- Vérifier que le bucket `exports` existe
- Vérifier les permissions du service role key

**Problème** : Fichiers non supprimés
- Vérifier la date de création des fichiers
- Vérifier que la logique de filtrage fonctionne
- Tester manuellement avec curl

---

## Sécurité

### Bonnes Pratiques

✅ **Utiliser une clé secrète forte** (32+ caractères)
✅ **Ne jamais exposer la clé publiquement**
✅ **Changer la clé régulièrement** (tous les 6 mois)
✅ **Limiter l'accès à l'Edge Function** (pas de JWT, uniquement secret key)
✅ **Monitorer les exécutions** pour détecter des abus
✅ **Logger les actions** dans audit_logs

### Rotation de la Clé Secrète

**Procédure** :
1. Générer une nouvelle clé secrète
2. Mettre à jour la variable d'environnement dans Supabase
3. Mettre à jour la clé dans le service cron
4. Tester avec la nouvelle clé
5. Invalider l'ancienne clé

---

## Résumé de la Configuration

| Paramètre | Valeur |
|-----------|--------|
| **Edge Function** | cleanup-exports |
| **URL** | https://wgzbpgauajgxkxoezlqw.supabase.co/functions/v1/cleanup-exports |
| **Méthode** | POST |
| **Authentification** | Bearer Token (CLEANUP_SECRET_KEY) |
| **Fréquence** | Quotidienne |
| **Heure** | 2:00 AM UTC |
| **Cron Expression** | `0 2 * * *` |
| **Rétention** | 30 jours |
| **Timeout** | 30 secondes |

---

## Prochaines Étapes

1. ✅ Edge Function déployée
2. ⏳ Générer une clé secrète
3. ⏳ Configurer la variable d'environnement dans Supabase
4. ⏳ Choisir un service cron (recommandé : cron-job.org)
5. ⏳ Configurer le cron job
6. ⏳ Tester manuellement
7. ⏳ Configurer les alertes
8. ⏳ Documenter dans le README du projet

---

**Document créé le** : 22 janvier 2026  
**Par** : Kiro AI Assistant  
**Status** : Configuration prête pour déploiement ✅
