// Formater un montant en FCFA
export function formatMontant(montant: number): string {
  return `${montant.toLocaleString('fr-FR')} FCFA`;
}

// Formater une date
export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Formater une date et heure
export function formatDateTime(date: string): string {
  return new Date(date).toLocaleString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Formater un rôle
export function formatRole(role: string): string {
  const roles: Record<string, string> = {
    serveuse: 'Serveuse',
    comptoir: 'Comptoir',
    gerant: 'Gérant',
    patron: 'Patron',
  };
  return roles[role] || role;
}

// Formater un statut de commande
export function formatStatutCommande(statut: string): string {
  const statuts: Record<string, string> = {
    en_attente: 'En attente',
    validee: 'Validée',
    annulee: 'Annulée',
  };
  return statuts[statut] || statut;
}

// Formater un statut de facture
export function formatStatutFacture(statut: string): string {
  const statuts: Record<string, string> = {
    en_attente_paiement: 'En attente de paiement',
    partiellement_payee: 'Partiellement payée',
    payee: 'Payée',
  };
  return statuts[statut] || statut;
}

// Formater un mode de paiement
export function formatModePaiement(mode: string): string {
  const modes: Record<string, string> = {
    especes: 'Espèces',
    carte: 'Carte bancaire',
    mobile_money: 'Mobile Money',
    cheque: 'Chèque',
  };
  return modes[mode] || mode;
}

// Calculer l'ancienneté en jours
export function calculateAge(date: string): number {
  const now = new Date();
  const created = new Date(date);
  const diff = now.getTime() - created.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
