import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Loader2,
  Package,
  Search
} from 'lucide-react';
import { useStock, useStockAlerts } from '../hooks/useSupabaseQuery';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import type { StockWithProduit } from '../types/database.types';
import { cn } from '../lib/utils';

export default function StockScreen() {
  const { data: stock, isLoading } = useStock();
  const { data: alertes } = useStockAlerts();
  const [searchTerm, setSearchTerm] = useState('');

  // Synchronisation temps réel
  useRealtimeSubscription('stocks', '*');

  const totalItems = stock?.reduce((sum, item) => sum + item.quantite_actuelle, 0) || 0;
  const alertCount = alertes?.length || 0;

  const filteredStock = stock?.filter(item => 
    item.produits.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.produits.categorie.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh] bg-background-light dark:bg-background-dark transition-colors">
        <Loader2 className="w-8 h-8 animate-spin text-primary dark:text-white" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-primary dark:text-white mb-2">
            Inventaire
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-lg">
            Vue d'ensemble et gestion du stock en temps réel
          </p>
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
             <div className="flex items-center gap-2 px-4 py-2 bg-white/50 dark:bg-neutral-800/50 rounded-full border border-neutral-200 dark:border-neutral-700 backdrop-blur-sm">
                <Package size={16} className="text-neutral-500 dark:text-neutral-400" />
                <span className="font-bold text-primary dark:text-white">{totalItems}</span>
                <span className="text-sm text-neutral-500 dark:text-neutral-400">produits</span>
             </div>
        </div>
      </div>

      {/* Stats Grid - Aligned with GlobalStatsScreen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-white/10 p-6 flex flex-col group hover:-translate-y-1 transition-all duration-300 overflow-hidden relative">
          {/* Background Decoration */}
          <div className="absolute top-0 right-0 p-24 bg-primary/5 rounded-full blur-3xl -mr-12 -mt-12 pointer-events-none transition-all duration-300 group-hover:bg-primary/10"></div>
          
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="p-3 bg-gradient-to-br from-primary to-blue-600 rounded-xl shadow-lg shadow-primary/20 text-white group-hover:scale-110 transition-transform duration-300 shrink-0">
              <Package size={24} />
            </div>
            <span className="text-xs font-bold text-primary dark:text-blue-400 uppercase tracking-normal bg-primary/10 px-2 py-1 rounded-lg ml-2 whitespace-nowrap">Total Produits</span>
          </div>
          <p className="text-3xl sm:text-4xl font-display font-bold text-neutral-900 dark:text-white mb-1 truncate relative z-10">
            {totalItems}
          </p>
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 relative z-10">
            En stock
          </p>
        </div>

        <div className={cn(
          "bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-white/10 p-6 flex flex-col group hover:-translate-y-1 transition-all duration-300 overflow-hidden relative",
          alertCount > 0 
            ? "border-semantic-amber/30 dark:border-semantic-amber/30"
            : "border-emerald-500/30 dark:border-emerald-500/30"
        )}>
          {/* Background Decoration */}
          <div className={cn(
              "absolute top-0 right-0 p-24 rounded-full blur-3xl -mr-12 -mt-12 pointer-events-none transition-all duration-300",
              alertCount > 0 
                  ? "bg-semantic-amber/5 group-hover:bg-semantic-amber/10" 
                  : "bg-emerald-500/5 group-hover:bg-emerald-500/10"
          )}></div>

          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className={cn(
              "p-3 rounded-xl shadow-lg text-white group-hover:scale-110 transition-transform duration-300 shrink-0",
              alertCount > 0 
                ? "bg-gradient-to-br from-semantic-amber to-orange-600 shadow-semantic-amber/20" 
                : "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/20"
            )}>
              {alertCount > 0 ? <AlertTriangle size={24} /> : <CheckCircle size={24} />}
            </div>
            <span className={cn(
              "text-xs font-bold uppercase tracking-normal px-2 py-1 rounded-lg ml-2 whitespace-nowrap",
              alertCount > 0 
                ? "text-semantic-amber bg-semantic-amber/10" 
                : "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
            )}>
              {alertCount > 0 ? "Alertes Stock" : "Stock Sain"}
            </span>
          </div>
          <div className="flex items-baseline gap-2 relative z-10">
             <p className="text-3xl sm:text-4xl font-display font-bold text-neutral-900 dark:text-white mb-1 truncate">
                {alertCount}
             </p>
             {alertCount > 0 ? (
                <span className="text-xs font-bold text-semantic-amber bg-semantic-amber/10 px-2 py-1 rounded-full animate-pulse">
                    Critique
                </span>
             ) : (
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">
                    Optimal
                </span>
             )}
          </div>
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 relative z-10">
            {alertCount > 0 ? "Produits en rupture ou seuil bas" : "Tous les niveaux sont corrects"}
          </p>
        </div>
      </div>

      {/* List Section - Table Format */}
      <div className="space-y-4">
        <div className="relative flex-grow group max-w-md">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-neutral-400 group-focus-within:text-primary dark:group-focus-within:text-white transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Rechercher un produit..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-11 pr-4 py-3 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary dark:focus:border-white text-neutral-900 dark:text-white placeholder-neutral-400 transition-all shadow-sm group-hover:shadow-md"
          />
        </div>

        <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 dark:border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: '800px' }}>
              <thead>
                <tr className="border-b border-neutral-200 dark:border-white/5 bg-neutral-50/50 dark:bg-white/5">
                  <th className="px-6 py-5 text-left text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Produit</th>
                  <th className="px-6 py-5 text-left text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Catégorie</th>
                  <th className="px-6 py-5 text-right text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Quantité</th>
                  <th className="px-6 py-5 text-center text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-white/5">
                {filteredStock?.length === 0 ? (
                    <tr>
                        <td colSpan={4} className="px-6 py-16 text-center">
                            <div className="flex flex-col items-center justify-center">
                                <div className="w-16 h-16 bg-neutral-100 dark:bg-white/5 rounded-2xl flex items-center justify-center mb-4">
                                    <Package className="w-8 h-8 text-neutral-400" />
                                </div>
                                <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Aucun produit trouvé</h3>
                                <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">
                                    Essayez de modifier votre recherche.
                                </p>
                            </div>
                        </td>
                    </tr>
                ) : (
                    filteredStock?.map((item: StockWithProduit) => {
                      const stockBas = item.quantite_actuelle <= item.seuil_alerte;
                      return (
                        <tr key={item.id} className="group hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors">
                          <td className="px-6 py-5 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-gradient-to-br from-primary/10 to-blue-500/10 dark:from-white/10 dark:to-white/5 flex items-center justify-center text-primary dark:text-white font-bold ring-1 ring-black/5 dark:ring-white/10 shadow-sm group-hover:scale-110 transition-transform duration-200">
                                <Package size={20} />
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-bold text-neutral-900 dark:text-white group-hover:text-primary dark:group-hover:text-white transition-colors">
                                  {item.produits.nom}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap">
                            <span className="px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-white/10">
                              {item.produits.categorie}
                            </span>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap text-right">
                            <span className={cn(
                                "text-lg font-bold font-display tabular-nums",
                                stockBas ? "text-semantic-amber" : "text-neutral-900 dark:text-white"
                            )}>
                                {item.quantite_actuelle}
                            </span>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap text-center">
                             {stockBas ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-semantic-amber/10 text-semantic-amber border border-semantic-amber/20 animate-pulse">
                                    <AlertTriangle size={12} />
                                    Critique
                                </span>
                             ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-semantic-green/10 text-semantic-green border border-semantic-green/20">
                                    <span className="w-1.5 h-1.5 rounded-full bg-semantic-green"></span>
                                    En Stock
                                </span>
                             )}
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}