import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { supabase } from '../config/supabase';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { Table, ProduitAvecStock } from '../types/database.types';
import { useAuthStore } from '../store/authStore';

type QueryFunction<T> = (supabase: SupabaseClient<any, "public", any>) => PromiseLike<{ data: T | null; error: PostgrestError | null }>;

export function useSupabaseQuery<T>(
  queryKey: any[],
  queryFn: QueryFunction<T>,
  options?: Omit<UseQueryOptions<T, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<T, Error>({
    queryKey,
    queryFn: async () => {
      const { data, error } = await queryFn(supabase);
      if (error) throw error;
      return data as T;
    },
    ...options,
  });
}

// Hook spécifique pour récupérer les tables d'un établissement
export function useTables() {
  const { user } = useAuthStore();
  const etablissementId = user?.etablissement_id;

  return useSupabaseQuery<Table[]>(
    ['tables', etablissementId],
    (supabase) => {
      if (!etablissementId) return Promise.resolve({ data: [], error: null });
      return supabase
        .from('tables')
        .select('*')
        .eq('etablissement_id', etablissementId)
        .order('numero', { ascending: true });
    },
    { enabled: !!etablissementId }
  );
}

// Hook spécifique pour récupérer les produits disponibles d'un établissement
export function useProduitsDisponibles() {
  const { user } = useAuthStore();
  const etablissementId = user?.etablissement_id;

  return useSupabaseQuery<ProduitAvecStock[]>(
    ['produits-disponibles', etablissementId],
    async (supabase) => {
      if (!etablissementId) return { data: [], error: null };

      const { data, error } = await supabase
        .from('stocks')
        .select('*, produits!inner(*)')
        .eq('etablissement_id', etablissementId)
        .gt('quantite_actuelle', 0)
        .order('produits(nom)', { ascending: true });

      if (error) return { data: null, error };

      // Transformer les données pour correspondre à ProduitAvecStock
      const formattedData = data.map((item: any) => ({
        ...item.produits,
        stock: {
          quantite_disponible: item.quantite_actuelle
        }
      }));

      return { data: formattedData, error: null };
    },
    { enabled: !!etablissementId }
  );
}

// Hook pour récupérer les créances de la serveuse (filtré par établissement)
export function useCreancesServeuse(serveuseId: string | undefined) {
  const { user } = useAuthStore();
  const etablissementId = user?.etablissement_id;

  return useSupabaseQuery(
    ['creances', serveuseId, etablissementId],
    async (supabase) => {
      if (!serveuseId || !etablissementId) return { data: [], error: null };
      
      return supabase
        .from('factures')
        .select(`
          *,
          commandes!inner (
            id,
            numero_commande,
            serveuse_id,
            tables (numero)
          )
        `)
        .eq('etablissement_id', etablissementId)
        .eq('commandes.serveuse_id', serveuseId)
        .neq('statut', 'payee')
        .neq('statut', 'annulee')
        .order('date_generation', { ascending: false });
    },
    {
      enabled: !!serveuseId && !!etablissementId,
      refetchOnMount: true,
      refetchOnWindowFocus: true
    }
  );
}

// Hook pour récupérer les commandes de la serveuse (filtré par établissement)
export function useMyCommandes(serveuseId: string | undefined) {
  const { user } = useAuthStore();
  const etablissementId = user?.etablissement_id;

  return useSupabaseQuery(
    ['my-commandes', serveuseId, etablissementId],
    async (supabase) => {
      if (!serveuseId || !etablissementId) return { data: [], error: null };
      
      return supabase
        .from('commandes')
        .select(`
          *,
          tables (numero),
          commande_items (
            *,
            produits (nom, prix_vente)
          )
        `)
        .eq('etablissement_id', etablissementId)
        .eq('serveuse_id', serveuseId)
        .order('date_creation', { ascending: false })
        .limit(20);
    },
    {
      enabled: !!serveuseId && !!etablissementId,
    }
  );
}

// Hook pour récupérer les commandes actives d'une table (filtré par établissement)
export function useTableActiveCommandes(tableId: string | null) {
  const { user } = useAuthStore();
  const etablissementId = user?.etablissement_id;

  return useSupabaseQuery(
    ['table-active-commandes', tableId, etablissementId],
    async (supabase) => {
      if (!tableId || !etablissementId) return { data: [], error: null };
      
      return supabase
        .from('commandes')
        .select(`
          *,
          commande_items (
            *,
            produits (nom, prix_vente)
          )
        `)
        .eq('etablissement_id', etablissementId)
        .eq('table_id', tableId)
        .in('statut', ['en_attente', 'en_cours', 'prete', 'servie', 'validee'])
        .order('date_creation', { ascending: false });
    },
    {
      enabled: !!tableId && !!etablissementId,
      staleTime: 1000 * 30,
    }
  );
}
