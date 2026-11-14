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

/**
 * jsPDF et jspdf-autotable sont distribués à la fois en ESM (`module`) et en
 * CJS/UMD (`main`). Selon le résolveur (Vite côté navigateur, Rollup, esbuild,
 * Node), la classe/fonction se trouve sur `default`, `default.default` ou sur
 * un export nommé. On normalise ici : un seul point d'entrée pour tous les PDF.
 */
async function chargerOutilsPdf(): Promise<{ jsPDF: any; autoTable: any }> {
  const [jspdfModule, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const j: any = jspdfModule;
  const a: any = autoTableModule;

  const jsPDF = j?.default?.default ?? j?.default ?? j?.jsPDF;
  const autoTable = a?.default?.default ?? a?.default ?? a?.autoTable;

  if (typeof jsPDF !== 'function') {
    throw new Error('jsPDF introuvable : impossible de générer le PDF.');
  }
  if (typeof autoTable !== 'function') {
    throw new Error('jspdf-autotable introuvable : impossible de générer le PDF.');
  }

  return { jsPDF, autoTable };
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
  const { jsPDF, autoTable } = await chargerOutilsPdf();

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
      ['Dont remboursements (déjà déduits des encaissements)', montant((s.caisse as any).remboursements ?? 0), '-'],
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


// ---------------------------------------------------------------------------
// Rapports de passation de shift — PDF
// ---------------------------------------------------------------------------

export interface PassationSession {
  business_date: string;
  shift_nom: string;
  heure_debut: string;
  heure_fin: string;
  statut: 'ouverte' | 'fermee';
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
  entrees_hors_ventes: number;
  sorties_hors_ventes: number;
  solde_theorique: number;
  montant_compte: number | null;
  ecart: number | null;
  commentaire: string | null;
}

/** Totaux de `get_rapprochement_stock_session()` exploitables dans le PDF. */
export interface StockResume {
  qte_ouverture: number;
  valeur_ouverture: number;
  qte_entrees: number;
  valeur_entrees: number;
  qte_vendues: number;
  valeur_vendues: number;
  qte_sorties_autres: number;
  valeur_sorties_autres: number;
  qte_cloture: number;
  valeur_cloture: number;
  produits_mouvementes?: number;
}

export interface PassationMeta {
  etablissement_nom: string;
  devise: string;
  fuseau_horaire?: string;
  edite_par?: string;
}

export interface PassationJourItem {
  session: PassationSession;
  stock?: StockResume;
}

const MODES_LABELS: Record<string, string> = {
  especes: 'Espèces',
  mobile_money: 'Mobile Money',
  carte_bancaire: 'Carte bancaire',
  carte: 'Carte bancaire',
  cheque: 'Chèque',
  credit: 'Règlement de crédit',
};

function formatDateHeureFr(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return pdfText(value);
  return `${String(d.getDate()).padStart(2, '0')} ${MOIS[d.getMonth()]} ${d.getFullYear()} à ${String(
    d.getHours()
  ).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatJourExploitation(iso: string): string {
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return pdfText(iso);
  return `${String(d).padStart(2, '0')} ${MOIS[m - 1]} ${y}`;
}

const nomFichierShift = (nom: string) =>
  String(nom)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase();

export function buildPassationFilename(session: PassationSession, ext: 'pdf' = 'pdf'): string {
  const jour = String(session.business_date).replace(/-/g, '');
  return `ZEROMATA_PASSATION_${jour}_${nomFichierShift(session.shift_nom)}.${ext}`;
}

export function buildPassationsJourFilename(businessDate: string, ext: 'pdf' = 'pdf'): string {
  return `ZEROMATA_PASSATIONS_${String(businessDate).replace(/-/g, '')}.${ext}`;
}

/** Entête de page (document + établissement + période). */
function enteteDocument(
  doc: any,
  titre: string,
  sousTitre: string,
  meta: PassationMeta,
): number {
  const margin = 40;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(pdfText(titre), margin, 50);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(pdfText(meta.etablissement_nom), margin, 68);
  doc.text(pdfText(sousTitre), margin, 82);
  if (meta.edite_par) doc.text(pdfText(`Édité par ${meta.edite_par}`), margin, 96);
  doc.setTextColor(0);

  return meta.edite_par ? 116 : 102;
}

/** Pied de page paginé, appelé à la fin de la génération. */
function piedDePage(doc: any, meta: PassationMeta) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const total = doc.getNumberOfPages();

  for (let i = 1; i <= total; i += 1) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(
      pdfText(`ZERO-MATA - ${meta.etablissement_nom} - ${meta.devise} - Page ${i}/${total}`),
      margin,
      pageHeight - 24,
    );
    doc.text(pdfText('Document de passation'), pageWidth - margin, pageHeight - 24, { align: 'right' });
  }
}

/**
 * Dessine une section « session » (activité, encaissements, caisse, stock,
 * écart, commentaire) à partir de `startY` et renvoie la position finale.
 * Utilisé par le PDF d'une session et par le PDF groupé de la journée.
 */
function dessinerSession(
  doc: any,
  autoTable: any,
  session: PassationSession,
  stock: StockResume | undefined,
  startY: number,
  avecTitreSection: boolean,
): number {
  const margin = 40;
  const pageHeight = doc.internal.pageSize.getHeight();
  const montant = (v: number) => pdfText(formatMontant(Number(v) || 0));

  let y = startY;

  if (avecTitreSection) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(0);
    doc.text(
      pdfText(`${session.shift_nom} - ${formatJourExploitation(session.business_date)}`),
      margin,
      y,
    );
    y += 14;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(
    pdfText(
      `${session.heure_debut} - ${session.heure_fin} - ${
        session.statut === 'ouverte' ? 'session ouverte' : 'session fermée'
      }`,
    ),
    margin,
    y,
  );
  y += 12;
  doc.text(
    pdfText(`Ouverte le ${formatDateHeureFr(session.ouverte_le)} par ${session.ouverte_par}`),
    margin,
    y,
  );
  y += 11;
  doc.text(
    pdfText(
      session.fermee_le
        ? `Fermée le ${formatDateHeureFr(session.fermee_le)} par ${session.fermee_par}`
        : 'Session encore ouverte',
    ),
    margin,
    y,
  );
  y += 8;
  doc.setTextColor(0);

  // --- Activité
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [17, 17, 17], textColor: 255, fontStyle: 'bold' },
    head: [['Activité', 'Valeur']],
    body: [
      ["Chiffre d'affaires", montant(session.ventes)],
      ['dont bar', montant(session.ventes_bar)],
      ['dont cuisine', montant(session.ventes_cuisine)],
      ['Commandes validées', String(session.nombre_commandes)],
      ['Impayés de la session', montant(session.montant_impayes)],
    ],
  });
  y = ((doc as any).lastAutoTable?.finalY ?? y) + 14;

  // --- Encaissements par mode
  const modes = Object.entries(session.encaissements_par_mode || {});
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [60, 60, 60], textColor: 255, fontStyle: 'bold' },
    head: [['Mode de paiement', 'Montant']],
    body: modes.length
      ? [
          ...modes.map(([mode, valeur]) => [
            pdfText(MODES_LABELS[mode] || mode),
            montant(Number(valeur)),
          ]),
          ['Total encaissé', montant(session.encaissements)],
        ]
      : [['Aucun encaissement', montant(0)]],
  });
  y = ((doc as any).lastAutoTable?.finalY ?? y) + 14;

  // --- Caisse
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [60, 60, 60], textColor: 255, fontStyle: 'bold' },
    head: [['Caisse', 'Montant']],
    body: [
      ['Fond initial', montant(session.fond_initial)],
      ['Encaissements', montant(session.encaissements)],
      ['Entrées hors ventes', montant(session.entrees_hors_ventes)],
      ['Sorties hors ventes', `- ${montant(session.sorties_hors_ventes)}`],
      ['Solde théorique', montant(session.solde_theorique)],
      ['Montant compté', session.montant_compte === null ? '—' : montant(session.montant_compte)],
    ],
  });
  y = ((doc as any).lastAutoTable?.finalY ?? y) + 14;

  // --- Stock (rapprochement de la session)
  if (stock) {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: 'striped',
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [60, 60, 60], textColor: 255, fontStyle: 'bold' },
      head: [['Stock (mouvements du shift)', 'Quantité', 'Valeur']],
      body: [
        ['Stock à l’ouverture', String(stock.qte_ouverture), montant(stock.valeur_ouverture)],
        ['Entrées (ravitaillements, retours)', String(stock.qte_entrees), montant(stock.valeur_entrees)],
        ['Sorties ventes (coût des marchandises)', String(stock.qte_vendues), montant(stock.valeur_vendues)],
        ['Sorties hors ventes (pertes, échanges)', String(stock.qte_sorties_autres), montant(stock.valeur_sorties_autres)],
        ['Stock à la clôture (théorique)', String(stock.qte_cloture), montant(stock.valeur_cloture)],
      ],
      foot: [
        [
          stock.produits_mouvementes
            ? `Produits mouvementés : ${stock.produits_mouvementes}`
            : 'Aucun produit mouvementé sur ce shift',
          '',
          '',
        ],
      ],
      footStyles: { fillColor: [245, 245, 245], textColor: 60, fontStyle: 'normal', fontSize: 8 },
    });
    y = ((doc as any).lastAutoTable?.finalY ?? y) + 14;
  }

  // --- Écart (encadré) : passage à la page suivante si nécessaire
  if (y + 60 > pageHeight - 50) {
    doc.addPage();
    y = 50;
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setDrawColor(210);
  doc.setFillColor(244, 244, 245);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 34, 6, 6, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.text(
    pdfText(
      session.ecart === null
        ? 'Écart de caisse : session non clôturée'
        : `Écart de caisse : ${montant(session.ecart)}`,
    ),
    margin + 12,
    y + 22,
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    pdfText(session.statut === 'ouverte' ? 'Statut : ouverte' : 'Statut : fermée'),
    pageWidth - margin - 12,
    y + 22,
    { align: 'right' },
  );
  y += 40;

  // --- Commentaire
  if (session.commentaire && session.commentaire.trim()) {
    const lignes = doc.splitTextToSize(pdfText(session.commentaire.trim()), pageWidth - margin * 2);
    if (y + 14 + lignes.length * 11 > pageHeight - 40) {
      doc.addPage();
      y = 50;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Commentaire de passation', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(90);
    doc.text(lignes, margin, y + 14);
    doc.setTextColor(0);
    y += 14 + lignes.length * 11;
  }

  return y;
}

/** PDF de passation d'une session (optionnellement avec le rapprochement stock). */
export async function buildPassationPdf(
  session: PassationSession,
  meta: PassationMeta,
  stock?: StockResume,
): Promise<ArrayBuffer> {
  const { jsPDF, autoTable } = await chargerOutilsPdf();
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  const y = enteteDocument(
    doc,
    'Rapport de passation',
    `${session.shift_nom} (${session.heure_debut} - ${session.heure_fin}) - journée du ${formatJourExploitation(
      session.business_date,
    )}`,
    meta,
  );

  dessinerSession(doc, autoTable, session, stock, y, false);
  piedDePage(doc, meta);

  return doc.output('arraybuffer') as ArrayBuffer;
}

export async function downloadPassationPdf(
  session: PassationSession,
  meta: PassationMeta,
  stock?: StockResume,
): Promise<ArrayBuffer> {
  const bytes = await buildPassationPdf(session, meta, stock);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = buildPassationFilename(session);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return bytes;
}

/**
 * PDF groupé : récapitulatif de la journée d'exploitation puis une section
 * complète par session (caisse + stock). Une session par page.
 */
export async function buildPassationsJourPdf(
  items: PassationJourItem[],
  meta: PassationMeta,
): Promise<ArrayBuffer> {
  const { jsPDF, autoTable } = await chargerOutilsPdf();
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const montant = (v: number) => pdfText(formatMontant(Number(v) || 0));

  const businessDate = items[0]?.session.business_date || '';
  const totalVentes = items.reduce((a, i) => a + Number(i.session.ventes || 0), 0);
  const totalBar = items.reduce((a, i) => a + Number(i.session.ventes_bar || 0), 0);
  const totalCuisine = items.reduce((a, i) => a + Number(i.session.ventes_cuisine || 0), 0);
  const totalEncaisse = items.reduce((a, i) => a + Number(i.session.encaissements || 0), 0);
  const totalImpayes = items.reduce((a, i) => a + Number(i.session.montant_impayes || 0), 0);
  const totalEcart = items.reduce((a, i) => a + Number(i.session.ecart || 0), 0);
  const totalStockVendu = items.reduce((a, i) => a + Number(i.stock?.valeur_vendues || 0), 0);

  const y = enteteDocument(
    doc,
    'Passations de la journée',
    `${formatJourExploitation(businessDate)} - ${items.length} session(s)`,
    meta,
  );

  autoTable(doc, {
    startY: y,
    margin: { left: 40, right: 40 },
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [17, 17, 17], textColor: 255, fontStyle: 'bold' },
    head: [['Shift', 'Horaires', 'Statut', 'CA', 'Encaissé', 'Écart', 'Stock vendu']],
    body: items.map(({ session, stock }) => [
      pdfText(session.shift_nom),
      pdfText(`${session.heure_debut} - ${session.heure_fin}`),
      session.statut === 'ouverte' ? 'Ouverte' : 'Fermée',
      montant(session.ventes),
      montant(session.encaissements),
      session.ecart === null ? '—' : montant(session.ecart),
      stock ? montant(stock.valeur_vendues) : '—',
    ]),
    foot: [
      [
        'Total journée',
        '',
        '',
        montant(totalVentes),
        montant(totalEncaisse),
        montant(totalEcart),
        montant(totalStockVendu),
      ],
    ],
    footStyles: { fillColor: [245, 245, 245], textColor: 20, fontStyle: 'bold', fontSize: 8 },
  });

  // Synthèse financière et matière de la journée, sous le récapitulatif
  const afterRecap = (doc as any).lastAutoTable?.finalY ?? y;
  autoTable(doc, {
    startY: afterRecap + 20,
    margin: { left: 40, right: 40 },
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [60, 60, 60], textColor: 255, fontStyle: 'bold' },
    head: [['Synthèse de la journée', 'Montant']],
    body: [
      ['Chiffre d’affaires - bar', montant(totalBar)],
      ['Chiffre d’affaires - cuisine', montant(totalCuisine)],
      ['Chiffre d’affaires total', montant(totalVentes)],
      ['Encaissements', montant(totalEncaisse)],
      ['Impayés', montant(totalImpayes)],
      ['Écart de caisse cumulé', montant(totalEcart)],
      ['Valeur du stock vendu (coût)', montant(totalStockVendu)],
      ['Marge brute (CA - coût du stock vendu)', montant(totalVentes - totalStockVendu)],
    ],
  });

  items.forEach(({ session, stock }) => {
    doc.addPage();
    dessinerSession(doc, autoTable, session, stock, 50, true);
  });

  piedDePage(doc, meta);
  return doc.output('arraybuffer') as ArrayBuffer;
}

export async function downloadPassationsJourPdf(
  items: PassationJourItem[],
  meta: PassationMeta,
): Promise<ArrayBuffer> {
  const bytes = await buildPassationsJourPdf(items, meta);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = buildPassationsJourFilename(items[0]?.session.business_date || 'jour');
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return bytes;
}
