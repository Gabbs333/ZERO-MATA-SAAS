import { useState, useRef } from 'react';
import {
  CheckCircle,
  X,
  Clock,
  User,
  UserPlus,
  UtensilsCrossed,
  Eye,
  Loader2,
  AlertCircle,
  RefreshCcw,
  Edit3,
  Minus,
  Plus,
  PackagePlus
} from 'lucide-react';
import { useCommandesEnAttente, useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { useValidateCommande } from '../hooks/useSupabaseMutation';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';
import type { CommandeWithDetails } from '../types/database.types';
import { formatPrice, formatDate } from '../lib/utils';

export default function ValidationScreen() {
  const { data: commandes, isLoading, refetch, isRefetching } = useCommandesEnAttente();
  const { mutate: validateCommande, isPending } = useValidateCommande();
  const [selectedCommande, setSelectedCommande] = useState<CommandeWithDetails | null>(null);
  const [error, setError] = useState('');

  // Déblocage des commandes bloquées par un stock insuffisant
  const [stockIssue, setStockIssue] = useState<{ commande: CommandeWithDetails; manques: any[] } | null>(null);
  const [editCommande, setEditCommande] = useState<CommandeWithDetails | null>(null);
  const [editLines, setEditLines] = useState<{ produit_id: string; nom: string; quantite: number; prix_unitaire: number }[]>([]);
  const [restock, setRestock] = useState<{ produit_id: string; nom: string; commande: CommandeWithDetails; quantite: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [addProduitId, setAddProduitId] = useState('');

  // Filtre par catégorie pour chaque carte de commande ('all' | 'boisson' | 'nourriture')
  const [cardFilters, setCardFilters] = useState<Record<string, 'all' | 'boisson' | 'nourriture'>>({});

  // Synchronisation temps réel pour les commandes et les items
  useRealtimeSubscription('commandes', '*');
  useRealtimeSubscription('commande_items', '*');

  // Auth store pour récupérer l'établissement
  const { profile } = useAuthStore();

  // État pour suivre le client sélectionné par commande
  const [clientSelections, setClientSelections] = useState<Record<string, string>>({});

  // Ref pour suivre les assignations client en cours (évite la race condition avec la validation)
  const pendingAssignments = useRef<Map<string, PromiseLike<void>>>(new Map());

  // Charger la liste des clients actifs
  const { data: clients } = useSupabaseQuery<{ id: string; nom: string; prenom: string }[]>(
    ['clients_active', profile?.etablissement_id],
    async () => {
      if (!profile?.etablissement_id) return { data: [], error: null };
      const { data, error } = await supabase
        .from('clients')
        .select('id, nom, prenom')
        .eq('etablissement_id', profile.etablissement_id)
        .eq('actif', true)
        .order('nom');
      return { data, error };
    },
    { enabled: !!profile?.etablissement_id }
  );

  const { data: produits } = useSupabaseQuery<{ id: string; nom: string; prix_vente: number; categorie: string }[]>(
    ['produits_comptoir', profile?.etablissement_id],
    async () => {
      if (!profile?.etablissement_id) return { data: [], error: null };
      const { data, error: produitsError } = await supabase
        .from('produits')
        .select('id, nom, prix_vente, categorie')
        .eq('etablissement_id', profile.etablissement_id)
        .eq('actif', true)
        .order('nom');
      return { data: data || [], error: produitsError };
    },
    { enabled: !!profile?.etablissement_id }
  );

  // Synchroniser les client_ids existants des commandes chargées
  const [clientSynced, setClientSynced] = useState(false);
  if (!clientSynced && commandes && commandes.length > 0) {
    const existing: Record<string, string> = {};
    for (const cmd of commandes) {
      if (cmd.client_id) {
        existing[cmd.id] = cmd.client_id;
      }
    }
    if (Object.keys(existing).length > 0) {
      setClientSelections(existing);
    }
    setClientSynced(true);
  }

  // Trouver un client par son ID
  const getClientName = (clientId: string | null | undefined): string => {
    if (!clientId || !clients) return '';
    const client = clients.find(c => c.id === clientId);
    return client ? `${client.prenom} ${client.nom}` : '';
  };

  // Mettre à jour le client_id d'une commande
  const handleAssignClient = async (commandeId: string, clientId: string) => {
    setClientSelections(prev => ({ ...prev, [commandeId]: clientId }));
    // Sauvegarder la promesse pour permettre à handleValidate d'attendre la fin
    const promise = supabase.from('commandes').update({ client_id: clientId || null }).eq('id', commandeId).then(() => {
      pendingAssignments.current.delete(commandeId);
    });
    pendingAssignments.current.set(commandeId, promise);
    await promise;
  };

  const handleValidate = async (commandeId: string) => {
    setError('');
    // Attendre la fin de toute assignation client en cours avant de valider
    const pending = pendingAssignments.current.get(commandeId);
    if (pending) {
      await pending;
    }

    const commande = commandes?.find((c) => c.id === commandeId) || null;

    validateCommande(commandeId, {
      onSuccess: () => {
        setSelectedCommande(null);
        setStockIssue(null);
      },
      onError: async (err: any) => {
        const msg = err?.message || 'Erreur lors de la validation';
        setError(msg);
        // Stock insuffisant : on charge le diagnostic actionnable
        if (commande && /stock/i.test(msg)) {
          const { data } = await supabase.rpc('diagnostic_stock_commande', { p_commande_id: commandeId });
          const manques = (data as any)?.manques || [];
          setStockIssue(manques.length > 0 ? { commande, manques } : null);
        }
      },
    });
  };

  const refreshStockIssue = async (commande: CommandeWithDetails) => {
    const { data } = await supabase.rpc('diagnostic_stock_commande', { p_commande_id: commande.id });
    const manques = (data as any)?.manques || [];
    setStockIssue(manques.length > 0 ? { commande, manques } : null);
  };

  const handleAnnuler = async (commande: CommandeWithDetails) => {
    const motif = window.prompt(
      `Motif d'annulation de la commande ${commande.numero_commande || ''} :`,
      'Rupture de stock'
    );
    if (motif === null) return;

    setBusy(true);
    const { error: rpcError } = await supabase.rpc('annuler_commande', {
      p_commande_id: commande.id,
      p_motif: motif,
    });
    setBusy(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setStockIssue(null);
    setSelectedCommande(null);
    await refetch();
  };

  const openEdit = (commande: CommandeWithDetails) => {
    setEditCommande(commande);
    setAddProduitId('');
    setEditLines(
      (commande.commande_items || []).map((it) => ({
        produit_id: it.produit_id,
        nom: it.produits?.nom || it.nom_produit,
        quantite: it.quantite,
        prix_unitaire: it.prix_unitaire,
      }))
    );
  };

  const saveEdit = async () => {
    if (!editCommande) return;
    const items = editLines
      .filter((l) => l.quantite > 0)
      .map((l) => ({ produit_id: l.produit_id, quantite: l.quantite, prix_unitaire: l.prix_unitaire }));

    if (items.length === 0) {
      setError('La commande doit contenir au moins un article. Utilisez « Annuler » pour la supprimer.');
      return;
    }

    setBusy(true);
    const { error: rpcError } = await supabase.rpc('modifier_commande_en_attente', {
      p_commande_id: editCommande.id,
      p_items: items,
    });
    setBusy(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setEditCommande(null);
    setStockIssue(null);
    await refetch();
  };

  /** Réduit une ligne au stock disponible, puis rafraîchit le diagnostic. */
  const applyReduce = async (manque: any) => {
    if (!stockIssue) return;
    const items = (stockIssue.commande.commande_items || [])
      .map((it) => ({
        produit_id: it.produit_id,
        quantite: it.produit_id === manque.produit_id ? Number(manque.disponible) : it.quantite,
        prix_unitaire: it.prix_unitaire,
      }))
      .filter((i) => i.quantite > 0);

    if (items.length === 0) {
      setError('Aucun article restant : annulez la commande.');
      return;
    }

    setBusy(true);
    const { error: rpcError } = await supabase.rpc('modifier_commande_en_attente', {
      p_commande_id: stockIssue.commande.id,
      p_items: items,
    });
    setBusy(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    const updated = { ...stockIssue.commande };
    await refetch();
    await refreshStockIssue(updated);
  };

  const saveRestock = async () => {
    if (!restock) return;
    const q = Number(restock.quantite);
    if (!Number.isFinite(q) || q <= 0) {
      setError('Quantité invalide.');
      return;
    }

    setBusy(true);
    const { error: rpcError } = await supabase.rpc('ravitailler_produit_express', {
      p_produit_id: restock.produit_id,
      p_quantite: q,
      p_commentaire: `Déblocage commande ${restock.commande.numero_commande || ''}`.trim(),
    });
    setBusy(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    const commande = restock.commande;
    setRestock(null);
    await refetch();
    await refreshStockIssue(commande);
  };

  const addEditLine = () => {
    if (!addProduitId) return;
    if (editLines.some((l) => l.produit_id === addProduitId)) {
      setError('Ce produit est déjà dans la commande.');
      return;
    }
    const p = (produits || []).find((x) => x.id === addProduitId);
    if (!p) return;
    setEditLines((prev) => [
      ...prev,
      { produit_id: p.id, nom: p.nom, quantite: 1, prix_unitaire: p.prix_vente },
    ]);
    setAddProduitId('');
  };

  const totalAmount = commandes?.reduce((sum, cmd) => sum + cmd.montant_total, 0) || 0;
  const pendingCount = commandes?.length || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background-light dark:bg-background-dark transition-colors">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 pb-24 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header & Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="col-span-1 md:col-span-2 lg:col-span-2">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-display font-bold text-primary dark:text-white">
                Validations
              </h1>
              <button
                onClick={() => refetch()}
                disabled={isRefetching}
                className={`p-2 rounded-lg bg-white/50 dark:bg-neutral-800/50 border border-white/20 dark:border-white/5 text-primary dark:text-white hover:bg-white dark:hover:bg-neutral-800 transition-all duration-200 ${isRefetching ? 'animate-spin' : 'hover:rotate-180'}`}
                title="Actualiser"
              >
                <RefreshCcw className="w-5 h-5" />
              </button>
            </div>
            <p className="text-neutral-500 dark:text-neutral-400">
              Gérez les commandes en attente de validation
            </p>
          </div>

          <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl rounded-2xl p-4 border border-white/20 dark:border-white/5 shadow-soft flex items-center justify-between group hover:shadow-glow transition-all duration-300">
            <div>
              <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">En attente</p>
              <p className="text-3xl font-bold text-primary dark:text-white group-hover:scale-105 transition-transform origin-left">{pendingCount}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-semantic-amber/10 flex items-center justify-center text-semantic-amber group-hover:rotate-12 transition-transform duration-300">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl rounded-2xl p-4 border border-white/20 dark:border-white/5 shadow-soft flex items-center justify-between group hover:shadow-glow-success transition-all duration-300">
            <div>
              <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Montant Total</p>
              <p className="text-3xl font-bold text-primary dark:text-white group-hover:scale-105 transition-transform origin-left">{formatPrice(totalAmount)}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-semantic-green/10 flex items-center justify-center text-semantic-green group-hover:rotate-12 transition-transform duration-300">
              <span className="font-bold text-xl">₣</span>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-semantic-red/10 border border-semantic-red/20 backdrop-blur-sm text-semantic-red p-4 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <p>{error}</p>
            </div>
            <button onClick={() => setError('')} className="hover:bg-semantic-red/20 p-1 rounded-full transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Panneau de déblocage : stock insuffisant */}
        {stockIssue && (
          <div className="bg-semantic-amber/10 border border-semantic-amber/30 rounded-xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-semantic-amber shrink-0" />
                <div>
                  <p className="font-bold text-primary dark:text-white text-sm">
                    Stock insuffisant — commande {stockIssue.commande.numero_commande || ''}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Débloquez avec une des actions ci-dessous, puis relancez la validation.
                  </p>
                </div>
              </div>
              <button onClick={() => setStockIssue(null)} className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10">
                <X className="w-4 h-4 text-neutral-500" />
              </button>
            </div>

            <div className="divide-y divide-black/5 dark:divide-white/10">
              {stockIssue.manques.map((m: any) => (
                <div key={m.produit_id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    <span className="font-bold text-primary dark:text-white">{m.nom}</span>
                    <span className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">
                      demandé {m.quantite} · disponible {m.disponible} · manque {m.manque}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={busy || Number(m.disponible) <= 0}
                      onClick={() => applyReduce(m)}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/10 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Réduire à {m.disponible}
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        setRestock({
                          produit_id: m.produit_id,
                          nom: m.nom,
                          commande: stockIssue.commande,
                          quantite: String(m.manque),
                        })
                      }
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-semantic-green/10 text-semantic-green border border-semantic-green/20 hover:bg-semantic-green/20 transition-colors disabled:opacity-40"
                    >
                      Ravitailler
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={() => openEdit(stockIssue.commande)}
                className="px-3 py-2 rounded-lg text-xs font-bold bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/10 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
              >
                Modifier la commande
              </button>
              <button
                onClick={() => handleAnnuler(stockIssue.commande)}
                className="px-3 py-2 rounded-lg text-xs font-bold bg-semantic-red/10 text-semantic-red border border-semantic-red/20 hover:bg-semantic-red/20 transition-colors"
              >
                Annuler la commande
              </button>
              <button
                onClick={() => handleValidate(stockIssue.commande.id)}
                disabled={isPending}
                className="px-3 py-2 rounded-lg text-xs font-bold bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                Réessayer la validation
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        {commandes && commandes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm rounded-3xl border border-dashed border-neutral-200 dark:border-white/10">
            <div className="w-24 h-24 bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-700 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <CheckCircle className="w-12 h-12 text-neutral-400 dark:text-neutral-500" />
            </div>
            <h3 className="text-xl font-bold text-primary dark:text-white mb-2">
              Tout est calme
            </h3>
            <p className="text-neutral-500 dark:text-neutral-400 max-w-sm">
              Aucune commande en attente de validation pour le moment.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {commandes?.map((commande) => {
              // Déterminer le client_id effectif (sélection locale ou valeur existante)
              const effectiveClientId = clientSelections[commande.id] ?? commande.client_id;
              const clientName = getClientName(effectiveClientId);

              return (
              <div
                key={commande.id}
                className="group bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-white/5 shadow-sm hover:shadow-glow hover:-translate-y-1 transition-all duration-300 relative overflow-hidden flex flex-col"
              >
                {/* Status Stripe */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-semantic-amber"></div>

                {/* Card Header */}
                <div className="p-5 border-b border-neutral-100 dark:border-white/5 flex justify-between items-start bg-gradient-to-r from-transparent to-neutral-50/50 dark:to-white/5">
                  <div className="flex items-center gap-3 pl-2">
                    <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-neutral-100 to-white dark:from-neutral-800 dark:to-neutral-700 border border-neutral-200 dark:border-white/10 shadow-sm">
                      <User className="w-6 h-6 text-neutral-500 dark:text-neutral-400" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-primary dark:text-white">
                        {commande.profiles?.prenom || 'Inconnu'} {commande.profiles?.nom || ''}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 font-medium mt-0.5">
                        <span className="flex items-center gap-1 bg-neutral-100 dark:bg-white/5 px-1.5 py-0.5 rounded text-neutral-600 dark:text-neutral-300">
                          <UtensilsCrossed className="w-3 h-3" />
                          Table {commande.tables?.numero || '?'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(commande.date_creation)}
                        </span>
                      </div>
                      {/* Indicateur client assigné */}
                      {clientName && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-semantic-green font-medium">
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>{clientName}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-semantic-amber/10 text-semantic-amber border border-semantic-amber/20 shadow-sm">
                    {commande.statut}
                  </span>
                </div>

                {/* Card Body */}
                <div className="p-5 pl-7 flex-1 space-y-3">
                  {/* Filtres de catégorie pour la carte (Tous, Boissons, Nourriture) */}
                  <div className="flex p-0.5 bg-neutral-100 dark:bg-white/5 rounded-lg mb-2">
                    {(['all', 'boisson', 'nourriture'] as const).map((cat) => {
                      const currentFilter = cardFilters[commande.id] || 'all';
                      return (
                        <button
                          key={cat}
                          onClick={() => setCardFilters(prev => ({ ...prev, [commande.id]: cat }))}
                          className={`flex-1 py-1 text-[11px] font-bold rounded-md transition-all capitalize ${
                            currentFilter === cat
                              ? 'bg-primary text-white dark:bg-dark-accent dark:text-white shadow-sm'
                              : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'
                          }`}
                        >
                          {cat === 'all' ? 'Tous' : cat === 'boisson' ? '🍷 Boissons' : '🍲 Nourriture'}
                        </button>
                      );
                    })}
                  </div>

                  <div className="space-y-2.5">
                    {/* Mode diagnostic : affichage minimal si pas d'items */}
                    {commande.commande_items && commande.commande_items.length > 0 ? (
                      commande.commande_items
                        .filter((item: any) => {
                          const filter = cardFilters[commande.id] || 'all';
                          if (filter === 'all') return true;
                          return item.produits?.categorie === filter;
                        })
                        .map((item, index) => (
                        <div key={index} className="flex justify-between items-baseline text-sm group/item">
                          <span className="text-neutral-700 dark:text-neutral-200 font-medium flex items-center gap-2">
                            <span className="w-6 h-6 rounded bg-neutral-100 dark:bg-white/5 flex items-center justify-center text-xs font-bold text-primary dark:text-white border border-neutral-200 dark:border-white/5 group-hover/item:border-primary/30 transition-colors">
                              {item.quantite}x
                            </span>
                            {item.nom_produit}
                            {item.produits?.categorie && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                item.produits.categorie === 'boisson' ? 'bg-blue-500/10 text-blue-500' : 'bg-orange-500/10 text-orange-500'
                              }`}>
                                {item.produits.categorie}
                              </span>
                            )}
                          </span>
                          <span className="text-neutral-500 dark:text-neutral-400 text-xs tabular-nums font-mono">
                            {formatPrice(item.prix_unitaire * item.quantite)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-neutral-400 italic">
                        Chargement des détails... (Mode minimal)
                        <br/>
                        ID: {commande.id.substring(0, 8)}...
                      </div>
                    )}

                    {commande.commande_items && commande.commande_items.length > 3 && (
                      <p className="text-xs text-primary dark:text-blue-400 italic pt-1 pl-8 font-medium">
                        +{commande.commande_items.length - 3} autres articles...
                      </p>
                    )}
                  </div>

                  {/* Sélecteur de client */}
                  <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-white/10">
                    <label className="text-xs text-neutral-500 mb-1 block">Client :</label>
                    <select
                      value={clientSelections[commande.id] ?? commande.client_id ?? ''}
                      onChange={(e) => handleAssignClient(commande.id, e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Aucun client</option>
                      {clients?.map(c => (
                        <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="p-5 pl-7 pt-0 mt-auto space-y-4">
                  <div className="flex justify-between items-center pt-4 border-t border-neutral-100 dark:border-white/5 border-dashed">
                    <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Total</span>
                    <span className="text-xl font-bold text-primary dark:text-white tabular-nums tracking-tight">
                      {formatPrice(commande.montant_total)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setSelectedCommande(commande)}
                      className="h-11 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 font-bold text-xs hover:bg-neutral-50 dark:hover:bg-white/5 flex items-center justify-center gap-1.5 transition-all duration-200 hover:shadow-sm"
                    >
                      <Eye className="w-4 h-4" />
                      Détails
                    </button>
                    <button
                      onClick={() => openEdit(commande)}
                      disabled={busy}
                      className="h-11 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 font-bold text-xs hover:bg-neutral-50 dark:hover:bg-white/5 flex items-center justify-center gap-1.5 transition-all duration-200 hover:shadow-sm disabled:opacity-50"
                    >
                      <Edit3 className="w-4 h-4" />
                      Modifier
                    </button>
                    <button
                      onClick={() => handleValidate(commande.id)}
                      disabled={isPending}
                      className="h-11 rounded-xl bg-gradient-to-r from-primary to-blue-600 hover:from-blue-600 hover:to-primary text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all duration-300 shadow-lg shadow-primary/25 hover:shadow-primary/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none hover:-translate-y-0.5 active:translate-y-0"
                    >
                      {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      Valider
                    </button>
                  </div>

                  <button
                    onClick={() => handleAnnuler(commande)}
                    disabled={busy}
                    className="w-full text-[11px] font-bold text-neutral-400 hover:text-semantic-red transition-colors disabled:opacity-50"
                  >
                    Annuler la commande
                  </button>
                </div>
              </div>
            )})}
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedCommande && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-neutral-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-neutral-100 dark:border-neutral-700 flex justify-between items-center bg-neutral-50 dark:bg-neutral-800/50">
              <h3 className="font-bold text-lg text-primary dark:text-white">Détails de la commande</h3>
              <button
                onClick={() => setSelectedCommande(null)}
                className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Serveuse</p>
                  <p className="font-bold text-primary dark:text-white text-lg">
                    {selectedCommande.profiles.prenom} {selectedCommande.profiles.nom}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Table</p>
                  <p className="font-bold text-primary dark:text-white text-lg">
                    #{selectedCommande.tables.numero}
                  </p>
                </div>
              </div>

              {/* Client assigné dans la modale */}
              {getClientName(clientSelections[selectedCommande.id] ?? selectedCommande.client_id) && (
                <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-semantic-green/5 border border-semantic-green/10 rounded-xl">
                  <span>🧑</span>
                  <span className="text-sm font-medium text-semantic-green">
                    Client : {getClientName(clientSelections[selectedCommande.id] ?? selectedCommande.client_id)}
                  </span>
                </div>
              )}

              <div className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-100 dark:border-neutral-700 pb-2">
                  Articles commandés
                </p>
                {selectedCommande.commande_items.map((item, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b border-neutral-50 dark:border-neutral-800 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center text-sm font-bold text-primary dark:text-white">
                        {item.quantite}
                      </span>
                      <span className="font-medium text-primary dark:text-white">
                        {item.nom_produit}
                      </span>
                    </div>
                    <span className="font-bold text-primary dark:text-white tabular-nums">
                      {formatPrice(item.prix_unitaire * item.quantite)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-4 border-t border-neutral-100 dark:border-neutral-700">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-lg font-bold text-primary dark:text-white">Total à payer</span>
                  <span className="text-2xl font-bold text-semantic-green tabular-nums">
                    {formatPrice(selectedCommande.montant_total)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSelectedCommande(null)}
                    className="w-full py-3 rounded-xl border border-neutral-200 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 font-bold hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                  >
                    Fermer
                  </button>
                  <button
                    onClick={() => handleValidate(selectedCommande.id)}
                    disabled={isPending}
                    className="w-full py-3 rounded-xl bg-primary hover:bg-primary-dark dark:bg-white dark:text-primary dark:hover:bg-neutral-200 text-white font-bold flex items-center justify-center gap-2 transition-all"
                  >
                    {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                    Valider la commande
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modale de modification des lignes */}
      {editCommande && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-neutral-100 dark:border-neutral-700 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg text-primary dark:text-white">Modifier la commande</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {editCommande.numero_commande} · ajustez les quantités ou retirez des articles
                </p>
              </div>
              <button
                onClick={() => setEditCommande(null)}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              {editLines.length === 0 && (
                <p className="text-sm text-neutral-400 italic">Aucun article. Ajoutez-en un ou annulez la commande.</p>
              )}

              {editLines.map((line) => (
                <div
                  key={line.produit_id}
                  className="flex items-center justify-between gap-3 p-2 rounded-xl border border-neutral-200 dark:border-neutral-700"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-primary dark:text-white truncate">{line.nom}</p>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      {formatPrice(line.prix_unitaire)} × {line.quantite} = {formatPrice(line.prix_unitaire * line.quantite)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setEditLines((prev) =>
                          prev.map((l) =>
                            l.produit_id === line.produit_id
                              ? { ...l, quantite: Math.max(0, l.quantite - 1) }
                              : l
                          )
                        )
                      }
                      className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center font-bold tabular-nums text-primary dark:text-white">
                      {line.quantite}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setEditLines((prev) =>
                          prev.map((l) =>
                            l.produit_id === line.produit_id ? { ...l, quantite: l.quantite + 1 } : l
                          )
                        )
                      }
                      className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditLines((prev) => prev.filter((l) => l.produit_id !== line.produit_id))}
                      className="w-8 h-8 rounded-lg text-semantic-red hover:bg-semantic-red/10 flex items-center justify-center transition-colors"
                      title="Retirer l'article"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              <div className="flex gap-2 pt-2">
                <select
                  value={addProduitId}
                  onChange={(e) => setAddProduitId(e.target.value)}
                  className="flex-1 px-3 py-2 bg-neutral-100 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-lg text-sm text-neutral-900 dark:text-white outline-none"
                >
                  <option value="">Ajouter un produit…</option>
                  {(produits || [])
                    .filter((p) => !editLines.some((l) => l.produit_id === p.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nom} — {formatPrice(p.prix_vente)}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={addEditLine}
                  disabled={!addProduitId}
                  className="px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 text-sm font-bold disabled:opacity-40"
                >
                  Ajouter
                </button>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-neutral-100 dark:border-neutral-700">
                <span className="text-sm font-bold text-neutral-500 dark:text-neutral-400">Nouveau total</span>
                <span className="text-lg font-bold text-primary dark:text-white tabular-nums">
                  {formatPrice(editLines.reduce((sum, l) => sum + l.prix_unitaire * l.quantite, 0))}
                </span>
              </div>
            </div>

            <div className="p-4 border-t border-neutral-100 dark:border-neutral-700 flex gap-3">
              <button
                onClick={() => setEditCommande(null)}
                className="flex-1 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 font-bold hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={saveEdit}
                disabled={busy}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {busy ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale de ravitaillement express */}
      {restock && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-800 w-full max-w-sm rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-semantic-green/10 text-semantic-green">
                <PackagePlus className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-primary dark:text-white">Ravitailler « {restock.nom} »</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Entrée de stock immédiate, tracée comme ravitaillement.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 mb-1">
                Quantité reçue
              </label>
              <input
                type="number"
                min="1"
                value={restock.quantite}
                onChange={(e) => setRestock({ ...restock, quantite: e.target.value })}
                className="w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-lg text-sm text-primary dark:text-white outline-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setRestock(null)}
                className="flex-1 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 font-bold hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={saveRestock}
                disabled={busy}
                className="flex-1 py-2.5 rounded-xl bg-semantic-green text-white font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {busy ? 'Enregistrement…' : 'Valider l\'entrée'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
