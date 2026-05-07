import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';
import { formatPrice } from '../lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ArrowLeft, ArrowLeftCircle, Package, Receipt, Search, X, CheckCircle, Clock, AlertCircle, Calendar,
  ArrowRightLeft, ShoppingCart, Plus, Minus, RefreshCw
} from 'lucide-react';
import type { Facture, Produit } from '../types/database.types';

// ─── Types locaux ──────────────────────────────────────────────────────────

interface FactureWithDetails extends Facture {
  commandes: {
    id: string;
    numero_commande: string;
    tables: { numero: number };
    profiles: { nom: string; prenom: string };
    commande_items: CommandeItemAvecRetour[];
  };
}

interface CommandeItemAvecRetour {
  id: string;
  commande_id: string;
  produit_id: string;
  nom_produit: string;
  quantite: number;
  prix_unitaire: number;
  montant_ligne: number;
  quantite_retournee?: number;
  quantite_en_attente?: number;
  quantite_totale_retournee?: number;
  statut_retour?: 'total' | 'partiel' | 'en_attente' | 'aucun';
}

interface ItemARetourner {
  commande_item_id: string;
  produit_id: string;
  nom_produit: string;
  quantite_a_retourner: number;
  prix_unitaire: number;
  quantite_max: number;
}

interface ItemAAjouter {
  produit_id: string;
  nom_produit: string;
  quantite: number;
  prix_unitaire: number;
}

// ─── Composant ─────────────────────────────────────────────────────────────

export function EchangesScreen() {
  const profile = useAuthStore((state) => state.profile);
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFacture, setSelectedFacture] = useState<FactureWithDetails | null>(null);
  const [itemsARetourner, setItemsARetourner] = useState<ItemARetourner[]>([]);
  const [itemsAAjouter, setItemsAAjouter] = useState<ItemAAjouter[]>([]);
  const [motif, setMotif] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('week');
  const [productSearch, setProductSearch] = useState('');
  const [enrichedItems, setEnrichedItems] = useState<CommandeItemAvecRetour[]>([]);

  // Fetch factures éligibles (payées ou partiellement payées)
  const { data: factures, isLoading, refetch } = useSupabaseQuery<FactureWithDetails[]>(
    ['factures_echanges', profile?.etablissement_id],
    async () => {
      if (!profile?.etablissement_id) return { data: [], error: null };

      const { data, error } = await supabase
        .from('factures')
        .select(`
          *,
          commandes (
            id,
            numero_commande,
            tables (numero),
            profiles!serveuse_id (nom, prenom),
            commande_items (*)
          )
        `)
        .eq('etablissement_id', profile.etablissement_id)
        .in('statut', ['payee', 'partiellement_payee', 'en_attente_paiement'])
        .or('statut_retour.is.null,statut_retour.neq.retour_total')
        .order('date_generation', { ascending: false });

      return { data: data as unknown as FactureWithDetails[], error };
    },
    { enabled: !!profile?.etablissement_id }
  );

  // Fetch produits (catalogue pour l'ajout)
  const { data: produits } = useSupabaseQuery<Produit[]>(
    ['produits_echanges', profile?.etablissement_id],
    async () => {
      if (!profile?.etablissement_id) return { data: [], error: null };
      const { data, error } = await supabase
        .from('produits')
        .select('*')
        .eq('etablissement_id', profile.etablissement_id)
        .eq('actif', true)
        .order('nom');
      return { data: data as Produit[], error };
    },
    { enabled: !!profile?.etablissement_id }
  );

  // Filtrer les factures
  const filteredFactures = factures?.filter(f => {
    const matchesSearch =
      f.commandes?.numero_commande?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.commandes?.profiles?.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.commandes?.profiles?.nom?.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesDate = true;
    if (dateFilter !== 'all') {
      const factureDate = new Date(f.date_generation);
      const now = new Date();
      if (dateFilter === 'today') matchesDate = factureDate.toDateString() === now.toDateString();
      else if (dateFilter === 'week') matchesDate = factureDate >= new Date(now.getTime() - 7 * 86400000);
      else if (dateFilter === 'month') matchesDate = factureDate >= new Date(now.getTime() - 30 * 86400000);
    }
    return matchesSearch && matchesDate;
  });

  // Produits filtrés
  const filteredProduits = produits?.filter(p =>
    p.nom.toLowerCase().includes(productSearch.toLowerCase())
  );

  // Pré-sélection depuis la navigation
  useEffect(() => {
    const selectedFactureIds = location.state?.selectedFactureIds;
    if (selectedFactureIds && selectedFactureIds.length > 0 && factures) {
      const firstSelected = factures.find(f => selectedFactureIds.includes(f.id));
      if (firstSelected) handleSelectFacture(firstSelected);
    }
  }, [location.state, factures]);

  // ─── Calculs ──────────────────────────────────────────────────────────

  const totalRetourne = itemsARetourner.reduce((sum, i) => sum + i.quantite_a_retourner * i.prix_unitaire, 0);
  const totalAjoute = itemsAAjouter.reduce((sum, i) => sum + i.quantite * i.prix_unitaire, 0);
  const difference = totalAjoute - totalRetourne;

  // ─── Handlers ─────────────────────────────────────────────────────────

  const handleSelectFacture = async (facture: FactureWithDetails) => {
    setSelectedFacture(facture);
    setItemsARetourner([]);
    setItemsAAjouter([]);
    setMotif('');

    // Fetch enriched items from view
    const { data } = await supabase
      .from('commande_items_with_retours')
      .select('*')
      .eq('commande_id', facture.commandes.id)
      .order('nom_produit');
    setEnrichedItems((data as unknown as CommandeItemAvecRetour[]) || []);
  };

  const handleToggleRetour = (item: CommandeItemAvecRetour) => {
    const quantiteRestante = item.quantite - ((item as any).quantite_totale_retournee || 0);
    if (quantiteRestante <= 0) return;

    setItemsARetourner(prev => {
      const existing = prev.find(i => i.commande_item_id === item.id);
      if (existing) return prev.filter(i => i.commande_item_id !== item.id);
      return [...prev, {
        commande_item_id: item.id,
        produit_id: item.produit_id,
        nom_produit: item.nom_produit,
        quantite_a_retourner: 1,
        prix_unitaire: item.prix_unitaire,
        quantite_max: Math.max(1, quantiteRestante)
      }];
    });
  };

  const handleUpdateQteRetour = (commandeItemId: string, q: number) => {
    setItemsARetourner(prev => prev.map(item => {
      if (item.commande_item_id === commandeItemId) {
        const newQ = Math.max(1, Math.min(q, item.quantite_max));
        return { ...item, quantite_a_retourner: newQ };
      }
      return item;
    }));
  };

  const handleAddProduit = (produit: Produit) => {
    setItemsAAjouter(prev => {
      const existing = prev.find(i => i.produit_id === produit.id);
      if (existing) {
        return prev.map(i =>
          i.produit_id === produit.id ? { ...i, quantite: i.quantite + 1 } : i
        );
      }
      return [...prev, {
        produit_id: produit.id,
        nom_produit: produit.nom,
        quantite: 1,
        prix_unitaire: produit.prix_vente
      }];
    });
  };

  const handleUpdateQteAjout = (produitId: string, q: number) => {
    setItemsAAjouter(prev => prev.map(item => {
      if (item.produit_id === produitId) {
        const newQ = Math.max(1, q);
        return { ...item, quantite: newQ };
      }
      return item;
    }));
  };

  const handleRemoveAjout = (produitId: string) => {
    setItemsAAjouter(prev => prev.filter(i => i.produit_id !== produitId));
  };

  const handleProcessEchange = async () => {
    if (!selectedFacture || itemsARetourner.length === 0 || itemsAAjouter.length === 0) return;

    setIsProcessing(true);
    try {
      const retournesData = itemsARetourner.map(item => ({
        commande_item_id: item.commande_item_id,
        produit_id: item.produit_id,
        nom_produit: item.nom_produit,
        quantite_retournee: item.quantite_a_retourner,
        prix_unitaire: item.prix_unitaire
      }));

      const ajoutesData = itemsAAjouter.map(item => ({
        produit_id: item.produit_id,
        nom_produit: item.nom_produit,
        quantite: item.quantite,
        prix_unitaire: item.prix_unitaire
      }));

      const { data, error } = await supabase.rpc('process_echange', {
        p_facture_id: selectedFacture.id,
        p_commande_id: selectedFacture.commandes.id,
        p_items_retournes: retournesData,
        p_items_ajoutes: ajoutesData,
        p_motif: motif || null,
        p_etablissement_id: profile?.etablissement_id
      });

      if (error) throw error;

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setSelectedFacture(null);
        setItemsARetourner([]);
        setItemsAAjouter([]);
        setMotif('');
        refetch();
      }, 2500);
    } catch (error: any) {
      console.error('Échange error:', error);
      alert(error.message || 'Erreur lors de l\'échange');
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── Rendu ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark pb-20 md:pb-6">
      {/* Header */}
      <div className="p-4 md:p-6 bg-white/80 dark:bg-neutral-900/60 backdrop-blur-xl border-b border-neutral-200/50 dark:border-white/5">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => setSelectedFacture(null)}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white font-display">Échanges</h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">
              Échangez les articles d'une commande déjà validée
            </p>
          </div>
        </div>

        {!selectedFacture && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Rechercher par numéro de commande ou serveur..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary rounded-xl text-neutral-900 dark:text-white placeholder-neutral-400 outline-none transition-all"
              />
            </div>
            <div className="flex gap-2">
              {([
                { value: 'today', label: "Aujourd'hui" },
                { value: 'week', label: '7 jours' },
                { value: 'month', label: '30 jours' },
                { value: 'all', label: 'Tout' }
              ] as const).map(filter => (
                <button
                  key={filter.value}
                  onClick={() => setDateFilter(filter.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    dateFilter === filter.value
                      ? 'bg-primary dark:bg-dark-accent text-white'
                      : 'bg-neutral-100 dark:bg-white/5 text-neutral-500 dark:text-neutral-400'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 md:p-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : selectedFacture ? (
          /* ─── Formulaire d'échange ─── */
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Success */}
            {showSuccess && (
              <div className="bg-green-100 dark:bg-green-500/20 border border-green-200 dark:border-green-500/30 rounded-xl p-4 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                <p className="text-green-700 dark:text-green-300 font-medium">Échange effectué avec succès !</p>
              </div>
            )}

            {/* Infos facture */}
            <div className="bg-white dark:bg-neutral-800/40 backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                    {selectedFacture.commandes?.numero_commande}
                  </h2>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    Table {selectedFacture.commandes?.tables?.numero} • {selectedFacture.commandes?.profiles?.prenom} {selectedFacture.commandes?.profiles?.nom}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-neutral-900 dark:text-white">{formatPrice(selectedFacture.montant_total)}</span>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Total facture</p>
                </div>
              </div>
            </div>

            {/* Grille : Articles à retourner (gauche) | Produits à ajouter (droite) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* ── Colonne gauche : Articles à retourner ── */}
              <div className="bg-white dark:bg-neutral-800/40 backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 p-6">
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
                  <ArrowLeftCircle className="w-5 h-5 text-semantic-red" />
                  Articles à retourner
                </h3>
                <div className="space-y-3">
                  {enrichedItems.length > 0 ? enrichedItems.map(item => {
                    const isSelected = itemsARetourner.some(i => i.commande_item_id === item.id);
                    const sel = itemsARetourner.find(i => i.commande_item_id === item.id);
                    const qteRestante = item.quantite - ((item as any).quantite_totale_retournee || 0);

                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          qteRestante <= 0
                            ? 'opacity-40 cursor-not-allowed border-neutral-100 dark:border-white/5'
                            : isSelected
                              ? 'border-semantic-red bg-semantic-red/5 cursor-pointer'
                              : 'border-neutral-200 dark:border-white/5 hover:border-semantic-red/30 cursor-pointer'
                        }`}
                        onClick={() => qteRestante > 0 && handleToggleRetour(item)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              isSelected ? 'bg-semantic-red border-semantic-red' : 'border-neutral-300 dark:border-white/20'
                            }`}>
                              {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
                            </div>
                            <div>
                              <p className="font-medium text-sm text-neutral-900 dark:text-white">{item.nom_produit}</p>
                              <p className="text-xs text-neutral-500">{formatPrice(item.prix_unitaire)} x {item.quantite}</p>
                            </div>
                          </div>
                          <span className="font-bold text-sm">{formatPrice(item.montant_ligne)}</span>
                        </div>
                        {isSelected && sel && (
                          <div className="mt-2 pt-2 border-t border-neutral-200 dark:border-white/10 flex items-center gap-3">
                            <span className="text-xs text-neutral-500">Qté à retourner:</span>
                            <button onClick={(e) => { e.stopPropagation(); handleUpdateQteRetour(item.id, sel.quantite_a_retourner - 1); }}
                              className="w-6 h-6 rounded bg-neutral-100 dark:bg-white/10 flex items-center justify-center text-xs">−</button>
                            <span className="font-bold text-sm w-6 text-center">{sel.quantite_a_retourner}</span>
                            <button onClick={(e) => { e.stopPropagation(); handleUpdateQteRetour(item.id, sel.quantite_a_retourner + 1); }}
                              className="w-6 h-6 rounded bg-neutral-100 dark:bg-white/10 flex items-center justify-center text-xs">+</button>
                          </div>
                        )}
                      </div>
                    );
                  }) : (
                    <p className="text-neutral-400 text-sm text-center py-4">Aucun article dans cette commande.</p>
                  )}
                </div>
                {itemsARetourner.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-neutral-200 dark:border-white/10 text-right">
                    <span className="text-sm text-neutral-500">Total retourné : </span>
                    <span className="font-bold text-semantic-red">{formatPrice(totalRetourne)}</span>
                  </div>
                )}
              </div>

              {/* ── Colonne droite : Produits à ajouter ── */}
              <div className="bg-white dark:bg-neutral-800/40 backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 p-6">
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-green-600" />
                  Produits en remplacement
                </h3>
                {/* Recherche produit */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Rechercher un produit..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-green-500 rounded-xl text-sm outline-none transition-all"
                  />
                </div>

                {/* Liste produits catalogue */}
                <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
                  {filteredProduits?.map(produit => (
                    <div
                      key={produit.id}
                      onClick={() => handleAddProduit(produit)}
                      className="p-2 rounded-lg border border-neutral-200 dark:border-white/5 hover:border-green-500/30 cursor-pointer flex items-center justify-between transition-all"
                    >
                      <div>
                        <p className="font-medium text-sm text-neutral-900 dark:text-white">{produit.nom}</p>
                        <p className="text-xs text-neutral-500">{formatPrice(produit.prix_vente)}</p>
                      </div>
                      <Plus className="w-4 h-4 text-green-600" />
                    </div>
                  ))}
                  {filteredProduits?.length === 0 && (
                    <p className="text-neutral-400 text-xs text-center py-4">Aucun produit trouvé.</p>
                  )}
                </div>

                {/* Résumé des ajouts */}
                {itemsAAjouter.length > 0 && (
                  <>
                    <h4 className="text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2">Articles ajoutés :</h4>
                    <div className="space-y-2">
                      {itemsAAjouter.map(item => (
                        <div key={item.produit_id} className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-500/10 rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium text-sm text-neutral-900 dark:text-white">{item.nom_produit}</p>
                            <p className="text-xs text-neutral-500">{formatPrice(item.prix_unitaire)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleUpdateQteAjout(item.produit_id, item.quantite - 1)}
                              className="w-6 h-6 rounded bg-white dark:bg-white/10 flex items-center justify-center text-xs">−</button>
                            <span className="font-bold text-sm w-6 text-center">{item.quantite}</span>
                            <button onClick={() => handleUpdateQteAjout(item.produit_id, item.quantite + 1)}
                              className="w-6 h-6 rounded bg-white dark:bg-white/10 flex items-center justify-center text-xs">+</button>
                            <button onClick={() => handleRemoveAjout(item.produit_id)}
                              className="ml-2 p-1 text-neutral-400 hover:text-semantic-red">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-2 border-t border-neutral-200 dark:border-white/10 text-right">
                      <span className="text-sm text-neutral-500">Total ajouté : </span>
                      <span className="font-bold text-green-600">{formatPrice(totalAjoute)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Motif */}
            <div className="bg-white dark:bg-neutral-800/40 backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 p-6">
              <label className="block text-sm font-bold text-neutral-900 dark:text-white mb-2">
                Motif de l'échange (optionnel)
              </label>
              <textarea
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Ex: Le client préfère une autre boisson..."
                className="w-full p-3 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary rounded-xl text-neutral-900 dark:text-white placeholder-neutral-400 outline-none resize-none"
                rows={2}
              />
            </div>

            {/* Résumé et soumission */}
            {itemsARetourner.length > 0 && itemsAAjouter.length > 0 && (
              <div className="bg-white dark:bg-neutral-800/40 backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 p-6">
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-4">Résumé de l'échange</h3>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">Montant retourné</span>
                    <span className="text-semantic-red font-bold">− {formatPrice(totalRetourne)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">Montant ajouté</span>
                    <span className="text-green-600 font-bold">+ {formatPrice(totalAjoute)}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-neutral-200 dark:border-white/10">
                    <span className="font-bold text-neutral-700 dark:text-neutral-300">Différence</span>
                    <span className={`font-bold text-lg ${
                      difference > 0 ? 'text-semantic-red' : difference < 0 ? 'text-green-600' : 'text-neutral-600'
                    }`}>
                      {difference > 0 ? '+' : ''}{formatPrice(difference)}
                    </span>
                  </div>
                  {difference > 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      Le client devra payer {formatPrice(difference)} supplémentaires.
                    </p>
                  )}
                  {difference < 0 && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
                      <RefreshCw className="w-4 h-4" />
                      Un remboursement de {formatPrice(Math.abs(difference))} sera effectué.
                    </p>
                  )}
                </div>
                <button
                  onClick={handleProcessEchange}
                  disabled={isProcessing}
                  className="w-full py-4 bg-primary dark:bg-dark-accent text-white rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      Traitement en cours...
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft className="w-5 h-5" />
                      Confirmer l'échange
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ─── Liste des factures ─── */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFactures?.map(facture => (
              <div
                key={facture.id}
                onClick={() => handleSelectFacture(facture)}
                className="bg-white dark:bg-neutral-800/40 backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 shadow-soft overflow-hidden cursor-pointer hover:border-purple-500/30 transition-all"
              >
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-purple-100 dark:bg-purple-500/20 text-purple-600 size-10 rounded-lg flex items-center justify-center">
                      <ArrowRightLeft className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-neutral-900 dark:text-white">
                        {facture.commandes?.numero_commande}
                      </h3>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        Table {facture.commandes?.tables?.numero}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-500 dark:text-neutral-400">
                      {format(new Date(facture.date_generation), 'dd MMM yyyy', { locale: fr })}
                    </span>
                    <span className="font-bold text-neutral-900 dark:text-white">{formatPrice(facture.montant_total)}</span>
                  </div>
                  <div className="mt-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      facture.statut === 'payee'
                        ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                        : facture.statut === 'partiellement_payee'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'
                    }`}>
                      {facture.statut === 'payee' ? 'Payée' : facture.statut === 'partiellement_payee' ? 'Partielle' : 'En attente'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {filteredFactures?.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-neutral-400 dark:text-neutral-500">
                <Package className="w-12 h-12 mb-2 opacity-50" />
                <p>Aucune facture éligible</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
