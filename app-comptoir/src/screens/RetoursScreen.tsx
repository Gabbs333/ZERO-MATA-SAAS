import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import type { CommandeItemWithRetour } from '../hooks/useCommandeItemsWithRetours';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';
import { formatPrice } from '../lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ArrowLeft,
  Package,
  Receipt,
  Search,
  X,
  CheckCircle,
  Clock,
  AlertCircle,
  Calendar,
  ArrowLeftCircle,
  RefreshCw,
} from 'lucide-react';
import type { FactureWithDetails } from '../types/database.types';

// ---------------------------------------------------------------------------
// Local interfaces
// ---------------------------------------------------------------------------

interface RetourItemSelectionne {
  commande_item_id: string;
  produit_id: string;
  nom_produit: string;
  quantite_retournee: number;
  prix_unitaire: number;
  montant_ligne: number;
  quantite_max: number;
}

/** Mirrors rows from the `retour_items_en_attente` view */
interface RetourEnAttente {
  id: string;
  facture_id: string;
  commande_id: string;
  commande_item_id: string;
  produit_id: string;
  nom_produit: string;
  quantite_retournee: number;
  prix_unitaire: number;
  montant_ligne: number;
  motif: string | null;
  utilisateur_id: string;
  date_demande: string;
  etablissement_id: string;
  factures: {
    numero_facture: string;
    montant_total: number;
  } | null;
  commandes: {
    numero_commande: string;
    tables: { numero: number } | null;
    profiles: { nom: string; prenom: string } | null;
  } | null;
  profiles: {
    nom: string;
    prenom: string;
  } | null;
}

/** Row from the `retours` table enriched with related data */
interface RetourHistorique {
  id: string;
  numero_retour: string;
  facture_id: string;
  commande_id: string;
  montant_total_retour: number;
  motif: string | null;
  utilisateur_id: string;
  date_retour: string;
  etablissement_id: string;
  factures: {
    numero_facture: string;
    montant_total: number;
  } | null;
  commandes: {
    numero_commande: string;
    tables: { numero: number } | null;
    profiles: { nom: string; prenom: string } | null;
  } | null;
  profiles: {
    nom: string;
    prenom: string;
  } | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TabId = 'nouveau' | 'en_attente' | 'historique';

const DATE_FILTERS = [
  { value: 'today' as const, label: "Aujourd'hui" },
  { value: 'week' as const, label: '7 jours' },
  { value: 'month' as const, label: '30 jours' },
  { value: 'all' as const, label: 'Tout' },
];

function statusBadgeClasses(statut: string) {
  switch (statut) {
    case 'payee':
      return 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400';
    case 'partiellement_payee':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400';
    default:
      return 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400';
  }
}

function statusLabel(statut: string) {
  switch (statut) {
    case 'payee':
      return 'Payée';
    case 'partiellement_payee':
      return 'Partielle';
    default:
      return 'En attente';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RetoursScreen() {
  const profile = useAuthStore((s) => s.profile);
  const location = useLocation();
  const etablissementId = profile?.etablissement_id;

  // ---- Tab state -----------------------------------------------------------
  const [activeTab, setActiveTab] = useState<TabId>('nouveau');

  // ---- Return-form state ---------------------------------------------------
  const [selectedFacture, setSelectedFacture] = useState<FactureWithDetails | null>(null);
  const [retourItems, setRetourItems] = useState<RetourItemSelectionne[]>([]);
  const [motif, setMotif] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [enrichedItems, setEnrichedItems] = useState<CommandeItemWithRetour[]>([]);

  // ---- Filters -------------------------------------------------------------
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('week');
  // Separate search for historique
  const [histoSearch, setHistoSearch] = useState('');
  const [histoDateFilter, setHistoDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');

  // =========================================================================
  // Data Queries
  // =========================================================================

  // Tab 1 — Eligible factures
  const {
    data: factures,
    isLoading: facturesLoading,
    refetch: refetchFactures,
  } = useSupabaseQuery<FactureWithDetails[]>(
    ['factures_retours', etablissementId],
    async () => {
      if (!etablissementId) return { data: [], error: null };
      const { data, error } = await supabase
        .from('factures')
        .select(
          `*,
          commandes (
            id,
            numero_commande,
            tables (numero),
            profiles!serveuse_id (nom, prenom),
            commande_items (*)
          )`
        )
        .eq('etablissement_id', etablissementId)
        .in('statut', ['payee', 'partiellement_payee', 'en_attente_paiement'])
        .or('statut_retour.is.null,statut_retour.neq.retour_total')
        .order('date_generation', { ascending: false });
      return { data: data as unknown as FactureWithDetails[], error };
    },
    { enabled: !!etablissementId },
  );

  // Tab 2 — Pending returns
  const {
    data: retoursEnAttente,
    isLoading: pendingLoading,
    refetch: refetchPending,
  } = useSupabaseQuery<RetourEnAttente[]>(
    ['retours_en_attente', etablissementId],
    async () => {
      if (!etablissementId) return { data: [], error: null };
      const { data, error } = await supabase
        .from('retour_items_en_attente')
        .select(
          `*,
          factures (numero_facture, montant_total),
          commandes (numero_commande, tables (numero), profiles!serveuse_id (nom, prenom)),
          profiles!utilisateur_id (nom, prenom)`
        )
        .eq('etablissement_id', etablissementId)
        .order('date_demande', { ascending: false });
      return { data: data as unknown as RetourEnAttente[], error };
    },
    { enabled: !!etablissementId },
  );

  // Tab 3 — Historique (validated returns)
  const {
    data: historique,
    isLoading: historiqueLoading,
    refetch: refetchHistorique,
  } = useSupabaseQuery<RetourHistorique[]>(
    ['retours_historique', etablissementId],
    async () => {
      if (!etablissementId) return { data: [], error: null };
      const { data, error } = await supabase
        .from('retours')
        .select(
          `*,
          factures (numero_facture, montant_total),
          commandes (numero_commande, tables (numero), profiles!serveuse_id (nom, prenom)),
          profiles!utilisateur_id (nom, prenom)`
        )
        .eq('etablissement_id', etablissementId)
        .order('date_retour', { ascending: false });
      return { data: data as unknown as RetourHistorique[], error };
    },
    { enabled: !!etablissementId },
  );

  // =========================================================================
  // Pre-selected facture from navigation (kept for backward compatibility)
  // =========================================================================
  useEffect(() => {
    const ids: string[] | undefined = location.state?.selectedFactureIds;
    if (ids && ids.length > 0 && factures) {
      const match = factures.find((f) => ids.includes(f.id));
      if (match) {
        setActiveTab('nouveau');
        setSelectedFacture(match);
      }
    }
  }, [location.state, factures]);

  // =========================================================================
  // Derived data
  // =========================================================================

  // Filtered factures for Tab 1
  const filteredFactures = useMemo(() => {
    if (!factures) return [];
    return factures.filter((f) => {
      const num = f.commandes?.numero_commande?.toLowerCase() ?? '';
      const prenom = f.commandes?.profiles?.prenom?.toLowerCase() ?? '';
      const nom = f.commandes?.profiles?.nom?.toLowerCase() ?? '';
      const term = searchTerm.toLowerCase();
      const matchesSearch = num.includes(term) || prenom.includes(term) || nom.includes(term);

      let matchesDate = true;
      if (dateFilter !== 'all') {
        const d = new Date(f.date_generation);
        const now = new Date();
        if (dateFilter === 'today') {
          matchesDate = d.toDateString() === now.toDateString();
        } else if (dateFilter === 'week') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          matchesDate = d >= weekAgo;
        } else if (dateFilter === 'month') {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          matchesDate = d >= monthAgo;
        }
      }
      return matchesSearch && matchesDate;
    });
  }, [factures, searchTerm, dateFilter]);

  // Grouped pending returns for Tab 2
  const groupedPending = useMemo(() => {
    if (!retoursEnAttente) return null;
    const map: Record<
      string,
      {
        items: RetourEnAttente[];
        facture: RetourEnAttente['factures'];
        commande: RetourEnAttente['commandes'];
        utilisateur: RetourEnAttente['profiles'];
        date_demande: string;
      }
    > = {};
    for (const item of retoursEnAttente) {
      if (!map[item.facture_id]) {
        map[item.facture_id] = {
          items: [],
          facture: item.factures,
          commande: item.commandes,
          utilisateur: item.profiles,
          date_demande: item.date_demande,
        };
      }
      map[item.facture_id].items.push(item);
    }
    return map;
  }, [retoursEnAttente]);

  // Filtered historique for Tab 3
  const filteredHistorique = useMemo(() => {
    if (!historique) return [];
    return historique.filter((r) => {
      const num = r.commandes?.numero_commande?.toLowerCase() ?? '';
      const motifText = r.motif?.toLowerCase() ?? '';
      const term = histoSearch.toLowerCase();
      const matchesSearch = num.includes(term) || motifText.includes(term) || r.numero_retour.toLowerCase().includes(term);

      let matchesDate = true;
      if (histoDateFilter !== 'all') {
        const d = new Date(r.date_retour);
        const now = new Date();
        if (histoDateFilter === 'today') {
          matchesDate = d.toDateString() === now.toDateString();
        } else if (histoDateFilter === 'week') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          matchesDate = d >= weekAgo;
        } else if (histoDateFilter === 'month') {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          matchesDate = d >= monthAgo;
        }
      }
      return matchesSearch && matchesDate;
    });
  }, [historique, histoSearch, histoDateFilter]);

  // =========================================================================
  // Handlers
  // =========================================================================

  const totalRetour = retourItems.reduce((sum, i) => sum + i.montant_ligne, 0);

  const handleSelectFacture = async (facture: FactureWithDetails) => {
    setSelectedFacture(facture);
    setRetourItems([]);
    setMotif('');
    setShowSuccess(false);

    const cmdId = facture.commandes?.id;
    if (!cmdId) {
      setEnrichedItems([]);
      return;
    }

    const { data } = await supabase
      .from('commande_items_with_retours')
      .select('*')
      .eq('commande_id', cmdId)
      .order('nom_produit', { ascending: true });

    setEnrichedItems((data as unknown as CommandeItemWithRetour[]) || []);
  };

  const handleToggleItem = (item: CommandeItemWithRetour) => {
    setRetourItems((prev) => {
      const existing = prev.find((i) => i.commande_item_id === item.id);
      if (existing) {
        return prev.filter((i) => i.commande_item_id !== item.id);
      }
      const restante = Math.max(1, item.quantite - (item.quantite_totale_retournee ?? 0));
      return [
        ...prev,
        {
          commande_item_id: item.id,
          produit_id: item.produit_id,
          nom_produit: item.nom_produit,
          quantite_retournee: 1,
          prix_unitaire: item.prix_unitaire,
          montant_ligne: item.prix_unitaire,
          quantite_max: restante,
        },
      ];
    });
  };

  const handleUpdateQuantity = (commandeItemId: string, qty: number) => {
    setRetourItems((prev) =>
      prev.map((item) => {
        if (item.commande_item_id !== commandeItemId) return item;
        const q = Math.max(1, Math.min(qty, item.quantite_max));
        return { ...item, quantite_retournee: q, montant_ligne: q * item.prix_unitaire };
      }),
    );
  };

  const handleProcessRetour = async () => {
    if (!selectedFacture || retourItems.length === 0) return;
    setIsProcessing(true);
    try {
      const payload = retourItems.map((item) => ({
        commande_item_id: item.commande_item_id,
        produit_id: item.produit_id,
        nom_produit: item.nom_produit,
        quantite_retournee: item.quantite_retournee,
        prix_unitaire: item.prix_unitaire,
      }));

      const { error } = await supabase.rpc('create_pending_retour', {
        p_facture_id: selectedFacture.id,
        p_commande_id: selectedFacture.commandes.id,
        p_retour_items: payload,
        p_motif: motif || null,
      });

      if (error) throw error;

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setSelectedFacture(null);
        setRetourItems([]);
        setMotif('');
        refetchFactures();
        refetchPending();
        refetchHistorique();
      }, 2000);
    } catch (err: any) {
      console.error('Retour error:', err);
      alert(err.message || 'Erreur lors de la demande de retour');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBackFromForm = () => {
    setSelectedFacture(null);
    setRetourItems([]);
    setMotif('');
    setShowSuccess(false);
    setEnrichedItems([]);
  };

  // =========================================================================
  // Render helpers
  // =========================================================================

  const renderTabs = () => (
    <div className="flex gap-1 bg-neutral-100 dark:bg-white/5 p-1 rounded-xl">
      {(
        [
          { id: 'nouveau' as TabId, label: 'Nouveau retour', icon: Package },
          { id: 'en_attente' as TabId, label: 'En attente', icon: Clock },
          { id: 'historique' as TabId, label: 'Historique', icon: CheckCircle },
        ] as const
      ).map((tab) => (
        <button
          key={tab.id}
          onClick={() => {
            setActiveTab(tab.id);
            setSelectedFacture(null);
            setRetourItems([]);
            setMotif('');
            setShowSuccess(false);
          }}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${
            activeTab === tab.id
              ? 'bg-white dark:bg-neutral-800 text-primary dark:text-dark-accent shadow-sm'
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
          }`}
        >
          <tab.icon className="w-4 h-4" />
          <span className="hidden sm:inline">{tab.label}</span>
        </button>
      ))}
    </div>
  );

  // ---- Tab 1: Nouveau retour ------------------------------------------------

  const renderNouveauRetour = () => (
    <div className="space-y-6">
      {/* Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Rechercher par numéro de commande ou serveur..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary dark:focus:border-dark-accent rounded-xl text-neutral-900 dark:text-white placeholder-neutral-400 focus:ring-4 focus:ring-primary/10 dark:focus:ring-dark-accent/10 transition-all outline-none"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {DATE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setDateFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                dateFilter === f.value
                  ? 'bg-primary dark:bg-dark-accent text-white'
                  : 'bg-neutral-100 dark:bg-white/5 text-neutral-500 dark:text-neutral-400'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {facturesLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary dark:border-white" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFactures.map((facture) => (
            <div
              key={facture.id}
              className="bg-white dark:bg-neutral-800/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 shadow-soft overflow-hidden transition-all hover:border-neutral-300 dark:hover:border-white/10"
            >
              <div className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-primary/10 text-primary dark:text-dark-accent size-10 rounded-lg flex items-center justify-center">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm text-neutral-900 dark:text-white truncate">
                      {facture.commandes?.numero_commande ?? '—'}
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Table {facture.commandes?.tables?.numero ?? '?'} •{' '}
                      {facture.commandes?.profiles?.prenom ?? ''}{' '}
                      {facture.commandes?.profiles?.nom ?? ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-neutral-500 dark:text-neutral-400">
                    {format(new Date(facture.date_generation), 'dd MMM yyyy', { locale: fr })}
                  </span>
                  <span className="font-bold text-neutral-900 dark:text-white">
                    {formatPrice(facture.montant_total)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-bold ${statusBadgeClasses(facture.statut)}`}
                  >
                    {statusLabel(facture.statut)}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectFacture(facture);
                    }}
                    className="px-4 py-1.5 bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-500/30 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
                  >
                    <ArrowLeftCircle className="w-3.5 h-3.5" />
                    Retour
                  </button>
                </div>
                {facture.statut_retour && facture.statut_retour !== 'sans_retour' && (
                  <div className="mt-2">
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400">
                      {facture.statut_retour === 'retour_partiel' ? 'Retour partiel' : facture.statut_retour}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
          {filteredFactures.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-neutral-400 dark:text-neutral-500">
              <Package className="w-12 h-12 mb-2 opacity-50" />
              <p>Aucune facture éligible au retour</p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ---- Tab 2: En attente ----------------------------------------------------

  const renderEnAttente = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-500" />
          Retours en attente de validation
          {retoursEnAttente && retoursEnAttente.length > 0 && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 rounded-full text-xs font-bold">
              {retoursEnAttente.length}
            </span>
          )}
        </h2>
        <button
          onClick={() => refetchPending()}
          className="p-2 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg transition-colors"
          title="Actualiser"
        >
          <RefreshCw className="w-4 h-4 text-neutral-500" />
        </button>
      </div>

      {pendingLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary dark:border-white" />
        </div>
      ) : groupedPending && Object.keys(groupedPending).length > 0 ? (
        <div className="space-y-4">
          {Object.entries(groupedPending).map(([factureId, group]) => (
            <div
              key={factureId}
              className="bg-white dark:bg-neutral-800/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 p-5"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-bold text-neutral-900 dark:text-white">
                    {group.commande?.numero_commande ?? '—'}
                  </h3>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    Table {group.commande?.tables?.numero ?? '?'} • Demandé par{' '}
                    {group.utilisateur?.prenom ?? ''} {group.utilisateur?.nom ?? ''}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-semantic-red">
                    {formatPrice(group.items.reduce((sum, i) => sum + i.montant_ligne, 0))}
                  </span>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {format(new Date(group.date_demande), 'dd/MM HH:mm', { locale: fr })}
                  </p>
                </div>
              </div>

              <div className="space-y-2 mb-3">
                {group.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <span className="text-neutral-600 dark:text-neutral-400">
                      {item.nom_produit} ×{item.quantite_retournee}
                    </span>
                    <span className="font-medium text-neutral-900 dark:text-white">
                      {formatPrice(item.montant_ligne)}
                    </span>
                  </div>
                ))}
              </div>

              {group.items.some((i) => i.motif) && (
                <div className="mb-3 p-2 bg-neutral-50 dark:bg-white/5 rounded-lg">
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    <span className="font-bold">Motif:</span>{' '}
                    {group.items.find((i) => i.motif)?.motif}
                  </p>
                </div>
              )}

              <div className="pt-3 border-t border-neutral-200 dark:border-white/10 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                <AlertCircle className="w-4 h-4" />
                <span>En attente de validation</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Aucun retour en attente de validation</p>
        </div>
      )}
    </div>
  );

  // ---- Tab 3: Historique ----------------------------------------------------

  const renderHistorique = () => (
    <div className="space-y-6">
      {/* Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Rechercher par numéro de commande, retour ou motif..."
            value={histoSearch}
            onChange={(e) => setHistoSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary dark:focus:border-dark-accent rounded-xl text-neutral-900 dark:text-white placeholder-neutral-400 focus:ring-4 focus:ring-primary/10 dark:focus:ring-dark-accent/10 transition-all outline-none"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {DATE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setHistoDateFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                histoDateFilter === f.value
                  ? 'bg-primary dark:bg-dark-accent text-white'
                  : 'bg-neutral-100 dark:bg-white/5 text-neutral-500 dark:text-neutral-400'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => refetchHistorique()}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Actualiser
        </button>
      </div>

      {historiqueLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary dark:border-white" />
        </div>
      ) : filteredHistorique.length > 0 ? (
        <div className="space-y-3">
          {filteredHistorique.map((r) => (
            <div
              key={r.id}
              className="bg-white dark:bg-neutral-800/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 p-5"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-white/5 px-2 py-0.5 rounded">
                      {r.numero_retour}
                    </span>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  </div>
                  <h3 className="font-bold text-neutral-900 dark:text-white">
                    {r.commandes?.numero_commande ?? '—'}
                  </h3>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    Table {r.commandes?.tables?.numero ?? '?'} • Validé par{' '}
                    {r.profiles?.prenom ?? ''} {r.profiles?.nom ?? ''}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-green-600 dark:text-green-400">
                    {formatPrice(r.montant_total_retour)}
                  </span>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {format(new Date(r.date_retour), 'dd MMM yyyy HH:mm', { locale: fr })}
                  </p>
                </div>
              </div>
              {r.motif && (
                <div className="p-2 bg-neutral-50 dark:bg-white/5 rounded-lg">
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    <span className="font-bold">Motif:</span> {r.motif}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Aucun retour dans l'historique</p>
        </div>
      )}
    </div>
  );

  // ---- Return form ----------------------------------------------------------

  const renderReturnForm = () => {
    if (!selectedFacture) return null;
    const itemsToShow =
      enrichedItems.length > 0
        ? enrichedItems
        : ((selectedFacture.commandes?.commande_items || []) as unknown as CommandeItemWithRetour[]);

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Success message */}
        {showSuccess && (
          <div className="bg-green-100 dark:bg-green-500/20 border border-green-200 dark:border-green-500/30 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            <p className="text-green-700 dark:text-green-300 font-medium">
              Demande de retour créée ! En attente de validation du patron.
            </p>
          </div>
        )}

        {/* Facture summary */}
        <div className="bg-white dark:bg-neutral-800/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                Commande {selectedFacture.commandes?.numero_commande}
              </h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Table {selectedFacture.commandes?.tables?.numero} •{' '}
                {selectedFacture.commandes?.profiles?.prenom}{' '}
                {selectedFacture.commandes?.profiles?.nom}
              </p>
            </div>
            <button
              onClick={handleBackFromForm}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-neutral-400" />
            </button>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span className="text-neutral-500 dark:text-neutral-400">
              Total facture:{' '}
              <span className="font-bold text-neutral-900 dark:text-white">
                {formatPrice(selectedFacture.montant_total)}
              </span>
            </span>
            <span className="text-neutral-500 dark:text-neutral-400">
              Payé:{' '}
              <span className="font-bold text-green-600 dark:text-green-400">
                {formatPrice(selectedFacture.montant_paye)}
              </span>
            </span>
            <span className="text-neutral-500 dark:text-neutral-400">
              Restant:{' '}
              <span className="font-bold text-amber-600 dark:text-amber-400">
                {formatPrice(selectedFacture.montant_total - selectedFacture.montant_paye)}
              </span>
            </span>
          </div>
        </div>

        {/* Items selection */}
        <div className="bg-white dark:bg-neutral-800/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 p-6">
          <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-4">
            Articles à retourner
          </h3>
          <div className="space-y-3">
            {itemsToShow.map((item) => {
              const isSelected = retourItems.some((i) => i.commande_item_id === item.id);
              const selectedItem = retourItems.find((i) => i.commande_item_id === item.id);
              const restante = Math.max(0, item.quantite - (item.quantite_totale_retournee ?? 0));
              const isFullyReturned = restante <= 0;

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    isFullyReturned
                      ? 'opacity-50 cursor-not-allowed border-neutral-100 dark:border-white/5'
                      : 'cursor-pointer ' +
                        (isSelected
                          ? 'border-primary dark:border-dark-accent bg-primary/5 dark:bg-dark-accent/10'
                          : 'border-neutral-200 dark:border-white/5 hover:border-neutral-300 dark:hover:border-white/10')
                  }`}
                  onClick={() => !isFullyReturned && handleToggleItem(item)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          isSelected
                            ? 'bg-primary dark:bg-dark-accent border-primary dark:border-dark-accent'
                            : 'border-neutral-300 dark:border-white/20'
                        }`}
                      >
                        {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
                      </div>
                      <div>
                        <p className="font-medium text-neutral-900 dark:text-white">
                          {item.nom_produit}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          {formatPrice(item.prix_unitaire)} × {item.quantite}
                          {item.quantite_totale_retournee > 0 && (
                            <span className="text-amber-500 ml-1">
                              ({item.quantite_totale_retournee} déjà retournée
                              {item.quantite_totale_retournee > 1 ? 's' : ''})
                            </span>
                          )}
                          {item.statut_retour === 'total' && (
                            <span className="text-red-500 ml-1 font-bold">
                              — Entièrement retourné
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <span className="font-bold text-neutral-900 dark:text-white">
                      {formatPrice((item.prix_unitaire ?? 0) * (item.quantite ?? 0))}
                    </span>
                  </div>

                  {isSelected && selectedItem && (
                    <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-white/10 flex items-center gap-4 flex-wrap">
                      <span className="text-sm text-neutral-500 dark:text-neutral-400">
                        Quantité à retourner:
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateQuantity(item.id, (selectedItem.quantite_retournee || 1) - 1);
                          }}
                          className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-white/10 flex items-center justify-center text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-white/20"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={selectedItem.quantite_max}
                          value={selectedItem.quantite_retournee}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            handleUpdateQuantity(item.id, parseInt(e.target.value) || 1)
                          }
                          className="w-16 text-center py-1.5 bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg text-neutral-900 dark:text-white text-sm"
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateQuantity(item.id, (selectedItem.quantite_retournee || 1) + 1);
                          }}
                          className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-white/10 flex items-center justify-center text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-white/20"
                        >
                          +
                        </button>
                      </div>
                      <span className="ml-auto text-sm font-bold text-neutral-900 dark:text-white">
                        Sous-total: {formatPrice(selectedItem.montant_ligne)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Motif */}
        {retourItems.length > 0 && (
          <div className="bg-white dark:bg-neutral-800/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 p-6">
            <label className="block text-sm font-bold text-neutral-900 dark:text-white mb-2">
              Motif du retour (optionnel)
            </label>
            <textarea
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Ex: Produit défectueux, erreur de commande..."
              className="w-full p-3 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary dark:focus:border-dark-accent rounded-xl text-neutral-900 dark:text-white placeholder-neutral-400 focus:ring-4 focus:ring-primary/10 dark:focus:ring-dark-accent/10 transition-all outline-none resize-none"
              rows={3}
            />
          </div>
        )}

        {/* Summary & Submit */}
        {retourItems.length > 0 && (
          <div className="bg-white dark:bg-neutral-800/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-lg font-bold text-neutral-900 dark:text-white">
                Total du retour
              </span>
              <span className="text-2xl font-bold text-semantic-red">
                {formatPrice(totalRetour)}
              </span>
            </div>
            <button
              onClick={handleProcessRetour}
              disabled={isProcessing}
              className="w-full py-4 bg-primary dark:bg-dark-accent text-white rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                  Demande en cours...
                </>
              ) : (
                <>
                  <Clock className="w-5 h-5" />
                  Demander le retour (en attente de validation)
                </>
              )}
            </button>
          </div>
        )}
      </div>
    );
  };

  // =========================================================================
  // Main render
  // =========================================================================

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark pb-20 md:pb-6">
      {/* Header */}
      <div className="p-4 md:p-6 bg-white/80 dark:bg-neutral-900/60 backdrop-blur-xl border-b border-neutral-200/50 dark:border-white/5">
        <div className="flex items-center gap-4 mb-4">
          {selectedFacture ? (
            <button
              onClick={handleBackFromForm}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
            </button>
          ) : null}
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white font-display">
              {selectedFacture ? 'Demande de retour' : 'Retours Produits'}
            </h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">
              {selectedFacture
                ? `Commande ${selectedFacture.commandes?.numero_commande}`
                : 'Gérez les retours en attente et validés'}
            </p>
          </div>
        </div>

        {/* Tabs (hidden when return form is open) */}
        {!selectedFacture && renderTabs()}
      </div>

      {/* Body */}
      <div className="p-4 md:p-6">
        {selectedFacture ? (
          renderReturnForm()
        ) : (
          <>
            {activeTab === 'nouveau' && renderNouveauRetour()}
            {activeTab === 'en_attente' && renderEnAttente()}
            {activeTab === 'historique' && renderHistorique()}
          </>
        )}
      </div>
    </div>
  );
}
