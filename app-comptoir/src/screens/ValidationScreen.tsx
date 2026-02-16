import { useState } from 'react';
import { 
  CheckCircle, 
  X, 
  Clock, 
  User, 
  UtensilsCrossed, 
  Eye, 
  Loader2,
  AlertCircle,
  RefreshCcw
} from 'lucide-react';
import { useCommandesEnAttente } from '../hooks/useSupabaseQuery';
import { useValidateCommande } from '../hooks/useSupabaseMutation';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import type { CommandeWithDetails } from '../types/database.types';
import { formatPrice, formatDate } from '../lib/utils';

export default function ValidationScreen() {
  const { data: commandes, isLoading, refetch, isRefetching } = useCommandesEnAttente();
  const { mutate: validateCommande, isPending } = useValidateCommande();
  const [selectedCommande, setSelectedCommande] = useState<CommandeWithDetails | null>(null);
  const [error, setError] = useState('');

  // Synchronisation temps réel pour les commandes et les items
  useRealtimeSubscription('commandes', '*');
  useRealtimeSubscription('commande_items', '*');

  const handleValidate = (commandeId: string) => {
    setError('');
    validateCommande(commandeId, {
      onSuccess: () => {
        setSelectedCommande(null);
      },
      onError: (err: any) => {
        setError(err.message || 'Erreur lors de la validation');
      },
    });
  };

  const totalAmount = commandes?.reduce((sum, cmd) => sum + cmd.montant_total, 0) || 0;
  const pendingCount = commandes?.length || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background-light dark:bg-background-dark transition-colors">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 pb-24 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header & Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="col-span-1 md:col-span-2 lg:col-span-2">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-display font-bold text-primary dark:text-white">
                Validations
              </h1>
              <button 
                onClick={() => refetch()}
                disabled={isRefetching}
                className={`p-2 rounded-lg bg-white/50 dark:bg-neutral-800/50 border border-white/20 dark:border-white/5 text-primary dark:text-white hover:bg-white dark:hover:bg-neutral-800 transition-all duration-200 ${isRefetching ? 'animate-spin' : 'hover:rotate-180'}`}
                title="Actualiser"
              >
                <RefreshCcw className="w-5 h-5" />
              </button>
            </div>
            <p className="text-neutral-500 dark:text-neutral-400">
              Gérez les commandes en attente de validation
            </p>
          </div>
          
          <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl rounded-2xl p-4 border border-white/20 dark:border-white/5 shadow-soft flex items-center justify-between group hover:shadow-glow transition-all duration-300">
            <div>
              <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">En attente</p>
              <p className="text-3xl font-bold text-primary dark:text-white group-hover:scale-105 transition-transform origin-left">{pendingCount}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-semantic-amber/10 flex items-center justify-center text-semantic-amber group-hover:rotate-12 transition-transform duration-300">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl rounded-2xl p-4 border border-white/20 dark:border-white/5 shadow-soft flex items-center justify-between group hover:shadow-glow-success transition-all duration-300">
            <div>
              <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Montant Total</p>
              <p className="text-3xl font-bold text-primary dark:text-white group-hover:scale-105 transition-transform origin-left">{formatPrice(totalAmount)}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-semantic-green/10 flex items-center justify-center text-semantic-green group-hover:rotate-12 transition-transform duration-300">
              <span className="font-bold text-xl">₣</span>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-semantic-red/10 border border-semantic-red/20 backdrop-blur-sm text-semantic-red p-4 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <p>{error}</p>
            </div>
            <button onClick={() => setError('')} className="hover:bg-semantic-red/20 p-1 rounded-full transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content */}
        {commandes && commandes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm rounded-3xl border border-dashed border-neutral-200 dark:border-white/10">
            <div className="w-24 h-24 bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-700 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <CheckCircle className="w-12 h-12 text-neutral-400 dark:text-neutral-500" />
            </div>
            <h3 className="text-xl font-bold text-primary dark:text-white mb-2">
              Tout est calme
            </h3>
            <p className="text-neutral-500 dark:text-neutral-400 max-w-sm">
              Aucune commande en attente de validation pour le moment.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {commandes?.map((commande) => (
              <div 
                key={commande.id}
                className="group bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-white/5 shadow-sm hover:shadow-glow hover:-translate-y-1 transition-all duration-300 relative overflow-hidden flex flex-col"
              >
                {/* Status Stripe */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-semantic-amber"></div>

                {/* Card Header */}
                <div className="p-5 border-b border-neutral-100 dark:border-white/5 flex justify-between items-start bg-gradient-to-r from-transparent to-neutral-50/50 dark:to-white/5">
                  <div className="flex items-center gap-3 pl-2">
                    <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-neutral-100 to-white dark:from-neutral-800 dark:to-neutral-700 border border-neutral-200 dark:border-white/10 shadow-sm">
                      <User className="w-6 h-6 text-neutral-500 dark:text-neutral-400" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-primary dark:text-white">
                        {commande.profiles?.prenom || 'Inconnu'} {commande.profiles?.nom || ''}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 font-medium mt-0.5">
                        <span className="flex items-center gap-1 bg-neutral-100 dark:bg-white/5 px-1.5 py-0.5 rounded text-neutral-600 dark:text-neutral-300">
                          <UtensilsCrossed className="w-3 h-3" />
                          Table {commande.tables?.numero || '?'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(commande.date_creation)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-semantic-amber/10 text-semantic-amber border border-semantic-amber/20 shadow-sm">
                    {commande.statut}
                  </span>
                </div>

                {/* Card Body */}
                <div className="p-5 pl-7 flex-1 space-y-3">
                  <div className="space-y-2.5">
                    {/* Mode diagnostic : affichage minimal si pas d'items */}
                    {commande.commande_items && commande.commande_items.length > 0 ? (
                      commande.commande_items.slice(0, 3).map((item, index) => (
                        <div key={index} className="flex justify-between items-baseline text-sm group/item">
                          <span className="text-neutral-700 dark:text-neutral-200 font-medium flex items-center gap-2">
                            <span className="w-6 h-6 rounded bg-neutral-100 dark:bg-white/5 flex items-center justify-center text-xs font-bold text-primary dark:text-white border border-neutral-200 dark:border-white/5 group-hover/item:border-primary/30 transition-colors">
                              {item.quantite}x
                            </span>
                            {item.nom_produit}
                          </span>
                          <span className="text-neutral-500 dark:text-neutral-400 text-xs tabular-nums font-mono">
                            {formatPrice(item.prix_unitaire * item.quantite)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-neutral-400 italic">
                        Chargement des détails... (Mode minimal)
                        <br/>
                        ID: {commande.id.substring(0, 8)}...
                      </div>
                    )}
                    
                    {commande.commande_items && commande.commande_items.length > 3 && (
                      <p className="text-xs text-primary dark:text-blue-400 italic pt-1 pl-8 font-medium">
                        +{commande.commande_items.length - 3} autres articles...
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Footer */}
                <div className="p-5 pl-7 pt-0 mt-auto space-y-4">
                  <div className="flex justify-between items-center pt-4 border-t border-neutral-100 dark:border-white/5 border-dashed">
                    <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Total</span>
                    <span className="text-xl font-bold text-primary dark:text-white tabular-nums tracking-tight">
                      {formatPrice(commande.montant_total)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setSelectedCommande(commande)}
                      className="h-11 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 font-bold text-sm hover:bg-neutral-50 dark:hover:bg-white/5 flex items-center justify-center gap-2 transition-all duration-200 hover:shadow-sm"
                    >
                      <Eye className="w-4 h-4" />
                      Détails
                    </button>
                    <button
                      onClick={() => handleValidate(commande.id)}
                      disabled={isPending}
                      className="h-11 rounded-xl bg-gradient-to-r from-primary to-blue-600 hover:from-blue-600 hover:to-primary text-white font-bold text-sm flex items-center justify-center gap-2 transition-all duration-300 shadow-lg shadow-primary/25 hover:shadow-primary/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none hover:-translate-y-0.5 active:translate-y-0"
                    >
                      {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      Valider
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedCommande && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-neutral-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-neutral-100 dark:border-neutral-700 flex justify-between items-center bg-neutral-50 dark:bg-neutral-800/50">
              <h3 className="font-bold text-lg text-primary dark:text-white">Détails de la commande</h3>
              <button 
                onClick={() => setSelectedCommande(null)}
                className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>
            
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Client</p>
                  <p className="font-bold text-primary dark:text-white text-lg">
                    {selectedCommande.profiles.prenom} {selectedCommande.profiles.nom}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Table</p>
                  <p className="font-bold text-primary dark:text-white text-lg">
                    #{selectedCommande.tables.numero}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-100 dark:border-neutral-700 pb-2">
                  Articles commandés
                </p>
                {selectedCommande.commande_items.map((item, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b border-neutral-50 dark:border-neutral-800 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center text-sm font-bold text-primary dark:text-white">
                        {item.quantite}
                      </span>
                      <span className="font-medium text-primary dark:text-white">
                        {item.nom_produit}
                      </span>
                    </div>
                    <span className="font-bold text-primary dark:text-white tabular-nums">
                      {formatPrice(item.prix_unitaire * item.quantite)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-4 border-t border-neutral-100 dark:border-neutral-700">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-lg font-bold text-primary dark:text-white">Total à payer</span>
                  <span className="text-2xl font-bold text-semantic-green tabular-nums">
                    {formatPrice(selectedCommande.montant_total)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSelectedCommande(null)}
                    className="w-full py-3 rounded-xl border border-neutral-200 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 font-bold hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                  >
                    Fermer
                  </button>
                  <button
                    onClick={() => handleValidate(selectedCommande.id)}
                    disabled={isPending}
                    className="w-full py-3 rounded-xl bg-primary hover:bg-primary-dark dark:bg-white dark:text-primary dark:hover:bg-neutral-200 text-white font-bold flex items-center justify-center gap-2 transition-all"
                  >
                    {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                    Valider la commande
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}