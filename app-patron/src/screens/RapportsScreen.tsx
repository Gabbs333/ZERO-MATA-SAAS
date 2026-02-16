import React, { useState } from 'react';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';
import { formatMontant } from '../utils/format';
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { BarChart3, Download, Table } from 'lucide-react';

type ReportType = 'ventes' | 'produits' | 'personnel';
type PeriodType = 'jour' | 'semaine' | 'mois' | 'annee';

export function RapportsScreen() {
  const profile = useAuthStore((state) => state.profile);
  const [reportType, setReportType] = useState<ReportType>('ventes');
  const [period, setPeriod] = useState<PeriodType>('mois');
  const [customDate, setCustomDate] = useState<Date>(new Date());

  // Queries based on report type
  const { data: reportData, isLoading } = useSupabaseQuery(
    ['reports', reportType, period, profile?.etablissement_id],
    async () => {
      if (!profile?.etablissement_id) return { data: null, error: null };

      let startDate = new Date();
      let endDate = new Date();

      switch (period) {
        case 'jour':
          startDate = new Date(); // Today 00:00
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(); // Today 23:59
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'semaine':
          startDate = startOfWeek(new Date(), { locale: fr });
          endDate = endOfWeek(new Date(), { locale: fr });
          break;
        case 'mois':
          startDate = startOfMonth(new Date());
          endDate = endOfMonth(new Date());
          break;
        case 'annee':
          startDate = new Date(new Date().getFullYear(), 0, 1);
          endDate = new Date(new Date().getFullYear(), 11, 31);
          break;
      }

      // Simulate API call delay and mock data for now as complex aggregation might require Edge Functions or RPC
      // In a real app, we would call an RPC function like `get_report_sales(start_date, end_date)`
      
      // For demonstration, let's fetch some real data if possible, or use the existing RPCs
      if (reportType === 'ventes') {
        // Use existing analytics RPC if available or fetch raw data
        const { data, error } = await supabase.rpc('get_analytics_ca_encaissements', {
          p_etablissement_id: profile.etablissement_id,
          p_date_debut: startDate.toISOString(),
          p_date_fin: endDate.toISOString(),
          p_intervalle: period === 'mois' ? 'day' : 'day' // Simplified
        });
        return { data, error };
      } else if (reportType === 'produits') {
        const { data, error } = await supabase.rpc('get_ventes_par_produit', {
          p_etablissement_id: profile.etablissement_id,
          p_date_debut: startDate.toISOString(),
          p_date_fin: endDate.toISOString()
        });
        return { data, error };
      }

      return { data: [], error: null };
    },
    { enabled: !!profile?.etablissement_id }
  );

  return (
    <div className="pb-20 md:pb-6 min-h-screen bg-neutral-50 dark:bg-dark-bg transition-colors duration-300">
      <div className="p-4 md:p-6 bg-white dark:bg-dark-card/40 dark:backdrop-blur-xl border-b border-neutral-200 dark:border-white/5 sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-primary dark:text-white font-display mb-2">Rapports & Analyses</h1>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm">
          Générez des rapports détaillés sur votre activité
        </p>
        
        <div className="flex flex-col md:flex-row gap-4 mt-6">
            <div className="flex bg-neutral-100 dark:bg-dark-card/60 p-1 rounded-xl">
                {(['ventes', 'produits', 'personnel'] as const).map(type => (
                    <button
                        key={type}
                        onClick={() => setReportType(type)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            reportType === type 
                            ? 'bg-white dark:bg-dark-accent text-primary dark:text-white shadow-sm' 
                            : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
                        }`}
                    >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                ))}
            </div>

            <div className="flex bg-neutral-100 dark:bg-dark-card/60 p-1 rounded-xl">
                {(['jour', 'semaine', 'mois', 'annee'] as const).map(p => (
                    <button
                        key={p}
                        onClick={() => setPeriod(p)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            period === p 
                            ? 'bg-white dark:bg-dark-accent text-primary dark:text-white shadow-sm' 
                            : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
                        }`}
                    >
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                ))}
            </div>
        </div>
      </div>

      <div className="p-4 md:p-6">
        {isLoading ? (
             <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary dark:border-dark-accent"></div>
                <p className="text-sm text-neutral-500 animate-pulse">Chargement du rapport...</p>
             </div>
        ) : (
            <div className="grid gap-6">
                {/* Placeholder for report visualization */}
                <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 p-8 text-center">
                    <BarChart3 className="w-12 h-12 text-neutral-300 dark:text-white/20 mb-4 mx-auto" />
                    <h3 className="text-lg font-bold text-primary dark:text-white mb-2">
                        Rapport {reportType} - {period}
                    </h3>
                    <p className="text-neutral-500 dark:text-neutral-400 mb-6">
                        Les données sont prêtes à être visualisées ou exportées.
                    </p>
                    
                    <div className="flex justify-center gap-4">
                        <button className="px-4 py-2 bg-primary dark:bg-dark-accent text-white rounded-lg font-bold text-sm flex items-center gap-2 hover:opacity-90 transition-opacity">
                            <Download className="w-5 h-5" />
                            Exporter PDF
                        </button>
                        <button className="px-4 py-2 bg-neutral-100 dark:bg-dark-card/60 text-neutral-700 dark:text-white rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-neutral-200 dark:hover:bg-dark-card/40 transition-all">
                            <Table className="w-5 h-5" />
                            Voir Détails
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
