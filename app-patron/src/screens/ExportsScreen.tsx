import { useEffect, useMemo, useState } from 'react';
import {
  endOfDay,
  endOfMonth,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertCircle,
  Archive,
  Calendar,
  CheckCircle,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';
import {
  EXPORT_DEFINITIONS,
  buildFilename,
  downloadCsv,
} from '../lib/exporters';
import type { ExportDataset, ExportDefinition } from '../lib/exporters';
import { archiverExport, getExportDownloadUrl, purgerExportsExpires, RETENTION_ARCHIVES } from '../lib/archive';
import type { SynthesePeriode } from '../lib/pdfExport';

// ---------------------------------------------------------------------------
// Types locaux
// ---------------------------------------------------------------------------

type PeriodMode = 'today' | 'month' | 'prev_month' | 'custom';
type TabularFormat = 'csv' | 'xlsx';

interface ExportLog {
  id: string;
  type_export: string;
  periode_debut: string;
  periode_fin: string;
  format: string;
  nb_lignes: number | null;
  taille_octets: number | null;
  storage_path: string | null;
  statut: string;
  date_creation: string;
  profiles?: { prenom: string; nom: string } | null;
}

const toInputDate = (date: Date) => format(date, 'yyyy-MM-dd');

function formatOctets(octets: number | null | undefined): string {
  if (!octets || octets <= 0) return '—';
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(1)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

// ---------------------------------------------------------------------------
// Écran
// ---------------------------------------------------------------------------

export function ExportsScreen() {
  const profile = useAuthStore((state) => state.profile);

  const [periodMode, setPeriodMode] = useState<PeriodMode>('month');
  const today = new Date();
  const [startDate, setStartDate] = useState(toInputDate(startOfMonth(today)));
  const [endDate, setEndDate] = useState(toInputDate(today));
  const [departement, setDepartement] = useState<'all' | 'bar' | 'cuisine'>('all');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'error'; message: string } | null>(null);
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);

  const {
    data: exportsLog,
    refetch: refetchExports,
    isLoading: exportsLoading,
  } = useSupabaseQuery<ExportLog[]>(
    ['exports_journalises', profile?.etablissement_id],
    async () => {
      if (!profile?.etablissement_id) return { data: [], error: null };
      const { data, error } = await supabase
        .from('exports_journalises')
        .select('*, profiles!utilisateur_id (prenom, nom)')
        .eq('etablissement_id', profile.etablissement_id)
        .order('date_creation', { ascending: false })
        .limit(20);
      return { data: (data as unknown as ExportLog[]) || [], error };
    },
    { enabled: !!profile?.etablissement_id }
  );

  const applyPeriod = (mode: PeriodMode) => {
    setPeriodMode(mode);
    const now = new Date();
    if (mode === 'today') {
      setStartDate(toInputDate(now));
      setEndDate(toInputDate(now));
    } else if (mode === 'month') {
      setStartDate(toInputDate(startOfMonth(now)));
      setEndDate(toInputDate(now));
    } else if (mode === 'prev_month') {
      const previous = subMonths(now, 1);
      setStartDate(toInputDate(startOfMonth(previous)));
      setEndDate(toInputDate(endOfMonth(previous)));
    }
  };

  const range = useMemo(() => {
    const start = startOfDay(parseISO(startDate));
    const end = endOfDay(parseISO(endDate));
    return { start, end };
  }, [startDate, endDate]);

  const periodInvalid = range.start > range.end;

  // Purge opportuniste des archives arrivées à échéance (rétention 24 mois).
  useEffect(() => {
    if (!profile?.etablissement_id) return;
    purgerExportsExpires(profile.etablissement_id).then((nb) => {
      if (nb > 0) refetchExports();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.etablissement_id]);

  const journaliser = async (payload: Record<string, unknown>) => {
    const { error } = await supabase.from('exports_journalises').insert(payload);
    if (error) {
      console.warn('Export généré mais journalisation échouée:', error.message);
    }
  };

  const runExport = async (definition: ExportDefinition, format: TabularFormat) => {
    if (periodInvalid) {
      setFeedback({ type: 'error', message: 'La date de début doit précéder la date de fin.' });
      return;
    }

    const key = `${definition.type}-${format}`;
    setBusyKey(key);
    setFeedback(null);

    try {
      const filtres = departement === 'all' ? {} : { departement };

      const { data, error } = await supabase.rpc('get_export_dataset', {
        p_type: definition.type,
        p_date_debut: range.start.toISOString(),
        p_date_fin: range.end.toISOString(),
        p_filtres: filtres,
      });

      if (error) throw error;
      const dataset = data as ExportDataset;
      if (!dataset || !Array.isArray(dataset.rows)) {
        console.error('Réponse RPC inattendue:', data);
        throw new Error('Réponse inattendue du serveur (dataset invalide).');
      }

      const filename = buildFilename(definition.type, range.start, range.end, format);
      let contenu: Blob;
      let contentType: string;

      if (format === 'csv') {
        const csv = downloadCsv(dataset, definition);
        contenu = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        contentType = 'text/csv';
      } else {
        const { downloadXlsx } = await import('../lib/xlsxExport');
        const bytes = await downloadXlsx(dataset, definition);
        contenu = new Blob([bytes], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        contentType =
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      }

      // Archivage Storage (le hash et la taille sont calculés à l'upload)
      const archive = profile?.etablissement_id
        ? await archiverExport({
            etablissementId: profile.etablissement_id,
            typeExport: definition.type,
            filename,
            contenu,
            contentType,
          })
        : null;

      await journaliser({
        etablissement_id: profile?.etablissement_id,
        type_export: definition.type,
        periode_debut: range.start.toISOString(),
        periode_fin: range.end.toISOString(),
        filtres,
        format,
        storage_path: archive?.path ?? null,
        sha256: archive?.sha256 ?? null,
        taille_octets: archive?.taille ?? contenu.size,
        nb_lignes: dataset.rows.length,
        statut: 'genere',
        utilisateur_id: profile?.id,
      });

      refetchExports();
      setFeedback({
        type: 'ok',
        message: `${definition.label} exporté (${dataset.rows.length} ligne(s), ${format.toUpperCase()})${
          archive ? ' et archivé' : ''
        }.`,
      });
    } catch (err: any) {
      console.error(`Export error [${definition.type}/${format}]:`, err);
      const base = err?.message || "Erreur lors de la génération de l'export.";
      const detailsParts = [err?.code, err?.details, err?.hint].filter(Boolean);
      setFeedback({
        type: 'error',
        message: detailsParts.length > 0 ? `${base} (${detailsParts.join(' | ')})` : base,
      });
    } finally {
      setBusyKey(null);
    }
  };

  const genererSynthese = async () => {
    const { data, error } = await supabase.rpc('get_synthese_periode', {
      p_date_debut: range.start.toISOString(),
      p_date_fin: range.end.toISOString(),
    });
    if (error) throw error;

    const synthese = data as SynthesePeriode;
    if (!synthese?.meta) throw new Error('Synthèse indisponible.');

    const { buildSynthesePdf, buildSyntheseFilename } = await import('../lib/pdfExport');
    const bytes = await buildSynthesePdf(synthese);

    const archive = profile?.etablissement_id
      ? await archiverExport({
          etablissementId: profile.etablissement_id,
          typeExport: 'synthese_cloture',
          filename: buildSyntheseFilename(synthese.meta, 'pdf'),
          contenu: bytes,
          contentType: 'application/pdf',
        })
      : null;

    await journaliser({
      etablissement_id: profile?.etablissement_id,
      type_export: 'synthese_cloture',
      periode_debut: range.start.toISOString(),
      periode_fin: range.end.toISOString(),
      filtres: {},
      format: 'pdf',
      storage_path: archive?.path ?? null,
      sha256: archive?.sha256 ?? null,
      taille_octets: archive?.taille ?? bytes.byteLength,
      nb_lignes: 1,
      statut: 'genere',
      utilisateur_id: profile?.id,
    });

    refetchExports();
    return { synthese, bytes, archivePath: archive?.path ?? null };
  };

  const runSynthesePdf = async () => {
    if (periodInvalid) {
      setFeedback({ type: 'error', message: 'La date de début doit précéder la date de fin.' });
      return;
    }

    setBusyKey('synthese-pdf');
    setFeedback(null);

    try {
      const { synthese, bytes } = await genererSynthese();
      const { buildSyntheseFilename } = await import('../lib/pdfExport');

      // Téléchargement local du PDF déjà généré
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = buildSyntheseFilename(synthese.meta, 'pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setFeedback({ type: 'ok', message: 'Synthèse de clôture générée (PDF).' });
    } catch (err: any) {
      console.error('Synthèse PDF error:', err);
      setFeedback({
        type: 'error',
        message: err?.message || 'Erreur lors de la génération de la synthèse.',
      });
    } finally {
      setBusyKey(null);
    }
  };

  const runSyntheseWhatsApp = async () => {
    if (periodInvalid) {
      setFeedback({ type: 'error', message: 'La date de début doit précéder la date de fin.' });
      return;
    }

    setBusyKey('synthese-whatsapp');
    setFeedback(null);

    try {
      const { synthese, archivePath } = await genererSynthese();
      const { construireMessageSynthese, ouvrirWhatsApp } = await import('../lib/whatsapp');

      const lien = archivePath ? await getExportDownloadUrl(archivePath, 604800) : null;
      ouvrirWhatsApp({ texte: construireMessageSynthese(synthese, lien) });

      setFeedback({
        type: 'ok',
        message: lien
          ? 'WhatsApp ouvert : la synthèse et son lien PDF sont prêts à partager.'
          : 'WhatsApp ouvert : synthèse prête (lien PDF indisponible).',
      });
    } catch (err: any) {
      console.error('Synthèse WhatsApp error:', err);
      setFeedback({
        type: 'error',
        message: err?.message || 'Erreur lors du partage de la synthèse.',
      });
    } finally {
      setBusyKey(null);
    }
  };

  const handlePartagerArchive = async (log: ExportLog) => {
    if (!log.storage_path) return;
    setDownloadingPath(log.storage_path);
    try {
      const lien = await getExportDownloadUrl(log.storage_path, 604800);
      if (!lien) {
        setFeedback({ type: 'error', message: 'Archive introuvable ou expirée.' });
        return;
      }
      const texte = [
        `*Synthèse de clôture — ZERO-MATA*`,
        `Période : ${format(parseISO(log.periode_debut), 'dd/MM/yyyy')} → ${format(
          parseISO(log.periode_fin),
          'dd/MM/yyyy',
        )}`,
        '',
        `PDF (lien valable 7 jours) : ${lien}`,
      ].join('\n');
      const { ouvrirWhatsApp } = await import('../lib/whatsapp');
      ouvrirWhatsApp({ texte });
    } finally {
      setDownloadingPath(null);
    }
  };

  const handleOpenArchive = async (log: ExportLog) => {
    if (!log.storage_path) return;
    setDownloadingPath(log.storage_path);
    try {
      const url = await getExportDownloadUrl(log.storage_path);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
      else setFeedback({ type: 'error', message: 'Archive introuvable ou expirée.' });
    } finally {
      setDownloadingPath(null);
    }
  };

  const categories: Array<'Comptabilité' | 'Caisse' | 'Stock'> = ['Comptabilité', 'Caisse', 'Stock'];

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-dark-bg pb-20 md:pb-6">
      {/* Header */}
      <div className="p-4 md:p-6 bg-white dark:bg-dark-card/30 dark:backdrop-blur-xl border-b border-neutral-200 dark:border-white/5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary dark:text-white font-display">
              Exports & archives
            </h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">
              Journaux comptables, suivi de caisse et traçabilité — établissement courant uniquement
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-white/5 px-3 py-2 rounded-xl">
            <ShieldCheck className="w-4 h-4 text-semantic-green" />
            TVA 19,25 % • XAF • Africa/Douala
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-6">
        {/* Période & filtres */}
        <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-2xl border border-neutral-200 dark:border-white/5 p-5">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="space-y-3">
              <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                Période
              </label>
              <div className="flex flex-wrap gap-2">
                {([
                  { value: 'today', label: "Aujourd'hui" },
                  { value: 'month', label: 'Mois en cours' },
                  { value: 'prev_month', label: 'Mois précédent' },
                  { value: 'custom', label: 'Personnalisé' },
                ] as const).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => applyPeriod(option.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      periodMode === option.value
                        ? 'bg-primary dark:bg-dark-accent text-white'
                        : 'bg-neutral-100 dark:bg-white/5 text-neutral-500 dark:text-neutral-400'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400 mb-1">
                  Du
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setPeriodMode('custom'); }}
                  className="px-3 py-2 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary dark:focus:border-dark-accent rounded-xl text-sm text-primary dark:text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400 mb-1">
                  Au
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setPeriodMode('custom'); }}
                  className="px-3 py-2 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary dark:focus:border-dark-accent rounded-xl text-sm text-primary dark:text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400 mb-1">
                  Département
                </label>
                <select
                  value={departement}
                  onChange={(e) => setDepartement(e.target.value as 'all' | 'bar' | 'cuisine')}
                  className="px-3 py-2 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary dark:focus:border-dark-accent rounded-xl text-sm text-primary dark:text-white outline-none"
                >
                  <option value="all">Tous</option>
                  <option value="bar">Bar</option>
                  <option value="cuisine">Cuisine</option>
                </select>
              </div>
            </div>
          </div>

          <p className="mt-3 text-[11px] text-neutral-400 dark:text-neutral-500 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {format(range.start, 'dd MMMM yyyy', { locale: fr })} → {format(range.end, 'dd MMMM yyyy', { locale: fr })}
          </p>

          <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-neutral-100 dark:border-white/5">
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Synthèse consolidée de la période : ventes, encaissements, crédits, caisse, stock vendu.
            </p>
            <button
              type="button"
              onClick={runSynthesePdf}
              disabled={busyKey === 'synthese-pdf' || periodInvalid}
              className="inline-flex items-center justify-center gap-2 px-4 h-9 rounded-lg bg-primary dark:bg-dark-accent text-white text-xs font-bold disabled:opacity-50 transition-opacity hover:opacity-90 whitespace-nowrap"
            >
              {busyKey === 'synthese-pdf' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileText className="w-3.5 h-3.5" />
              )}
              Synthèse de clôture (PDF)
            </button>
            <button
              type="button"
              onClick={runSyntheseWhatsApp}
              disabled={busyKey === 'synthese-whatsapp' || periodInvalid}
              className="inline-flex items-center justify-center gap-2 px-4 h-9 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-50 transition-opacity hover:opacity-90 whitespace-nowrap"
              title="Générer la synthèse, l'archiver et ouvrir WhatsApp avec le lien du PDF"
            >
              {busyKey === 'synthese-whatsapp' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <MessageCircle className="w-3.5 h-3.5" />
              )}
              WhatsApp
            </button>
          </div>

          {feedback && (
            <div
              className={`mt-4 flex items-start gap-2 p-3 rounded-xl text-sm font-medium ${
                feedback.type === 'ok'
                  ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                  : 'bg-red-500/10 text-red-600 dark:text-red-400'
              }`}
            >
              {feedback.type === 'ok' ? (
                <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}
        </div>

        {/* Cartes d'export */}
        {categories.map((category) => (
          <div key={category} className="space-y-3">
            <h2 className="text-sm font-bold text-primary dark:text-white uppercase tracking-widest">
              {category}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {EXPORT_DEFINITIONS.filter((d) => d.category === category).map((definition) => {
                const csvKey = `${definition.type}-csv`;
                const xlsxKey = `${definition.type}-xlsx`;
                const busy = busyKey === csvKey || busyKey === xlsxKey;

                return (
                  <div
                    key={definition.type}
                    className="flex flex-col justify-between bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-2xl border border-neutral-200 dark:border-white/5 p-4 shadow-soft"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="size-9 rounded-lg bg-primary/10 dark:bg-dark-accent/10 flex items-center justify-center">
                          <FileSpreadsheet className="w-4 h-4 text-primary dark:text-dark-accent" />
                        </div>
                        <h3 className="font-bold text-sm text-primary dark:text-white">
                          {definition.label}
                        </h3>
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
                        {definition.description}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy || periodInvalid}
                        onClick={() => runExport(definition, 'csv')}
                        className="flex-1 h-9 rounded-lg bg-primary dark:bg-dark-accent text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-opacity hover:opacity-90"
                      >
                        {busyKey === csvKey ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        CSV
                      </button>
                      <button
                        type="button"
                        disabled={busy || periodInvalid}
                        onClick={() => runExport(definition, 'xlsx')}
                        className="flex-1 h-9 rounded-lg bg-neutral-100 dark:bg-white/5 text-primary dark:text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors hover:bg-neutral-200 dark:hover:bg-white/10"
                      >
                        {busyKey === xlsxKey ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                        )}
                        XLSX
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Informations */}
        <div className="rounded-2xl border border-blue-200 dark:border-blue-500/20 bg-blue-50/50 dark:bg-blue-500/5 p-4 flex items-start gap-3">
          <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <div className="text-xs text-neutral-600 dark:text-neutral-300 space-y-1">
            <p className="font-bold text-blue-700 dark:text-blue-400">
              Contenu des fichiers
            </p>
            <p>
              Le CSV utilise le séparateur « ; » et un BOM UTF-8 (ouverture directe dans Excel FR).
              Le XLSX contient deux onglets : <strong>Données</strong> et <strong>Paramètres</strong>
              {' '}(métadonnées + totaux de contrôle).
            </p>
            <p>
              Chaque fichier est archivé dans le coffre privé de l'établissement
              (rétention {RETENTION_ARCHIVES}) et journalisé avec son empreinte SHA-256.
            </p>
          </div>
        </div>

        {/* Derniers exports */}
        <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-2xl border border-neutral-200 dark:border-white/5 overflow-hidden">
          <div className="p-4 border-b border-neutral-200 dark:border-white/5 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-sm text-primary dark:text-white">Derniers exports</h2>
              <p className="text-[10px] uppercase tracking-widest text-neutral-400 mt-0.5">
                Journal de traçabilité
              </p>
            </div>
            {exportsLoading && <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />}
          </div>

          {(!exportsLog || exportsLog.length === 0) ? (
            <p className="p-6 text-center text-xs text-neutral-400">
              Aucun export enregistré pour le moment.
            </p>
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-white/5 max-h-[50vh] overflow-y-auto">
              {exportsLog.map((log) => {
                const definition = EXPORT_DEFINITIONS.find((d) => d.type === log.type_export);
                const label =
                  definition?.label ||
                  (log.type_export === 'synthese_cloture' ? 'Synthèse de clôture' : log.type_export);
                return (
                  <div key={log.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-primary dark:text-white truncate">
                        {label}
                      </p>
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
                        {format(parseISO(log.periode_debut), 'dd/MM/yyyy')} → {format(parseISO(log.periode_fin), 'dd/MM/yyyy')}
                        {' • '}{format(parseISO(log.date_creation), 'dd/MM/yyyy HH:mm')}
                        {log.profiles ? ` • ${log.profiles.prenom} ${log.profiles.nom}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-bold">
                      <span className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-white/10 text-neutral-600 dark:text-neutral-300 uppercase">
                        {log.format}
                      </span>
                      <span className="text-neutral-500 dark:text-neutral-400">
                        {log.nb_lignes ?? 0} ligne(s)
                      </span>
                      <span className="text-neutral-500 dark:text-neutral-400">
                        {formatOctets(log.taille_octets)}
                      </span>
                      {log.storage_path && (
                        <button
                          type="button"
                          onClick={() => handleOpenArchive(log)}
                          disabled={downloadingPath === log.storage_path}
                          title="Télécharger l'archive"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 dark:bg-dark-accent/20 text-primary dark:text-dark-accent hover:bg-primary/20 dark:hover:bg-dark-accent/30 disabled:opacity-50 transition-colors"
                        >
                          {downloadingPath === log.storage_path ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Archive className="w-3 h-3" />
                          )}
                          Archive
                        </button>
                      )}
                      {log.storage_path && log.type_export === 'synthese_cloture' && (
                        <button
                          type="button"
                          onClick={() => handlePartagerArchive(log)}
                          disabled={downloadingPath === log.storage_path}
                          title="Partager le PDF sur WhatsApp"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                        >
                          <MessageCircle className="w-3 h-3" />
                          WhatsApp
                        </button>
                      )}
                      <span className="text-semantic-green flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> {log.statut}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
