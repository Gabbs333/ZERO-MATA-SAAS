import React from 'react';
import { View, Text, Platform, Image } from 'react-native';
import { useColorScheme } from 'nativewind';

export function BrandingOverlay() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View 
      className="absolute flex-row items-center bg-white/90 dark:bg-black/60 px-3 py-1.5 rounded-full border border-neutral-200 dark:border-white/10 shadow-sm"
      style={{ 
        position: 'absolute', 
        bottom: 100, 
        right: 16, 
        zIndex: 9999,
        elevation: 10, // For Android
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      }}
      pointerEvents="none"
    >
      <Image 
        source={require('../../assets/icon.png')} 
        style={{ width: 16, height: 16, marginRight: 6 }} 
        resizeMode="contain" 
      />
      <Text className="text-[10px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">
        ZERO-MATA
      </Text>
    </View>
  );
}
