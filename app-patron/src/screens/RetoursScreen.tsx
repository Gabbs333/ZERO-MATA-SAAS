import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';
import { formatMontant } from '../utils/format';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Package, Receipt, Search, Calendar, ArrowLeftCircle, User, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

interface RetourItem {
  id: string;
  retour_id: string;
  commande_item_id: string;
  produit_id: string;
  nom_produit: string;
  quantite_retournee: number;
  prix_unitaire: number;
  montant_ligne: number;
}

interface Retour {
  id: string;
  numero_retour: string;
  facture_id: string;
  commande_id: string;
  montant_total_retour: number;
  motif: string | null;
  utilisateur_id: string;
  date_retour: string;
  etablissement_id: string;
  retour_items?: RetourItem[];
  factures?: {
    numero_facture: string;
    montant_total: number;
    statut: string;
  };
  commandes?: {
    numero_commande: string;
    tables: { numero: number };
    profiles: { nom: string; prenom: string };
  };
}

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
  };
  commandes: {
    numero_commande: string;
    tables: { numero: number };
    profiles: { nom: string; prenom: string };
  };
  profiles: {
    nom: string;
    prenom: string;
  };
}

interface PendingReturnGroup {
  items: RetourEnAttente[];
  facture: RetourEnAttente['factures'];
  commande: RetourEnAttente['commandes'];
  utilisateur: RetourEnAttente['profiles'];
  date_demande: string;
  totalMontant: number;
}

export function RetoursScreen() {
  const profile = useAuthStore((state) => state.profile);
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('week');
  const [activeTab, setActiveTab] = useState<'history' | 'pending'>('history');
  const [selectedPendingGroup, setSelectedPendingGroup] = useState<PendingReturnGroup | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: retours, isLoading } = useSupabaseQuery<Retour[]>(
    ['retours', profile?.etablissement_id],
    async () => {
      if (!profile?.etablissement_id) return { data: [], error: null };

      const { data, error } = await supabase
        .from('retours')
        .select(`
          *,
          factures (
            numero_facture,
            montant_total,
            statut
          ),
          commandes (
            numero_commande,
            tables (numero),
            profiles!serveuse_id (nom, prenom)
          )
        `)
        .eq('etablissement_id', profile.etablissement_id)
        .order('date_retour', { ascending: false });

      return { data: data as unknown as Retour[], error };
    },
    { enabled: !!profile?.etablissement_id }
  );

  const { data: retoursEnAttente, refetch: refetchPending } = useSupabaseQuery<RetourEnAttente[]>(
    ['retours_en_attente', profile?.etablissement_id],
    async () => {
      if (!profile?.etablissement_id) return { data: [], error: null };

      const { data, error } = await supabase
        .from('retour_items_en_attente')
        .select(`
          *,
          factures (
            numero_facture,
            montant_total
          ),
          commandes (
            numero_commande,
            tables (numero),
            profiles!serveuse_id (nom, prenom)
          ),
          profiles!utilisateur_id (nom, prenom)
        `)
        .eq('etablissement_id', profile.etablissement_id)
        .order('date_demande', { ascending: false });

      return { data: data as unknown as RetourEnAttente[], error };
    },
    { enabled: !!profile?.etablissement_id }
  );

  const groupedPendingReturns = retoursEnAttente?.reduce((acc, item) => {
    if (!acc[item.facture_id]) {
      acc[item.facture_id] = {
        items: [],
        facture: item.factures,
        commande: item.commandes,
        utilisateur: item.profiles,
        date_demande: item.date_demande,
        totalMontant: 0
      };
    }
    acc[item.facture_id].items.push(item);
    acc[item.facture_id].totalMontant += item.montant_ligne;
    return acc;
  }, {} as Record<string, PendingReturnGroup>);

  const filteredRetours = retours?.filter(r => {
    const matchesSearch =
      r.commandes?.numero_commande?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.commandes?.profiles?.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.commandes?.profiles?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.numero_retour?.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesDate = true;
    if (dateFilter !== 'all') {
      const retourDate = new Date(r.date_retour);
      const now = new Date();
      if (dateFilter === 'today') {
        matchesDate = retourDate.toDateString() === now.toDateString();
      } else if (dateFilter === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        matchesDate = retourDate >= weekAgo;
      } else if (dateFilter === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        matchesDate = retourDate >= monthAgo;
      }
    }

    return matchesSearch && matchesDate;
  });

  const totalRetours = retours?.reduce((sum, r) => sum + (r.montant_total_retour || 0), 0) || 0;
  const totalPendingRetours = retoursEnAttente?.reduce((sum, r) => sum + r.montant_ligne, 0) || 0;

  const handleValidateRetour = async (factureId: string) => {
    if (!factureId) return;

    setIsProcessing(true);
    try {
      // Trouver l'ID du retour depuis les données en attente
      const pendingItems = retoursEnAttente?.filter(item => item.facture_id === factureId);
      if (!pendingItems || pendingItems.length === 0) {
        throw new Error('Retour non trouvé');
      }

      const { error } = await supabase.rpc('valider_retour_en_attente', {
        p_facture_id: factureId
      });

      if (error) throw error;

      alert('Retour validé avec succès !');
      refetchPending();
      queryClient.invalidateQueries({ queryKey: ['retours'] });
      queryClient.invalidateQueries({ queryKey: ['factures'] });
      queryClient.invalidateQueries({ queryKey: ['stocks'] });
    } catch (error: any) {
      console.error('Validation error:', error);
      alert(error.message || 'Erreur lors de la validation du retour');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectRetour = async (factureId: string) => {
    if (!factureId) return;

    if (!confirm('Êtes-vous sûr de vouloir refuser ce retour ?')) return;

    setIsProcessing(true);
    try {
      const { error } = await supabase.rpc('annuler_retour_en_attente', {
        p_facture_id: factureId
      });

      if (error) throw error;

      alert('Retour refusé avec succès !');
      refetchPending();
      queryClient.invalidateQueries({ queryKey: ['retours'] });
    } catch (error: any) {
      console.error('Rejection error:', error);
      alert(error.message || 'Erreur lors du refus du retour');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-dark-bg pb-20 md:pb-6">
      <div className="p-4 md:p-6 bg-white dark:bg-dark-card/30 dark:backdrop-blur-xl border-b border-neutral-200 dark:border-white/5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-primary dark:text-white font-display">Gestion des Retours</h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">
              Validez les retours et consultez l'historique
            </p>
          </div>

          <div className="flex gap-3">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-semantic-red tracking-wider">Total Retours</span>
              <span className="text-xl font-bold text-semantic-red">{formatMontant(totalRetours)}</span>
            </div>
            {totalPendingRetours > 0 && (
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider">En attente</span>
                <span className="text-xl font-bold text-amber-600 dark:text-amber-400">{formatMontant(totalPendingRetours)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => { setActiveTab('history'); setSelectedPendingGroup(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'history'
                ? 'bg-primary dark:bg-dark-accent text-white'
                : 'bg-neutral-100 dark:bg-white/5 text-neutral-500 dark:text-neutral-400'
            }`}
          >
            Historique des retours
          </button>
          <button
            onClick={() => { setActiveTab('pending'); setSelectedPendingGroup(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === 'pending'
                ? 'bg-primary dark:bg-dark-accent text-white'
                : 'bg-neutral-100 dark:bg-white/5 text-neutral-500 dark:text-neutral-400'
            }`}
          >
            <Clock className="w-4 h-4" />
            En attente de validation
            {retoursEnAttente && retoursEnAttente.length > 0 && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 rounded-full text-xs">
                {Object.keys(groupedPendingReturns || {}).length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'history' && (
          <div className="mt-6 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Rechercher par numéro de retour, commande ou serveur..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary dark:focus:border-dark-accent rounded-xl text-primary dark:text-white placeholder-neutral-400 focus:ring-4 focus:ring-primary/10 dark:focus:ring-dark-accent/10 transition-all outline-none"
              />
            </div>

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
        {activeTab === 'history' ? (
          <>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary dark:border-white"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredRetours?.map((retour) => (
                  <div
                    key={retour.id}
                    className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 shadow-soft overflow-hidden hover:border-primary/30 dark:hover:border-dark-accent/30 transition-all"
                  >
                    <div className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="bg-semantic-red/10 text-semantic-red size-10 rounded-lg flex items-center justify-center">
                          <ArrowLeftCircle className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-sm text-primary dark:text-white">
                            {retour.numero_retour}
                          </h3>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            {retour.commandes?.numero_commande}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
                          <User className="w-4 h-4" />
                          <span>{retour.commandes?.profiles?.prenom} {retour.commandes?.profiles?.nom}</span>
                        </div>
                        <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
                          <Receipt className="w-4 h-4" />
                          <span>Table {retour.commandes?.tables?.numero}</span>
                        </div>
                        <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
                          <Calendar className="w-4 h-4" />
                          <span>{format(new Date(retour.date_retour), 'dd MMM yyyy HH:mm', { locale: fr })}</span>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-neutral-200 dark:border-white/5 flex items-center justify-between">
                        <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">Montant</span>
                        <span className="text-lg font-bold text-semantic-red">{formatMontant(retour.montant_total_retour)}</span>
                      </div>

                      {retour.motif && (
                        <div className="mt-3 p-2 bg-neutral-50 dark:bg-white/5 rounded-lg">
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            <span className="font-bold">Motif:</span> {retour.motif}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {filteredRetours?.length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center py-12 text-neutral-400 dark:text-neutral-500">
                    <Package className="w-12 h-12 mb-2 opacity-50" />
                    <p>Aucun retour trouvé</p>
                  </div>
                )}
              </div>
            )}
          </>
        ) : selectedPendingGroup ? (
          <div className="max-w-4xl mx-auto space-y-6">
            <button
              onClick={() => setSelectedPendingGroup(null)}
              className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400 hover:text-primary dark:hover:text-dark-accent transition-colors"
            >
              <ArrowLeftCircle className="w-5 h-5" />
              <span>Retour à la liste</span>
            </button>

            <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-primary dark:text-white">
                    {selectedPendingGroup.commande.numero_commande}
                  </h2>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    Table {selectedPendingGroup.commande.tables.numero} • Demandé par {selectedPendingGroup.utilisateur.prenom} {selectedPendingGroup.utilisateur.nom}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-semantic-red">
                    {formatMontant(selectedPendingGroup.totalMontant)}
                  </span>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {format(new Date(selectedPendingGroup.date_demande), 'dd/MM/yyyy HH:mm', { locale: fr })}
                  </p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <h3 className="font-bold text-neutral-900 dark:text-white">Articles à retourner:</h3>
                {selectedPendingGroup.items.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-white/5 rounded-lg">
                    <div>
                      <p className="font-medium text-neutral-900 dark:text-white">{item.nom_produit}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        Quantité: {item.quantite_retournee} × {formatMontant(item.prix_unitaire)}
                      </p>
                    </div>
                    <span className="font-bold text-neutral-900 dark:text-white">{formatMontant(item.montant_ligne)}</span>
                  </div>
                ))}
              </div>

              {selectedPendingGroup.items[0].motif && (
                <div className="p-3 bg-neutral-50 dark:bg-white/5 rounded-lg mb-6">
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    <span className="font-bold">Motif:</span> {selectedPendingGroup.items[0].motif}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => handleValidateRetour(selectedPendingGroup.items[0].facture_id)}
                  disabled={isProcessing}
                  className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  ) : (
                    <CheckCircle className="w-5 h-5" />
                  )}
                  Valider le retour
                </button>
                <button
                  onClick={() => handleRejectRetour(selectedPendingGroup.items[0].facture_id)}
                  disabled={isProcessing}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <XCircle className="w-5 h-5" />
                  Refuser
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupedPendingReturns && Object.keys(groupedPendingReturns).length > 0 ? (
              Object.entries(groupedPendingReturns).map(([factureId, group]) => (
                <div
                  key={factureId}
                  onClick={() => setSelectedPendingGroup(group)}
                  className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 shadow-soft overflow-hidden cursor-pointer hover:border-amber-500/30 dark:hover:border-amber-500/30 transition-all"
                >
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 size-10 rounded-lg flex items-center justify-center">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-primary dark:text-white">
                          {group.commande.numero_commande}
                        </h3>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          Table {group.commande.tables.numero}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
                        <User className="w-4 h-4" />
                        <span>{group.utilisateur.prenom} {group.utilisateur.nom}</span>
                      </div>
                      <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
                        <Calendar className="w-4 h-4" />
                        <span>{format(new Date(group.date_demande), 'dd MMM yyyy HH:mm', { locale: fr })}</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-neutral-200 dark:border-white/5 flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">Montant</span>
                      <span className="text-lg font-bold text-semantic-red">{formatMontant(group.totalMontant)}</span>
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                      <AlertCircle className="w-4 h-4" />
                      <span>En attente de validation</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-neutral-400 dark:text-neutral-500">
                <Clock className="w-12 h-12 mb-2 opacity-50" />
                <p>Aucun retour en attente</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
