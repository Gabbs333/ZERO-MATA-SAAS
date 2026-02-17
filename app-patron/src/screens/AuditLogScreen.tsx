import { useState } from 'react';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Search } from 'lucide-react';

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  table_name: string;
  record_id?: string;
  details?: any;
  etablissement_id: string | null;
  date_action: string;
  profiles?: {
    nom: string;
    prenom: string;
    role: string;
  };
}

export function AuditLogScreen() {
  const profile = useAuthStore((state) => state.profile);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');

  const { data: logs, isLoading } = useSupabaseQuery(
    ['audit_logs', profile?.etablissement_id],
    async () => {
      if (!profile?.etablissement_id) return { data: [], error: null };
      
      return supabase
        .from('audit_logs')
        .select(`
          *,
          profiles:user_id (nom, prenom, role)
        `)
        .eq('etablissement_id', profile.etablissement_id)
        .order('date_action', { ascending: false })
        .limit(100)
        .then(({ data, error }) => ({ data: data as unknown as AuditLog[], error }));
    },
    { enabled: !!profile?.etablissement_id }
  );

  const filteredLogs = logs?.filter(log => {
    const matchesSearch = 
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.table_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.profiles?.nom || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.profiles?.prenom || '').toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesFilter = actionFilter === 'all' || log.action === actionFilter;
    
    return matchesSearch && matchesFilter;
  });

  const uniqueActions = Array.from(new Set(logs?.map(l => l.action) || [])).sort();

  return (
    <div className="pb-20 md:pb-6 min-h-screen bg-neutral-50 dark:bg-dark-bg transition-colors duration-300">
      <div className="p-4 md:p-6 bg-white dark:bg-dark-card/40 dark:backdrop-blur-xl border-b border-neutral-200 dark:border-white/5 sticky top-0 z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary dark:text-white font-display">Journal d'Audit</h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">
              Suivez les activités du système et les événements de sécurité
            </p>
          </div>
          
          <div className="flex gap-2 self-start md:self-auto">
             <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="bg-neutral-100 dark:bg-dark-card/60 border border-transparent focus:border-primary/20 dark:focus:border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold text-primary dark:text-white outline-none focus:ring-4 focus:ring-primary/5 dark:focus:ring-white/5 transition-all appearance-none cursor-pointer uppercase tracking-wider"
             >
                <option value="all" className="dark:bg-dark-card">Toutes les Actions</option>
                {uniqueActions.map(action => (
                    <option key={action} value={action} className="dark:bg-dark-card">{action}</option>
                ))}
             </select>
          </div>
        </div>

        <div className="mt-6">
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-primary dark:group-focus-within:text-dark-accent transition-colors w-5 h-5" />
                <input 
                    type="text" 
                    placeholder="Rechercher dans les journaux..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-neutral-100 dark:bg-dark-card/60 border border-transparent focus:border-primary/20 dark:focus:border-white/10 rounded-xl text-primary dark:text-white placeholder-neutral-400 focus:ring-4 focus:ring-primary/5 dark:focus:ring-white/5 transition-all outline-none text-sm"
                />
            </div>
        </div>
      </div>

      <div className="p-4 md:p-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary dark:border-dark-accent"></div>
            <p className="text-sm text-neutral-500 animate-pulse">Chargement du journal...</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-2xl border border-neutral-200 dark:border-white/5 shadow-xl shadow-neutral-200/50 dark:shadow-none overflow-hidden">
             <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-neutral-50/50 dark:bg-dark-card/60 border-b border-neutral-200 dark:border-white/5">
                            <th className="p-4 text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.2em]">Date & Heure</th>
                            <th className="p-4 text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.2em]">Utilisateur</th>
                            <th className="p-4 text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.2em]">Action</th>
                            <th className="p-4 text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.2em]">Cible</th>
                            <th className="p-4 text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.2em]">Détails</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
                        {filteredLogs?.map((log) => (
                            <tr key={log.id} className="group hover:bg-neutral-50 dark:hover:bg-dark-card/40 transition-all duration-200">
                                <td className="p-4">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-semibold text-primary dark:text-white">
                                            {format(new Date(log.date_action), 'dd MMM yyyy', { locale: fr })}
                                        </span>
                                        <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase">
                                            {format(new Date(log.date_action), 'HH:mm:ss')}
                                        </span>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="size-8 rounded-full bg-primary/10 dark:bg-dark-accent/10 flex items-center justify-center text-[10px] font-bold text-primary dark:text-dark-accent border border-primary/20 dark:border-dark-accent/20">
                                            {log.profiles?.prenom?.charAt(0)}{log.profiles?.nom?.charAt(0)}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium text-primary dark:text-white">
                                                {log.profiles?.prenom} {log.profiles?.nom}
                                            </span>
                                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                                                {log.profiles?.role}
                                            </span>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border ${
                                        log.action.includes('DELETE') ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 border-rose-500/10' :
                                        log.action.includes('UPDATE') ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-500/10' :
                                        log.action.includes('CREATE') ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-500/10' :
                                        'bg-neutral-100 text-neutral-600 dark:bg-dark-card/60 dark:text-neutral-300 border-neutral-200 dark:border-white/5'
                                    }`}>
                                        {log.action}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <span className="px-2 py-1 bg-neutral-100 dark:bg-dark-card/60 rounded text-[10px] font-mono font-bold text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-white/5">
                                        {log.table_name}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <div className="max-w-xs">
                                        <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate font-mono bg-neutral-50 dark:bg-dark-card/60 p-2 rounded-lg border border-neutral-100 dark:border-white/5">
                                            {JSON.stringify(log.details)}
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        ))}

                        {filteredLogs?.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-24 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="p-4 bg-neutral-100 dark:bg-dark-card/60 rounded-full border border-neutral-200 dark:border-white/5">
                                            <Search className="w-8 h-8 text-neutral-400" />
                                        </div>
                                        <p className="text-neutral-400 text-sm font-medium">Aucun journal trouvé</p>
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
