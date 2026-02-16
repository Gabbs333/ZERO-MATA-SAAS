# Tests Property-Based pour le Stock

Ce dossier contient les tests property-based pour la gestion du stock.

## Tests Implémentés

### Propriété 11 : Complétude des mouvements de stock
**Valide : Exigence 3.5**

Vérifie que tous les mouvements de stock contiennent les champs obligatoires :
- Type (entrée/sortie)
- Quantité
- Référence
- Type de référence
- Utilisateur
- Horodatage

### Propriété 12 : Non-négativité du stock
**Valide : Contrainte métier**

Vérifie que :
- Le stock ne peut jamais être négatif
- Les tentatives de créer ou mettre à jour le stock avec des valeurs négatives sont rejetées
- Le stock reste à zéro ou positif après toutes les opérations

### Propriété 10 : Génération d'alertes de stock bas
**Valide : Exigence 3.4**

Vérifie que :
- Une alerte est générée si et seulement si le stock est inférieur ou égal au seuil minimum
- Les produits inactifs ne génèrent pas d'alertes
- Les alertes sont ordonnées par urgence (stock le plus bas en premier)
- Le niveau d'alerte est correctement calculé (critique/urgent/attention)

### Propriété 45 : Cohérence du stock - invariant
**Valide : Cohérence globale**

Vérifie que :
- Le stock actuel = somme des entrées - somme des sorties
- La cohérence est maintenue à travers plusieurs mouvements
- La cohérence est maintenue pour plusieurs produits simultanément

## Exécution des Tests

### Prérequis

Une base de données PostgreSQL doit être disponible. Vous avez plusieurs options :

#### Option 1 : Docker (Recommandé)

```bash
# Démarrer un conteneur PostgreSQL
docker run -d \
  --name snackbar-test-db \
  -p 54322:5432 \
  -e POSTGRES_PASSWORD=postgres \
  postgres:15

# Attendre que la base soit prête
sleep 5
```

#### Option 2 : Script automatique

```bash
# Utilise le script qui démarre Docker et exécute les tests
./start-db-and-test.sh
```

#### Option 3 : Supabase Local (si compatible)

```bash
# Démarrer Supabase localement
npx supabase start
```

### Exécuter les tests

```bash
# Tous les tests de stock
npm test -- tests/stock/stock.property.test.ts

# Avec couverture
npm run test:coverage -- tests/stock/stock.property.test.ts

# Mode watch
npm run test:watch -- tests/stock/stock.property.test.ts
```

### Variables d'environnement

Créez un fichier `.env` à la racine du projet :

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
```

## Nettoyage

```bash
# Arrêter et supprimer le conteneur Docker
docker stop snackbar-test-db && docker rm snackbar-test-db
```

## Notes

- Les tests utilisent `fast-check` pour générer des données aléatoires
- Chaque test s'exécute avec 30-50 itérations par défaut
- Les tests nettoient automatiquement les données après chaque exécution
- Si la base de données n'est pas disponible, les tests sont ignorés automatiquement
