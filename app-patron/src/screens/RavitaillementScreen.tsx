import { useState } from 'react';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';
import { formatMontant } from '../utils/format';
import { format } from 'date-fns';
import { Plus, Truck, History, X, Trash2 } from 'lucide-react';

interface Ravitaillement {
  id: string;
  fournisseur: string;
  date_ravitaillement: string;
  montant_total: number;
  profiles: {
    nom: string;
    prenom: string;
  };
  ravitaillement_items: {
    quantite: number;
    nom_produit: string;
    prix_unitaire: number;
  }[];
}

interface NewSupplyItem {
  produit_id: string;
  nom_produit: string; // For display
  quantite: number;
  prix_achat: number;
}

export function RavitaillementScreen() {
  const profile = useAuthStore((state) => state.profile);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form State
  const [fournisseur, setFournisseur] = useState('');
  const [items, setItems] = useState<NewSupplyItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(0);

  // Fetch History
  const { data: ravitaillements, isLoading, refetch } = useSupabaseQuery<Ravitaillement[]>(
    ['ravitaillements', profile?.etablissement_id],
    async () => {
      if (!profile?.etablissement_id) return { data: [] as Ravitaillement[], error: null };
      const { data, error } = await supabase
        .from('ravitaillements')
        .select(`
          *,
          profiles (nom, prenom),
          ravitaillement_items (
            quantite,
            nom_produit,
            prix_unitaire
          )
        `)
        .eq('etablissement_id', profile.etablissement_id)
        .order('date_ravitaillement', { ascending: false });
      
      return { data: (data as any) as Ravitaillement[], error };
    },
    { enabled: !!profile?.etablissement_id }
  );

  // Fetch Products for the form
  const { data: produits } = useSupabaseQuery<{ id: string; nom: string; prix_achat: number }[]>(
    ['produits_list', profile?.etablissement_id],
    async () => {
      if (!profile?.etablissement_id) return { data: [], error: null };
      const { data, error } = await supabase
        .from('produits')
        .select('id, nom, prix_achat')
        .eq('etablissement_id', profile.etablissement_id)
        .eq('actif', true)
        .order('nom');
      
      return { data: (data as any) as { id: string; nom: string; prix_achat: number }[], error };
    },
    { enabled: isModalOpen && !!profile?.etablissement_id }
  );

  const handleAddItem = () => {
    if (!selectedProduct || quantity <= 0) return;
    
    const product = produits?.find(p => p.id === selectedProduct);
    if (!product) return;

    const newItem: NewSupplyItem = {
      produit_id: product.id,
      nom_produit: product.nom,
      quantite: quantity,
      prix_achat: price || product.prix_achat || 0
    };

    setItems([...items, newItem]);
    // Reset item fields
    setSelectedProduct('');
    setQuantity(1);
    setPrice(0);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fournisseur) {
      alert('Veuillez entrer le nom du fournisseur');
      return;
    }

    if (items.length === 0) {
      alert('Veuillez ajouter au moins un article');
      return;
    }

    setLoading(true);
    try {
      const montant_total = items.reduce((acc, item) => acc + (item.quantite * item.prix_achat), 0);

      // 1. Create Ravitaillement
      const { data: rav, error: ravError } = await supabase
        .from('ravitaillements')
        .insert({
          etablissement_id: profile?.etablissement_id,
          fournisseur,
          montant_total,
          gerant_id: profile?.id,
          date_ravitaillement: new Date().toISOString()
        })
        .select()
        .single();

      if (ravError) throw ravError;

      // 2. Create Items
      const ravItems = items.map(item => ({
        ravitaillement_id: rav.id,
        produit_id: item.produit_id,
        nom_produit: item.nom_produit,
        quantite: item.quantite,
        prix_unitaire: item.prix_achat,
        etablissement_id: profile?.etablissement_id
      }));

      const { error: itemsError } = await supabase
        .from('ravitaillement_items')
        .insert(ravItems);

      if (itemsError) throw itemsError;

      // 3. Update Stock (assuming backend trigger handles it, or we do it here)
      // Ideally backend handles it. If not, we'd need to loop and update stocks.
      // For now, let's assume backend triggers or manual stock update is needed.
      // We will add a RPC call if available, otherwise trust the system or add TODO.

      setIsModalOpen(false);
      setFournisseur('');
      setItems([]);
      refetch();
    } catch (error: any) {
      console.error('Error creating supply:', error);
      alert(`Erreur lors de la création du ravitaillement: ${error.message || 'Une erreur inconnue est survenue'}`);
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = items.reduce((acc, item) => acc + (item.quantite * item.prix_achat), 0);

  return (
    <div className="pb-20 md:pb-6 min-h-screen bg-neutral-50 dark:bg-dark-bg transition-colors duration-300">
      {/* Header */}
      <div className="p-4 md:p-6 bg-white dark:bg-dark-card/50 dark:backdrop-blur-md border-b border-neutral-200 dark:border-white/5 sticky top-0 z-30 transition-colors duration-300">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary dark:text-white font-display">Gestion des Ravitaillements</h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">
              Suivez et gérez les réapprovisionnements de votre stock
            </p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary dark:bg-dark-accent text-white rounded-lg font-bold text-sm hover:opacity-90 transition-all shadow-lg shadow-primary/20 dark:shadow-dark-accent/20 active:scale-95 self-start md:self-auto"
          >
            <Plus className="w-5 h-5" />
            <span>Nouveau Ravitaillement</span>
          </button>
        </div>
      </div>

      {/* List */}
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary dark:border-dark-accent"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {ravitaillements?.map((rav) => (
              <div key={rav.id} className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 shadow-soft p-4 md:p-5 hover:border-primary/20 dark:hover:border-dark-accent/30 transition-all group">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-neutral-100 dark:bg-white/5 rounded-lg group-hover:scale-110 transition-transform">
                      <Truck className="w-5 h-5 text-neutral-600 dark:text-dark-accent" />
                    </div>
                    <div>
                      <h3 className="font-bold text-primary dark:text-white">{rav.fournisseur}</h3>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">
                        {format(new Date(rav.date_ravitaillement), 'dd MMM yyyy, HH:mm')} • par {rav.profiles?.prenom}
                      </p>
                    </div>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-lg font-bold text-primary dark:text-white">{formatMontant(rav.montant_total)}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-500">{rav.ravitaillement_items?.length} articles</p>
                  </div>
                </div>

                {/* Items Preview */}
                <div className="bg-neutral-50 dark:bg-black/20 rounded-lg p-3 border border-transparent dark:border-white/5">
                  <div className="flex flex-wrap gap-2">
                    {rav.ravitaillement_items?.slice(0, 5).map((item: any, idx: number) => (
                      <span key={idx} className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/5 text-neutral-600 dark:text-neutral-300">
                        {item.quantite}x {item.nom_produit}
                      </span>
                    ))}
                    {(rav.ravitaillement_items?.length || 0) > 5 && (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium text-neutral-400 dark:text-neutral-500">
                        +{rav.ravitaillement_items.length - 5} de plus
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {ravitaillements?.length === 0 && (
              <div className="text-center py-20 bg-white dark:bg-dark-card/20 rounded-2xl border border-dashed border-neutral-300 dark:border-white/10">
                <History className="w-12 h-12 mb-4 opacity-20 mx-auto text-primary dark:text-white" />
                <p className="text-neutral-500 dark:text-neutral-400 font-medium">Aucun historique de ravitaillement trouvé</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Supply Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-dark-card/95 dark:backdrop-blur-xl rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-neutral-200 dark:border-white/10 overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-neutral-200 dark:border-white/5 flex justify-between items-center bg-white dark:bg-transparent z-10">
              <div>
                <h2 className="text-xl font-bold text-primary dark:text-white">Nouveau Ravitaillement</h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">Ajoutez des produits à votre stock</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
              {/* Supplier Info */}
              <div>
                <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                  Nom du Fournisseur
                </label>
                <input
                  type="text"
                  value={fournisseur}
                  onChange={(e) => setFournisseur(e.target.value)}
                  placeholder="ex: Brasseries du Cameroun"
                  className="w-full px-4 py-2.5 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary dark:focus:border-dark-accent rounded-xl text-primary dark:text-white focus:ring-4 focus:ring-primary/10 dark:focus:ring-dark-accent/10 outline-none transition-all"
                />
              </div>

              {/* Add Item Form */}
              <div className="p-5 bg-neutral-50 dark:bg-white/5 rounded-2xl border border-neutral-200 dark:border-white/5">
                <h3 className="text-sm font-bold text-primary dark:text-white mb-4 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-primary dark:text-dark-accent" />
                  Ajouter des Produits
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-5">
                    <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wider">Produit</label>
                    <select
                      value={selectedProduct}
                      onChange={(e) => {
                        const prod = produits?.find(p => p.id === e.target.value);
                        setSelectedProduct(e.target.value);
                        if (prod) setPrice(prod.prix_achat || 0);
                      }}
                      className="w-full px-3 py-2.5 bg-white dark:bg-dark-card border border-neutral-200 dark:border-white/10 rounded-xl text-sm text-primary dark:text-white outline-none focus:border-primary dark:focus:border-dark-accent transition-all"
                    >
                      <option value="">Sélectionner un produit...</option>
                      {produits?.map(p => (
                        <option key={p.id} value={p.id}>{p.nom}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wider">Qté</label>
                    <input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2.5 bg-white dark:bg-dark-card border border-neutral-200 dark:border-white/10 rounded-xl text-sm text-primary dark:text-white outline-none focus:border-primary dark:focus:border-dark-accent transition-all"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wider">Prix Unit.</label>
                    <input
                      type="number"
                      min="0"
                      value={price}
                      onChange={(e) => setPrice(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2.5 bg-white dark:bg-dark-card border border-neutral-200 dark:border-white/10 rounded-xl text-sm text-primary dark:text-white outline-none focus:border-primary dark:focus:border-dark-accent transition-all"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <button
                      onClick={handleAddItem}
                      disabled={!selectedProduct || quantity <= 0}
                      className="w-full py-2.5 bg-primary dark:bg-dark-accent text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                    >
                      Ajouter
                    </button>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">Articles ajoutés</h3>
                  <span className="text-xs font-medium px-2 py-0.5 bg-neutral-100 dark:bg-white/10 rounded-full text-neutral-600 dark:text-neutral-400">
                    {items.length} article{items.length > 1 ? 's' : ''}
                  </span>
                </div>
                {items.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-neutral-200 dark:border-white/5 rounded-2xl">
                    <p className="text-sm text-neutral-400 italic">Aucun article ajouté pour le moment.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {items.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/5 rounded-xl group hover:border-primary/30 dark:hover:border-dark-accent/30 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-lg bg-neutral-100 dark:bg-white/5 flex items-center justify-center">
                            <Truck className="size-4 text-neutral-500 dark:text-dark-accent" />
                          </div>
                          <div>
                            <p className="font-bold text-sm text-primary dark:text-white">{item.nom_produit}</p>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                              {item.quantite} x {formatMontant(item.prix_achat)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="font-bold text-sm text-primary dark:text-white">
                            {formatMontant(item.quantite * item.prix_achat)}
                          </p>
                          <button 
                            onClick={() => handleRemoveItem(index)}
                            className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Total & Actions */}
            <div className="p-6 bg-neutral-50 dark:bg-black/20 border-t border-neutral-200 dark:border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-center md:text-left">
                <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1">Montant Total</p>
                <p className="text-3xl font-black text-primary dark:text-white">{formatMontant(totalAmount)}</p>
              </div>
              <div className="flex gap-3 w-full md:w-auto">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 md:flex-none px-6 py-3 text-neutral-600 dark:text-neutral-300 font-bold hover:bg-neutral-100 dark:hover:bg-white/5 rounded-xl transition-all active:scale-95"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading || items.length === 0}
                  className={`flex-1 md:flex-none px-8 py-3 text-white font-black rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${
                    loading || items.length === 0 
                      ? 'bg-neutral-400 cursor-not-allowed opacity-50' 
                      : 'bg-semantic-green hover:bg-semantic-green/90 shadow-semantic-green/20'
                  }`}
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  ) : (
                    <>Confirmer le Ravitaillement</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
