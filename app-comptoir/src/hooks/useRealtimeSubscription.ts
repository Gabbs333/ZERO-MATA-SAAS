import { useEffect } from 'react';
import { supabase } from '../config/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export function useRealtimeSubscription(
  table: string,
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
  callback?: (payload: RealtimePostgresChangesPayload<any>) => void,
  filter?: string
) {
  const queryClient = useQueryClient();
  const { profile } = useAuthStore();
  const etablissementId = profile?.etablissement_id;

  useEffect(() => {
    // Build the filter string for etablissement_id
    const etabFilter = etablissementId ? `etablissement_id=eq.${etablissementId}` : undefined;
    const combinedFilter = filter 
      ? (etabFilter ? `${etabFilter},${filter}` : filter) 
      : etabFilter;

    const channel = supabase
      .channel(`${table}_changes_${etablissementId || 'all'}`)
      .on(
        'postgres_changes' as any,
        {
          event,
          schema: 'public',
          table,
          filter: combinedFilter || undefined,
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          console.log(`Realtime ${event} on ${table}:`, payload);
          
          // Invalider les requêtes liées à cette table
          queryClient.invalidateQueries({ queryKey: [table] });
          
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
  }, [table, event, callback, queryClient, etablissementId, filter]);
}
