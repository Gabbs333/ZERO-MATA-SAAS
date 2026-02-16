import React from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import { Table } from '../types/database.types';

interface TableCardProps {
  table: Table;
  onPress: () => void;
}

export function TableCard({ table, onPress }: TableCardProps) {
  const getStatusColor = () => {
    switch (table.statut) {
      case 'libre':
        return 'bg-semantic-green';
      case 'occupee':
        return 'bg-semantic-red';
      case 'commande_en_attente':
        return 'bg-semantic-amber';
      default:
        return 'bg-neutral-500';
    }
  };

  const getStatusLabel = () => {
    switch (table.statut) {
      case 'libre':
        return 'Libre';
      case 'occupee':
        return 'Occupée';
      case 'commande_en_attente':
        return 'En attente';
      default:
        return 'Inconnu';
    }
  };

  return (
    <TouchableOpacity 
      onPress={onPress} 
      className="w-[48%] mb-4"
      activeOpacity={0.7}
    >
      <View className="bg-white dark:bg-dark-card rounded-3xl p-5 shadow-soft border border-neutral-100 dark:border-white/5 h-36 justify-between">
        <View>
          <Text className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1">
            Numéro
          </Text>
          <Text className="text-3xl font-display font-black text-primary dark:text-white tracking-tighter">
            {table.numero}
          </Text>
        </View>

        <View className="flex-row items-center">
          <View className={`w-2 h-2 rounded-full mr-2 ${getStatusColor()}`} />
          <Text className="text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-widest">
            {getStatusLabel()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

