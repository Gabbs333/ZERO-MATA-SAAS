import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useColorScheme } from 'nativewind';

interface CommandeSummaryProps {
  itemsCount: number;
  montantTotal: number;
  onSubmit: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function CommandeSummary({
  itemsCount,
  montantTotal,
  onSubmit,
  onCancel,
  loading = false,
}: CommandeSummaryProps) {
  const { colorScheme } = useColorScheme();

  const formatPrice = (price: number) => {
    return `${price} FCFA`;
  };

  if (itemsCount === 0) {
    return null;
  }

  return (
    <View className="bg-white dark:bg-dark-card rounded-t-[40px] p-8 shadow-soft absolute bottom-0 left-0 right-0 border-t border-neutral-100 dark:border-white/5">
      <View className="flex-row justify-between items-center mb-6">
        <View>
          <Text className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1">Articles</Text>
          <Text className="text-2xl font-display font-black text-primary dark:text-white tracking-tight">{itemsCount}</Text>
        </View>
        <View className="items-end">
          <Text className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1">Total à payer</Text>
          <Text className="text-3xl font-display font-black text-semantic-green tracking-tighter">
            {formatPrice(montantTotal)}
          </Text>
        </View>
      </View>
      
      <View className="flex-row space-x-4">
        <TouchableOpacity
          onPress={onCancel}
          disabled={loading}
          className="flex-1 bg-neutral-100 dark:bg-white/5 py-5 rounded-2xl justify-center items-center"
        >
          <Text className="text-semantic-red font-black uppercase tracking-widest text-xs">
            Annuler
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={onSubmit}
          disabled={loading}
          className={`flex-1 py-5 rounded-2xl justify-center items-center flex-row shadow-lg ${
            loading ? 'bg-primary/70 dark:bg-dark-accent/70' : 'bg-primary dark:bg-dark-accent'
          }`}
        >
          {loading && <ActivityIndicator color="white" className="mr-2" size="small" />}
          <Text className="text-white font-black uppercase tracking-widest text-xs">
            {loading ? 'Envoi...' : 'Valider'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

