import { supabase } from '../config/supabase';
import { sha256Hex } from './exporters';

const BUCKET = 'exports';
const RETENTION_LABEL = '24 mois';

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export interface ArquivageResult {
  path: string;
  taille: number;
  sha256: string;
}

/**
 * Archive un fichier d'export dans le bucket privé `exports`.
 * Le dossier racine est l'identifiant de l'établissement : la politique RLS
 * Storage n'autorise l'accès qu'à ce dossier.
 */
export async function archiverExport(params: {
  etablissementId: string;
  typeExport: string;
  filename: string;
  contenu: Blob | ArrayBuffer | string;
  contentType: string;
}): Promise<ArquivageResult | null> {
  const { etablissementId, typeExport, filename, contenu, contentType } = params;

  const blob =
    contenu instanceof Blob
      ? contenu
      : new Blob([contenu as BlobPart], { type: contentType });

  const path = `${etablissementId}/${typeExport}/${timestamp()}-${filename}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType,
    upsert: false,
  });

  if (error) {
    console.warn('Archivage de l’export impossible:', error.message);
    return null;
  }

  const buffer = await blob.arrayBuffer();
  return {
    path,
    taille: blob.size,
    sha256: await sha256Hex(buffer),
  };
}

/**
 * Purge les archives arrivées à échéance (rétention 24 mois) :
 * suppression des fichiers Storage puis des lignes de journal.
 */
export async function purgerExportsExpires(etablissementId: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('exports_journalises')
      .select('id, storage_path')
      .eq('etablissement_id', etablissementId)
      .lte('date_purge_prevue', new Date().toISOString())
      .limit(200);

    if (error || !data || data.length === 0) return 0;

    const paths = data
      .map((row) => row.storage_path as string | null)
      .filter((p): p is string => !!p);

    if (paths.length > 0) {
      const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths);
      if (removeError) {
        console.warn('Purge Storage partielle:', removeError.message);
      }
    }

    const { error: deleteError } = await supabase
      .from('exports_journalises')
      .delete()
      .in('id', data.map((row) => row.id));

    if (deleteError) {
      console.warn('Purge du journal impossible:', deleteError.message);
      return 0;
    }

    return data.length;
  } catch (err) {
    console.warn('Purge des exports ignorée:', err);
    return 0;
  }
}

/** Lien de téléchargement temporaire d'une archive. */
export async function getExportDownloadUrl(
  storagePath: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error) {
    console.warn('Lien de téléchargement indisponible:', error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}

export const RETENTION_ARCHIVES = RETENTION_LABEL;
