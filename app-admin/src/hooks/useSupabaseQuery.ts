import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { supabase } from '../config/supabase';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

type QueryFunction<T> = (supabase: SupabaseClient) => PromiseLike<{ data: T | null; error: PostgrestError | null }>;

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

// Hook pour récupérer tous les établissements
export function useEtablissements(statut?: string) {
  const queryKey = statut ? ['etablissements', statut] : ['etablissements'];
  
  return useSupabaseQuery(
    queryKey,
    async (supabase) => {
      let query = supabase
        .from('etablissements')
        .select('*')
        .order('date_creation', { ascending: false });

      if (statut) {
        query = query.eq('statut_abonnement', statut);
      }

      return query;
    }
  );
}

// Hook pour récupérer un établissement par ID
export function useEtablissement(id: string) {
  return useSupabaseQuery(
    ['etablissements', id],
    (supabase) =>
      supabase
        .from('etablissements')
        .select('*')
        .eq('id', id)
        .single()
  );
}

// Hook pour récupérer les utilisateurs d'un établissement
export function useEtablissementUsers(etablissementId: string) {
  return useSupabaseQuery(
    ['profiles', 'etablissement', etablissementId],
    (supabase) =>
      supabase
        .from('profiles')
        .select('*')
        .eq('etablissement_id', etablissementId)
        .order('nom', { ascending: true })
  );
}

// Hook pour récupérer tous les utilisateurs (admin)
export function useAllUsers() {
  return useSupabaseQuery(
    ['profiles', 'all'],
    (supabase) =>
      supabase
        .from('profiles')
        .select('*, etablissement:etablissements(nom)')
        .order('nom', { ascending: true })
  );
}

// Hook pour récupérer les statistiques globales
export function useGlobalStatistics() {
  return useSupabaseQuery(
    ['statistics', 'global'],
    async (supabase) => {
      // Récupérer les statistiques des établissements
      const { data: etablissements } = await supabase
        .from('etablissements')
        .select('statut_abonnement, date_fin');

      if (!etablissements) return { data: null, error: null };

      const now = new Date();
      const in30Days = new Date();
      in30Days.setDate(in30Days.getDate() + 30);

      const stats = {
        total_etablissements: etablissements.length,
        etablissements_actifs: etablissements.filter((e: any) => e.statut_abonnement === 'actif').length,
        etablissements_expires: etablissements.filter((e: any) => e.statut_abonnement === 'expire').length,
        etablissements_suspendus: etablissements.filter((e: any) => e.statut_abonnement === 'suspendu').length,
        etablissements_expiring_soon: etablissements.filter((e: any) => {
          const dateFin = new Date(e.date_fin);
          return e.statut_abonnement === 'actif' && dateFin > now && dateFin <= in30Days;
        }).length,
      };

      // Récupérer le nombre total d'utilisateurs
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .not('role', 'eq', 'admin');

      return {
        data: {
          ...stats,
          total_users: count || 0,
        },
        error: null,
      };
    }
  );
}

// Hook pour récupérer les logs d'actions admin
export function useAdminActionsLog(limit = 100) {
  return useSupabaseQuery(
    ['admin_actions_log', limit],
    (supabase) =>
      supabase
        .from('admin_actions_log')
        .select('*')
        .order('date_creation', { ascending: false })
        .limit(limit)
  );
}

// Hook pour récupérer les logs d'actions système
export function useSystemActionsLog(limit = 100) {
  return useSupabaseQuery(
    ['system_actions_log', limit],
    (supabase) =>
      supabase
        .from('system_actions_log')
        .select('*')
        .order('date_creation', { ascending: false })
        .limit(limit)
  );
}

// Hook pour récupérer les logs d'audit d'un établissement
export function useEstablishmentAuditLog(etablissementId: string, limit = 100) {
  return useSupabaseQuery(
    ['establishment_audit_log', etablissementId, limit],
    (supabase) =>
      supabase
        .from('establishment_audit_log')
        .select('*')
        .eq('etablissement_id', etablissementId)
        .order('date_creation', { ascending: false })
        .limit(limit)
  );
}

// Hook pour récupérer les établissements expirant bientôt
export function useExpiringEtablissements(days = 30) {
  return useSupabaseQuery(
    ['etablissements', 'expiring', days],
    async (supabase) => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);

      return supabase
        .from('etablissements')
        .select('*')
        .eq('statut_abonnement', 'actif')
        .lte('date_fin', futureDate.toISOString())
        .order('date_fin', { ascending: true });
    }
  );
}
