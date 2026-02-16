import { create } from 'zustand';
import { CommandeItem, ProduitAvecStock } from '../types/database.types';

interface CartItem {
  produit_id: string;
  quantite: number;
  produit: ProduitAvecStock;
}

interface CommandeState {
  tableId: string | null;
  items: Map<string, CartItem>;
  setTableId: (tableId: string | null) => void;
  addItem: (produit: ProduitAvecStock, quantite?: number) => void;
  removeItem: (produitId: string) => void;
  updateQuantite: (produitId: string, quantite: number) => void;
  clearCommande: () => void;
  getMontantTotal: () => number;
  getItemsArray: () => { produit_id: string; quantite: number }[];
}

export const useCommandeStore = create<CommandeState>((set, get) => ({
  tableId: null,
  items: new Map(),
  
  setTableId: (tableId) => set({ tableId }),
  
  addItem: (produit, quantite = 1) => {
    const items = new Map(get().items);
    const existing = items.get(produit.id);
    
    if (existing) {
      items.set(produit.id, {
        ...existing,
        quantite: existing.quantite + quantite,
      });
    } else {
      items.set(produit.id, {
        produit_id: produit.id,
        quantite,
        produit,
      });
    }
    
    set({ items });
  },
  
  removeItem: (produitId) => {
    const items = new Map(get().items);
    items.delete(produitId);
    set({ items });
  },
  
  updateQuantite: (produitId, quantite) => {
    const items = new Map(get().items);
    const item = items.get(produitId);
    
    if (item) {
      if (quantite <= 0) {
        items.delete(produitId);
      } else {
        items.set(produitId, { ...item, quantite });
      }
      set({ items });
    }
  },
  
  clearCommande: () => set({ tableId: null, items: new Map() }),
  
  getMontantTotal: () => {
    const items = Array.from(get().items.values());
    return items.reduce((total, item) => {
      return total + (item.produit.prix_vente * item.quantite);
    }, 0);
  },
  
  getItemsArray: () => {
    return Array.from(get().items.values()).map(item => ({
      produit_id: item.produit_id,
      quantite: item.quantite,
    }));
  },
}));
