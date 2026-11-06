import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowDownCircle, ArrowUpCircle, ArrowRightLeft,
  Plus, Trash2, Loader2, CheckCircle, PackageSearch
} from 'lucide-react';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { useCreerOperationStock } from '../hooks/useSupabaseMutation';
import { useAuthStore } from '../store/authStore';
import { formatPrice } from '../lib/utils';

type OperationType = 'entree' | 'sortie' | 'echange';

interface Produit {
  id: string;
  nom: string;
  categorie: string;
  prix_achat?: number | null;
  prix_vente: number;
  gestion_stock?: boolean;
  stocks?: { quantite_actuelle: number } | { quantite_actuelle: number }[] | null;
}

interface LigneDraft {
  key: string;
  produit_id: string;
  sens: 'entree' | 'sortie';
  quantite: number;
  prix_unitaire: number;
}

const newKey = () => Math.random().toString(36).slice(2);

const getStockQty = (p: Produit): number => {
  if (!p?.stocks) return 0;
  if (Array.isArray(p.stocks)) return p.stocks[0]?.quantite_actuelle ?? 0;
  return p.stocks.quantite_actuelle ?? 0;
};

export default function StockOperationsScreen() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const etablissementId = profile?.etablissement_id;

  const [typeOperation, setTypeOperation] = useState<OperationType>('entree');
  const [motif, setMotif] = useState('');
  const [contrepartie, setContrepartie] = useState('');
  const [lines, setLines] = useState<LigneDraft[]>([
    { key: newKey(), produit_id: '', sens: 'entree', quantite: 1, prix_unitaire: 0 },
  ]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { mutate: creerOperation, isPending } = useCreerOperationStock();

  const { data: produits } = useSupabaseQuery<Produit[]>(
    ['produits-operations-stock', etablissementId],
    async (sb) => {
      if (!etablissementId) return { data: [], error: null };
      return sb
        .from('produits')
        .select('id, nom, categorie, prix_achat, prix_vente, gestion_stock, stocks(quantite_actuelle)')
        .eq('etablissement_id', etablissementId)
        .eq('actif', true)
        .order('nom');
    },
    { enabled: !!etablissementId }
  );

  const produitsSuivis = useMemo(
    () => (produits || []).filter(p => p.gestion_stock !== false),
    [produits]
  );

  const { data: operations, refetch } = useSupabaseQuery<any[]>(
    ['operations_stock', etablissementId],
    async (sb) => {
      if (!etablissementId) return { data: [], error: null };
      return sb
        .from('operations_stock')
        .select('*, operations_stock_lignes(*)')
        .eq('etablissement_id', etablissementId)
        .order('date_creation', { ascending: false })
        .limit(20);
    },
    { enabled: !!etablissementId }
  );

  const changeType = (t: OperationType) => {
    setTypeOperation(t);
    setLines(prev => prev.map((l, idx) => ({
      ...l,
      sens: t === 'echange' ? (idx === 0 ? 'entree' : 'sortie') : t,
    })));
  };

  const addLine = (sens: 'entree' | 'sortie') => {
    setLines(prev => [...prev, {
      key: newKey(), produit_id: '', sens, quantite: 1, prix_unitaire: 0,
    }]);
  };

  const updateLine = (key: string, patch: Partial<LigneDraft>) => {
    setLines(prev => prev.map(l => {
      if (l.key !== key) return l;
      const next = { ...l, ...patch };
      if (patch.produit_id) {
        const produit = produitsSuivis.find(p => p.id === patch.produit_id);
        if (produit && (!next.prix_unitaire || next.prix_unitaire <= 0)) {
          next.prix_unitaire = produit.prix_achat ?? produit.prix_vente ?? 0;
        }
      }
      return next;
    }));
  };

  const removeLine = (key: string) => setLines(prev => prev.filter(l => l.key !== key));

  const valeurEntree = lines
    .filter(l => l.sens === 'entree')
    .reduce((s, l) => s + l.quantite * l.prix_unitaire, 0);
  const valeurSortie = lines
    .filter(l => l.sens === 'sortie')
    .reduce((s, l) => s + l.quantite * l.prix_unitaire, 0);

  const handleSubmit = () => {
    setError('');
    setSuccess('');

    if (!motif.trim()) {
      setError('Le motif est obligatoire.');
      return;
    }

    const valides = lines.filter(l => l.produit_id && l.quantite > 0);
    if (valides.length === 0) {
      setError('Ajoutez au moins une ligne valide.');
      return;
    }

    if (typeOperation === 'echange') {
      const hasEntree = valides.some(l => l.sens === 'entree');
      const hasSortie = valides.some(l => l.sens === 'sortie');
      if (!hasEntree || !hasSortie) {
        setError('Un échange doit contenir au moins une entrée et une sortie.');
        return;
      }
    }

    creerOperation(
      {
        type_operation: typeOperation,
        motif: motif.trim(),
        contrepartie: contrepartie.trim() || undefined,
        lignes: valides.map(l => ({
          produit_id: l.produit_id,
          sens: typeOperation === 'echange' ? l.sens : typeOperation,
          quantite: l.quantite,
          prix_unitaire: l.prix_unitaire > 0 ? l.prix_unitaire : undefined,
        })),
      },
      {
        onSuccess: (data: any) => {
          setSuccess(`Opération ${data?.reference || ''} enregistrée. Valeur nette : ${formatPrice(data?.valeur_nette ?? 0)}`);
          setLines([{ key: newKey(), produit_id: '', sens: typeOperation === 'sortie' ? 'sortie' : 'entree', quantite: 1, prix_unitaire: 0 }]);
          setMotif('');
          setContrepartie('');
          refetch();
        },
        onError: (err: any) => setError(err?.message || 'Erreur lors de l’opération.'),
      }
    );
  };

  const typeConfig: Record<OperationType, { label: string; icon: any; color: string }> = {
    entree: { label: 'Entrée', icon: ArrowDownCircle, color: 'text-emerald-600' },
    sortie: { label: 'Sortie', icon: ArrowUpCircle, color: 'text-semantic-red' },
    echange: { label: 'Échange', icon: ArrowRightLeft, color: 'text-blue-600' },
  };

  return (
    <div className="p-4 md:p-6 pb-24 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/stock')}
          className="p-2 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/5 text-neutral-500 hover:text-primary"
          title="Retour"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-display font-bold text-primary dark:text-white">Opérations de stock</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Entrée, sortie ou échange (troc) — avec valorisation du stock
          </p>
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

      {/* Type selector */}
      <div className="grid grid-cols-3 gap-2">
        {(['entree', 'sortie', 'echange'] as const).map(t => {
          const Icon = typeConfig[t].icon;
          const active = typeOperation === t;
          return (
            <button
              key={t}
              onClick={() => changeType(t)}
              className={`py-3 rounded-xl border font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                active
                  ? 'bg-primary dark:bg-dark-accent text-white border-primary dark:border-dark-accent'
                  : 'bg-white dark:bg-neutral-900/60 border-neutral-200 dark:border-white/5 text-neutral-500'
              }`}
            >
              <Icon className="w-4 h-4" />
              {typeConfig[t].label}
            </button>
          );
        })}
      </div>

      {/* Formulaire */}
      <div className="bg-white dark:bg-neutral-900/60 rounded-2xl border border-neutral-200 dark:border-white/5 p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-neutral-500 mb-1">Motif *</label>
            <input
              value={motif}
              onChange={e => setMotif(e.target.value)}
              placeholder={typeOperation === 'echange' ? 'Échange de bouteilles' : typeOperation === 'entree' ? 'Apport hors approvisionnement' : 'Casse, perte, don…'}
              className="w-full px-3 py-2.5 bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl text-sm text-primary dark:text-white outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-neutral-500 mb-1">Contrepartie (optionnel)</label>
            <input
              value={contrepartie}
              onChange={e => setContrepartie(e.target.value)}
              placeholder="Nom du tiers / fournisseur / client"
              className="w-full px-3 py-2.5 bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl text-sm text-primary dark:text-white outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="space-y-3">
          {lines.map((l, idx) => {
            const produit = produitsSuivis.find(p => p.id === l.produit_id);
            const sensEffective = typeOperation === 'echange' ? l.sens : typeOperation;
            return (
              <div key={l.key} className="p-3 rounded-xl bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/5 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                    sensEffective === 'entree' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-semantic-red'
                  }`}>
                    {sensEffective === 'entree' ? 'Entrée' : 'Sortie'}
                  </span>

                  {typeOperation === 'echange' && (
                    <select
                      value={l.sens}
                      onChange={e => updateLine(l.key, { sens: e.target.value as 'entree' | 'sortie' })}
                      className="px-2 py-1 text-xs font-bold bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/10 rounded-lg"
                    >
                      <option value="entree">Entrée</option>
                      <option value="sortie">Sortie</option>
                    </select>
                  )}

                  <select
                    value={l.produit_id}
                    onChange={e => updateLine(l.key, { produit_id: e.target.value })}
                    className="flex-1 min-w-[180px] px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-primary dark:text-white"
                  >
                    <option value="">— Sélectionner un produit —</option>
                    {produitsSuivis.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nom} (stock {getStockQty(p)})
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase">Qté</label>
                    <input
                      type="number"
                      min={1}
                      value={l.quantite}
                      onChange={e => updateLine(l.key, { quantite: Math.max(1, Number(e.target.value) || 1) })}
                      className="w-16 px-2 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-center text-primary dark:text-white"
                    />
                  </div>

                  <div className="flex items-center gap-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase">PU</label>
                    <input
                      type="number"
                      min={0}
                      value={l.prix_unitaire}
                      onChange={e => updateLine(l.key, { prix_unitaire: Math.max(0, Number(e.target.value) || 0) })}
                      className="w-24 px-2 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-center text-primary dark:text-white"
                    />
                  </div>

                  {lines.length > 1 && (
                    <button
                      onClick={() => removeLine(l.key)}
                      className="p-2 rounded-lg text-neutral-400 hover:text-semantic-red"
                      title="Supprimer la ligne"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {produit && (
                  <p className="text-[10px] text-neutral-400">
                    Stock actuel : <span className="font-bold">{getStockQty(produit)}</span>
                    {' '}· Valeur ligne : <span className="font-bold">{formatPrice(l.quantite * l.prix_unitaire)}</span>
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => addLine(typeOperation === 'sortie' ? 'sortie' : 'entree')}
            className="px-3 py-2 rounded-lg bg-neutral-100 dark:bg-white/5 text-xs font-bold text-neutral-600 dark:text-neutral-300 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Ajouter une ligne
          </button>
          {typeOperation === 'echange' && lines.length < 2 && (
            <span className="text-[10px] text-neutral-400">
              Astuce : ajoutez une seconde ligne (sortie) pour un échange.
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-neutral-100 dark:border-white/5">
          <div className="flex flex-wrap gap-4 text-xs">
            <span className="text-neutral-500">Valeur entrée : <b className="text-emerald-600">{formatPrice(valeurEntree)}</b></span>
            <span className="text-neutral-500">Valeur sortie : <b className="text-semantic-red">{formatPrice(valeurSortie)}</b></span>
            <span className="text-neutral-500">Net : <b>{formatPrice(valeurEntree - valeurSortie)}</b></span>
          </div>

          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="px-5 py-2.5 rounded-xl bg-primary dark:bg-dark-accent text-white font-bold text-sm hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Enregistrer l’opération
          </button>
        </div>
      </div>

      {/* Historique */}
      <div className="bg-white dark:bg-neutral-900/60 rounded-2xl border border-neutral-200 dark:border-white/5 overflow-hidden">
        <div className="p-4 border-b border-neutral-100 dark:border-white/5 flex items-center gap-2">
          <PackageSearch className="w-4 h-4 text-primary dark:text-white" />
          <h2 className="font-bold text-primary dark:text-white text-sm">Dernières opérations</h2>
        </div>

        {(!operations || operations.length === 0) ? (
          <p className="p-6 text-center text-xs text-neutral-400">Aucune opération enregistrée.</p>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-white/5 max-h-[50vh] overflow-y-auto">
            {operations.map(op => (
              <div key={op.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      op.type_operation === 'entree' ? 'bg-emerald-500/10 text-emerald-600' :
                      op.type_operation === 'sortie' ? 'bg-red-500/10 text-semantic-red' :
                      'bg-blue-500/10 text-blue-600'
                    }`}>
                      {op.type_operation}
                    </span>
                    <span className="font-bold text-xs text-primary dark:text-white">{op.reference}</span>
                    <span className="text-[10px] text-neutral-400">{new Date(op.date_creation).toLocaleString('fr-FR')}</span>
                  </div>
                  <span className="text-xs font-bold text-neutral-600 dark:text-neutral-300">
                    Net : {formatPrice(op.valeur_nette ?? 0)}
                  </span>
                </div>
                <p className="text-xs text-neutral-500">
                  {op.motif}{op.contrepartie ? ` · ${op.contrepartie}` : ''}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(op.operations_stock_lignes || []).map((l: any) => (
                    <span key={l.id} className="text-[10px] px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-white/5 text-neutral-500">
                      {l.sens === 'entree' ? '+' : '−'}{l.quantite} × {l.nom_produit}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
