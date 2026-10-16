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

// Hook spécifique pour récupérer les produits disponibles d'un établissement (boissons en stock + nourriture illimitée)
export function useProduitsDisponibles() {
  const { user } = useAuthStore();
  const etablissementId = user?.etablissement_id;

  return useSupabaseQuery<ProduitAvecStock[]>(
    ['produits-disponibles', etablissementId],
    async (supabase) => {
      if (!etablissementId) return { data: [], error: null };

      // 1. Récupérer les stocks des boissons et autres articles gérés en stock (> 0)
      const { data: stockData, error: stockError } = await supabase
        .from('stocks')
        .select('*, produits!inner(*)')
        .eq('etablissement_id', etablissementId)
        .gt('quantite_actuelle', 0);

      if (stockError) return { data: null, error: stockError };

      // 2. Récupérer tous les plats de nourriture (qui ne nécessitent pas de stock)
      const { data: nourritureData, error: nourritureError } = await supabase
        .from('produits')
        .select('*')
        .eq('etablissement_id', etablissementId)
        .eq('categorie', 'nourriture');

      if (nourritureError) return { data: null, error: nourritureError };

      // Transformer les stocks en ProduitAvecStock
      const formattedStocks = (stockData || []).map((item: any) => ({
        ...item.produits,
        stock: {
          quantite_disponible: item.quantite_actuelle
        }
      }));

      // Transformer la nourriture avec un stock fictif illimité/disponible
      const formattedNourriture = (nourritureData || []).map((produit: any) => ({
        ...produit,
        stock: {
          quantite_disponible: 9999 // Illimité pour la cuisine
        }
      }));

      // Fusionner les deux listes et trier par nom
      const combined = [...formattedStocks, ...formattedNourriture].sort((a, b) => 
        a.nom.localeCompare(b.nom)
      );

      return { data: combined, error: null };
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
