import { useState } from 'react';
import { useEtablissements, useExpiringEtablissements } from '../hooks/useSupabaseQuery';
import { useSuspendEtablissement, useReactivateEtablissement, useDeleteEtablissement } from '../hooks/useSupabaseMutation';
import { useAuthStore } from '../store/authStore';
import { format } from '../utils/format';
import { CreditCard, AlertTriangle, CheckCircle, XCircle, Search, RefreshCw, Clock, Filter, Building2, Trash2, PauseCircle, PlayCircle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function SubscriptionScreen() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const { data: allEtablissements, isPending: loadingAll } = useEtablissements();
  const { data: expiringEtablissements, isPending: loadingExpiring } = useExpiringEtablissements(30);

  const { mutate: suspendEtablissement } = useSuspendEtablissement();
  const { mutate: reactivateEtablissement } = useReactivateEtablissement();
  const { mutate: deleteEtablissement } = useDeleteEtablissement();
  const user = useAuthStore((state) => state.user);

  const filteredEtablissements = allEtablissements?.filter((etab: any) => {
    const matchesSearch = etab.nom.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || etab.statut_abonnement === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSuspend = (id: string, nom: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir suspendre l'établissement "${nom}" ? L'accès sera bloqué pour tous les utilisateurs.`)) {
      suspendEtablissement({
        etablissementId: id,
        adminUserId: user?.id,
        reason: 'Suspension manuelle par admin'
      });
    }
  };

  const handleReactivate = (id: string, nom: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir réactiver l'établissement "${nom}" ?`)) {
      reactivateEtablissement({
        etablissementId: id,
        adminUserId: user?.id
      });
    }
  };

  const handleDelete = (id: string, nom: string) => {
    if (window.confirm(`ATTENTION : Êtes-vous sûr de vouloir SUPPRIMER DÉFINITIVEMENT l'établissement "${nom}" ? Cette action est irréversible et supprimera toutes les données associées.`)) {
      deleteEtablissement({
        etablissementId: id,
        adminUserId: user?.id
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'actif':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shadow-sm">
            <CheckCircle size={12} className="mr-1.5" />
            Actif
          </span>
        );
      case 'expire':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20 shadow-sm">
            <XCircle size={12} className="mr-1.5" />
            Expiré
          </span>
        );
      case 'suspendu':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 shadow-sm">
            <AlertTriangle size={12} className="mr-1.5" />
            Suspendu
          </span>
        );
      default:
        return null;
    }
  };

  if (loadingAll || loadingExpiring) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary dark:border-white"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-primary dark:text-white">
            Abonnements
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-2 text-lg">
            Suivi des abonnements et renouvellements
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 bg-white/50 dark:bg-neutral-800/50 px-4 py-2 rounded-full border border-neutral-200 dark:border-neutral-700 backdrop-blur-sm">
            <CreditCard size={16} />
            <span className="font-bold text-primary dark:text-white">{filteredEtablissements?.length || 0}</span> abonnements trouvés
        </div>
      </div>

      {/* Expiring Soon Section */}
      {expiringEtablissements && expiringEtablissements.length > 0 && (
        <div className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl text-white shadow-lg shadow-amber-500/20">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                Expirent bientôt ({expiringEtablissements.length})
              </h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                Ces établissements nécessitent une attention particulière dans les 30 prochains jours.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {expiringEtablissements.map((etab: any) => (
              <div key={etab.id} className="bg-white/80 dark:bg-neutral-900/80 p-5 rounded-xl shadow-sm border border-amber-500/20 flex flex-col hover:shadow-md transition-all duration-200 group backdrop-blur-sm">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-neutral-900 dark:text-white line-clamp-1 group-hover:text-primary dark:group-hover:text-white transition-colors">{etab.nom}</h3>
                  <div className="bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded text-[10px] font-mono border border-amber-500/20">
                    {etab.id.slice(0, 6)}
                  </div>
                </div>
                <div className="mt-auto pt-3 border-t border-neutral-100 dark:border-white/5 flex justify-between items-center text-sm">
                  <span className="text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                    <Clock size={14} />
                    Expire le
                  </span>
                  <span className="font-bold text-amber-600 dark:text-amber-500">
                    {format.dateShort(etab.date_fin)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-grow group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-neutral-400 group-focus-within:text-primary dark:group-focus-within:text-white transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Rechercher un établissement..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-11 pr-4 py-3 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary dark:focus:border-white text-neutral-900 dark:text-white placeholder-neutral-400 transition-all shadow-sm group-hover:shadow-md"
          />
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
          <div className="flex items-center gap-2 p-1.5 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200 dark:border-white/10 rounded-xl shadow-sm">
            <Filter size={18} className="text-neutral-400 ml-2" />
            <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-700 mx-1" />
            {['all', 'actif', 'expire', 'suspendu'].map((status) => (
                <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap",
                    statusFilter === status
                    ? "bg-primary dark:bg-white text-white dark:text-primary shadow-md shadow-primary/20 dark:shadow-white/10"
                    : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5"
                )}
                >
                {status === 'all' ? 'Tous' : status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
            ))}
          </div>
        </div>
      </div>

      {/* All Subscriptions List */}
      <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 dark:border-white/10 flex flex-col overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: '1000px' }}>
            <thead>
              <tr className="border-b border-neutral-200 dark:border-white/5 bg-neutral-50/50 dark:bg-white/5">
                <th className="px-6 py-5 text-left text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Établissement</th>
                <th className="px-6 py-5 text-left text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Statut</th>
                <th className="px-6 py-5 text-left text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Début</th>
                <th className="px-6 py-5 text-left text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Fin</th>
                <th className="px-6 py-5 text-right text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-white/5">
              {filteredEtablissements?.map((etab: any) => (
                <tr key={etab.id} className="group hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors">
                  <td className="px-6 py-5 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-gradient-to-br from-primary/10 to-blue-500/10 dark:from-white/10 dark:to-white/5 flex items-center justify-center text-primary dark:text-white font-bold ring-1 ring-black/5 dark:ring-white/10 shadow-sm group-hover:scale-110 transition-transform duration-200">
                        <Building2 size={20} />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-bold text-neutral-900 dark:text-white group-hover:text-primary dark:group-hover:text-white transition-colors">
                          {etab.nom}
                        </div>
                        <div className="text-sm text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-xs bg-neutral-100 dark:bg-white/5 px-1.5 py-0.5 rounded border border-neutral-200 dark:border-white/10">
                              {etab.id.slice(0, 8)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap">
                    {getStatusBadge(etab.statut_abonnement)}
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-300">
                    {format.dateShort(etab.date_debut)}
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-300">
                    {format.dateShort(etab.date_fin)}
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap text-right">
                    <div className="flex justify-end gap-2">
                      <button className="text-neutral-400 hover:text-primary dark:hover:text-white p-2 rounded-lg hover:bg-primary/10 dark:hover:bg-white/10 transition-all transform hover:scale-110" title="Renouveler">
                        <RefreshCw size={18} />
                      </button>
                      
                      {etab.statut_abonnement === 'suspendu' ? (
                        <button 
                          onClick={() => handleReactivate(etab.id, etab.nom)}
                          className="text-neutral-400 hover:text-emerald-500 dark:hover:text-emerald-400 p-2 rounded-lg hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10 transition-all transform hover:scale-110" 
                          title="Réactiver"
                        >
                          <PlayCircle size={18} />
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleSuspend(etab.id, etab.nom)}
                          className="text-neutral-400 hover:text-amber-500 dark:hover:text-amber-400 p-2 rounded-lg hover:bg-amber-500/10 dark:hover:bg-amber-500/10 transition-all transform hover:scale-110" 
                          title="Suspendre"
                        >
                          <PauseCircle size={18} />
                        </button>
                      )}

                      <button 
                        onClick={() => handleDelete(etab.id, etab.nom)}
                        className="text-neutral-400 hover:text-rose-500 dark:hover:text-rose-400 p-2 rounded-lg hover:bg-rose-500/10 dark:hover:bg-rose-500/10 transition-all transform hover:scale-110" 
                        title="Supprimer"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
