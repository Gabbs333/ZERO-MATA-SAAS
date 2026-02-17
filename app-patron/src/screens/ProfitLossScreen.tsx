import { useState, useMemo } from 'react';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';
import { formatMontant } from '../utils/format';
import { 
  startOfMonth, 
  endOfMonth, 
  startOfYear, 
  endOfYear,
  format, 
  subMonths, 
  addMonths
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  ChevronLeft,
  ChevronRight,
  Package,
  AlertTriangle,
  TrendingUp,
  ShoppingCart,
  Layers,
} from 'lucide-react';

type PeriodType = 'month' | 'year';

// Interfaces for fetched data
interface SoldItem {
  quantite: number;
  prix_unitaire: number; // Selling price at time of sale
  produit_id: string;
  produits: {
    nom: string;
    prix_achat: number; // Current cost price
    categorie: string;
  };
  commandes: {
    date_creation: string;
  };
}

interface StockItem {
  quantite_actuelle: number;
  produits: {
    nom: string;
    prix_achat: number;
    categorie: string;
    prix_vente: number;
  };
}

interface MovementItem {
  quantite: number;
  type: 'entree' | 'sortie';
  type_reference: 'commande' | 'ravitaillement' | 'ajustement';
  produits: {
    nom: string;
    prix_achat: number;
  };
}

export function ProfitLossScreen() {
  const profile = useAuthStore((state) => state.profile);
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [currentDate, setCurrentDate] = useState(new Date());

  const period = useMemo(() => {
    if (periodType === 'month') {
      return {
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate)
      };
    } else {
      return {
        start: startOfYear(currentDate),
        end: endOfYear(currentDate)
      };
    }
  }, [periodType, currentDate]);

  // 1. Fetch Sold Items (for Margin & Top Products)
  const { data: soldItems, isLoading: soldLoading } = useSupabaseQuery<SoldItem[]>(
    ['sold_items_analysis', periodType, currentDate, profile?.etablissement_id],
    async () => {
      if (!profile?.etablissement_id) return { data: [], error: null };
      
      const { data, error } = await supabase
        .from('commande_items')
        .select(`
          quantite,
          prix_unitaire,
          produit_id,
          produits (
            nom,
            prix_achat,
            categorie
          ),
          commandes!inner (
            date_creation
          )
        `)
        .eq('etablissement_id', profile.etablissement_id)
        .gte('commandes.date_creation', period.start.toISOString())
        .lte('commandes.date_creation', period.end.toISOString());

      return { data: (data as any) || [], error };
    },
    { enabled: !!profile?.etablissement_id }
  );

  // 2. Fetch Current Stock (Snapshot - not affected by date filter usually, but good for "Current Value")
  const { data: stockItems, isLoading: stockLoading } = useSupabaseQuery<StockItem[]>(
    ['current_stock_analysis', profile?.etablissement_id],
    async () => {
      if (!profile?.etablissement_id) return { data: [], error: null };
      
      const { data, error } = await supabase
        .from('stocks')
        .select(`
          quantite_actuelle,
          produits (
            nom,
            prix_achat,
            categorie,
            prix_vente
          )
        `)
        .eq('etablissement_id', profile.etablissement_id);

      return { data: (data as any) || [], error };
    },
    { enabled: !!profile?.etablissement_id }
  );

  // 3. Fetch Stock Movements (for Losses/Shrinkage)
  const { data: movements, isLoading: movementsLoading } = useSupabaseQuery<MovementItem[]>(
    ['stock_movements_analysis', periodType, currentDate, profile?.etablissement_id],
    async () => {
      if (!profile?.etablissement_id) return { data: [], error: null };
      
      const { data, error } = await supabase
        .from('mouvements_stock')
        .select(`
          quantite,
          type,
          type_reference,
          produits (
            nom,
            prix_achat
          )
        `)
        .eq('etablissement_id', profile.etablissement_id)
        .eq('type_reference', 'ajustement') // Focus on adjustments (often losses/corrections)
        .gte('date_creation', period.start.toISOString())
        .lte('date_creation', period.end.toISOString());

      return { data: (data as any) || [], error };
    },
    { enabled: !!profile?.etablissement_id }
  );

  // --- Calculations ---

  const metrics = useMemo(() => {
    if (!soldItems || !stockItems || !movements) return null;

    // 1. Stock Value (Current)
    const stockValue = stockItems.reduce((sum, item) => {
      const cost = item.produits?.prix_achat || 0;
      return sum + (item.quantite_actuelle * cost);
    }, 0);

    const stockPotentialRevenue = stockItems.reduce((sum, item) => {
        const price = item.produits?.prix_vente || 0;
        return sum + (item.quantite_actuelle * price);
    }, 0);

    // 2. Losses (Shrinkage)
    // Assuming negative adjustments are losses.
    const lossesValue = movements.reduce((sum, m) => {
      if (m.quantite < 0) {
        const cost = m.produits?.prix_achat || 0;
        return sum + (Math.abs(m.quantite) * cost);
      }
      return sum;
    }, 0);

    // 3. Product Performance
    const productStats = new Map<string, { nom: string; sold: number; revenue: number; margin: number }>();

    let totalRevenue = 0;
    let totalMargin = 0;
    let totalItemsSold = 0;

    soldItems.forEach(item => {
      const pid = item.produit_id;
      const name = item.produits?.nom || 'Inconnu';
      const cost = item.produits?.prix_achat || 0;
      const price = item.prix_unitaire;
      const qty = item.quantite;

      const revenue = qty * price;
      const margin = qty * (price - cost);

      totalRevenue += revenue;
      totalMargin += margin;
      totalItemsSold += qty;

      const existing = productStats.get(pid) || { nom: name, sold: 0, revenue: 0, margin: 0 };
      productStats.set(pid, {
        nom: name,
        sold: existing.sold + qty,
        revenue: existing.revenue + revenue,
        margin: existing.margin + margin
      });
    });

    // Top Products by Margin
    const topMarginProducts = Array.from(productStats.values())
      .sort((a, b) => b.margin - a.margin)
      .slice(0, 5);
    
    // Top Products by Volume
    const topVolumeProducts = Array.from(productStats.values())
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 5);

    // Average Basket (Approximation: Total Revenue / Number of Unique Orders? 
    // We fetched items, not orders count. But we can count unique dates or just use items count? 
    // To be accurate, we'd need count of distinct commande_id.
    // Let's approximate or skip "Panier Moyen" if distinct count is hard on this dataset.
    // Actually, let's just do "Marge Moyenne par Article" instead.)
    const avgMarginPerItem = totalItemsSold > 0 ? totalMargin / totalItemsSold : 0;

    // Stock Distribution by Category (Value)
    const stockByCategory = new Map<string, number>();
    stockItems.forEach(item => {
        const cat = item.produits?.categorie || 'Autre';
        const val = item.quantite_actuelle * (item.produits?.prix_achat || 0);
        stockByCategory.set(cat, (stockByCategory.get(cat) || 0) + val);
    });
    
    const stockDistribution = Array.from(stockByCategory.entries()).map(([name, value]) => ({ name, value }));

    return {
      stockValue,
      stockPotentialRevenue,
      lossesValue,
      topMarginProducts,
      topVolumeProducts,
      stockDistribution,
      totalMargin,
      avgMarginPerItem
    };
  }, [soldItems, stockItems, movements]);

  const handlePrevPeriod = () => {
    setCurrentDate(prev => periodType === 'month' ? subMonths(prev, 1) : subMonths(prev, 12));
  };

  const handleNextPeriod = () => {
    setCurrentDate(prev => periodType === 'month' ? addMonths(prev, 1) : addMonths(prev, 12));
  };

  const isLoading = soldLoading || stockLoading || movementsLoading;

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  return (
    <div className="pb-20 md:pb-6 min-h-screen bg-neutral-50 dark:bg-dark-bg transition-colors duration-300">
      {/* Header */}
      <div className="p-4 md:p-6 bg-white dark:bg-dark-card/40 dark:backdrop-blur-xl border-b border-neutral-200 dark:border-white/5 sticky top-0 z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary dark:text-white font-display">Analyse Performance</h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">
              Analyse du stock et de la rentabilité produits
            </p>
          </div>
          
          <div className="flex items-center gap-2 bg-neutral-100 dark:bg-dark-card/60 p-1 rounded-lg self-start md:self-auto">
             <button 
                onClick={() => setPeriodType('month')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                    periodType === 'month' 
                    ? 'bg-white dark:bg-dark-accent text-primary dark:text-white shadow-sm' 
                    : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
                }`}
             >
                Mensuel
             </button>
             <button 
                onClick={() => setPeriodType('year')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                    periodType === 'year' 
                    ? 'bg-white dark:bg-dark-accent text-primary dark:text-white shadow-sm' 
                    : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
                }`}
             >
                Annuel
             </button>
          </div>
        </div>

        {/* Date Navigator */}
        <div className="mt-6 flex items-center justify-between bg-neutral-50 dark:bg-dark-card/60 p-3 rounded-xl border border-neutral-200 dark:border-white/5">
            <button onClick={handlePrevPeriod} className="p-2 hover:bg-white dark:hover:bg-dark-card/40 rounded-lg transition-colors group">
                <ChevronLeft className="w-5 h-5 text-neutral-600 dark:text-neutral-400 group-hover:text-primary dark:group-hover:text-dark-accent" />
            </button>
            <span className="font-bold text-primary dark:text-white text-lg capitalize">
                {format(currentDate, periodType === 'month' ? 'MMMM yyyy' : 'yyyy', { locale: fr })}
            </span>
            <button onClick={handleNextPeriod} className="p-2 hover:bg-white dark:hover:bg-dark-card/40 rounded-lg transition-colors group">
                <ChevronRight className="w-5 h-5 text-neutral-600 dark:text-neutral-400 group-hover:text-primary dark:group-hover:text-dark-accent" />
            </button>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-6">
        {isLoading || !metrics ? (
             <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary dark:border-dark-accent"></div>
                <p className="text-sm text-neutral-500 animate-pulse">Calcul des indicateurs...</p>
             </div>
        ) : (
            <>
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Stock Value */}
                    <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md p-4 rounded-xl border border-neutral-200 dark:border-white/5 shadow-soft">
                        <div className="flex items-center gap-2 mb-2 text-neutral-500 dark:text-neutral-400">
                            <Package className="w-5 h-5" />
                            <span className="text-xs font-bold uppercase tracking-wider">Valeur Stock (Achat)</span>
                        </div>
                        <p className="text-2xl font-bold text-primary dark:text-white">
                            {formatMontant(metrics.stockValue)}
                        </p>
                        <p className="text-xs text-neutral-400 mt-1">
                            Valeur potentielle vente: {formatMontant(metrics.stockPotentialRevenue)}
                        </p>
                    </div>

                    {/* Losses/Shrinkage */}
                    <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md p-4 rounded-xl border border-neutral-200 dark:border-white/5 shadow-soft">
                        <div className="flex items-center gap-2 mb-2 text-neutral-500 dark:text-neutral-400">
                            <AlertTriangle className="w-5 h-5" />
                            <span className="text-xs font-bold uppercase tracking-wider">Pertes & Avaries</span>
                        </div>
                        <p className={`text-2xl font-bold ${metrics.lossesValue > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                            {formatMontant(metrics.lossesValue)}
                        </p>
                        <p className="text-xs text-neutral-400 mt-1">
                            Sur la période sélectionnée
                        </p>
                    </div>

                    {/* Avg Margin Per Item */}
                    <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md p-4 rounded-xl border border-neutral-200 dark:border-white/5 shadow-soft">
                        <div className="flex items-center gap-2 mb-2 text-neutral-500 dark:text-neutral-400">
                            <TrendingUp className="w-5 h-5" />
                            <span className="text-xs font-bold uppercase tracking-wider">Marge Moyenne / Art.</span>
                        </div>
                        <p className="text-2xl font-bold text-emerald-500">
                            {formatMontant(metrics.avgMarginPerItem)}
                        </p>
                        <p className="text-xs text-neutral-400 mt-1">
                           Marge brute moyenne par article vendu
                        </p>
                    </div>

                     {/* Total Margin (Period) */}
                     <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md p-4 rounded-xl border border-neutral-200 dark:border-white/5 shadow-soft">
                        <div className="flex items-center gap-2 mb-2 text-neutral-500 dark:text-neutral-400">
                            <Layers className="w-5 h-5" />
                            <span className="text-xs font-bold uppercase tracking-wider">Marge Brute Période</span>
                        </div>
                        <p className="text-2xl font-bold text-emerald-500">
                            {formatMontant(metrics.totalMargin)}
                        </p>
                         <p className="text-xs text-neutral-400 mt-1">
                            Sur la période sélectionnée
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Top Products by Margin Chart */}
                    <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md p-4 rounded-xl border border-neutral-200 dark:border-white/5 shadow-soft h-[400px]">
                        <h3 className="text-lg font-bold text-primary dark:text-white mb-6">Top 5 Produits (Marge Générée)</h3>
                        <ResponsiveContainer width="100%" height="90%">
                            <BarChart data={metrics.topMarginProducts} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={document.documentElement.classList.contains('dark') ? '#ffffff10' : '#E5E5E5'} />
                                <XAxis type="number" hide />
                                <YAxis 
                                    dataKey="nom" 
                                    type="category" 
                                    width={100}
                                    tick={{ fill: '#9CA3AF', fontSize: 11 }} 
                                />
                                <Tooltip 
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    contentStyle={{ 
                                      backgroundColor: document.documentElement.classList.contains('dark') ? '#0F172A' : '#FFFFFF',
                                      borderRadius: '12px', 
                                      border: 'none', 
                                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' 
                                    }}
                                    itemStyle={{ color: document.documentElement.classList.contains('dark') ? '#FFFFFF' : '#000000' }}
                                    formatter={(value: number) => formatMontant(value)}
                                />
                                <Bar dataKey="margin" name="Marge" fill="#10B981" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Stock Distribution Pie Chart */}
                    <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md p-4 rounded-xl border border-neutral-200 dark:border-white/5 shadow-soft h-[400px]">
                         <h3 className="text-lg font-bold text-primary dark:text-white mb-6">Répartition Valeur Stock</h3>
                         <ResponsiveContainer width="100%" height="90%">
                            <PieChart>
                                <Pie
                                    data={metrics.stockDistribution}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {metrics.stockDistribution.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                     contentStyle={{ 
                                      backgroundColor: document.documentElement.classList.contains('dark') ? '#0F172A' : '#FFFFFF',
                                      borderRadius: '12px', 
                                      border: 'none', 
                                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' 
                                    }}
                                    itemStyle={{ color: document.documentElement.classList.contains('dark') ? '#FFFFFF' : '#000000' }}
                                    formatter={(value: number) => formatMontant(value)}
                                />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Detailed Top Products List (Volume vs Margin) */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md p-4 rounded-xl border border-neutral-200 dark:border-white/5 shadow-soft">
                        <h3 className="text-lg font-bold text-primary dark:text-white mb-4 flex items-center gap-2">
                            <ShoppingCart className="w-5 h-5 text-blue-500" />
                            Top Volumes (Unités)
                        </h3>
                        <div className="space-y-3">
                            {metrics.topVolumeProducts.map((p, i) => (
                                <div key={i} className="flex justify-between items-center p-2 hover:bg-neutral-50 dark:hover:bg-white/5 rounded-lg transition-colors">
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-bold text-neutral-400 w-4">#{i+1}</span>
                                        <span className="text-sm font-medium text-primary dark:text-white">{p.nom}</span>
                                    </div>
                                    <span className="text-sm font-bold text-blue-500">{p.sold} unités</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md p-4 rounded-xl border border-neutral-200 dark:border-white/5 shadow-soft">
                        <h3 className="text-lg font-bold text-primary dark:text-white mb-4 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-emerald-500" />
                            Top Rentabilité (Marge)
                        </h3>
                        <div className="space-y-3">
                            {metrics.topMarginProducts.map((p, i) => (
                                <div key={i} className="flex justify-between items-center p-2 hover:bg-neutral-50 dark:hover:bg-white/5 rounded-lg transition-colors">
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-bold text-neutral-400 w-4">#{i+1}</span>
                                        <span className="text-sm font-medium text-primary dark:text-white">{p.nom}</span>
                                    </div>
                                    <span className="text-sm font-bold text-emerald-500">{formatMontant(p.margin)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                 </div>
            </>
        )}
      </div>
    </div>
  );
}
