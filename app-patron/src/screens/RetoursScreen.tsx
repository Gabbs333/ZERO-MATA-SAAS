import { useState } from 'react';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';
import { formatMontant } from '../utils/format';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Package, Receipt, Search, Calendar, ArrowLeftCircle, User } from 'lucide-react';

interface RetourItem {
  id: string;
  retour_id: string;
  commande_item_id: string;
  produit_id: string;
  nom_produit: string;
  quantite_retournee: number;
  prix_unitaire: number;
  montant_ligne: number;
}

interface Retour {
  id: string;
  numero_retour: string;
  facture_id: string;
  commande_id: string;
  montant_total_retour: number;
  motif: string | null;
  utilisateur_id: string;
  date_retour: string;
  etablissement_id: string;
  retour_items?: RetourItem[];
  factures?: {
    numero_facture: string;
    montant_total: number;
    statut: string;
  };
  commandes?: {
    numero_commande: string;
    tables: { numero: number };
    profiles: { nom: string; prenom: string };
  };
}

export function RetoursScreen() {
  const profile = useAuthStore((state) => state.profile);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('week');

  const { data: retours, isLoading } = useSupabaseQuery<Retour[]>(
    ['retours', profile?.etablissement_id],
    async () => {
      if (!profile?.etablissement_id) return { data: [], error: null };
      
      const { data, error } = await supabase
        .from('retours')
        .select(`
          *,
          factures (
            numero_facture,
            montant_total,
            statut
          ),
          commandes (
            numero_commande,
            tables (numero),
            profiles!commandes_serveuse_id_fkey (nom, prenom)
          )
        `)
        .eq('etablissement_id', profile.etablissement_id)
        .order('date_retour', { ascending: false });

      return { data: data as unknown as Retour[], error };
    },
    { enabled: !!profile?.etablissement_id }
  );

  const filteredRetours = retours?.filter(r => {
    const matchesSearch = 
      r.commandes?.numero_commande?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.commandes?.profiles?.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.commandes?.profiles?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.numero_retour?.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesDate = true;
    if (dateFilter !== 'all') {
      const retourDate = new Date(r.date_retour);
      const now = new Date();
      if (dateFilter === 'today') {
        matchesDate = retourDate.toDateString() === now.toDateString();
      } else if (dateFilter === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        matchesDate = retourDate >= weekAgo;
      } else if (dateFilter === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        matchesDate = retourDate >= monthAgo;
      }
    }
    
    return matchesSearch && matchesDate;
  });

  const totalRetours = retours?.reduce((sum, r) => sum + (r.montant_total_retour || 0), 0) || 0;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-dark-bg pb-20 md:pb-6">
      <div className="p-4 md:p-6 bg-white dark:bg-dark-card/30 dark:backdrop-blur-xl border-b border-neutral-200 dark:border-white/5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary dark:text-white font-display">Historique des Retours</h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">
              Consultez les retours effectués sur les factures
            </p>
          </div>
          
          <div className="flex items-center gap-3 bg-semantic-red/10 px-4 py-2 rounded-xl border border-semantic-red/20 self-start md:self-auto">
             <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-semantic-red tracking-wider">Total Retours</span>
                <span className="text-xl font-bold text-semantic-red">{formatMontant(totalRetours)}</span>
             </div>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher par numéro de retour, commande ou serveur..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary dark:focus:border-dark-accent rounded-xl text-primary dark:text-white placeholder-neutral-400 focus:ring-4 focus:ring-primary/10 dark:focus:ring-dark-accent/10 transition-all outline-none"
            />
          </div>
          
          <div className="flex gap-2">
            {([
              { value: 'today', label: "Aujourd'hui" },
              { value: 'week', label: '7 jours' },
              { value: 'month', label: '30 jours' },
              { value: 'all', label: 'Tout' }
            ] as const).map((filter) => (
              <button
                key={filter.value}
                onClick={() => setDateFilter(filter.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  dateFilter === filter.value
                    ? 'bg-primary dark:bg-dark-accent text-white'
                    : 'bg-neutral-100 dark:bg-white/5 text-neutral-500 dark:text-neutral-400'
                }`}
              >
                {filter.label}
              </button>
            ))}
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
            {filteredRetours?.map((retour) => (
              <div
                key={retour.id}
                className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 shadow-soft overflow-hidden hover:border-primary/30 dark:hover:border-dark-accent/30 transition-all"
              >
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-semantic-red/10 text-semantic-red size-10 rounded-lg flex items-center justify-center">
                      <ArrowLeftCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-primary dark:text-white">
                        {retour.numero_retour}
                      </h3>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {retour.commandes?.numero_commande}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
                      <User className="w-4 h-4" />
                      <span>{retour.commandes?.profiles?.prenom} {retour.commandes?.profiles?.nom}</span>
                    </div>
                    <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
                      <Receipt className="w-4 h-4" />
                      <span>Table {retour.commandes?.tables?.numero}</span>
                    </div>
                    <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
                      <Calendar className="w-4 h-4" />
                      <span>{format(new Date(retour.date_retour), 'dd MMM yyyy HH:mm', { locale: fr })}</span>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-neutral-200 dark:border-white/5 flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">Montant</span>
                    <span className="text-lg font-bold text-semantic-red">{formatMontant(retour.montant_total_retour)}</span>
                  </div>
                  
                  {retour.motif && (
                    <div className="mt-3 p-2 bg-neutral-50 dark:bg-white/5 rounded-lg">
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        <span className="font-bold">Motif:</span> {retour.motif}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {filteredRetours?.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-neutral-400 dark:text-neutral-500">
                <Package className="w-12 h-12 mb-2 opacity-50" />
                <p>Aucun retour trouvé</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
