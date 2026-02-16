import React, { useState, useMemo, useEffect } from 'react';
import { View, FlatList, Alert, Text, TouchableOpacity, ActivityIndicator, ScrollView, TextInput, Modal } from 'react-native';
import { ChevronLeft, Search, X, LayoutGrid } from 'lucide-react-native';
import { ProductItem } from '../components/ProductItem';
import { useProduitsDisponibles, useTables } from '../hooks/useSupabaseQuery';
import { useCreateCommande } from '../hooks/useSupabaseMutation';
import { useStockRealtime } from '../hooks/useRealtimeSubscription';
import { useCommandeStore } from '../store/commandeStore';
import { useColorScheme } from 'nativewind';
import { useQueryClient } from '@tanstack/react-query';

interface CommandeScreenProps {
  navigation: any;
  route: any;
}

export function CommandeScreen({ navigation, route }: CommandeScreenProps) {
  const tableNumeroParam = route.params?.tableNumero;
  const [selectedTableNum, setSelectedTableNum] = useState<number | null>(tableNumeroParam ? Number(tableNumeroParam) : null);
  const [isTableModalVisible, setTableModalVisible] = useState(false);
  
  const [selectedCategorie, setSelectedCategorie] = useState<string>('all');
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { colorScheme } = useColorScheme();
  const queryClient = useQueryClient();
  
  const { data: produits, isPending: isLoading } = useProduitsDisponibles();
  const { data: tables } = useTables();
  const { mutate: createCommande, isPending: isSubmitting } = useCreateCommande();

  // Mise à jour du stock en temps réel
  useStockRealtime(() => {
    queryClient.invalidateQueries({ queryKey: ['produits-disponibles'] });
  });
  
  const {
    tableId,
    setTableId,
    items,
    addItem,
    updateQuantite,
    clearCommande,
    getMontantTotal,
    getItemsArray,
  } = useCommandeStore();

  // Clear table if not provided in params (direct access from tab)
  useEffect(() => {
    if (!tableNumeroParam) {
      setTableId(null);
      setSelectedTableNum(null);
    } else {
        setSelectedTableNum(tableNumeroParam);
    }
  }, [tableNumeroParam]);

  const categories = [
    { value: 'all', label: 'Tous' },
    { value: 'boisson', label: 'Boissons' },
    { value: 'nourriture', label: 'Nourriture' },
    { value: 'autre', label: 'Autre' },
  ];

  // Filtrer les produits par catégorie et recherche
  const produitsFiltered = useMemo(() => {
    if (!produits) return [];
    let filtered = produits;
    
    if (selectedCategorie !== 'all') {
      filtered = filtered.filter((p: any) => p.categorie === selectedCategorie);
    }
    
    if (searchQuery) {
      filtered = filtered.filter((p: any) => 
        p.nom.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return filtered;
  }, [produits, selectedCategorie, searchQuery]);

  // Calculer le nombre d'articles et le montant total
  const itemsCount = Array.from(items.values()).reduce(
    (sum, item) => sum + item.quantite,
    0
  );
  const montantTotal = getMontantTotal();

  const handleAddProduct = (produit: any) => {
    addItem(produit, 1);
  };

  const handleRemoveProduct = (produitId: string) => {
    const item = items.get(produitId);
    if (item) {
      updateQuantite(produitId, item.quantite - 1);
    }
  };

  const handleTableSelect = (table: any) => {
      setTableId(table.id);
      setSelectedTableNum(table.numero);
      setTableModalVisible(false);
  };

  const handleSubmit = () => {
    if (itemsCount === 0) {
      Alert.alert('Erreur', 'Veuillez ajouter au moins un produit');
      return;
    }

    if (!tableId) {
      setTableModalVisible(true);
      return;
    }

    Alert.alert(
      'Confirmer la commande',
      `Soumettre la commande pour la table ${selectedTableNum} ?\n\nTotal: ${montantTotal} FCFA`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: () => {
            createCommande(
              {
                table_id: tableId,
                items: getItemsArray(),
              },
              {
                onSuccess: () => {
                  Alert.alert(
                    'Succès',
                    'Commande soumise avec succès',
                    [
                      {
                        text: 'OK',
                        onPress: () => {
                          clearCommande();
                          if (navigation.canGoBack()) {
                              navigation.goBack();
                          } else {
                              setSelectedTableNum(null);
                              setTableId(null);
                          }
                        },
                      },
                    ]
                  );
                },
                onError: (error: any) => {
                  Alert.alert(
                    'Erreur',
                    error.message || 'Impossible de soumettre la commande'
                  );
                  console.error('Create commande error:', error);
                },
              }
            );
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-neutral-50 dark:bg-dark-bg">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  const isDark = colorScheme === 'dark';

  return (
    <View className="flex-1 bg-neutral-50 dark:bg-dark-bg">
      {/* Header */}
      <View className="flex-row items-center justify-between bg-white dark:bg-dark-card px-6 py-4 shadow-soft border-b border-neutral-100 dark:border-white/5 pt-14">
        <View className="flex-row items-center">
          {navigation.canGoBack() && (
            <TouchableOpacity 
                onPress={() => navigation.goBack()}
                className="p-3 bg-neutral-100 dark:bg-white/5 rounded-2xl mr-4"
            >
                <ChevronLeft size={24} color={isDark ? '#3B82F6' : '#141414'} />
            </TouchableOpacity>
          )}
          <View>
            <Text className="text-xs font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[2px] mb-0.5">
              Nouvelle Commande
            </Text>
            <TouchableOpacity onPress={() => setTableModalVisible(true)}>
                <Text className={`text-2xl font-display font-black tracking-tight ${selectedTableNum ? 'text-primary dark:text-white' : 'text-neutral-300 dark:text-neutral-600'}`}>
                {selectedTableNum ? `Table ${selectedTableNum}` : 'Choisir une table'}
                </Text>
            </TouchableOpacity>
          </View>
        </View>
        {itemsCount > 0 && (
          <View className="bg-dark-accent px-3 py-1.5 rounded-full">
            <Text className="text-white text-[10px] font-black uppercase tracking-widest">
              {itemsCount} Articles
            </Text>
          </View>
        )}
      </View>

      {/* Table Selection Modal */}
      <Modal
        visible={isTableModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setTableModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white dark:bg-dark-card rounded-t-3xl h-[70%]">
            <View className="p-6 border-b border-neutral-100 dark:border-white/5 flex-row justify-between items-center">
                <Text className="text-xl font-bold text-neutral-900 dark:text-white">Sélectionner une table</Text>
                <TouchableOpacity onPress={() => setTableModalVisible(false)}>
                    <X size={24} color={isDark ? '#fff' : '#000'} />
                </TouchableOpacity>
            </View>
            <FlatList
                data={tables}
                keyExtractor={(item) => item.id}
                numColumns={3}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        onPress={() => handleTableSelect(item)}
                        className={`flex-1 m-2 p-4 rounded-xl items-center justify-center border-2 ${
                            selectedTableNum === item.numero
                                ? 'bg-primary/10 border-primary'
                                : 'bg-neutral-50 dark:bg-white/5 border-transparent'
                        }`}
                    >
                        <LayoutGrid size={24} color={selectedTableNum === item.numero ? '#3B82F6' : (isDark ? '#fff' : '#000')} />
                        <Text className={`mt-2 font-bold ${selectedTableNum === item.numero ? 'text-primary' : 'text-neutral-900 dark:text-white'}`}>
                            {item.numero}
                        </Text>
                    </TouchableOpacity>
                )}
            />
          </View>
        </View>
      </Modal>

      {/* Search Bar */}
      {showSearch && (
        <View className="px-6 pb-4">
          <View className="flex-row items-center bg-white dark:bg-dark-card rounded-xl px-4 py-2 border border-neutral-100 dark:border-white/5">
            <Search size={20} className="text-neutral-400" color={isDark ? '#9ca3af' : '#9ca3af'} />
            <TextInput
              className="flex-1 ml-2 text-base text-neutral-900 dark:text-white"
              placeholder="Rechercher un produit..."
              placeholderTextColor={isDark ? '#9ca3af' : '#9ca3af'}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            <TouchableOpacity onPress={() => { setShowSearch(false); setSearchQuery(''); }}>
              <X size={20} className="text-neutral-400" color={isDark ? '#9ca3af' : '#9ca3af'} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Catégories */}
      <View className="py-4">
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20 }}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.value}
              onPress={() => setSelectedCategorie(cat.value)}
              className={`mr-3 px-6 py-3 rounded-2xl border ${
                selectedCategorie === cat.value
                  ? 'bg-dark-accent border-dark-accent'
                  : 'bg-white dark:bg-dark-card border-neutral-100 dark:border-white/5'
              }`}
            >
              <Text className={`font-black uppercase tracking-widest text-[10px] ${
                selectedCategorie === cat.value
                  ? 'text-white'
                  : 'text-neutral-500 dark:text-neutral-400'
              }`}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={produitsFiltered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ProductItem
            produit={item}
            quantite={items.get(item.id)?.quantite || 0}
            onAdd={() => handleAddProduct(item)}
            onRemove={() => handleRemoveProduct(item.id)}
          />
        )}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center pt-20">
            <Text className="text-neutral-500 dark:text-neutral-400 font-bold uppercase tracking-widest text-xs">
              Aucun produit trouvé
            </Text>
          </View>
        }
      />

      {/* Résumé de commande flottant */}
      {itemsCount > 0 && (
        <View className="absolute bottom-10 left-6 right-6 z-40">
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isSubmitting}
            className="bg-dark-accent py-5 rounded-3xl flex-row justify-between items-center px-8 shadow-2xl shadow-dark-accent/40"
          >
            <View>
              <Text className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-0.5">
                Total à payer
              </Text>
              <Text className="text-white text-xl font-display font-black tracking-tight">
                {montantTotal.toLocaleString()} FCFA
              </Text>
            </View>
            <View className="flex-row items-center">
              {isSubmitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Text className="text-white font-black uppercase tracking-widest mr-2">
                    Confirmer
                  </Text>
                </>
              )}
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Floating Search Button */}
      {!showSearch && (
        <TouchableOpacity
          onPress={() => setShowSearch(true)}
          className="absolute right-6 w-14 h-14 bg-white dark:bg-dark-card rounded-full items-center justify-center shadow-lg border border-neutral-100 dark:border-white/5 z-50"
          style={{ bottom: itemsCount > 0 ? 120 : 40 }}
        >
          <Search size={24} color={isDark ? '#fff' : '#000'} />
        </TouchableOpacity>
      )}
    </View>
  );
}

