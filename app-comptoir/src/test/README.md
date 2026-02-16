# Tests - Application Web Comptoir

## 📋 Vue d'Ensemble

Cette suite de tests couvre les composants, stores et hooks de l'application web comptoir.

## 🧪 Tests Implémentés

### Stores

1. **authStore.test.ts**
   - ✅ Initialisation avec état par défaut
   - ✅ Connexion réussie
   - ✅ Rejet de connexion pour utilisateurs non-comptoir
   - ✅ Déconnexion

### Hooks

1. **useSupabaseQuery.test.ts**
   - ✅ Récupération de données réussie
   - ✅ Gestion des erreurs

### Composants

1. **Layout.test.tsx**
   - ✅ Affichage des enfants
   - ✅ Affichage du profil utilisateur
   - ✅ Ouverture du drawer
   - ✅ Appel de signOut lors du clic sur déconnexion

## 🚀 Exécution des Tests

### Tous les tests

```bash
npm test
```

### Mode watch (développement)

```bash
npm run test:watch
```

### Avec interface UI

```bash
npm run test:ui
```

## 📊 Couverture de Code

Objectif : 80% de couverture

Fichiers couverts :
- ✅ Stores (authStore)
- ✅ Hooks (useSupabaseQuery)
- ✅ Composants (Layout)
- ⏳ Screens (à implémenter)

## 🔧 Configuration

### Vitest

Configuration dans `vitest.config.ts` :
- Environment : jsdom
- Setup file : `src/test/setup.ts`
- Coverage provider : v8

### Mocks

Mocks configurés dans `src/test/setup.ts` :
- Supabase client
- React Router

## 📝 Conventions de Test

### Nommage

- Fichiers de test : `*.test.ts` ou `*.test.tsx`
- Dossier : `__tests__` à côté du code source

### Structure

```typescript
describe('ComponentName', () => {
  beforeEach(() => {
    // Setup
  });

  it('should do something', () => {
    // Test
  });
});
```

### Assertions

Utiliser les matchers Vitest et jest-dom :
- `expect(value).toBe(expected)`
- `expect(value).toEqual(expected)`
- `expect(element).toBeInTheDocument()`
- `expect(fn).toHaveBeenCalled()`

## 🎯 Tests à Ajouter

### Priorité Haute

1. **Screens**
   - LoginScreen (formulaire, validation)
   - ValidationScreen (liste, validation)
   - FacturesScreen (onglets, encaissement)
   - StockScreen (tableau, alertes)

2. **Hooks**
   - useSupabaseMutation
   - useRealtimeSubscription

### Priorité Moyenne

3. **Tests d'Intégration**
   - Flux complet de validation de commande
   - Flux complet d'encaissement
   - Navigation entre écrans

## 🐛 Debugging

### Problème : Tests échouent avec "Cannot find module"

**Solution** : Vérifier que les imports sont corrects et que les mocks sont configurés.

### Problème : "ReferenceError: document is not defined"

**Solution** : Vérifier que `environment: 'jsdom'` est configuré dans vitest.config.ts.

### Problème : Tests Supabase échouent

**Solution** : Vérifier que le mock Supabase dans `setup.ts` est correct.

## 📚 Ressources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Library jest-dom](https://github.com/testing-library/jest-dom)
