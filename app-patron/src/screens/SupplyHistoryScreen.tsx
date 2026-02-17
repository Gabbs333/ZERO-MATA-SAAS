import { useState } from 'react';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { useAuthStore } from '../store/authStore';
import { formatMontant } from '../utils/format';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Search, Package, FileText } from 'lucide-react';

interface SupplyHistoryItem {
  id: string;
  fournisseur: string;
  date_ravitaillement: string;
  montant_total: number;
  profiles: {
    nom: string;
    prenom: string;
  };
  ravitaillement_items: {
    quantite: number;
    nom_produit: string;
    prix_unitaire: number;
  }[];
}

export function SupplyHistoryScreen() {
  const profile = useAuthStore((state) => state.profile);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = useState('');

  const { data: ravitaillements, isLoading } = useSupabaseQuery<SupplyHistoryItem[]>(
    ['ravitaillements_history', profile?.etablissement_id, startDate, endDate],
    async (supabaseClient) => {
      if (!profile?.etablissement_id) return { data: [] as SupplyHistoryItem[], error: null };
      
      const { data, error } = await supabaseClient
        .from('ravitaillements')
        .select(`
          *,
          profiles (nom, prenom),
          ravitaillement_items (
            quantite,
            nom_produit,
            prix_unitaire
          )
        `)
        .eq('etablissement_id', profile.etablissement_id)
        .gte('date_ravitaillement', new Date(startDate).toISOString())
        .lte('date_ravitaillement', new Date(endDate).toISOString())
        .order('date_ravitaillement', { ascending: false });

      return { data: (data as any) as SupplyHistoryItem[], error };
    },
    { enabled: !!profile?.etablissement_id }
  );

  const filteredHistory = ravitaillements?.filter(r => 
    r.fournisseur.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.profiles?.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.profiles?.prenom.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPeriod = filteredHistory?.reduce((acc, curr) => acc + curr.montant_total, 0) || 0;

  return (
    <div className="pb-20 md:pb-6 min-h-screen bg-neutral-50 dark:bg-dark-bg transition-colors duration-300">
      {/* Header */}
      <div className="p-4 md:p-6 bg-white dark:bg-dark-card/40 dark:backdrop-blur-xl border-b border-neutral-200 dark:border-white/5 sticky top-0 z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary dark:text-white font-display">Historique des Ravitaillements</h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">
              Archive de toutes les opérations de réapprovisionnement
            </p>
          </div>
          
          <div className="flex items-center gap-4 bg-neutral-100 dark:bg-dark-card/60 px-6 py-3 rounded-2xl self-start md:self-auto border border-transparent dark:border-white/5">
             <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-[0.2em]">Total Période</span>
                <span className="text-xl font-bold text-primary dark:text-white">{formatMontant(totalPeriod)}</span>
             </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-6 relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-primary dark:group-focus-within:text-dark-accent transition-colors w-5 h-5" />
                <input 
                    type="text" 
                    placeholder="Rechercher par fournisseur ou personnel..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-neutral-100 dark:bg-dark-card/60 border border-transparent focus:border-primary/20 dark:focus:border-white/10 rounded-xl text-primary dark:text-white placeholder-neutral-400 focus:ring-4 focus:ring-primary/5 dark:focus:ring-white/5 transition-all outline-none text-sm"
                />
            </div>
            <div className="md:col-span-6 flex items-center gap-2">
                <div className="relative flex-1">
                  <input 
                      type="date" 
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-4 py-3 bg-neutral-100 dark:bg-dark-card/60 border border-transparent focus:border-primary/20 dark:focus:border-white/10 rounded-xl text-primary dark:text-white outline-none focus:ring-4 focus:ring-primary/5 dark:focus:ring-white/5 transition-all text-sm font-bold uppercase tracking-wider"
                  />
                </div>
                <span className="text-neutral-400 font-bold">-</span>
                <div className="relative flex-1">
                  <input 
                      type="date" 
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-4 py-3 bg-neutral-100 dark:bg-dark-card/60 border border-transparent focus:border-primary/20 dark:focus:border-white/10 rounded-xl text-primary dark:text-white outline-none focus:ring-4 focus:ring-primary/5 dark:focus:ring-white/5 transition-all text-sm font-bold uppercase tracking-wider"
                  />
                </div>
            </div>
        </div>
      </div>

      {/* List */}
      <div className="p-4 md:p-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary dark:border-dark-accent"></div>
            <p className="text-sm text-neutral-500 animate-pulse">Chargement de l'historique...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredHistory?.map((rav) => (
              <div key={rav.id} className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-2xl border border-neutral-200 dark:border-white/5 shadow-xl shadow-neutral-200/50 dark:shadow-none p-5 md:p-6 hover:border-primary/20 dark:hover:border-white/10 transition-all duration-300">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-6 mb-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-primary/10 dark:bg-dark-accent/10 rounded-xl border border-primary/20 dark:border-dark-accent/20">
                      <Package className="w-6 h-6 text-primary dark:text-dark-accent" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-primary dark:text-white mb-1">{rav.fournisseur}</h3>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                          {format(new Date(rav.date_ravitaillement), 'dd MMMM yyyy, HH:mm', { locale: fr })}
                        </p>
                        <span className="text-neutral-300 dark:text-neutral-700 hidden md:block">•</span>
                        <div className="flex items-center gap-2">
                          <div className="size-5 rounded-full bg-neutral-100 dark:bg-dark-card/60 flex items-center justify-center text-[8px] font-bold text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-white/5">
                            {rav.profiles?.prenom?.[0]}{rav.profiles?.nom?.[0]}
                          </div>
                          <p className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                            Par {rav.profiles?.prenom} {rav.profiles?.nom}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col md:items-end">
                    <p className="text-2xl font-bold text-primary dark:text-white tracking-tight">{formatMontant(rav.montant_total)}</p>
                    <span className="px-2.5 py-1 bg-neutral-100 dark:bg-dark-card/60 rounded-lg text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest border border-neutral-200 dark:border-white/5">
                      {rav.ravitaillement_items?.length} articles
                    </span>
                  </div>
                </div>

                {/* Items Table */}
                <div className="bg-neutral-50/50 dark:bg-dark-card/60 rounded-xl overflow-hidden border border-neutral-100 dark:border-white/5">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-neutral-100/50 dark:bg-dark-card/60">
                                <tr>
                                    <th className="p-4 text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">Produit</th>
                                    <th className="p-4 text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest text-right">Qté</th>
                                    <th className="p-4 text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest text-right">Prix Unitaire</th>
                                    <th className="p-4 text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
                                {rav.ravitaillement_items?.map((item: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-neutral-100/30 dark:hover:bg-dark-card/40 transition-colors">
                                        <td className="p-4 font-bold text-primary dark:text-white">{item.nom_produit}</td>
                                        <td className="p-4 text-right">
                                          <span className="px-2 py-1 bg-white dark:bg-dark-card/60 rounded-lg text-neutral-600 dark:text-neutral-300 font-bold border border-neutral-100 dark:border-white/5">
                                            {item.quantite}
                                          </span>
                                        </td>
                                        <td className="p-4 text-right text-neutral-500 dark:text-neutral-400 font-medium">{formatMontant(item.prix_unitaire)}</td>
                                        <td className="p-4 text-right font-bold text-primary dark:text-white">{formatMontant(item.quantite * item.prix_unitaire)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
              </div>
            ))}

            {filteredHistory?.length === 0 && (
              <div className="text-center py-24">
                <div className="p-6 bg-neutral-100 dark:bg-dark-card/40 rounded-full inline-block mb-4 border border-neutral-200 dark:border-white/5">
                  <FileText className="w-12 h-12 text-neutral-400 opacity-50" />
                </div>
                <h3 className="text-lg font-bold text-neutral-500 dark:text-neutral-400">Aucun enregistrement trouvé</h3>
                <p className="text-sm text-neutral-400">Essayez de modifier votre recherche ou la période sélectionnée.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
