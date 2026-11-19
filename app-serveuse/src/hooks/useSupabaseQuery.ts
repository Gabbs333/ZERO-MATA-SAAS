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

      // Catalogue complet : on ne filtre plus sur le stock > 0, sinon un produit
      // en rupture disparaît de l'écran de commande (il doit rester visible,
      // badgé « Rupture »). Les plats préparés à la commande restent illimités.
      const { data: produitsData, error: produitsError } = await supabase
        .from('produits')
        .select('*, stocks(quantite_actuelle, etablissement_id)')
        .eq('etablissement_id', etablissementId)
        .eq('actif', true)
        .order('nom');

      if (produitsError) return { data: null, error: produitsError };

      const combined = (produitsData || [])
        .map((produit: any) => {
          const rows = Array.isArray(produit.stocks)
            ? produit.stocks
            : produit.stocks
            ? [produit.stocks]
            : [];
          const ligne =
            rows.find((s: any) => s.etablissement_id === etablissementId) ?? rows[0];

          // Nourriture préparée à la commande : pas de stock physique
          const sansSuivi = produit.categorie === 'nourriture' && !produit.gestion_stock;
          const quantite = sansSuivi
            ? 9999
            : ligne
            ? Number(ligne.quantite_actuelle ?? 0)
            : produit.gestion_stock
            ? 0
            : 9999;

          const { stocks, ...rest } = produit;
          return { ...rest, stock: { quantite_disponible: quantite } };
        })
        .sort((a: any, b: any) => String(a.nom).localeCompare(String(b.nom)));

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
