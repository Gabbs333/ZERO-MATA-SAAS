import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import EtablissementsScreen from './EtablissementsScreen';
import EtablissementDetailScreen from './EtablissementDetailScreen';
import CreateEtablissementScreen from './CreateEtablissementScreen';
import UserListScreen from './UserListScreen';
import SubscriptionScreen from './SubscriptionScreen';
import GlobalStatsScreen from './GlobalStatsScreen';
import { Building2, BarChart3, Plus, Users, CreditCard } from 'lucide-react';

function DashboardHome() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-display font-bold text-neutral-900 dark:text-white mb-2 tracking-tight">
            Tableau de Bord
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-lg">
            Vue d'ensemble de votre activité temps réel
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 bg-white/50 dark:bg-white/5 px-4 py-2 rounded-full border border-neutral-200 dark:border-white/10 backdrop-blur-sm">
           <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-semantic-green opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-semantic-green"></span>
            </span>
            Mise à jour en temps réel
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card Etablissements */}
        <div 
          className="group relative bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl rounded-2xl p-6 flex flex-col cursor-pointer overflow-hidden border border-white/20 dark:border-white/10 hover:border-primary/50 dark:hover:border-primary/50 transition-all duration-300 hover:shadow-glow hover:-translate-y-1"
          onClick={() => navigate('/etablissements')}
        >
          {/* Card Gradient Background on Hover */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          
          <div className="relative z-10 flex items-center justify-between mb-6">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-primary/20 dark:to-blue-900/20 p-3.5 rounded-xl text-primary dark:text-primary-foreground group-hover:scale-110 transition-transform duration-300 shadow-sm ring-1 ring-primary/10">
              <Building2 className="w-7 h-7" />
            </div>
            <div className="h-8 w-8 rounded-full bg-neutral-100 dark:bg-white/5 flex items-center justify-center text-neutral-400 group-hover:text-primary transition-colors">
               <Plus className="w-4 h-4" />
            </div>
          </div>
          
          <h2 className="relative z-10 text-xl font-bold text-neutral-900 dark:text-white mb-2 group-hover:text-primary transition-colors truncate">
            Établissements
          </h2>
          <p className="relative z-10 text-neutral-500 dark:text-neutral-400 text-sm leading-relaxed break-words">
            Gérez la configuration et les accès des points de vente
          </p>
        </div>

        {/* Card Utilisateurs */}
        <div 
          className="group relative bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl rounded-2xl p-6 flex flex-col cursor-pointer overflow-hidden border border-white/20 dark:border-white/10 hover:border-semantic-purple/50 dark:hover:border-semantic-purple/50 transition-all duration-300 hover:shadow-[0_0_20px_rgba(139,92,246,0.15)] hover:-translate-y-1"
          onClick={() => navigate('/utilisateurs')}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-semantic-purple/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

          <div className="relative z-10 flex items-center justify-between mb-6">
            <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 dark:from-semantic-purple/20 dark:to-fuchsia-900/20 p-3.5 rounded-xl text-semantic-purple dark:text-purple-100 group-hover:scale-110 transition-transform duration-300 shadow-sm ring-1 ring-semantic-purple/10 flex-shrink-0">
              <Users className="w-7 h-7" />
            </div>
          </div>
          
          <h2 className="relative z-10 text-xl font-bold text-neutral-900 dark:text-white mb-2 group-hover:text-semantic-purple transition-colors truncate">
            Utilisateurs
          </h2>
          <p className="relative z-10 text-neutral-500 dark:text-neutral-400 text-sm leading-relaxed break-words">
            Administrez les comptes et les permissions
          </p>
        </div>

        {/* Card Abonnements */}
        <div 
          className="group relative bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl rounded-2xl p-6 flex flex-col cursor-pointer overflow-hidden border border-white/20 dark:border-white/10 hover:border-semantic-amber/50 dark:hover:border-semantic-amber/50 transition-all duration-300 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:-translate-y-1"
          onClick={() => navigate('/abonnements')}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-semantic-amber/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

          <div className="relative z-10 flex items-center justify-between mb-6">
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-semantic-amber/20 dark:to-orange-900/20 p-3.5 rounded-xl text-semantic-amber dark:text-amber-100 group-hover:scale-110 transition-transform duration-300 shadow-sm ring-1 ring-semantic-amber/10 flex-shrink-0">
              <CreditCard className="w-7 h-7" />
            </div>
          </div>
          
          <h2 className="relative z-10 text-xl font-bold text-neutral-900 dark:text-white mb-2 group-hover:text-semantic-amber transition-colors truncate">
            Abonnements
          </h2>
          <p className="relative z-10 text-neutral-500 dark:text-neutral-400 text-sm leading-relaxed break-words">
            Suivez les revenus et les statuts de paiement
          </p>
        </div>

        {/* Card Statistiques */}
        <div 
          className="group relative bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl rounded-2xl p-6 flex flex-col cursor-pointer overflow-hidden border border-white/20 dark:border-white/10 hover:border-semantic-green/50 dark:hover:border-semantic-green/50 transition-all duration-300 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:-translate-y-1"
          onClick={() => navigate('/stats')}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-semantic-green/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

          <div className="relative z-10 flex items-center justify-between mb-6">
            <div className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-semantic-green/20 dark:to-emerald-900/20 p-3.5 rounded-xl text-semantic-green dark:text-green-100 group-hover:scale-110 transition-transform duration-300 shadow-sm ring-1 ring-semantic-green/10 flex-shrink-0">
              <BarChart3 className="w-7 h-7" />
            </div>
          </div>
          
          <h2 className="relative z-10 text-xl font-bold text-neutral-900 dark:text-white mb-2 group-hover:text-semantic-green transition-colors truncate">
            Statistiques
          </h2>
          <p className="relative z-10 text-neutral-500 dark:text-neutral-400 text-sm leading-relaxed break-words">
            Analysez les performances globales de la plateforme
          </p>
        </div>
      </div>
    </div>
  );
}

export default function DashboardScreen() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardHome />} />
        <Route path="/etablissements" element={<EtablissementsScreen />} />
        <Route path="/etablissements/nouveau" element={<CreateEtablissementScreen />} />
        <Route path="/etablissements/:id" element={<EtablissementDetailScreen />} />
        <Route path="/utilisateurs" element={<UserListScreen />} />
        <Route path="/abonnements" element={<SubscriptionScreen />} />
        <Route path="/stats" element={<GlobalStatsScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
