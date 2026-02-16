import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCommandesHistory, useServeuses } from '../hooks/useSupabaseQuery';
import type { CommandeWithDetails } from '../types/database.types';
import { 
  Loader, 
  Search, 
  Calendar, 
  Filter, 
  Eye, 
  X,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { startOfDay, startOfWeek, startOfMonth, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';

type TimeFilter = 'today' | 'week' | 'month' | 'all' | 'custom';

export default function HistoryScreen() {
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedServeuse, setSelectedServeuse] = useState<string>('all');
  const [selectedCommande, setSelectedCommande] = useState<CommandeWithDetails | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  useEffect(() => {
    const search = searchParams.get('search');
    if (search) {
      setSearchQuery(search);
      setTimeFilter('all'); // Expand time range if searching
    }
  }, [searchParams]);

  const getStartDate = (filter: TimeFilter) => {
    const now = new Date();
    switch (filter) {
      case 'today': return startOfDay(now).toISOString();
      case 'week': return startOfWeek(now, { weekStartsOn: 1 }).toISOString();
      case 'month': return startOfMonth(now).toISOString();
      case 'all': return undefined;
      case 'custom': return customStartDate ? startOfDay(new Date(customStartDate)).toISOString() : undefined;
      default: return undefined;
    }
  };

  const getEndDate = (filter: TimeFilter) => {
    const now = new Date();
    switch (filter) {
      case 'today': return endOfDay(now).toISOString();
      case 'week': return endOfDay(now).toISOString(); // Until now
      case 'month': return endOfDay(now).toISOString(); // Until now
      case 'all': return undefined;
      case 'custom': return customEndDate ? endOfDay(new Date(customEndDate)).toISOString() : undefined;
      default: return undefined;
    }
  };

  const filters = useMemo(() => ({
    // If searching, ignore date filters to ensure we find the order
    startDate: searchQuery ? undefined : getStartDate(timeFilter),
    endDate: searchQuery ? undefined : getEndDate(timeFilter),
    serveuseId: selectedServeuse,
    searchQuery: searchQuery,
    statut: 'all' as const
  }), [timeFilter, customStartDate, customEndDate, selectedServeuse, searchQuery]);

  const { data: commandes, isLoading, error } = useCommandesHistory(filters, 100);
  const { data: serveuses } = useServeuses();

  const handleOpenDetails = (commande: CommandeWithDetails) => {
    setSelectedCommande(commande);
    setShowDetailsDialog(true);
  };

  const formatPrice = (price: number) => `${price.toLocaleString('fr-FR')} FCFA`;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatutBadge = (statut: string) => {
    switch (statut) {
      case 'payee':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-semantic-green/10 text-semantic-green border border-semantic-green/20">
            <CheckCircle className="w-3 h-3" />
            Payée
          </span>
        );
      case 'annulee':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-semantic-red/10 text-semantic-red border border-semantic-red/20">
            <XCircle className="w-3 h-3" />
            Annulée
          </span>
        );
      case 'en_attente':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-semantic-amber/10 text-semantic-amber border border-semantic-amber/20">
            <Clock className="w-3 h-3" />
            En attente
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700">
            <AlertCircle className="w-3 h-3" />
            {statut}
          </span>
        );
    }
  };

  return (
    <div className="h-full flex flex-col gap-6 p-6 max-w-[1600px] mx-auto w-full">
      {/* Header & Filters */}
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-neutral-900 dark:text-white mb-2">
            Historique des Commandes
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            Consultez et analysez l'historique complet des commandes
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl shadow-sm border border-neutral-200 dark:border-white/5 flex flex-col lg:flex-row gap-4 items-end lg:items-center justify-between">
          
          {/* Search & Serveuse Filter */}
          <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="N° commande..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-4 rounded-lg bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              />
            </div>
            
            <div className="relative w-full sm:w-48">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <select
                value={selectedServeuse}
                onChange={(e) => setSelectedServeuse(e.target.value)}
                className="w-full h-10 pl-10 pr-8 rounded-lg bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm appearance-none"
              >
                <option value="all">Toutes les serveuses</option>
                {serveuses?.map(s => (
                  <option key={s.id} value={s.id}>{s.prenom} {s.nom}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Date Filters */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
            {(['today', 'week', 'month', 'all', 'custom'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setTimeFilter(filter)}
                className={`
                  px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                  ${timeFilter === filter 
                    ? 'bg-primary text-white shadow-lg shadow-primary/30' 
                    : 'bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-white/10'}
                `}
              >
                {filter === 'today' && "Aujourd'hui"}
                {filter === 'week' && "Cette semaine"}
                {filter === 'month' && "Ce mois"}
                {filter === 'all' && "Tout"}
                {filter === 'custom' && "Personnalisé"}
              </button>
            ))}
          </div>
        </div>

        {timeFilter === 'custom' && (
          <div className="flex items-center gap-4 bg-white dark:bg-neutral-900 p-4 rounded-xl shadow-sm border border-neutral-200 dark:border-white/5 animate-in fade-in slide-in-from-top-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-neutral-500">Date début</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="h-10 pl-10 pr-4 rounded-lg bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-neutral-500">Date fin</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="h-10 pl-10 pr-4 rounded-lg bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-neutral-200 dark:border-white/5 overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-neutral-500">Chargement de l'historique...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center p-8 text-center">
            <div className="max-w-md">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">Erreur de chargement</h3>
              <p className="text-neutral-500 mb-6">Impossible de récupérer l'historique des commandes. Veuillez vérifier votre connexion.</p>
            </div>
          </div>
        ) : !commandes || commandes.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-8 text-center">
            <div className="max-w-md">
              <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-white/5 flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-neutral-400" />
              </div>
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">Aucune commande trouvée</h3>
              <p className="text-neutral-500">Aucune commande ne correspond aux filtres sélectionnés.</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-neutral-50 dark:bg-white/5 sticky top-0 z-10 backdrop-blur-md">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">N° Commande</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Serveuse</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Table</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider text-right">Montant</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider text-center">Statut</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-white/5">
                {commandes.map((cmd) => (
                  <tr key={cmd.id} className="hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="font-mono font-bold text-neutral-900 dark:text-white">
                        {cmd.numero_commande}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-300">
                      {formatDate(cmd.date_creation)}
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-300">
                      {cmd.profiles ? `${cmd.profiles.prenom} ${cmd.profiles.nom}` : 'Inconnu'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded bg-neutral-100 dark:bg-white/10 text-xs font-medium text-neutral-600 dark:text-neutral-300">
                        Table {cmd.tables?.numero || '?'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-neutral-900 dark:text-white">
                      {formatPrice(cmd.montant_total)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {getStatutBadge(cmd.statut)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleOpenDetails(cmd)}
                        className="p-2 rounded-lg text-neutral-400 hover:text-primary hover:bg-primary/10 transition-colors"
                        title="Voir détails"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details Dialog */}
      {showDetailsDialog && selectedCommande && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-white/10">
              <div>
                <h3 className="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-3">
                  Commande {selectedCommande.numero_commande}
                  {getStatutBadge(selectedCommande.statut)}
                </h3>
                <p className="text-sm text-neutral-500 mt-1">
                  {formatDate(selectedCommande.date_creation)} • Table {selectedCommande.tables?.numero}
                </p>
              </div>
              <button 
                onClick={() => setShowDetailsDialog(false)}
                className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="bg-neutral-50 dark:bg-white/5 rounded-xl p-4 mb-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-neutral-500 mb-1">Serveuse</p>
                    <p className="font-medium text-neutral-900 dark:text-white">
                      {selectedCommande.profiles ? `${selectedCommande.profiles.prenom} ${selectedCommande.profiles.nom}` : 'Non assigné'}
                    </p>
                  </div>
                  <div>
                    <p className="text-neutral-500 mb-1">Montant Total</p>
                    <p className="font-medium text-primary text-lg">
                      {formatPrice(selectedCommande.montant_total)}
                    </p>
                  </div>
                </div>
              </div>

              <h4 className="font-bold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-primary rounded-full"></span>
                Détails des articles
              </h4>
              
              <div className="space-y-3">
                {selectedCommande.commande_items?.map((item: any, index: number) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 dark:border-white/5 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-white/10 flex items-center justify-center text-sm font-bold text-neutral-600 dark:text-neutral-400">
                        {item.quantite}x
                      </span>
                      <div>
                        <p className="font-medium text-neutral-900 dark:text-white">
                          {item.produits?.nom || 'Article'}
                        </p>
                        {item.notes && (
                          <p className="text-xs text-neutral-500 italic">
                            Note: {item.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="font-medium text-neutral-900 dark:text-white">
                      {formatPrice(item.prix_unitaire * item.quantite)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 flex justify-end">
              <button
                onClick={() => setShowDetailsDialog(false)}
                className="px-6 py-2.5 rounded-xl font-medium text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-white/10 border border-transparent hover:border-neutral-200 dark:hover:border-white/10 transition-all"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}