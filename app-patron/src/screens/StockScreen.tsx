import { useState } from 'react';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';
import { formatMontant } from '../utils/format';
import { 
  Search, 
  AlertTriangle, 
  Plus, 
  Package, 
  Wine, 
  Utensils, 
  History
} from 'lucide-react';
import { twMerge } from 'tailwind-merge';

import { StockAdjustmentModal } from '../components/stock/StockAdjustmentModal';
import { StockThresholdModal } from '../components/stock/StockThresholdModal';
import { Edit2 } from 'lucide-react';

export function StockScreen() {
  const profile = useAuthStore((state) => state.profile);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'low'>('all');
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [selectedProductForAdjustment, setSelectedProductForAdjustment] = useState<string | undefined>(undefined);
  
  // State pour le modal de seuil
  const [isThresholdModalOpen, setIsThresholdModalOpen] = useState(false);
  const [selectedStockForThreshold, setSelectedStockForThreshold] = useState<{id: string, seuil: number, nom: string} | null>(null);

  const { data: stocks, isLoading, refetch } = useSupabaseQuery(
    ['stocks', profile?.etablissement_id],
    async () => {
      if (!profile?.etablissement_id) return { data: [], error: null };
      
      const { data, error } = await supabase
        .from('stocks')
        .select(`
          *,
          produits (
            nom,
            categorie,
            prix_vente
          )
        `)
        .eq('etablissement_id', profile.etablissement_id)
        .order('quantite_actuelle', { ascending: true });

      return { data, error };
    },
    { enabled: !!profile?.etablissement_id }
  );

  const filteredStocks = stocks?.filter((stock) => {
    const matchesSearch = stock.produits?.nom.toLowerCase().includes(searchTerm.toLowerCase());
    const isLowStock = stock.quantite_actuelle <= stock.seuil_alerte;
    
    if (filter === 'low') {
      return matchesSearch && isLowStock;
    }
    return matchesSearch;
  });

  const lowStockCount = stocks?.filter(s => s.quantite_actuelle <= s.seuil_alerte).length || 0;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-dark-bg pb-20 md:pb-6 space-y-6">
      {/* Header Section */}
      <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-xl border-b border-neutral-200 dark:border-white/5 p-4 md:p-6 transition-colors duration-300">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary dark:text-white font-display">Gestion du Stock</h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">
              Gérez votre inventaire et suivez les niveaux de stock
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
             {lowStockCount > 0 && (
               <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 dark:bg-red-500/10 border border-red-500/20 dark:border-red-500/20 rounded-full backdrop-blur-md">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">{lowStockCount} alertes</span>
               </div>
             )}
             <button 
                onClick={() => {
                  setSelectedProductForAdjustment(undefined);
                  setIsAdjustmentModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-primary dark:bg-dark-accent text-white rounded-lg font-bold text-sm hover:opacity-90 transition-all shadow-lg shadow-primary/20 dark:shadow-dark-accent/20 active:scale-95"
             >
                <Plus className="w-4 h-4" />
                <span>Ajustement / Perte</span>
             </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="mt-6 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input 
              type="text" 
              placeholder="Rechercher un produit..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary dark:focus:border-dark-accent rounded-xl text-primary dark:text-white placeholder-neutral-400 focus:ring-4 focus:ring-primary/10 dark:focus:ring-dark-accent/10 transition-all outline-none text-sm"
            />
          </div>
          
          <div className="flex p-1 bg-neutral-100 dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/5 shrink-0">
            <button 
              onClick={() => setFilter('all')}
              className={twMerge(
                "px-4 py-1.5 text-sm font-bold rounded-lg transition-all flex items-center gap-2 uppercase tracking-widest",
                filter === 'all' 
                  ? "bg-white dark:bg-dark-accent text-primary dark:text-white shadow-md" 
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              )}
            >
              <Package className="w-4 h-4" />
              <span>Tout</span>
            </button>
            <button 
              onClick={() => setFilter('low')}
              className={twMerge(
                "px-4 py-1.5 text-sm font-bold rounded-lg transition-all flex items-center gap-2 uppercase tracking-widest",
                filter === 'low' 
                  ? "bg-white dark:bg-dark-accent text-primary dark:text-white shadow-md" 
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              )}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Alertes</span>
            </button>
          </div>
        </div>
      </div>

      {/* Inventory List */}
      <div className="px-4 md:px-6 max-w-7xl mx-auto">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary dark:border-dark-accent"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredStocks?.map((stock) => {
              const isLow = stock.quantite_actuelle <= stock.seuil_alerte;
              const percentage = Math.min(100, Math.max(0, (stock.quantite_actuelle / (stock.seuil_alerte * 3)) * 100));
              
              return (
                <div 
                  key={stock.id} 
                  className={twMerge(
                    "bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-2xl border shadow-soft overflow-hidden group transition-all duration-300 hover:shadow-xl",
                    isLow 
                      ? "border-red-500/30 dark:border-red-500/20 ring-1 ring-red-500/10" 
                      : "border-neutral-200 dark:border-white/5 hover:border-primary/20 dark:hover:border-dark-accent/30"
                  )}
                >
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className={twMerge(
                          "flex items-center justify-center size-12 rounded-xl group-hover:scale-110 transition-transform shadow-inner",
                          isLow 
                            ? "bg-red-500/10 text-red-500" 
                            : "bg-neutral-100 dark:bg-white/5 text-neutral-500 dark:text-neutral-400"
                        )}>
                           {stock.produits?.categorie === 'boisson' ? <Wine className="w-6 h-6" /> : <Utensils className="w-6 h-6" />}
                        </div>
                        <div>
                          <h3 className="font-bold text-primary dark:text-white text-sm leading-tight line-clamp-1 group-hover:text-primary dark:group-hover:text-dark-accent transition-colors">{stock.produits?.nom}</h3>
                          <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mt-1">{stock.produits?.categorie}</p>
                        </div>
                      </div>
                      
                      {isLow && (
                        <span className="flex items-center justify-center size-7 rounded-full bg-red-500/10 text-red-500 animate-pulse">
                          <AlertTriangle className="w-4 h-4" />
                        </span>
                      )}
                    </div>

                    <div className="space-y-3">
                       <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                          <span className={isLow ? "text-red-500" : "text-neutral-500 dark:text-neutral-400"}>
                             {stock.quantite_actuelle} EN STOCK
                          </span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStockForThreshold({
                                id: stock.id,
                                seuil: stock.seuil_alerte,
                                nom: stock.produits?.nom || 'Produit'
                              });
                              setIsThresholdModalOpen(true);
                            }}
                            className="flex items-center gap-1 text-neutral-400 dark:text-neutral-500 hover:text-primary dark:hover:text-white transition-colors group/edit"
                          >
                            <span>CIBLE: {stock.seuil_alerte * 3}</span>
                            <Edit2 className="w-3 h-3 opacity-0 group-hover/edit:opacity-100 transition-opacity" />
                          </button>
                       </div>
                       
                       <div className="h-2 w-full bg-neutral-100 dark:bg-white/5 rounded-full overflow-hidden shadow-inner border border-transparent dark:border-white/5">
                          <div 
                            className={twMerge(
                              "h-full rounded-full transition-all duration-700",
                              isLow ? "bg-red-500" : "bg-green-500"
                            )}
                            style={{ width: `${percentage}%` }}
                          />
                       </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-4 mt-5 border-t border-neutral-100 dark:border-white/5">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase font-black tracking-widest">Prix Vente</span>
                          <span className="text-sm font-black text-primary dark:text-white">
                              {formatMontant(stock.produits?.prix_vente || 0)}
                          </span>
                        </div>
                        <button 
                          onClick={() => {
                            setSelectedProductForAdjustment(stock.produit_id);
                            setIsAdjustmentModalOpen(true);
                          }}
                          className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-500 hover:text-primary dark:hover:text-white transition-all px-3 py-1.5 rounded-xl hover:bg-neutral-50 dark:hover:bg-white/5 active:scale-95"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Ajuster</span>
                        </button>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {filteredStocks?.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-16 text-neutral-400 dark:text-neutral-500">
                    <div className="w-16 h-16 bg-neutral-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                      <Package className="w-8 h-8 opacity-50" />
                    </div>
                    <p className="font-bold uppercase tracking-widest text-xs">Aucun produit trouvé</p>
                    <p className="text-[10px] mt-1 uppercase tracking-wider opacity-60">Essayez de modifier votre recherche</p>
                </div>
            )}
          </div>
        )}
      </div>

      <StockAdjustmentModal
        isOpen={isAdjustmentModalOpen}
        onClose={() => setIsAdjustmentModalOpen(false)}
        onSuccess={() => {
          refetch();
          // Optionnel: Ajouter une notification toast ici
        }}
        etablissementId={profile?.etablissement_id || ''}
        preselectedProductId={selectedProductForAdjustment}
      />
      
      {selectedStockForThreshold && (
        <StockThresholdModal
          isOpen={isThresholdModalOpen}
          onClose={() => {
            setIsThresholdModalOpen(false);
            setSelectedStockForThreshold(null);
          }}
          onSuccess={() => {
            refetch();
          }}
          stockId={selectedStockForThreshold.id}
          currentThreshold={selectedStockForThreshold.seuil}
          productName={selectedStockForThreshold.nom}
        />
      )}
    </div>
  );
}
