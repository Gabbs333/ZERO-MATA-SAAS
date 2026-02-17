import { useState, useEffect, useMemo } from 'react';
import { 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  subDays,
  format,
  differenceInDays,
  eachDayOfInterval,
  isSameDay,
  eachHourOfInterval,
  getHours,
  parseISO
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';
import { formatMontant } from '../utils/format';
import { 
  Package, 
  CreditCard, 
  Wallet, 
  AlertTriangle,
  TrendingUp,
  Clock,
  XCircle,
  Eye,
  Calendar
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { useNavigate } from 'react-router-dom';

type Period = 'today' | 'week' | 'month' | 'custom';

export function DashboardScreen() {
  const profile = useAuthStore((state) => state.profile);
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>('today');
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: startOfDay(new Date()),
    end: endOfDay(new Date())
  });
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Setup Realtime Subscriptions
  useRealtimeSubscription('commandes', '*');
  useRealtimeSubscription('factures', '*');
  useRealtimeSubscription('encaissements', '*');
  useRealtimeSubscription('stocks', '*');

  useEffect(() => {
    const now = new Date();
    switch (period) {
      case 'today':
        setDateRange({ start: startOfDay(now), end: endOfDay(now) });
        break;
      case 'week':
        setDateRange({ start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) });
        break;
      case 'month':
        setDateRange({ start: startOfMonth(now), end: endOfMonth(now) });
        break;
    }
  }, [period]);

  // Fetch establishment subscription status
  // const { data: etablissement } = useSupabaseQuery(
  //   ['etablissement', profile?.etablissement_id],
  //   async () => {
  //     if (!profile?.etablissement_id) return { data: null, error: null };
  //     return supabase
  //       .from('etablissements')
  //       .select('*')
  //       .eq('id', profile.etablissement_id)
  //       .single()
  //       .then(({ data, error }) => ({ data, error }));
  //   },
  //   { enabled: !!profile?.etablissement_id }
  // );

  // Calculate days until expiration
  // const daysUntilExpiration = etablissement?.date_fin 
  //   ? differenceInDays(new Date(etablissement.date_fin), new Date())
  //   : null;

  // Fetch Commandes with Items (Relational Query)
  const { data: commandesData, isLoading: cmdLoading } = useSupabaseQuery(
    ['dashboard_commandes', dateRange.start.toISOString(), dateRange.end.toISOString()],
    async () => {
      // Fetch Commandes with Items directly to avoid URL length limits with 'in' clause
      const { data: commandes, error: cmdError } = await supabase
        .from('commandes')
        .select('*, commande_items(*, produits(nom))')
        .eq('etablissement_id', profile?.etablissement_id)
        .neq('statut', 'annulee')
        .neq('statut', 'en_attente')
        .gte('date_creation', dateRange.start.toISOString())
        .lte('date_creation', dateRange.end.toISOString())
        .limit(2000);

      if (cmdError) {
        console.error('Error fetching commandes:', cmdError);
        throw cmdError;
      }

      return { data: commandes || [], error: null };
    },
    { enabled: !!profile?.etablissement_id }
  );

  // Fetch Encaissements
  const { data: encaissementsData, isLoading: encLoading } = useSupabaseQuery(
    ['dashboard_encaissements', dateRange.start.toISOString(), dateRange.end.toISOString()],
    async () => {
      const { data, error } = await supabase
        .from('encaissements')
        .select('*')
        .eq('etablissement_id', profile?.etablissement_id)
        .gte('date_encaissement', dateRange.start.toISOString())
        .lte('date_encaissement', dateRange.end.toISOString())
        .limit(5000);
      
      if (error) {
        console.error('Error fetching encaissements:', error);
        throw error;
      }

      return { data: data || [], error: null };
    },
    { enabled: !!profile?.etablissement_id }
  );

  // Client-side KPIs Calculation
  const kpis = useMemo(() => {
    // Robustness: Handle missing data gracefully
    const cmds = commandesData || [];
    const encs = encaissementsData || [];
    
    const ca = cmds.reduce((sum: number, cmd: any) => sum + cmd.montant_total, 0);
    const enc = encs.reduce((sum: number, pay: any) => sum + pay.montant, 0);
    const count = cmds.length;
    const panier_moyen = count > 0 ? ca / count : 0;
    
    return {
      chiffre_affaires: ca,
      encaissements: enc,
      commandes_count: count,
      panier_moyen
    };
  }, [commandesData, encaissementsData]);

  const kpisLoading = cmdLoading || encLoading;

  // Client-side Chart Data Calculation
  const chartData = useMemo(() => {
    const cmds = commandesData || [];
    const encs = encaissementsData || [];
    
    // Always generate intervals if we have a date range, regardless of data presence
    // This ensures the chart X-axis is always correct
    const isToday = isSameDay(dateRange.start, dateRange.end) || differenceInDays(dateRange.end, dateRange.start) < 1;
    let intervals: Date[];
    let dateFormat: string;
    
    if (isToday) {
      intervals = eachHourOfInterval({ start: dateRange.start, end: dateRange.end });
      dateFormat = 'HH:mm';
    } else {
      intervals = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
      dateFormat = 'dd MMM';
    }
    
    return intervals.map(date => {
      let ca = 0;
      let enc = 0;
      
      if (isToday) {
        // Compare hours for "Today" view
        const hour = getHours(date);
        const dayStr = format(date, 'yyyy-MM-dd');
        
        ca = cmds
          .filter((c: any) => {
            const cDate = parseISO(c.date_creation);
            return getHours(cDate) === hour && format(cDate, 'yyyy-MM-dd') === dayStr;
          })
          .reduce((sum: number, c: any) => sum + c.montant_total, 0);
          
        enc = encs
          .filter((e: any) => {
            const eDate = parseISO(e.date_encaissement);
            return getHours(eDate) === hour && format(eDate, 'yyyy-MM-dd') === dayStr;
          })
          .reduce((sum: number, e: any) => sum + e.montant, 0);
      } else {
        // Compare dates (YYYY-MM-DD) for other views to avoid timezone issues
        const dateStr = format(date, 'yyyy-MM-dd');
        
        ca = cmds
          .filter((c: any) => format(parseISO(c.date_creation), 'yyyy-MM-dd') === dateStr)
          .reduce((sum: number, c: any) => sum + c.montant_total, 0);
          
        enc = encs
          .filter((e: any) => format(parseISO(e.date_encaissement), 'yyyy-MM-dd') === dateStr)
          .reduce((sum: number, e: any) => sum + e.montant, 0);
      }
      
      return {
        date: date.toISOString(),
        periode: format(date, dateFormat, { locale: fr }),
        chiffre_affaires: ca,
        encaissements: enc
      };
    });
  }, [commandesData, encaissementsData, dateRange]);
  // const chartLoading = cmdLoading || encLoading;

  // Client-side Top Products Calculation
  const advancedAnalytics = useMemo(() => {
    if (!commandesData) return [];
    
    const productMap = new Map<string, { nom_produit: string, quantite: number, ca: number }>();
    
    commandesData.forEach((cmd: any) => {
      cmd.commande_items.forEach((item: any) => {
        const existing = productMap.get(item.produit_id);
        const nom = item.produits?.nom || item.nom_produit || 'Inconnu';
        if (existing) {
          existing.quantite += item.quantite;
          existing.ca += item.quantite * item.prix_unitaire;
        } else {
          productMap.set(item.produit_id, {
            nom_produit: nom,
            quantite: item.quantite,
            ca: item.quantite * item.prix_unitaire
          });
        }
      });
    });
      
    return Array.from(productMap.values())
      .sort((a, b) => b.quantite - a.quantite)
      .slice(0, 5);
  }, [commandesData]);
  const advancedLoading = cmdLoading;

  // Client-side Payment Modes Calculation
  const paymentModes = useMemo(() => {
    if (!encaissementsData) return [];
    
    const modeMap = new Map<string, number>();
    let total = 0;
    
    encaissementsData.forEach((enc: any) => {
      const current = modeMap.get(enc.mode_paiement) || 0;
      modeMap.set(enc.mode_paiement, current + enc.montant);
      total += enc.montant;
    });
    
    return Array.from(modeMap.entries()).map(([mode, montant]) => ({
      mode_paiement: mode,
      montant_total: montant,
      pourcentage_total: total > 0 ? Math.round((montant / total) * 100) : 0
    }));
  }, [encaissementsData]);
  // const paymentLoading = encLoading;

  // Fetch current debt for the period
  const { data: totalDebt, isLoading: debtLoading } = useSupabaseQuery(
    ['total_debt', dateRange.start.toISOString(), dateRange.end.toISOString()],
    async () => {
      return supabase
        .from('factures')
        .select('montant_restant')
        .gte('date_generation', dateRange.start.toISOString())
        .lte('date_generation', dateRange.end.toISOString())
        .gt('montant_restant', 0)
        .then(({ data, error }) => {
          const total = data?.reduce((acc, curr) => acc + curr.montant_restant, 0) || 0;
          return { data: total, error };
        });
    }
  );

  // Fetch pending validations for the period
  const { data: pendingCommandes, isLoading: pendingLoading } = useSupabaseQuery(
    ['commandes', 'en_attente', dateRange.start.toISOString(), dateRange.end.toISOString()],
    async () => {
      return supabase
        .from('commandes')
        .select(`
          *,
          tables (numero),
          profiles!serveuse_id (nom, prenom),
          commande_items (
            *,
            produits (nom, prix_vente)
          )
        `)
        .eq('statut', 'en_attente')
        .gte('date_creation', dateRange.start.toISOString())
        .lte('date_creation', dateRange.end.toISOString())
        .order('date_creation', { ascending: true })
        .limit(3)
        .then(({ data, error }) => ({ data, error }));
    }
  );

  // Fetch stock alerts
  const { data: stockAlerts } = useSupabaseQuery(
    ['stock_alerts'],
    async () => {
      return supabase.rpc('check_stock_alerts')
        .then(({ data, error }) => ({ data, error }));
    }
  );


  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-dark-bg pb-20 md:pb-6">
      {/* Date Filter Bar */}
      <div className="sticky top-[65px] z-30 bg-white/80 dark:bg-dark-bg/80 backdrop-blur-md border-b border-neutral-200 dark:border-white/5 px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {(['today', 'week', 'month'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                period === p 
                  ? 'bg-primary text-white dark:bg-dark-accent' 
                  : 'bg-neutral-100 dark:bg-white/5 text-neutral-500 dark:text-neutral-400 border border-neutral-200/50 dark:border-white/5'
              }`}
            >
              {p === 'today' ? "Aujourd'hui" : p === 'week' ? 'Cette Semaine' : 'Ce Mois'}
            </button>
          ))}
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${
              period === 'custom' 
                ? 'bg-primary text-white dark:bg-dark-accent' 
                : 'bg-neutral-100 dark:bg-white/5 text-neutral-500 dark:text-neutral-400 border border-neutral-200/50 dark:border-white/5'
            }`}
          >
            <Calendar className="w-3 h-3" />
            Personnalisé
          </button>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-neutral-400 dark:text-neutral-500">
          <Clock className="w-4 h-4" />
          <span className="text-[10px] font-bold uppercase tracking-widest">
            {format(dateRange.start, 'dd MMM', { locale: fr })} - {format(dateRange.end, 'dd MMM', { locale: fr })}
          </span>
        </div>
      </div>

      {/* Custom Date Picker Modal */}
      {showDatePicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-card w-full max-w-sm rounded-3xl p-6 border border-neutral-200 dark:border-white/10 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-primary dark:text-white">Filtrer par date</h3>
              <button 
                onClick={() => setShowDatePicker(false)}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-full transition-colors"
              >
                <XCircle className="w-5 h-5 text-neutral-400" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Preset Quick Filters */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    const today = new Date();
                    setDateRange({ start: startOfDay(today), end: endOfDay(today) });
                    setPeriod('today');
                    setShowDatePicker(false);
                  }}
                  className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors ${
                    period === 'today' 
                      ? 'bg-primary text-white' 
                      : 'bg-neutral-100 dark:bg-white/5 text-neutral-500 hover:text-primary dark:hover:text-white'
                  }`}
                >
                  Aujourd'hui
                </button>
                <button
                  onClick={() => {
                    const yesterday = subDays(new Date(), 1);
                    setDateRange({ start: startOfDay(yesterday), end: endOfDay(yesterday) });
                    setPeriod('custom');
                    setShowDatePicker(false);
                  }}
                  className="px-3 py-2 bg-neutral-100 dark:bg-white/5 rounded-xl text-[10px] font-bold uppercase tracking-widest text-neutral-500 hover:text-primary dark:hover:text-white transition-colors"
                >
                  Hier
                </button>
                <button
                  onClick={() => {
                    const last7 = subDays(new Date(), 7);
                    setDateRange({ start: startOfDay(last7), end: endOfDay(new Date()) });
                    setPeriod('custom');
                    setShowDatePicker(false);
                  }}
                  className="px-3 py-2 bg-neutral-100 dark:bg-white/5 rounded-xl text-[10px] font-bold uppercase tracking-widest text-neutral-500 hover:text-primary dark:hover:text-white transition-colors"
                >
                  7 derniers jours
                </button>
                <button
                  onClick={() => {
                    const last30 = subDays(new Date(), 30);
                    setDateRange({ start: startOfDay(last30), end: endOfDay(new Date()) });
                    setPeriod('custom');
                    setShowDatePicker(false);
                  }}
                  className="px-3 py-2 bg-neutral-100 dark:bg-white/5 rounded-xl text-[10px] font-bold uppercase tracking-widest text-neutral-500 hover:text-primary dark:hover:text-white transition-colors"
                >
                  30 derniers jours
                </button>
                <button
                  onClick={() => {
                    const start = startOfMonth(new Date());
                    const end = endOfMonth(new Date());
                    setDateRange({ start, end });
                    setPeriod('month');
                    setShowDatePicker(false);
                  }}
                  className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors ${
                    period === 'month' 
                      ? 'bg-primary text-white' 
                      : 'bg-neutral-100 dark:bg-white/5 text-neutral-500 hover:text-primary dark:hover:text-white'
                  }`}
                >
                  Ce Mois
                </button>
                <button
                  onClick={() => {
                    const last90 = subDays(new Date(), 90);
                    setDateRange({ start: startOfDay(last90), end: endOfDay(new Date()) });
                    setPeriod('custom');
                    setShowDatePicker(false);
                  }}
                  className="px-3 py-2 bg-neutral-100 dark:bg-white/5 rounded-xl text-[10px] font-bold uppercase tracking-widest text-neutral-500 hover:text-primary dark:hover:text-white transition-colors"
                >
                  90 derniers jours
                </button>
              </div>

              <div className="h-px bg-neutral-100 dark:bg-white/5 w-full"></div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">Période personnalisée</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-neutral-400 uppercase ml-1">Début</span>
                      <input 
                        type="date" 
                        className="w-full px-3 py-2.5 bg-neutral-100 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-xl text-xs font-bold text-primary dark:text-white outline-none focus:ring-2 focus:ring-primary/20"
                        value={format(dateRange.start, 'yyyy-MM-dd')}
                        onChange={(e) => {
                          setPeriod('custom');
                          setDateRange(prev => ({ ...prev, start: startOfDay(new Date(e.target.value)) }));
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-neutral-400 uppercase ml-1">Fin</span>
                      <input 
                        type="date" 
                        className="w-full px-3 py-2.5 bg-neutral-100 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-xl text-xs font-bold text-primary dark:text-white outline-none focus:ring-2 focus:ring-primary/20"
                        value={format(dateRange.end, 'yyyy-MM-dd')}
                        onChange={(e) => {
                          setPeriod('custom');
                          setDateRange(prev => ({ ...prev, end: endOfDay(new Date(e.target.value)) }));
                        }}
                      />
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setShowDatePicker(false)}
                  className="w-full py-4 bg-primary dark:bg-dark-accent text-white rounded-2xl font-bold shadow-lg shadow-primary/20 dark:shadow-dark-accent/20 transition-all active:scale-95"
                >
                  Appliquer la période
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alert Banner */}
      {stockAlerts && stockAlerts.length > 0 && (
        <div className="px-4 pt-4">
          <div className="flex items-start gap-3 p-3 bg-red-500/10 dark:bg-red-500/10 border border-red-500/20 dark:border-red-500/20 rounded-xl backdrop-blur-md">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Alerte Stock</p>
                <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest px-1.5 py-0.5 bg-neutral-100 dark:bg-white/5 rounded-full">Temps Réel</span>
              </div>
              <p className="text-sm text-primary dark:text-white font-medium leading-tight">
                {stockAlerts[0].nom} est bas ({stockAlerts[0].stock_actuel} restant).
                {stockAlerts.length > 1 && ` +${stockAlerts.length - 1} autres`}
              </p>
            </div>
            <button 
              onClick={() => navigate('/ravitaillements')}
              className="text-red-500 font-bold text-xs underline decoration-red-500/30 underline-offset-4 active:scale-95 transition-transform"
            >
              Réapprovisionner
            </button>
          </div>
        </div>
      )}

      {/* HUD Stats Section */}
      <div className="flex flex-col gap-4 p-4">
        
        {/* Main Comparison Row */}
        <div className="grid grid-cols-2 gap-3">
          
          {/* Card 1: Daily CA */}
          <div className="flex flex-col gap-1 rounded-2xl p-4 bg-white dark:bg-dark-card/40 dark:backdrop-blur-md border border-neutral-200 dark:border-white/5 shadow-soft hover:border-primary/20 dark:hover:border-dark-accent/30 transition-all group">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
                <CreditCard className="w-4 h-4 opacity-70 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Chiffre d'Affaires</span>
              </div>
              {kpisLoading && <div className="size-3 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>}
            </div>
            <p className="text-primary dark:text-white text-xl font-black tracking-tight">
              {formatMontant(kpis?.chiffre_affaires || 0)}
            </p>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-wider">Montant Brut</span>
              <span className="text-[10px] font-black text-green-500 bg-green-500/10 dark:bg-green-500/10 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                {kpis?.commandes_count || 0} commandes
              </span>
            </div>
          </div>

          {/* Card 2: Real Collections */}
          <div className="flex flex-col gap-1 rounded-2xl p-4 bg-primary dark:bg-dark-accent text-white border border-primary dark:border-dark-accent shadow-xl shadow-primary/20 dark:shadow-dark-accent/20 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 size-20 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
            
            <div className="flex items-center justify-between mb-1 z-10">
              <div className="flex items-center gap-1.5 text-white/70">
                <Wallet className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Réel Encaissé</span>
              </div>
              {kpisLoading && <div className="size-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>}
            </div>
            <p className="text-white text-xl font-black tracking-tight z-10">
              {formatMontant(kpis?.encaissements || 0)}
            </p>
            <div className="flex items-center justify-between mt-1 z-10">
              <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider">Liquidités</span>
              <span className="text-[10px] font-black text-white bg-white/20 px-2 py-0.5 rounded-full">
                {kpis?.chiffre_affaires ? Math.round((kpis.encaissements / kpis.chiffre_affaires) * 100) : 0}%
              </span>
            </div>
          </div>

        </div>

        {/* Secondary Row: Debt */}
        <div className="flex items-center justify-between rounded-2xl p-4 bg-white dark:bg-dark-card/40 dark:backdrop-blur-md border border-neutral-200 dark:border-white/5 shadow-soft border-l-4 border-l-red-500 hover:border-primary/20 dark:hover:border-dark-accent/30 transition-all">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">Créances de la période</span>
              {debtLoading && <div className="size-3 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-primary dark:text-white">
                {totalDebt?.toLocaleString('fr-FR') || '0'}
              </span>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-bold uppercase">XAF</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] font-black text-red-500 flex items-center gap-1 uppercase tracking-wider">
              <AlertTriangle className="w-3 h-3" />
              Risque Élevé
            </span>
            <button 
              onClick={() => navigate('/creances')}
              className="text-[10px] font-bold text-primary dark:text-white underline decoration-neutral-300 dark:decoration-white/20 underline-offset-4 uppercase tracking-widest active:scale-95 transition-transform"
            >
              Voir Détails
            </button>
          </div>
        </div>

      </div>

      {/* Main Chart Section */}
      <div className="p-4 pt-2">
        <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-3xl p-5 border border-neutral-200 dark:border-white/5 shadow-soft overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-primary dark:text-white text-base font-bold leading-tight tracking-tight">Évolution du Chiffre d'Affaires</h3>
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-widest mt-0.5">Ventes vs Objectifs</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className="size-2 rounded-full bg-primary shadow-sm shadow-primary/20"></div>
                <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">CA</span>
              </div>
            </div>
          </div>

          <div className="h-[220px] w-full -ml-4">
            {!chartData || chartData.length === 0 ? (
              <div className="h-full w-full flex flex-col items-center justify-center text-neutral-400 gap-2">
                <TrendingUp className="w-8 h-8 opacity-20" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Aucune donnée disponible</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart 
                  data={chartData} 
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorCA" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    vertical={false} 
                    stroke="currentColor" 
                    className="text-neutral-100 dark:text-white/5" 
                  />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 9, fontWeight: 700 }}
                    className="text-neutral-400 dark:text-neutral-500"
                    tickFormatter={(val) => {
                      const date = new Date(val);
                      if (period === 'today') return format(date, 'HH:mm');
                      if (period === 'week') return format(date, 'EEE', { locale: fr });
                      return format(date, 'dd MMM', { locale: fr });
                    }}
                    minTickGap={30}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 9, fontWeight: 700 }}
                    className="text-neutral-400 dark:text-neutral-500"
                    tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                      border: 'none', 
                      borderRadius: '12px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                      fontSize: '11px',
                      fontWeight: 'bold'
                    }}
                    itemStyle={{ color: '#3B82F6' }}
                    labelStyle={{ color: '#64748b', marginBottom: '4px' }}
                    labelFormatter={(val) => format(new Date(val), 'PPP', { locale: fr })}
                    formatter={(val: number) => [formatMontant(val), 'CA']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="chiffre_affaires" 
                    stroke="#3B82F6" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorCA)" 
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Additional Analytics Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 pb-4">
        {/* Top Products */}
        <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-3xl p-5 border border-neutral-200 dark:border-white/5 shadow-soft overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-primary dark:text-white text-base font-bold leading-tight tracking-tight">Top 5 Produits</h3>
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-widest mt-0.5">Par volume de vente</p>
            </div>
          </div>
          
          <div className="h-[200px] w-full">
            {advancedLoading ? (
              <div className="h-full w-full flex items-center justify-center">
                <div className="size-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
              </div>
            ) : !advancedAnalytics || advancedAnalytics.length === 0 ? (
              <div className="h-full w-full flex flex-col items-center justify-center text-neutral-400 gap-2">
                <Package className="w-8 h-8 opacity-20" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Aucune vente</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  layout="vertical"
                  data={advancedAnalytics}
                  margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="currentColor" className="text-neutral-100 dark:text-white/5" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="nom_produit" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fontSize: 9, fontWeight: 700 }}
                    className="text-neutral-500 dark:text-neutral-400"
                    width={80}
                  />
                  <Tooltip 
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                      border: 'none', 
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 'bold'
                    }}
                  />
                  <Bar 
                    dataKey="quantite" 
                    fill="#3B82F6" 
                    radius={[0, 4, 4, 0]} 
                    barSize={12}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-3xl p-5 border border-neutral-200 dark:border-white/5 shadow-soft overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-primary dark:text-white text-base font-bold leading-tight tracking-tight">Modes de Paiement</h3>
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-widest mt-0.5">Répartition du CA</p>
            </div>
          </div>

          <div className="h-[200px] w-full flex items-center">
            {advancedLoading ? (
              <div className="h-full w-full flex items-center justify-center">
                <div className="size-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
              </div>
            ) : !paymentModes || paymentModes.length === 0 ? (
              <div className="h-full w-full flex flex-col items-center justify-center text-neutral-400 gap-2">
                <CreditCard className="w-8 h-8 opacity-20" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Aucune donnée</span>
              </div>
            ) : (
              <>
                <div className="w-1/2 h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentModes}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="montant_total"
                      >
                        {paymentModes.map((_: any, index: number) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={[ '#3B82F6', '#10B981', '#F59E0B', '#EF4444' ][index % 4]} 
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                          border: 'none', 
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 'bold'
                        }}
                        formatter={(val: number) => formatMontant(val)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-1/2 flex flex-col gap-2 pl-4">
                  {paymentModes.map((mode: any, index: number) => (
                    <div key={mode.mode_paiement} className="flex items-center gap-2">
                      <div className="size-2 rounded-full" style={{ backgroundColor: [ '#3B82F6', '#10B981', '#F59E0B', '#EF4444' ][index % 4] }}></div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest leading-none capitalize">
                          {mode.mode_paiement.replace('_', ' ')}
                        </span>
                        <span className="text-xs font-black text-primary dark:text-white">
                          {mode.pourcentage_total}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Pending Validations Section */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-primary dark:text-white text-lg font-bold leading-tight tracking-tight">Validations en attente</h3>
            {pendingLoading && <div className="size-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>}
          </div>
          <span className="flex items-center justify-center size-6 rounded-full bg-semantic-amber text-white text-xs font-bold">
              {pendingCommandes?.length || 0}
          </span>
        </div>

        <div className="flex flex-col gap-3">
            {pendingCommandes?.map((commande) => (
                 <div key={commande.id} className="group bg-white dark:bg-dark-card/50 dark:backdrop-blur-md rounded-xl p-3.5 border border-neutral-200 dark:border-white/5 shadow-sm relative overflow-hidden transition-all hover:translate-y-[-2px] hover:shadow-md">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-neutral-400 dark:bg-white/10"></div>
                    
                    <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                        <div 
                            className="bg-center bg-no-repeat bg-cover rounded-full size-10 border border-neutral-100 dark:border-white/10"
                            style={{ backgroundImage: `url("https://ui-avatars.com/api/?name=${commande.profiles?.prenom}+${commande.profiles?.nom}&background=random")` }}
                        ></div>
                        <div>
                        <p className="text-sm font-bold text-primary dark:text-white">{commande.profiles?.prenom} {commande.profiles?.nom}</p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">Serveuse • Table {commande.tables?.numero}</p>
                        </div>
                    </div>
                    <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-white/10">
                        {commande.statut === 'en_attente' ? 'En attente' : commande.statut}
                    </span>
                    </div>

                    <div className="pl-12 mb-4">
                    <p className="text-sm font-medium text-primary dark:text-white mb-0.5">
                        {commande.commande_items?.length} {commande.commande_items?.length > 1 ? 'articles' : 'article'}
                    </p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500">Total: {formatMontant(commande.montant_total)}</p>
                    </div>

                    <div className="flex gap-2 pl-12">
                      <button 
                        onClick={() => navigate('/transactions')}
                        className="flex-1 h-9 rounded-lg bg-primary/5 dark:bg-dark-accent/10 text-primary dark:text-dark-accent font-bold text-xs hover:bg-primary/10 dark:hover:bg-dark-accent/20 transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Examiner & Valider
                      </button>
                    </div>
                </div>
            ))}
            
            {(!pendingCommandes || pendingCommandes.length === 0) && !pendingLoading && (
                <div className="text-center py-8 text-neutral-400 text-sm">
                    Aucune validation en attente pour cette période
                </div>
            )}
        </div>
      </div>
      <div className="h-6"></div> {/* Spacer */}
    </div>
  );
}
