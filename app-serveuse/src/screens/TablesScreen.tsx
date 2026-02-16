import React, { useCallback, useState } from 'react';
import { View, FlatList, RefreshControl, Alert, Text, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { LogOut, History, X, Plus } from 'lucide-react-native';
import { TableCard } from '../components/TableCard';
import { useTables, useTableActiveCommandes } from '../hooks/useSupabaseQuery';
import { useTablesRealtime } from '../hooks/useRealtimeSubscription';
import { useLibererTable } from '../hooks/useSupabaseMutation';
import { useCommandeStore } from '../store/commandeStore';
import { useAuthStore } from '../store/authStore';
import { useQueryClient } from '@tanstack/react-query';
import { Table } from '../types/database.types';
import { useColorScheme } from 'nativewind';

interface TablesScreenProps {
  navigation: any;
}

export function TablesScreen({ navigation }: TablesScreenProps) {
  const { data: tables, isPending: loading, refetch } = useTables();
  const { mutate: libererTable } = useLibererTable();
  const { setTableId } = useCommandeStore();
  const { user, signOut } = useAuthStore();
  const queryClient = useQueryClient();
  const { colorScheme } = useColorScheme();
  
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [isModalVisible, setModalVisible] = useState(false);
  
  // Fetch active commands for selected table
  const { data: activeCommandes, isPending: loadingCommandes } = useTableActiveCommandes(selectedTable?.id || null);

  // Get establishment name from user profile (loaded in authStore)
  const etablissementNom = user?.etablissement?.nom || '';

  // Subscription Realtime pour les mises à jour de tables
  useTablesRealtime(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      if (selectedTable) {
         queryClient.invalidateQueries({ queryKey: ['table-active-commandes', selectedTable.id] });
      }
    }, [queryClient, selectedTable])
  );

  const handleTablePress = (table: Table) => {
    if (table.statut === 'libre') {
      // Créer une nouvelle commande directement
      setTableId(table.id);
      navigation.navigate('CommanderTab', { tableNumero: table.numero });
    } else {
      setSelectedTable(table);
      setModalVisible(true);
    }
  };

  const handleNewCommande = () => {
      if (selectedTable) {
        setModalVisible(false);
        setTableId(selectedTable.id);
        navigation.navigate('CommanderTab', { tableNumero: selectedTable.numero });
      }
  };
  
  const handleLibererTable = () => {
      if (!selectedTable) return;
      
      Alert.alert(
        'Confirmer la libération',
        'Attention : Cela marquera la table comme libre. Assurez-vous que tous les clients sont partis.',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Oui, libérer',
            style: 'destructive',
            onPress: () => {
              libererTable(selectedTable.id, {
                onSuccess: () => {
                  setModalVisible(false);
                  Alert.alert('Succès', 'Table libérée avec succès');
                },
                onError: (error) => {
                  Alert.alert('Erreur', 'Impossible de libérer la table');
                  console.error(error);
                },
              });
            },
          },
        ]
      );
  };

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vraiment vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: () => signOut(),
        },
      ]
    );
  };

  const isDark = colorScheme === 'dark';

  return (
    <View className="flex-1 bg-neutral-50 dark:bg-dark-bg">
      {/* Header */}
      <View className="flex-row items-center justify-between bg-white dark:bg-dark-card px-6 py-4 shadow-soft border-b border-neutral-100 dark:border-white/5 pt-14">
        <View>
          <Text className="text-xs font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[2px] mb-0.5">
            {etablissementNom || 'ZERO-MATA'}
          </Text>
          <Text className="text-2xl font-display font-black text-primary dark:text-white tracking-tight">
            Tables
          </Text>
        </View>
        <View className="flex-row items-center">
          <TouchableOpacity 
            onPress={() => navigation.navigate('HistoriqueTab')}
            className="p-3 bg-neutral-100 dark:bg-white/5 rounded-2xl mr-3"
          >
            <History size={22} color={isDark ? '#3B82F6' : '#141414'} />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={handleLogout}
            className="p-3 bg-semantic-red/10 rounded-2xl"
          >
            <LogOut size={22} color="#D92D20" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : (
        <FlatList
            data={tables ?? []}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
            <TableCard 
                table={item} 
                onPress={() => handleTablePress(item)} 
            />
            )}
            numColumns={2}
            columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 20 }}
            contentContainerStyle={{ paddingVertical: 20 }}
            refreshControl={
            <RefreshControl 
                refreshing={loading} 
                onRefresh={refetch} 
                tintColor={isDark ? '#3B82F6' : '#141414'}
            />
            }
            ListEmptyComponent={
            <View className="flex-1 items-center justify-center pt-20">
                <Text className="text-neutral-500 dark:text-neutral-400 font-bold uppercase tracking-widest text-xs">
                Aucune table trouvée
                </Text>
            </View>
            }
        />
      )}

      {/* Table Details Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
            <View className="bg-white dark:bg-dark-card rounded-t-3xl h-[80%]">
                {/* Modal Header */}
                <View className="p-6 border-b border-neutral-100 dark:border-white/5 flex-row justify-between items-center">
                    <View>
                        <Text className="text-xs font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[2px] mb-0.5">
                            Détails de la table
                        </Text>
                        <Text className="text-2xl font-display font-black text-primary dark:text-white tracking-tight">
                            Table {selectedTable?.numero}
                        </Text>
                    </View>
                    <TouchableOpacity onPress={() => setModalVisible(false)} className="p-2 bg-neutral-100 dark:bg-white/10 rounded-full">
                        <X size={24} color={isDark ? '#fff' : '#000'} />
                    </TouchableOpacity>
                </View>

                {/* Content */}
                <View className="flex-1 p-6">
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-lg font-bold text-neutral-900 dark:text-white">Commandes en cours</Text>
                        <TouchableOpacity 
                            onPress={handleNewCommande}
                            className="flex-row items-center bg-primary px-3 py-2 rounded-xl"
                        >
                            <Plus size={16} color="#fff" />
                            <Text className="text-white font-bold ml-1 text-xs uppercase">Nouvelle</Text>
                        </TouchableOpacity>
                    </View>

                    {loadingCommandes ? (
                        <ActivityIndicator size="small" color="#3B82F6" />
                    ) : (
                        <FlatList 
                            data={activeCommandes}
                            keyExtractor={(item: any) => item.id}
                            contentContainerStyle={{ paddingBottom: 20 }}
                            ListEmptyComponent={
                                <View className="py-8 items-center">
                                    <Text className="text-neutral-500 dark:text-neutral-400 italic">Aucune commande active</Text>
                                </View>
                            }
                            renderItem={({ item }: { item: any }) => (
                                <View className="mb-3 p-4 bg-neutral-50 dark:bg-white/5 rounded-xl border border-neutral-100 dark:border-white/5">
                                    <View className="flex-row justify-between mb-2">
                                        <Text className="font-bold text-neutral-900 dark:text-white">#{item.numero_commande}</Text>
                                        <View className={`px-2 py-1 rounded-full ${
                                            item.statut === 'validee' ? 'bg-green-100 dark:bg-green-900/30' : 
                                            item.statut === 'en_attente' ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-blue-100 dark:bg-blue-900/30'
                                        }`}>
                                            <Text className={`text-[10px] font-bold uppercase ${
                                                item.statut === 'validee' ? 'text-green-600 dark:text-green-400' : 
                                                item.statut === 'en_attente' ? 'text-orange-600 dark:text-orange-400' : 'text-blue-600 dark:text-blue-400'
                                            }`}>
                                                {item.statut.replace('_', ' ')}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text className="text-neutral-500 dark:text-neutral-400 text-xs mb-2">
                                        {item.commande_items?.length || 0} articles • {new Date(item.date_creation).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </Text>
                                    <View className="flex-row justify-between items-center mt-1 pt-2 border-t border-neutral-200 dark:border-white/10">
                                        <Text className="font-black text-neutral-900 dark:text-white">
                                            {item.montant_total?.toLocaleString()} FCFA
                                        </Text>
                                    </View>
                                </View>
                            )}
                        />
                    )}
                </View>

                {/* Footer Actions */}
                <View className="p-6 border-t border-neutral-100 dark:border-white/5 bg-neutral-50 dark:bg-dark-bg/50">
                    <TouchableOpacity 
                        onPress={handleLibererTable}
                        className="w-full py-4 bg-white dark:bg-dark-card border border-red-200 dark:border-red-900/30 rounded-2xl items-center justify-center"
                    >
                        <Text className="text-red-500 font-bold uppercase tracking-widest text-xs">
                            Libérer la table
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>
    </View>
  );
}
