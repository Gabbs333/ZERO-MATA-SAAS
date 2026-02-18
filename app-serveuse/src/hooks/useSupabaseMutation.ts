import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { supabase } from '../config/supabase';
import { CommandeItem } from '../types/database.types';

interface CreateCommandeItem {
  produit_id: string;
  quantite: number;
}

interface CreateCommandeParams {
  table_id: string;
  items: CreateCommandeItem[];
}

import { useAuthStore } from '../store/authStore';

export function useCreateCommande(
  options?: Omit<UseMutationOptions<any, Error, CreateCommandeParams>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation<any, Error, CreateCommandeParams>({
    mutationFn: async ({ table_id, items }) => {
      const { data, error } = await supabase.rpc('create_commande', {
        p_table_id: table_id,
        p_items: items,
      });

      if (error) throw error;

      // WORKAROUND: Fix missing etablissement_id in create_commande RPC
      // The RPC function currently doesn't set etablissement_id.
      // We manually update the created command with the current user's establishment.
      const userProfile = useAuthStore.getState().user;
      
      if (data && userProfile?.etablissement_id) {
        try {
            await supabase
            .from('commandes')
            .update({ etablissement_id: userProfile.etablissement_id })
            .eq('id', data);
        } catch (e) {
            console.warn('Failed to patch etablissement_id for commande:', data, e);
        }
      }

      return data;
    },
    onSuccess: () => {
      // Invalider les requêtes pour rafraîchir les données
      queryClient.invalidateQueries({ queryKey: ['my-commandes'] });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
    },
    retry: 3, // Retry 3 times on failure (offline support)
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...options,
  });
}

// Hook pour libérer une table
export function useLibererTable(
  options?: Omit<UseMutationOptions<any, Error, string>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation<any, Error, string>({
    mutationFn: async (tableId) => {
      const { error } = await supabase
        .from('tables')
        .update({ statut: 'libre' })
        .eq('id', tableId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
    },
    ...options,
  });
}
