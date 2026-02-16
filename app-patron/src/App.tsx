import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { Layout } from './components/Layout';
import { LoginScreen } from './screens/LoginScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { StockScreen } from './screens/StockScreen';
import { FinancialDashboardScreen } from './screens/FinancialDashboardScreen';
import { RavitaillementScreen } from './screens/RavitaillementScreen';
import { SupplyHistoryScreen } from './screens/SupplyHistoryScreen';
import { ProduitsScreen } from './screens/ProduitsScreen';
import { TablesScreen } from './screens/TablesScreen';
import { ProfitLossScreen } from './screens/ProfitLossScreen';
import { CreancesScreen } from './screens/CreancesScreen';
import { RapportsScreen } from './screens/RapportsScreen';
import { UtilisateursScreen } from './screens/UtilisateursScreen';
import { TransactionsScreen } from './screens/TransactionsScreen';
import { AuditLogScreen } from './screens/AuditLogScreen';
import { UserProfileScreen } from './screens/UserProfileScreen';
import { SystemActivityScreen } from './screens/SystemActivityScreen';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-neutral-50 dark:bg-dark-bg transition-colors duration-500 gap-4">
        <div className="relative">
          <div className="size-16 rounded-full border-4 border-primary/10 dark:border-white/5 border-t-primary dark:border-t-dark-accent animate-spin"></div>
        </div>
        <p className="text-neutral-500 dark:text-neutral-400 font-medium animate-pulse">Chargement de votre espace...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
}

function App() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardScreen />
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
          path="/finances"
          element={
            <ProtectedRoute>
              <FinancialDashboardScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ravitaillements"
          element={
            <ProtectedRoute>
              <RavitaillementScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ravitaillements/historique"
          element={
            <ProtectedRoute>
              <SupplyHistoryScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/produits"
          element={
            <ProtectedRoute>
              <ProduitsScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tables"
          element={
            <ProtectedRoute>
              <TablesScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profits"
          element={
            <ProtectedRoute>
              <ProfitLossScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/creances"
          element={
            <ProtectedRoute>
              <CreancesScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/rapports"
          element={
            <ProtectedRoute>
              <RapportsScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/utilisateurs"
          element={
            <ProtectedRoute>
              <UtilisateursScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/transactions"
          element={
            <ProtectedRoute>
              <TransactionsScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/audit"
          element={
            <ProtectedRoute>
              <AuditLogScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profil"
          element={
            <ProtectedRoute>
              <UserProfileScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/activite"
          element={
            <ProtectedRoute>
              <SystemActivityScreen />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
