import { 
  Building2, 
  CheckCircle, 
  AlertTriangle, 
  Ban, 
  Users,
  Loader,
  AlertCircle,
  Activity
} from 'lucide-react';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { format } from '../utils/format';

interface Stats {
  total: number;
  actifs: number;
  expires: number;
  suspendus: number;
  totalUsers: number;
  expiringSoon: Array<{ id: string; nom: string; date_fin: string }>;
}

export default function GlobalStatsScreen() {
  const { data: stats, isPending: loading, error } = useSupabaseQuery<Stats>(
    ['statistics', 'global'],
    async (supabase) => {
      // Get establishment counts
      const { data: etablissements, error: etabError } = await supabase
        .from('etablissements')
        .select('id, nom, statut_abonnement, date_fin');

      if (etabError) throw etabError;

      const total = etablissements?.length || 0;
      const actifs = etablissements?.filter((e: any) => e.statut_abonnement === 'actif').length || 0;
      const expires = etablissements?.filter((e: any) => e.statut_abonnement === 'expire').length || 0;
      const suspendus = etablissements?.filter((e: any) => e.statut_abonnement === 'suspendu').length || 0;

      // Get expiring soon (within 30 days)
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const expiringSoon = etablissements?.filter((e: any) => {
        const endDate = new Date(e.date_fin);
        return e.statut_abonnement === 'actif' && endDate > now && endDate <= thirtyDaysFromNow;
      }).map((e: any) => ({ id: e.id, nom: e.nom, date_fin: e.date_fin })) || [];

      // Get total users count
      const { count: totalUsers, error: usersError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .not('etablissement_id', 'is', null);

      if (usersError) throw usersError;

      return {
        data: {
          total,
          actifs,
          expires,
          suspendus,
          totalUsers: totalUsers || 0,
          expiringSoon,
        },
        error: null,
      };
    }
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="animate-spin text-primary dark:text-white" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-semantic-red/10 p-6 rounded-2xl flex items-center gap-4 text-semantic-red border border-semantic-red/20 backdrop-blur-sm shadow-lg">
        <div className="p-3 bg-semantic-red/20 rounded-xl">
            <AlertTriangle size={24} />
        </div>
        <div>
            <h3 className="font-bold text-lg">Erreur de chargement</h3>
            <p className="opacity-90">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-primary dark:text-white mb-2">
          Statistiques Globales
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400 text-lg">
          Aperçu des performances de la plateforme
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.15fr] gap-6">
        <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-white/10 p-6 flex flex-col group hover:-translate-y-1 transition-all duration-300 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-primary to-blue-600 rounded-xl shadow-lg shadow-primary/20 text-white group-hover:scale-110 transition-transform duration-300 shrink-0">
              <Building2 size={24} />
            </div>
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-normal bg-neutral-100 dark:bg-white/5 px-2 py-1 rounded-lg ml-2 whitespace-nowrap">Total</span>
          </div>
          <p className="text-3xl sm:text-4xl font-display font-bold text-neutral-900 dark:text-white mb-1 truncate">
            {stats?.total || 0}
          </p>
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
            Établissements
          </p>
        </div>

        <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-white/10 p-6 flex flex-col group hover:-translate-y-1 transition-all duration-300 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/20 text-white group-hover:scale-110 transition-transform duration-300 shrink-0">
              <CheckCircle size={24} />
            </div>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-normal bg-emerald-500/10 px-2 py-1 rounded-lg ml-2 whitespace-nowrap">Actifs</span>
          </div>
          <p className="text-3xl sm:text-4xl font-display font-bold text-neutral-900 dark:text-white mb-1 truncate">
            {stats?.actifs || 0}
          </p>
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
            Abonnements actifs
          </p>
        </div>

        <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-white/10 p-6 flex flex-col group hover:-translate-y-1 transition-all duration-300 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-rose-500 to-red-600 rounded-xl shadow-lg shadow-rose-500/20 text-white group-hover:scale-110 transition-transform duration-300 shrink-0">
              <AlertCircle size={24} />
            </div>
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-normal bg-rose-500/10 px-2 py-1 rounded-lg ml-2 whitespace-nowrap">Expirés</span>
          </div>
          <p className="text-3xl sm:text-4xl font-display font-bold text-neutral-900 dark:text-white mb-1 truncate">
            {stats?.expires || 0}
          </p>
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
            Abonnements expirés
          </p>
        </div>

        <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-white/10 p-6 flex flex-col group hover:-translate-y-1 transition-all duration-300 overflow-hidden">
          <div className="flex items-center justify-between mb-4 gap-2">
            <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg shadow-amber-500/20 text-white group-hover:scale-110 transition-transform duration-300 shrink-0">
              <Ban size={24} />
            </div>
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-normal bg-amber-500/10 px-2 py-1 rounded-lg text-right">Suspendus</span>
          </div>
          <p className="text-3xl sm:text-4xl font-display font-bold text-neutral-900 dark:text-white mb-1 truncate">
            {stats?.suspendus || 0}
          </p>
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 break-words whitespace-normal leading-tight">
            Établissements suspendus
          </p>
        </div>

        <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-white/10 p-6 flex flex-col sm:col-span-2 lg:col-span-4 group hover:shadow-xl transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-32 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
          
          <div className="flex items-center gap-4 mb-2 relative z-10">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20 text-white group-hover:scale-110 transition-transform duration-300 shrink-0">
              <Users size={24} />
            </div>
            <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white truncate">Utilisateurs Totaux</h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 truncate">Comptes enregistrés sur la plateforme</p>
            </div>
          </div>
          <div className="mt-4 relative z-10">
             <p className="text-5xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 truncate">
                {stats?.totalUsers || 0}
            </p>
          </div>
        </div>
      </div>

      {stats?.expiringSoon && stats.expiringSoon.length > 0 && (
        <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 dark:border-white/10 overflow-hidden">
          <div className="p-6 border-b border-neutral-200 dark:border-white/5 bg-neutral-50/50 dark:bg-white/5">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 text-amber-600 rounded-lg">
                <AlertTriangle size={20} />
              </div>
              Établissements expirant dans les 30 jours
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.expiringSoon.map((etab) => (
                <div
                  key={etab.id}
                  className="flex flex-col p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 rounded-xl border border-amber-200 dark:border-amber-500/20 hover:shadow-md transition-all duration-200 group overflow-hidden"
                >
                  <div className="flex justify-between items-start mb-3">
                    <p className="font-bold text-neutral-900 dark:text-white truncate pr-2 group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors flex-1 min-w-0">{etab.nom}</p>
                    <Activity size={16} className="text-amber-500 shrink-0 mt-1" />
                  </div>
                  <div className="mt-auto pt-3 border-t border-amber-200/50 dark:border-amber-500/10 flex items-center justify-between text-xs">
                    <span className="text-amber-700 dark:text-amber-400 font-medium uppercase tracking-wide truncate mr-2">Expire le</span>
                    <span className="font-bold text-amber-800 dark:text-amber-300 bg-white/50 dark:bg-black/20 px-2 py-1 rounded-md whitespace-nowrap">
                        {format.date(etab.date_fin)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
