import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { supabase } from '../config/supabase';

// Hook pour valider une commande
export function useValidateCommande(
  options?: Omit<UseMutationOptions<any, Error, string>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation<any, Error, string>({
    mutationFn: async (commandeId: string) => {
      // La validation est entièrement prise en charge par la RPC
      // (factures scindées Bar/Cuisine, numérotation, contrôle de stock).
      // Aucun repli côté client : une erreur doit remonter telle quelle
      // pour que l'écran de validation propose les actions de déblocage.
      const { data, error } = await supabase.rpc('validate_commande', {
        p_commande_id: commandeId,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data && typeof data === 'object' && 'success' in data && data.success === false) {
        throw new Error((data as any).error || 'Erreur lors de la validation');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commandes'] });
      queryClient.invalidateQueries({ queryKey: ['stocks'] });
      queryClient.invalidateQueries({ queryKey: ['factures'] });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
    },
    ...options,
  });
}

// Hook pour créer un encaissement
interface CreateEncaissementParams {
  facture_id: string;
  montant: number;
  mode_paiement: 'especes' | 'carte' | 'mobile_money' | 'cheque';
  reference?: string;
}

export function useCreateEncaissement(
  options?: Omit<UseMutationOptions<any, Error, CreateEncaissementParams>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation<any, Error, CreateEncaissementParams>({
    mutationFn: async (params) => {
      console.log('Processing encaissement manually:', params);

      // Récupérer l'utilisateur courant pour l'établissement
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utilisateur non connecté");
      
      const etablissementId = user.user_metadata?.etablissement_id;
      if (!etablissementId) throw new Error("Etablissement non trouvé pour l'utilisateur");

      // 1. Récupérer l'état actuel de la facture
      const { data: facture, error: fetchError } = await supabase
        .from('factures')
        .select('montant_total, montant_paye, commande_id')
        .eq('id', params.facture_id)
        .single();

      if (fetchError || !facture) {
        throw new Error("Facture introuvable");
      }

      // 2. Créer l'encaissement
      // Mapping des modes de paiement pour correspondre aux contraintes de la base de données
      // DB accepte: 'especes', 'mobile_money', 'carte_bancaire'
      let modePaiementDb = params.mode_paiement as string;
      let referenceDb = params.reference;

      if (params.mode_paiement === 'carte') {
        modePaiementDb = 'carte_bancaire';
      } else if (params.mode_paiement === 'cheque') {
        // Workaround pour chèque non supporté par la contrainte DB
        modePaiementDb = 'especes'; 
        referenceDb = referenceDb ? `CHEQUE: ${referenceDb}` : 'CHEQUE';
      }

      const { data: encaissement, error: encError } = await supabase
        .from('encaissements')
        .insert({
          facture_id: params.facture_id,
          montant: params.montant,
          mode_paiement: modePaiementDb,
          reference: referenceDb,
          date_encaissement: new Date().toISOString(),
          etablissement_id: etablissementId,
          utilisateur_id: user.id
        })
        .select()
        .single();

      if (encError) {
        console.error('Error creating encaissement:', encError);
        throw new Error("Erreur lors de la création de l'encaissement: " + encError.message);
      }
      
      // 3. Mettre à jour la facture MANUELLEMENT (car le trigger peut manquer ou échouer)
      const nouveauMontantPaye = (facture.montant_paye || 0) + params.montant;
      const resteAPayer = facture.montant_total - nouveauMontantPaye;
      const isPaid = resteAPayer <= 0.01; // Tolérance pour les centimes
      
      let nouveauStatut = 'partiellement_payee';
      if (isPaid) {
        nouveauStatut = 'payee';
      }

      const { error: updateError } = await supabase
        .from('factures')
        .update({
          montant_paye: nouveauMontantPaye,
          montant_restant: resteAPayer, // Mise à jour explicite pour satisfaire la contrainte CHECK
          statut: nouveauStatut,
          // Si payée, on met à jour la date de paiement complet
          ...(isPaid ? { date_paiement_complet: new Date().toISOString() } : {})
        })
        .eq('id', params.facture_id);

      if (updateError) {
        console.error('Error updating facture:', updateError);
        // On ne lance pas d'erreur ici car l'encaissement est déjà créé, 
        // mais c'est un état inconsistant qu'il faudrait gérer.
        console.warn("Attention: Encaissement créé mais statut facture non mis à jour.");
      }

      // 4. Si la facture est payée, on clôture la commande
      // (Ceci sera aussi automatisé par trigger via la migration 20240213_payment_triggers.sql,
      // mais on garde cette sécurité au cas où la migration n'est pas encore appliquée)
      if (isPaid) {
        const { error: cmdError } = await supabase
          .from('commandes')
          .update({
            // est_payee: true, // Colonne inexistante en base pour l'instant
            statut: 'terminee' // On termine la commande si elle est payée
          })
          .eq('id', facture.commande_id);
          
         if (cmdError) {
             console.warn('Could not update commande status:', cmdError);
         }
      }
      
      return { success: true, encaissement };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['factures'] });
      queryClient.invalidateQueries({ queryKey: ['encaissements'] });
      queryClient.invalidateQueries({ queryKey: ['commandes'] }); // Update commandes list too
    },
    ...options,
  });
}

// ============================================================================
// PRISE DE COMMANDE AU COMPTOIR
// ============================================================================

export interface ComptoirOrderItem {
  produit_id: string;
  quantite: number;
}

export interface CreateCommandeComptoirParams {
  items: ComptoirOrderItem[];
  table_id?: string | null;
  type_service: 'sur_place' | 'emporter';
  client_id?: string | null;
  valider_immediatement: boolean;
}

export function useCreateCommandeComptoir(
  options?: Omit<UseMutationOptions<any, Error, CreateCommandeComptoirParams>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation<any, Error, CreateCommandeComptoirParams>({
    mutationFn: async (params) => {
      const { data, error } = await supabase.rpc('create_commande_comptoir', {
        p_items: params.items,
        p_table_id: params.table_id ?? null,
        p_type_service: params.type_service,
        p_client_id: params.client_id ?? null,
        p_valider_immediatement: params.valider_immediatement,
      });

      if (error) throw error;
      if (data && typeof data === 'object' && 'success' in data && data.success === false) {
        throw new Error((data as any).error || 'Erreur lors de la création de la commande');
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commandes'] });
      queryClient.invalidateQueries({ queryKey: ['factures'] });
      queryClient.invalidateQueries({ queryKey: ['stocks'] });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
    },
    ...options,
  });
}

// ============================================================================
// OPÉRATIONS DE STOCK (ENTRÉE / SORTIE / ÉCHANGE)
// ============================================================================

export interface StockOperationLine {
  produit_id: string;
  sens: 'entree' | 'sortie';
  quantite: number;
  prix_unitaire?: number;
}

export interface CreateStockOperationParams {
  type_operation: 'entree' | 'sortie' | 'echange';
  motif: string;
  contrepartie?: string;
  lignes: StockOperationLine[];
}

export function useCreerOperationStock(
  options?: Omit<UseMutationOptions<any, Error, CreateStockOperationParams>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation<any, Error, CreateStockOperationParams>({
    mutationFn: async (params) => {
      const { data, error } = await supabase.rpc('creer_operation_stock', {
        p_type_operation: params.type_operation,
        p_motif: params.motif,
        p_contrepartie: params.contrepartie ?? null,
        p_lignes: params.lignes,
      });

      if (error) throw error;
      if (data && typeof data === 'object' && 'success' in data && data.success === false) {
        throw new Error((data as any).error || 'Erreur lors de l\'opération de stock');
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stocks'] });
      queryClient.invalidateQueries({ queryKey: ['produits'] });
      queryClient.invalidateQueries({ queryKey: ['operations_stock'] });
    },
    ...options,
  });
}
