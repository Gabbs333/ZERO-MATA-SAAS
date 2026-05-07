import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';
import { Produit } from '../types/database.types';
import { formatMontant } from '../utils/format';
import {
  Search,
  Plus,
  Wine,
  Utensils,
  Package,
  Edit,
  X,
  Archive,
  ArchiveRestore,
  Trash2
} from 'lucide-react';
import { twMerge } from 'tailwind-merge';

type ProductFormData = Omit<Produit, 'id' | 'etablissement_id' | 'date_creation' | 'date_modification'>;

const INITIAL_FORM_DATA: ProductFormData = {
  nom: '',
  categorie: 'boisson',
  prix_vente: 0,
  prix_achat: 0,
  cout_moyen_pourcentage: null,
  actif: true
};

export function ProduitsScreen() {
  const profile = useAuthStore((state) => state.profile);
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'boisson' | 'nourriture' | 'autre'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Produit | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(INITIAL_FORM_DATA);
  const [initialStock, setInitialStock] = useState<number | ''>(''); // State for initial stock (new product)
  const [currentStock, setCurrentStock] = useState<number | null>(null); // Current stock level (edit mode)
  const [newStock, setNewStock] = useState<number | ''>(''); // New stock value (edit mode)
  const [selectedPercentage, setSelectedPercentage] = useState<number | null>(null); // Selected COGS percentage
  const [customPercentage, setCustomPercentage] = useState<number | ''>('');
  const [showCustomPercentage, setShowCustomPercentage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error] = useState<string | null>(null);

  // Global cost percentage settings
  const [globalPercentage, setGlobalPercentage] = useState<number | null>(null);
  const [globalCustomPct, setGlobalCustomPct] = useState<number | ''>('');
  const [showGlobalCustom, setShowGlobalCustom] = useState(false);
  const [isApplyingGlobal, setIsApplyingGlobal] = useState(false);
  const [globalMessage, setGlobalMessage] = useState<string | null>(null);

  const { data: produits, isPending: isLoading, refetch } = useSupabaseQuery<Produit[]>(
    ['produits', profile?.etablissement_id],
    async () => {
      if (!profile?.etablissement_id) return { data: [] as Produit[], error: null };

      return await supabase
        .from('produits')
        .select('*')
        .eq('etablissement_id', profile.etablissement_id)
        .order('nom');
    },
    { enabled: !!profile?.etablissement_id }
  );

  // Fetch établissement's global cout_moyen_pourcentage
  useEffect(() => {
    if (!profile?.etablissement_id) return;
    supabase
      .from('etablissements')
      .select('cout_moyen_pourcentage')
      .eq('id', profile.etablissement_id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setGlobalPercentage(data.cout_moyen_pourcentage ?? null);
        }
      });
  }, [profile?.etablissement_id]);

  // Update établissement's global cout_moyen_pourcentage
  const handleGlobalPercentageChange = async (pct: number | null) => {
    if (!profile?.etablissement_id) return;
    setGlobalPercentage(pct);
    setGlobalMessage(null);
    const { error } = await supabase
      .from('etablissements')
      .update({ cout_moyen_pourcentage: pct })
      .eq('id', profile.etablissement_id);
    if (error) {
      console.error('Error updating global percentage:', error);
      setGlobalMessage('❌ Erreur lors de la mise à jour');
    }
  };

  // Apply global percentage to all products via RPC (single atomic call)
  const handleApplyGlobal = async () => {
    if (!profile?.etablissement_id || globalPercentage === null) return;
    setIsApplyingGlobal(true);
    setGlobalMessage(null);
    try {
      const { data, error } = await supabase.rpc('apply_cout_global', {
        p_pourcentage: globalPercentage
      });
      if (error) throw error;
      setGlobalMessage(data?.message || `✅ Coût global de ${globalPercentage}% appliqué à tous les produits`);
      refetch();
    } catch (err: any) {
      console.error('Error applying global percentage:', err);
      setGlobalMessage('❌ ' + (err.message || 'Erreur lors de l\'application'));
    } finally {
      setIsApplyingGlobal(false);
    }
  };

  const handleOpenModal = async (product?: Produit) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        nom: product.nom,
        categorie: product.categorie,
        prix_vente: product.prix_vente,
        prix_achat: product.prix_achat || 0,
        cout_moyen_pourcentage: product.cout_moyen_pourcentage ?? null,
        actif: product.actif
      });
      setInitialStock('');
      setCustomPercentage('');
      setShowCustomPercentage(false);

      // Pre-select percentage from product or établissement default
      const percentage = product.cout_moyen_pourcentage ?? profile?.etablissement?.cout_moyen_pourcentage ?? null;
      setSelectedPercentage(percentage);

      // Fetch current stock for this product (skip for nourriture)
      if (product.categorie !== 'nourriture') {
        try {
          const { data: stockData, error: stockErr } = await supabase
            .from('stocks')
            .select('quantite_actuelle')
            .eq('produit_id', product.id)
            .eq('etablissement_id', profile?.etablissement_id)
            .maybeSingle();

          if (!stockErr && stockData) {
            setCurrentStock(stockData.quantite_actuelle);
            setNewStock('');
          } else {
            setCurrentStock(0);
            setNewStock('');
          }
        } catch {
          setCurrentStock(null);
          setNewStock('');
        }
      } else {
        setCurrentStock(null);
        setNewStock('');
      }
    } else {
      setEditingProduct(null);
      setFormData(INITIAL_FORM_DATA);
      setInitialStock('');
      setCurrentStock(null);
      setNewStock('');
      setCustomPercentage('');
      setShowCustomPercentage(false);
      // Pre-select default percentage from établissement
      setSelectedPercentage(profile?.etablissement?.cout_moyen_pourcentage ?? null);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setFormData(INITIAL_FORM_DATA);
    setInitialStock('');
    setCurrentStock(null);
    setNewStock('');
    setSelectedPercentage(null);
    setCustomPercentage('');
    setShowCustomPercentage(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.etablissement_id) return;

    setIsSubmitting(true);
    try {
      if (editingProduct) {
        const { error } = await supabase
          .from('produits')
          .update({
            ...formData,
            date_modification: new Date().toISOString()
          })
          .eq('id', editingProduct.id);
        if (error) throw error;

        // Adjust stock if the user changed it (skip for nourriture)
        if (formData.categorie !== 'nourriture' && newStock !== '' && currentStock !== null && Number(newStock) !== currentStock) {
          const { error: stockAdjustError } = await supabase
            .rpc('adjust_stock_from_product', {
              p_produit_id: editingProduct.id,
              p_nouvelle_quantite: Number(newStock),
              p_motif: 'Ajustement depuis la fiche produit'
            });

          if (stockAdjustError) {
            console.error('Error adjusting stock:', stockAdjustError);
            alert(`Attention: Le produit a été modifié mais le stock n'a pas pu être ajusté. Erreur: ${stockAdjustError.message}`);
          } else {
            queryClient.invalidateQueries({ queryKey: ['stocks'] });
          }
        }
      } else {
        const { data, error } = await supabase
          .from('produits')
          .insert({
            ...formData,
            etablissement_id: profile.etablissement_id,
            date_creation: new Date().toISOString()
          })
          .select('id')
          .single();

        if (error) throw error;

        // Create a stock entry (skip for nourriture)
        if (formData.categorie !== 'nourriture' && data?.id) {
            console.log('Product created with ID:', data.id);
            const { error: stockError } = await supabase
                .from('stocks')
                .insert({
                    produit_id: data.id,
                    etablissement_id: profile.etablissement_id,
                    quantite_actuelle: initialStock !== '' ? Number(initialStock) : 0,
                    seuil_alerte: 10, // Default alert threshold
                });

            if (stockError) {
                console.error('Error creating initial stock:', stockError);
                // Check if error is unique violation (23505) - meaning stock already exists (maybe via trigger)
                if (stockError.code === '23505') {
                    console.log('Stock entry already exists (likely created by trigger). Ignoring.');
                } else {
                    alert(`Attention: Le produit a été créé mais le stock n'a pas pu être initialisé. Erreur: ${stockError.message}`);
                }
            } else {
                console.log('Stock entry created successfully');
            }
        }

        // Invalidate stocks query to refresh the list (skip for nourriture)
        if (formData.categorie !== 'nourriture') {
          queryClient.invalidateQueries({ queryKey: ['stocks'] });
        }
      }
      refetch();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Error saving product');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (product: Produit) => {
    try {
      const { error } = await supabase
        .from('produits')
        .update({ actif: !product.actif })
        .eq('id', product.id);

      if (error) throw error;
      refetch();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleDeleteProduct = async (product: Produit) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer le produit "${product.nom}" ? Cette action est irréversible.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('produits')
        .delete()
        .eq('id', product.id);

      if (error) {
        console.error('Error deleting product:', error);
        // Check for foreign key violation code (23503 is common for Postgres)
        if (error.code === '23503') {
             alert("Impossible de supprimer ce produit car il est lié à des commandes ou des stocks existants. Vous pouvez le désactiver à la place.");
        } else {
             alert("Erreur lors de la suppression du produit.");
        }
      } else {
        // Invalidate stocks query to refresh the list
        queryClient.invalidateQueries({ queryKey: ['stocks'] });
        refetch();
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      alert("Erreur lors de la suppression du produit.");
    }
  };

  const filteredProduits = produits?.filter(product => {
    const matchesSearch = product.nom.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || product.categorie === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="pb-20 md:pb-6 relative bg-neutral-50 dark:bg-dark-bg min-h-screen">
      {/* Header */}
      <div className="p-4 md:p-6 bg-white dark:bg-dark-card/30 dark:backdrop-blur-xl border-b border-neutral-200 dark:border-white/5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary dark:text-white font-display">Produits</h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">
              Gérez votre catalogue et vos tarifs
            </p>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-primary dark:bg-dark-accent text-white rounded-lg font-bold text-sm hover:opacity-90 transition-opacity self-start md:self-auto"
          >
            <Plus className="w-5 h-5" />
            <span>Nouveau Produit</span>
          </button>
        </div>

        {/* Filters */}
        <div className="mt-6 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher un produit..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-neutral-100 dark:bg-dark-card/40 border-none rounded-lg text-primary dark:text-white placeholder-neutral-400 focus:ring-2 focus:ring-primary dark:focus:ring-dark-accent transition-all outline-none"
            />
          </div>

          <div className="flex p-1 bg-neutral-100 dark:bg-dark-card/40 rounded-lg overflow-x-auto">
            {(['all', 'boisson', 'nourriture', 'autre'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={twMerge(
                  "px-4 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap capitalize",
                  categoryFilter === cat
                    ? "bg-white dark:bg-dark-accent text-primary dark:text-white shadow-sm"
                    : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                )}
              >
                {cat === 'all' ? 'Tous' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Global Cost Percentage Bar */}
        <div className="mt-4 p-3 bg-white dark:bg-dark-card/40 rounded-xl border border-neutral-200 dark:border-white/5 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-primary dark:text-white whitespace-nowrap">
            <span>🏷️</span>
            <span>Coût d'achat par défaut :</span>
          </div>
          {!showGlobalCustom ? (
            <select
              value={globalPercentage ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'custom') {
                  setShowGlobalCustom(true);
                } else if (val === '') {
                  handleGlobalPercentageChange(null);
                } else {
                  handleGlobalPercentageChange(parseInt(val));
                }
              }}
              className="px-3 py-1.5 bg-neutral-100 dark:bg-dark-card/40 border border-neutral-200 dark:border-white/10 rounded-lg text-sm font-bold text-primary dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-dark-accent outline-none"
            >
              <option value="">— Sélectionner —</option>
              {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((pct) => (
                <option key={pct} value={pct}>{pct}%</option>
              ))}
              <option value="custom">Personnalisé...</option>
            </select>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                value={globalCustomPct}
                placeholder="Ex: 33"
                onChange={(e) => {
                  const v = e.target.value === '' ? '' : parseInt(e.target.value);
                  setGlobalCustomPct(v);
                }}
                className="w-20 px-2 py-1.5 bg-neutral-100 dark:bg-dark-card/40 border border-neutral-200 dark:border-white/10 rounded-lg text-sm font-bold text-primary dark:text-white outline-none focus:ring-2 focus:ring-primary"
              />
              <span className="text-sm font-bold text-neutral-500">%</span>
              <button
                onClick={() => {
                  if (globalCustomPct !== '' && !isNaN(Number(globalCustomPct))) {
                    handleGlobalPercentageChange(Number(globalCustomPct));
                    setShowGlobalCustom(false);
                  }
                }}
                className="px-2 py-1 bg-primary/10 dark:bg-dark-accent/10 text-primary dark:text-dark-accent rounded-lg text-xs font-bold hover:bg-primary/20"
              >
                OK
              </button>
              <button
                onClick={() => { setShowGlobalCustom(false); setGlobalCustomPct(''); }}
                className="px-2 py-1 text-neutral-400 hover:text-neutral-600 text-xs"
              >
                ✕
              </button>
            </div>
          )}
          <button
            onClick={handleApplyGlobal}
            disabled={globalPercentage === null || isApplyingGlobal}
            className="ml-auto px-3 py-1.5 bg-primary dark:bg-dark-accent text-white rounded-lg text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50 whitespace-nowrap"
          >
            {isApplyingGlobal ? 'Application...' : 'Appliquer à tous'}
          </button>
        </div>

        {globalMessage && (
          <div className={`mt-2 p-2 rounded-lg text-sm font-medium ${
            globalMessage.startsWith('✅')
              ? 'bg-semantic-green/10 border border-semantic-green/20 text-semantic-green'
              : 'bg-semantic-red/10 border border-semantic-red/20 text-semantic-red'
          }`}>
            {globalMessage}
          </div>
        )}
      </div>

      {/* Product List */}
      <div className="p-4 md:p-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary dark:border-white"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProduits?.map((product) => (
              <div key={product.id} className={twMerge(
                "bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-xl border shadow-soft overflow-hidden group hover:border-primary/20 dark:hover:border-dark-accent/30 transition-all",
                product.actif ? "border-neutral-200 dark:border-white/5" : "border-neutral-100 dark:border-white/5 opacity-60"
              )}>
                <div className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className={twMerge(
                        "flex items-center justify-center size-10 rounded-lg",
                        product.categorie === 'boisson' ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" :
                        product.categorie === 'nourriture' ? "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400" :
                        "bg-gray-50 text-gray-600 dark:bg-white/10 dark:text-gray-400"
                      )}>
                        {product.categorie === 'boisson' ? <Wine className="w-5 h-5" /> :
                         product.categorie === 'nourriture' ? <Utensils className="w-5 h-5" /> :
                         <Package className="w-5 h-5" />}
                      </div>
                      <div>
                        <h3 className="font-bold text-primary dark:text-white text-sm leading-tight">{product.nom}</h3>
                        <p className="text-xs text-neutral-500 capitalize">{product.categorie}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handleOpenModal(product)}
                            className="text-neutral-400 hover:text-primary dark:hover:text-white transition-colors"
                            title="Modifier"
                        >
                            <Edit className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => handleDeleteProduct(product)}
                            className="text-neutral-400 hover:text-red-500 transition-colors"
                            title="Supprimer"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4">
                     <div className="flex flex-col">
                        <span className="text-[10px] uppercase text-neutral-400 font-bold tracking-wider">Prix Vente</span>
                        <span className="text-lg font-bold text-primary dark:text-white">
                            {formatMontant(product.prix_vente)}
                        </span>
                     </div>
                     <div className="flex flex-col items-end">
                        <span className="text-[10px] uppercase text-neutral-400 font-bold tracking-wider">Prix Achat</span>
                        <span className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
                            {product.prix_achat ? formatMontant(product.prix_achat) : '-'}
                        </span>
                     </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-neutral-100 dark:border-white/5">
                      <div className="flex items-center gap-2">
                        <div className={twMerge(
                          "size-2 rounded-full",
                          product.actif ? "bg-semantic-green" : "bg-neutral-300"
                        )}></div>
                        <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                            {product.actif ? 'Actif' : 'Inactif'}
                        </span>
                      </div>
                      <button
                        onClick={() => handleToggleStatus(product)}
                        className={twMerge(
                          "flex items-center gap-1.5 text-xs font-semibold transition-colors",
                          product.actif ? "text-semantic-red hover:text-red-700" : "text-semantic-green hover:text-green-700"
                        )}
                      >
                          {product.actif ? <Archive className="w-3.5 h-3.5" /> : <ArchiveRestore className="w-3.5 h-3.5" />}
                          {product.actif ? 'Désactiver' : 'Activer'}
                      </button>
                  </div>
                </div>
              </div>
            ))}

            {filteredProduits?.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-12 text-neutral-400">
                    <Search className="w-12 h-12 mb-2 opacity-50" />
                    <p>Aucun produit trouvé</p>
                    <button
                        onClick={() => handleOpenModal()}
                        className="mt-4 text-primary dark:text-white font-bold text-sm hover:underline"
                    >
                        Créer un nouveau produit
                    </button>
                </div>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-dark-card/90 dark:backdrop-blur-xl rounded-2xl w-full max-w-lg shadow-2xl border border-neutral-200 dark:border-white/5 overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
            <div className="p-4 md:p-6 border-b border-neutral-100 dark:border-white/5 flex justify-between items-center">
              <h2 className="text-xl font-bold text-primary dark:text-white font-display">
                {editingProduct ? 'Modifier Produit' : 'Nouveau Produit'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-neutral-400 hover:text-primary dark:hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {error && (
              <div className="mx-4 md:mx-6 mt-4 p-3 bg-semantic-red/10 border border-semantic-red/20 rounded-lg flex items-center gap-2 text-semantic-red text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-semantic-red" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-primary dark:text-white mb-1.5">Nom du Produit</label>
                <input
                  type="text"
                  required
                  value={formData.nom}
                  onChange={e => setFormData({...formData, nom: e.target.value})}
                  className="w-full px-4 py-2 bg-neutral-100 dark:bg-dark-card/40 border-none rounded-lg text-primary dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-dark-accent outline-none"
                  placeholder="ex: Coca Cola"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-primary dark:text-white mb-1.5">Catégorie</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['boisson', 'nourriture', 'autre'] as const).map((cat) => (
                    <button
                      type="button"
                      key={cat}
                      onClick={() => setFormData({...formData, categorie: cat})}
                      className={`px-4 py-2 rounded-lg text-sm font-medium capitalize border-2 transition-all ${
                        formData.categorie === cat
                          ? 'border-primary dark:border-dark-accent text-primary dark:text-white bg-primary/5 dark:bg-dark-accent/10'
                          : 'border-transparent bg-neutral-100 dark:bg-dark-card/40 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-dark-card/60'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-primary dark:text-white mb-1.5">Prix Vente</label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.prix_vente}
                      onChange={e => setFormData({...formData, prix_vente: parseInt(e.target.value) || 0})}
                      className="w-full pl-4 pr-12 py-2 bg-neutral-100 dark:bg-dark-card/40 border-none rounded-lg text-primary dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-dark-accent outline-none"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 text-sm font-medium">XAF</span>
                  </div>
                </div>

                {formData.categorie !== 'nourriture' ? (
                  <div>
                    <label className="block text-sm font-bold text-primary dark:text-white mb-1.5">Prix Achat</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        value={formData.prix_achat}
                        onChange={e => setFormData({...formData, prix_achat: parseInt(e.target.value) || 0})}
                        className="w-full pl-4 pr-12 py-2 bg-neutral-100 dark:bg-dark-card/40 border-none rounded-lg text-primary dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-dark-accent outline-none"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 text-sm font-medium">XAF</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-bold text-primary dark:text-white mb-1.5">Prix Achat (calculé)</label>
                    <div className="relative">
                      <div className="w-full pl-4 pr-12 py-2 bg-neutral-100 dark:bg-dark-card/40 border-none rounded-lg text-primary dark:text-white font-bold">
                        {formData.prix_achat > 0 ? `${formData.prix_achat.toLocaleString()} XAF` : '—'}
                      </div>
                    </div>
                  </div>
                )}

                {/* COGS Percentage Selector */}
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-primary dark:text-white mb-1.5">
                    Coût moyen (% du prix de vente)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        disabled={!formData.prix_vente || formData.prix_vente <= 0}
                        onClick={() => {
                          const calculated = Math.round(formData.prix_vente * pct / 100);
                          setFormData({
                            ...formData,
                            prix_achat: calculated,
                            cout_moyen_pourcentage: pct
                          });
                          setSelectedPercentage(pct);
                          setShowCustomPercentage(false);
                          setCustomPercentage('');
                        }}
                        className={twMerge(
                          "px-3 py-1.5 text-xs font-bold rounded-lg border-2 transition-all",
                          selectedPercentage === pct && !showCustomPercentage
                            ? "border-primary dark:border-dark-accent bg-primary/10 dark:bg-dark-accent/20 text-primary dark:text-white"
                            : "border-neutral-200 dark:border-white/10 text-neutral-500 dark:text-neutral-400 hover:border-primary/50 dark:hover:border-dark-accent/50",
                          (!formData.prix_vente || formData.prix_vente <= 0) && "opacity-40 cursor-not-allowed"
                        )}
                      >
                        {pct}%
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={!formData.prix_vente || formData.prix_vente <= 0}
                      onClick={() => {
                        setShowCustomPercentage(true);
                        setSelectedPercentage(null);
                      }}
                      className={twMerge(
                        "px-3 py-1.5 text-xs font-bold rounded-lg border-2 transition-all",
                        showCustomPercentage
                          ? "border-primary dark:border-dark-accent bg-primary/10 dark:bg-dark-accent/20 text-primary dark:text-white"
                          : "border-neutral-200 dark:border-white/10 text-neutral-500 dark:text-neutral-400 hover:border-primary/50 dark:hover:border-dark-accent/50",
                        (!formData.prix_vente || formData.prix_vente <= 0) && "opacity-40 cursor-not-allowed"
                      )}
                    >
                      Personnalisé
                    </button>
                  </div>
                  {showCustomPercentage && (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={customPercentage}
                        onChange={e => {
                          const val = e.target.value === '' ? '' : parseInt(e.target.value);
                          setCustomPercentage(val);
                          if (val !== '' && !isNaN(Number(val))) {
                            const pct = Number(val);
                            const calculated = Math.round(formData.prix_vente * pct / 100);
                            setFormData({
                              ...formData,
                              prix_achat: calculated,
                              cout_moyen_pourcentage: pct
                            });
                          }
                        }}
                        placeholder="Ex: 25"
                        className="w-24 px-3 py-1.5 bg-neutral-100 dark:bg-dark-card/40 border-none rounded-lg text-sm text-primary dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-dark-accent outline-none"
                      />
                      <span className="text-sm text-neutral-500 dark:text-neutral-400">%</span>
                    </div>
                  )}
                </div>

                {/* Stock section: different for new vs edit (hidden for nourriture) */}
                {formData.categorie !== 'nourriture' && (
                  editingProduct ? (
                    <div className="col-span-2 space-y-3">
                      <div className="p-3 bg-neutral-100 dark:bg-dark-card/40 rounded-lg">
                        <span className="text-sm text-neutral-500 dark:text-neutral-400">Stock actuel : </span>
                        <span className="text-sm font-bold text-primary dark:text-white">
                          {currentStock !== null ? `${currentStock} unités` : '—'}
                        </span>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-primary dark:text-white mb-1.5">
                          Nouveau stock
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={newStock}
                          onChange={e => setNewStock(e.target.value === '' ? '' : parseInt(e.target.value))}
                          placeholder={currentStock !== null ? `${currentStock}` : 'Nouvelle quantité'}
                          className="w-full px-4 py-2 bg-neutral-100 dark:bg-dark-card/40 border-none rounded-lg text-primary dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-dark-accent outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="col-span-2">
                      <label className="block text-sm font-bold text-primary dark:text-white mb-1.5">
                        Stock Initial <span className="text-neutral-400 font-normal">(Optionnel)</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={initialStock}
                        onChange={e => setInitialStock(e.target.value === '' ? '' : parseInt(e.target.value))}
                        placeholder="Quantité initiale en stock"
                        className="w-full px-4 py-2 bg-neutral-100 dark:bg-dark-card/40 border-none rounded-lg text-primary dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-dark-accent outline-none"
                      />
                    </div>
                  )
                )}
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-dark-card/40 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-primary dark:bg-dark-accent text-white rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
