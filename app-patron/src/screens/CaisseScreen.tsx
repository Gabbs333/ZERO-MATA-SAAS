import { useState, useMemo, useEffect } from 'react';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';
import { formatMontant } from '../utils/format';
import { EXPORT_DEFINITIONS, downloadCsv } from '../lib/exporters';
import type { ExportDataset } from '../lib/exporters';
import { format, startOfDay, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Wallet, Calendar, ArrowUpCircle, ArrowDownCircle,
  TrendingUp, TrendingDown, Banknote, Smartphone,
  CreditCard, Receipt, Clock, DollarSign, Download, Save, Loader2
} from 'lucide-react';

interface MouvementCaisse {
  id: string;
  type: 'entree' | 'sortie';
  montant: number;
  motif: string;
  mode_paiement: string;
  commentaire: string | null;
  utilisateur_id: string;
  date_creation: string;
  profiles?: { nom: string; prenom: string };
}

interface SoldeCaisse {
  date: string;
  entrees_caisse: number;
  sorties_caisse: number;
  encaissements_ventes: number;
  solde_theorique: number;
}

interface ClotureCaisse {
  id: string;
  date_cloture: string;
  montant_theorique: number;
  montant_compte: number;
  ecart: number;
  commentaire: string | null;
  date_creation: string;
}

export function CaisseScreen() {
  const profile = useAuthStore((state) => state.profile);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [montantCompte, setMontantCompte] = useState('');
  const [commentaireCloture, setCommentaireCloture] = useState('');
  const [savingCloture, setSavingCloture] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [clotureFeedback, setClotureFeedback] = useState<
    { type: 'ok' | 'error'; message: string } | null
  >(null);

  // Fetch solde
  const { data: solde } = useSupabaseQuery<SoldeCaisse>(
    ['solde_caisse', selectedDate, profile?.etablissement_id],
    async () => {
      if (!profile?.etablissement_id) return { data: null, error: null };
      const { data, error } = await supabase.rpc('get_solde_caisse', {
        p_date: selectedDate
      });
      return { data: data as unknown as SoldeCaisse, error };
    },
    { enabled: !!profile?.etablissement_id }
  );

  // Fetch mouvements
  const { data: mouvements } = useSupabaseQuery<MouvementCaisse[]>(
    ['mouvements_caisse', selectedDate, profile?.etablissement_id],
    async () => {
      if (!profile?.etablissement_id) return { data: [], error: null };
      const startDate = `${selectedDate}T00:00:00`;
      const endDate = `${selectedDate}T23:59:59`;

      const { data, error } = await supabase
        .from('mouvements_caisse')
        .select('*, profiles!utilisateur_id (nom, prenom)')
        .eq('etablissement_id', profile.etablissement_id)
        .gte('date_creation', startDate)
        .lte('date_creation', endDate)
        .order('date_creation', { ascending: false });

      return { data: data as unknown as MouvementCaisse[], error };
    },
    { enabled: !!profile?.etablissement_id }
  );

  const totalEntrees = mouvements?.reduce((sum, m) => sum + (m.type === 'entree' ? m.montant : 0), 0) || 0;
  const totalSorties = mouvements?.reduce((sum, m) => sum + (m.type === 'sortie' ? m.montant : 0), 0) || 0;

  // Détail des encaissements du jour par mode de paiement
  const { data: encaissementsJour } = useSupabaseQuery<{ mode_paiement: string; montant: number }[]>(
    ['caisse_encaissements_jour', selectedDate, profile?.etablissement_id],
    async () => {
      if (!profile?.etablissement_id) return { data: [], error: null };
      const { data, error } = await supabase
        .from('encaissements')
        .select('mode_paiement, montant')
        .eq('etablissement_id', profile.etablissement_id)
        .gte('date_encaissement', `${selectedDate}T00:00:00`)
        .lte('date_encaissement', `${selectedDate}T23:59:59`);
      return { data: (data as { mode_paiement: string; montant: number }[]) || [], error };
    },
    { enabled: !!profile?.etablissement_id }
  );

  // Ventes à crédit de la journée (factures marquées credit_sur)
  const { data: creditJour } = useSupabaseQuery<{ montant_total: number; montant_restant: number }[]>(
    ['caisse_credit_jour', selectedDate, profile?.etablissement_id],
    async () => {
      if (!profile?.etablissement_id) return { data: [], error: null };
      const { data, error } = await supabase
        .from('factures')
        .select('montant_total, montant_restant')
        .eq('etablissement_id', profile.etablissement_id)
        .eq('credit_sur', true)
        .gte('date_generation', `${selectedDate}T00:00:00`)
        .lte('date_generation', `${selectedDate}T23:59:59`);
      return { data: (data as { montant_total: number; montant_restant: number }[]) || [], error };
    },
    { enabled: !!profile?.etablissement_id }
  );

  const encaissementsParMode = useMemo(() => {
    const map = new Map<string, number>();
    (encaissementsJour || []).forEach((e) => {
      map.set(e.mode_paiement, (map.get(e.mode_paiement) || 0) + e.montant);
    });
    return map;
  }, [encaissementsJour]);

  const totalEspeces = encaissementsParMode.get('especes') || 0;
  const totalMobileMoney = encaissementsParMode.get('mobile_money') || 0;
  const totalCarte =
    (encaissementsParMode.get('carte_bancaire') || 0) + (encaissementsParMode.get('carte') || 0);
  const totalCheque = encaissementsParMode.get('cheque') || 0;
  const totalEncaisseJour = totalEspeces + totalMobileMoney + totalCarte + totalCheque;

  const creditJourTotal = (creditJour || []).reduce((sum, f) => sum + (f.montant_total || 0), 0);
  const creditJourRestant = (creditJour || []).reduce((sum, f) => sum + (f.montant_restant || 0), 0);

  // Clôture de caisse déjà enregistrée pour la journée sélectionnée
  const { data: cloture, refetch: refetchCloture } = useSupabaseQuery<ClotureCaisse | null>(
    ['cloture_caisse', selectedDate, profile?.etablissement_id],
    async () => {
      if (!profile?.etablissement_id) return { data: null, error: null };
      const { data, error } = await supabase
        .from('clotures_caisse')
        .select('*')
        .eq('etablissement_id', profile.etablissement_id)
        .eq('date_cloture', selectedDate)
        .maybeSingle();
      return { data: (data as unknown as ClotureCaisse) || null, error };
    },
    { enabled: !!profile?.etablissement_id }
  );

  useEffect(() => {
    setMontantCompte(cloture ? String(cloture.montant_compte) : '');
    setCommentaireCloture(cloture?.commentaire || '');
  }, [cloture]);

  const montantTheorique = solde?.solde_theorique || 0;
  const montantCompteSaisi = montantCompte.trim() === '' ? null : Number(montantCompte);
  const ecartCloture =
    montantCompteSaisi !== null && Number.isFinite(montantCompteSaisi)
      ? montantCompteSaisi - montantTheorique
      : null;

  const handleSaveCloture = async () => {
    if (montantCompteSaisi === null || !Number.isFinite(montantCompteSaisi) || montantCompteSaisi < 0) {
      setClotureFeedback({ type: 'error', message: 'Saisissez un montant compté valide.' });
      return;
    }
    setSavingCloture(true);
    setClotureFeedback(null);
    try {
      const { error } = await supabase.rpc('enregistrer_cloture_caisse', {
        p_date: selectedDate,
        p_montant_compte: Math.round(montantCompteSaisi),
        p_commentaire: commentaireCloture.trim() || null,
      });
      if (error) throw error;
      await refetchCloture();
      setClotureFeedback({ type: 'ok', message: 'Clôture enregistrée.' });
    } catch (err: any) {
      console.error('Cloture error:', err);
      setClotureFeedback({
        type: 'error',
        message: err?.message || "Impossible d'enregistrer la clôture.",
      });
    } finally {
      setSavingCloture(false);
    }
  };

  const handleExportCaisse = async () => {
    const definition = EXPORT_DEFINITIONS.find((d) => d.type === 'rapport_caisse_journalier');
    if (!definition) return;
    setExporting(true);
    try {
      const day = new Date(`${selectedDate}T12:00:00`);
      const { data, error } = await supabase.rpc('get_export_dataset', {
        p_type: 'rapport_caisse_journalier',
        p_date_debut: startOfDay(day).toISOString(),
        p_date_fin: endOfDay(day).toISOString(),
        p_filtres: {},
      });
      if (error) throw error;
      const dataset = data as ExportDataset;
      if (dataset?.rows) downloadCsv(dataset, definition);
    } catch (err) {
      console.error('Export caisse error:', err);
    } finally {
      setExporting(false);
    }
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'especes': return <Banknote className="w-3.5 h-3.5" />;
      case 'mobile_money': return <Smartphone className="w-3.5 h-3.5" />;
      case 'carte_bancaire': return <CreditCard className="w-3.5 h-3.5" />;
      case 'cheque': return <Receipt className="w-3.5 h-3.5" />;
      default: return <DollarSign className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-dark-bg pb-20 md:pb-6">
      {/* Header */}
      <div className="p-4 md:p-6 bg-white dark:bg-dark-card/30 dark:backdrop-blur-xl border-b border-neutral-200 dark:border-white/5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-primary dark:text-white font-display">Suivi de Caisse</h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">
              Consultation et rapprochement des mouvements
            </p>
          </div>

          {/* Sélecteur de date + export */}
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-neutral-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary rounded-xl text-neutral-900 dark:text-white outline-none"
            />
            <button
              onClick={handleExportCaisse}
              disabled={exporting}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Exporter
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6">
        {/* Solde Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="text-xs font-bold text-neutral-500 uppercase">Entrées caisse</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{formatMontant(solde?.entrees_caisse || 0)}</p>
          </div>

          <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-semantic-red" />
              <span className="text-xs font-bold text-neutral-500 uppercase">Sorties caisse</span>
            </div>
            <p className="text-2xl font-bold text-semantic-red">{formatMontant(solde?.sorties_caisse || 0)}</p>
          </div>

          <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 p-5">
            <div className="flex items-center gap-2 mb-2">
              <Banknote className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-neutral-500 uppercase">Encaissements ventes</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{formatMontant(solde?.encaissements_ventes || 0)}</p>
          </div>

          <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-xl border-2 border-primary/30 p-5">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-neutral-500 uppercase">Solde théorique</span>
            </div>
            <p className={`text-2xl font-bold ${(solde?.solde_theorique || 0) >= 0 ? 'text-neutral-900 dark:text-white' : 'text-semantic-red'}`}>
              {formatMontant(solde?.solde_theorique || 0)}
            </p>
          </div>
        </div>

        {/* Résumé */}
        {solde && (
          <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 p-5 mb-6">
            <h3 className="font-bold text-neutral-900 dark:text-white mb-3">Récapitulatif du {format(new Date(selectedDate + 'T12:00:00'), 'dd MMMM yyyy', { locale: fr })}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-neutral-500">Entrées caisse</span>
                <p className="font-bold text-green-600">+{formatMontant(solde.entrees_caisse)}</p>
              </div>
              <div>
                <span className="text-neutral-500">Ventes encaissées</span>
                <p className="font-bold text-blue-600">+{formatMontant(solde.encaissements_ventes)}</p>
              </div>
              <div>
                <span className="text-neutral-500">Sorties caisse</span>
                <p className="font-bold text-semantic-red">−{formatMontant(solde.sorties_caisse)}</p>
              </div>
              <div className="col-span-2 md:col-span-3 pt-3 border-t border-neutral-200 dark:border-white/10">
                <span className="text-neutral-500">Solde théorique</span>
                <p className={`text-xl font-bold ${solde.solde_theorique >= 0 ? 'text-neutral-900 dark:text-white' : 'text-semantic-red'}`}>
                  {formatMontant(solde.solde_theorique)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Clôture de caisse */}
        <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 p-5 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="font-bold text-neutral-900 dark:text-white">Clôture de caisse</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Rapprochement du {format(new Date(selectedDate + 'T12:00:00'), 'dd MMMM yyyy', { locale: fr })}
                {cloture && ' • clôturée'}
              </p>
            </div>
            {cloture && (
              <span className="text-xs font-medium px-2 py-1 rounded-lg bg-neutral-100 dark:bg-white/10 text-neutral-600 dark:text-neutral-300">
                Dernière saisie : {format(new Date(cloture.date_creation), 'dd/MM/yyyy HH:mm', { locale: fr })}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">
                Montant compté en fin de journée
              </label>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={montantCompte}
                onChange={(e) => setMontantCompte(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary rounded-xl text-neutral-900 dark:text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">
                Solde théorique
              </label>
              <p className="px-3 py-2 text-lg font-bold text-neutral-900 dark:text-white">
                {formatMontant(montantTheorique)}
              </p>
              <p className="text-[10px] text-neutral-400 px-3">
                {ecartCloture === null
                  ? 'Saisissez le montant compté pour calculer l’écart'
                  : `Écart : ${ecartCloture > 0 ? '+' : ''}${formatMontant(ecartCloture)}`}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">
                Commentaire (optionnel)
              </label>
              <input
                type="text"
                value={commentaireCloture}
                onChange={(e) => setCommentaireCloture(e.target.value)}
                placeholder="Observation de caisse…"
                className="w-full px-3 py-2 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary rounded-xl text-neutral-900 dark:text-white outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4">
            <div>
              {ecartCloture !== null && (
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold ${
                    ecartCloture === 0
                      ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'
                  }`}
                >
                  {ecartCloture === 0 ? 'Caisse juste' : 'Écart de caisse'} :{' '}
                  {formatMontant(ecartCloture)}
                </span>
              )}
              {clotureFeedback && (
                <p
                  className={`mt-2 text-sm ${
                    clotureFeedback.type === 'ok' ? 'text-green-600' : 'text-semantic-red'
                  }`}
                >
                  {clotureFeedback.message}
                </p>
              )}
            </div>

            <button
              onClick={handleSaveCloture}
              disabled={savingCloture || montantCompteSaisi === null}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {savingCloture ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {cloture ? 'Mettre à jour la clôture' : 'Enregistrer la clôture'}
            </button>
          </div>
        </div>

        {/* Encaissements par mode de paiement */}
        <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 p-5 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="font-bold text-neutral-900 dark:text-white">Encaissements par mode de paiement</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Montants exacts du {format(new Date(selectedDate + 'T12:00:00'), 'dd MMMM yyyy', { locale: fr })}
              </p>
            </div>
            <span className="text-lg font-black text-primary dark:text-white whitespace-nowrap">
              {formatMontant(totalEncaisseJour)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-neutral-200 dark:border-white/5 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Banknote className="w-4 h-4 text-amber-600" />
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Espèces</span>
              </div>
              <p className="text-lg font-bold text-neutral-900 dark:text-white">{formatMontant(totalEspeces)}</p>
              <p className="text-[10px] text-neutral-400">
                {totalEncaisseJour > 0 ? Math.round((totalEspeces / totalEncaisseJour) * 100) : 0}% des encaissements
              </p>
            </div>

            <div className="rounded-xl border border-neutral-200 dark:border-white/5 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Smartphone className="w-4 h-4 text-indigo-600" />
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Mobile Money</span>
              </div>
              <p className="text-lg font-bold text-neutral-900 dark:text-white">{formatMontant(totalMobileMoney)}</p>
              <p className="text-[10px] text-neutral-400">
                {totalEncaisseJour > 0 ? Math.round((totalMobileMoney / totalEncaisseJour) * 100) : 0}% des encaissements
              </p>
            </div>

            <div className="rounded-xl border border-neutral-200 dark:border-white/5 p-4">
              <div className="flex items-center gap-2 mb-1">
                <CreditCard className="w-4 h-4 text-blue-600" />
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Carte / Chèque</span>
              </div>
              <p className="text-lg font-bold text-neutral-900 dark:text-white">{formatMontant(totalCarte + totalCheque)}</p>
              <p className="text-[10px] text-neutral-400">
                Carte : {formatMontant(totalCarte)} • Chèque : {formatMontant(totalCheque)}
              </p>
            </div>

            <div className="rounded-xl border border-purple-200 dark:border-purple-500/20 bg-purple-50/50 dark:bg-purple-500/5 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Receipt className="w-4 h-4 text-purple-600" />
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Ventes à crédit</span>
              </div>
              <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{formatMontant(creditJourTotal)}</p>
              <p className="text-[10px] text-neutral-400">
                {(creditJour || []).length} facture(s) • Restant dû : {formatMontant(creditJourRestant)}
              </p>
            </div>
          </div>
        </div>

        {/* Liste des mouvements */}
        <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 overflow-hidden">
          <div className="p-4 border-b border-neutral-200 dark:border-white/5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-neutral-900 dark:text-white">Mouvements du jour</h3>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-green-600 font-bold">+{formatMontant(totalEntrees)}</span>
                <span className="text-semantic-red font-bold">−{formatMontant(totalSorties)}</span>
              </div>
            </div>
          </div>

          <div className="divide-y divide-neutral-200 dark:divide-white/5 max-h-[60vh] overflow-y-auto">
            {mouvements?.map(m => (
              <div key={m.id} className="p-4 flex items-center gap-4 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors">
                <div className={`rounded-full p-2 ${
                  m.type === 'entree' ? 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
                }`}>
                  {m.type === 'entree' ? <ArrowUpCircle className="w-4 h-4" /> : <ArrowDownCircle className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm text-neutral-900 dark:text-white">{m.motif}</p>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-neutral-100 dark:bg-white/10 rounded text-xs text-neutral-500">
                      {getModeIcon(m.mode_paiement)}
                      {m.mode_paiement}
                    </span>
                  </div>
                  {m.commentaire && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">{m.commentaire}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="w-3 h-3 text-neutral-400" />
                    <span className="text-xs text-neutral-400">
                      {format(new Date(m.date_creation), 'HH:mm', { locale: fr })} • {m.profiles?.prenom} {m.profiles?.nom}
                    </span>
                  </div>
                </div>
                <span className={`font-bold text-sm whitespace-nowrap ${m.type === 'entree' ? 'text-green-600' : 'text-semantic-red'}`}>
                  {m.type === 'entree' ? '+' : '−'}{formatMontant(m.montant)}
                </span>
              </div>
            ))}

            {(!mouvements || mouvements.length === 0) && (
              <div className="text-center py-12 text-neutral-400">
                <Wallet className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucun mouvement pour cette date</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
