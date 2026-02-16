import React, { useCallback } from 'react';
import { View, FlatList, RefreshControl, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useMyCommandes } from '../hooks/useSupabaseQuery';
import { useAuthStore } from '../store/authStore';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ShoppingBag, Clock, CheckCircle2, XCircle, ChevronRight } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';

export function CommandesListScreen({ navigation }: any) {
  const { user } = useAuthStore();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const queryClient = useQueryClient();

  const { data: commandes, isPending: loading, refetch } = useMyCommandes(user?.id);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const getStatusColor = (statut: string) => {
    switch (statut) {
      case 'en_attente':
        return 'text-orange-500 bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20';
      case 'validee':
        return 'text-green-500 bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20';
      case 'annulee':
        return 'text-red-500 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20';
      default:
        return 'text-neutral-500 bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700';
    }
  };

  const getStatusLabel = (statut: string) => {
    switch (statut) {
      case 'en_attente': return 'En attente';
      case 'validee': return 'Validée';
      case 'annulee': return 'Annulée';
      default: return statut;
    }
  };

  const getStatusIcon = (statut: string) => {
    switch (statut) {
      case 'en_attente': return <Clock size={14} className="text-orange-500" color="#f97316" />;
      case 'validee': return <CheckCircle2 size={14} className="text-green-500" color="#22c55e" />;
      case 'annulee': return <XCircle size={14} className="text-red-500" color="#ef4444" />;
      default: return <Clock size={14} className="text-neutral-500" color="#737373" />;
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-neutral-50 dark:bg-dark-bg">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-neutral-50 dark:bg-dark-bg">
      {/* Header */}
      <View className="bg-white dark:bg-dark-card px-6 py-4 shadow-soft border-b border-neutral-100 dark:border-white/5 pt-14">
        <View>
          <Text className="text-xs font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[2px] mb-0.5">
            Vos Activités
          </Text>
          <Text className="text-2xl font-display font-black text-primary dark:text-white tracking-tight">
            Commandes Récentes
          </Text>
        </View>
      </View>

      <FlatList
        data={commandes || []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refetch}
            tintColor={isDark ? '#3B82F6' : '#141414'}
          />
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center pt-20">
            <ShoppingBag size={48} color={isDark ? '#525252' : '#d4d4d4'} />
            <Text className="text-neutral-500 dark:text-neutral-400 font-bold uppercase tracking-widest text-xs mt-4">
              Aucune commande récente
            </Text>
          </View>
        }
        renderItem={({ item }) => {
            const tableNumero = item.tables?.numero || '?';
            const itemCount = item.commande_items?.reduce((acc: number, curr: any) => acc + curr.quantite, 0) || 0;
            const statusStyle = getStatusColor(item.statut);
            
            return (
                <TouchableOpacity
                    className="bg-white dark:bg-dark-card p-4 rounded-2xl mb-4 shadow-sm border border-neutral-100 dark:border-white/5"
                    activeOpacity={0.7}
                    // Navigation vers détail si nécessaire, ou juste informatif
                >
                    <View className="flex-row justify-between items-start mb-3">
                        <View className="flex-row items-center">
                            <View className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/20 items-center justify-center mr-3">
                                <Text className="text-primary dark:text-blue-400 font-black text-sm">T{tableNumero}</Text>
                            </View>
                            <View>
                                <Text className="text-base font-bold text-neutral-900 dark:text-white">
                                    Commande #{item.numero_commande}
                                </Text>
                                <Text className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                                    {format(new Date(item.date_creation), 'HH:mm', { locale: fr })} • {itemCount} articles
                                </Text>
                            </View>
                        </View>
                        <View className={`px-2.5 py-1 rounded-full border flex-row items-center gap-1.5 ${statusStyle.split(' ').filter(c => c.startsWith('bg-') || c.startsWith('border-')).join(' ')}`}>
                            {getStatusIcon(item.statut)}
                            <Text className={`text-[10px] font-bold uppercase tracking-wide ${statusStyle.split(' ').find(c => c.startsWith('text-'))}`}>
                                {getStatusLabel(item.statut)}
                            </Text>
                        </View>
                    </View>

                    {/* Preview des items (3 premiers) */}
                    <View className="pl-13 space-y-1">
                        {item.commande_items?.slice(0, 3).map((line: any, idx: number) => (
                            <Text key={idx} className="text-sm text-neutral-600 dark:text-neutral-300" numberOfLines={1}>
                                <Text className="font-bold">{line.quantite}x</Text> {line.nom_produit}
                            </Text>
                        ))}
                        {(item.commande_items?.length || 0) > 3 && (
                            <Text className="text-xs text-neutral-400 italic">
                                + {(item.commande_items?.length || 0) - 3} autres...
                            </Text>
                        )}
                    </View>
                    
                    <View className="mt-4 pt-3 border-t border-neutral-100 dark:border-white/5 flex-row justify-between items-center">
                        <Text className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
                            Total
                        </Text>
                        <Text className="text-lg font-black text-primary dark:text-white">
                            {(item.montant_total || 0).toLocaleString()} FCFA
                        </Text>
                    </View>
                </TouchableOpacity>
            );
        }}
      />
    </View>
  );
}
