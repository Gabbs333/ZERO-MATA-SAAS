# Système de Gestion de Snack-Bar - Spécification Complète

## Vue d'Ensemble

Ce système résout le problème de détournement de stock dans les snack-bars au Cameroun en créant une chaîne traçable depuis la commande client jusqu'au service et à l'encaissement, rendant impossible la vente de produits hors du stock officiel.

## Architecture : Supabase (Serverless)

### Pourquoi Supabase ?

✅ **Zéro compétence DevOps requise**
✅ **Déploiement en quelques heures**
✅ **Coûts prévisibles** (0-25 USD/mois)
✅ **Accès distant natif** pour les patrons
✅ **Backups automatiques**
✅ **Scalabilité automatique**

### Stack Technique

- **Backend** : Supabase (PostgreSQL + Auth + Realtime + Storage + Edge Functions)
- **Frontend Mobile** : React Native + Expo (serveuses)
- **Frontend Web** : React + Vite (comptoir + patron)
- **Hébergement** : Supabase Cloud + Vercel
- **Tests** : Vitest + fast-check (property-based testing)

## Documents de Spécification

### 📋 requirements.md
Document des exigences avec 15 exigences principales et 75 critères d'acceptation au format EARS.

**Exigences clés** :
1. Prise de commande numérisée
2. Validation centralisée au comptoir
3. Suivi du stock en temps réel
4. Enregistrement des ravitaillements
5. Tableau de bord analytique
6. Synchronisation des données
7. Gestion des rôles et accès
8. Traçabilité complète des ventes
9. Interface utilisateur optimisée
10. Gestion des tables
11. Rapports et exports
12. Gestion des produits
13. **Génération et gestion des factures**
14. **Suivi des encaissements**
15. **Distinction CA et encaissements**

### 🏗️ design.md
Document de design technique complet avec :
- Architecture Supabase serverless
- Modèle de données (12 entités)
- Row Level Security (RLS) policies
- 58 propriétés de correction pour tests property-based
- Stratégies de résilience (mode offline, backup 4G)
- Choix technologiques détaillés

### ✅ tasks.md
Plan d'implémentation avec 21 tâches principales organisées en 12 phases :
1. Configuration Supabase et base de données
2. Authentification et autorisation (RLS)
3. Gestion des produits et du stock
4. Gestion des commandes
5. Gestion des ravitaillements
5.5. **Gestion des factures et encaissements**
6. Gestion des tables
7. Analytique et rapports
8. Synchronisation en temps réel
9. Application mobile serveuse
10. Application web comptoir
11. Application web tableau de bord patron
12. Tests d'intégration et déploiement

## Fonctionnalités Principales

### 1. Cycle de Vie d'une Commande

```
Création (serveuse)
    ↓
Validation (comptoir) → Stock décrémenté
    ↓
Facture générée automatiquement
    ↓
Service des produits
    ↓
Encaissement (espèces/mobile money/carte)
    ↓
Facture marquée comme payée
```

### 2. Traçabilité Complète

- Chaque commande : serveuse, table, heure, produits, montants
- Chaque validation : validateur, heure, stock avant/après
- Chaque encaissement : montant, mode de paiement, heure
- Audit complet de toutes les actions

### 3. Gestion Financière

- **Chiffre d'affaires** : Montant des commandes servies
- **Encaissements** : Montant réellement payé
- **Créances** : CA - Encaissements (factures impayées)
- **Alertes** : Factures impayées > 24h
- **Statistiques** : Par mode de paiement, par période

### 4. Mode Offline

- Commandes stockées localement si Internet tombe
- Synchronisation automatique au retour de connexion
- Indicateur visuel du statut de connexion
- Pas d'interruption du service

## Stratégie d'Évolution

### Phase 1 : Démarrage (0-12 mois) - ACTUEL
- **Architecture** : Supabase Cloud
- **Objectif** : Validation du marché
- **Coût** : 0-25 USD/mois par snack-bar

### Phase 2 : Croissance (12-24 mois)
- **Architecture** : Supabase + services custom (si besoin)
- **Objectif** : Optimisation et fonctionnalités avancées
- **Coût** : 25-50 USD/mois par snack-bar

### Phase 3 : Maturité (24+ mois)
- **Architecture** : Migration vers on-premise (optionnelle)
- **Objectif** : Réduction des coûts récurrents
- **Déclencheur** : 30-50 snack-bars actifs
- **Référence** : Voir `design-onpremise-backup.md` et `tasks-onpremise-backup.md`

## Installation et Déploiement

### Prérequis
- Compte Supabase (gratuit)
- Compte Vercel (gratuit)
- WiFi au snack-bar
- Téléphones pour les serveuses
- Tablette pour le comptoir

### Étapes d'Installation

1. **Configuration Supabase** (1 heure)
   ```bash
   # Créer un projet Supabase
   # Importer le schéma SQL
   # Configurer les RLS policies
   # Créer les utilisateurs
   ```

2. **Déploiement Frontend** (30 minutes)
   ```bash
   # Déployer sur Vercel
   git push origin main
   # Vercel déploie automatiquement
   ```

3. **Installation au snack-bar** (30 minutes)
   - Installer l'app mobile sur les téléphones
   - Ouvrir l'app web sur la tablette
   - Se connecter avec les identifiants

**Total : 2 heures** (vs plusieurs jours pour on-premise)

## Coûts Estimés

### Coûts de Démarrage
- **Supabase** : 0 USD (free tier)
- **Vercel** : 0 USD (free tier)
- **Développement** : Variable selon l'équipe

### Coûts Mensuels (Production)
- **Supabase Pro** : 25 USD/mois
- **Vercel** : 0-20 USD/mois (selon trafic)
- **Backup 4G** (optionnel) : 10-20 USD/mois
- **Total** : **35-65 USD/mois par snack-bar**

### Comparaison avec On-Premise
| Période | Supabase | On-Premise |
|---------|----------|------------|
| Année 1 | 300 USD | 1,500 USD |
| Année 2 | 360 USD | 300 USD |
| Année 3 | 420 USD | 300 USD |
| **Break-even** | - | Après 2-3 ans |

## Tests et Qualité

### Couverture de Test
- **58 propriétés de correction** testées avec property-based testing
- **Tests unitaires** pour les cas spécifiques
- **Tests d'intégration** end-to-end
- **Objectif de couverture** : 80%

### Framework de Test
- **Vitest** : Tests unitaires rapides
- **fast-check** : Property-based testing
- **Playwright** : Tests end-to-end
- **React Testing Library** : Tests de composants

## Support et Maintenance

### Monitoring
- **Supabase Dashboard** : Métriques en temps réel
- **Sentry** (optionnel) : Tracking des erreurs
- **Alertes automatiques** : Factures impayées, stock bas

### Backups
- **Automatiques** : Quotidiens par Supabase
- **Manuels** : Exports CSV hebdomadaires
- **Rétention** : 7-30 jours selon le tier

### Mises à Jour
- **Supabase** : Automatiques (géré par Supabase)
- **Frontend** : Via Git push (déploiement automatique)
- **Pas de downtime** : Déploiements zero-downtime

## Prochaines Étapes

1. ✅ **Spécification complète** (terminée)
2. 🔄 **Développement** (à démarrer)
   - Commencer par la Phase 1 : Configuration Supabase
   - Suivre le plan dans `tasks.md`
3. 🎯 **Déploiement pilote** (après développement)
   - Tester dans 1-2 snack-bars
   - Recueillir les retours
   - Ajuster si nécessaire
4. 🚀 **Déploiement production** (après validation)
   - Rollout progressif
   - Formation du personnel
   - Support continu

## Fichiers de Référence

- `requirements.md` : Exigences détaillées
- `design.md` : Architecture technique Supabase
- `tasks.md` : Plan d'implémentation Supabase
- `ARCHITECTURE-STRATEGY.md` : Stratégie d'évolution
- `design-onpremise-backup.md` : Architecture on-premise (backup)
- `tasks-onpremise-backup.md` : Plan on-premise (backup)

## Contact et Support

Pour toute question sur cette spécification, consulter les documents détaillés ou contacter l'équipe de développement.

---

**Version** : 2.0 (Supabase)
**Date** : Janvier 2025
**Statut** : Prêt pour implémentation
