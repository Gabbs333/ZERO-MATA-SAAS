import { useEffect, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';

type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface UseRealtimeSubscriptionOptions {
  table: string;
  event: RealtimeEvent;
  filter?: string;
  callback: (payload: any) => void;
}

export function useRealtimeSubscription({
  table,
  event,
  filter,
  callback,
}: UseRealtimeSubscriptionOptions) {
  // Use a ref for the callback to prevent unnecessary resubscriptions
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    let channel: RealtimeChannel;

    const setupSubscription = () => {
      // Channel name must be unique per subscription instance to avoid conflicts between components
      // We append a random string to ensure each hook instance gets its own channel
      const uniqueId = Math.random().toString(36).substring(7);
      const channelName = `public:${table}:${event}${filter ? `:${filter}` : ''}:${uniqueId}`;
      channel = supabase.channel(channelName);

      channel.on(
        'postgres_changes' as any,
        {
          event,
          schema: 'public',
          table,
          filter: filter || undefined,
        },
        (payload) => {
          if (callbackRef.current) {
            callbackRef.current(payload);
          }
        }
      );

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Subscribed to ${table} ${event}`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`❌ Error subscribing to ${table} ${event}`);
        }
      });
    };

    setupSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
        console.log(`🔌 Unsubscribed from ${table} ${event}`);
      }
    };
  }, [table, event, filter]); // Removed callback from dependencies
}

// Hook spécifique pour les mises à jour de tables
export function useTablesRealtime(onUpdate: (payload: any) => void) {
  useRealtimeSubscription({
    table: 'tables',
    event: '*', // Listen to ALL events (UPDATE, INSERT, DELETE) to be safe
    callback: onUpdate,
  });
}

// Hook spécifique pour les validations de commandes
export function useCommandeValidation(
  serveuseId: string | undefined,
  onValidation: (payload: any) => void
) {
  useRealtimeSubscription({
    table: 'commandes',
    event: 'UPDATE',
    filter: serveuseId ? `serveuse_id=eq.${serveuseId}` : undefined,
    callback: (payload) => {
      if (payload.new.statut === 'validee') {
        onValidation(payload.new);
      }
    },
  });
}

// Hook pour toutes les commandes (pour le dashboard)
export function useCommandesRealtime(onUpdate: (payload: any) => void) {
  useRealtimeSubscription({
    table: 'commandes',
    event: '*',
    callback: onUpdate,
  });
}

// Hook pour toutes les factures (pour le dashboard)
export function useFacturesRealtime(onUpdate: (payload: any) => void) {
  useRealtimeSubscription({
    table: 'factures',
    event: '*',
    callback: onUpdate,
  });
}

// Hook spécifique pour les mises à jour de stock
export function useStockRealtime(onUpdate: (payload: any) => void) {
  useRealtimeSubscription({
    table: 'stocks', // Changed from 'stock' to 'stocks' to match DB table name
    event: '*',
    callback: onUpdate,
  });
}

// Hook pour les mises à jour de l'historique (commandes)
export function useHistoriqueRealtime(serveuseId: string | undefined, onUpdate: (payload: any) => void) {
  useRealtimeSubscription({
    table: 'commandes',
    event: '*',
    filter: serveuseId ? `serveuse_id=eq.${serveuseId}` : undefined,
    callback: onUpdate,
  });
}
