import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { supabase } from '../config/supabase';
import { CommandeItem } from '../types/database.types';
import { useAuthStore } from '../store/authStore';

interface CreateCommandeItem {
  produit_id: string;
  quantite: number;
}

interface CreateCommandeParams {
  table_id: string;
  items: CreateCommandeItem[];
}

export function useCreateCommande(
  options?: Omit<UseMutationOptions<any, Error, CreateCommandeParams>, 'mutationFn'>
) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation<any, Error, CreateCommandeParams>({
    mutationFn: async ({ table_id, items }) => {
      const etablissementId = user?.etablissement_id;
      if (!etablissementId) throw new Error('Établissement non défini');

      const { data, error } = await supabase.rpc('create_commande', {
        p_table_id: table_id,
        p_items: items,
      });

      if (error) throw error;

      // WORKAROUND: Fix missing etablissement_id in create_commande RPC
      // The RPC function currently doesn't set etablissement_id.
      // We manually update the created command with the current user's establishment.
      if (data && etablissementId) {
        try {
            await supabase
            .from('commandes')
            .update({ etablissement_id: etablissementId })
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

// Hook pour libérer une table (vérifie l'appartenance à l'établissement)
export function useLibererTable(
  options?: Omit<UseMutationOptions<any, Error, string>, 'mutationFn'>
) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation<any, Error, string>({
    mutationFn: async (tableId) => {
      const etablissementId = user?.etablissement_id;
      if (!etablissementId) throw new Error('Établissement non défini');

      // Verify the table belongs to this establishment
      const { data: table, error: tableError } = await supabase
        .from('tables')
        .select('id')
        .eq('id', tableId)
        .eq('etablissement_id', etablissementId)
        .single();

      if (tableError || !table) throw new Error('Table non trouvée ou non autorisée');

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
