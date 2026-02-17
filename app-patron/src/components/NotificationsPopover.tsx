import { useRef, useState, useEffect } from 'react';
import { Bell, Package, CheckCircle2 } from 'lucide-react';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { twMerge } from 'tailwind-merge';
import { useQueryClient } from '@tanstack/react-query';

export function NotificationsPopover() {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const profile = useAuthStore((state) => state.profile);
  const queryClient = useQueryClient();

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch low stock alerts
  // const { data: lowStocks } = useSupabaseQuery(
  //   ['low_stocks_notifications', profile?.etablissement_id],
  //   async () => {
  //     if (!profile?.etablissement_id) return { data: [], error: null };
  //     return { data: [], error: null }; 
  //   },
  //   { enabled: false }
  // );

  // Real implementation for fetching low stocks
  const { data: alerts, isLoading } = useSupabaseQuery(
    ['notifications_alerts', profile?.etablissement_id],
    async () => {
      if (!profile?.etablissement_id) return { data: [], error: null };

      const { data, error } = await supabase
        .from('stocks')
        .select(`
          id,
          quantite_actuelle,
          seuil_alerte,
          produits (
            nom
          )
        `)
        .eq('etablissement_id', profile.etablissement_id);

      if (error) throw error;

      // Filter for low stock
      const low = data?.filter((s: any) => s.quantite_actuelle <= s.seuil_alerte) || [];
      return { data: low, error: null };
    },
    { enabled: !!profile?.etablissement_id } // Check every 30s removed, using realtime
  );

  // Real-time subscription for instant updates
  useEffect(() => {
    if (!profile?.etablissement_id) return;

    const channel = supabase
      .channel('public:stocks')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'stocks',
          filter: `etablissement_id=eq.${profile.etablissement_id}`,
        },
        () => {
          // Invalidate query to refetch fresh data immediately
          queryClient.invalidateQueries({ queryKey: ['notifications_alerts', profile.etablissement_id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.etablissement_id, queryClient]);

  const notificationCount = alerts?.length || 0;

  return (
    <div className="relative" ref={popoverRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={twMerge(
            "relative flex items-center justify-center size-10 rounded-2xl border transition-all duration-300",
            isOpen 
                ? "bg-primary text-white border-primary dark:bg-dark-accent dark:border-dark-accent shadow-lg shadow-primary/25" 
                : "bg-white dark:bg-white/5 border-neutral-200 dark:border-white/5 hover:bg-neutral-50 dark:hover:bg-white/10 text-neutral-400 hover:text-primary dark:text-neutral-500 dark:hover:text-white"
        )}
      >
        <Bell className="w-5 h-5" />
        {notificationCount > 0 && (
          <span className="absolute top-2.5 right-2.5 size-2 bg-red-500 rounded-full border-2 border-white dark:border-dark-bg animate-pulse"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-14 w-80 sm:w-96 bg-white dark:bg-dark-card rounded-2xl shadow-2xl border border-neutral-100 dark:border-white/5 overflow-hidden z-[60] animate-in fade-in zoom-in-95 duration-200 origin-top-right">
          <div className="p-4 border-b border-neutral-100 dark:border-white/5 flex items-center justify-between bg-neutral-50/50 dark:bg-white/5">
            <h3 className="font-bold text-primary dark:text-white font-display">Notifications</h3>
            {notificationCount > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-wider border border-red-500/10">
                    {notificationCount} Alertes
                </span>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
            {isLoading ? (
              <div className="p-8 flex justify-center">
                <div className="size-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin"></div>
              </div>
            ) : notificationCount > 0 ? (
              <div className="divide-y divide-neutral-100 dark:divide-white/5">
                {alerts?.map((alert: any) => (
                  <div 
                    key={alert.id} 
                    className="p-4 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                    onClick={() => {
                        navigate('/stock');
                        setIsOpen(false);
                    }}
                  >
                    <div className="flex gap-3">
                      <div className="mt-0.5 size-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <Package className="w-4 h-4 text-red-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-neutral-700 dark:text-neutral-200 truncate">
                          Stock critique : {alert.produits?.nom}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                          Quantité actuelle: <span className="font-bold text-red-500">{alert.quantite_actuelle}</span> 
                          {' '}(Seuil: {alert.seuil_alerte})
                        </p>
                        <p className="text-[10px] text-neutral-400 mt-2 font-medium uppercase tracking-wide">
                          Il y a quelques instants
                        </p>
                      </div>
                      <div className="self-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <div className="size-6 rounded-full bg-neutral-100 dark:bg-white/10 flex items-center justify-center">
                            <CheckCircle2 className="w-3 h-3 text-neutral-400" />
                         </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 flex flex-col items-center text-center text-neutral-400 dark:text-neutral-500">
                <div className="size-12 rounded-2xl bg-neutral-100 dark:bg-white/5 flex items-center justify-center mb-3">
                    <Bell className="w-6 h-6 opacity-50" />
                </div>
                <p className="text-sm font-bold">Aucune notification</p>
                <p className="text-xs mt-1 opacity-70">Tout est calme pour le moment</p>
              </div>
            )}
          </div>
          
          <div className="p-3 border-t border-neutral-100 dark:border-white/5 bg-neutral-50/50 dark:bg-white/5 text-center">
             <button 
                onClick={() => setIsOpen(false)}
                className="text-xs font-bold text-neutral-500 hover:text-primary dark:text-neutral-400 dark:hover:text-white transition-colors uppercase tracking-wider"
             >
                Fermer
             </button>
          </div>
        </div>
      )}
    </div>
  );
}
