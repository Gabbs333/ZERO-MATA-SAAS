// ---------------------------------------------------------------------------
// Catalogue et utilitaires d'export
// ---------------------------------------------------------------------------

export type ExportType =
  | 'journal_ventes'
  | 'journal_encaissements'
  | 'journal_caisse'
  | 'journal_ventes_credit'
  | 'journal_retours'
  | 'journal_echanges'
  | 'rapport_caisse_journalier'
  | 'rapport_stock_journalier'
  | 'rapport_stock_synthese'
  | 'rapport_stock_jour_produit'
  | 'journal_mouvements_stock';

export interface ExportColumn {
  key: string;
  label: string;
  numeric?: boolean;
}

export interface ExportDefinition {
  type: ExportType;
  label: string;
  description: string;
  category: 'Comptabilité' | 'Caisse' | 'Stock';
  columns: ExportColumn[];
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExportMeta {
  type: string;
  etablissement_id: string;
  etablissement_nom: string;
  date_debut: string;
  date_fin: string;
  devise: string;
  taux_tva: number;
  prix_ttc: boolean;
  fuseau_horaire: string;
  genere_le: string;
  genere_par: string;
  filtres?: Record<string, unknown>;
}

export interface ExportDataset {
  meta: ExportMeta;
  rows: Record<string, unknown>[];
  totaux: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Catalogue des exports (P0)
// ---------------------------------------------------------------------------

export const EXPORT_DEFINITIONS: ExportDefinition[] = [
  {
    type: 'journal_ventes',
    label: 'Journal des ventes',
    description: 'Une ligne par article facturé (facturé initial, retourné, net, TVA).',
    category: 'Comptabilité',
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'numero_commande', label: 'N° commande' },
      { key: 'numero_facture', label: 'N° facture' },
      { key: 'departement', label: 'Département' },
      { key: 'canal', label: 'Canal' },
      { key: 'type_service', label: 'Service' },
      { key: 'table', label: 'Table' },
      { key: 'produit', label: 'Produit' },
      { key: 'categorie', label: 'Catégorie' },
      { key: 'quantite_facturee', label: 'Qté facturée', numeric: true },
      { key: 'quantite_retournee', label: 'Qté retournée', numeric: true },
      { key: 'prix_unitaire', label: 'PU', numeric: true },
      { key: 'montant_initial', label: 'Montant initial', numeric: true },
      { key: 'montant_net', label: 'Montant net', numeric: true },
      { key: 'statut_reglement', label: 'Règlement' },
      { key: 'vente_a_credit', label: 'À crédit' },
      { key: 'agent', label: 'Agent' },
      { key: 'valideur', label: 'Validé par' },
      { key: 'montant_ttc', label: 'Montant TTC', numeric: true },
      { key: 'base_ht', label: 'Base HT', numeric: true },
      { key: 'tva', label: 'TVA', numeric: true },
    ],
  },
  {
    type: 'journal_encaissements',
    label: 'Journal des encaissements',
    description: 'Encaissements par mode, avec remboursements et règlements de crédit.',
    category: 'Comptabilité',
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'numero_facture', label: 'N° facture' },
      { key: 'numero_commande', label: 'N° commande' },
      { key: 'departement', label: 'Département' },
      { key: 'type_operation', label: 'Opération' },
      { key: 'mode_paiement', label: 'Mode' },
      { key: 'reference', label: 'Référence' },
      { key: 'montant_ttc', label: 'Montant TTC', numeric: true },
      { key: 'base_ht', label: 'Base HT', numeric: true },
      { key: 'tva', label: 'TVA', numeric: true },
      { key: 'agent', label: 'Agent' },
    ],
  },
  {
    type: 'journal_caisse',
    label: 'Journal de caisse',
    description: 'Mouvements de caisse du jour : ventes encaissées et mouvements manuels.',
    category: 'Caisse',
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'type', label: 'Type' },
      { key: 'origine', label: 'Origine' },
      { key: 'numero_facture', label: 'N° facture' },
      { key: 'montant', label: 'Montant', numeric: true },
      { key: 'mode_paiement', label: 'Mode' },
      { key: 'motif', label: 'Motif' },
      { key: 'commentaire', label: 'Commentaire' },
      { key: 'agent', label: 'Agent' },
    ],
  },
  {
    type: 'journal_ventes_credit',
    label: 'Journal des ventes à crédit',
    description: 'Factures mises à crédit : total, payé, restant dû, client.',
    category: 'Comptabilité',
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'numero_facture', label: 'N° facture' },
      { key: 'numero_commande', label: 'N° commande' },
      { key: 'client', label: 'Client' },
      { key: 'telephone', label: 'Téléphone' },
      { key: 'montant_total', label: 'Total', numeric: true },
      { key: 'montant_paye', label: 'Payé', numeric: true },
      { key: 'montant_restant', label: 'Restant dû', numeric: true },
      { key: 'statut_reglement', label: 'Statut' },
      { key: 'date_paiement_complet', label: 'Soldée le' },
      { key: 'agent', label: 'Agent' },
    ],
  },
  {
    type: 'journal_retours',
    label: 'Journal des retours',
    description: 'Articles retournés avec motif, auteur de validation et TVA.',
    category: 'Comptabilité',
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'numero_retour', label: 'N° retour' },
      { key: 'numero_facture', label: 'N° facture' },
      { key: 'numero_commande', label: 'N° commande' },
      { key: 'produit', label: 'Produit' },
      { key: 'categorie', label: 'Catégorie' },
      { key: 'departement', label: 'Département' },
      { key: 'quantite', label: 'Quantité', numeric: true },
      { key: 'prix_unitaire', label: 'PU', numeric: true },
      { key: 'montant_ttc', label: 'Montant TTC', numeric: true },
      { key: 'base_ht', label: 'Base HT', numeric: true },
      { key: 'tva', label: 'TVA', numeric: true },
      { key: 'motif', label: 'Motif' },
      { key: 'valide_par', label: 'Validé par' },
    ],
  },
  {
    type: 'journal_echanges',
    label: 'Journal des échanges',
    description: 'Échanges d’articles : sortants, entrants, différence et agent.',
    category: 'Comptabilité',
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'numero_echange', label: 'N° échange' },
      { key: 'numero_facture', label: 'N° facture' },
      { key: 'numero_commande', label: 'N° commande' },
      { key: 'montant_retourne', label: 'Montant retourné', numeric: true },
      { key: 'montant_ajoute', label: 'Montant ajouté', numeric: true },
      { key: 'difference', label: 'Différence', numeric: true },
      { key: 'articles_sortants', label: 'Articles sortants' },
      { key: 'articles_entrants', label: 'Articles entrants' },
      { key: 'motif', label: 'Motif' },
      { key: 'agent', label: 'Agent' },
    ],
  },
  {
    type: 'rapport_caisse_journalier',
    label: 'Rapport de caisse journalier',
    description: 'Par jour : entrées, sorties, encaissements par mode, crédit, écart de caisse.',
    category: 'Caisse',
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'entrees_caisse', label: 'Entrées caisse', numeric: true },
      { key: 'entrees_hors_ventes', label: 'Entrées hors ventes', numeric: true },
      { key: 'sorties_caisse', label: 'Sorties caisse', numeric: true },
      { key: 'ventes_encaissees', label: 'Ventes encaissées', numeric: true },
      { key: 'especes', label: 'Espèces', numeric: true },
      { key: 'mobile_money', label: 'Mobile Money', numeric: true },
      { key: 'carte_bancaire', label: 'Carte bancaire', numeric: true },
      { key: 'cheque', label: 'Chèque', numeric: true },
      { key: 'ventes_a_credit', label: 'Ventes à crédit', numeric: true },
      { key: 'montant_theorique', label: 'Solde théorique', numeric: true },
      { key: 'montant_compte', label: 'Montant compté', numeric: true },
      { key: 'ecart', label: 'Écart', numeric: true },
      { key: 'commentaire', label: 'Commentaire' },
    ],
  },
  {
    type: 'rapport_stock_journalier',
    label: 'Rapprochement de stock (par produit)',
    description: 'Une ligne par désignation : ouverture, entrées, sorties, théorique, réel et écarts.',
    category: 'Stock',
    columns: [
      { key: 'produit', label: 'Produit' },
      { key: 'categorie', label: 'Catégorie' },
      { key: 'departement', label: 'Département' },
      { key: 'cout_unitaire', label: 'Coût unitaire', numeric: true },
      { key: 'qte_ouverture', label: 'Qté ouverture', numeric: true },
      { key: 'qte_entrees', label: 'Qté entrées', numeric: true },
      { key: 'qte_sorties_ventes', label: 'Qté vendues', numeric: true },
      { key: 'qte_sorties_autres', label: 'Qté sorties autres', numeric: true },
      { key: 'qte_theorique', label: 'Qté théorique', numeric: true },
      { key: 'qte_reelle', label: 'Qté comptée', numeric: true },
      { key: 'ecart_qte', label: 'Écart qté', numeric: true },
      { key: 'valeur_ouverture', label: 'Valeur ouverture', numeric: true },
      { key: 'valeur_entrees', label: 'Valeur entrées', numeric: true },
      { key: 'valeur_sorties_ventes', label: 'Valeur vendue', numeric: true },
      { key: 'valeur_sorties_autres', label: 'Valeur sorties autres', numeric: true },
      { key: 'valeur_theorique', label: 'Valeur théorique', numeric: true },
      { key: 'valeur_reelle', label: 'Valeur comptée', numeric: true },
      { key: 'ecart_valeur', label: 'Écart valeur', numeric: true },
      { key: 'jours_comptes', label: 'Jours comptés', numeric: true },
      { key: 'statut', label: 'Statut' },
    ],
  },
  {
    type: 'rapport_stock_synthese',
    label: 'Rapprochement de stock (synthèse journalière)',
    description: 'Par jour : valeur du stock vendu, entrées valorisées et écarts de comptage.',
    category: 'Stock',
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'qte_entrees', label: 'Qté entrées', numeric: true },
      { key: 'qte_sorties_ventes', label: 'Qté vendues', numeric: true },
      { key: 'qte_sorties_autres', label: 'Qté sorties autres', numeric: true },
      { key: 'valeur_ouverture', label: 'Valeur ouverture', numeric: true },
      { key: 'valeur_entrees', label: 'Valeur entrées', numeric: true },
      { key: 'valeur_sorties_ventes', label: 'Valeur vendue', numeric: true },
      { key: 'valeur_sorties_autres', label: 'Valeur sorties autres', numeric: true },
      { key: 'valeur_theorique', label: 'Valeur théorique', numeric: true },
      { key: 'valeur_reelle', label: 'Valeur réelle', numeric: true },
      { key: 'ecart_qte', label: 'Écart qté', numeric: true },
      { key: 'ecart_valeur', label: 'Écart valeur', numeric: true },
      { key: 'produits_suivis', label: 'Produits suivis', numeric: true },
      { key: 'produits_comptes', label: 'Produits comptés', numeric: true },
      { key: 'statut', label: 'Statut' },
    ],
  },
  {
    type: 'rapport_stock_jour_produit',
    label: 'Rapprochement de stock (détail jour / produit)',
    description: 'Une ligne par journée et par désignation : mouvements, théorique, réel et écarts.',
    category: 'Stock',
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'produit', label: 'Produit' },
      { key: 'categorie', label: 'Catégorie' },
      { key: 'departement', label: 'Département' },
      { key: 'cout_unitaire', label: 'Coût unitaire', numeric: true },
      { key: 'qte_ouverture', label: 'Qté ouverture', numeric: true },
      { key: 'qte_entrees', label: 'Qté entrées', numeric: true },
      { key: 'qte_sorties_ventes', label: 'Qté vendues', numeric: true },
      { key: 'qte_sorties_autres', label: 'Qté sorties autres', numeric: true },
      { key: 'qte_theorique', label: 'Qté théorique', numeric: true },
      { key: 'qte_reelle', label: 'Qté comptée', numeric: true },
      { key: 'ecart_qte', label: 'Écart qté', numeric: true },
      { key: 'valeur_ouverture', label: 'Valeur ouverture', numeric: true },
      { key: 'valeur_entrees', label: 'Valeur entrées', numeric: true },
      { key: 'valeur_sorties_ventes', label: 'Valeur vendue', numeric: true },
      { key: 'valeur_sorties_autres', label: 'Valeur sorties autres', numeric: true },
      { key: 'valeur_theorique', label: 'Valeur théorique', numeric: true },
      { key: 'valeur_reelle', label: 'Valeur comptée', numeric: true },
      { key: 'ecart_valeur', label: 'Écart valeur', numeric: true },
      { key: 'statut', label: 'Statut' },
    ],
  },
  {
    type: 'journal_mouvements_stock',
    label: 'Journal des mouvements de stock',
    description: 'Toutes les entrées et sorties valorisées, avec origine et agent.',
    category: 'Stock',
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'produit', label: 'Produit' },
      { key: 'categorie', label: 'Catégorie' },
      { key: 'departement', label: 'Département' },
      { key: 'sens', label: 'Sens' },
      { key: 'origine', label: 'Origine' },
      { key: 'quantite', label: 'Quantité', numeric: true },
      { key: 'cout_unitaire', label: 'Coût unitaire', numeric: true },
      { key: 'valeur', label: 'Valeur', numeric: true },
      { key: 'reference', label: 'Référence' },
      { key: 'agent', label: 'Agent' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Utilitaires CSV
// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0');

const datePart = (date: Date) =>
  `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;

export function buildFilename(type: ExportType, start: Date, end: Date, ext: 'csv' | 'xlsx') {
  return `ZEROMATA_${type.toUpperCase()}_${datePart(start)}_${datePart(end)}.${ext}`;
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[";\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsv(dataset: ExportDataset, definition: ExportDefinition): string {
  const header = definition.columns.map((c) => csvEscape(c.label)).join(';');
  const lines = dataset.rows.map((row) =>
    definition.columns.map((c) => csvEscape(row[c.key])).join(';')
  );
  // BOM UTF-8 pour Excel (accents corrects) + séparateur ";" (locale FR)
  return `\uFEFF${[header, ...lines].join('\r\n')}`;
}

export function downloadCsv(dataset: ExportDataset, definition: ExportDefinition) {
  const csv = buildCsv(dataset, definition);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = buildFilename(definition.type, new Date(dataset.meta.date_debut), new Date(dataset.meta.date_fin), 'csv');
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return csv;
}

export async function sha256Hex(data: string | ArrayBuffer): Promise<string> {
  const buffer = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
