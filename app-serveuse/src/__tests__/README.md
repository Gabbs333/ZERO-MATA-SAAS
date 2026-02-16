# Tests - Application Mobile Serveuse

## 📋 Vue d'Ensemble

Cette suite de tests couvre les composants, stores et hooks de l'application mobile.

## 🧪 Tests Implémentés

### Composants

1. **TableCard.test.tsx**
   - ✅ Affichage du numéro de table
   - ✅ Affichage correct du statut (libre, occupée, commande en attente)
   - ✅ Affichage de la capacité

2. **ProductItem.test.tsx**
   - ✅ Affichage du nom et prix du produit
   - ✅ Affichage de la quantité
   - ✅ Appel de onAdd lors du clic sur le bouton +
   - ✅ Appel de onRemove lors du clic sur le bouton -
   - ✅ Masquage du bouton - quand quantité = 0

### Stores

1. **commandeStore.test.ts**
   - ✅ Définition de l'ID de table
   - ✅ Ajout d'un item à la commande
   - ✅ Mise à jour de la quantité d'un item existant
   - ✅ Suppression d'un item quand quantité = 0
   - ✅ Calcul du montant total
   - ✅ Conversion des items en tableau
   - ✅ Réinitialisation de la commande

## 🚀 Exécution des Tests

### Tous les tests

```bash
npm test
```

### Mode watch (développement)

```bash
npm run test:watch
```

### Avec couverture de code

```bash
npm run test:coverage
```

## 📊 Couverture de Code

Objectif : 80% de couverture

Fichiers couverts :
- ✅ Composants (TableCard, ProductItem, CommandeSummary)
- ✅ Stores (commandeStore)
- ⏳ Hooks (à implémenter)
- ⏳ Screens (à implémenter)

## 🔧 Configuration

### Jest

Configuration dans `jest.config.js` :
- Preset : `jest-expo`
- Transform ignore patterns pour React Native
- Setup file : `jest.setup.js`

### Mocks

Mocks configurés dans `jest.setup.js` :
- AsyncStorage
- Supabase client
- React Native Animated

## 📝 Conventions de Test

### Nommage

- Fichiers de test : `*.test.tsx` ou `*.test.ts`
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

Utiliser les matchers Jest :
- `expect(value).toBe(expected)`
- `expect(value).toEqual(expected)`
- `expect(value).toBeTruthy()`
- `expect(fn).toHaveBeenCalled()`

## 🎯 Tests à Ajouter

### Priorité Haute

1. **Hooks**
   - useSupabaseQuery
   - useSupabaseMutation
   - useRealtimeSubscription

2. **Screens**
   - LoginScreen (authentification)
   - TablesScreen (liste et interactions)
   - CommandeScreen (création de commande)

### Priorité Moyenne

3. **Stores**
   - authStore (authentification et session)

4. **Services**
   - OfflineQueue (file d'attente offline)

### Priorité Basse

5. **Tests d'Intégration**
   - Flux complet de création de commande
   - Navigation entre écrans
   - Synchronisation Realtime

## 🐛 Debugging

### Problème : Tests échouent avec "Cannot find module"

**Solution** : Vérifier que les imports sont corrects et que les mocks sont configurés.

### Problème : "useNativeDriver is not supported"

**Solution** : Déjà mocké dans `jest.setup.js`.

### Problème : Tests Supabase échouent

**Solution** : Vérifier que le mock Supabase dans `jest.setup.js` est correct.

## 📚 Ressources

- [Jest Documentation](https://jestjs.io/)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Testing React Native Apps](https://reactnative.dev/docs/testing-overview)
- [Expo Testing](https://docs.expo.dev/develop/unit-testing/)
