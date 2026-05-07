import { useQuery } from '@tanstack/react-query';
import { supabase } from '../config/supabase';

export interface CommandeItemWithRetour {
  id: string;
  commande_id: string;
  produit_id: string;
  nom_produit: string;
  quantite: number;
  prix_unitaire: number;
  montant_ligne: number;
  quantite_retournee: number;
  quantite_en_attente: number;
  statut_retour: 'total' | 'partiel' | 'en_attente' | 'aucun';
  est_total_retour: boolean;
  est_partiel_retour: boolean;
  est_en_attente_retour: boolean;
  quantite_totale_retournee: number;
}

export function useCommandeItemsWithRetours(commandeId?: string) {
  return useQuery<CommandeItemWithRetour[]>({
    queryKey: ['commande-items-with-retours', commandeId],
    queryFn: async () => {
      if (!commandeId) return [];
      
      const { data, error } = await supabase
        .from('commande_items_with_retours')
        .select('*')
        .eq('commande_id', commandeId)
        .order('nom_produit', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!commandeId
  });
}