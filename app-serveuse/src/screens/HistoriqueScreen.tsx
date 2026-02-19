import React, { useState, useMemo } from 'react';
import { View, FlatList, TextInput, Text, ActivityIndicator, ScrollView, Modal, Pressable, Platform, Alert } from 'react-native';
import { Search, ChevronLeft, Calendar, Filter, X, ShoppingBag } from 'lucide-react-native';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { useHistoriqueRealtime } from '../hooks/useRealtimeSubscription';
import { useAuthStore } from '../store/authStore';
import { useColorScheme } from 'nativewind';
import { startOfDay, startOfWeek, startOfMonth, format, endOfDay, parse } from 'date-fns';
import { fr } from 'date-fns/locale';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useQueryClient } from '@tanstack/react-query';
import type { Commande, CommandeItem, Table } from '../types/database.types';

type CommandeWithDetails = Commande & {
  commande_items: CommandeItem[];
  tables: Table;
};

type TimeFilter = 'today' | 'week' | 'month' | 'all' | 'custom';

// Component defined outside to prevent re-renders
const FilterChip = ({ 
  label, 
  value, 
  active, 
  onPress 
}: { 
  label: string, 
  value: TimeFilter, 
  active: boolean, 
  onPress: () => void 
}) => (
  <Pressable
    onPress={onPress}
    className={clsx(
      "px-4 py-2 rounded-full mr-2 border",
      active 
        ? "bg-dark-accent border-dark-accent" 
        : "bg-transparent border-neutral-200 dark:border-white/10"
    )}
  >
    <Text className={clsx(
      "text-xs font-bold",
      active ? "text-white" : "text-neutral-500 dark:text-neutral-400"
    )}>
      {label}
    </Text>
  </Pressable>
);

export default function HistoriqueScreen({ navigation }: any) {
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');
  const [selectedItem, setSelectedItem] = useState<CommandeWithDetails | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  
  // Custom Date Picker State
  const [customDateRange, setCustomDateRange] = useState<{start: Date, end: Date}>({ start: new Date(), end: new Date() });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'start' | 'end'>('start');
  const queryClient = useQueryClient();

  // Realtime subscription for history updates
  useHistoriqueRealtime(user?.id, () => {
    queryClient.invalidateQueries({ queryKey: ['historique'] });
  });

  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const getDateRange = (filter: TimeFilter) => {
    const now = new Date();
    switch (filter) {
      case 'today':
        return { start: startOfDay(now).toISOString(), end: endOfDay(now).toISOString() };
      case 'week':
        return { start: startOfWeek(now, { weekStartsOn: 1 }).toISOString(), end: endOfDay(now).toISOString() };
      case 'month':
        return { start: startOfMonth(now).toISOString(), end: endOfDay(now).toISOString() };
      case 'custom':
        return { 
          start: startOfDay(customDateRange.start).toISOString(), 
          end: endOfDay(customDateRange.end).toISOString() 
        };
      default:
        return null;
    }
  };

  const { data: items, isPending: isLoading, error, isError } = useSupabaseQuery<any[]>(
    ['historique', user?.id, timeFilter, customDateRange],
    (supabase) => {
      console.log('Fetching historique');
      const range = getDateRange(timeFilter);
      let query = supabase
          .from('commandes')
          .select('*, commande_items(*), tables(*)')
          .eq('serveuse_id', user?.id)
          .order('date_creation', { ascending: false });
        
      if (range) {
          query = query.gte('date_creation', range.start);
          if (range.end) query = query.lte('date_creation', range.end);
      }

      if (timeFilter === 'all') query = query.limit(50);
      
      return query;
    },
    { enabled: !!user?.id }
  );

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    
    if (selectedDate) {
      if (datePickerMode === 'start') {
        setCustomDateRange(prev => ({ ...prev, start: selectedDate }));
      } else {
        setCustomDateRange(prev => ({ ...prev, end: selectedDate }));
      }
    }
  };

  const openDatePicker = (mode: 'start' | 'end') => {
    setDatePickerMode(mode);
    setShowDatePicker(true);
  };

  const filteredItems = useMemo(() => {
    if (!items) return [];
    if (!searchQuery) return items;
    
    const query = searchQuery.toLowerCase();
    return items.filter((item) => {
      try {
        const cmd = item as CommandeWithDetails;
        return (
          (cmd.numero_commande?.toLowerCase() || '').includes(query) ||
          (cmd.tables?.numero?.toString() || '').includes(query)
        );
      } catch (e) {
        console.error('Filter error:', e);
        return false;
      }
    });
  }, [items, searchQuery]);

  // Log error if any
  if (error) {
    console.error('Supabase query error:', error);
  }

  const getStatusStyle = (statut: string) => {
    switch (statut) {
      // Commande statuses
      case 'validee': return { container: 'bg-semantic-green/10', text: 'text-semantic-green', label: 'Validée' };
      case 'en_attente': return { container: 'bg-semantic-amber/10', text: 'text-semantic-amber', label: 'En attente' };
      case 'annulee': return { container: 'bg-semantic-red/10', text: 'text-semantic-red', label: 'Annulée' };
      case 'terminee': return { container: 'bg-neutral-100 dark:bg-white/5', text: 'text-neutral-500', label: 'Terminée' };
      
      default: return { container: 'bg-neutral-100 dark:bg-white/5', text: 'text-neutral-500 dark:text-neutral-400', label: statut };
    }
  };

  const formatPrice = (price: number) => `${price?.toLocaleString()} FCFA`;
  
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'dd MMM HH:mm', { locale: fr });
  };

  const handleItemPress = (item: any) => {
    setSelectedItem(item);
    setDetailsModalVisible(true);
  };

  const renderItem = ({ item }: { item: any }) => {
    try {
      // Safety check for data integrity
      if (!item) return null;

      const data = item as CommandeWithDetails;
      
      const numero = data.numero_commande;
      const statut = data.statut;
      const tableNumero = data.tables?.numero;
      const date = data.date_creation;
      const montant = data.montant_total;
      const itemsCount = data.commande_items?.length;

      const statusStyle = getStatusStyle(statut);

      return (
        <Pressable 
          onPress={() => handleItemPress(item)}
          className="bg-white dark:bg-dark-card rounded-3xl p-5 mb-4 shadow-soft border border-neutral-100 dark:border-white/5"
        >
          <View className="flex-row justify-between items-center mb-4">
            <View>
              <Text className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-0.5">
                Commande
              </Text>
              <Text className="text-lg font-display font-black text-primary dark:text-white tracking-tight">
                {numero || '-'}
              </Text>
            </View>
            <View className={twMerge('px-3 py-1.5 rounded-xl', statusStyle.container)}>
              <Text className={twMerge('text-[10px] font-black uppercase tracking-widest', statusStyle.text)}>
                {statusStyle.label}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center justify-between mb-4 bg-neutral-50 dark:bg-white/5 p-3 rounded-2xl">
            <View className="flex-row items-center">
              <View className="w-8 h-8 bg-dark-accent/10 rounded-lg justify-center items-center mr-3">
                <Text className="text-dark-accent font-black text-xs">
                  {tableNumero || '?'}
                </Text>
              </View>
              <Text className="text-sm font-bold text-neutral-600 dark:text-neutral-400">
                Table {tableNumero || '?'}
              </Text>
            </View>
            <Text className="text-xs font-bold text-neutral-400 dark:text-neutral-500">
              {formatDate(date)}
            </Text>
          </View>

          <View className="border-t border-neutral-100 dark:border-white/5 pt-4 flex-row justify-between items-center">
            <Text className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">
              {itemsCount || 0} Articles
            </Text>
            <Text className="text-lg font-display font-black text-dark-accent">
              {formatPrice(montant)}
            </Text>
          </View>
        </Pressable>
      );
    } catch (error) {
      console.error('Error rendering item:', error);
      return null;
    }
  };

  const renderDetailsModal = () => {
    if (!selectedItem) return null;
    
    const details = selectedItem as CommandeWithDetails;
    const commandeItems = details.commande_items || [];

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={detailsModalVisible}
        onRequestClose={() => setDetailsModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white dark:bg-dark-card rounded-t-3xl h-[80%] p-6">
            <View className="flex-row justify-between items-center mb-6">
              <View>
                <Text className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-1">
                  Détails de la commande
                </Text>
                <Text className="text-2xl font-display font-black text-primary dark:text-white">
                  {details.numero_commande}
                </Text>
              </View>
              <Pressable 
                onPress={() => setDetailsModalVisible(false)}
                className="p-2 bg-neutral-100 dark:bg-white/10 rounded-full"
              >
                <X size={24} color={isDark ? 'white' : 'black'} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Info Section */}
              <View className="flex-row space-x-4 mb-6">
                <View className="flex-1 bg-neutral-50 dark:bg-white/5 p-4 rounded-2xl">
                  <Text className="text-[10px] font-bold text-neutral-400 uppercase mb-1">Date</Text>
                  <Text className="text-sm font-bold text-primary dark:text-white">
                    {formatDate(details.date_creation)}
                  </Text>
                </View>
                <View className="flex-1 bg-neutral-50 dark:bg-white/5 p-4 rounded-2xl">
                  <Text className="text-[10px] font-bold text-neutral-400 uppercase mb-1">Table</Text>
                  <Text className="text-sm font-bold text-primary dark:text-white">
                    N° {details.tables?.numero}
                  </Text>
                </View>
              </View>

              {/* Items List */}
              <Text className="text-lg font-bold text-primary dark:text-white mb-4">Contenu de la commande</Text>
              {commandeItems.map((item) => (
                <View key={item.id} className="flex-row justify-between items-center py-3 border-b border-neutral-100 dark:border-white/5">
                  <View className="flex-row items-center flex-1">
                    <View className="w-8 h-8 bg-neutral-100 dark:bg-white/5 rounded-lg items-center justify-center mr-3">
                      <Text className="font-bold text-primary dark:text-white">{item.quantite}</Text>
                    </View>
                    <Text className="font-medium text-primary dark:text-white flex-1">{item.nom_produit}</Text>
                  </View>
                  <Text className="font-bold text-primary dark:text-white">{formatPrice(item.prix_unitaire * item.quantite)}</Text>
                </View>
              ))}

              {/* Totals */}
              <View className="mt-6 space-y-2">
                 <View className="flex-row justify-between items-center pt-4 border-t border-dashed border-neutral-200 dark:border-white/10">
                  <Text className="text-lg font-black text-primary dark:text-white">Total</Text>
                  <Text className="text-2xl font-display font-black text-semantic-green">
                    {formatPrice(details.montant_total)}
                  </Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View className="flex-1 bg-neutral-50 dark:bg-dark-bg">
      {/* Header */}
      <View className="bg-white dark:bg-dark-card px-6 pb-4 shadow-soft border-b border-neutral-100 dark:border-white/5 pt-14">
        <View className="flex-row items-center mb-6">
          <Pressable 
            onPress={() => navigation.goBack()}
            className="p-3 bg-neutral-100 dark:bg-white/5 rounded-2xl mr-4"
          >
            <ChevronLeft size={24} color={isDark ? '#3B82F6' : '#141414'} />
          </Pressable>
          <View>
            <Text className="text-xs font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[2px] mb-0.5">
              Suivi
            </Text>
            <Text className="text-2xl font-display font-black text-primary dark:text-white tracking-tight">
              Historique
            </Text>
          </View>
        </View>

        {/* Search Bar */}
        <View className="flex-row items-center bg-neutral-100 dark:bg-white/5 rounded-2xl px-4 py-3.5 border border-transparent dark:border-white/5 mb-4">
          <Search size={20} color={isDark ? '#4B5563' : '#9CA3AF'} />
          <TextInput
            placeholder="Rechercher commande, table..."
            placeholderTextColor={isDark ? '#4B5563' : '#9CA3AF'}
            className="flex-1 ml-3 text-primary dark:text-white font-bold"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Time Filters */}
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
            {[
              { label: "Aujourd'hui", value: 'today' },
              { label: 'Cette semaine', value: 'week' },
              { label: 'Ce mois', value: 'month' },
              { label: 'Tout', value: 'all' },
              { label: 'Personnalisé', value: 'custom' }
            ].map((filter) => (
              <FilterChip 
                key={filter.value}
                label={filter.label} 
                value={filter.value as TimeFilter}
                active={timeFilter === filter.value}
                onPress={() => setTimeFilter(filter.value as TimeFilter)}
              />
            ))}
          </ScrollView>
          
          {/* Custom Date Selection UI */}
          {timeFilter === 'custom' && (
            <View className="flex-row items-center space-x-2 mt-2">
              <Pressable 
                onPress={() => openDatePicker('start')}
                className="flex-1 flex-row items-center bg-white dark:bg-white/5 p-2 rounded-lg border border-neutral-200 dark:border-white/10"
              >
                <Calendar size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />
                <Text className="ml-2 text-xs font-bold text-primary dark:text-white">
                  Du: {format(customDateRange.start, 'dd MMM yyyy')}
                </Text>
              </Pressable>
              <Pressable 
                onPress={() => openDatePicker('end')}
                className="flex-1 flex-row items-center bg-white dark:bg-white/5 p-2 rounded-lg border border-neutral-200 dark:border-white/10"
              >
                <Calendar size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />
                <Text className="ml-2 text-xs font-bold text-primary dark:text-white">
                  Au: {format(customDateRange.end, 'dd MMM yyyy')}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : isError ? (
        <View className="flex-1 justify-center items-center p-6">
          <View className="bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl w-full items-center">
            <Text className="text-red-500 font-bold text-lg mb-2">Erreur</Text>
            <Text className="text-neutral-600 dark:text-neutral-400 text-center mb-4">
              Impossible de charger l'historique. {error?.message}
            </Text>
            <Pressable 
              onPress={() => navigation.replace('Historique')}
              className="bg-red-500 px-6 py-3 rounded-xl"
            >
              <Text className="text-white font-bold">Réessayer</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 20 }}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center pt-20">
              <ShoppingBag size={48} color={isDark ? '#374151' : '#E5E7EB'} />
              <Text className="text-neutral-500 dark:text-neutral-400 font-bold uppercase tracking-widest text-xs mt-4">
                Aucun historique trouvé
              </Text>
            </View>
          }
        />
      )}
      
      {renderDetailsModal()}

      {showDatePicker && DateTimePicker && (
        Platform.OS === 'ios' ? (
          <Modal transparent animationType="fade" visible={showDatePicker}>
            <View className="flex-1 justify-end bg-black/50">
              <View className="bg-white dark:bg-dark-card pb-8">
                <View className="flex-row justify-end p-4 border-b border-neutral-100 dark:border-white/5">
                  <Pressable onPress={() => setShowDatePicker(false)}>
                    <Text className="text-primary dark:text-white font-bold text-lg">Fermer</Text>
                  </Pressable>
                </View>
                <DateTimePicker
                  value={datePickerMode === 'start' ? customDateRange.start : customDateRange.end}
                  mode="date"
                  display="spinner"
                  onChange={handleDateChange}
                  textColor={isDark ? 'white' : 'black'}
                />
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={datePickerMode === 'start' ? customDateRange.start : customDateRange.end}
            mode="date"
            display="default"
            onChange={handleDateChange}
          />
        )
      )}
    </View>
  );
}
