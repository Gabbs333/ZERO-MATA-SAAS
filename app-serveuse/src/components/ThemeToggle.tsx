import React from 'react';
import { TouchableOpacity } from 'react-native';
import { useColorScheme } from 'nativewind';
import { Moon, Sun } from 'lucide-react-native';

export function ThemeToggle() {
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <TouchableOpacity
      onPress={toggleColorScheme}
      className="p-2 rounded-lg bg-neutral-100 dark:bg-white/10"
      accessibilityLabel="Toggle theme"
    >
      {isDark ? (
        <Sun size={20} color="#fff" />
      ) : (
        <Moon size={20} color="#171717" />
      )}
    </TouchableOpacity>
  );
}
