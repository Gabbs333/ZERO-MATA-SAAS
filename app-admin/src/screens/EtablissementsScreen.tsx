import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { format } from '../utils/format';
import { Plus, Search, Eye, AlertCircle, Building2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Etablissement {
  id: string;
  nom: string;
  adresse: string | null;
  telephone: string | null;
  email: string | null;
  statut_abonnement: 'actif' | 'expire' | 'suspendu';
  date_debut: string;
  date_fin: string;
  actif: boolean;
  date_creation: string;
}

export default function EtablissementsScreen() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const navigate = useNavigate();

  const { data: etablissements, isPending: loading, error } = useSupabaseQuery<Etablissement[]>(
    ['etablissements', statusFilter],
    (supabase) => {
      let query = supabase
        .from('etablissements')
        .select('*')
        .order('date_creation', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('statut_abonnement', statusFilter);
      }

      return query;
    }
  );

  const filteredEtablissements = etablissements?.filter((etab) =>
    etab.nom.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isExpiringSoon = (dateFin: string) => {
    const endDate = new Date(dateFin);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary dark:border-white"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-semantic-red/10 border border-semantic-red/20 text-semantic-red p-4 rounded-lg flex items-center gap-2">
        <AlertCircle className="w-5 h-5" />
        Erreur: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
            <h1 className="text-4xl font-display font-bold text-neutral-900 dark:text-white mb-2 tracking-tight">
            Établissements
            </h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-lg">
                Gérez vos clients et leurs abonnements
            </p>
        </div>
        <button
          onClick={() => navigate('/etablissements/nouveau')}
          className="group flex items-center bg-primary dark:bg-white text-white dark:text-primary px-6 py-3 rounded-xl font-bold hover:shadow-lg hover:shadow-primary/25 transition-all active:scale-95"
        >
          <Plus size={20} className="mr-2 transition-transform group-hover:rotate-90" />
          Nouvel Établissement
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="relative flex-grow group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="text-neutral-400 group-focus-within:text-primary transition-colors" size={20} />
          </div>
          <input
            type="text"
            placeholder="Rechercher un établissement..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm border border-neutral-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 dark:focus:ring-primary/50 focus:border-primary/50 text-neutral-900 dark:text-white placeholder-neutral-400 transition-all shadow-sm group-hover:border-neutral-300 dark:group-hover:border-white/20"
          />
        </div>
        
        <div className="flex flex-wrap gap-2 bg-white/50 dark:bg-neutral-900/50 p-1.5 rounded-xl border border-neutral-200 dark:border-white/10 backdrop-blur-sm">
          {[
            { id: 'all', label: 'Tous' },
            { id: 'actif', label: 'Actifs' },
            { id: 'expire', label: 'Expirés' },
            { id: 'suspendu', label: 'Suspendus' },
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => setStatusFilter(filter.id)}
              className={cn(
                "px-4 py-2 rounded-lg font-bold text-sm transition-all duration-300",
                statusFilter === filter.id
                  ? "bg-primary dark:bg-white text-white dark:text-primary shadow-lg shadow-primary/25 scale-105"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEtablissements?.map((etab) => (
          <div 
            key={etab.id} 
            className="group relative bg-white dark:bg-neutral-800/40 backdrop-blur-md rounded-2xl border border-neutral-200 dark:border-white/5 flex flex-col hover:border-primary/50 dark:hover:border-primary/50 transition-all duration-300 hover:shadow-glow hover:-translate-y-1"
          >
            {/* Card Gradient Background on Hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl" />

            <div className="p-6 flex-grow space-y-4 relative z-10">
              <div className="flex justify-between items-start gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-neutral-100 to-neutral-50 dark:from-white/10 dark:to-white/5 flex items-center justify-center text-neutral-500 dark:text-white flex-shrink-0 shadow-inner border border-white/20">
                        <Building2 className="w-6 h-6 group-hover:text-primary transition-colors duration-300" />
                    </div>
                    <div className="min-w-0 relative group/tooltip">
                        <h2 className="text-lg font-bold text-neutral-900 dark:text-white line-clamp-1 cursor-help group-hover:text-primary transition-colors" title={etab.nom}>
                        {etab.nom}
                        </h2>
                        <div className="absolute top-full left-0 mt-2 hidden group-hover/tooltip:block z-50 w-max max-w-[250px] bg-neutral-900/95 text-white text-xs p-2.5 rounded-lg shadow-xl backdrop-blur-sm border border-white/10 break-words whitespace-normal animate-in fade-in zoom-in-95 duration-200">
                          <p className="font-medium">{etab.nom}</p>
                        </div>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-neutral-300 dark:bg-neutral-600"></span>
                          ID: {etab.id.slice(0, 8)}
                        </p>
                    </div>
                </div>
                <span className={cn(
                  "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border whitespace-nowrap flex-shrink-0 shadow-sm",
                  etab.statut_abonnement === 'actif' && "bg-semantic-green/10 text-semantic-green border-semantic-green/20 shadow-glow-success",
                  etab.statut_abonnement === 'expire' && "bg-semantic-red/10 text-semantic-red border-semantic-red/20 shadow-glow-error",
                  etab.statut_abonnement === 'suspendu' && "bg-semantic-amber/10 text-semantic-amber border-semantic-amber/20"
                )}>
                  {etab.statut_abonnement}
                </span>
              </div>

              <div className="space-y-3 text-sm text-neutral-600 dark:text-neutral-300 bg-neutral-50/50 dark:bg-black/20 rounded-xl p-4 border border-neutral-100 dark:border-white/5">
                {etab.adresse && (
                  <p className="line-clamp-1 flex items-center gap-3" title={etab.adresse}>
                    <span className="w-16 text-neutral-400 dark:text-neutral-500 text-xs font-bold uppercase tracking-wider flex-shrink-0">Adresse</span>
                    <span className="font-medium truncate">{etab.adresse}</span>
                  </p>
                )}
                {etab.telephone && (
                  <p className="flex items-center gap-3" title={etab.telephone}>
                    <span className="w-16 text-neutral-400 dark:text-neutral-500 text-xs font-bold uppercase tracking-wider flex-shrink-0">Tél</span>
                    <span className="font-medium font-mono truncate">{etab.telephone}</span>
                  </p>
                )}
                {etab.email && (
                  <p className="line-clamp-1 flex items-center gap-3" title={etab.email}>
                    <span className="w-16 text-neutral-400 dark:text-neutral-500 text-xs font-bold uppercase tracking-wider flex-shrink-0">Email</span>
                    <span className="font-medium truncate">{etab.email}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-neutral-50/50 dark:bg-white/5 border-t border-neutral-100 dark:border-white/5 rounded-b-2xl flex flex-wrap items-center justify-between gap-4 relative z-10">
                <div className="text-xs flex items-center">
                    <span className="text-neutral-400 dark:text-neutral-500 mr-2 font-medium uppercase tracking-wide">Expiration</span>
                    <span className={cn(
                        "font-bold font-mono text-sm",
                        isExpiringSoon(etab.date_fin) ? "text-semantic-amber drop-shadow-sm" : "text-neutral-700 dark:text-neutral-200"
                    )}>
                        {format.date(etab.date_fin)}
                    </span>
                </div>

              <button
                onClick={() => navigate(`/etablissements/${etab.id}`)}
                className="group/btn text-primary dark:text-white font-bold text-sm flex items-center px-4 py-2 rounded-lg hover:bg-white/10 transition-all border border-transparent hover:border-white/10 ml-auto"
              >
                Détails
                <Eye size={16} className="ml-2 group-hover/btn:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredEtablissements?.length === 0 && (
        <div className="text-center py-20 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 border-dashed">
            <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-700 rounded-full flex items-center justify-center mx-auto mb-4 text-neutral-400 dark:text-neutral-500">
                <Search className="w-8 h-8" />
            </div>
          <h3 className="text-lg font-bold text-primary dark:text-white mb-1">Aucun résultat</h3>
          <p className="text-neutral-500 dark:text-neutral-400">Essayez de modifier vos filtres de recherche.</p>
        </div>
      )}
    </div>
  );
}
