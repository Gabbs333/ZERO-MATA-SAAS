import { useState, useMemo } from 'react';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { useAuthStore } from '../store/authStore';
import { formatMontant } from '../utils/format';
import { supabase } from '../config/supabase';
import { useNavigate } from 'react-router-dom';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { 
  startOfMonth, 
  endOfMonth, 
  subMonths, 
  format, 
  subDays, 
  eachDayOfInterval, 
  isSameDay, 
  parseISO,
  startOfDay,
  endOfDay
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  Banknote, 
  Wallet, 
  ShoppingCart, 
  TrendingUp, 
  AlertTriangle 
} from 'lucide-react';

interface AnalyticsData {
  dateFormatted: string;
  ca: number;
  encaissements: number;
  marge_brute: number;
}

export function FinancialDashboardScreen() {
  const profile = useAuthStore((state) => state.profile);
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<'30days' | 'thisMonth' | 'lastMonth'>('30days');

  const dateRangeValues = useMemo(() => {
    const now = new Date();
    switch (dateRange) {
      case '30days':
        return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
      case 'thisMonth':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'lastMonth': {
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      }
    }
  }, [dateRange]);

  const { start, end } = dateRangeValues;

  // 1. Fetch Commandes with Items and Product Purchase Price for Gross Margin
  const { data: commandesData, isLoading: cmdLoading } = useSupabaseQuery(
    ['financial_commandes', start.toISOString(), end.toISOString()],
    async () => {
      const { data, error } = await supabase
        .from('commandes')
        .select('*, commande_items(*, produits(prix_achat))')
        .eq('etablissement_id', profile?.etablissement_id)
        .neq('statut', 'annulee')
        .neq('statut', 'en_attente')
        .gte('date_creation', start.toISOString())
        .lte('date_creation', end.toISOString())
        .limit(2000);

      if (error) throw error;
      return { data: data || [], error: null };
    },
    { enabled: !!profile?.etablissement_id }
  );

  // 2. Fetch Encaissements
  const { data: encaissementsData, isLoading: encLoading } = useSupabaseQuery(
    ['financial_encaissements', start.toISOString(), end.toISOString()],
    async () => {
      const { data, error } = await supabase
        .from('encaissements')
        .select('*')
        .eq('etablissement_id', profile?.etablissement_id)
        .gte('date_encaissement', start.toISOString())
        .lte('date_encaissement', end.toISOString())
        .limit(5000);
      
      if (error) throw error;
      return { data: data || [], error: null };
    },
    { enabled: !!profile?.etablissement_id }
  );

  // 3. Fetch Ravitaillements (Display Only)
  const { data: suppliesData, isLoading: suppliesLoading } = useSupabaseQuery(
    ['financial_supplies', start.toISOString(), end.toISOString()],
    async () => {
      const { data, error } = await supabase
        .from('ravitaillements')
        .select('montant_total, date_ravitaillement')
        .eq('etablissement_id', profile?.etablissement_id)
        .gte('date_ravitaillement', start.toISOString())
        .lte('date_ravitaillement', end.toISOString());
      
      if (error) throw error;
      return { data: data || [], error: null };
    },
    { enabled: !!profile?.etablissement_id }
  );

  // 4. Calculate Metrics
  const metrics = useMemo(() => {
    const cmds = commandesData || [];
    const encs = encaissementsData || [];
    const supplies = suppliesData || [];

    // Turnover (CA)
    const chiffre_affaires = cmds.reduce((sum, cmd) => sum + cmd.montant_total, 0);

    // Collections (Encaissements)
    const encaissements = encs.reduce((sum, enc) => sum + enc.montant, 0);

    // Supplies Total
    const ravitaillements = supplies.reduce((sum, sup) => sum + sup.montant_total, 0);

    // Gross Margin (Marge Brute)
    // CA - (Quantity * Purchase Price)
    let cout_achat_total = 0;
    cmds.forEach(cmd => {
      cmd.commande_items.forEach((item: any) => {
        const prix_achat = item.produits?.prix_achat || 0;
        cout_achat_total += item.quantite * prix_achat;
      });
    });
    const marge_brute = chiffre_affaires - cout_achat_total;

    // Shortfall (Manque à Gagner)
    const manque_a_gagner = chiffre_affaires - encaissements;

    return {
      chiffre_affaires,
      encaissements,
      ravitaillements,
      marge_brute,
      manque_a_gagner
    };
  }, [commandesData, encaissementsData, suppliesData]);

  // 5. Prepare Chart Data
  const chartData = useMemo(() => {
    // Generate intervals regardless of data presence to ensure chart X-axis is correct
    const intervals = eachDayOfInterval({ start, end });
    
    return intervals.map(date => {
      // Use YYYY-MM-DD string comparison to avoid timezone issues
      const dateStr = format(date, 'yyyy-MM-dd');
      
      const dayCA = (commandesData || [])
        .filter(c => format(parseISO(c.date_creation), 'yyyy-MM-dd') === dateStr)
        .reduce((sum, c) => sum + c.montant_total, 0);

      const dayEnc = (encaissementsData || [])
        .filter(e => format(parseISO(e.date_encaissement), 'yyyy-MM-dd') === dateStr)
        .reduce((sum, e) => sum + e.montant, 0);
        
      // Daily Gross Margin
      let dayCost = 0;
      (commandesData || [])
        .filter(c => format(parseISO(c.date_creation), 'yyyy-MM-dd') === dateStr)
        .forEach(c => {
          c.commande_items.forEach((item: any) => {
             dayCost += item.quantite * (item.produits?.prix_achat || 0);
          });
        });

      return {
        dateFormatted: format(date, 'dd MMM', { locale: fr }),
        ca: dayCA,
        encaissements: dayEnc,
        marge_brute: dayCA - dayCost
      };
    });
  }, [commandesData, encaissementsData, start, end]);

  const isLoading = cmdLoading || encLoading || suppliesLoading;

  return (
    <div className="pb-20 md:pb-6 min-h-screen bg-neutral-50 dark:bg-dark-bg">
      {/* Header */}
      <div className="sticky top-[65px] z-30 p-4 md:p-6 bg-white/80 dark:bg-dark-card/80 backdrop-blur-xl border-b border-neutral-200 dark:border-white/5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary dark:text-white font-display">Vue Financière</h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">
              Suivez vos revenus, dépenses et rentabilité
            </p>
          </div>

          <div className="flex p-1 bg-neutral-100 dark:bg-dark-card/40 rounded-lg self-start md:self-auto overflow-x-auto">
            <button 
              onClick={() => setDateRange('30days')}
              className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all whitespace-nowrap ${
                dateRange === '30days' 
                  ? 'bg-white dark:bg-dark-accent text-primary dark:text-white shadow-sm' 
                  : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              30 derniers jours
            </button>
            <button 
              onClick={() => setDateRange('thisMonth')}
              className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all whitespace-nowrap ${
                dateRange === 'thisMonth' 
                  ? 'bg-white dark:bg-dark-accent text-primary dark:text-white shadow-sm' 
                  : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              Ce mois
            </button>
            <button 
              onClick={() => setDateRange('lastMonth')}
              className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all whitespace-nowrap ${
                dateRange === 'lastMonth' 
                  ? 'bg-white dark:bg-dark-accent text-primary dark:text-white shadow-sm' 
                  : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              Mois dernier
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Revenue Card */}
          <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-xl p-5 border border-neutral-200 dark:border-white/5 shadow-soft">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-semantic-green/10 rounded-lg">
                <Banknote className="w-6 h-6 text-semantic-green" />
              </div>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-bold uppercase tracking-wider">Chiffre d'affaires</p>
            <h3 className="text-2xl font-black text-primary dark:text-white mt-1">
              {isLoading ? '...' : formatMontant(metrics.chiffre_affaires)}
            </h3>
          </div>

          {/* Collections Card */}
          <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-xl p-5 border border-neutral-200 dark:border-white/5 shadow-soft">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Wallet className="w-6 h-6 text-blue-500" />
              </div>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-bold uppercase tracking-wider">Total Encaissé</p>
            <h3 className="text-2xl font-black text-primary dark:text-white mt-1">
              {isLoading ? '...' : formatMontant(metrics.encaissements)}
            </h3>
          </div>

          {/* Supplies Card (Display Only) */}
          <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-xl p-5 border border-neutral-200 dark:border-white/5 shadow-soft opacity-75">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-semantic-red/10 rounded-lg">
                <ShoppingCart className="w-6 h-6 text-semantic-red" />
              </div>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-bold uppercase tracking-wider">Ravitaillements</p>
            <h3 className="text-2xl font-black text-primary dark:text-white mt-1">
              {isLoading ? '...' : formatMontant(metrics.ravitaillements)}
            </h3>
          </div>

          {/* Gross Margin Card */}
          <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-xl p-5 border border-neutral-200 dark:border-white/5 shadow-soft relative overflow-hidden">
             <div className="absolute top-0 right-0 p-3 opacity-10">
                <TrendingUp className="w-16 h-16 text-dark-accent" />
             </div>
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="p-2 bg-dark-accent/10 rounded-lg">
                <TrendingUp className="w-6 h-6 text-dark-accent" />
              </div>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-bold uppercase tracking-wider relative z-10">Marge Brute</p>
            <h3 className={`text-2xl font-black mt-1 relative z-10 ${metrics.marge_brute >= 0 ? 'text-semantic-green' : 'text-semantic-red'}`}>
              {isLoading ? '...' : formatMontant(metrics.marge_brute)}
            </h3>
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1 relative z-10">
              (CA - Coût d'achat)
            </p>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Trend Chart */}
          <div className="lg:col-span-2 bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 shadow-soft p-6">
            <h3 className="text-lg font-bold text-primary dark:text-white mb-6">Tendance Revenus & Encaissements</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0086C9" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#0086C9" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorCollection" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#039855" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#039855" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-neutral-200 dark:text-white/10" />
                  <XAxis 
                    dataKey="dateFormatted" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#737373', fontSize: 10, fontWeight: 700 }}
                    dy={10}
                    minTickGap={30}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#737373', fontSize: 10, fontWeight: 700 }}
                    tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: 'none', 
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', 
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      backdropFilter: 'blur(8px)',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                    formatter={(value: number) => formatMontant(value)}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px', fontWeight: 'bold' }} />
                  <Area 
                    type="monotone" 
                    dataKey="ca" 
                    name="Chiffre d'affaires" 
                    stroke="#0086C9" 
                    fillOpacity={1} 
                    fill="url(#colorRevenue)" 
                    strokeWidth={3}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="encaissements" 
                    name="Encaissé" 
                    stroke="#039855" 
                    fillOpacity={1} 
                    fill="url(#colorCollection)" 
                    strokeWidth={3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Activity / Alert */}
          <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 shadow-soft p-6">
            <h3 className="text-lg font-bold text-primary dark:text-white mb-4">Santé Financière</h3>
            
            <div className="space-y-6">
              {/* Shortfall Alert (Manque à Gagner) */}
              <div className={`p-4 rounded-xl border ${metrics.manque_a_gagner > 0 ? 'bg-semantic-red/5 border-semantic-red/10' : 'bg-semantic-green/5 border-semantic-green/10'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <AlertTriangle className={`w-5 h-5 ${metrics.manque_a_gagner > 0 ? 'text-semantic-red' : 'text-semantic-green'}`} />
                  <span className={`font-bold ${metrics.manque_a_gagner > 0 ? 'text-semantic-red' : 'text-semantic-green'}`}>
                    {metrics.manque_a_gagner > 0 ? 'Manque à Gagner' : 'Tout est encaissé'}
                  </span>
                </div>
                <p className="text-2xl font-black text-primary dark:text-white mb-1">
                  {formatMontant(metrics.manque_a_gagner)}
                </p>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-bold uppercase tracking-wide">
                  Différence CA vs Encaissé
                </p>
                <button 
                  onClick={() => navigate('/creances')}
                  className={`w-full mt-3 py-2 text-xs font-bold border rounded-lg transition-colors ${
                    metrics.manque_a_gagner > 0 
                      ? 'text-semantic-red border-semantic-red/20 hover:bg-semantic-red/5' 
                      : 'text-semantic-green border-semantic-green/20 hover:bg-semantic-green/5'
                  }`}
                >
                  Voir les débiteurs
                </button>
              </div>

              {/* Profit Margin */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Marge Bénéficiaire (Brute)</span>
                  <span className="text-sm font-black text-primary dark:text-white">
                    {metrics.chiffre_affaires ? Math.round((metrics.marge_brute / metrics.chiffre_affaires) * 100) : 0}%
                  </span>
                </div>
                <div className="h-2 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-dark-accent rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${metrics.chiffre_affaires ? Math.max(0, Math.min(100, (metrics.marge_brute / metrics.chiffre_affaires) * 100)) : 0}%` }}
                  ></div>
                </div>
                <p className="text-[10px] text-neutral-400 mt-2 font-medium">
                  Représente la part du CA conservée après déduction du coût d'achat des produits vendus.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}