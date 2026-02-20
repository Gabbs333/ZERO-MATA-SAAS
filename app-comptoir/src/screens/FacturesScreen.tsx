import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useFactures, useFacturesImpayeesAlerts } from '../hooks/useSupabaseQuery';
import { useCreateEncaissement } from '../hooks/useSupabaseMutation';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import { useAuthStore } from '../store/authStore';
import type { FactureWithDetails } from '../types/database.types';
import { Receipt } from '../components/Receipt';
import { 
  Loader, 
  AlertTriangle, 
  Receipt as ReceiptIcon, 
  CreditCard, 
  Banknote, 
  Smartphone, 
  Check, 
  X,
  Search,
  Eye,
  Calendar,
  Filter,
  Printer
} from 'lucide-react';
import { cn } from '../lib/utils';
import { startOfDay, startOfWeek, startOfMonth, endOfDay } from 'date-fns';

type TimeFilter = 'today' | 'week' | 'month' | 'all' | 'custom';

export default function FacturesScreen() {
  const { profile } = useAuthStore();
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFacture, setSelectedFacture] = useState<FactureWithDetails | null>(null);
  const [showEncaissementDialog, setShowEncaissementDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [montant, setMontant] = useState('');
  const [modePaiement, setModePaiement] = useState<'especes' | 'carte' | 'mobile_money' | 'cheque'>('especes');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  const getStartDate = (filter: TimeFilter) => {
    const now = new Date();
    switch (filter) {
      case 'today': return startOfDay(now).toISOString();
      case 'week': return startOfWeek(now, { weekStartsOn: 1 }).toISOString();
      case 'month': return startOfMonth(now).toISOString();
      case 'custom': return customStartDate ? startOfDay(new Date(customStartDate)).toISOString() : undefined;
      default: return undefined;
    }
  };

  const getEndDate = (filter: TimeFilter) => {
    if (filter === 'custom' && customEndDate) {
      return endOfDay(new Date(customEndDate)).toISOString();
    }
    return undefined;
  };

  const statutFilter = tabValue === 0 ? undefined : tabValue === 1 ? 'en_attente_paiement' : 'payee';
  const { data: factures, isLoading, error: queryError, isError } = useFactures(statutFilter, 50, getStartDate(timeFilter), getEndDate(timeFilter));
  const { data: alertes } = useFacturesImpayeesAlerts();
  const { mutate: createEncaissement, isPending } = useCreateEncaissement();

  // Synchronisation temps réel
  useRealtimeSubscription('factures', '*');
  useRealtimeSubscription('encaissements', '*');

  const filteredFactures = useMemo(() => {
    if (!factures) return [];
    return factures.filter(f => 
      f.numero_facture.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.commandes.numero_commande.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [factures, searchQuery]);

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
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-semantic-green/10 text-semantic-green border border-semantic-green/20">Payée</span>;
      case 'partiellement_payee':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-semantic-amber/10 text-semantic-amber border border-semantic-amber/20">Partielle</span>;
      case 'en_attente_paiement':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-semantic-red/10 text-semantic-red border border-semantic-red/20">Impayée</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700">{statut}</span>;
    }
  };

  const handleOpenEncaissement = (facture: FactureWithDetails) => {
    setSelectedFacture(facture);
    const montantRestant = facture.montant_total - facture.montant_paye;
    setMontant(montantRestant.toString());
    setShowEncaissementDialog(true);
    setError('');
  };

  const handleOpenDetails = (facture: FactureWithDetails) => {
    setSelectedFacture(facture);
    setShowDetailsDialog(true);
  };

  const handleCreateEncaissement = () => {
    if (!selectedFacture) return;

    const montantNum = parseFloat(montant);
    if (isNaN(montantNum) || montantNum <= 0) {
      setError('Montant invalide');
      return;
    }

    const montantRestant = selectedFacture.montant_total - selectedFacture.montant_paye;
    if (montantNum > montantRestant) {
      setError(`Le montant ne peut pas dépasser ${formatPrice(montantRestant)}`);
      return;
    }

    createEncaissement(
      {
        facture_id: selectedFacture.id,
        montant: montantNum,
        mode_paiement: modePaiement,
        reference: reference || undefined,
      },
      {
        onSuccess: () => {
          setShowEncaissementDialog(false);
          setSelectedFacture(null);
          setMontant('');
          setReference('');
        },
        onError: (err: any) => {
          setError(err.message || 'Erreur lors de l\'encaissement');
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[50vh] text-neutral-500 dark:text-neutral-400">
        <Loader className="w-8 h-8 animate-spin text-primary dark:text-white mb-2" />
        <p>Chargement des factures...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[50vh] text-semantic-red">
        <AlertTriangle className="w-12 h-12 mb-4" />
        <h3 className="text-xl font-bold mb-2">Erreur de chargement</h3>
        <p className="text-center max-w-md mb-4">{queryError?.message || "Impossible de charger les factures."}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 pb-20 lg:pb-0 animate-in fade-in slide-in-from-bottom-4 duration-500 print:hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-primary dark:text-white mb-2">Factures & Encaissements</h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">Gérez les paiements et suivez les créances</p>
        </div>
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Rechercher N° Facture..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full md:w-64 pl-10 pr-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm text-sm focus:ring-2 focus:ring-primary dark:focus:ring-white outline-none transition-all shadow-sm group-hover:shadow-md"
          />
        </div>
      </div>

      {alertes && alertes.length > 0 && (
        <div className="bg-semantic-red/10 border border-semantic-red/20 backdrop-blur-sm rounded-xl p-4 flex items-center gap-3 text-semantic-red animate-pulse shadow-glow-error">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="font-bold">{alertes.length} facture(s) impayée(s) depuis plus de 24h !</p>
        </div>
      )}

      {/* Tabs Pill Style */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex p-1.5 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl rounded-xl w-full md:w-fit border border-neutral-200 dark:border-white/10 shadow-sm">
          {[
            { label: 'Toutes', value: 0 },
            { label: 'À Encaisser', value: 1 },
            { label: 'Terminées', value: 2 }
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setTabValue(tab.value)}
              className={cn(
                "flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-200",
                tabValue === tab.value
                  ? "bg-primary dark:bg-white text-white dark:text-primary shadow-md shadow-primary/20 dark:shadow-white/10"
                  : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Time Filters */}
        <div className="flex flex-col gap-4 w-full md:w-auto">
          <div className="flex p-1.5 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl rounded-xl w-full border border-neutral-200 dark:border-white/10 shadow-sm overflow-x-auto">
            {[
              { label: "Aujourd'hui", value: 'today' },
              { label: 'Cette semaine', value: 'week' },
              { label: 'Ce mois', value: 'month' },
              { label: 'Tout', value: 'all' },
              { label: 'Personnalisé', value: 'custom' }
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => setTimeFilter(filter.value as TimeFilter)}
                className={cn(
                  "flex-1 px-4 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 whitespace-nowrap",
                  timeFilter === filter.value
                    ? "bg-neutral-100 dark:bg-white/10 text-primary dark:text-white"
                    : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-white/5"
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
          
          {timeFilter === 'custom' && (
            <div className="flex flex-wrap items-center gap-2 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl rounded-xl p-2 border border-neutral-200 dark:border-white/10">
                <Calendar className="w-4 h-4 text-neutral-500" />
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-transparent border-none text-sm text-primary dark:text-white focus:ring-0 p-0"
                  placeholder="Date début"
                />
              </div>
              <span className="text-neutral-400">-</span>
              <div className="flex items-center gap-2 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl rounded-xl p-2 border border-neutral-200 dark:border-white/10">
                <Calendar className="w-4 h-4 text-neutral-500" />
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-transparent border-none text-sm text-primary dark:text-white focus:ring-0 p-0"
                  placeholder="Date fin"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {filteredFactures.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm rounded-3xl border border-dashed border-neutral-200 dark:border-white/10">
          <div className="w-20 h-20 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-4 shadow-inner">
            <Search className="w-10 h-10 text-neutral-400 dark:text-neutral-500" />
          </div>
          <h3 className="text-xl font-bold text-primary dark:text-white">Aucune facture trouvée</h3>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1 max-w-xs">
            Aucune facture ne correspond à vos critères de recherche ou de filtre.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredFactures.map((facture) => {
            const montantRestant = facture.montant_total - facture.montant_paye;
            
            return (
              <div key={facture.id} className="group bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-white/5 shadow-soft hover:shadow-glow hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col">
                <div className="p-6 flex-1 relative">
                  <div className="flex justify-between items-start mb-4">
                     {getStatutBadge(facture.statut)}
                     <div className="flex items-center gap-2">
                       <button
                         onClick={() => handleOpenDetails(facture)}
                         className="p-1.5 rounded-lg bg-neutral-100 dark:bg-white/5 text-neutral-500 hover:text-primary dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors"
                         title="Voir détails"
                       >
                         <Eye className="w-4 h-4" />
                       </button>
                       <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium flex items-center gap-1 bg-neutral-100 dark:bg-white/5 px-2 py-1 rounded-lg">
                          <Smartphone className="w-3 h-3" />
                          {formatDate(facture.date_generation)}
                       </p>
                     </div>
                  </div>
                  
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-neutral-100 to-white dark:from-neutral-800 dark:to-neutral-700 border border-neutral-200 dark:border-white/10 shadow-sm flex items-center justify-center flex-shrink-0">
                      <ReceiptIcon className="w-6 h-6 text-primary dark:text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold font-display text-primary dark:text-white tracking-tight truncate" title={facture.numero_facture}>
                        {facture.numero_facture}
                      </h3>
                    </div>
                  </div>

                  <div className="space-y-3 bg-neutral-50/50 dark:bg-white/5 rounded-xl p-4 border border-neutral-100 dark:border-white/5">
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-neutral-500 dark:text-neutral-400 font-medium">Commande</span>
                      <div className="flex flex-col items-end">
                         <Link
                           to={`/historique?search=${facture.commandes.numero_commande}`}
                           className="font-bold text-primary dark:text-white bg-white dark:bg-neutral-800 px-2 py-0.5 rounded border border-neutral-200 dark:border-white/10 shadow-sm mb-1 hover:text-blue-600 hover:border-blue-600 transition-colors cursor-pointer"
                         >
                           {facture.commandes.numero_commande}
                         </Link>
                         {facture.commandes.tables?.numero && (
                             <span className="text-[10px] font-bold text-neutral-500 uppercase">
                               Table {facture.commandes.tables.numero}
                             </span>
                         )}
                      </div>
                    </div>
                    {facture.commandes.profiles && (
                        <div className="flex justify-between text-sm items-center">
                          <span className="text-neutral-500 dark:text-neutral-400 font-medium">Serveuse</span>
                          <span className="font-medium text-neutral-700 dark:text-neutral-300">
                            {facture.commandes.profiles.prenom} {facture.commandes.profiles.nom?.charAt(0)}.
                          </span>
                        </div>
                    )}
                    <div className="h-px bg-neutral-200 dark:bg-white/10 my-2" />
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-neutral-500 dark:text-neutral-400 font-medium">Montant total</span>
                      <span className="font-bold text-primary dark:text-white text-base">{formatPrice(facture.montant_total)}</span>
                    </div>
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-neutral-500 dark:text-neutral-400 font-medium">Déjà payé</span>
                      <span className="font-bold text-semantic-green">{formatPrice(facture.montant_paye)}</span>
                    </div>
                    
                    {montantRestant > 0 && (
                      <div className="pt-3 border-t border-neutral-200/50 dark:border-white/10 flex justify-between items-center">
                        <span className="text-sm font-bold text-semantic-red uppercase tracking-wider text-[10px]">Reste à payer</span>
                        <span className="text-xl font-bold text-semantic-red tracking-tight">{formatPrice(montantRestant)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {montantRestant > 0 ? (
                  <div className="p-4 bg-neutral-50/80 dark:bg-neutral-800/50 border-t border-neutral-200 dark:border-white/5 backdrop-blur-sm">
                    <button
                      onClick={() => handleOpenEncaissement(facture)}
                      className="w-full h-12 bg-gradient-to-r from-primary to-blue-600 hover:from-blue-600 hover:to-primary text-white rounded-xl flex items-center justify-center gap-2 text-sm font-bold hover:shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300"
                    >
                      <Banknote className="w-5 h-5" />
                      Encaisser {formatPrice(montantRestant)}
                    </button>
                  </div>
                ) : (
                  <div className="p-4 bg-semantic-green/10 border-t border-semantic-green/20 flex justify-center">
                     <span className="flex items-center gap-2 text-semantic-green font-bold text-sm uppercase tracking-wider">
                       <Check className="w-4 h-4" />
                       Facture Soldée
                     </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Encaissement */}
      {showEncaissementDialog && selectedFacture && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm">
          <div className="bg-white/95 dark:bg-neutral-900/95 backdrop-blur-2xl rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-300 border border-white/20 dark:border-white/10 ring-1 ring-black/5 flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-neutral-200 dark:border-white/5 flex justify-between items-center bg-gradient-to-r from-neutral-50/50 to-white/50 dark:from-white/5 dark:to-transparent flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-br from-primary to-blue-600 rounded-xl shadow-lg shadow-primary/20">
                  <Banknote className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg text-primary dark:text-white leading-tight">Encaissement</h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">Enregistrer un paiement</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => window.print()}
                  className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-white/10 text-neutral-500 hover:text-blue-600 dark:text-neutral-400 dark:hover:text-white transition-colors"
                  title="Imprimer le reçu"
                >
                  <Printer className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setShowEncaissementDialog(false)}
                  className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-white/10 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto">
              <div className="space-y-4">
                <div className="bg-neutral-50 dark:bg-white/5 p-4 rounded-xl border border-neutral-100 dark:border-white/5">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-neutral-500 dark:text-neutral-400">Facture</span>
                    <span className="font-bold text-primary dark:text-white">{selectedFacture.numero_facture}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-neutral-500 dark:text-neutral-400">Commande</span>
                    <span className="font-bold text-primary dark:text-white">{selectedFacture.commandes.numero_commande}</span>
                  </div>
                  <div className="h-px bg-neutral-200 dark:bg-white/10 my-2" />
                  <div className="flex justify-between items-end">
                    <span className="text-sm font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Reste à payer</span>
                    <span className="text-2xl font-bold font-display text-semantic-red">
                      {formatPrice(selectedFacture.montant_total - selectedFacture.montant_paye)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700 dark:text-neutral-300 ml-1">Montant à encaisser</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={montant}
                      onChange={(e) => setMontant(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:ring-2 focus:ring-primary outline-none transition-all font-bold text-lg"
                      placeholder="0"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 font-bold text-sm">FCFA</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700 dark:text-neutral-300 ml-1">Mode de paiement</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'especes', label: 'Espèces', icon: Banknote },
                      { id: 'carte', label: 'Carte', icon: CreditCard },
                      { id: 'mobile_money', label: 'Mobile Money', icon: Smartphone },
                      { id: 'cheque', label: 'Chèque', icon: ReceiptIcon },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        onClick={() => setModePaiement(mode.id as any)}
                        className={cn(
                          "flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-bold transition-all",
                          modePaiement === mode.id
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-neutral-50 dark:bg-white/5 border-transparent text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/10"
                        )}
                      >
                        <mode.icon className="w-4 h-4" />
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-700 dark:text-neutral-300 ml-1">Référence (Optionnel)</label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:ring-2 focus:ring-primary outline-none transition-all text-sm"
                    placeholder="Numéro de transaction, chèque..."
                  />
                </div>

                {error && (
                  <div className="p-3 bg-semantic-red/10 border border-semantic-red/20 rounded-xl text-semantic-red text-sm font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    {error}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-neutral-200 dark:border-white/5 bg-neutral-50/50 dark:bg-white/5 flex-shrink-0">
              <button
                onClick={handleCreateEncaissement}
                disabled={isPending}
                className="w-full py-3.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold shadow-lg shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
              >
                {isPending ? (
                  <Loader className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Confirmer l'encaissement
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Détails */}
      {showDetailsDialog && selectedFacture && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm print:hidden">
          <div className="bg-white/95 dark:bg-neutral-900/95 backdrop-blur-2xl rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-300 border border-white/20 dark:border-white/10 ring-1 ring-black/5 flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-neutral-200 dark:border-white/5 flex justify-between items-center bg-gradient-to-r from-neutral-50/50 to-white/50 dark:from-white/5 dark:to-transparent flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-neutral-100 dark:bg-white/10 rounded-xl">
                  <ReceiptIcon className="w-5 h-5 text-primary dark:text-white" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg text-primary dark:text-white leading-tight">Détails Facture</h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">{selectedFacture.numero_facture}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => window.print()}
                  className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-white/10 text-neutral-400 hover:text-primary dark:hover:text-white transition-colors"
                  title="Imprimer"
                >
                  <Printer className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setShowDetailsDialog(false)}
                  className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-white/10 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto">
              <div className="bg-neutral-50 dark:bg-white/5 p-4 rounded-xl border border-neutral-100 dark:border-white/5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider block mb-1">Date</span>
                    <span className="font-medium text-primary dark:text-white">{formatDate(selectedFacture.date_generation)}</span>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider block mb-1">Table</span>
                    <span className="font-medium text-primary dark:text-white">N° {selectedFacture.commandes.tables?.numero}</span>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider block mb-1">Serveuse</span>
                    <span className="font-medium text-primary dark:text-white">{selectedFacture.commandes.profiles?.prenom} {selectedFacture.commandes.profiles?.nom}</span>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider block mb-1">Statut</span>
                    {getStatutBadge(selectedFacture.statut)}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-primary dark:text-white mb-3">Contenu de la commande</h4>
                <div className="space-y-2">
                  {selectedFacture.commandes.commande_items?.map((item: any) => (
                    <div key={item.id} className="flex justify-between items-center py-2 border-b border-neutral-100 dark:border-white/5 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-white/5 flex items-center justify-center font-bold text-sm text-primary dark:text-white">
                          {item.quantite}
                        </div>
                        <span className="font-medium text-primary dark:text-white">{item.nom_produit}</span>
                      </div>
                      <span className="font-bold text-primary dark:text-white">{formatPrice(item.prix_unitaire * item.quantite)}</span>
                    </div>
                  ))}
                  {(!selectedFacture.commandes.commande_items || selectedFacture.commandes.commande_items.length === 0) && (
                    <p className="text-sm text-neutral-500 italic">Aucun article trouvé.</p>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-neutral-200 dark:border-white/10 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-neutral-500 dark:text-neutral-400 font-medium">Sous-total</span>
                  <span className="font-bold text-primary dark:text-white">{formatPrice(selectedFacture.montant_total)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-500 dark:text-neutral-400 font-medium">Déjà payé</span>
                  <span className="font-bold text-semantic-green">{formatPrice(selectedFacture.montant_paye)}</span>
                </div>
                <div className="h-px bg-neutral-200 dark:bg-white/10 my-2" />
                <div className="flex justify-between items-center">
                  <span className="font-bold text-lg text-primary dark:text-white">Reste à payer</span>
                  <span className="font-bold text-xl font-display text-semantic-red">
                    {formatPrice(selectedFacture.montant_total - selectedFacture.montant_paye)}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-neutral-200 dark:border-white/5 bg-white dark:bg-neutral-900 flex-shrink-0 flex gap-3">
               <button
                  onClick={() => window.print()}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                >
                  <Printer className="w-5 h-5" />
                  Imprimer Ticket
                </button>
               <button
                  onClick={() => setShowDetailsDialog(false)}
                  className="flex-1 py-3 bg-neutral-100 dark:bg-white/10 hover:bg-neutral-200 dark:hover:bg-white/20 text-neutral-900 dark:text-white rounded-xl font-bold transition-all"
                >
                  Fermer
                </button>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Printable Receipt */}
      {selectedFacture && (
        <div className="hidden print:block print:fixed print:inset-0 print:bg-white print:z-[9999] print:p-0">
          <Receipt 
            facture={selectedFacture} 
            etablissement={profile?.etablissement} 
            serveur={selectedFacture.commandes.profiles}
          />
        </div>
      )}
    </>
  );
}
