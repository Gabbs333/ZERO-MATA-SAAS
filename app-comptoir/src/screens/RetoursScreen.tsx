import { useState } from 'react';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';
import { formatPrice } from '../lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowLeft, Package, Receipt, Search, X, CheckCircle, AlertCircle, Calendar } from 'lucide-react';
import type { Facture, CommandeItem } from '../types/database.types';

interface FactureWithDetails extends Facture {
  commandes: {
    id: string;
    numero_commande: string;
    tables: { numero: number };
    profiles: { nom: string; prenom: string };
    commande_items: CommandeItem[];
  };
}

interface RetourItemSelectionne {
  commande_item_id: string;
  produit_id: string;
  nom_produit: string;
  quantite_retournee: number;
  prix_unitaire: number;
  montant_ligne: number;
  quantite_max: number;
}

export function RetoursScreen() {
  const profile = useAuthStore((state) => state.profile);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFacture, setSelectedFacture] = useState<FactureWithDetails | null>(null);
  const [retourItems, setRetourItems] = useState<RetourItemSelectionne[]>([]);
  const [motif, setMotif] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('week');

  // Fetch factures payees ou partiellement payees
  const { data: factures, isLoading, refetch } = useSupabaseQuery<FactureWithDetails[]>(
    ['factures_retours', profile?.etablissement_id],
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
            profiles!commandes_serveuse_id_fkey (nom, prenom),
            commande_items (*)
          )
        `)
        .eq('etablissement_id', profile.etablissement_id)
        .in('statut', ['payee', 'partiellement_payee'])
        .order('date_generation', { ascending: false });

      return { data: data as unknown as FactureWithDetails[], error };
    },
    { enabled: !!profile?.etablissement_id }
  );

  // Filter factures based on search and date
  const filteredFactures = factures?.filter(f => {
    const matchesSearch = 
      f.commandes?.numero_commande?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.commandes?.profiles?.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.commandes?.profiles?.nom?.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesDate = true;
    if (dateFilter !== 'all') {
      const factureDate = new Date(f.date_generation);
      const now = new Date();
      if (dateFilter === 'today') {
        matchesDate = factureDate.toDateString() === now.toDateString();
      } else if (dateFilter === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        matchesDate = factureDate >= weekAgo;
      } else if (dateFilter === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        matchesDate = factureDate >= monthAgo;
      }
    }
    
    return matchesSearch && matchesDate;
  });

  const totalRetour = retourItems.reduce((sum, item) => sum + item.montant_ligne, 0);

  // Note: formatPrice is replaced by formatPrice from utils

  const handleSelectFacture = (facture: FactureWithDetails) => {
    setSelectedFacture(facture);
    setRetourItems([]);
    setMotif('');
  };

  const handleToggleItem = (item: CommandeItem) => {
    setRetourItems(prev => {
      const existing = prev.find(i => i.commande_item_id === item.id);
      if (existing) {
        return prev.filter(i => i.commande_item_id !== item.id);
      }
      return [...prev, {
        commande_item_id: item.id,
        produit_id: item.produit_id,
        nom_produit: item.nom_produit,
        quantite_retournee: 1,
        prix_unitaire: item.prix_unitaire,
        montant_ligne: item.prix_unitaire,
        quantite_max: item.quantite
      }];
    });
  };

  const handleUpdateQuantity = (commandeItemId: string, quantity: number) => {
    setRetourItems(prev => prev.map(item => {
      if (item.commande_item_id === commandeItemId) {
        const q = Math.max(1, Math.min(quantity, item.quantite_max));
        return {
          ...item,
          quantite_retournee: q,
          montant_ligne: q * item.prix_unitaire
        };
      }
      return item;
    }));
  };

  const handleProcessRetour = async () => {
    if (!selectedFacture || retourItems.length === 0) return;

    setIsProcessing(true);
    try {
      const retourItemsData = retourItems.map(item => ({
        commande_item_id: item.commande_item_id,
        produit_id: item.produit_id,
        nom_produit: item.nom_produit,
        quantite_retournee: item.quantite_retournee,
        prix_unitaire: item.prix_unitaire
      }));

      const { data, error } = await supabase.rpc('process_retour', {
        p_facture_id: selectedFacture.id,
        p_commande_id: selectedFacture.commandes.id,
        p_retour_items: retourItemsData,
        p_motif: motif || null,
        p_etablissement_id: profile?.etablissement_id
      });

      if (error) throw error;

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setSelectedFacture(null);
        setRetourItems([]);
        setMotif('');
        refetch();
      }, 2000);
    } catch (error: any) {
      console.error('Retour error:', error);
      alert(error.message || 'Erreur lors du traitement du retour');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-dark-bg pb-20 md:pb-6">
      {/* Header */}
      <div className="p-4 md:p-6 bg-white dark:bg-dark-card/30 dark:backdrop-blur-xl border-b border-neutral-200 dark:border-white/5">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => setSelectedFacture(null)}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-primary dark:text-white font-display">Retours Produits</h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">
              Initiez les retours sur les factures payées
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
                className="w-full pl-10 pr-4 py-2.5 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary dark:focus:border-dark-accent rounded-xl text-primary dark:text-white placeholder-neutral-400 focus:ring-4 focus:ring-primary/10 dark:focus:ring-dark-accent/10 transition-all outline-none"
              />
            </div>
            
            {/* Date filter */}
            <div className="flex gap-2">
              {([
                { value: 'today', label: "Aujourd'hui" },
                { value: 'week', label: '7 jours' },
                { value: 'month', label: '30 jours' },
                { value: 'all', label: 'Tout' }
              ] as const).map((filter) => (
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
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary dark:border-white"></div>
          </div>
        ) : selectedFacture ? (
          /* Formulaire de retour */
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Success message */}
            {showSuccess && (
              <div className="bg-green-100 dark:bg-green-500/20 border border-green-200 dark:border-green-500/30 rounded-xl p-4 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                <p className="text-green-700 dark:text-green-300 font-medium">Retour traité avec succès !</p>
              </div>
            )}

            {/* Facture info */}
            <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-primary dark:text-white">
                    Commande {selectedFacture.commandes?.numero_commande}
                  </h2>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    Table {selectedFacture.commandes?.tables?.numero} • {selectedFacture.commandes?.profiles?.prenom} {selectedFacture.commandes?.profiles?.nom}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedFacture(null)}
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-neutral-400" />
                </button>
              </div>
              <div className="flex gap-4 text-sm">
                <span className="text-neutral-500 dark:text-neutral-400">Total facture:</span>
                <span className="font-bold text-primary dark:text-white">{formatPrice(selectedFacture.montant_total)}</span>
                <span className="text-neutral-500 dark:text-neutral-400">Payé:</span>
                <span className="font-bold text-green-600 dark:text-green-400">{formatPrice(selectedFacture.montant_paye)}</span>
              </div>
            </div>

            {/* Items selection */}
            <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 p-6">
              <h3 className="text-lg font-bold text-primary dark:text-white mb-4">Articles à retourner</h3>
              <div className="space-y-3">
                {selectedFacture.commandes?.commande_items?.map((item) => {
                  const isSelected = retourItems.some(i => i.commande_item_id === item.id);
                  const selectedItem = retourItems.find(i => i.commande_item_id === item.id);
                  
                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-primary dark:border-dark-accent bg-primary/5 dark:bg-dark-accent/10'
                          : 'border-neutral-200 dark:border-white/5 hover:border-neutral-300 dark:hover:border-white/10'
                      }`}
                      onClick={() => handleToggleItem(item)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            isSelected ? 'bg-primary dark:bg-dark-accent border-primary dark:border-dark-accent' : 'border-neutral-300 dark:border-white/20'
                          }`}>
                            {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
                          </div>
                          <div>
                            <p className="font-medium text-primary dark:text-white">{item.nom_produit}</p>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                              {formatPrice(item.prix_unitaire)} x {item.quantite}
                            </p>
                          </div>
                        </div>
                        <span className="font-bold text-primary dark:text-white">{formatPrice(item.prix_unitaire * item.quantite)}</span>
                      </div>
                      
                      {isSelected && selectedItem && (
                        <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-white/10 flex items-center gap-4">
                          <span className="text-sm text-neutral-500 dark:text-neutral-400">Quantité à retourner:</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateQuantity(item.id, (selectedItem.quantite_retournee || 1) - 1);
                              }}
                              className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-white/10 flex items-center justify-center text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-white/20"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="1"
                              max={selectedItem.quantite_max}
                              value={selectedItem.quantite_retournee}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => handleUpdateQuantity(item.id, parseInt(e.target.value) || 1)}
                              className="w-16 text-center py-1.5 bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg text-primary dark:text-white"
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
                          <span className="ml-auto text-sm font-bold text-primary dark:text-white">
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
              <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 p-6">
                <label className="block text-sm font-bold text-primary dark:text-white mb-2">
                  Motif du retour (optionnel)
                </label>
                <textarea
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  placeholder="Ex: Produit défectueux, erreur de commande..."
                  className="w-full p-3 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary dark:focus:border-dark-accent rounded-xl text-primary dark:text-white placeholder-neutral-400 focus:ring-4 focus:ring-primary/10 dark:focus:ring-dark-accent/10 transition-all outline-none resize-none"
                  rows={3}
                />
              </div>
            )}

            {/* Summary and submit */}
            {retourItems.length > 0 && (
              <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-lg font-bold text-primary dark:text-white">Total du retour</span>
                  <span className="text-2xl font-bold text-semantic-red">{formatPrice(totalRetour)}</span>
                </div>
                <button
                  onClick={handleProcessRetour}
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
                      <ArrowLeft className="w-5 h-5" />
                      Confirmer le retour
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Liste des factures */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFactures?.map((facture) => (
              <div
                key={facture.id}
                onClick={() => handleSelectFacture(facture)}
                className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 shadow-soft overflow-hidden cursor-pointer hover:border-primary/30 dark:hover:border-dark-accent/30 transition-all"
              >
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-primary/10 text-primary dark:text-dark-accent size-10 rounded-lg flex items-center justify-center">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-primary dark:text-white">
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
                    <span className="font-bold text-primary dark:text-white">{formatPrice(facture.montant_total)}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      facture.statut === 'payee'
                        ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                    }`}>
                      {facture.statut === 'payee' ? 'Payée' : 'Partielle'}
                    </span>
                    {facture.statut_retour && facture.statut_retour !== 'sans_retour' && (
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400">
                        {facture.statut_retour === 'retour_total' ? 'Retour total' : 'Retour partiel'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {filteredFactures?.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-neutral-400 dark:text-neutral-500">
                <Package className="w-12 h-12 mb-2 opacity-50" />
                <p>Aucune facture éligible au retour</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
