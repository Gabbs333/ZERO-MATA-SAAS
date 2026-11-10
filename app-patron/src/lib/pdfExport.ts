import { formatMontant } from '../utils/format';

// ---------------------------------------------------------------------------
// Synthèse de période (clôture) — PDF
// ---------------------------------------------------------------------------

export interface SynthesePeriode {
  meta: {
    etablissement_nom: string;
    date_debut: string;
    date_fin: string;
    devise: string;
    taux_tva: number;
    prix_ttc: boolean;
    fuseau_horaire: string;
    genere_le: string;
    genere_par: string;
  };
  ventes: {
    chiffre_affaires: number;
    montant_initial: number;
    montant_paye: number;
    montant_restant: number;
    base_ht: number;
    tva: number;
    nb_factures: number;
    bar: number;
    cuisine: number;
    global: number;
  };
  encaissements: {
    total: number;
    ventes: number;
    reglements_credit: number;
    especes: number;
    mobile_money: number;
    carte_bancaire: number;
    cheque: number;
  };
  credits: {
    ventes_a_credit: number;
    factures_impayees: number;
    nb_factures_impayees: number;
    reste_a_encaisser: number;
  };
  caisse: {
    entrees_hors_ventes: number;
    sorties: number;
    solde_theorique: number;
    clotures: number;
    ecart_total: number;
  };
  retours: { montant: number; nb: number };
  echanges: {
    montant_retourne: number;
    montant_ajoute: number;
    difference: number;
    nb: number;
  };
  stock: { valeur_vendue: number };
}

const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/**
 * Les polices standard de jsPDF (Helvetica/WinAnsi) ne contiennent pas certains
 * caractères typographiques : l'espace fine insécable utilisée par
 * `toLocaleString('fr-FR')` s'affiche comme un « / ». On normalise les textes
 * avant de les envoyer au PDF.
 */
function pdfText(value: unknown): string {
  return String(value ?? '')
    .replace(/[\u202F\u00A0\u2009\u2007\u200A]/g, ' ')
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201F]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u2192/g, '->')
    .replace(/\u00B7/g, '-');
}

function formatDateFr(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return pdfText(value);
  return `${String(d.getDate()).padStart(2, '0')} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}

export function buildSyntheseFilename(meta: SynthesePeriode['meta'], ext: 'pdf'): string {
  const part = (value: string) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  };
  return `ZEROMATA_SYNTHESE_${part(meta.date_debut)}_${part(meta.date_fin)}.${ext}`;
}

/**
 * Génère le PDF de synthèse/clôture. Les librairies sont chargées à la demande
 * pour ne pas alourdir le bundle principal.
 */
export async function buildSynthesePdf(s: SynthesePeriode): Promise<ArrayBuffer> {
  const [{ default: jsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const autoTable = (autoTableModule as any).default ?? (autoTableModule as any).autoTable;

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  const montant = (v: number) => pdfText(formatMontant(v));
  const etablissement = pdfText(s.meta.etablissement_nom);
  const redacteur = pdfText(s.meta.genere_par);

  // --- En-tête -------------------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Synthèse de clôture', margin, 50);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(etablissement, margin, 68);
  doc.text(
    `Période du ${formatDateFr(s.meta.date_debut)} au ${formatDateFr(s.meta.date_fin)}`,
    margin,
    82,
  );
  doc.text(
    `Édité le ${formatDateFr(s.meta.genere_le)} par ${redacteur}`,
    margin,
    96,
  );
  doc.setTextColor(0);

  // --- Indicateurs clés ----------------------------------------------------
  autoTable(doc, {
    startY: 115,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [17, 17, 17], textColor: 255, fontStyle: 'bold' },
    head: [['Indicateur', 'Montant']],
    body: [
      ["Chiffre d'affaires (TTC)", montant(s.ventes.chiffre_affaires)],
      ['Base HT', montant(s.ventes.base_ht)],
      [`TVA (${s.meta.taux_tva} %)`, montant(s.ventes.tva)],
      ['Encaissements', montant(s.encaissements.total)],
      ['Reste à encaisser', montant(s.credits.reste_a_encaisser)],
      ['Ventes à crédit', montant(s.credits.ventes_a_credit)],
      ['Factures impayées', montant(s.credits.factures_impayees)],
      ['Valeur du stock vendu', montant(s.stock.valeur_vendue)],
      ['Écart de caisse cumulé', montant(s.caisse.ecart_total)],
    ],
  });

  // --- Répartition par département ----------------------------------------
  const afterFirst = (doc as any).lastAutoTable?.finalY ?? 300;
  autoTable(doc, {
    startY: afterFirst + 20,
    margin: { left: margin, right: margin },
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [60, 60, 60], textColor: 255, fontStyle: 'bold' },
    head: [['Département', "Chiffre d'affaires"]],
    body: [
      ['Bar', montant(s.ventes.bar)],
      ['Cuisine', montant(s.ventes.cuisine)],
      ['Non ventilé', montant(s.ventes.global)],
      ['Total', montant(s.ventes.chiffre_affaires)],
    ],
  });

  // --- Encaissements par mode ---------------------------------------------
  const afterSecond = (doc as any).lastAutoTable?.finalY ?? 420;
  autoTable(doc, {
    startY: afterSecond + 20,
    margin: { left: margin, right: margin },
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [60, 60, 60], textColor: 255, fontStyle: 'bold' },
    head: [['Mode de paiement', 'Montant']],
    body: [
      ['Espèces', montant(s.encaissements.especes)],
      ['Mobile Money', montant(s.encaissements.mobile_money)],
      ['Carte bancaire', montant(s.encaissements.carte_bancaire)],
      ['Chèque', montant(s.encaissements.cheque)],
      ['Règlements de crédit', montant(s.encaissements.reglements_credit)],
      ['Total encaissé', montant(s.encaissements.total)],
    ],
  });

  // --- Caisse, retours, échanges ------------------------------------------
  const afterThird = (doc as any).lastAutoTable?.finalY ?? 540;
  autoTable(doc, {
    startY: afterThird + 20,
    margin: { left: margin, right: margin },
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [60, 60, 60], textColor: 255, fontStyle: 'bold' },
    head: [['Mouvement', 'Montant', 'Nombre']],
    body: [
      ['Entrées de caisse hors ventes', montant(s.caisse.entrees_hors_ventes), '-'],
      ['Sorties de caisse', montant(s.caisse.sorties), '-'],
      ['Solde théorique de caisse', montant(s.caisse.solde_theorique), '-'],
      ['Clôtures de caisse', montant(s.caisse.ecart_total), String(s.caisse.clotures)],
      ['Retours', montant(s.retours.montant), String(s.retours.nb)],
      ['Échanges - montant retourné', montant(s.echanges.montant_retourne), String(s.echanges.nb)],
      ['Échanges - montant ajouté', montant(s.echanges.montant_ajoute), '-'],
      ['Échanges - différence', montant(s.echanges.difference), '-'],
    ],
  });

  // --- Pied de page --------------------------------------------------------
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(
      pdfText(`ZERO-MATA - ${s.meta.etablissement_nom} - ${s.meta.devise} - Page ${i}/${pageCount}`),
      margin,
      doc.internal.pageSize.getHeight() - 24,
    );
    doc.text(
      'Document de synthèse - ne se substitue pas aux journaux détaillés.',
      pageWidth - margin,
      doc.internal.pageSize.getHeight() - 24,
      { align: 'right' },
    );
  }

  return doc.output('arraybuffer') as ArrayBuffer;
}

export async function downloadSynthesePdf(s: SynthesePeriode): Promise<ArrayBuffer> {
  const bytes = await buildSynthesePdf(s);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = buildSyntheseFilename(s.meta, 'pdf');
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return bytes;
}
