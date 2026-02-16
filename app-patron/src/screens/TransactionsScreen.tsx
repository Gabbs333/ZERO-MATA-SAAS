import { useState } from 'react';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { useAuthStore } from '../store/authStore';
import { formatMontant } from '../utils/format';
import { format } from 'date-fns';
import { Search, Banknote, Smartphone, CreditCard } from 'lucide-react';

export function TransactionsScreen() {
  const profile = useAuthStore((state) => state.profile);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'especes' | 'carte' | 'mobile_money'>('all');

  const { data: transactions, isLoading, refetch } = useSupabaseQuery(
    ['transactions', profile?.etablissement_id],
    async (supabaseClient) => {
      if (!profile?.etablissement_id) return { data: [], error: null };
      
      const { data, error } = await supabaseClient
        .from('encaissements')
        .select(`
          *,
          factures (numero_facture),
          profiles:utilisateur_id (nom, prenom)
        `)
        .eq('etablissement_id', profile.etablissement_id)
        .order('date_encaissement', { ascending: false })
        .limit(100); // Limit to last 100 transactions for performance
        
      return { data, error };
    },
    { enabled: !!profile?.etablissement_id }
  );

  const filteredTransactions = transactions?.filter(t => {
    const matchesSearch = t.factures?.numero_facture.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMode = filterMode === 'all' || t.mode_paiement === filterMode;
    return matchesSearch && matchesMode;
  });

  return (
    <div className="pb-20 md:pb-6 min-h-screen bg-neutral-50 dark:bg-dark-bg transition-colors duration-300">
      {/* Header */}
      <div className="p-4 md:p-6 bg-white dark:bg-dark-card/40 dark:backdrop-blur-xl border-b border-neutral-200 dark:border-white/5 sticky top-0 z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary dark:text-white font-display">Transactions</h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">
              Historique de tous les paiements reçus
            </p>
          </div>
          
          <div className="flex p-1 bg-neutral-100 dark:bg-dark-card/60 rounded-xl overflow-x-auto self-start md:self-auto no-scrollbar">
            {(['all', 'especes', 'carte', 'mobile_money'] as const).map((mode) => (
              <button 
                key={mode}
                onClick={() => setFilterMode(mode)}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap uppercase tracking-wider ${
                  filterMode === mode
                    ? 'bg-white dark:bg-dark-accent text-primary dark:text-white shadow-md' 
                    : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
                }`}
              >
                {mode === 'all' ? 'Tous' : 
                 mode === 'especes' ? 'Espèces' :
                 mode === 'mobile_money' ? 'Mobile Money' : 'Carte'}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="mt-6">
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-primary dark:group-focus-within:text-dark-accent transition-colors" />
                <input 
                    type="text" 
                    placeholder="Rechercher par numéro de facture..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-neutral-100 dark:bg-dark-card/60 border border-transparent focus:border-primary/20 dark:focus:border-white/10 rounded-xl text-primary dark:text-white placeholder-neutral-400 focus:ring-4 focus:ring-primary/5 dark:focus:ring-white/5 transition-all outline-none text-sm"
                />
            </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="p-4 md:p-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary dark:border-dark-accent"></div>
            <p className="text-sm text-neutral-500 animate-pulse">Chargement des transactions...</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-2xl border border-neutral-200 dark:border-white/5 shadow-xl shadow-neutral-200/50 dark:shadow-none overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-neutral-50/50 dark:bg-dark-card/60 border-b border-neutral-200 dark:border-white/5">
                            <th className="p-4 text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.2em]">Date & Heure</th>
                            <th className="p-4 text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.2em]">N° Facture</th>
                            <th className="p-4 text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.2em]">Montant</th>
                            <th className="p-4 text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.2em]">Mode</th>
                            <th className="p-4 text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.2em]">Caissier</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
                        {filteredTransactions?.map((t) => (
                            <tr key={t.id} className="group hover:bg-neutral-50 dark:hover:bg-dark-card/60 transition-all duration-200">
                                <td className="p-4 text-sm">
                                    <div className="flex flex-col">
                                        <span className="text-primary dark:text-white font-semibold">
                                            {format(new Date(t.date_encaissement), 'dd MMM yyyy')}
                                        </span>
                                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-bold uppercase">
                                            {format(new Date(t.date_encaissement), 'HH:mm')}
                                        </span>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <span className="px-2 py-1 bg-neutral-100 dark:bg-dark-card/60 rounded text-xs font-mono text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-white/5">
                                        {t.factures?.numero_facture}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <span className="text-sm font-bold text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-lg">
                                        +{formatMontant(t.montant)}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${
                                        t.mode_paiement === 'especes' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' :
                                        t.mode_paiement === 'mobile_money' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400' :
                                        'bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-neutral-300'
                                    }`}>
                                        {t.mode_paiement === 'especes' && <Banknote className="w-3.5 h-3.5" />}
                                        {t.mode_paiement === 'mobile_money' && <Smartphone className="w-3.5 h-3.5" />}
                                        {t.mode_paiement !== 'especes' && t.mode_paiement !== 'mobile_money' && <CreditCard className="w-3.5 h-3.5" />}
                                        {t.mode_paiement === 'especes' ? 'Espèces' : 
                                         t.mode_paiement === 'mobile_money' ? 'Mobile' : 'Carte'}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-full bg-primary/10 dark:bg-dark-accent/10 flex items-center justify-center text-[10px] font-bold text-primary dark:text-dark-accent border border-primary/20 dark:border-dark-accent/20">
                                            {t.profiles?.prenom?.[0]}{t.profiles?.nom?.[0]}
                                        </div>
                                        <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                                            {t.profiles?.prenom} {t.profiles?.nom}
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        ))}

                        {filteredTransactions?.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-20 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="p-4 bg-neutral-100 dark:bg-dark-card/40 rounded-full">
                                            <Search className="w-8 h-8 text-neutral-400" />
                                        </div>
                                        <p className="text-neutral-400 text-sm font-medium">Aucune transaction trouvée</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
