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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3, // Increase retries further
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 60 * 1000, // Back to 60s to avoid unnecessary fetches if data is fresh enough
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      refetchOnReconnect: true,
      // networkMode removed to allow default behavior (pauses when offline)
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
      // Seulement si on est en ligne
      if (navigator.onLine && document.visibilityState === 'visible') {
        console.log('App active and online, verifying state...');
        
        // Petit délai pour laisser la connexion se stabiliser
        setTimeout(() => {
          supabase.auth.getSession().then(({ data: { session: currentSession }, error }) => {
            if (!currentSession || error) {
              console.warn('Session invalid, letting auth store handle it');
            } else {
              // Invalider force le rechargement même si les données sont "fresh" (staleTime)
              // C'est crucial pour le retour sur l'app
              queryClient.invalidateQueries({ type: 'active' });
              console.log('Active queries invalidated and refetching...');
            }
          });
        }, 500);
      }
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
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
