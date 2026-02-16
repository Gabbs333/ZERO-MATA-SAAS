import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { supabase } from '../config/supabase';
import type { Etablissement } from '../types/database.types';

// Hook pour créer un établissement
interface CreateEtablissementParams {
  nom: string;
  adresse?: string;
  telephone?: string;
  email?: string;
}

export function useCreateEtablissement(
  options?: Omit<UseMutationOptions<any, Error, CreateEtablissementParams>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation<any, Error, CreateEtablissementParams>({
    mutationFn: async (params) => {
      const { data, error } = await supabase
        .from('etablissements')
        .insert({
          nom: params.nom,
          adresse: params.adresse,
          telephone: params.telephone,
          email: params.email,
          statut_abonnement: 'actif',
          date_debut: new Date().toISOString(),
          date_fin: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // +12 mois
          actif: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['etablissements'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
    },
    ...options,
  });
}

// Hook pour mettre à jour un établissement
export function useUpdateEtablissement(
  options?: Omit<UseMutationOptions<any, Error, { id: string; updates: Partial<Etablissement> }>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation<any, Error, { id: string; updates: Partial<Etablissement> }>({
    mutationFn: async ({ id, updates }) => {
      const { data, error } = await supabase
        .from('etablissements')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['etablissements'] });
      queryClient.invalidateQueries({ queryKey: ['etablissements', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
    },
    ...options,
  });
}

// Hook pour confirmer un paiement et étendre l'abonnement
interface ConfirmPaymentParams {
  etablissementId: string;
  adminUserId: string;
}

export function useConfirmPayment(
  options?: Omit<UseMutationOptions<any, Error, ConfirmPaymentParams>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation<any, Error, ConfirmPaymentParams>({
    mutationFn: async (params) => {
      const { data, error } = await supabase.rpc('confirm_payment_and_extend_subscription', {
        p_etablissement_id: params.etablissementId,
        p_admin_utilisateur_id: params.adminUserId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['etablissements'] });
      queryClient.invalidateQueries({ queryKey: ['etablissements', variables.etablissementId] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
      queryClient.invalidateQueries({ queryKey: ['admin_actions_log'] });
    },
    ...options,
  });
}

// Hook pour suspendre un établissement
interface SuspendEtablissementParams {
  etablissementId: string;
  adminUserId: string;
  reason: string;
}

export function useSuspendEtablissement(
  options?: Omit<UseMutationOptions<any, Error, SuspendEtablissementParams>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation<any, Error, SuspendEtablissementParams>({
    mutationFn: async (params) => {
      const { data, error } = await supabase.rpc('suspend_etablissement', {
        p_etablissement_id: params.etablissementId,
        p_admin_utilisateur_id: params.adminUserId,
        p_reason: params.reason,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['etablissements'] });
      queryClient.invalidateQueries({ queryKey: ['etablissements', variables.etablissementId] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
      queryClient.invalidateQueries({ queryKey: ['admin_actions_log'] });
    },
    ...options,
  });
}

// Hook pour réactiver un établissement
interface ReactivateEtablissementParams {
  etablissementId: string;
  adminUserId: string;
}

export function useReactivateEtablissement(
  options?: Omit<UseMutationOptions<any, Error, ReactivateEtablissementParams>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation<any, Error, ReactivateEtablissementParams>({
    mutationFn: async (params) => {
      const { data, error } = await supabase.rpc('reactivate_etablissement', {
        p_etablissement_id: params.etablissementId,
        p_admin_utilisateur_id: params.adminUserId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['etablissements'] });
      queryClient.invalidateQueries({ queryKey: ['etablissements', variables.etablissementId] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
      queryClient.invalidateQueries({ queryKey: ['admin_actions_log'] });
    },
    ...options,
  });
}

// Hook pour créer un utilisateur admin
interface CreateAdminUserParams {
  email: string;
  password: string;
  nom: string;
  prenom: string;
}

export function useCreateAdminUser(
  options?: Omit<UseMutationOptions<any, Error, CreateAdminUserParams>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation<any, Error, CreateAdminUserParams>({
    mutationFn: async (params) => {
      // Créer l'utilisateur via Supabase Auth Admin
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: params.email,
        password: params.password,
        email_confirm: true,
      });

      if (authError) throw authError;

      // Mettre à jour le profil avec le rôle admin
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .update({
          nom: params.nom,
          prenom: params.prenom,
          role: 'admin',
          etablissement_id: null,
        })
        .eq('id', authData.user.id)
        .select()
        .single();

      if (profileError) throw profileError;

      return profileData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
    ...options,
  });
}
