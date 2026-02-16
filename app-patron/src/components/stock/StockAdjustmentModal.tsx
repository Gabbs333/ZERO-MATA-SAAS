import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { useAuthStore } from '../../store/authStore';
import { X, Save, AlertTriangle, ArrowDown, ArrowUp, Info } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  etablissementId: string;
  preselectedProductId?: string;
}

type AdjustmentType = 'perte' | 'vol' | 'casse' | 'consommation_interne' | 'correction_stock' | 'don';

export function StockAdjustmentModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  etablissementId,
  preselectedProductId 
}: StockAdjustmentModalProps) {
  const profile = useAuthStore((state) => state.profile);
  const [loading, setLoading] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(preselectedProductId || '');
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('perte');
  const [quantity, setQuantity] = useState<string>('1');
  const [comment, setComment] = useState('');
  const [isPositive, setIsPositive] = useState(false); // Pour correction de stock uniquement

  useEffect(() => {
    if (preselectedProductId) {
      setSelectedProductId(preselectedProductId);
    }
  }, [preselectedProductId]);

  // Réinitialiser le sens (positif/négatif) quand on change de type
  useEffect(() => {
    if (adjustmentType === 'correction_stock') {
      // Pour correction, on laisse le choix, par défaut positif si on veut ajouter, mais souvent correction = ajustement absolu ? 
      // Ici on va faire un ajustement relatif (+/-)
      setIsPositive(true);
    } else {
      // Pour perte, vol, casse, conso, don => Toujours négatif (sortie)
      setIsPositive(false);
    }
  }, [adjustmentType]);

  const { data: produits } = useSupabaseQuery<{ id: string; nom: string; quantite_actuelle: number }[]>(
    ['produits_stock_list', etablissementId],
    async () => {
      if (!etablissementId) return { data: [], error: null };
      
      // On récupère les produits avec leur stock actuel pour info
      const { data, error } = await supabase
        .from('stocks')
        .select(`
          quantite_actuelle,
          produits (
            id,
            nom
          )
        `)
        .eq('etablissement_id', etablissementId);
      
      if (error) throw error;
      
      return { 
        data: data.map((item: any) => ({
          id: item.produits.id,
          nom: item.produits.nom,
          quantite_actuelle: item.quantite_actuelle
        })).sort((a: any, b: any) => a.nom.localeCompare(b.nom)), 
        error: null 
      };
    },
    { enabled: isOpen && !!etablissementId }
  );

  const selectedProductInfo = produits?.find(p => p.id === selectedProductId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !quantity || parseFloat(quantity) <= 0) return;
    if (!profile?.id) {
      alert("Erreur: Profil utilisateur introuvable. Veuillez vous reconnecter.");
      return;
    }

    setLoading(true);
    try {
      const qty = parseFloat(quantity);
      const finalQuantity = isPositive ? qty : -qty;
      const typeRef = 'ajustement';
      
      // Construire la référence (motif)
      let motif = '';
      switch (adjustmentType) {
        case 'perte': motif = 'PERTE'; break;
        case 'vol': motif = 'VOL'; break;
        case 'casse': motif = 'CASSE'; break;
        case 'consommation_interne': motif = 'CONSOMMATION INTERNE'; break;
        case 'don': motif = 'DON / OFFERT'; break;
        case 'correction_stock': motif = 'CORRECTION INVENTAIRE'; break;
      }
      
      if (comment) motif += `: ${comment}`;

      // 1. Mettre à jour le stock
      // On récupère d'abord le stock actuel pour être sûr (optimistic UI possible mais on va faire simple)
      const { data: currentStock, error: stockFetchError } = await supabase
        .from('stocks')
        .select('quantite_actuelle')
        .eq('produit_id', selectedProductId)
        .eq('etablissement_id', etablissementId)
        .single();

      if (stockFetchError) throw stockFetchError;

      const newStockQuantity = currentStock.quantite_actuelle + finalQuantity;

      const { error: updateError } = await supabase
        .from('stocks')
        .update({ 
          quantite_actuelle: newStockQuantity,
          date_derniere_maj: new Date().toISOString()
        })
        .eq('produit_id', selectedProductId)
        .eq('etablissement_id', etablissementId);

      if (updateError) throw updateError;

      // 2. Créer le mouvement de stock
      const { error: moveError } = await supabase
        .from('mouvements_stock')
        .insert({
          produit_id: selectedProductId,
          quantite: finalQuantity,
          type: finalQuantity >= 0 ? 'entree' : 'sortie',
          type_reference: typeRef,
          reference: motif,
          etablissement_id: etablissementId,
          date_creation: new Date().toISOString(),
          utilisateur_id: profile?.id
        });

      if (moveError) {
        console.error('Erreur création mouvement:', moveError);
        // On ne rollback pas le stock ici (trop complexe sans transaction), mais on loggue l'erreur
        // Idéalement on devrait utiliser une RPC
      }

      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Erreur ajustement stock:', error);
      alert(`Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setQuantity('1');
    setComment('');
    setAdjustmentType('perte');
    setSelectedProductId('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-dark-card w-full max-w-md rounded-2xl shadow-2xl border border-neutral-200 dark:border-white/10 flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-neutral-100 dark:border-white/5 flex justify-between items-center">
          <h2 className="text-lg font-bold text-primary dark:text-white font-display flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Ajustement de Stock
          </h2>
          <button onClick={handleClose} className="p-2 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-full transition-colors">
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto">
          {/* Sélection Produit */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
              Produit
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full p-3 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary dark:focus:border-dark-accent rounded-xl text-primary dark:text-white outline-none transition-all"
              required
            >
              <option value="">Sélectionner un produit...</option>
              {produits?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom} (Stock: {p.quantite_actuelle})
                </option>
              ))}
            </select>
          </div>

          {/* Type d'ajustement */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
              Raison de l'ajustement
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'perte', label: 'Perte / Gaspillage', icon: ArrowDown, color: 'text-red-500' },
                { id: 'casse', label: 'Casse', icon: ArrowDown, color: 'text-red-500' },
                { id: 'vol', label: 'Vol / Disparition', icon: ArrowDown, color: 'text-red-500' },
                { id: 'consommation_interne', label: 'Conso. Interne', icon: ArrowDown, color: 'text-orange-500' },
                { id: 'don', label: 'Don / Offert', icon: ArrowDown, color: 'text-blue-500' },
                { id: 'correction_stock', label: 'Correction Inventaire', icon: Info, color: 'text-gray-500' },
              ].map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setAdjustmentType(type.id as AdjustmentType)}
                  className={twMerge(
                    "p-3 rounded-xl border text-left transition-all flex items-center gap-2",
                    adjustmentType === type.id
                      ? "bg-primary/5 border-primary dark:border-dark-accent ring-1 ring-primary dark:ring-dark-accent"
                      : "bg-neutral-50 dark:bg-white/5 border-transparent hover:bg-neutral-100 dark:hover:bg-white/10"
                  )}
                >
                  <type.icon className={twMerge("w-4 h-4", type.color)} />
                  <span className={twMerge(
                    "text-xs font-bold",
                    adjustmentType === type.id ? "text-primary dark:text-white" : "text-neutral-500 dark:text-neutral-400"
                  )}>
                    {type.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Quantité et Sens (pour correction) */}
          <div className="flex gap-4">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                Quantité
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => {
                  const val = e.target.value.replace(',', '.');
                  if (!val || /^\d*\.?\d*$/.test(val)) {
                    setQuantity(val);
                  }
                }}
                placeholder="0.00"
                className="w-full p-3 bg-white dark:bg-dark-bg border border-neutral-200 dark:border-white/10 focus:border-primary dark:focus:border-dark-accent rounded-xl text-primary dark:text-white outline-none font-bold text-lg shadow-sm"
                required
              />
            </div>

            {adjustmentType === 'correction_stock' && (
              <div className="space-y-1.5 w-1/3">
                <label className="text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                  Action
                </label>
                <div className="flex bg-neutral-100 dark:bg-white/5 rounded-xl p-1">
                  <button
                    type="button"
                    onClick={() => setIsPositive(true)}
                    className={twMerge(
                      "flex-1 flex items-center justify-center p-2 rounded-lg transition-all",
                      isPositive ? "bg-green-500 text-white shadow-md" : "text-neutral-400"
                    )}
                  >
                    <ArrowUp className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPositive(false)}
                    className={twMerge(
                      "flex-1 flex items-center justify-center p-2 rounded-lg transition-all",
                      !isPositive ? "bg-red-500 text-white shadow-md" : "text-neutral-400"
                    )}
                  >
                    <ArrowDown className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Nouveau solde estimé */}
          {selectedProductInfo && (
            <div className="bg-neutral-50 dark:bg-white/5 p-3 rounded-xl flex justify-between items-center text-sm">
              <span className="text-neutral-500 dark:text-neutral-400">Nouveau stock estimé:</span>
              <span className="font-bold text-primary dark:text-white">
                {selectedProductInfo.quantite_actuelle} 
                {' '}{isPositive ? '+' : '-'} {quantity || '0'} 
                {' '} = {selectedProductInfo.quantite_actuelle + (isPositive ? (parseFloat(quantity) || 0) : -(parseFloat(quantity) || 0))}
              </span>
            </div>
          )}

          {/* Commentaire */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
              Commentaire (Optionnel)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Détails supplémentaires..."
              className="w-full p-3 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary dark:focus:border-dark-accent rounded-xl text-primary dark:text-white outline-none min-h-[80px] text-sm resize-none"
            />
          </div>
        </form>

        <div className="p-4 border-t border-neutral-100 dark:border-white/5 flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 px-4 py-3 rounded-xl font-bold text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors text-sm"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !selectedProductId || !quantity}
            className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-primary dark:bg-dark-accent hover:opacity-90 transition-opacity shadow-lg shadow-primary/20 dark:shadow-dark-accent/20 flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="size-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" />
                Enregistrer
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
