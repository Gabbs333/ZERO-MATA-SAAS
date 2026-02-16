import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { supabase } from '../config/supabase';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { Table, ProduitAvecStock } from '../types/database.types';

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

// Hook spécifique pour récupérer les tables
export function useTables() {
  return useSupabaseQuery<Table[]>(
    ['tables'],
    (supabase) =>
      supabase
        .from('tables')
        .select('*')
        .order('numero', { ascending: true })
  );
}

// Hook spécifique pour récupérer les produits disponibles
export function useProduitsDisponibles() {
  return useSupabaseQuery<ProduitAvecStock[]>(
    ['produits-disponibles'],
    async (supabase) => {
      const { data, error } = await supabase
        .from('stocks')
        .select('*, produits!inner(*)')
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
    }
  );
}

// Hook pour récupérer les créances de la serveuse
export function useCreancesServeuse(serveuseId: string | undefined) {
  return useSupabaseQuery(
    ['creances', serveuseId],
    async (supabase) => {
      if (!serveuseId) return { data: [], error: null };
      
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
        .eq('commandes.serveuse_id', serveuseId)
        .neq('statut', 'payee') // On veut ce qui n'est PAS payé
        .neq('statut', 'annulee')
        .order('date_generation', { ascending: false });
    },
    {
      enabled: !!serveuseId,
      // Refetch on mount and window focus to ensure freshness
      refetchOnMount: true,
      refetchOnWindowFocus: true
    }
  );
}

// Hook pour récupérer les commandes de la serveuse
export function useMyCommandes(serveuseId: string | undefined) {
  return useSupabaseQuery(
    ['my-commandes', serveuseId],
    async (supabase) => {
      if (!serveuseId) return { data: [], error: null };
      
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
        .eq('serveuse_id', serveuseId)
        .order('date_creation', { ascending: false })
        .limit(20);
    },
    {
      enabled: !!serveuseId,
    }
  );
}

// Hook pour récupérer les commandes actives d'une table
export function useTableActiveCommandes(tableId: string | null) {
  return useSupabaseQuery(
    ['table-active-commandes', tableId],
    async (supabase) => {
      if (!tableId) return { data: [], error: null };
      
      return supabase
        .from('commandes')
        .select(`
          *,
          commande_items (
            *,
            produits (nom, prix_vente)
          )
        `)
        .eq('table_id', tableId)
        .in('statut', ['en_attente', 'en_cours', 'prete', 'servie', 'validee'])
        .order('date_creation', { ascending: false });
    },
    {
      enabled: !!tableId,
      staleTime: 1000 * 30, // 30 seconds
    }
  );
}
