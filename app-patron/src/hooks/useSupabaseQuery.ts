import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { supabase } from '../config/supabase';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

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

// Hook pour récupérer les KPIs
export function useKPIs(debut?: string, fin?: string) {
  return useSupabaseQuery(
    ['kpis', debut, fin],
    (supabase) => supabase.rpc('get_kpis', { debut, fin })
  );
}

// Hook pour récupérer les analytics
export function useAnalytics(debut?: string, fin?: string, granularite?: string) {
  return useSupabaseQuery(
    ['analytics', debut, fin, granularite],
    (supabase) => supabase.rpc('get_analytics', { p_debut: debut, p_fin: fin, p_granularite: granularite })
  );
}

// Hook pour récupérer le stock
export function useStock() {
  return useSupabaseQuery(
    ['stocks'],
    (supabase) =>
      supabase
        .from('stocks')
        .select('*, produits(*)')
        .order('produits(nom)', { ascending: true })
  );
}

// Hook pour récupérer les alertes de stock bas
export function useStockAlerts() {
  return useSupabaseQuery(
    ['stocks', 'alerts'],
    (supabase) => supabase.rpc('check_stock_alerts')
  );
}

// Hook pour récupérer les mouvements de stock
export function useMouvementsStock(produitId?: string) {
  const queryKey = produitId ? ['mouvements_stock', produitId] : ['mouvements_stock'];
  
  return useSupabaseQuery(
    queryKey,
    async (supabase) => {
      let query = supabase
        .from('mouvements_stock')
        .select('*, produits(*)')
        .order('date_creation', { ascending: false })
        .limit(100);

      if (produitId) {
        query = query.eq('produit_id', produitId);
      }

      return query;
    }
  );
}

// Hook pour récupérer les produits
export function useProduits() {
  return useSupabaseQuery(
    ['produits'],
    (supabase) =>
      supabase
        .from('produits')
        .select('*')
        .order('nom', { ascending: true })
  );
}

// Hook pour récupérer les ravitaillements
export function useRavitaillements(debut?: string, fin?: string) {
  const queryKey = debut && fin ? ['ravitaillements', debut, fin] : ['ravitaillements'];
  
  return useSupabaseQuery(
    queryKey,
    async (supabase) => {
      let query = supabase
        .from('ravitaillements')
        .select('*, ravitaillement_items(*), profiles(*)')
        .order('date_ravitaillement', { ascending: false });

      if (debut && fin) {
        query = query.gte('date_ravitaillement', debut).lte('date_ravitaillement', fin);
      }

      return query;
    }
  );
}

// Hook pour récupérer les factures
export function useFactures(statut?: string) {
  const queryKey = statut ? ['factures', statut] : ['factures'];
  
  return useSupabaseQuery(
    queryKey,
    async (supabase) => {
      let query = supabase
        .from('factures')
        .select('*, commandes(*), encaissements(*)')
        .order('date_creation', { ascending: false });

      if (statut) {
        query = query.eq('statut', statut);
      }

      return query;
    }
  );
}

// Hook pour récupérer les factures impayées
export function useFacturesImpayees() {
  return useSupabaseQuery(
    ['factures', 'impayees'],
    (supabase) => supabase.from('factures_overdue').select('*')
  );
}

// Hook pour récupérer les analytics CA/Encaissements
export function useAnalyticsCAEncaissements(debut?: string, fin?: string) {
  const queryKey = debut && fin ? ['analytics_ca_encaissements', debut, fin] : ['analytics_ca_encaissements'];
  
  return useSupabaseQuery(
    queryKey,
    async (supabase) => {
      let query = supabase.from('analytics_ca_encaissements').select('*');

      if (debut && fin) {
        query = query.gte('periode', debut).lte('periode', fin);
      }

      return query;
    }
  );
}

// Hook pour récupérer les utilisateurs (patron uniquement)
export function useUtilisateurs() {
  return useSupabaseQuery(
    ['profiles'],
    (supabase) =>
      supabase
        .from('profiles')
        .select('*')
        .order('nom', { ascending: true })
  );
}

// Hook pour récupérer les audit logs
export function useAuditLogs(userId?: string, action?: string) {
  const queryKey = ['audit_logs', userId, action].filter(Boolean);
  
  return useSupabaseQuery(
    queryKey,
    async (supabase) => {
      let query = supabase
        .from('audit_logs')
        .select('*, profiles(*)')
        .order('date_action', { ascending: false })
        .limit(100);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      if (action) {
        query = query.eq('action', action);
      }

      return query;
    }
  );
}

// Hook pour récupérer les transactions
export function useTransactions(filters?: any) {
  return useSupabaseQuery(
    ['transactions', filters],
    (supabase) => supabase.rpc('search_transactions', { filters })
  );
}
