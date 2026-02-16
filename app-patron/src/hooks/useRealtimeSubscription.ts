import { useEffect } from 'react';
import { supabase } from '../config/supabase';
import { useQueryClient } from '@tanstack/react-query';

export function useRealtimeSubscription(
  table: string,
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
  callback?: (payload: any) => void
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`${table}_changes`)
      .on(
        'postgres_changes',
        {
          event,
          schema: 'public',
          table,
        },
        (payload) => {
          console.log(`Realtime ${event} on ${table}:`, payload);
          
          // Invalider les requêtes liées à cette table
          queryClient.invalidateQueries({ queryKey: [table] });
          
          // Invalidate relevant queries
      if (['commandes', 'factures', 'encaissements', 'ravitaillements'].includes(table)) {
        // New RPC-based dashboard keys
        queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
        queryClient.invalidateQueries({ queryKey: ['sales_evolution'] });
        queryClient.invalidateQueries({ queryKey: ['top_products'] });
        queryClient.invalidateQueries({ queryKey: ['payment_distribution'] });
        
        // Keep old keys just in case, or remove if fully migrating
        queryClient.invalidateQueries({ queryKey: ['dashboard_commandes'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard_encaissements'] });
        queryClient.invalidateQueries({ queryKey: ['total_debt'] });
      }
          
          if (table === 'ravitaillements') {
             queryClient.invalidateQueries({ queryKey: ['supplies_total'] });
          }

          if (table === 'stocks') {
             queryClient.invalidateQueries({ queryKey: ['stock_alerts'] });
          }
          
          // Appeler le callback personnalisé si fourni
          if (callback) {
            callback(payload);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, event, callback, queryClient]);
}
