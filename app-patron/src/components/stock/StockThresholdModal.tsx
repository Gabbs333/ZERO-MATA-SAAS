import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { X, Save, Target } from 'lucide-react';

interface StockThresholdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  stockId: string;
  currentThreshold: number;
  productName: string;
}

export function StockThresholdModal({
  isOpen,
  onClose,
  onSuccess,
  stockId,
  currentThreshold,
  productName
}: StockThresholdModalProps) {
  const [threshold, setThreshold] = useState(currentThreshold.toString());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setThreshold(currentThreshold.toString());
  }, [currentThreshold, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockId || !threshold) return;

    setLoading(true);
    try {
      const newThreshold = parseInt(threshold, 10);
      
      const { error } = await supabase
        .from('stocks')
        .update({ 
          seuil_alerte: newThreshold,
          date_derniere_maj: new Date().toISOString()
        })
        .eq('id', stockId);

      if (error) throw error;

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Erreur mise à jour seuil:', error);
      alert(`Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-dark-card w-full max-w-sm rounded-2xl shadow-2xl border border-neutral-200 dark:border-white/10 flex flex-col">
        <div className="p-4 border-b border-neutral-100 dark:border-white/5 flex justify-between items-center">
          <h2 className="text-lg font-bold text-primary dark:text-white font-display flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-500" />
            Seuil d'alerte
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-full transition-colors">
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="space-y-1.5">
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">
              Produit: <span className="font-bold text-primary dark:text-white">{productName}</span>
            </p>
            <label className="text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
              Seuil Minimum (Alerte)
            </label>
            <input
              type="number"
              min="0"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="w-full p-3 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary dark:focus:border-dark-accent rounded-xl text-primary dark:text-white outline-none font-bold text-lg"
              required
            />
            <p className="text-xs text-neutral-400 mt-1">
              La cible sera automatiquement fixée à 3x ce montant (soit {parseInt(threshold || '0') * 3}).
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl font-bold text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors text-sm"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-primary dark:bg-dark-accent hover:opacity-90 transition-opacity shadow-lg shadow-primary/20 dark:shadow-dark-accent/20 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
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
        </form>
      </div>
    </div>
  );
}
