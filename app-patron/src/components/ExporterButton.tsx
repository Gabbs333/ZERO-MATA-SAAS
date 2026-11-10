import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Loader2,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import type { ExportDefinition } from '../lib/exporters';
import { executerExport, messageErreurExport } from '../lib/exportRunner';

interface ExporterButtonProps {
  definitions: ExportDefinition[];
  start: Date;
  end: Date;
  filtres?: Record<string, unknown>;
  label?: string;
  className?: string;
}

/**
 * Bouton d'export contextuel : exporte directement les jeux de données liés à
 * l'écran courant sur la période affichée, sans passer par la page Exports.
 */
export function ExporterButton({
  definitions,
  start,
  end,
  filtres = {},
  label = 'Exporter',
  className = '',
}: ExporterButtonProps) {
  const profile = useAuthStore((state) => state.profile);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'error'; message: string } | null>(null);

  const lancer = async (definition: ExportDefinition, format: 'csv' | 'xlsx') => {
    if (!profile?.etablissement_id) return;
    const key = `${definition.type}-${format}`;
    setBusyKey(key);
    setFeedback(null);

    try {
      const result = await executerExport({
        definition,
        format,
        start,
        end,
        filtres,
        etablissementId: profile.etablissement_id,
        utilisateurId: profile.id,
      });
      setFeedback({
        type: 'ok',
        message: `${definition.label} : ${result.rows} ligne(s) ${format.toUpperCase()}.`,
      });
    } catch (err: any) {
      console.error(`Export error [${definition.type}/${format}]:`, err);
      setFeedback({ type: 'error', message: messageErreurExport(err) });
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setFeedback(null);
        }}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 border border-neutral-200/50 dark:border-white/5 hover:text-primary dark:hover:text-white transition-colors whitespace-nowrap ${className}`}
      >
        <Download className="w-3 h-3" />
        {label}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 z-50 w-[320px] rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-dark-card shadow-xl p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">
              {format(start, 'dd MMM yyyy', { locale: fr })} → {format(end, 'dd MMM yyyy', { locale: fr })}
            </p>

            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {definitions.map((definition) => {
                const csvKey = `${definition.type}-csv`;
                const xlsxKey = `${definition.type}-xlsx`;
                const busy = busyKey === csvKey || busyKey === xlsxKey;

                return (
                  <div key={definition.type} className="rounded-xl px-2 py-2 hover:bg-neutral-50 dark:hover:bg-white/5">
                    <p className="text-xs font-bold text-primary dark:text-white">
                      {definition.label}
                    </p>
                    <div className="flex gap-1.5 mt-1.5">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => lancer(definition, 'csv')}
                        className="flex-1 h-7 rounded-md bg-primary dark:bg-dark-accent text-white text-[10px] font-bold flex items-center justify-center gap-1 disabled:opacity-50 hover:opacity-90 transition-opacity"
                      >
                        {busyKey === csvKey ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Download className="w-3 h-3" />
                        )}
                        CSV
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => lancer(definition, 'xlsx')}
                        className="flex-1 h-7 rounded-md bg-neutral-100 dark:bg-white/10 text-primary dark:text-white text-[10px] font-bold flex items-center justify-center gap-1 disabled:opacity-50 hover:bg-neutral-200 dark:hover:bg-white/20 transition-colors"
                      >
                        {busyKey === xlsxKey ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <FileSpreadsheet className="w-3 h-3" />
                        )}
                        XLSX
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {feedback && (
              <div
                className={`mt-2 flex items-start gap-1.5 p-2 rounded-lg text-[10px] font-medium ${
                  feedback.type === 'ok'
                    ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                    : 'bg-red-500/10 text-red-600 dark:text-red-400'
                }`}
              >
                {feedback.type === 'ok' ? (
                  <CheckCircle className="w-3 h-3 mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                )}
                <span>{feedback.message}</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate('/exports');
              }}
              className="w-full mt-2 pt-2 border-t border-neutral-100 dark:border-white/5 text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-primary dark:hover:text-white transition-colors"
            >
              Tous les exports
            </button>
          </div>
        </>
      )}
    </div>
  );
}
