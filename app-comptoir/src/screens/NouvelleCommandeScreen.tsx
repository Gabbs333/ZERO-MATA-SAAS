import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, Minus, ShoppingCart, Trash2, Loader2,
  UtensilsCrossed, Wine, Package, CheckCircle, ArrowLeft
} from 'lucide-react';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { useCreateCommandeComptoir } from '../hooks/useSupabaseMutation';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../config/supabase';
import { formatPrice } from '../lib/utils';
import { buildPrixMap } from '../lib/prix';
import type { Tarif } from '../lib/prix';

type TypeService = 'sur_place' | 'emporter';
type Categorie = 'all' | 'boisson' | 'nourriture' | 'autre';

interface Produit {
  id: string;
  nom: string;
  categorie: 'boisson' | 'nourriture' | 'autre';
  prix_vente: number;
  actif: boolean;
  gestion_stock?: boolean;
  stocks?: { quantite_actuelle: number; etablissement_id: string } | { quantite_actuelle: number; etablissement_id: string }[] | null;
}

interface CartLine {
  produit: Produit;
  quantite: number;
  prix: number;
}

const getStockQty = (p: Produit): number => {
  if (!p.stocks) return 0;
  if (Array.isArray(p.stocks)) return p.stocks[0]?.quantite_actuelle ?? 0;
  return p.stocks.quantite_actuelle ?? 0;
};

const isDisponible = (p: Produit): boolean => {
  if (p.gestion_stock === false) return true;
  return getStockQty(p) > 0;
};

export default function NouvelleCommandeScreen() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const etablissementId = profile?.etablissement_id;

  const [typeService, setTypeService] = useState<TypeService>('sur_place');
  const [tableId, setTableId] = useState<string>('');
  const [clientId, setClientId] = useState<string>('');
  const [categorie, setCategorie] = useState<Categorie>('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { mutate: createCommande, isPending } = useCreateCommandeComptoir();

  const { data: produits, isLoading } = useSupabaseQuery<Produit[]>(
    ['produits-commande', etablissementId],
    async (sb) => {
      if (!etablissementId) return { data: [], error: null };
      return sb
        .from('produits')
        .select('id, nom, categorie, prix_vente, actif, gestion_stock, stocks(quantite_actuelle, etablissement_id)')
        .eq('etablissement_id', etablissementId)
        .eq('actif', true)
        .order('nom');
    },
    { enabled: !!etablissementId }
  );

  const { data: tarifs } = useSupabaseQuery<Tarif[]>(
    ['tarifs_specifiques', etablissementId],
    async (sb) => {
      if (!etablissementId) return { data: [], error: null };
      return sb
        .from('tarifs_specifiques')
        .select('*')
        .eq('etablissement_id', etablissementId)
        .eq('actif', true);
    },
    { enabled: !!etablissementId }
  );

  const { data: tables } = useSupabaseQuery<any[]>(
    ['tables-select', etablissementId],
    async (sb) => {
      if (!etablissementId) return { data: [], error: null };
      return sb
        .from('tables')
        .select('id, numero, statut')
        .eq('etablissement_id', etablissementId)
        .order('numero');
    },
    { enabled: !!etablissementId }
  );

  const { data: clients } = useSupabaseQuery<any[]>(
    ['clients-select', etablissementId],
    async (sb) => {
      if (!etablissementId) return { data: [], error: null };
      return sb
        .from('clients')
        .select('id, nom, prenom')
        .eq('etablissement_id', etablissementId)
        .eq('actif', true)
        .order('nom');
    },
    { enabled: !!etablissementId }
  );

  const now = new Date();
  const prixMap = useMemo(() => buildPrixMap(produits, tarifs, now), [produits, tarifs]);

  const filtered = useMemo(() => {
    let list = (produits || []).filter(isDisponible);
    if (categorie !== 'all') list = list.filter(p => p.categorie === categorie);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.nom.toLowerCase().includes(q));
    }
    return list;
  }, [produits, categorie, search]);

  const total = useMemo(
    () => cart.reduce((sum, l) => sum + l.prix * l.quantite, 0),
    [cart]
  );

  const addToCart = (produit: Produit) => {
    const prix = prixMap.get(produit.id) ?? produit.prix_vente;
    setCart(prev => {
      const existing = prev.find(l => l.produit.id === produit.id);
      if (existing) {
        return prev.map(l => l.produit.id === produit.id ? { ...l, quantite: l.quantite + 1 } : l);
      }
      return [...prev, { produit, quantite: 1, prix }];
    });
  };

  const changeQty = (produitId: string, delta: number) => {
    setCart(prev => prev
      .map(l => l.produit.id === produitId ? { ...l, quantite: l.quantite + delta } : l)
      .filter(l => l.quantite > 0));
  };

  const removeLine = (produitId: string) => {
    setCart(prev => prev.filter(l => l.produit.id !== produitId));
  };

  const resetForm = () => {
    setCart([]);
    setTableId('');
    setClientId('');
    setSearch('');
  };

  const handleSubmit = (validerImmediatement: boolean) => {
    setError('');
    setSuccess('');

    if (cart.length === 0) {
      setError('Ajoutez au moins un article à la commande.');
      return;
    }

    if (typeService === 'sur_place' && !tableId) {
      setError('Sélectionnez une table pour un service sur place (ou passez en à emporter).');
      return;
    }

    createCommande(
      {
        items: cart.map(l => ({ produit_id: l.produit.id, quantite: l.quantite })),
        table_id: typeService === 'sur_place' ? tableId : null,
        type_service: typeService,
        client_id: clientId || null,
        valider_immediatement: validerImmediatement,
      },
      {
        onSuccess: () => {
          setSuccess(
            validerImmediatement
              ? 'Commande validée. Les factures ont été générées.'
              : 'Commande enregistrée et envoyée en préparation.'
          );
          resetForm();
          if (validerImmediatement) {
            setTimeout(() => navigate('/factures'), 900);
          }
        },
        onError: (err: any) => {
          setError(err?.message || 'Erreur lors de la création de la commande.');
        },
      }
    );
  };

  return (
    <div className="p-4 md:p-6 pb-28 max-w-7xl mx-auto space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/5 text-neutral-500 hover:text-primary"
            title="Retour"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-display font-bold text-primary dark:text-white">Nouvelle commande</h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Prise de commande au comptoir</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex p-1 bg-neutral-100 dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/5">
            <button
              onClick={() => setTypeService('sur_place')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                typeService === 'sur_place' ? 'bg-primary text-white shadow-sm' : 'text-neutral-500'
              }`}
            >
              Sur place
            </button>
            <button
              onClick={() => { setTypeService('emporter'); setTableId(''); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                typeService === 'emporter' ? 'bg-primary text-white shadow-sm' : 'text-neutral-500'
              }`}
            >
              À emporter
            </button>
          </div>

          {typeService === 'sur_place' && (
            <select
              value={tableId}
              onChange={(e) => setTableId(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/10 rounded-xl text-sm text-primary dark:text-white"
            >
              <option value="">— Choisir une table —</option>
              {(tables || []).map((t: any) => (
                <option key={t.id} value={t.id}>
                  Table {t.numero} {t.statut && t.statut !== 'libre' ? `(${t.statut})` : ''}
                </option>
              ))}
            </select>
          )}

          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/10 rounded-xl text-sm text-primary dark:text-white"
          >
            <option value="">Client (optionnel)</option>
            {(clients || []).map((c: any) => (
              <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm font-medium">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm font-medium flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Catalogue */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un produit..."
                className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/10 rounded-xl text-sm text-primary dark:text-white outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex p-1 bg-neutral-100 dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/5 overflow-x-auto">
              {(['all', 'boisson', 'nourriture', 'autre'] as const).map(c => (
                <button
                  key={c}
                  onClick={() => setCategorie(c)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${
                    categorie === c ? 'bg-white dark:bg-dark-accent text-primary dark:text-white shadow-sm' : 'text-neutral-500'
                  }`}
                >
                  {c === 'all' ? 'Tous' : c === 'boisson' ? '🍷 Boissons' : c === 'nourriture' ? '🍲 Nourriture' : 'Autre'}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-neutral-400 text-sm">Aucun produit disponible.</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {filtered.map(p => {
                const qty = getStockQty(p);
                const prix = prixMap.get(p.id) ?? p.prix_vente;
                const enCart = cart.find(l => l.produit.id === p.id)?.quantite || 0;
                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="text-left p-4 rounded-2xl bg-white dark:bg-neutral-900/60 border border-neutral-200 dark:border-white/5 hover:border-primary/40 hover:-translate-y-0.5 transition-all relative"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className={`p-1.5 rounded-lg ${
                        p.categorie === 'boisson' ? 'bg-blue-500/10 text-blue-500' :
                        p.categorie === 'nourriture' ? 'bg-orange-500/10 text-orange-500' :
                        'bg-neutral-500/10 text-neutral-500'
                      }`}>
                        {p.categorie === 'boisson' ? <Wine className="w-4 h-4" /> :
                         p.categorie === 'nourriture' ? <UtensilsCrossed className="w-4 h-4" /> :
                         <Package className="w-4 h-4" />}
                      </span>
                      {enCart > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-black">
                          {enCart}
                        </span>
                      )}
                    </div>
                    <p className="font-bold text-sm text-primary dark:text-white leading-tight line-clamp-2">{p.nom}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm font-black text-primary dark:text-white">{formatPrice(prix)}</span>
                      <span className="text-[10px] font-bold text-neutral-400">
                        {p.gestion_stock === false ? 'Sur commande' : `Stock ${qty}`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Panier */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 bg-white dark:bg-neutral-900/60 rounded-2xl border border-neutral-200 dark:border-white/5 shadow-soft overflow-hidden">
            <div className="p-4 border-b border-neutral-100 dark:border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-primary dark:text-white" />
                <h2 className="font-bold text-primary dark:text-white">Panier</h2>
              </div>
              {cart.length > 0 && (
                <button onClick={() => setCart([])} className="text-xs font-bold text-semantic-red hover:underline">
                  Vider
                </button>
              )}
            </div>

            <div className="max-h-[45vh] overflow-y-auto divide-y divide-neutral-100 dark:divide-white/5">
              {cart.length === 0 ? (
                <p className="p-6 text-center text-xs text-neutral-400">Aucun article sélectionné.</p>
              ) : cart.map(l => (
                <div key={l.produit.id} className="p-3 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-primary dark:text-white truncate">{l.produit.nom}</p>
                    <p className="text-xs text-neutral-500">{formatPrice(l.prix)} / unité</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => changeQty(l.produit.id, -1)}
                      className="w-7 h-7 rounded-lg bg-neutral-100 dark:bg-white/10 flex items-center justify-center"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-black">{l.quantite}</span>
                    <button
                      onClick={() => changeQty(l.produit.id, 1)}
                      className="w-7 h-7 rounded-lg bg-neutral-100 dark:bg-white/10 flex items-center justify-center"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => removeLine(l.produit.id)}
                      className="w-7 h-7 rounded-lg text-neutral-400 hover:text-semantic-red flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-neutral-100 dark:border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Total</span>
                <span className="text-xl font-black text-primary dark:text-white">{formatPrice(total)}</span>
              </div>

              <button
                onClick={() => handleSubmit(false)}
                disabled={isPending || cart.length === 0}
                className="w-full py-3 rounded-xl border border-primary/30 text-primary dark:text-white font-bold text-sm hover:bg-primary/5 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Envoyer en préparation
              </button>

              <button
                onClick={() => handleSubmit(true)}
                disabled={isPending || cart.length === 0}
                className="w-full py-3 rounded-xl bg-primary dark:bg-dark-accent text-white font-bold text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Valider
              </button>

              <p className="text-[10px] text-neutral-400 text-center">
                Les prix dynamiques (Happy Hours, week-end…) sont appliqués par le système.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
