import React, { useEffect } from 'react';
import { View } from 'react-native';
import "./global.css";
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LayoutGrid, BarChart3, History as HistoryIcon, User, ShoppingCart } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';

import { LoginScreen } from './src/screens/LoginScreen';
import { TablesScreen } from './src/screens/TablesScreen';
import { CommandeScreen } from './src/screens/CommandeScreen';
import HistoriqueScreen from './src/screens/HistoriqueScreen';
import { OverviewScreen } from './src/screens/OverviewScreen';
import { CreancesDetailsScreen } from './src/screens/CreancesDetailsScreen';
import { useAuthStore } from './src/store/authStore';
import { BrandingOverlay } from './src/components/BrandingOverlay';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabNavigator() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: isDark ? '#0A0A0A' : '#ffffff',
            borderTopWidth: 1,
            borderTopColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
            height: 85,
            paddingBottom: 25,
            paddingTop: 10,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarActiveTintColor: isDark ? '#ffffff' : '#141414',
          tabBarInactiveTintColor: '#94a3b8',
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: 1,
          },
          tabBarIcon: ({ focused, color, size }) => {
            let icon;
            if (route.name === 'OverviewTab') {
              icon = <BarChart3 size={size} color={color} strokeWidth={focused ? 3 : 2} />;
            } else if (route.name === 'TablesTab') {
              icon = <LayoutGrid size={size} color={color} strokeWidth={focused ? 3 : 2} />;
            } else if (route.name === 'CommanderTab') {
              icon = <ShoppingCart size={size} color={color} strokeWidth={focused ? 3 : 2} />;
            } else if (route.name === 'HistoriqueTab') {
              icon = <HistoryIcon size={size} color={color} strokeWidth={focused ? 3 : 2} />;
            }
            return icon;
          },
        })}
      >
        <Tab.Screen 
          name="OverviewTab" 
          component={OverviewScreen} 
          options={{ title: 'Dashboard' }} 
        />
        <Tab.Screen 
          name="TablesTab" 
          component={TablesScreen} 
          options={{ title: 'Tables' }} 
        />
         <Tab.Screen 
          name="CommanderTab" 
          component={CommandeScreen} 
          options={{ title: 'Commander' }}
          initialParams={{ tableNumero: undefined }} 
        />
        <Tab.Screen 
          name="HistoriqueTab" 
          component={HistoriqueScreen} 
          options={{ title: 'Historique' }} 
        />
      </Tab.Navigator>
      <BrandingOverlay />
    </View>
  );
}

// Configure TanStack Query with offline support
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      networkMode: 'offlineFirst',
    },
  },
});

export default function App() {
  const { session, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer>
        <StatusBar style="auto" />
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
          }}
        >
          {!session ? (
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
          ) : (
            <>
              <Stack.Screen
                name="Main"
                component={TabNavigator}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Commande"
                component={CommandeScreen}
                options={{ title: 'Nouvelle Commande' }}
              />
              <Stack.Screen
                name="CreancesDetails"
                component={CreancesDetailsScreen}
                options={{ title: 'Détails des Créances' }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </QueryClientProvider>
  );
}
