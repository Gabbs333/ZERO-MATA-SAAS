import { useQuery, UseQueryOptions, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '../config/supabase';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import type { CommandeWithDetails, StockWithProduit, FactureWithDetails } from '../types/database.types';

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

// Hook pour récupérer les commandes en attente
export function useCommandesEnAttente(limit: number = 50) {
  return useSupabaseQuery<CommandeWithDetails[]>(
    ['commandes', 'en_attente', limit],
    async (supabase) => {
      console.log('Fetching commandes (MANUAL JOINS)...');
      
      // 1. Récupérer les commandes brutes
      const { data: commandes, error: cmdError } = await supabase
        .from('commandes')
        .select(`
          id, 
          statut, 
          montant_total, 
          date_creation,
          numero_commande,
          table_id,
          serveuse_id,
          etablissement_id
        `)
        .eq('statut', 'en_attente') // Filtre actif
        .order('date_creation', { ascending: false })
        .limit(limit);
      
      if (cmdError) {
        console.error('Error fetching commandes:', cmdError);
        throw cmdError;
      }
      
      if (!commandes || commandes.length === 0) {
        return { data: [], error: null };
      }

      // 2. Récupérer les données liées manuellement
      const commandeIds = commandes.map(c => c.id);
      const tableIds = [...new Set(commandes.map(c => c.table_id).filter(Boolean))];
      const serveuseIds = [...new Set(commandes.map(c => c.serveuse_id).filter(Boolean))];

      // Fetch Items
      const { data: items } = await supabase
        .from('commande_items')
        .select(`
          *,
          produits (
            id,
            nom
          )
        `)
        .in('commande_id', commandeIds);

      // Fetch Tables
      const { data: tables } = await supabase
        .from('tables')
        .select('id, numero')
        .in('id', tableIds);

      // Fetch Profiles (Serveuses)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nom, prenom')
        .in('id', serveuseIds);

      // 3. Reconstituer les objets
      const enrichedData = commandes.map(cmd => ({
        ...cmd,
        commande_items: items?.filter(i => i.commande_id === cmd.id) || [],
        tables: tables?.find(t => t.id === cmd.table_id) || { numero: '?' },
        profiles: profiles?.find(p => p.id === cmd.serveuse_id) || { nom: 'Inconnu', prenom: '' }
      }));
      
      console.log('Commandes constructed:', enrichedData);
      
      return { data: enrichedData as any, error: null };
    },
    {
      // Optimisation des performances
      // Réduire le staleTime pour les commandes en attente car c'est critique
      staleTime: 1000 * 10, // 10 secondes (au lieu de 60s)
      refetchInterval: 1000 * 30, // Polling de secours toutes les 30s
    }
  );
}

// Hook pour récupérer l'historique des commandes avec filtres
export function useCommandesHistory(
  filters: {
    startDate?: string;
    endDate?: string;
    serveuseId?: string;
    statut?: 'payee' | 'annulee' | 'en_attente' | 'all';
    searchQuery?: string;
  },
  limit: number = 50
) {
  return useSupabaseQuery<CommandeWithDetails[]>(
    ['commandes', 'history', filters, limit],
    async (supabase) => {
      console.log('Fetching history commandes...', filters);
      
      let query = supabase
        .from('commandes')
        .select(`
          id, 
          statut, 
          montant_total, 
          date_creation,
          numero_commande,
          table_id,
          serveuse_id,
          etablissement_id
        `)
        .order('date_creation', { ascending: false })
        .limit(limit);

      if (filters.startDate) {
        query = query.gte('date_creation', filters.startDate);
      }
      
      if (filters.endDate) {
        query = query.lte('date_creation', filters.endDate);
      }
      
      if (filters.serveuseId && filters.serveuseId !== 'all') {
        query = query.eq('serveuse_id', filters.serveuseId);
      }
      
      if (filters.statut && filters.statut !== 'all') {
        query = query.eq('statut', filters.statut);
      }

      if (filters.searchQuery) {
        query = query.ilike('numero_commande', `%${filters.searchQuery}%`);
      }
      
      const { data: commandes, error: cmdError } = await query;
      
      if (cmdError) {
        console.error('Error fetching history:', cmdError);
        throw cmdError;
      }
      
      if (!commandes || commandes.length === 0) {
        return { data: [], error: null };
      }

      // Récupérer les données liées manuellement
      const commandeIds = commandes.map(c => c.id);
      const tableIds = [...new Set(commandes.map(c => c.table_id).filter(Boolean))];
      const serveuseIds = [...new Set(commandes.map(c => c.serveuse_id).filter(Boolean))];

      // Fetch Items
      const { data: items } = await supabase
        .from('commande_items')
        .select(`
          *,
          produits (
            id,
            nom
          )
        `)
        .in('commande_id', commandeIds);

      // Fetch Tables
      const { data: tables } = await supabase
        .from('tables')
        .select('id, numero')
        .in('id', tableIds);

      // Fetch Profiles (Serveuses)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nom, prenom')
        .in('id', serveuseIds);

      // Reconstituer les objets
      const enrichedData = commandes.map(cmd => ({
        ...cmd,
        commande_items: items?.filter(i => i.commande_id === cmd.id) || [],
        tables: tables?.find(t => t.id === cmd.table_id) || { numero: '?' },
        profiles: profiles?.find(p => p.id === cmd.serveuse_id) || { nom: 'Inconnu', prenom: '' }
      }));
      
      return { data: enrichedData as any, error: null };
    },
    {
      placeholderData: keepPreviousData,
      staleTime: 1000 * 60, // 1 minute
    }
  );
}

// Hook pour récupérer la liste des serveuses
export function useServeuses() {
  return useSupabaseQuery<{ id: string; nom: string; prenom: string }[]>(
    ['serveuses'],
    async (supabase) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nom, prenom')
        .eq('role', 'serveuse'); // Assuming 'role' exists and is used to identify waitstaff
        
      if (error) throw error;
      return { data, error: null };
    },
    {
      staleTime: 1000 * 60 * 60, // 1 hour
    }
  );
}

// Hook pour récupérer le stock
export function useStock() {
  return useSupabaseQuery<StockWithProduit[]>(
    ['stocks'],
    (supabase) =>
      supabase
        .from('stocks')
        .select('*, produits(*)')
        .order('produits(nom)', { ascending: true })
  );
}

// Hook pour récupérer les factures
export function useFactures(statut?: string, limit: number = 50, startDate?: string, endDate?: string) {
  const queryKey = statut ? ['factures', statut, limit, startDate, endDate] : ['factures', 'all', limit, startDate, endDate];
  
  return useSupabaseQuery<FactureWithDetails[]>(
    queryKey,
    async (supabase) => {
      let query = supabase
        .from('factures')
        .select(`
          *, 
          commandes (
            *, 
            tables (numero), 
            profiles!serveuse_id (nom, prenom),
            commande_items (*)
          ), 
          encaissements (*)
        `)
        .order('date_generation', { ascending: false });

      if (limit > 0 && !startDate) {
        query = query.limit(limit);
      }

      if (statut) {
        query = query.eq('statut', statut);
      }
      
      if (startDate) {
        query = query.gte('date_generation', startDate);
      }

      if (endDate) {
        query = query.lte('date_generation', endDate);
      }

      return query;
    }
  );
}

// Hook pour récupérer les alertes de stock bas
export function useStockAlerts() {
  return useSupabaseQuery(
    ['stocks', 'alerts'],
    (supabase) => supabase.rpc('check_stock_alerts')
  );
}

// Hook pour récupérer les alertes de factures impayées
export function useFacturesImpayeesAlerts() {
  return useSupabaseQuery(
    ['factures', 'impayees', 'alerts'],
    async (supabase) => {
      // Utilisation d'une requête directe au lieu de RPC pour plus de robustesse
      // Critère: Factures non payées datant de plus de 24h
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('factures')
        .select(`
          id,
          numero_facture,
          montant_total,
          montant_restant,
          date_generation,
          statut
        `)
        .neq('statut', 'payee')
        .lt('date_generation', yesterday);

      if (error) {
        console.warn("Erreur récupération alertes factures (fallback)", error);
        return { data: [], error: null }; // On ne bloque pas l'app pour ça
      }
      
      return { data: data || [], error: null };
    }
  );
}
