import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Plus, Minus } from 'lucide-react-native';
import { ProduitAvecStock } from '../types/database.types';
import { useColorScheme } from 'nativewind';

interface ProductItemProps {
  produit: ProduitAvecStock;
  quantite?: number;
  onAdd: () => void;
  onRemove?: () => void;
}

export function ProductItem({ produit, quantite = 0, onAdd, onRemove }: ProductItemProps) {
  const { colorScheme } = useColorScheme();

  const formatPrice = (price: number) => {
    return `${price} FCFA`;
  };

  const stockQty = produit.stock?.quantite_disponible ?? (produit as any).quantite_disponible ?? 0;
  const isOutOfStock = stockQty <= 0;

  return (
    <View className="bg-white dark:bg-dark-card rounded-3xl p-5 mb-4 shadow-soft border border-neutral-100 dark:border-white/5">
      <View className="flex-row justify-between items-center">
        <View className="flex-1 mr-4">
          <Text className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1">
            {produit.categorie}
          </Text>
          <Text className="text-xl font-display font-black text-primary dark:text-white mb-1 tracking-tight">
            {produit.nom}
          </Text>
          <View className="flex-row items-center">
            <Text className="text-dark-accent font-black mr-3 font-display">
              {formatPrice(produit.prix_vente)}
            </Text>
            <View className={`px-2 py-0.5 rounded-md ${isOutOfStock ? 'bg-semantic-red/10' : 'bg-semantic-green/10'}`}>
              <Text className={`text-[9px] font-black uppercase tracking-widest ${isOutOfStock ? 'text-semantic-red' : 'text-semantic-green'}`}>
                {isOutOfStock ? 'Rupture' : `${stockQty} en stock`}
              </Text>
            </View>
          </View>
        </View>
        
        <View className="flex-row items-center bg-neutral-100 dark:bg-white/5 rounded-2xl p-1">
          {quantite > 0 && onRemove && (
            <>
              <TouchableOpacity
                onPress={onRemove}
                className="w-10 h-10 bg-white dark:bg-white/10 rounded-xl justify-center items-center shadow-sm"
              >
                <Minus size={20} color={colorScheme === 'dark' ? '#3B82F6' : '#141414'} />
              </TouchableOpacity>
              <Text className="mx-4 text-lg font-black text-primary dark:text-white min-w-[20px] text-center font-display">
                {quantite}
              </Text>
            </>
          )}
          <TouchableOpacity
            onPress={onAdd}
            disabled={isOutOfStock}
            className={`w-10 h-10 rounded-xl justify-center items-center shadow-sm ${
              isOutOfStock 
                ? 'bg-neutral-200 dark:bg-white/5 opacity-50' 
                : 'bg-primary dark:bg-dark-accent'
            }`}
          >
            <Plus size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

