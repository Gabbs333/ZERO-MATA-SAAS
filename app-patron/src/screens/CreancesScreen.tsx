import React, { useState } from 'react';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';
import { formatMontant } from '../utils/format';
import { format } from 'date-fns';
import { Receipt, Banknote, CheckCircle, X } from 'lucide-react';

interface UnpaidFacture {
  id: string;
  numero_facture: string;
  montant_total: number;
  montant_paye: number;
  statut: 'en_attente_paiement' | 'partiellement_payee';
  date_generation: string;
  commandes: {
    tables: { numero: number };
    profiles: { nom: string; prenom: string };
  };
}

export function CreancesScreen() {
  const profile = useAuthStore((state) => state.profile);
  const [selectedFacture, setSelectedFacture] = useState<UnpaidFacture | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'especes' | 'carte' | 'mobile_money' | 'cheque'>('especes');
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: factures, isLoading, refetch } = useSupabaseQuery(
    ['unpaid_factures', profile?.etablissement_id],
    async () => {
      if (!profile?.etablissement_id) return { data: [], error: null };
      
      return supabase
        .from('factures')
        .select(`
          *,
          commandes (
            tables (numero),
            profiles!serveuse_id (nom, prenom)
          )
        `)
        .eq('etablissement_id', profile.etablissement_id)
        .in('statut', ['en_attente_paiement', 'partiellement_payee'])
        .order('date_generation', { ascending: false })
        .then(({ data, error }) => ({ data: data as unknown as UnpaidFacture[], error }));
    },
    { enabled: !!profile?.etablissement_id }
  );

  const totalDebt = factures?.reduce((sum, f) => sum + (f.montant_total - f.montant_paye), 0) || 0;

  const handleOpenPayment = (facture: UnpaidFacture) => {
    setSelectedFacture(facture);
    setPaymentAmount(facture.montant_total - facture.montant_paye);
    setPaymentMode('especes');
  };

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFacture || !profile?.etablissement_id || !profile?.id) return;

    setIsProcessing(true);
    try {
      // 1. Create Encaissement
      const { error: encaissementError } = await supabase
        .from('encaissements')
        .insert({
          facture_id: selectedFacture.id,
          montant: paymentAmount,
          mode_paiement: paymentMode,
          etablissement_id: profile.etablissement_id,
          utilisateur_id: profile.id, // Assuming this field exists based on database.types.ts
          date_encaissement: new Date().toISOString()
        });

      if (encaissementError) throw encaissementError;

      // 2. Update Facture
      const newAmountPaid = selectedFacture.montant_paye + paymentAmount;
      const newStatus = newAmountPaid >= selectedFacture.montant_total ? 'payee' : 'partiellement_payee';

      const { error: factureError } = await supabase
        .from('factures')
        .update({
          montant_paye: newAmountPaid,
          statut: newStatus
        })
        .eq('id', selectedFacture.id);

      if (factureError) throw factureError;

      setSelectedFacture(null);
      refetch();
    } catch (error) {
      console.error('Payment error:', error);
      alert('Error processing payment');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-dark-bg pb-20 md:pb-6 relative">
      {/* Header */}
      <div className="p-4 md:p-6 bg-white dark:bg-dark-card/30 dark:backdrop-blur-xl border-b border-neutral-200 dark:border-white/5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary dark:text-white font-display">Créances Clients</h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">
              Gérez les factures impayées et collectez les paiements
            </p>
          </div>
          
          <div className="flex items-center gap-3 bg-semantic-red/10 px-4 py-2 rounded-xl border border-semantic-red/20 self-start md:self-auto">
             <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-semantic-red tracking-wider">Total Dû</span>
                <span className="text-xl font-bold text-semantic-red">{formatMontant(totalDebt)}</span>
             </div>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary dark:border-white"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {factures?.map((facture) => {
              const remaining = facture.montant_total - facture.montant_paye;
              const progress = (facture.montant_paye / facture.montant_total) * 100;

              return (
                <div key={facture.id} className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 shadow-soft overflow-hidden group hover:border-semantic-red/30 transition-all">
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-3">
                       <div className="flex items-center gap-3">
                          <div className="bg-semantic-red/10 text-semantic-red size-10 rounded-lg flex items-center justify-center">
                             <Receipt className="w-5 h-5" />
                          </div>
                          <div>
                             <h3 className="font-bold text-primary dark:text-white text-sm">
                                {facture.commandes.profiles.prenom} {facture.commandes.profiles.nom}
                             </h3>
                             <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">Table {facture.commandes.tables.numero} • {format(new Date(facture.date_generation), 'dd MMM HH:mm')}</p>
                          </div>
                       </div>
                       <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-white/10">
                          {facture.numero_facture}
                       </span>
                    </div>

                    <div className="mb-4">
                       <div className="flex justify-between text-xs font-medium mb-1.5">
                          <span className="text-neutral-500 dark:text-neutral-400 font-medium">Payé: {formatMontant(facture.montant_paye)}</span>
                          <span className="text-primary dark:text-white font-bold">Total: {formatMontant(facture.montant_total)}</span>
                       </div>
                       <div className="h-2 w-full bg-neutral-100 dark:bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-semantic-green rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          ></div>
                       </div>
                       <div className="mt-2 flex justify-between items-center">
                          <span className="text-xs font-bold text-semantic-red uppercase tracking-wider">Restant</span>
                          <span className="text-lg font-bold text-semantic-red">{formatMontant(remaining)}</span>
                       </div>
                    </div>

                    <button 
                        onClick={() => handleOpenPayment(facture)}
                        className="w-full py-2.5 bg-primary dark:bg-dark-accent text-white rounded-lg font-bold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                    >
                        <Banknote className="w-5 h-5" />
                        Enregistrer Paiement
                    </button>
                  </div>
                </div>
              );
            })}

            {factures?.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-12 text-neutral-400 dark:text-neutral-500">
                    <CheckCircle className="w-12 h-12 mb-2 opacity-50" />
                    <p>Aucune créance en cours</p>
                </div>
            )}
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {selectedFacture && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white dark:bg-dark-card/90 dark:backdrop-blur-xl rounded-2xl w-full max-w-md shadow-2xl border border-neutral-200 dark:border-white/10 overflow-hidden">
            <div className="p-4 md:p-6 border-b border-neutral-100 dark:border-white/5 flex justify-between items-center">
              <h2 className="text-xl font-bold text-primary dark:text-white">
                Collecter Paiement
              </h2>
              <button 
                onClick={() => setSelectedFacture(null)}
                className="text-neutral-400 hover:text-primary dark:hover:text-white transition-colors p-2 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-full"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleProcessPayment} className="p-4 md:p-6 space-y-4">
              <div className="bg-neutral-50 dark:bg-white/5 p-4 rounded-xl border border-neutral-100 dark:border-white/5">
                 <p className="text-xs text-neutral-500 dark:text-neutral-400 font-bold uppercase tracking-wider mb-1">Facture</p>
                 <p className="font-bold text-primary dark:text-white">{selectedFacture.numero_facture}</p>
                 <div className="flex justify-between mt-3 pt-3 border-t border-neutral-200 dark:border-white/5">
                    <span className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">Montant Restant</span>
                    <span className="text-sm font-bold text-semantic-red">
                        {formatMontant(selectedFacture.montant_total - selectedFacture.montant_paye)}
                    </span>
                 </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-primary dark:text-white mb-1.5 uppercase tracking-wider">Montant à Payer</label>
                <div className="relative">
                    <input
                      type="number"
                      required
                      min="1"
                      max={selectedFacture.montant_total - selectedFacture.montant_paye}
                      value={paymentAmount}
                      onChange={e => setPaymentAmount(parseInt(e.target.value) || 0)}
                      className="w-full pl-4 pr-12 py-3.5 bg-neutral-100 dark:bg-dark-card/40 border border-transparent dark:border-white/10 rounded-lg text-primary dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-dark-accent outline-none font-bold text-xl"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 text-sm font-bold">XAF</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-primary dark:text-white mb-1.5 uppercase tracking-wider">Mode de Paiement</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['especes', 'carte', 'mobile_money', 'cheque'] as const).map((mode) => (
                    <button
                      type="button"
                      key={mode}
                      onClick={() => setPaymentMode(mode)}
                      className={`px-3 py-3 rounded-lg text-sm font-bold capitalize border-2 transition-all ${
                        paymentMode === mode
                          ? 'border-primary dark:border-dark-accent text-primary dark:text-white bg-primary/5 dark:bg-dark-accent/10'
                          : 'border-transparent bg-neutral-100 dark:bg-dark-card/40 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-dark-card/60'
                      }`}
                    >
                      {mode.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full mt-4 px-4 py-3 bg-semantic-green text-white rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? 'Traitement...' : `Confirmer Paiement ${formatMontant(paymentAmount)}`}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
