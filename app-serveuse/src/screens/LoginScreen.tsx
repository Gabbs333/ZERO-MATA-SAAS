import React, { useState } from 'react';
import { View, KeyboardAvoidingView, Platform, Alert, TextInput, Text, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';
import { useColorScheme } from 'nativewind';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { signIn } = useAuthStore();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    try {
      setLoading(true);
      await signIn(email.trim(), password);
    } catch (error: any) {
      console.error('Login error:', error);
      Alert.alert(
        'Erreur de connexion',
        error.message || 'Email ou mot de passe incorrect'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-neutral-50 dark:bg-dark-bg"
    >
      <View className="flex-1 justify-center p-5">
        <View className="w-full max-w-md self-center bg-white dark:bg-dark-card p-8 rounded-3xl shadow-soft border border-neutral-100 dark:border-white/5">
          <View className="items-center mb-6">
            <View className="flex-row items-center justify-center p-4">
              <Text className="text-4xl font-black tracking-tighter text-neutral-900 dark:text-white">
                ZERO-MATA
              </Text>
            </View>
          </View>
          <Text className="text-sm text-center text-neutral-500 dark:text-neutral-400 mb-10 font-bold uppercase tracking-widest">
            Serveuse
          </Text>

          <View className="mb-5">
            <Text className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1.5 ml-1">Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              className="w-full bg-neutral-100 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl px-4 py-4 text-primary dark:text-white font-bold"
              placeholder="votre@email.com"
              placeholderTextColor={isDark ? "#4B5563" : "#9CA3AF"}
              editable={!loading}
            />
          </View>

          <View className="mb-8">
            <Text className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1.5 ml-1">Mot de passe</Text>
            <View className="relative">
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="password"
                className="w-full bg-neutral-100 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl px-4 py-4 text-primary dark:text-white pr-12 font-bold"
                placeholder="Votre mot de passe"
                placeholderTextColor={isDark ? "#4B5563" : "#9CA3AF"}
                editable={!loading}
              />
              <TouchableOpacity 
                onPress={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-4"
              >
                {showPassword ? (
                  <EyeOff size={20} color={isDark ? '#4B5563' : '#9CA3AF'} />
                ) : (
                  <Eye size={20} color={isDark ? '#4B5563' : '#9CA3AF'} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            className={`w-full py-5 rounded-2xl flex-row justify-center items-center shadow-lg ${
              loading ? 'bg-primary/70 dark:bg-dark-accent/70' : 'bg-primary dark:bg-dark-accent'
            } ${isDark ? 'shadow-dark-accent/20' : 'shadow-primary/20'}`}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-black text-base uppercase tracking-widest">Se Connecter</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

