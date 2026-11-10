import * as XLSX from 'xlsx';
import { buildFilename } from './exporters';
import type { ExportDataset, ExportDefinition } from './exporters';

/**
 * Génération XLSX (chargée à la demande pour ne pas alourdir le bundle principal).
 * Deux onglets : « Données » et « Paramètres » (métadonnées + totaux de contrôle).
 */
function buildWorkbook(dataset: ExportDataset, definition: ExportDefinition) {
  const header = definition.columns.map((c) => c.label);
  const body = dataset.rows.map((row) =>
    definition.columns.map((c) => {
      const value = row[c.key];
      if (c.numeric && value !== null && value !== undefined && value !== '') {
        const n = Number(value);
        return Number.isFinite(n) ? n : value;
      }
      return value ?? '';
    })
  );

  const dataSheet = XLSX.utils.aoa_to_sheet([header, ...body]);
  dataSheet['!cols'] = definition.columns.map((c) => ({
    wch: Math.min(Math.max(c.label.length + 2, 10), 40),
  }));

  const params: (string | number)[][] = [
    ['Export', definition.label],
    ['Établissement', dataset.meta.etablissement_nom],
    ['Période début', dataset.meta.date_debut],
    ['Période fin', dataset.meta.date_fin],
    ['Devise', dataset.meta.devise],
    ['Taux de TVA (%)', dataset.meta.taux_tva],
    ['Prix TTC', dataset.meta.prix_ttc ? 'Oui' : 'Non'],
    ['Fuseau horaire', dataset.meta.fuseau_horaire],
    ['Généré le', dataset.meta.genere_le],
    ['Généré par', dataset.meta.genere_par],
    ['Nombre de lignes', dataset.rows.length],
    [],
    ['Totaux de contrôle', ''],
    ...Object.entries(dataset.totaux || {}).map(([k, v]) => [k, v as string | number]),
  ];
  const paramsSheet = XLSX.utils.aoa_to_sheet(params);
  paramsSheet['!cols'] = [{ wch: 28 }, { wch: 32 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, dataSheet, 'Données');
  XLSX.utils.book_append_sheet(wb, paramsSheet, 'Paramètres');
  return wb;
}

export async function downloadXlsx(
  dataset: ExportDataset,
  definition: ExportDefinition,
): Promise<ArrayBuffer> {
  const wb = buildWorkbook(dataset, definition);
  const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = buildFilename(
    definition.type,
    new Date(dataset.meta.date_debut),
    new Date(dataset.meta.date_fin),
    'xlsx',
  );
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return bytes;
}
