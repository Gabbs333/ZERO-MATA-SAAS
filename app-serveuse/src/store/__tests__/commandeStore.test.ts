import { useCommandeStore } from '../commandeStore';

describe('commandeStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useCommandeStore.setState({
      tableId: null,
      items: new Map(),
    });
  });

  it('sets table ID correctly', () => {
    const { setTableId } = useCommandeStore.getState();
    setTableId('table-123');
    expect(useCommandeStore.getState().tableId).toBe('table-123');
  });

  it('adds item to commande', () => {
    const { addItem } = useCommandeStore.getState();
    const produit = {
      id: 'prod-1',
      nom: 'Coca Cola',
      prix_vente: 500,
      categorie: 'boisson' as const,
      actif: true,
      etablissement_id: 'etab-1',
      date_creation: '2023-01-01',
      stock: { quantite_disponible: 100 },
    };

    addItem(produit, 2);

    const items = useCommandeStore.getState().items;
    expect(items.size).toBe(1);
    expect(items.get('prod-1')).toEqual({
      produit_id: 'prod-1',
      quantite: 2,
      produit: produit,
    });
  });

  it('updates quantity when adding existing item', () => {
    const { addItem } = useCommandeStore.getState();
    const produit = {
      id: 'prod-1',
      nom: 'Coca Cola',
      prix_vente: 500,
      categorie: 'boisson' as const,
      actif: true,
      etablissement_id: 'etab-1',
      date_creation: '2023-01-01',
      stock: { quantite_disponible: 100 },
    };

    addItem(produit, 2);
    addItem(produit, 3);

    const items = useCommandeStore.getState().items;
    expect(items.get('prod-1')?.quantite).toBe(5);
  });

  it('updates quantity correctly', () => {
    const { addItem, updateQuantite } = useCommandeStore.getState();
    const produit = {
      id: 'prod-1',
      nom: 'Coca Cola',
      prix_vente: 500,
      categorie: 'boisson' as const,
      actif: true,
      etablissement_id: 'etab-1',
      date_creation: '2023-01-01',
      stock: { quantite_disponible: 100 },
    };

    addItem(produit, 5);
    updateQuantite('prod-1', 3);

    const items = useCommandeStore.getState().items;
    expect(items.get('prod-1')?.quantite).toBe(3);
  });

  it('removes item when quantity is 0', () => {
    const { addItem, updateQuantite } = useCommandeStore.getState();
    const produit = {
      id: 'prod-1',
      nom: 'Coca Cola',
      prix_vente: 500,
      categorie: 'boisson' as const,
      actif: true,
      etablissement_id: 'etab-1',
      date_creation: '2023-01-01',
      stock: { quantite_disponible: 100 },
    };

    addItem(produit, 2);
    updateQuantite('prod-1', 0);

    const items = useCommandeStore.getState().items;
    expect(items.size).toBe(0);
  });

  it('calculates total amount correctly', () => {
    const { addItem, getMontantTotal } = useCommandeStore.getState();

    addItem(
      { 
        id: 'prod-1', 
        nom: 'Coca Cola', 
        prix_vente: 500, 
        categorie: 'boisson' as const, 
        actif: true,
        stock: { quantite_disponible: 100 },
        etablissement_id: 'etab-1',
        date_creation: '2023-01-01'
      },
      2
    );
    addItem(
      { 
        id: 'prod-2', 
        nom: 'Sandwich', 
        prix_vente: 1000, 
        categorie: 'nourriture' as const, 
        actif: true,
        stock: { quantite_disponible: 100 },
        etablissement_id: 'etab-1',
        date_creation: '2023-01-01'
      },
      1
    );

    expect(getMontantTotal()).toBe(2000); // (500 * 2) + (1000 * 1)
  });

  it('returns items as array', () => {
    const { addItem, getItemsArray } = useCommandeStore.getState();

    addItem(
      { 
        id: 'prod-1', 
        nom: 'Coca Cola', 
        prix_vente: 500, 
        categorie: 'boisson' as const, 
        actif: true,
        stock: { quantite_disponible: 100 },
        etablissement_id: 'etab-1',
        date_creation: '2023-01-01'
      },
      2
    );
    addItem(
      { 
        id: 'prod-2', 
        nom: 'Sandwich', 
        prix_vente: 1000, 
        categorie: 'nourriture' as const, 
        actif: true,
        stock: { quantite_disponible: 100 },
        etablissement_id: 'etab-1',
        date_creation: '2023-01-01'
      },
      1
    );

    const itemsArray = getItemsArray();
    expect(itemsArray).toHaveLength(2);
    expect(itemsArray[0]).toEqual({
      produit_id: 'prod-1',
      quantite: 2,
    });
  });

  it('clears commande correctly', () => {
    const { setTableId, addItem, clearCommande } = useCommandeStore.getState();

    setTableId('table-123');
    addItem(
      { 
        id: 'prod-1', 
        nom: 'Coca Cola', 
        prix_vente: 500, 
        categorie: 'boisson' as const, 
        actif: true,
        stock: { quantite_disponible: 100 },
        etablissement_id: 'etab-1',
        date_creation: '2023-01-01'
      },
      2
    );

    clearCommande();

    const state = useCommandeStore.getState();
    expect(state.tableId).toBeNull();
    expect(state.items.size).toBe(0);
  });
});
