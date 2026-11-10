import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../config/supabase';
import { formatMontant } from '../../utils/format';
import {
  Calculator,
  ClipboardCheck,
  Loader2,
  RotateCcw,
  Search,
  Truck,
  X,
} from 'lucide-react';

interface EtatStockRow {
  produit_id: string;
  produit_nom: string;
  categorie: string;
  cout_unitaire: number;
  qte_ouverture: number;
  qte_entrees: number;
  qte_sorties_ventes: number;
  qte_sorties_autres: number;
  qte_theorique: number;
  valeur_theorique: number;
  qte_reelle: number | null;
  est_compte: boolean;
}

interface ClotureStockResult {
  success: boolean;
  date_cloture: string;
  produits_comptes: number;
  produits_ajustes: number;
  ecart_qte: number;
  ecart_valeur: number;
}

interface ClotureStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const todayInput = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export function ClotureStockModal({ isOpen, onClose, onSuccess }: ClotureStockModalProps) {
  const [date, setDate] = useState(todayInput());
  const [rows, setRows] = useState<EtatStockRow[]>([]);
  const [comptages, setComptages] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [commentaire, setCommentaire] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'error'; message: string } | null>(null);

  const charger = async (targetDate: string) => {
    setLoading(true);
    setFeedback(null);
    try {
      const { data, error } = await supabase.rpc('get_etat_stock_jour', {
        p_date: targetDate,
      });
      if (error) throw error;

      const payload = data as { date: string; rows: EtatStockRow[] } | null;
      const nextRows = payload?.rows ?? [];
      setRows(nextRows);

      const prefill: Record<string, string> = {};
      nextRows.forEach((row) => {
        if (row.est_compte && row.qte_reelle !== null) {
          prefill[row.produit_id] = String(row.qte_reelle);
        }
      });
      setComptages(prefill);
    } catch (err: any) {
      console.error('Chargement état stock:', err);
      setFeedback({
        type: 'error',
        message: err?.message || "Impossible de charger l'état du stock.",
      });
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setCommentaire('');
    charger(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, date]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        r.produit_nom.toLowerCase().includes(needle) ||
        r.categorie.toLowerCase().includes(needle),
    );
  }, [rows, search]);

  const ecartLigne = (row: EtatStockRow) => {
    const raw = comptages[row.produit_id];
    if (raw === undefined || raw.trim() === '') return null;
    const reel = Number(raw);
    if (!Number.isFinite(reel)) return null;
    return (reel - row.qte_theorique) * row.cout_unitaire;
  };

  const totaux = useMemo(() => {
    let theorique = 0;
    let reel = 0;
    let comptes = 0;
    let ecart = 0;

    rows.forEach((row) => {
      theorique += row.valeur_theorique;
      const raw = comptages[row.produit_id];
      if (raw !== undefined && raw.trim() !== '') {
        const valeur = Number(raw);
        if (Number.isFinite(valeur)) {
          reel += valeur * row.cout_unitaire;
          ecart += (valeur - row.qte_theorique) * row.cout_unitaire;
          comptes += 1;
        }
      }
    });

    return { theorique, reel, comptes, ecart };
  }, [rows, comptages]);

  const reprendreTheoriques = () => {
    const prefill: Record<string, string> = {};
    rows.forEach((row) => {
      prefill[row.produit_id] = String(row.qte_theorique);
    });
    setComptages(prefill);
  };

  const handleSubmit = async () => {
    const items = rows
      .map((row) => {
        const raw = comptages[row.produit_id];
        if (raw === undefined || raw.trim() === '') return null;
        const valeur = Number(raw);
        if (!Number.isFinite(valeur) || valeur < 0) return null;
        return { produit_id: row.produit_id, quantite_reelle: Math.round(valeur) };
      })
      .filter(Boolean) as { produit_id: string; quantite_reelle: number }[];

    if (items.length === 0) {
      setFeedback({ type: 'error', message: 'Saisissez au moins un produit compté.' });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const { data, error } = await supabase.rpc('enregistrer_cloture_stock', {
        p_date: date,
        p_items: items,
        p_commentaire: commentaire.trim() || null,
      });
      if (error) throw error;

      const result = data as ClotureStockResult;
      setFeedback({
        type: 'ok',
        message: `Clôture enregistrée : ${result.produits_comptes} produit(s), ${result.produits_ajustes} ajustement(s), écart ${formatMontant(
          result.ecart_valeur,
        )}.`,
      });
      onSuccess();
      charger(date);
    } catch (err: any) {
      console.error('Clôture stock:', err);
      setFeedback({
        type: 'error',
        message: err?.message || "Impossible d'enregistrer la clôture.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-dark-card w-full max-w-4xl rounded-2xl shadow-2xl border border-neutral-200 dark:border-white/10 flex flex-col max-h-[92vh]">
        <div className="p-4 border-b border-neutral-100 dark:border-white/5 flex justify-between items-center">
          <h2 className="text-lg font-bold text-primary dark:text-white font-display flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-blue-500" />
            Clôture de stock
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        <div className="p-4 border-b border-neutral-100 dark:border-white/5 flex flex-col lg:flex-row lg:items-end gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">
              Journée
            </label>
            <input
              type="date"
              value={date}
              max={todayInput()}
              onChange={(e) => setDate(e.target.value)}
              className="px-3 py-2 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary rounded-xl text-sm text-primary dark:text-white outline-none"
            />
          </div>

          <div className="flex-1">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">
              Recherche
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Produit ou catégorie…"
                className="w-full pl-9 pr-3 py-2 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary rounded-xl text-sm text-primary dark:text-white outline-none"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={reprendreTheoriques}
            disabled={rows.length === 0}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-neutral-100 dark:bg-white/5 text-sm font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-white/10 disabled:opacity-50 transition-colors"
            title="Remplir les quantités comptées avec les quantités théoriques"
          >
            <RotateCcw className="w-4 h-4" />
            Reprendre les théoriques
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-neutral-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Chargement de l'état du stock…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-neutral-400">
              <Truck className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aucun produit à suivi de stock pour cette journée.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-neutral-50 dark:bg-dark-card z-10">
                <tr className="text-[10px] uppercase tracking-widest text-neutral-500">
                  <th className="text-left px-4 py-2 font-bold">Produit</th>
                  <th className="text-right px-2 py-2 font-bold">Ouverture</th>
                  <th className="text-right px-2 py-2 font-bold">Entrées</th>
                  <th className="text-right px-2 py-2 font-bold">Vendues</th>
                  <th className="text-right px-2 py-2 font-bold">Autres</th>
                  <th className="text-right px-2 py-2 font-bold">Théorique</th>
                  <th className="text-right px-2 py-2 font-bold">Compté</th>
                  <th className="text-right px-4 py-2 font-bold">Écart</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
                {filtered.map((row) => {
                  const ecart = ecartLigne(row);
                  return (
                    <tr key={row.produit_id} className="hover:bg-neutral-50 dark:hover:bg-white/5">
                      <td className="px-4 py-2">
                        <p className="font-medium text-primary dark:text-white">{row.produit_nom}</p>
                        <p className="text-[10px] text-neutral-400 uppercase">{row.categorie}</p>
                      </td>
                      <td className="px-2 py-2 text-right text-neutral-500">{row.qte_ouverture}</td>
                      <td className="px-2 py-2 text-right text-green-600">{row.qte_entrees}</td>
                      <td className="px-2 py-2 text-right text-blue-600">{row.qte_sorties_ventes}</td>
                      <td className="px-2 py-2 text-right text-neutral-500">
                        {row.qte_sorties_autres}
                      </td>
                      <td className="px-2 py-2 text-right font-bold text-primary dark:text-white">
                        {row.qte_theorique}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          inputMode="numeric"
                          value={comptages[row.produit_id] ?? ''}
                          onChange={(e) =>
                            setComptages((prev) => ({
                              ...prev,
                              [row.produit_id]: e.target.value,
                            }))
                          }
                          placeholder="—"
                          className="w-20 px-2 py-1 text-right bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary rounded-lg text-primary dark:text-white outline-none"
                        />
                      </td>
                      <td
                        className={`px-4 py-2 text-right font-bold ${
                          ecart === null
                            ? 'text-neutral-300'
                            : ecart === 0
                              ? 'text-green-600'
                              : 'text-semantic-red'
                        }`}
                      >
                        {ecart === null ? '—' : formatMontant(ecart)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="p-4 border-t border-neutral-100 dark:border-white/5 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl bg-neutral-50 dark:bg-white/5 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                Valeur théorique
              </p>
              <p className="font-bold text-primary dark:text-white">{formatMontant(totaux.theorique)}</p>
            </div>
            <div className="rounded-xl bg-neutral-50 dark:bg-white/5 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                Valeur comptée
              </p>
              <p className="font-bold text-primary dark:text-white">{formatMontant(totaux.reel)}</p>
            </div>
            <div className="rounded-xl bg-neutral-50 dark:bg-white/5 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                Écart
              </p>
              <p
                className={`font-bold ${
                  totaux.ecart === 0 ? 'text-green-600' : 'text-semantic-red'
                }`}
              >
                {formatMontant(totaux.ecart)}
              </p>
            </div>
            <div className="rounded-xl bg-neutral-50 dark:bg-white/5 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                Produits comptés
              </p>
              <p className="font-bold text-primary dark:text-white">
                {totaux.comptes} / {rows.length}
              </p>
            </div>
          </div>

          <input
            type="text"
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            placeholder="Commentaire (casse, perte, écart de service…)"
            className="w-full px-3 py-2 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary rounded-xl text-sm text-primary dark:text-white outline-none"
          />

          {feedback && (
            <p
              className={`text-sm font-medium ${
                feedback.type === 'ok' ? 'text-green-600' : 'text-semantic-red'
              }`}
            >
              {feedback.message}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl font-bold text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors text-sm"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || totaux.comptes === 0}
              className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-primary dark:bg-dark-accent hover:opacity-90 transition-opacity shadow-lg shadow-primary/20 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Calculator className="w-4 h-4" />
              )}
              Enregistrer la clôture
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
