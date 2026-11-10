import { formatMontant } from '../utils/format';
import type { SynthesePeriode } from './pdfExport';

const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function dateFr(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${String(d.getDate()).padStart(2, '0')} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Ouvre WhatsApp (application ou web) avec un message pré-rempli. */
export function ouvrirWhatsApp({ texte, telephone }: { texte: string; telephone?: string }): void {
  const numero = (telephone ?? '').replace(/\D/g, '');
  const base = numero ? `https://wa.me/${numero}` : 'https://wa.me/';
  window.open(`${base}?text=${encodeURIComponent(texte)}`, '_blank', 'noopener,noreferrer');
}

/** Message de synthèse prêt à partager (formatage WhatsApp : *gras*). */
export function construireMessageSynthese(s: SynthesePeriode, lienPdf?: string | null): string {
  const lignes = [
    `*Synthèse de clôture — ${s.meta.etablissement_nom}*`,
    `Période : ${dateFr(s.meta.date_debut)} → ${dateFr(s.meta.date_fin)}`,
    '',
    `Chiffre d'affaires : ${formatMontant(s.ventes.chiffre_affaires)}`,
    `  • Bar : ${formatMontant(s.ventes.bar)}`,
    `  • Cuisine : ${formatMontant(s.ventes.cuisine)}`,
    `Encaissements : ${formatMontant(s.encaissements.total)}`,
    `  • Espèces : ${formatMontant(s.encaissements.especes)}`,
    `  • Mobile Money : ${formatMontant(s.encaissements.mobile_money)}`,
    `Reste à encaisser : ${formatMontant(s.credits.reste_a_encaisser)}`,
    `Ventes à crédit : ${formatMontant(s.credits.ventes_a_credit)}`,
    `Impayés (hors crédit) : ${formatMontant(s.credits.factures_impayees)}`,
    `Écart de caisse : ${formatMontant(s.caisse.ecart_total)}`,
    `Valeur du stock vendu : ${formatMontant(s.stock.valeur_vendue)}`,
  ];

  if (lienPdf) {
    lignes.push('', `PDF de la synthèse (lien valable 7 jours) : ${lienPdf}`);
  }

  return lignes.join('\n');
}
