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
  actif: true,
  gestion_stock: true
};

// ---------------------------------------------------------------------------
// Tarifs contextuels : formulaire et affichage des conditions
// ---------------------------------------------------------------------------

const JOURS_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

const emptyTarifForm = () => ({
  nom_tarif: '',
  prix_vente: '',
  jours_semaine: [] as number[],
  heure_debut: '',
  heure_fin: '',
  date_debut: '',
  date_fin: '',
  priorite: 0,
  modele_id: '',
});

const describeTarifConditions = (t: any): string => {
  const parts: string[] = [];

  if (t.jours_semaine && t.jours_semaine.length > 0) {
    parts.push(t.jours_semaine.map((d: number) => JOURS_LABELS[d] ?? d).join(', '));
  } else {
    parts.push('Tous les jours');
  }

  if (t.heure_debut && t.heure_fin) {
    parts.push(`${String(t.heure_debut).slice(0, 5)} → ${String(t.heure_fin).slice(0, 5)}`);
  } else {
    parts.push('Toute la journée');
  }

  if (t.date_debut || t.date_fin) {
    parts.push(`Du ${t.date_debut || '…'} au ${t.date_fin || '…'}`);
  }

  if (Number(t.priorite) !== 0) {
    parts.push(`Priorité ${t.priorite}`);
  }

  return parts.join(' • ');
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

  // État pour la gestion des tarifs spécifiques (Happy Hours / Saisons)
  const [isTarifsModalOpen, setIsTarifsModalOpen] = useState(false);
  const [selectedProductForTarifs, setSelectedProductForTarifs] = useState<Produit | null>(null);
  const [tarifsList, setTarifsList] = useState<any[]>([]);
  const [isFetchingTarifs, setIsFetchingTarifs] = useState(false);
  const [produitsAvecTarifs, setProduitsAvecTarifs] = useState<Record<string, number>>({});

  // Bibliothèque de tarifs réutilisables
  const [tarifsModeles, setTarifsModeles] = useState<any[]>([]);
  const [isFetchingModeles, setIsFetchingModeles] = useState(false);
  const [saveAsModele, setSaveAsModele] = useState(true);
  const [tarifMessage, setTarifMessage] = useState<string | null>(null);
  const [applyModele, setApplyModele] = useState<{ modele: any; selected: string[]; search: string } | null>(null);
  const [isApplyingModele, setIsApplyingModele] = useState(false);

  // Formulaire nouveau tarif
  const [tarifForm, setTarifForm] = useState(emptyTarifForm());

  const refreshTarifCounts = async () => {
    if (!profile?.etablissement_id) return;
    const { data } = await supabase
      .from('tarifs_specifiques')
      .select('produit_id')
      .eq('etablissement_id', profile.etablissement_id)
      .eq('actif', true);
    if (data) {
      const counts: Record<string, number> = {};
      data.forEach((t: any) => {
        counts[t.produit_id] = (counts[t.produit_id] || 0) + 1;
      });
      setProduitsAvecTarifs(counts);
    }
  };

  // Charger les compteurs de tarifs par produit
  useEffect(() => {
    refreshTarifCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.etablissement_id, isTarifsModalOpen]);

  const fetchModeles = async () => {
    if (!profile?.etablissement_id) return;
    setIsFetchingModeles(true);
    const { data, error } = await supabase
      .from('tarifs_modeles')
      .select('*')
      .eq('etablissement_id', profile.etablissement_id)
      .order('nom', { ascending: true });
    if (!error && data) setTarifsModeles(data);
    setIsFetchingModeles(false);
  };

  const handleOpenTarifsModal = async (product: Produit) => {
    setSelectedProductForTarifs(product);
    setIsTarifsModalOpen(true);
    setTarifMessage(null);
    setTarifForm(emptyTarifForm());
    setSaveAsModele(true);
    await Promise.all([fetchTarifs(product.id), fetchModeles()]);
  };

  const fetchTarifs = async (produitId: string) => {
    setIsFetchingTarifs(true);
    const { data, error } = await supabase
      .from('tarifs_specifiques')
      .select('*')
      .eq('produit_id', produitId)
      .order('priorite', { ascending: false });
    if (!error && data) {
      setTarifsList(data);
    } else {
      setTarifsList([]);
    }
    setIsFetchingTarifs(false);
  };

  /** Pré-remplit le formulaire depuis un modèle de la bibliothèque. */
  const handleUseModele = (modele: any) => {
    setTarifForm({
      nom_tarif: modele.nom,
      prix_vente: String(modele.prix_vente),
      jours_semaine: modele.jours_semaine || [],
      heure_debut: modele.heure_debut ? String(modele.heure_debut).slice(0, 5) : '',
      heure_fin: modele.heure_fin ? String(modele.heure_fin).slice(0, 5) : '',
      date_debut: modele.date_debut || '',
      date_fin: modele.date_fin || '',
      priorite: modele.priorite ?? 0,
      modele_id: modele.id,
    });
    setSaveAsModele(false);
    setTarifMessage(`Modèle « ${modele.nom} » chargé. Ajustez le prix si besoin, puis enregistrez.`);
  };

  const handleAddTarif = async (e?: any) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    if (!selectedProductForTarifs || !profile?.etablissement_id) return;

    const nom = tarifForm.nom_tarif.trim();
    const prix = Number(tarifForm.prix_vente);

    if (!nom) {
      setTarifMessage('Le nom du tarif est obligatoire.');
      return;
    }
    if (!Number.isFinite(prix) || prix < 0) {
      setTarifMessage('Le prix doit être un nombre positif.');
      return;
    }

    setTarifMessage(null);

    try {
      let modeleId: string | null = tarifForm.modele_id || null;

      // Enregistrement (ou mise à jour) du modèle réutilisable
      if (saveAsModele) {
        const { data: modele, error: modeleError } = await supabase
          .from('tarifs_modeles')
          .upsert({
            etablissement_id: profile.etablissement_id,
            nom,
            prix_vente: prix,
            jours_semaine: tarifForm.jours_semaine.length > 0 ? tarifForm.jours_semaine : null,
            heure_debut: tarifForm.heure_debut || null,
            heure_fin: tarifForm.heure_fin || null,
            date_debut: tarifForm.date_debut || null,
            date_fin: tarifForm.date_fin || null,
            priorite: Number(tarifForm.priorite) || 0,
            actif: true,
            date_mise_a_jour: new Date().toISOString(),
          }, { onConflict: 'etablissement_id,nom' })
          .select()
          .single();

        if (modeleError) throw modeleError;
        modeleId = modele.id;
      }

      const payload = {
        etablissement_id: profile.etablissement_id,
        produit_id: selectedProductForTarifs.id,
        modele_id: modeleId,
        nom_tarif: nom,
        prix_vente: prix,
        jours_semaine: tarifForm.jours_semaine.length > 0 ? tarifForm.jours_semaine : null,
        heure_debut: tarifForm.heure_debut || null,
        heure_fin: tarifForm.heure_fin || null,
        date_debut: tarifForm.date_debut || null,
        date_fin: tarifForm.date_fin || null,
        priorite: Number(tarifForm.priorite) || 0,
        actif: true,
      };

      const { error } = modeleId
        ? await supabase
            .from('tarifs_specifiques')
            .upsert(payload, { onConflict: 'produit_id,modele_id' })
        : await supabase.from('tarifs_specifiques').insert(payload);

      if (error) throw error;

      setTarifForm(emptyTarifForm());
      setSaveAsModele(true);
      setTarifMessage(
        modeleId
          ? 'Règle enregistrée. Elle est disponible dans la bibliothèque pour les autres produits.'
          : 'Règle enregistrée sur ce produit.'
      );

      await Promise.all([fetchTarifs(selectedProductForTarifs.id), fetchModeles()]);
      await refreshTarifCounts();
    } catch (err: any) {
      console.error('Error saving tarif:', err);
      setTarifMessage('Erreur : ' + (err?.message || 'enregistrement impossible'));
    }
  };

  const handleDeleteTarif = async (tarifId: string) => {
    if (!confirm('Voulez-vous supprimer cette règle tarifaire ?')) return;
    const { error } = await supabase.from('tarifs_specifiques').delete().eq('id', tarifId);
    if (!error && selectedProductForTarifs) {
      await fetchTarifs(selectedProductForTarifs.id);
      await refreshTarifCounts();
    }
  };

  const handleDeleteModele = async (modele: any) => {
    if (!confirm(`Supprimer le modèle « ${modele.nom} » de la bibliothèque ?\nLes règles déjà appliquées aux produits sont conservées.`)) return;
    const { error } = await supabase.from('tarifs_modeles').delete().eq('id', modele.id);
    if (error) {
      setTarifMessage('Erreur : ' + error.message);
      return;
    }
    await fetchModeles();
  };

  const handleApplyModele = async () => {
    if (!applyModele) return;
    setIsApplyingModele(true);
    setTarifMessage(null);
    try {
      const { data, error } = await supabase.rpc('appliquer_modele_tarif', {
        p_modele_id: applyModele.modele.id,
        p_produit_ids: applyModele.selected,
      });
      if (error) throw error;
      const nb = (data as any)?.produits ?? applyModele.selected.length;
      setApplyModele(null);
      setTarifMessage(`« ${applyModele.modele.nom} » appliqué à ${nb} produit(s).`);
      if (selectedProductForTarifs) await fetchTarifs(selectedProductForTarifs.id);
      await refreshTarifCounts();
    } catch (err: any) {
      console.error('Error applying modele:', err);
      setTarifMessage('Erreur : ' + (err?.message || 'application impossible'));
    } finally {
      setIsApplyingModele(false);
    }
  };

  // Produits proposés dans le sélecteur « Appliquer à… »
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

  const filteredApplyProduits = ((produits || []) as Produit[]).filter((p) => {
    if (!applyModele) return false;
    const q = applyModele.search.trim().toLowerCase();
    return !q || p.nom.toLowerCase().includes(q);
  });
  const tousApplySelectionnes =
    filteredApplyProduits.length > 0 &&
    filteredApplyProduits.every((p) => applyModele?.selected.includes(p.id));

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
        actif: product.actif,
        gestion_stock: product.gestion_stock ?? (product.categorie !== 'nourriture')
      });
      setInitialStock('');
      setCustomPercentage('');
      setShowCustomPercentage(false);

      // Pre-select percentage from product or établissement default
      const percentage = product.cout_moyen_pourcentage ?? profile?.etablissement?.cout_moyen_pourcentage ?? null;
      setSelectedPercentage(percentage);

      // Fetch current stock for this product (uniquement si gestion de stock active)
      if (product.categorie !== 'nourriture' || product.gestion_stock) {
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

        // Adjust stock if the user changed it (pour les produits avec gestion de stock active)
        if ((formData.categorie !== 'nourriture' || formData.gestion_stock) && newStock !== '' && currentStock !== null && Number(newStock) !== currentStock) {
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

        // Create a stock entry (pour les produits avec gestion de stock active, y compris la nourriture en unités)
        if ((formData.categorie !== 'nourriture' || formData.gestion_stock) && data?.id) {
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

        // Invalidate stocks query to refresh the list (pour les produits avec gestion de stock active)
        if (formData.categorie !== 'nourriture' || formData.gestion_stock) {
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
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-primary dark:text-white text-sm leading-tight">{product.nom}</h3>
                          {produitsAvecTarifs[product.id] > 0 && (
                            <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded text-[9px] font-bold" title={`${produitsAvecTarifs[product.id]} tarif(s) dynamique(s) actif(s)`}>
                              ⚡ {produitsAvecTarifs[product.id]} tarif{produitsAvecTarifs[product.id] > 1 ? 's' : ''} actif{produitsAvecTarifs[product.id] > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-500 capitalize">{product.categorie}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handleOpenTarifsModal(product)}
                            className="text-neutral-400 hover:text-amber-500 transition-colors"
                            title="Gérer les tarifs dynamiques (Happy Hours, Week-end...)"
                        >
                            <span className="text-xs font-bold px-1.5 py-0.5 bg-amber-500/10 text-amber-600 rounded">⏱️ Tarif</span>
                        </button>
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
                      onClick={() => setFormData({...formData, categorie: cat, gestion_stock: cat !== 'nourriture' ? true : formData.gestion_stock})}
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

              {/* Option gestion de stock (Particulièrement utile pour la nourriture en unités) */}
              {formData.categorie === 'nourriture' && (
                <div className="p-4 bg-orange-500/5 border border-orange-500/20 rounded-xl flex items-center justify-between">
                  <div>
                    <label className="text-sm font-bold text-primary dark:text-white block">Activer le suivi de stock (Unités préparées)</label>
                    <p className="text-xs text-neutral-500">Cochez si ce plat est préparé en unités et doit être décompté du stock à chaque vente.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.gestion_stock ?? false}
                    onChange={e => setFormData({...formData, gestion_stock: e.target.checked})}
                    className="w-5 h-5 accent-primary dark:accent-dark-accent cursor-pointer"
                  />
                </div>
              )}

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
                        {(formData.prix_achat ?? 0) > 0 ? `${(formData.prix_achat ?? 0).toLocaleString()} XAF` : '—'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Modal Tarifs Spécifiques / Happy Hours */}
                {isTarifsModalOpen && selectedProductForTarifs && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                    <div className="bg-white dark:bg-dark-card/95 rounded-2xl w-full max-w-2xl shadow-2xl border border-neutral-200 dark:border-white/5 overflow-hidden max-h-[90vh] flex flex-col">
                      <div className="p-4 md:p-6 border-b border-neutral-100 dark:border-white/5 flex justify-between items-center">
                        <div>
                          <h2 className="text-xl font-bold text-primary dark:text-white font-display">
                            Gestion des Tarifs Contextuels
                          </h2>
                          <p className="text-xs text-neutral-500">Produit : <span className="font-bold text-primary dark:text-white">{selectedProductForTarifs.nom}</span> (Prix standard : {formatMontant(selectedProductForTarifs.prix_vente)})</p>
                        </div>
                        <button
                          onClick={() => setIsTarifsModalOpen(false)}
                          className="text-neutral-400 hover:text-primary dark:hover:text-white transition-colors"
                        >
                          <X className="w-6 h-6" />
                        </button>
                      </div>

                      <div className="p-4 md:p-6 overflow-y-auto space-y-6 flex-1">
                        {tarifMessage && (
                          <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-3 py-2 rounded-lg">
                            {tarifMessage}
                          </p>
                        )}

                        {/* Bibliothèque de tarifs réutilisables */}
                        <div className="bg-indigo-50/70 dark:bg-indigo-500/5 p-4 rounded-xl border border-indigo-200/70 dark:border-indigo-500/20">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="text-sm font-bold text-primary dark:text-white">📚 Bibliothèque de tarifs</h3>
                            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                              {tarifsModeles.length} modèle{tarifsModeles.length > 1 ? 's' : ''}
                            </span>
                          </div>
                          <p className="text-[11px] text-neutral-500 mb-3">
                            Définis une fois, réutilisables partout : « Utiliser » pré-remplit le formulaire,
                            « Appliquer à… » duplique le tarif sur plusieurs produits.
                          </p>

                          {isFetchingModeles ? (
                            <p className="text-xs text-neutral-400">Chargement…</p>
                          ) : tarifsModeles.length === 0 ? (
                            <p className="text-xs text-neutral-400 italic">
                              Aucun modèle. Enregistrez une règle ci-dessous en laissant cochée
                              « Ajouter à la bibliothèque ».
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {tarifsModeles.map((m) => (
                                <div
                                  key={m.id}
                                  className="p-3 bg-white dark:bg-dark-card/40 rounded-xl border border-neutral-200 dark:border-white/5 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between"
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-bold text-sm text-primary dark:text-white truncate">{m.nom}</span>
                                      <span className="px-2 py-0.5 bg-green-500/10 text-green-600 rounded text-xs font-bold">
                                        {formatMontant(m.prix_vente)}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-neutral-500 mt-0.5">🕒 {describeTarifConditions(m)}</p>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleUseModele(m)}
                                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-primary/10 dark:bg-dark-accent/20 text-primary dark:text-white hover:bg-primary/20 transition-colors"
                                    >
                                      Utiliser
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setApplyModele({ modele: m, selected: [], search: '' })}
                                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/20 transition-colors"
                                    >
                                      Appliquer à…
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteModele(m)}
                                      className="text-neutral-400 hover:text-red-500 p-1 transition-colors"
                                      title="Supprimer le modèle (les règles déjà appliquées restent)"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Formulaire ajout */}
                        <form onSubmit={handleAddTarif} className="bg-neutral-50 dark:bg-dark-card/40 p-4 rounded-xl border border-neutral-200 dark:border-white/5 space-y-4">
                          <h3 className="text-sm font-bold text-primary dark:text-white">➕ Ajouter une règle tarifaire (Happy Hour, Nuit, Week-end...)</h3>
                
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-bold text-neutral-500 mb-1">Nom du tarif (ex: Happy Hour)</label>
                              <input
                                type="text"
                                required
                                value={tarifForm.nom_tarif}
                                onChange={e => setTarifForm({...tarifForm, nom_tarif: e.target.value})}
                                placeholder="ex: Happy Hour Soir"
                                className="w-full px-3 py-2 bg-white dark:bg-dark-card border rounded-lg text-sm text-primary dark:text-white outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-neutral-500 mb-1">Prix promo (FCFA)</label>
                              <input
                                type="number"
                                required
                                min="0"
                                value={tarifForm.prix_vente}
                                onChange={e => setTarifForm({...tarifForm, prix_vente: e.target.value})}
                                placeholder="ex: 500"
                                className="w-full px-3 py-2 bg-white dark:bg-dark-card border rounded-lg text-sm text-primary dark:text-white outline-none"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-bold text-neutral-500 mb-1">Heure début</label>
                              <input
                                type="time"
                                value={tarifForm.heure_debut}
                                onChange={e => setTarifForm({...tarifForm, heure_debut: e.target.value})}
                                className="w-full px-3 py-2 bg-white dark:bg-dark-card border rounded-lg text-sm text-primary dark:text-white outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-neutral-500 mb-1">Heure fin</label>
                              <input
                                type="time"
                                value={tarifForm.heure_fin}
                                onChange={e => setTarifForm({...tarifForm, heure_fin: e.target.value})}
                                className="w-full px-3 py-2 bg-white dark:bg-dark-card border rounded-lg text-sm text-primary dark:text-white outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-neutral-500 mb-1">Priorité (ex: 10)</label>
                              <input
                                type="number"
                                value={tarifForm.priorite}
                                onChange={e => setTarifForm({...tarifForm, priorite: Number(e.target.value)})}
                                className="w-full px-3 py-2 bg-white dark:bg-dark-card border rounded-lg text-sm text-primary dark:text-white outline-none"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-neutral-500 mb-1">Jours de la semaine ciblés (Laisser vide pour tous les jours)</label>
                            <div className="flex flex-wrap gap-2">
                              {[
                                { label: 'Lun', val: 1 },
                                { label: 'Mar', val: 2 },
                                { label: 'Mer', val: 3 },
                                { label: 'Jeu', val: 4 },
                                { label: 'Ven', val: 5 },
                                { label: 'Sam', val: 6 },
                                { label: 'Dim', val: 0 },
                              ].map(day => {
                                const isSelected = tarifForm.jours_semaine.includes(day.val);
                                return (
                                  <button
                                    key={day.val}
                                    type="button"
                                    onClick={() => {
                                      const current = tarifForm.jours_semaine;
                                      const updated = isSelected ? current.filter(v => v !== day.val) : [...current, day.val];
                                      setTarifForm({...tarifForm, jours_semaine: updated});
                                    }}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                      isSelected ? 'bg-primary text-white' : 'bg-neutral-200 dark:bg-white/10 text-neutral-600 dark:text-neutral-300'
                                    }`}
                                  >
                                    {day.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-bold text-neutral-500 mb-1">Valable du (optionnel — saison)</label>
                              <input
                                type="date"
                                value={tarifForm.date_debut}
                                onChange={e => setTarifForm({ ...tarifForm, date_debut: e.target.value })}
                                className="w-full px-3 py-2 bg-white dark:bg-dark-card border rounded-lg text-sm text-primary dark:text-white outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-neutral-500 mb-1">Valable jusqu'au</label>
                              <input
                                type="date"
                                value={tarifForm.date_fin}
                                onChange={e => setTarifForm({ ...tarifForm, date_fin: e.target.value })}
                                className="w-full px-3 py-2 bg-white dark:bg-dark-card border rounded-lg text-sm text-primary dark:text-white outline-none"
                              />
                            </div>
                          </div>

                          <label className="flex items-start gap-2 text-xs text-neutral-600 dark:text-neutral-300 bg-white dark:bg-dark-card/40 border border-neutral-200 dark:border-white/5 rounded-lg px-3 py-2">
                            <input
                              type="checkbox"
                              checked={saveAsModele}
                              onChange={e => setSaveAsModele(e.target.checked)}
                              className="mt-0.5 accent-primary"
                            />
                            <span>
                              <span className="font-bold text-primary dark:text-white">Ajouter à la bibliothèque</span>
                              <span className="block text-[11px] text-neutral-500">
                                Rend ce tarif réutilisable sur d'autres produits. Un modèle portant le même nom est mis à jour.
                              </span>
                            </span>
                          </label>

                          <button
                            type="button"
                            onClick={handleAddTarif}
                            className="w-full py-2.5 bg-primary dark:bg-dark-accent text-white rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
                          >
                            Enregistrer cette règle tarifaire
                          </button>
                        </form>

                        {/* Liste des règles existantes */}
                        <div>
                          <h3 className="text-sm font-bold text-primary dark:text-white mb-3">📋 Règles tarifaires actives pour ce produit</h3>
                          {isFetchingTarifs ? (
                            <p className="text-xs text-neutral-400">Chargement...</p>
                          ) : tarifsList.length === 0 ? (
                            <p className="text-xs text-neutral-400 italic">Aucune règle spécifique. Le prix standard s'applique en permanence.</p>
                          ) : (
                            <div className="space-y-2">
                              {tarifsList.map(tarif => (
                                <div key={tarif.id} className="p-3 bg-neutral-50 dark:bg-dark-card/20 rounded-xl border border-neutral-200 dark:border-white/5 flex items-center justify-between">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-sm text-primary dark:text-white">{tarif.nom_tarif}</span>
                                      <span className="px-2 py-0.5 bg-green-500/10 text-green-600 rounded text-xs font-bold">{formatMontant(tarif.prix_vente)}</span>
                                      {tarif.modele_id && (
                                        <span className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 rounded text-[10px] font-bold" title="Règle issue de la bibliothèque">📚</span>
                                      )}
                                      <span className="text-xs text-neutral-400">Priorité : {tarif.priorite}</span>
                                    </div>
                                    <p className="text-xs text-neutral-500 mt-1">
                                      {tarif.heure_debut && tarif.heure_fin ? `🕒 De ${tarif.heure_debut.slice(0,5)} à ${tarif.heure_fin.slice(0,5)}` : '🕒 Toute la journée'}
                                      {tarif.jours_semaine && tarif.jours_semaine.length > 0 ? ` • Jours : [${tarif.jours_semaine.join(', ')}]` : ' • Tous les jours'}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => handleDeleteTarif(tarif.id)}
                                    className="text-neutral-400 hover:text-red-500 p-1 transition-colors"
                                    title="Supprimer la règle"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sélecteur « Appliquer un modèle à plusieurs produits » */}
                {applyModele && (
                  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
                    <div className="bg-white dark:bg-dark-card/95 rounded-2xl w-full max-w-lg shadow-2xl border border-neutral-200 dark:border-white/5 overflow-hidden flex flex-col max-h-[85vh]">
                      <div className="p-4 border-b border-neutral-100 dark:border-white/5 flex justify-between items-start gap-3">
                        <div className="min-w-0">
                          <h2 className="text-lg font-bold text-primary dark:text-white font-display truncate">
                            Appliquer « {applyModele.modele.nom} »
                          </h2>
                          <p className="text-xs text-neutral-500">
                            {formatMontant(applyModele.modele.prix_vente)} • {describeTarifConditions(applyModele.modele)}
                          </p>
                        </div>
                        <button
                          onClick={() => setApplyModele(null)}
                          className="text-neutral-400 hover:text-primary dark:hover:text-white transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="p-4 space-y-3 flex flex-col min-h-0">
                        <input
                          type="text"
                          value={applyModele.search}
                          onChange={(e) => setApplyModele((prev) => (prev ? { ...prev, search: e.target.value } : prev))}
                          placeholder="Rechercher un produit…"
                          className="w-full px-3 py-2 bg-neutral-100 dark:bg-dark-card/40 rounded-lg text-sm text-primary dark:text-white outline-none"
                        />

                        <div className="flex items-center justify-between text-xs">
                          <span className="text-neutral-500">{applyModele.selected.length} sélectionné(s)</span>
                          <button
                            type="button"
                            onClick={() =>
                              setApplyModele((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      selected: tousApplySelectionnes
                                        ? []
                                        : filteredApplyProduits.map((p) => p.id),
                                    }
                                  : prev
                              )
                            }
                            className="font-bold text-primary dark:text-dark-accent hover:underline"
                          >
                            {tousApplySelectionnes ? 'Tout désélectionner' : 'Tout sélectionner'}
                          </button>
                        </div>

                        <div className="overflow-y-auto divide-y divide-neutral-100 dark:divide-white/5 rounded-xl border border-neutral-200 dark:border-white/5 min-h-0">
                          {filteredApplyProduits.length === 0 ? (
                            <p className="p-3 text-xs text-neutral-400 italic">Aucun produit ne correspond.</p>
                          ) : (
                            filteredApplyProduits.map((p) => {
                              const checked = applyModele.selected.includes(p.id);
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() =>
                                    setApplyModele((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            selected: checked
                                              ? prev.selected.filter((id) => id !== p.id)
                                              : [...prev.selected, p.id],
                                          }
                                        : prev
                                    )
                                  }
                                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors"
                                >
                                  <span className="text-sm text-primary dark:text-white truncate">
                                    {p.nom}
                                    <span className="ml-2 text-[10px] text-neutral-400 uppercase">{p.categorie}</span>
                                  </span>
                                  <span
                                    className={twMerge(
                                      'w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center text-[10px] font-black',
                                      checked
                                        ? 'bg-primary dark:bg-dark-accent border-primary dark:border-dark-accent text-white'
                                        : 'border-neutral-300 dark:border-white/20 text-transparent'
                                    )}
                                  >
                                    ✓
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>

                      <div className="p-4 border-t border-neutral-100 dark:border-white/5 flex gap-3">
                        <button
                          type="button"
                          onClick={() => setApplyModele(null)}
                          className="flex-1 px-4 py-2.5 rounded-xl font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-dark-card/40 transition-colors"
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          disabled={isApplyingModele || applyModele.selected.length === 0}
                          onClick={handleApplyModele}
                          className="flex-1 px-4 py-2.5 bg-primary dark:bg-dark-accent text-white rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {isApplyingModele
                            ? 'Application…'
                            : `Appliquer à ${applyModele.selected.length} produit(s)`}
                        </button>
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
