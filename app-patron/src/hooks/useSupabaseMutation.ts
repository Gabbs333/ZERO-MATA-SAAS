import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { supabase } from '../config/supabase';
import type { Produit } from '../types/database.types';

// Hook pour créer un produit
export function useCreateProduit(
  options?: Omit<UseMutationOptions<any, Error, Omit<Produit, 'id' | 'date_creation'>>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation<any, Error, Omit<Produit, 'id' | 'date_creation'>>({
    mutationFn: async (produit) => {
      const { data, error } = await supabase
        .from('produits')
        .insert(produit)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produits'] });
    },
    ...options,
  });
}

// Hook pour mettre à jour un produit
export function useUpdateProduit(
  options?: Omit<UseMutationOptions<any, Error, { id: string; updates: Partial<Produit> }>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation<any, Error, { id: string; updates: Partial<Produit> }>({
    mutationFn: async ({ id, updates }) => {
      const { data, error } = await supabase
        .from('produits')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produits'] });
      queryClient.invalidateQueries({ queryKey: ['stocks'] });
    },
    ...options,
  });
}

// Hook pour désactiver un produit
export function useDeactivateProduit(
  options?: Omit<UseMutationOptions<any, Error, string>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation<any, Error, string>({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('produits')
        .update({ actif: false })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produits'] });
    },
    ...options,
  });
}

// Hook pour créer un ravitaillement
interface CreateRavitaillementParams {
  fournisseur: string;
  date_ravitaillement: string;
  items: Array<{
    produit_id: string;
    nom_produit: string;
    quantite: number;
    prix_unitaire: number;
  }>;
}

export function useCreateRavitaillement(
  options?: Omit<UseMutationOptions<any, Error, CreateRavitaillementParams>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation<any, Error, CreateRavitaillementParams>({
    mutationFn: async (params) => {
      const { data, error } = await supabase.rpc('create_ravitaillement', {
        p_fournisseur: params.fournisseur,
        p_date_ravitaillement: params.date_ravitaillement,
        p_items: params.items,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ravitaillements'] });
      queryClient.invalidateQueries({ queryKey: ['stocks'] });
      queryClient.invalidateQueries({ queryKey: ['mouvements_stock'] });
    },
    ...options,
  });
}

// Hook pour créer un utilisateur (patron uniquement)
interface CreateUserParams {
  email: string;
  password: string;
  nom: string;
  prenom: string;
  role: 'serveuse' | 'comptoir' | 'gerant' | 'patron';
}

export function useCreateUser(
  options?: Omit<UseMutationOptions<any, Error, CreateUserParams>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation<any, Error, CreateUserParams>({
    mutationFn: async (params) => {
      // Créer l'utilisateur via Supabase Auth Admin
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: params.email,
        password: params.password,
        email_confirm: true,
      });

      if (authError) throw authError;

      // Mettre à jour le profil
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .update({
          nom: params.nom,
          prenom: params.prenom,
          role: params.role,
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

// Hook pour mettre à jour un profil utilisateur
export function useUpdateProfile(
  options?: Omit<UseMutationOptions<any, Error, { id: string; updates: Partial<any> }>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation<any, Error, { id: string; updates: Partial<any> }>({
    mutationFn: async ({ id, updates }) => {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
    ...options,
  });
}

// Hook pour générer un export CSV
interface GenerateExportParams {
  type: 'ventes' | 'stock' | 'rapport';
  debut: string;
  fin: string;
}

export function useGenerateExport(
  options?: Omit<UseMutationOptions<any, Error, GenerateExportParams>, 'mutationFn'>
) {
  return useMutation<any, Error, GenerateExportParams>({
    mutationFn: async (params) => {
      const functionName = 
        params.type === 'ventes' ? 'generate-ventes-csv' :
        params.type === 'stock' ? 'generate-stock-csv' :
        'generate-rapport-pdf';

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { debut: params.debut, fin: params.fin },
      });

      if (error) throw error;
      return data;
    },
    ...options,
  });
}
