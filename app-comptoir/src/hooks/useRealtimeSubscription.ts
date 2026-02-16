import { useEffect } from 'react';
import { supabase } from '../config/supabase';
import { useQueryClient } from '@tanstack/react-query';

import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export function useRealtimeSubscription(
  table: string,
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
  callback?: (payload: RealtimePostgresChangesPayload<any>) => void
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`${table}_changes`)
      .on(
        'postgres_changes' as any,
        {
          event,
          schema: 'public',
          table,
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
  }, [table, event, callback, queryClient]);
}
