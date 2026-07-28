import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from './store/authStore';
import { supabase } from './config/supabase';
import Layout from './components/Layout';
import LoginScreen from './screens/LoginScreen';
import ValidationScreen from './screens/ValidationScreen';
import FacturesScreen from './screens/FacturesScreen';
import HistoryScreen from './screens/HistoryScreen';
import StockScreen from './screens/StockScreen';
import { RetoursScreen } from './screens/RetoursScreen';
import { EchangesScreen } from './screens/EchangesScreen';
import { ClientsScreen } from './screens/ClientsScreen';
import { CaisseScreen } from './screens/CaisseScreen';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 10000),
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,  // Prevent cascading refetches on tab return
      refetchOnMount: true,
      refetchOnReconnect: true,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark transition-colors">
        <Loader2 className="w-8 h-8 text-primary dark:text-white animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
}

function App() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    initialize();

    // Gestionnaire de visibilité et de connexion
    const handleReconnection = () => {
      if (!navigator.onLine) return;
      if (document.visibilityState !== 'visible') return;

      console.log('App active, reconnecting...');

      // Refresh auth session first, then revalidate data
      supabase.auth.getSession().then(({ data: { session: currentSession }, error }) => {
        if (error || !currentSession) {
          console.warn('Session refresh failed on reconnection');
          return;
        }
        // Invalidate stale queries to force refetch on next render
        queryClient.invalidateQueries();
        console.log('Reconnection: queries invalidated');
      }).catch(err => {
        console.warn('Reconnection error:', err);
      });
    };

    document.addEventListener('visibilitychange', handleReconnection);
    window.addEventListener('focus', handleReconnection);
    window.addEventListener('online', handleReconnection);

    return () => {
      document.removeEventListener('visibilitychange', handleReconnection);
      window.removeEventListener('focus', handleReconnection);
      window.removeEventListener('online', handleReconnection);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <ValidationScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/factures"
            element={
              <ProtectedRoute>
                <FacturesScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/historique"
            element={
              <ProtectedRoute>
                <HistoryScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stock"
            element={
              <ProtectedRoute>
                <StockScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/caisse"
            element={
              <ProtectedRoute>
                <CaisseScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/clients"
            element={
              <ProtectedRoute>
                <ClientsScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/echanges"
            element={
              <ProtectedRoute>
                <EchangesScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/retours"
            element={
              <ProtectedRoute>
                <RetoursScreen />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
