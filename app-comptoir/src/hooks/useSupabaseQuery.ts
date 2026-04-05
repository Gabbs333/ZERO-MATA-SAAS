import { useQuery, UseQueryOptions, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '../config/supabase';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import type { CommandeWithDetails, StockWithProduit, FactureWithDetails } from '../types/database.types';
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

// Hook pour récupérer les commandes en attente (filtré par établissement)
export function useCommandesEnAttente(limit: number = 50) {
  const { profile } = useAuthStore();
  const etablissementId = profile?.etablissement_id;

  return useSupabaseQuery<CommandeWithDetails[]>(
    ['commandes', 'en_attente', limit, etablissementId],
    async (supabase) => {
      if (!etablissementId) return { data: [], error: null };

      console.log('Fetching commandes (MANUAL JOINS)...');
      
      // 1. Récupérer les commandes brutes filtrées par établissement
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
        .eq('statut', 'en_attente')
        .eq('etablissement_id', etablissementId)
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

      // Fetch Tables (filtré par établissement)
      const { data: tables } = await supabase
        .from('tables')
        .select('id, numero')
        .eq('etablissement_id', etablissementId)
        .in('id', tableIds);

      // Fetch Profiles (Serveuses)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nom, prenom')
        .eq('etablissement_id', etablissementId)
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
      enabled: !!etablissementId,
      staleTime: 1000 * 10,
      refetchInterval: 1000 * 30,
    }
  );
}

// Hook pour récupérer l'historique des commandes avec filtres (filtré par établissement)
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
  const { profile } = useAuthStore();
  const etablissementId = profile?.etablissement_id;

  return useSupabaseQuery<CommandeWithDetails[]>(
    ['commandes', 'history', filters, limit, etablissementId],
    async (supabase) => {
      if (!etablissementId) return { data: [], error: null };

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
        .eq('etablissement_id', etablissementId)
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

      // Fetch Tables (filtré par établissement)
      const { data: tables } = await supabase
        .from('tables')
        .select('id, numero')
        .eq('etablissement_id', etablissementId)
        .in('id', tableIds);

      // Fetch Profiles (Serveuses)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nom, prenom')
        .eq('etablissement_id', etablissementId)
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
      enabled: !!etablissementId,
      placeholderData: keepPreviousData,
      staleTime: 1000 * 60,
    }
  );
}

// Hook pour récupérer la liste des serveuses (filtré par établissement)
export function useServeuses() {
  const { profile } = useAuthStore();
  const etablissementId = profile?.etablissement_id;

  return useSupabaseQuery<{ id: string; nom: string; prenom: string }[]>(
    ['serveuses', etablissementId],
    async (supabase) => {
      if (!etablissementId) return { data: [], error: null };

      const { data, error } = await supabase
        .from('profiles')
        .select('id, nom, prenom')
        .eq('role', 'serveuse')
        .eq('etablissement_id', etablissementId);
        
      if (error) throw error;
      return { data, error: null };
    },
    {
      enabled: !!etablissementId,
      staleTime: 1000 * 60 * 60,
    }
  );
}

// Hook pour récupérer le stock (filtré par établissement)
export function useStock() {
  const { profile } = useAuthStore();
  const etablissementId = profile?.etablissement_id;

  return useSupabaseQuery<StockWithProduit[]>(
    ['stocks', etablissementId],
    (supabase) => {
      if (!etablissementId) return Promise.resolve({ data: [], error: null });
      return supabase
        .from('stocks')
        .select('*, produits(*)')
        .eq('etablissement_id', etablissementId)
        .order('produits(nom)', { ascending: true });
    },
    { enabled: !!etablissementId }
  );
}

// Hook pour récupérer les factures (filtré par établissement)
export function useFactures(statut?: string, limit: number = 50, startDate?: string, endDate?: string) {
  const { profile } = useAuthStore();
  const etablissementId = profile?.etablissement_id;

  const queryKey = statut 
    ? ['factures', statut, limit, startDate, endDate, etablissementId] 
    : ['factures', 'all', limit, startDate, endDate, etablissementId];
  
  return useSupabaseQuery<FactureWithDetails[]>(
    queryKey,
    async (supabase) => {
      if (!etablissementId) return { data: [], error: null };

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
        .eq('etablissement_id', etablissementId)
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
    },
    { enabled: !!etablissementId }
  );
}

// Hook pour récupérer les alertes de stock bas (filtré par établissement)
export function useStockAlerts() {
  const { profile } = useAuthStore();
  const etablissementId = profile?.etablissement_id;

  return useSupabaseQuery(
    ['stocks', 'alerts', etablissementId],
    async (supabase) => {
      if (!etablissementId) return { data: [], error: null };
      const { data, error } = await supabase
        .from('stocks')
        .select('*, produits(nom)')
        .eq('etablissement_id', etablissementId)
        .lte('quantite_actuelle', 5); // Alert if stock <= 5
      
      if (error) throw error;
      return { data, error: null };
    },
    { enabled: !!etablissementId }
  );
}

// Hook pour récupérer les alertes de factures impayées (filtré par établissement)
export function useFacturesImpayeesAlerts() {
  const { profile } = useAuthStore();
  const etablissementId = profile?.etablissement_id;

  return useSupabaseQuery(
    ['factures', 'impayees', 'alerts', etablissementId],
    async (supabase) => {
      if (!etablissementId) return { data: [], error: null };

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
        .eq('etablissement_id', etablissementId)
        .neq('statut', 'payee')
        .lt('date_generation', yesterday);

      if (error) {
        console.warn("Erreur récupération alertes factures (fallback)", error);
        return { data: [], error: null };
      }
      
      return { data: data || [], error: null };
    },
    { enabled: !!etablissementId }
  );
}
