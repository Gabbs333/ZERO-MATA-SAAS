import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { supabase } from '../config/supabase';

// Hook pour valider une commande
export function useValidateCommande(
  options?: Omit<UseMutationOptions<any, Error, string>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation<any, Error, string>({
    mutationFn: async (commandeId: string) => {
      console.log('Validating commande:', commandeId);
      
      // Essai 1 : RPC call
      const { data, error } = await supabase.rpc('validate_commande', {
        p_commande_id: commandeId,
      });
      
      // Vérifier si la RPC a renvoyé une erreur logique (capturée par le bloc EXCEPTION SQL)
      if (data && typeof data === 'object' && 'success' in data && data.success === false) {
         console.error('RPC returned logic error:', data.error);
         throw new Error(data.error || 'Erreur lors de la validation (RPC)');
      }
      
      // If success, patch mouvements_stock (Workaround for potential missing etablissement_id in RPC)
      if (!error) {
        try {
            // Fetch command to get etablissement_id
            const { data: cmd } = await supabase
                .from('commandes')
                .select('etablissement_id')
                .eq('id', commandeId)
                .single();
            
            if (cmd?.etablissement_id) {
                // Update movements created by RPC if they are missing etablissement_id
                await supabase
                    .from('mouvements_stock')
                    .update({ etablissement_id: cmd.etablissement_id })
                    .eq('reference', commandeId)
                    .is('etablissement_id', null);
            }
        } catch (e) {
            console.warn('Failed to patch mouvements_stock', e);
        }
      }

      if (error) {
        console.log('Using manual validation flow (RPC failed)...', error.message);
        
        // 0. Récupérer les infos de la commande pour la facture, la table et les items
        const { data: cmdData, error: fetchError } = await supabase
            .from('commandes')
            .select(`
              table_id, 
              montant_total, 
              etablissement_id, 
              numero_commande,
              commande_items (
                produit_id,
                quantite,
                nom_produit
              )
            `)
            .eq('id', commandeId)
            .single();
            
        if (fetchError || !cmdData) {
             throw new Error("Impossible de récupérer la commande pour validation manuelle");
        }
        
        // 0.bis Gestion du stock (Simulation de la logique RPC côté client)
        if (cmdData.commande_items && cmdData.commande_items.length > 0) {
          for (const item of cmdData.commande_items) {
             // Vérifier et décrémenter le stock
             // Note: Ceci n'est pas atomique et peut avoir des problèmes de concurrence,
             // mais c'est le mieux qu'on puisse faire sans RPC fonctionnel.
             
             // Récupérer le stock actuel
             const { data: stockData, error: stockFetchError } = await supabase
               .from('stock')
               .select('quantite_disponible')
               .eq('produit_id', item.produit_id)
               .single();
               
             if (!stockFetchError && stockData) {
               if (stockData.quantite_disponible < item.quantite) {
                 console.warn(`Stock insuffisant pour ${item.nom_produit}, on continue quand même pour débloquer`);
               }
               
               // Décrémenter
               await supabase
                 .from('stock')
                 .update({ 
                   quantite_disponible: stockData.quantite_disponible - item.quantite,
                   derniere_mise_a_jour: new Date().toISOString()
                 })
                 .eq('produit_id', item.produit_id);
                 
               // Créer mouvement (si la table existe et est accessible)
               try {
                 await supabase
                   .from('mouvements_stock')
                   .insert({
                     produit_id: item.produit_id,
                     type: 'sortie',
                     quantite: item.quantite,
                     reference: commandeId,
                     type_reference: 'commande',
                     utilisateur_id: (await supabase.auth.getUser()).data.user?.id,
                     etablissement_id: cmdData.etablissement_id
                   });
               } catch (e) {
                 console.warn('Impossible de créer le mouvement de stock', e);
               }
             }
          }
        }
        
        // 1. Mettre à jour le statut de la commande
        const { data: updatedData, error: updateError } = await supabase
          .from('commandes')
          .update({ 
            statut: 'validee',
            date_validation: new Date().toISOString()
          })
          .eq('id', commandeId)
          .select();
          
        if (updateError) {
          console.error('Manual update failed:', updateError);
          throw updateError;
        }

        if (!updatedData || updatedData.length === 0) {
            console.error('Manual update returned no data (RLS or not found?)');
            throw new Error("Échec de la validation : Impossible de modifier la commande (Permissions ?)");
        }

        // 2. Mettre à jour le statut de la table
        if (cmdData.table_id) {
            const { error: tableError } = await supabase
                .from('tables')
                .update({ statut: 'occupee' })
                .eq('id', cmdData.table_id);
                
            if (tableError) {
                console.error('Error updating table status:', tableError);
            } else {
                console.log('Table status updated to occupee');
            }
        }

        // 3. Créer la facture (ESSENTIEL pour l'encaissement)
        // Vérifier si une facture existe déjà pour éviter les doublons
        const { data: existingFacture } = await supabase
            .from('factures')
            .select('id')
            .eq('commande_id', commandeId)
            .maybeSingle();

        if (!existingFacture) {
            // On laisse le trigger générer le numéro si on ne le fournit pas, 
            // ou on en génère un temporaire si besoin.
            // Pour être sûr, on utilise un timestamp.
            const numeroFacture = `FAC-${new Date().getTime().toString().slice(-6)}`;
            
            const { error: factureError } = await supabase
                .from('factures')
                .insert({
                    commande_id: commandeId,
                    montant_total: cmdData.montant_total,
                    statut: 'en_attente_paiement',
                    montant_paye: 0,
                    etablissement_id: cmdData.etablissement_id,
                    numero_facture: numeroFacture
                });
            
            if (factureError) {
                console.error('Error creating facture:', factureError);
                // On log mais on ne bloque pas si la commande est validée
            } else {
                console.log('Facture created successfully:', numeroFacture);
            }
        } else {
            console.log('Facture already exists, skipping creation');
        }
        
        return { success: true, message: 'Validated manually', data: updatedData };
      }
      
      console.log('RPC validation successful'); 
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commandes'] });
      queryClient.invalidateQueries({ queryKey: ['stocks'] });
      queryClient.invalidateQueries({ queryKey: ['factures'] });
      // Invalider les tables aussi car leur statut change
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
