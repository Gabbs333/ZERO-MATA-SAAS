import React from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, SafeAreaView } from 'react-native';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { useAuthStore } from '../store/authStore';
import { ChevronLeft, Receipt } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface UnpaidFacture {
  id: string;
  numero_facture: string;
  montant_total: number;
  montant_paye: number;
  statut: 'en_attente_paiement' | 'partiellement_payee';
  date_generation: string;
  commandes: any; // Can be array or object depending on Supabase response
}

export function CreancesDetailsScreen({ navigation, route }: any) {
  const { user } = useAuthStore();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { factureId } = route.params || {};

  const { data: factures, isPending: isLoading } = useSupabaseQuery<UnpaidFacture[]>(
    ['unpaid-factures', user?.etablissement_id, factureId, user?.id],
    async (supabase) => {
      // If we have a specific factureId, we try to fetch it regardless of etablissement_id (RLS will handle security)
      // Otherwise we need at least user id
      if (!user?.id) return { data: [], error: null };
      
      let query = supabase
        .from('factures')
        .select(`
          *,
          commandes!inner (
            tables (numero),
            profiles!serveuse_id (nom, prenom)
          )
        `)
        .in('statut', ['en_attente_paiement', 'partiellement_payee']);

      // Note: We don't filter by etablissement_id here because it might not be present on older factures
      // or might cause issues if user profile is not fully synced.
      // RLS and serveuse_id check on linked command are sufficient for security.

      // If specific facture requested
      if (factureId) {
        query = query.eq('id', factureId);
      } else {
        // If listing all, ensure we only see those for this serveuse (via inner join on commandes)
        // This matches the logic in OverviewScreen
        query = query.eq('commandes.serveuse_id', user.id);
        
        // Also apply filters from OverviewScreen logic if passed via params?
        // Actually, the user might want to see ALL unpaid details here if they clicked "See All" or similar.
        // But if they clicked a specific item, we show that item.
        // Wait, CreancesDetailsScreen seems to be a list of ALL unpaid factures if no ID is passed.
        // If the user came from Dashboard "Today" view, they might expect to see only "Today" list here too?
        // Or maybe this screen is meant to be the "Audit" view mentioned by the user where they can see everything.
        // Let's keep it showing ALL unpaid factures for now as per user request "anciennes creances doivent rester consultables".
      }

      return query.order('date_generation', { ascending: false });
    },
    { enabled: !!user?.id }
  );

  const formatPrice = (price: number) => {
    return `${(price || 0).toLocaleString()} FCFA`;
  };

  const renderItem = ({ item }: { item: UnpaidFacture }) => {
    const remaining = item.montant_total - item.montant_paye;
    const progress = (item.montant_paye / item.montant_total) * 100;

    // Handle nested commandes relation which might be an array or object
    const commandeData = Array.isArray(item.commandes) ? item.commandes[0] : item.commandes;
    const profileData = commandeData?.profiles; // profiles is likely an object if 1:1, but could be array if 1:N
    const profile = Array.isArray(profileData) ? profileData[0] : profileData;
    const tableData = commandeData?.tables;
    const table = Array.isArray(tableData) ? tableData[0] : tableData;

    return (
      <View className="bg-white dark:bg-dark-card rounded-3xl p-5 mb-4 shadow-soft border border-neutral-100 dark:border-white/5">
        <View className="flex-row justify-between items-start mb-4">
          <View className="flex-row items-center flex-1">
            <View className="w-10 h-10 bg-semantic-red/10 rounded-2xl items-center justify-center mr-3">
              <Receipt size={20} color="#D92D20" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-primary dark:text-white" numberOfLines={1}>
                {profile?.prenom} {profile?.nom}
              </Text>
              <Text className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">
                Table {table?.numero} • {format(new Date(item.date_generation), 'dd MMM HH:mm', { locale: fr })}
              </Text>
            </View>
          </View>
          <View className="bg-neutral-100 dark:bg-white/5 px-2 py-1 rounded-lg border border-neutral-200 dark:border-white/10">
            <Text className="text-[9px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-tighter">
              {item.numero_facture}
            </Text>
          </View>
        </View>

        <View className="space-y-3">
          <View className="flex-row justify-between items-end">
            <View>
              <Text className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Reste à payer</Text>
              <Text className="text-xl font-display font-black text-semantic-red">{formatPrice(remaining)}</Text>
            </View>
            <View className="items-end">
              <Text className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Total Facture</Text>
              <Text className="text-sm font-bold text-primary dark:text-white">{formatPrice(item.montant_total)}</Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View className="h-1.5 w-full bg-neutral-100 dark:bg-white/5 rounded-full overflow-hidden">
            <View 
              className="h-full bg-semantic-green rounded-full"
              style={{ width: `${progress}%` }}
            />
          </View>
          
          <View className="flex-row justify-between">
            <Text className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">
              Payé: {formatPrice(item.montant_paye)}
            </Text>
            <Text className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">
              {Math.round(progress)}%
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-dark-bg">
      {/* Header */}
      <View className="flex-row items-center justify-between bg-white dark:bg-dark-card px-6 py-4 shadow-soft border-b border-neutral-100 dark:border-white/5 pt-6">
        <View className="flex-row items-center">
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            className="p-3 bg-neutral-100 dark:bg-white/5 rounded-2xl mr-4"
          >
            <ChevronLeft size={24} color={isDark ? '#3B82F6' : '#141414'} />
          </TouchableOpacity>
          <View>
            <Text className="text-xs font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[2px] mb-0.5">
              Détails
            </Text>
            <Text className="text-2xl font-display font-black text-primary dark:text-white tracking-tight">
              Créances Clients
            </Text>
          </View>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : (
        <FlatList
          data={factures}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 20 }}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center pt-20">
              <Text className="text-neutral-500 dark:text-neutral-400 font-bold uppercase tracking-widest text-xs">
                Aucune créance trouvée
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
