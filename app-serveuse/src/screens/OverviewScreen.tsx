import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, TextInput, RefreshControl, Platform } from 'react-native';
import { 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  subDays,
  format,
  isSameDay
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  TrendingUp, 
  ShoppingBag, 
  Users, 
  Clock, 
  Calendar as CalendarIcon,
  ChevronRight,
  ChevronLeft,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Calendar,
  Receipt,
  User
} from 'lucide-react-native';
import { LineChart } from 'react-native-gifted-charts';
import { useSupabaseQuery, useCreancesServeuse } from '../hooks/useSupabaseQuery';
import { useCommandesRealtime, useFacturesRealtime } from '../hooks/useRealtimeSubscription';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { useColorScheme } from 'nativewind';
import { supabase } from '../config/supabase';
import { ThemeToggle } from '../components/ThemeToggle';
import DateTimePicker from '@react-native-community/datetimepicker';

type Period = 'today' | 'week' | 'month' | 'custom' | 'all';

export function OverviewScreen({ navigation }: any) {
  const { user, session } = useAuthStore();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // Use user ID from profile or session as fallback
  const userId = user?.id || session?.user?.id;
  const queryClient = useQueryClient();
  
  const [period, setPeriod] = useState<Period>('today');
  const [dateRange, setDateRange] = useState({
    start: startOfDay(new Date()),
    end: endOfDay(new Date())
  });
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    const now = new Date();
    switch (period) {
      case 'today':
        setDateRange({ start: startOfDay(now), end: endOfDay(now) });
        break;
      case 'week':
        setDateRange({ start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) });
        break;
      case 'month':
        setDateRange({ start: startOfMonth(now), end: endOfMonth(now) });
        break;
      case 'all':
        setDateRange({ start: new Date(0), end: endOfDay(now) });
        break;
    }
  }, [period]);

  const onDateChange = (event: any, selectedDate?: Date) => {
    // Only close immediately on Android or if using a modal
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    
    if (selectedDate) {
      setPeriod('custom');
      const newRange = {
        start: startOfDay(selectedDate),
        end: endOfDay(selectedDate)
      };
      setDateRange(newRange);
      
      // On iOS, we might want to keep it open or provide a "Done" button.
      // But for simplicity in this flow, let's close it after selection if it's not a modal.
      // If it's inline (default iOS behavior in recent versions), closing it immediately after selection might be jarring.
      // However, without a dedicated "Done" button UI, this is the most straightforward "pick and go" approach.
      if (Platform.OS === 'ios') {
         // Optional: add a delay or keep open? 
         // For now, let's close it to mimic Android behavior of "selection made"
         setShowDatePicker(false);
      }
    } else {
       // Cancelled
       setShowDatePicker(false);
    }
  };

  // Realtime subscription for Factures and Commandes
  useFacturesRealtime(
    React.useCallback((payload) => {
      console.log('Realtime update on factures:', payload);
      // Invalidate ALL queries starting with 'creances' to catch both list and paginated
      queryClient.invalidateQueries({ queryKey: ['creances'] });
      // Also invalidate stats as they depend on paid status
      queryClient.invalidateQueries({ queryKey: ['waitress-stats'] });
    }, [queryClient])
  );

  useCommandesRealtime(
    React.useCallback((payload) => {
      console.log('Realtime update on commandes:', payload);
      // Invalidate stats and orders
      queryClient.invalidateQueries({ queryKey: ['waitress-stats'] });
      queryClient.invalidateQueries({ queryKey: ['my-commandes'] });
      // Invalidate creances too, as a validated command creates a facture (which is a creance)
      // The condition was too strict or payload structure might differ, so we invalidate broadly for safety
      if (payload.new?.statut === 'validee' || payload.eventType === 'UPDATE') {
        queryClient.invalidateQueries({ queryKey: ['creances'] });
        // Also refresh paginated list specifically
        queryClient.invalidateQueries({ queryKey: ['creances-paginated'] });
      }
    }, [queryClient])
  );

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Reset page when period changes
  useEffect(() => {
    setCurrentPage(1);
  }, [period]);

  // Fetch Waitress specific stats
  const { data: creances, isPending: creancesLoadingReal } = useCreancesServeuse(userId);

  const { data: paginatedResult, isPending: paginatedCreancesLoading } = useSupabaseQuery(
    ['creances-paginated', userId, currentPage, period, dateRange.start.toISOString(), dateRange.end.toISOString()],
    async (supabase) => {
      if (!userId) return { data: { data: [], count: 0 }, error: null };

      let query = supabase
        .from('factures')
        .select('*, commandes!inner(serveuse_id, tables(numero))', { count: 'exact' })
        .neq('statut', 'payee')
        .neq('statut', 'annulee')
        .eq('commandes.serveuse_id', userId);

      // If period is 'all', we don't filter by date (except maybe future dates if that was possible, but not needed here)
      // Actually, 'all' means everything from beginning of time.
      // But we set dateRange start to epoch for 'all', so the gte/lte logic below still works!
      // However, for optimization, we could skip the filter if period is 'all', but gte 1970 is fine.
      
      query = query
        .gte('date_generation', dateRange.start.toISOString())
        .lte('date_generation', dateRange.end.toISOString());

      query = query
        .order('date_generation', { ascending: false })
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);

      const { data, error, count } = await query;
      
      if (error) throw error;
      
      return { data: { data, count }, error: null };
    },
    { enabled: !!userId }
  );

  const paginatedCreances = paginatedResult?.data || [];
  const totalCreancesCountPaginated = paginatedResult?.count || 0;
  const totalPages = Math.ceil(totalCreancesCountPaginated / itemsPerPage);

  const { data: stats, isPending: statsLoading } = useSupabaseQuery(
    ['waitress-stats', dateRange.start.toISOString(), dateRange.end.toISOString(), userId],
    async (supabase) => {
      if (!userId) return { data: null, error: null };
      
      // Get orders for this waitress
      const { data: orders, error } = await supabase
        .from('commandes')
        .select('id, statut, montant_total, est_payee, table_id, date_creation, tables(numero)')
        .eq('serveuse_id', userId)
        .order('date_creation', { ascending: false })
        .limit(200);

      if (error) throw error;

      // Filter by date
      const filteredOrders = orders?.filter(o => {
        const orderDate = new Date(o.date_creation);
        const now = new Date();
        
        // Use isSameDay for 'today' to be more robust
        if (isSameDay(dateRange.start, now)) {
            return isSameDay(orderDate, now);
        }
        
        return orderDate >= dateRange.start && orderDate <= dateRange.end;
      }) || [];

      const totalOrders = filteredOrders.length;
      const activeOrders = filteredOrders.filter(o => ['en_attente', 'en_cours', 'prete'].includes(o.statut)).length;
      const validatedOrders = filteredOrders.filter(o => ['terminee', 'servie', 'validee'].includes(o.statut)).length;
      
      return {
        data: {
          totalOrders,
          activeOrders,
          validatedOrders,
        },
        error: null
      };
    }
  );

  // Calculer le total des créances à partir du hook dédié, mais filtré par la période sélectionnée
  const filteredCreances = useMemo(() => {
    if (!creances) return [];
    return creances.filter(f => {
      const factureDate = new Date(f.date_generation);
      const now = new Date();
      
      if (isSameDay(dateRange.start, now)) {
        return isSameDay(factureDate, now);
      }
      return factureDate >= dateRange.start && factureDate <= dateRange.end;
    });
  }, [creances, dateRange]);

  const totalCreancesMontant = filteredCreances.reduce((sum, f) => sum + ((f.montant_total || 0) - (f.montant_paye || 0)), 0) || 0;
  const totalCreancesCount = filteredCreances.length || 0;

  const kpis = [
    {
      title: 'Commandes en cours',
      value: (stats as any)?.activeOrders || 0,
      icon: Clock,
      trend: 'En attente',
      trendUp: true, // neutral
    },
    {
      title: 'Validées',
      value: (stats as any)?.validatedOrders || 0,
      icon: ShoppingBag,
      trend: 'Servies',
      trendUp: true,
    },
    {
      title: 'Créances (Non payées)',
      value: `${totalCreancesMontant.toLocaleString('fr-FR')} FCFA`,
      icon: Receipt, // Using Receipt icon for unpaid bills
      trend: `${totalCreancesCount} factures`,
      trendUp: false, // bad if high
      alert: totalCreancesMontant > 0 
    }
  ];

  const creancesLoading = creancesLoadingReal;

  return (
    <View className="flex-1 bg-neutral-50 dark:bg-dark-bg">
      <ScrollView 
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl 
            refreshing={statsLoading || creancesLoading} 
            onRefresh={() => {
              queryClient.invalidateQueries({ queryKey: ['waitress-stats'] });
              queryClient.invalidateQueries({ queryKey: ['creances'] });
              queryClient.invalidateQueries({ queryKey: ['my-commandes'] });
            }} 
          />
        }
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 pt-14 pb-6 bg-white dark:bg-dark-card border-b border-neutral-100 dark:border-white/5">
          <View>
            <Text className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
              {format(new Date(), 'EEEE d MMMM', { locale: fr })}
            </Text>
            <Text className="text-2xl font-bold text-neutral-900 dark:text-white mt-1">
              Bonjour, {user ? `${user.prenom} ${user.nom || ''}`.trim() : 'Serveuse'}
            </Text>
          </View>
          <View className="flex-row items-center gap-3">
            <ThemeToggle />
            <TouchableOpacity className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-white/10 items-center justify-center">
              <User size={20} color={isDark ? '#fff' : '#171717'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Date Filter */}
        <View className="px-6 py-4">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
            {[
              { id: 'today', label: "Aujourd'hui" },
              { id: 'week', label: 'Cette semaine' },
              { id: 'month', label: 'Ce mois' },
              { id: 'all', label: 'Tous' },
              { id: 'custom', label: 'Personnalisé' },
            ].map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => {
                  if (item.id === 'custom') {
                    setShowDatePicker(true);
                  } else {
                    setPeriod(item.id as Period);
                  }
                }}
                className={`px-4 py-2 rounded-full border ${
                  period === item.id
                    ? 'bg-primary border-primary'
                    : 'bg-white dark:bg-dark-card border-neutral-200 dark:border-white/10'
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    period === item.id ? 'text-white' : 'text-neutral-600 dark:text-neutral-300'
                  }`}
                >
                  {item.label}
                  {item.id === 'custom' && period === 'custom' && ` (${format(dateRange.start, 'dd/MM')})`}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {showDatePicker && (
          <DateTimePicker
            testID="dateTimePicker"
            value={dateRange.start}
            mode="date"
            is24Hour={true}
            display="default"
            onChange={onDateChange}
          />
        )}

        {/* KPIs Grid */}
        <View className="px-6 flex-row flex-wrap gap-4">
          {kpis?.map((kpi, index) => (
            <View 
              key={index}
              className={`w-[47%] bg-white dark:bg-dark-card p-4 rounded-2xl shadow-sm border ${
                kpi.alert ? 'border-red-500/50' : 'border-neutral-100 dark:border-white/5'
              }`}
            >
              <View className="flex-row items-center justify-between mb-3">
                <View className={`w-10 h-10 rounded-full items-center justify-center ${
                  kpi.alert ? 'bg-red-50 dark:bg-red-500/10' : 'bg-blue-50 dark:bg-blue-500/10'
                }`}>
                  <kpi.icon size={20} color={kpi.alert ? '#ef4444' : '#3b82f6'} />
                </View>
              </View>
              <Text className="text-2xl font-bold text-neutral-900 dark:text-white mb-1">
                {kpi.value}
              </Text>
              <Text className="text-xs text-neutral-500 dark:text-neutral-400 font-medium mb-2">
                {kpi.title}
              </Text>
              <View className="flex-row items-center">
                {kpi.trendUp ? (
                  <ArrowUpRight size={14} color="#22c55e" />
                ) : (
                  <ArrowDownRight size={14} color="#ef4444" />
                )}
                <Text className={`text-xs ml-1 font-medium ${
                  kpi.trendUp ? 'text-green-500' : 'text-red-500'
                }`}>
                  {kpi.trend}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Recent Unpaid Orders (Creances) */}
        <View className="px-6 mt-8">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-bold text-neutral-900 dark:text-white">
              Créances ({totalCreancesCountPaginated})
            </Text>
            {/* Pagination Controls */}
            <View className="flex-row items-center space-x-2">
              <TouchableOpacity 
                disabled={currentPage === 1}
                onPress={() => setCurrentPage(p => Math.max(1, p - 1))}
                className={`p-2 rounded-full ${currentPage === 1 ? 'opacity-30' : ''} bg-neutral-100 dark:bg-white/10`}
              >
                <ChevronLeft size={20} color={isDark ? '#fff' : '#000'} />
              </TouchableOpacity>
              <Text className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
                Page {currentPage} / {totalPages || 1}
              </Text>
              <TouchableOpacity 
                disabled={currentPage >= totalPages}
                onPress={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className={`p-2 rounded-full ${currentPage >= totalPages ? 'opacity-30' : ''} bg-neutral-100 dark:bg-white/10`}
              >
                <ChevronRight size={20} color={isDark ? '#fff' : '#000'} />
              </TouchableOpacity>
            </View>
          </View>
          
          {paginatedCreancesLoading ? (
            <ActivityIndicator size="small" color="#3b82f6" />
          ) : paginatedCreances.length === 0 ? (
            <View className="items-center py-8">
              <Text className="text-neutral-500 dark:text-neutral-400">Aucune créance trouvée pour cette période</Text>
            </View>
          ) : (
            paginatedCreances.map((facture: any) => {
              // Robust handling for nested commandes relation (same fix as HistoriqueScreen)
              let cmdData;
              if (facture.commandes) {
                cmdData = Array.isArray(facture.commandes) ? facture.commandes[0] : facture.commandes;
              }
              
              const tableNumero = cmdData?.tables?.numero || '?';
              
              return (
              <TouchableOpacity 
                key={facture.id}
                className="mb-4 bg-white dark:bg-dark-card p-4 rounded-2xl shadow-sm border border-neutral-100 dark:border-white/5"
                onPress={() => navigation.navigate('CreancesDetails', { factureId: facture.id })}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center">
                    <View className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-500/10 items-center justify-center mr-3">
                      <Text className="text-xs font-bold text-orange-500">
                        {tableNumero}
                      </Text>
                    </View>
                    <View>
                      <Text className="text-base font-bold text-neutral-900 dark:text-white">
                        {facture.numero_facture}
                      </Text>
                      <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                        {format(new Date(facture.date_generation), 'dd MMM HH:mm', { locale: fr })}
                      </Text>
                    </View>
                  </View>
                  <View className="items-end">
                    <Text className="text-base font-bold text-primary dark:text-white">
                      {facture.montant_total.toLocaleString()} FCFA
                    </Text>
                    <Text className="text-xs font-medium text-orange-500">
                      Non payé
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            )})
          )}
        </View>
      </ScrollView>
    </View>
  );
}
