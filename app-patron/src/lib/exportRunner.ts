import { supabase } from '../config/supabase';
import { buildFilename, downloadCsv } from './exporters';
import type { ExportDataset, ExportDefinition } from './exporters';
import { archiverExport } from './archive';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface ExecuterExportParams {
  definition: ExportDefinition;
  format: 'csv' | 'xlsx';
  start: Date;
  end: Date;
  filtres?: Record<string, unknown>;
  etablissementId: string;
  utilisateurId?: string;
}

export interface ExecuterExportResult {
  rows: number;
  archivePath: string | null;
}

/**
 * Exécute un export complet : appel RPC, génération du fichier (téléchargement),
 * archivage Storage et journalisation. Partagé par l'écran Exports et les
 * boutons contextuels (Dashboard, Transactions, Caisse).
 */
export async function executerExport({
  definition,
  format,
  start,
  end,
  filtres = {},
  etablissementId,
  utilisateurId,
}: ExecuterExportParams): Promise<ExecuterExportResult> {
  const { data, error } = await supabase.rpc('get_export_dataset', {
    p_type: definition.type,
    p_date_debut: start.toISOString(),
    p_date_fin: end.toISOString(),
    p_filtres: filtres,
  });

  if (error) throw error;

  const dataset = data as ExportDataset;
  if (!dataset || !Array.isArray(dataset.rows)) {
    console.error('Réponse RPC inattendue:', data);
    throw new Error('Réponse inattendue du serveur (dataset invalide).');
  }

  const filename = buildFilename(definition.type, start, end, format);

  let contenu: Blob;
  let contentType: string;

  if (format === 'csv') {
    const csv = downloadCsv(dataset, definition);
    contenu = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    contentType = 'text/csv';
  } else {
    const { downloadXlsx } = await import('./xlsxExport');
    const bytes = await downloadXlsx(dataset, definition);
    contenu = new Blob([bytes], { type: XLSX_MIME });
    contentType = XLSX_MIME;
  }

  const archive = await archiverExport({
    etablissementId,
    typeExport: definition.type,
    filename,
    contenu,
    contentType,
  });

  const { error: logError } = await supabase.from('exports_journalises').insert({
    etablissement_id: etablissementId,
    type_export: definition.type,
    periode_debut: start.toISOString(),
    periode_fin: end.toISOString(),
    filtres,
    format,
    storage_path: archive?.path ?? null,
    sha256: archive?.sha256 ?? null,
    taille_octets: archive?.taille ?? contenu.size,
    nb_lignes: dataset.rows.length,
    statut: 'genere',
    utilisateur_id: utilisateurId,
  });

  if (logError) {
    console.warn('Export généré mais journalisation échouée:', logError.message);
  }

  return { rows: dataset.rows.length, archivePath: archive?.path ?? null };
}

/** Message d'erreur lisible (PostgREST renvoie des objets, pas des Error). */
export function messageErreurExport(err: any): string {
  const base = err?.message || "Erreur lors de la génération de l'export.";
  const details = [err?.code, err?.details, err?.hint].filter(Boolean);
  return details.length > 0 ? `${base} (${details.join(' | ')})` : base;
}
