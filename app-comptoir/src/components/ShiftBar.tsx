import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';
import { formatPrice } from '../lib/utils';
import { Clock, Play, Square, X, AlertTriangle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Bandeau de shift : ouverture / clôture (passation).
 *
 * - Aucune session ouverte  -> bouton « Ouvrir le shift » (jamais bloquant).
 * - Session ouverte          -> nom du shift, heure d'ouverture, CA et
 *   encaissements live, bouton « Clôturer / Passation ».
 *
 * Toutes les transactions sont estampillées côté serveur : l'agent n'a rien
 * d'autre à faire pendant le service.
 */
export function ShiftBar() {
  const { profile } = useAuthStore();

  const [active, setActive] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState<any[]>([]);
  const [sessionDetail, setSessionDetail] = useState<any>(null);

  const [isOpenModal, setIsOpenModal] = useState(false);
  const [isCloseModal, setIsCloseModal] = useState(false);
  const [shiftId, setShiftId] = useState('');
  const [fond, setFond] = useState('0');
  const [montantCompte, setMontantCompte] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Comptage physique de stock à la passation
  const [stockPrep, setStockPrep] = useState<any>(null);
  const [stockCounts, setStockCounts] = useState<Record<string, string>>({});
  const [stockSearch, setStockSearch] = useState('');
  const [stockOpen, setStockOpen] = useState(true);

  const loadActive = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc('session_shift_active');
    if (rpcError) {
      console.error('session_shift_active:', rpcError.message);
      setLoading(false);
      return;
    }
    setActive((data as any)?.session ? data : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadActive();
    const timer = setInterval(loadActive, 60_000);
    return () => clearInterval(timer);
  }, [loadActive]);

  const openShiftModal = async () => {
    setError('');
    setFond('0');
    const { data, error: shiftsError } = await supabase
      .from('shifts')
      .select('*')
      .eq('etablissement_id', profile?.etablissement_id)
      .eq('actif', true)
      .order('ordre');

    if (shiftsError) {
      setError(shiftsError.message);
      return;
    }

    const list = data || [];
    setShifts(list);
    // Suggestion : le shift dont la plage horaire contient l'heure actuelle
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const toMin = (t: string) => {
      const [h, m] = String(t).split(':').map(Number);
      return h * 60 + (m || 0);
    };
    const suggested = list.find((s: any) => {
      const start = toMin(s.heure_debut);
      const end = toMin(s.heure_fin);
      return start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
    });
    setShiftId(suggested?.id || list[0]?.id || '');
    setIsOpenModal(true);
  };

  const handleOpen = async () => {
    if (!shiftId) {
      setError('Choisissez un shift.');
      return;
    }
    setBusy(true);
    setError('');
    const { error: rpcError } = await supabase.rpc('ouvrir_session_shift', {
      p_shift_id: shiftId,
      p_fond_initial: Number(fond) || 0,
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setIsOpenModal(false);
    await loadActive();
  };

  const openCloseModal = async () => {
    if (!active?.session?.id) return;
    setError('');
    setMontantCompte('');
    setCommentaire('');
    setSessionDetail(null);
    setStockPrep(null);
    setStockCounts({});
    setStockSearch('');
    setStockOpen(true);
    setIsCloseModal(true);

    const sessionId = active.session.id;
    const [soldeRes, prepRes] = await Promise.all([
      supabase.rpc('get_solde_session', { p_session_id: sessionId }),
      supabase.rpc('get_comptage_shift_preparation', { p_session_id: sessionId }),
    ]);

    if (soldeRes.error) {
      setError(soldeRes.error.message);
      return;
    }
    setSessionDetail(soldeRes.data);
    setMontantCompte(String((soldeRes.data as any)?.solde_theorique ?? ''));

    if (!prepRes.error && prepRes.data) {
      const prep = prepRes.data as any;
      setStockPrep(prep);
      const pre: Record<string, string> = {};
      (prep.produits || []).forEach((p: any) => {
        if (p.quantite_comptee !== null && p.quantite_comptee !== undefined) {
          pre[p.produit_id] = String(p.quantite_comptee);
        }
      });
      setStockCounts(pre);
    } else if (prepRes.error) {
      // Le comptage reste optionnel : on n'empêche pas la clôture.
      console.warn('Préparation comptage stock:', prepRes.error.message);
    }
  };

  const produitsStock = useMemo(() => {
    const list: any[] = stockPrep?.produits || [];
    const q = stockSearch.trim().toLowerCase();
    return q ? list.filter((p) => String(p.produit_nom).toLowerCase().includes(q)) : list;
  }, [stockPrep, stockSearch]);

  const lignesComptage = useMemo(
    () =>
      Object.entries(stockCounts)
        .filter(([, v]) => v !== '' && Number.isFinite(Number(v)))
        .map(([produit_id, v]) => ({ produit_id, quantite_comptee: Math.max(0, Math.round(Number(v))) })),
    [stockCounts]
  );

  const varianceStock = useMemo(() => {
    let qte = 0;
    let valeur = 0;
    (stockPrep?.produits || []).forEach((p: any) => {
      const raw = stockCounts[p.produit_id];
      if (raw === undefined || raw === '') return;
      const n = Number(raw);
      if (!Number.isFinite(n)) return;
      const delta = Math.round(n) - Number(p.quantite_theorique || 0);
      qte += delta;
      valeur += delta * Number(p.cout_unitaire || 0);
    });
    return { qte, valeur };
  }, [stockPrep, stockCounts]);

  const remplirTheorique = () => {
    const map: Record<string, string> = {};
    (stockPrep?.produits || []).forEach((p: any) => {
      map[p.produit_id] = String(p.quantite_theorique);
    });
    setStockCounts(map);
  };

  const handleClose = async () => {
    if (!active?.session?.id) return;
    const valeur = Number(montantCompte);
    if (!Number.isFinite(valeur) || valeur < 0) {
      setError('Montant compté invalide.');
      return;
    }

    setBusy(true);
    setError('');

    // Comptage physique de stock, saisi au moment de la passation
    if (lignesComptage.length > 0) {
      const { error: countError } = await supabase.rpc('enregistrer_comptage_shift', {
        p_session_id: active.session.id,
        p_lignes: lignesComptage,
        p_commentaire: commentaire || null,
        p_appliquer_ajustement: true,
      });
      if (countError) {
        setBusy(false);
        setError(`Comptage du stock : ${countError.message}`);
        return;
      }
    }

    const { error: rpcError } = await supabase.rpc('fermer_session_shift', {
      p_session_id: active.session.id,
      p_montant_compte: valeur,
      p_commentaire: commentaire || null,
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setIsCloseModal(false);
    await loadActive();
  };

  const duree = useMemo(() => {
    const opened = active?.session?.ouverte_le;
    if (!opened) return '';
    const ms = Date.now() - new Date(opened).getTime();
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return `${h}h${String(m).padStart(2, '0')}`;
  }, [active]);

  const ecartPreview = useMemo(() => {
    if (!sessionDetail) return null;
    const v = Number(montantCompte);
    if (!Number.isFinite(v)) return null;
    return v - Number(sessionDetail.solde_theorique || 0);
  }, [montantCompte, sessionDetail]);

  if (loading) return null;

  return (
    <>
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 backdrop-blur-sm ${
          active
            ? 'bg-semantic-green/5 border-semantic-green/20'
            : 'bg-white/60 dark:bg-neutral-900/60 border-neutral-200 dark:border-white/10'
        }`}
      >
        {active ? (
          <>
            <div className="flex items-center gap-3 min-w-0">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-semantic-green opacity-60"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-semantic-green"></span>
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-primary dark:text-white truncate">
                  Shift {active.shift?.nom}
                  <span className="ml-2 font-normal text-neutral-500 dark:text-neutral-400 text-xs">
                    ouvert depuis {duree}
                  </span>
                </p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Journée du {active.session.business_date} · CA {formatPrice(active.ventes || 0)} · Encaissé{' '}
                  {formatPrice(active.encaissements || 0)}
                </p>
              </div>
            </div>
            <button
              onClick={openCloseModal}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/10 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
            >
              <Square className="w-4 h-4 text-semantic-red" />
              Clôturer / Passation
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 min-w-0">
              <Clock className="w-5 h-5 text-neutral-400 shrink-0" />
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Aucun shift ouvert — les ventes restent possibles et seront attribuables par heure.
              </p>
            </div>
            <button
              onClick={openShiftModal}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/90 transition-colors"
            >
              <Play className="w-4 h-4" />
              Ouvrir le shift
            </button>
          </>
        )}
      </div>

      {/* Modale d'ouverture */}
      {isOpenModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-800 w-full max-w-sm rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-primary dark:text-white">Ouvrir un shift</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Toutes les ventes seront rattachées à ce shift.
                </p>
              </div>
              <button onClick={() => setIsOpenModal(false)} className="p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-700">
                <X className="w-4 h-4 text-neutral-500" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 mb-1">Shift</label>
              <select
                value={shiftId}
                onChange={(e) => setShiftId(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-lg text-sm text-primary dark:text-white outline-none"
              >
                <option value="">Choisir…</option>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nom} ({String(s.heure_debut).slice(0, 5)} → {String(s.heure_fin).slice(0, 5)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 mb-1">
                Fond de caisse initial
              </label>
              <input
                type="number"
                min="0"
                value={fond}
                onChange={(e) => setFond(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-lg text-sm text-primary dark:text-white outline-none"
              />
            </div>

            {error && <p className="text-xs font-bold text-semantic-red">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => setIsOpenModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 font-bold hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleOpen}
                disabled={busy || !shiftId}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Ouvrir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale de clôture / passation */}
      {isCloseModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-neutral-100 dark:border-neutral-700 flex justify-between items-start">
              <div>
                <h3 className="font-bold text-primary dark:text-white">Clôture — Passation</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Shift {sessionDetail?.shift?.nom || active?.shift?.nom} · journée du {sessionDetail?.business_date || active?.session?.business_date}
                </p>
              </div>
              <button onClick={() => setIsCloseModal(false)} className="p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-700">
                <X className="w-4 h-4 text-neutral-500" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto">
              {sessionDetail ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-700/50">
                      <p className="text-[10px] uppercase font-bold text-neutral-500">CA</p>
                      <p className="text-sm font-bold text-primary dark:text-white">{formatPrice(sessionDetail.ventes)}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-700/50">
                      <p className="text-[10px] uppercase font-bold text-neutral-500">Encaissements</p>
                      <p className="text-sm font-bold text-primary dark:text-white">{formatPrice(sessionDetail.encaissements)}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-700/50">
                      <p className="text-[10px] uppercase font-bold text-neutral-500">Fond initial</p>
                      <p className="text-sm font-bold text-primary dark:text-white">{formatPrice(sessionDetail.fond_initial)}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-700/50">
                      <p className="text-[10px] uppercase font-bold text-neutral-500">Sorties</p>
                      <p className="text-sm font-bold text-primary dark:text-white">{formatPrice(sessionDetail.sorties_hors_ventes)}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/20">
                    <span className="text-xs font-bold text-neutral-600 dark:text-neutral-300">Solde théorique</span>
                    <span className="text-lg font-bold text-primary dark:text-white">
                      {formatPrice(sessionDetail.solde_theorique)}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 mb-1">
                      Montant compté en caisse
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={montantCompte}
                      onChange={(e) => setMontantCompte(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-lg text-sm text-primary dark:text-white outline-none"
                    />
                  </div>

                  {ecartPreview !== null && (
                    <div
                      className={`flex items-center gap-2 p-3 rounded-xl text-sm font-bold ${
                        Math.abs(ecartPreview) < 1
                          ? 'bg-semantic-green/10 text-semantic-green'
                          : 'bg-semantic-amber/10 text-semantic-amber'
                      }`}
                    >
                      <AlertTriangle className="w-4 h-4" />
                      Écart : {formatPrice(ecartPreview)}
                    </div>
                  )}

                  {/* Comptage physique du stock */}
                  <div className="rounded-xl border border-neutral-200 dark:border-neutral-600 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setStockOpen((v) => !v)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-neutral-100 dark:bg-neutral-700/50 text-left"
                    >
                      <span className="text-xs font-bold text-neutral-700 dark:text-neutral-200">
                        Comptage du stock
                        <span className="ml-1 font-normal text-neutral-500">
                          ({lignesComptage.length}/{stockPrep?.produits?.length ?? 0} saisis)
                        </span>
                      </span>
                      {stockOpen ? (
                        <ChevronUp className="w-4 h-4 text-neutral-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-neutral-500" />
                      )}
                    </button>

                    {stockOpen && (
                      <div className="p-3 space-y-2">
                        {!stockPrep ? (
                          <p className="text-xs text-neutral-400">Chargement des produits suivis…</p>
                        ) : stockPrep.produits?.length === 0 ? (
                          <p className="text-xs text-neutral-400">
                            Aucun produit suivi en stock pour cet établissement.
                          </p>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={stockSearch}
                                onChange={(e) => setStockSearch(e.target.value)}
                                placeholder="Rechercher un produit…"
                                className="flex-1 px-2 py-1.5 bg-neutral-100 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-lg text-xs text-primary dark:text-white outline-none"
                              />
                              <button
                                type="button"
                                onClick={remplirTheorique}
                                className="px-2 py-1.5 rounded-lg bg-neutral-200 dark:bg-neutral-700 text-[10px] font-bold text-neutral-700 dark:text-neutral-200 whitespace-nowrap"
                                title="Reprendre les quantités théoriques pour tous les produits"
                              >
                                Tout à l'identique
                              </button>
                              <button
                                type="button"
                                onClick={() => setStockCounts({})}
                                className="px-2 py-1.5 rounded-lg text-[10px] font-bold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700 whitespace-nowrap"
                              >
                                Effacer
                              </button>
                            </div>

                            <div className="max-h-56 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-700 rounded-lg border border-neutral-100 dark:border-neutral-700">
                              {produitsStock.map((p: any) => {
                                const raw = stockCounts[p.produit_id];
                                const saisi = raw !== undefined && raw !== '' && Number.isFinite(Number(raw));
                                const delta = saisi ? Math.round(Number(raw)) - Number(p.quantite_theorique) : 0;
                                return (
                                  <div key={p.produit_id} className="flex items-center gap-2 px-2 py-1.5">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-bold text-primary dark:text-white truncate">
                                        {p.produit_nom}
                                      </p>
                                      <p className="text-[10px] text-neutral-500">
                                        Théorique {p.quantite_theorique} · {p.departement === 'cuisine' ? 'Cuisine' : 'Bar'}
                                      </p>
                                    </div>
                                    <input
                                      type="number"
                                      min="0"
                                      inputMode="numeric"
                                      value={raw ?? ''}
                                      onChange={(e) =>
                                        setStockCounts((prev) => ({ ...prev, [p.produit_id]: e.target.value }))
                                      }
                                      placeholder="—"
                                      className="w-16 px-2 py-1 text-right bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-xs font-bold text-primary dark:text-white outline-none"
                                    />
                                    <span
                                      className={`w-10 text-right text-[11px] font-bold tabular-nums ${
                                        !saisi
                                          ? 'text-neutral-300 dark:text-neutral-600'
                                          : delta === 0
                                          ? 'text-semantic-green'
                                          : 'text-semantic-amber'
                                      }`}
                                    >
                                      {saisi ? (delta > 0 ? `+${delta}` : delta) : '—'}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>

                            {lignesComptage.length > 0 && (
                              <div className="flex items-center justify-between text-xs font-bold">
                                <span className="text-neutral-600 dark:text-neutral-300">Écart total</span>
                                <span
                                  className={
                                    varianceStock.valeur === 0 ? 'text-semantic-green' : 'text-semantic-amber'
                                  }
                                >
                                  {varianceStock.qte > 0 ? '+' : ''}
                                  {varianceStock.qte} u. · {formatPrice(varianceStock.valeur)}
                                </span>
                              </div>
                            )}

                            <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                              Laissez vide un produit non compté. Le stock des produits saisis sera aligné
                              sur la quantité comptée (mouvement d'ajustement tracé).
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 mb-1">
                      Commentaire (optionnel)
                    </label>
                    <input
                      type="text"
                      value={commentaire}
                      onChange={(e) => setCommentaire(e.target.value)}
                      placeholder="ex : passation à Céline"
                      className="w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-lg text-sm text-primary dark:text-white outline-none"
                    />
                  </div>
                </>
              ) : (
                <p className="text-sm text-neutral-400">Chargement…</p>
              )}

              {error && <p className="text-xs font-bold text-semantic-red">{error}</p>}
            </div>

            <div className="p-4 border-t border-neutral-100 dark:border-neutral-700 flex gap-3">
              <button
                onClick={() => setIsCloseModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 font-bold hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleClose}
                disabled={busy || !sessionDetail}
                className="flex-1 py-2.5 rounded-xl bg-semantic-red text-white font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {busy ? 'Clôture…' : 'Clôturer le shift'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
