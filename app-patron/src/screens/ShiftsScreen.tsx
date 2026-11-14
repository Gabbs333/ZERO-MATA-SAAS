import { useEffect, useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import {
  CalendarDays,
  Clock,
  Info,
  Loader2,
  Pencil,
  Plus,
  Printer,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { useQueryClient } from '@tanstack/react-query';
import { formatMontant, formatModePaiement } from '../utils/format';
import { EXPORT_DEFINITIONS } from '../lib/exporters';
import type { ExportDefinition } from '../lib/exporters';
import { ExporterButton } from '../components/ExporterButton';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SessionShift {
  id: string;
  business_date: string;
  statut: 'ouverte' | 'fermee';
  shift_id: string;
  shift_nom: string;
  shift_ordre: number;
  heure_debut: string;
  heure_fin: string;
  traverse_minuit: boolean;
  ouverte_le: string;
  fermee_le: string | null;
  ouverte_par: string;
  fermee_par: string;
  fond_initial: number;
  ventes: number;
  ventes_bar: number;
  ventes_cuisine: number;
  nombre_commandes: number;
  montant_impayes: number;
  encaissements: number;
  encaissements_par_mode: Record<string, number> | null;
  nombre_encaissements: number;
  entrees_hors_ventes: number;
  sorties_hors_ventes: number;
  solde_theorique: number;
  montant_compte: number | null;
  ecart: number | null;
  commentaire: string | null;
}

interface SessionsShiftPayload {
  etablissement: {
    id: string;
    nom: string;
    devise: string;
    fuseau_horaire: string;
    heure_debut_journee: string;
  };
  periode: { debut: string; fin: string };
  sessions: SessionShift[];
  totaux: {
    sessions: number;
    sessions_ouvertes: number;
    ventes: number;
    ventes_bar: number;
    ventes_cuisine: number;
    encaissements: number;
    ecart_cumule: number;
    nb_ecarts: number;
  };
}

interface ShiftDefinition {
  id: string;
  etablissement_id: string;
  nom: string;
  heure_debut: string;
  heure_fin: string;
  traverse_minuit: boolean;
  ordre: number;
  actif: boolean;
}

interface ShiftForm {
  id: string | null;
  nom: string;
  heure_debut: string;
  heure_fin: string;
  ordre: string;
  actif: boolean;
}

const emptyShift = (ordre: number): ShiftForm => ({
  id: null,
  nom: '',
  heure_debut: '',
  heure_fin: '',
  ordre: String(ordre),
  actif: true,
});

type Preset = 'today' | '7d' | '30d' | 'custom';

const isoDay = (d: Date) => format(d, 'yyyy-MM-dd');

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'today', label: "Aujourd'hui" },
  { key: '7d', label: '7 jours' },
  { key: '30d', label: '30 jours' },
  { key: 'custom', label: 'Personnalisé' },
];

const SHIFT_EXPORT: ExportDefinition | undefined = EXPORT_DEFINITIONS.find(
  (d) => d.type === 'journal_sessions_shift'
);

const JOUR_LABEL = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return format(new Date(y, m - 1, d), 'EEEE dd MMMM yyyy');
};

// ---------------------------------------------------------------------------
// Écran
// ---------------------------------------------------------------------------

export function ShiftsScreen() {
  const profile = useAuthStore((state) => state.profile);
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<'sessions' | 'configuration'>('sessions');
  const [preset, setPreset] = useState<Preset>('7d');
  const [dateDebut, setDateDebut] = useState(isoDay(subDays(new Date(), 6)));
  const [dateFin, setDateFin] = useState(isoDay(new Date()));
  const [filtreShift, setFiltreShift] = useState<string>('tous');
  const [filtreStatut, setFiltreStatut] = useState<string>('tous');

  const [detail, setDetail] = useState<SessionShift | null>(null);

  // --- Configuration
  const [shifts, setShifts] = useState<ShiftDefinition[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState(false);
  const [shiftForm, setShiftForm] = useState<ShiftForm | null>(null);
  const [savingShift, setSavingShift] = useState(false);
  const [heureDebutJournee, setHeureDebutJournee] = useState('00:00');
  const [savingJournee, setSavingJournee] = useState(false);
  const [configMessage, setConfigMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (preset === 'today') {
      setDateDebut(isoDay(new Date()));
      setDateFin(isoDay(new Date()));
    } else if (preset === '7d') {
      setDateDebut(isoDay(subDays(new Date(), 6)));
      setDateFin(isoDay(new Date()));
    } else if (preset === '30d') {
      setDateDebut(isoDay(subDays(new Date(), 29)));
      setDateFin(isoDay(new Date()));
    }
  }, [preset]);

  const { data: payload, isLoading, error } = useSupabaseQuery<SessionsShiftPayload | null>(
    ['sessions_shift', dateDebut, dateFin, profile?.etablissement_id],
    async () => {
      if (!profile?.etablissement_id) return { data: null, error: null };
      const { data, error: rpcError } = await supabase.rpc('get_sessions_shift', {
        p_debut: dateDebut,
        p_fin: dateFin,
      });
      return { data: (data as unknown as SessionsShiftPayload) || null, error: rpcError };
    },
    { enabled: !!profile?.etablissement_id }
  );

  // --- Chargement de la configuration
  const loadShifts = async () => {
    if (!profile?.etablissement_id) return;
    setShiftsLoading(true);
    const { data, error: err } = await supabase
      .from('shifts')
      .select('*')
      .eq('etablissement_id', profile.etablissement_id)
      .order('ordre');
    if (err) {
      setConfigMessage({ type: 'error', text: err.message });
    } else {
      setShifts((data as ShiftDefinition[]) || []);
    }
    setShiftsLoading(false);
  };

  useEffect(() => {
    loadShifts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.etablissement_id]);

  useEffect(() => {
    if (payload?.etablissement?.heure_debut_journee) {
      setHeureDebutJournee(payload.etablissement.heure_debut_journee);
    }
  }, [payload?.etablissement?.heure_debut_journee]);

  const sessions = payload?.sessions || [];
  const totaux = payload?.totaux;

  const sessionsFiltrees = useMemo(() => {
    return sessions.filter((s) => {
      if (filtreShift !== 'tous' && s.shift_id !== filtreShift) return false;
      if (filtreStatut !== 'tous' && s.statut !== filtreStatut) return false;
      return true;
    });
  }, [sessions, filtreShift, filtreStatut]);

  const groupes = useMemo(() => {
    const map = new Map<string, SessionShift[]>();
    sessionsFiltrees.forEach((s) => {
      const key = s.business_date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [sessionsFiltrees]);

  // --- Réglage de la journée d'exploitation
  const handleSaveJournee = async () => {
    setSavingJournee(true);
    setConfigMessage(null);
    try {
      const { error: rpcError } = await supabase.rpc('set_heure_debut_journee', {
        p_heure: `${heureDebutJournee}:00`,
      });
      if (rpcError) throw rpcError;
      setConfigMessage({
        type: 'ok',
        text: `Journée d'exploitation désormais calée sur ${heureDebutJournee}.`,
      });
      queryClient.invalidateQueries();
      await loadShifts();
    } catch (err: any) {
      setConfigMessage({ type: 'error', text: err?.message || 'Enregistrement impossible.' });
    } finally {
      setSavingJournee(false);
    }
  };

  // --- CRUD shifts
  const handleSaveShift = async () => {
    if (!shiftForm || !profile?.etablissement_id) return;
    if (!shiftForm.nom.trim() || !shiftForm.heure_debut || !shiftForm.heure_fin) {
      setConfigMessage({ type: 'error', text: 'Nom, heure de début et heure de fin sont obligatoires.' });
      return;
    }
    setSavingShift(true);
    setConfigMessage(null);

    const values = {
      etablissement_id: profile.etablissement_id,
      nom: shiftForm.nom.trim(),
      heure_debut: shiftForm.heure_debut,
      heure_fin: shiftForm.heure_fin,
      ordre: Number(shiftForm.ordre) || 0,
      actif: shiftForm.actif,
    };

    try {
      const { error: err } = shiftForm.id
        ? await supabase.from('shifts').update(values).eq('id', shiftForm.id)
        : await supabase.from('shifts').insert(values);
      if (err) throw err;

      setConfigMessage({
        type: 'ok',
        text: shiftForm.id ? 'Shift mis à jour.' : 'Shift créé.',
      });
      setShiftForm(null);
      await loadShifts();
    } catch (err: any) {
      const msg =
        err?.code === '23505'
          ? 'Un shift porte déjà ce nom.'
          : err?.message || 'Enregistrement impossible.';
      setConfigMessage({ type: 'error', text: msg });
    } finally {
      setSavingShift(false);
    }
  };

  const handleDeleteShift = async (shift: ShiftDefinition) => {
    if (
      !window.confirm(
        `Supprimer le shift « ${shift.nom} » ? Les sessions déjà enregistrées empêchent la suppression (archivage requis).`
      )
    ) {
      return;
    }
    setConfigMessage(null);
    const { error: err } = await supabase.from('shifts').delete().eq('id', shift.id);
    if (err) {
      setConfigMessage({
        type: 'error',
        text:
          err.code === '23503'
            ? 'Ce shift possède des sessions : désactivez-le plutôt que de le supprimer.'
            : err.message,
      });
      return;
    }
    setConfigMessage({ type: 'ok', text: 'Shift supprimé.' });
    await loadShifts();
  };

  const toggleShiftActif = async (shift: ShiftDefinition) => {
    const { error: err } = await supabase
      .from('shifts')
      .update({ actif: !shift.actif })
      .eq('id', shift.id);
    if (err) {
      setConfigMessage({ type: 'error', text: err.message });
      return;
    }
    await loadShifts();
  };

  // --- Rapport de passation imprimable
  const imprimerPassation = (s: SessionShift) => {
    const etab = payload?.etablissement;
    const modes = Object.entries(s.encaissements_par_mode || {})
      .map(([mode, montant]) => `<tr><td>${formatModePaiement(mode)}</td><td class="n">${formatMontant(Number(montant))}</td></tr>`)
      .join('');

    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Passation ${s.shift_nom} — ${s.business_date}</title>
<style>
  *{box-sizing:border-box}body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111;margin:32px;font-size:13px}
  h1{font-size:20px;margin:0 0 4px}h2{font-size:14px;margin:24px 0 8px;text-transform:uppercase;letter-spacing:.08em;color:#555}
  .muted{color:#666;font-size:12px}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  td,th{padding:6px 8px;border-bottom:1px solid #eee;text-align:left}
  td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
  .tot{font-weight:700;border-top:2px solid #111}
  .ecart{background:#f4f4f5;padding:10px 12px;border-radius:8px;margin-top:12px;font-weight:700}
</style></head><body>
<h1>Rapport de passation</h1>
<p class="muted">${etab?.nom || ''} — ${s.shift_nom} (${s.heure_debut} → ${s.heure_fin}) — journée d'exploitation du ${s.business_date}</p>
<p class="muted">Ouverte le ${new Date(s.ouverte_le).toLocaleString('fr-FR')} par ${s.ouverte_par}${
      s.fermee_le ? ` · Fermée le ${new Date(s.fermee_le).toLocaleString('fr-FR')} par ${s.fermee_par}` : ' · Session encore ouverte'
    }</p>

<h2>Activité</h2>
<table>
  <tr><td>Chiffre d'affaires</td><td class="n">${formatMontant(s.ventes)}</td></tr>
  <tr><td>dont bar</td><td class="n">${formatMontant(s.ventes_bar)}</td></tr>
  <tr><td>dont cuisine</td><td class="n">${formatMontant(s.ventes_cuisine)}</td></tr>
  <tr><td>Commandes validées</td><td class="n">${s.nombre_commandes}</td></tr>
  <tr><td>Impayés de la session</td><td class="n">${formatMontant(s.montant_impayes)}</td></tr>
</table>

<h2>Encaissements</h2>
<table>
  <tr><th>Mode</th><th class="n">Montant</th></tr>
  ${modes || '<tr><td colspan="2" class="muted">Aucun encaissement</td></tr>'}
  <tr class="tot"><td>Total encaissé</td><td class="n">${formatMontant(s.encaissements)}</td></tr>
</table>

<h2>Caisse</h2>
<table>
  <tr><td>Fond initial</td><td class="n">${formatMontant(s.fond_initial)}</td></tr>
  <tr><td>Encaissements</td><td class="n">${formatMontant(s.encaissements)}</td></tr>
  <tr><td>Entrées hors ventes</td><td class="n">${formatMontant(s.entrees_hors_ventes)}</td></tr>
  <tr><td>Sorties hors ventes</td><td class="n">− ${formatMontant(s.sorties_hors_ventes)}</td></tr>
  <tr class="tot"><td>Solde théorique</td><td class="n">${formatMontant(s.solde_theorique)}</td></tr>
  <tr><td>Montant compté</td><td class="n">${s.montant_compte === null ? '—' : formatMontant(s.montant_compte)}</td></tr>
</table>
<div class="ecart">Écart : ${s.ecart === null ? 'non clôturée' : formatMontant(s.ecart)}</div>
${s.commentaire ? `<p class="muted" style="margin-top:12px"><strong>Commentaire :</strong> ${s.commentaire}</p>` : ''}
</body></html>`;

    const win = window.open('', '_blank', 'width=900,height=900');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  // -------------------------------------------------------------------------
  // Rendu
  // -------------------------------------------------------------------------

  return (
    <div className="pb-20 md:pb-6 bg-neutral-50 dark:bg-dark-bg min-h-screen">
      {/* Header */}
      <div className="p-4 md:p-6 bg-white dark:bg-dark-card/30 dark:backdrop-blur-xl border-b border-neutral-200 dark:border-white/5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary dark:text-white font-display">
              Shifts & passations
            </h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">
              Suivi par journée d'exploitation : CA bar / cuisine, encaissements et écarts de caisse
            </p>
          </div>
          <div className="flex items-center gap-2 self-start md:self-auto">
            {SHIFT_EXPORT && payload && (
              <ExporterButton
                definitions={[SHIFT_EXPORT]}
                start={new Date(`${dateDebut}T00:00:00`)}
                end={new Date(`${dateFin}T23:59:59`)}
                filtres={{
                  shift:
                    filtreShift === 'tous' ? undefined : shifts.find((s) => s.id === filtreShift)?.nom,
                  statut: filtreStatut === 'tous' ? undefined : filtreStatut,
                }}
              />
            )}
          </div>
        </div>

        {/* Onglets */}
        <div className="flex gap-1 mt-4 p-1 rounded-xl bg-neutral-100 dark:bg-white/5 w-fit">
          {[
            { key: 'sessions' as const, label: 'Sessions' },
            { key: 'configuration' as const, label: 'Configuration' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={twMerge(
                'px-4 py-2 rounded-lg text-sm font-bold transition-colors',
                tab === t.key
                  ? 'bg-white dark:bg-dark-card text-primary dark:text-white shadow-sm'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-primary dark:hover:text-white'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
        {tab === 'sessions' ? (
          <>
            {/* Filtres période */}
            <div className="flex flex-wrap items-center gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPreset(p.key)}
                  className={twMerge(
                    'px-3 py-1.5 rounded-full text-xs font-bold border transition-colors',
                    preset === p.key
                      ? 'bg-primary dark:bg-dark-accent text-white border-transparent'
                      : 'bg-white dark:bg-dark-card text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-white/10'
                  )}
                >
                  {p.label}
                </button>
              ))}
              {preset === 'custom' && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={dateDebut}
                    onChange={(e) => setDateDebut(e.target.value)}
                    className="px-2 py-1.5 rounded-lg bg-white dark:bg-dark-card border border-neutral-200 dark:border-white/10 text-xs text-primary dark:text-white"
                  />
                  <span className="text-neutral-400 text-xs">→</span>
                  <input
                    type="date"
                    value={dateFin}
                    onChange={(e) => setDateFin(e.target.value)}
                    className="px-2 py-1.5 rounded-lg bg-white dark:bg-dark-card border border-neutral-200 dark:border-white/10 text-xs text-primary dark:text-white"
                  />
                </div>
              )}

              <div className="ml-auto flex items-center gap-2">
                <select
                  value={filtreShift}
                  onChange={(e) => setFiltreShift(e.target.value)}
                  className="px-2 py-1.5 rounded-lg bg-white dark:bg-dark-card border border-neutral-200 dark:border-white/10 text-xs font-bold text-primary dark:text-white"
                >
                  <option value="tous">Tous les shifts</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nom}
                    </option>
                  ))}
                  {sessions
                    .filter((s) => !shifts.find((d) => d.id === s.shift_id))
                    .map((s) => (
                      <option key={s.shift_id} value={s.shift_id}>
                        {s.shift_nom}
                      </option>
                    ))}
                </select>
                <select
                  value={filtreStatut}
                  onChange={(e) => setFiltreStatut(e.target.value)}
                  className="px-2 py-1.5 rounded-lg bg-white dark:bg-dark-card border border-neutral-200 dark:border-white/10 text-xs font-bold text-primary dark:text-white"
                >
                  <option value="tous">Tous statuts</option>
                  <option value="ouverte">Ouvertes</option>
                  <option value="fermee">Fermées</option>
                </select>
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              <Kpi label="Sessions" value={String(totaux?.sessions ?? 0)} hint={`${totaux?.sessions_ouvertes ?? 0} ouverte(s)`} />
              <Kpi label="CA total" value={formatMontant(totaux?.ventes ?? 0)} />
              <Kpi label="CA bar" value={formatMontant(totaux?.ventes_bar ?? 0)} />
              <Kpi label="CA cuisine" value={formatMontant(totaux?.ventes_cuisine ?? 0)} />
              <Kpi label="Encaissements" value={formatMontant(totaux?.encaissements ?? 0)} />
              <Kpi
                label="Écarts cumulés"
                value={formatMontant(totaux?.ecart_cumule ?? 0)}
                tone={(totaux?.ecart_cumule ?? 0) === 0 ? 'neutral' : 'warn'}
                hint={`${totaux?.nb_ecarts ?? 0} session(s)`}
              />
            </div>

            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <Loader2 className="w-4 h-4 animate-spin" /> Chargement des sessions…
              </div>
            )}

            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 text-sm font-bold">
                {(error as any)?.message || 'Erreur de chargement.'}
              </div>
            )}

            {!isLoading && !error && groupes.length === 0 && (
              <div className="rounded-2xl border border-dashed border-neutral-300 dark:border-white/10 p-8 text-center">
                <Clock className="w-8 h-8 mx-auto text-neutral-300 dark:text-neutral-600" />
                <p className="mt-3 font-bold text-primary dark:text-white">
                  Aucune session sur cette période
                </p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                  Les sessions s'ouvrent depuis l'application comptoir : un bandeau en haut de chaque
                  écran permet d'ouvrir le shift en cours et de le clôturer à la passation.
                </p>
              </div>
            )}

            {groupes.map(([jour, list]) => {
              const ventes = list.reduce((a, s) => a + s.ventes, 0);
              const encaisse = list.reduce((a, s) => a + s.encaissements, 0);
              return (
                <div key={jour} className="space-y-3">
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-neutral-400" />
                      <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300 capitalize">
                        {JOUR_LABEL(jour)}
                      </h2>
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {formatMontant(ventes)} de CA · {formatMontant(encaisse)} encaissés
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {list.map((s) => (
                      <SessionCard
                        key={s.id}
                        session={s}
                        onDetail={() => setDetail(s)}
                        onPrint={() => imprimerPassation(s)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <>
            {/* Journée d'exploitation */}
            <section className="rounded-2xl bg-white dark:bg-dark-card border border-neutral-200 dark:border-white/10 p-5">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary dark:text-dark-accent">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h2 className="font-bold text-primary dark:text-white">Journée d'exploitation</h2>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                    Heure à laquelle commence une nouvelle journée comptable. Un établissement ouvert
                    24/24 peut la fixer à 06:00 : le shift de nuit (22:00 → 06:00) reste alors
                    rattaché à la journée où il a commencé.
                  </p>
                  <div className="flex flex-wrap items-end gap-3 mt-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1">
                        Début de journée
                      </label>
                      <input
                        type="time"
                        value={heureDebutJournee}
                        onChange={(e) => setHeureDebutJournee(e.target.value)}
                        className="px-3 py-2 rounded-xl bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-sm font-bold text-primary dark:text-white"
                      />
                    </div>
                    <button
                      onClick={handleSaveJournee}
                      disabled={savingJournee}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary dark:bg-dark-accent text-white text-sm font-bold hover:opacity-90 disabled:opacity-50"
                    >
                      {savingJournee ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Enregistrer
                    </button>
                  </div>
                  <p className="flex items-start gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400 mt-3">
                    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    Le prochain shift ouvert après cette heure sera rattaché à la nouvelle journée.
                    Les sessions déjà enregistrées conservent leur journée d'origine.
                  </p>
                </div>
              </div>
            </section>

            {/* Liste des shifts */}
            <section className="rounded-2xl bg-white dark:bg-dark-card border border-neutral-200 dark:border-white/10 p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="font-bold text-primary dark:text-white">Shifts de l'établissement</h2>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    Ce sont les créneaux proposés à l'ouverture de session sur le comptoir.
                  </p>
                </div>
                <button
                  onClick={() =>
                    setShiftForm(emptyShift(shifts.length > 0 ? Math.max(...shifts.map((s) => s.ordre)) + 1 : 1))
                  }
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary dark:bg-dark-accent text-white text-xs font-bold hover:opacity-90"
                >
                  <Plus className="w-4 h-4" /> Nouveau shift
                </button>
              </div>

              {shiftsLoading ? (
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                  <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
                </div>
              ) : shifts.length === 0 ? (
                <p className="text-sm text-neutral-500">Aucun shift défini.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-widest text-neutral-400">
                        <th className="py-2 pr-3">Nom</th>
                        <th className="py-2 pr-3">Horaires</th>
                        <th className="py-2 pr-3">Chevauche minuit</th>
                        <th className="py-2 pr-3">Ordre</th>
                        <th className="py-2 pr-3">Actif</th>
                        <th className="py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shifts.map((s) => (
                        <tr key={s.id} className="border-t border-neutral-100 dark:border-white/5">
                          <td className="py-2 pr-3 font-bold text-primary dark:text-white">{s.nom}</td>
                          <td className="py-2 pr-3 text-neutral-600 dark:text-neutral-300">
                            {String(s.heure_debut).slice(0, 5)} → {String(s.heure_fin).slice(0, 5)}
                          </td>
                          <td className="py-2 pr-3 text-neutral-500">
                            {s.traverse_minuit ? 'Oui' : 'Non'}
                          </td>
                          <td className="py-2 pr-3 text-neutral-500">{s.ordre}</td>
                          <td className="py-2 pr-3">
                            <button
                              onClick={() => toggleShiftActif(s)}
                              className={twMerge(
                                'px-2 py-0.5 rounded-full text-[10px] font-bold border',
                                s.actif
                                  ? 'bg-green-500/10 text-green-600 border-green-500/20'
                                  : 'bg-neutral-500/10 text-neutral-500 border-neutral-500/20'
                              )}
                            >
                              {s.actif ? 'Actif' : 'Inactif'}
                            </button>
                          </td>
                          <td className="py-2 text-right whitespace-nowrap">
                            <button
                              onClick={() =>
                                setShiftForm({
                                  id: s.id,
                                  nom: s.nom,
                                  heure_debut: String(s.heure_debut).slice(0, 5),
                                  heure_fin: String(s.heure_fin).slice(0, 5),
                                  ordre: String(s.ordre),
                                  actif: s.actif,
                                })
                              }
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-primary dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/5"
                              title="Modifier"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteShift(s)}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-500/10"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {configMessage && (
                <div
                  className={twMerge(
                    'mt-4 px-3 py-2 rounded-xl text-xs font-bold border',
                    configMessage.type === 'ok'
                      ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
                      : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                  )}
                >
                  {configMessage.text}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* Modale shift */}
      {shiftForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-dark-card border border-neutral-200 dark:border-white/10 p-5">
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-bold text-primary dark:text-white">
                {shiftForm.id ? 'Modifier le shift' : 'Nouveau shift'}
              </h3>
              <button onClick={() => setShiftForm(null)} className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <Field label="Nom">
                <input
                  value={shiftForm.nom}
                  onChange={(e) => setShiftForm({ ...shiftForm, nom: e.target.value })}
                  placeholder="Matin, Soir, Nuit…"
                  className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-sm text-primary dark:text-white outline-none"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Début">
                  <input
                    type="time"
                    value={shiftForm.heure_debut}
                    onChange={(e) => setShiftForm({ ...shiftForm, heure_debut: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-sm text-primary dark:text-white"
                  />
                </Field>
                <Field label="Fin">
                  <input
                    type="time"
                    value={shiftForm.heure_fin}
                    onChange={(e) => setShiftForm({ ...shiftForm, heure_fin: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-sm text-primary dark:text-white"
                  />
                </Field>
              </div>
              <p className="flex items-start gap-1.5 text-[11px] text-neutral-500">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                Si l'heure de fin est antérieure à l'heure de début, le shift chevauche minuit
                automatiquement.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ordre d'affichage">
                  <input
                    type="number"
                    value={shiftForm.ordre}
                    onChange={(e) => setShiftForm({ ...shiftForm, ordre: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-sm text-primary dark:text-white"
                  />
                </Field>
                <Field label="Statut">
                  <button
                    type="button"
                    onClick={() => setShiftForm({ ...shiftForm, actif: !shiftForm.actif })}
                    className={twMerge(
                      'w-full px-3 py-2 rounded-xl text-sm font-bold border',
                      shiftForm.actif
                        ? 'bg-green-500/10 text-green-600 border-green-500/20'
                        : 'bg-neutral-500/10 text-neutral-500 border-neutral-500/20'
                    )}
                  >
                    {shiftForm.actif ? 'Actif' : 'Inactif'}
                  </button>
                </Field>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setShiftForm(null)}
                className="px-4 py-2 rounded-xl text-sm font-bold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/5"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveShift}
                disabled={savingShift}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary dark:bg-dark-accent text-white text-sm font-bold hover:opacity-90 disabled:opacity-50"
              >
                {savingShift ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale détail / passation */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-dark-card border border-neutral-200 dark:border-white/10 p-5">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="font-bold text-primary dark:text-white">
                  {detail.shift_nom} · {detail.business_date}
                </h3>
                <p className="text-xs text-neutral-500">
                  {detail.heure_debut} → {detail.heure_fin} · ouverte par {detail.ouverte_par}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => imprimerPassation(detail)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-primary dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/5"
                  title="Imprimer le rapport de passation"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDetail(null)}
                  className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4">
              <Metric label="CA total" value={formatMontant(detail.ventes)} />
              <Metric label="Commandes" value={String(detail.nombre_commandes)} />
              <Metric label="CA bar" value={formatMontant(detail.ventes_bar)} />
              <Metric label="CA cuisine" value={formatMontant(detail.ventes_cuisine)} />
              <Metric label="Encaissements" value={formatMontant(detail.encaissements)} />
              <Metric label="Impayés" value={formatMontant(detail.montant_impayes)} tone={detail.montant_impayes > 0 ? 'warn' : 'neutral'} />
            </div>

            <h4 className="mt-4 mb-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
              Encaissements par mode
            </h4>
            <div className="space-y-1">
              {Object.keys(detail.encaissements_par_mode || {}).length === 0 && (
                <p className="text-sm text-neutral-500">Aucun encaissement.</p>
              )}
              {Object.entries(detail.encaissements_par_mode || {}).map(([mode, montant]) => (
                <div key={mode} className="flex items-center justify-between text-sm">
                  <span className="text-neutral-600 dark:text-neutral-300">{formatModePaiement(mode)}</span>
                  <span className="font-bold text-primary dark:text-white">{formatMontant(Number(montant))}</span>
                </div>
              ))}
            </div>

            <h4 className="mt-4 mb-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
              Caisse
            </h4>
            <div className="space-y-1 text-sm">
              <Line label="Fond initial" value={formatMontant(detail.fond_initial)} />
              <Line label="Entrées hors ventes" value={formatMontant(detail.entrees_hors_ventes)} />
              <Line label="Sorties hors ventes" value={`− ${formatMontant(detail.sorties_hors_ventes)}`} />
              <Line label="Solde théorique" value={formatMontant(detail.solde_theorique)} strong />
              <Line
                label="Montant compté"
                value={detail.montant_compte === null ? '—' : formatMontant(detail.montant_compte)}
              />
              <Line
                label="Écart"
                value={detail.ecart === null ? 'Session non clôturée' : formatMontant(detail.ecart)}
                tone={detail.ecart ? 'warn' : 'neutral'}
              />
            </div>

            {detail.commentaire && (
              <p className="mt-3 p-3 rounded-xl bg-neutral-100 dark:bg-white/5 text-xs text-neutral-600 dark:text-neutral-300">
                {detail.commentaire}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sous-composants
// ---------------------------------------------------------------------------

function Kpi({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'neutral' | 'warn';
}) {
  return (
    <div className="rounded-2xl bg-white dark:bg-dark-card border border-neutral-200 dark:border-white/10 p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{label}</p>
      <p
        className={twMerge(
          'text-base font-black mt-1 tabular-nums',
          tone === 'warn' ? 'text-amber-600' : 'text-primary dark:text-white'
        )}
      >
        {value}
      </p>
      {hint && <p className="text-[10px] text-neutral-400 mt-0.5">{hint}</p>}
    </div>
  );
}

function SessionCard({
  session,
  onDetail,
  onPrint,
}: {
  session: SessionShift;
  onDetail: () => void;
  onPrint: () => void;
}) {
  const ecart = session.ecart;
  return (
    <div className="rounded-2xl bg-white dark:bg-dark-card border border-neutral-200 dark:border-white/10 p-4 flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-bold text-primary dark:text-white">{session.shift_nom}</p>
            <span
              className={twMerge(
                'px-2 py-0.5 rounded-full text-[10px] font-bold border',
                session.statut === 'ouverte'
                  ? 'bg-green-500/10 text-green-600 border-green-500/20'
                  : 'bg-neutral-500/10 text-neutral-500 border-neutral-500/20'
              )}
            >
              {session.statut === 'ouverte' ? 'Ouverte' : 'Fermée'}
            </span>
          </div>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            {session.heure_debut} → {session.heure_fin}
            {session.traverse_minuit ? ' (chevauche minuit)' : ''}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onPrint}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-primary dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/5"
            title="Rapport de passation"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3">
        <Metric label="CA" value={formatMontant(session.ventes)} />
        <Metric label="Encaissé" value={formatMontant(session.encaissements)} />
        <Metric label="Bar" value={formatMontant(session.ventes_bar)} />
        <Metric label="Cuisine" value={formatMontant(session.ventes_cuisine)} />
      </div>

      <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-white/5 flex items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Solde théorique</p>
          <p className="text-sm font-bold text-primary dark:text-white tabular-nums">
            {formatMontant(session.solde_theorique)}
          </p>
          <p
            className={twMerge(
              'text-[11px] font-bold mt-0.5 tabular-nums',
              ecart === null ? 'text-neutral-400' : ecart === 0 ? 'text-green-600' : 'text-amber-600'
            )}
          >
            {ecart === null ? 'En cours' : ecart === 0 ? 'Sans écart' : `Écart ${formatMontant(ecart)}`}
          </p>
        </div>
        <button
          onClick={onDetail}
          className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-primary dark:hover:text-white transition-colors"
        >
          Détail passation
        </button>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'warn';
}) {
  return (
    <div className="rounded-xl bg-neutral-50 dark:bg-white/5 px-2.5 py-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{label}</p>
      <p
        className={twMerge(
          'text-sm font-bold tabular-nums',
          tone === 'warn' ? 'text-amber-600' : 'text-primary dark:text-white'
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Line({
  label,
  value,
  strong,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'neutral' | 'warn';
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={strong ? 'font-bold text-primary dark:text-white' : 'text-neutral-600 dark:text-neutral-300'}>
        {label}
      </span>
      <span
        className={twMerge(
          'tabular-nums',
          strong ? 'font-bold text-primary dark:text-white' : 'text-neutral-700 dark:text-neutral-200',
          tone === 'warn' && 'text-amber-600 font-bold'
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
