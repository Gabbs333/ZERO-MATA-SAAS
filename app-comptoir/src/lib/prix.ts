/**
 * Tarification dynamique côté client.
 *
 * Reproduit la logique de la fonction SQL `get_prix_produit()` afin que les
 * totaux affichés (nouvelle commande, échanges) correspondent exactement à ce
 * que le backend enregistre.
 *
 * Règles :
 *  - un tarif s'applique si actif et si la date/heure/jour courants matchent ;
 *  - les plages horaires qui passent minuit (ex. 22:00 → 02:00) sont gérées ;
 *  - en cas de plusieurs tarifs applicables, on garde la priorité la plus haute
 *    puis le plus récemment créé ;
 *  - sans tarif applicable, on retombe sur le prix de vente du produit.
 */

export interface Tarif {
  produit_id: string;
  prix_vente: number;
  actif: boolean;
  date_debut: string | null;
  date_fin: string | null;
  jours_semaine: number[] | null;
  heure_debut: string | null;
  heure_fin: string | null;
  priorite: number;
  date_creation: string;
}

export interface ProduitTarifiable {
  id: string;
  prix_vente: number;
}

export const hhmmToMinutes = (value: string | null): number | null => {
  if (!value) return null;
  const [h, m] = value.split(':').map(Number);
  if (Number.isNaN(h)) return null;
  return h * 60 + (m || 0);
};

export function computePrix(
  produit: ProduitTarifiable,
  tarifs: Tarif[],
  now: Date = new Date(),
): number {
  const dow = now.getDay(); // 0 = dimanche
  const minutes = now.getHours() * 60 + now.getMinutes();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const candidates = tarifs
    .filter((t) => t.produit_id === produit.id && t.actif)
    .filter((t) => {
      if (t.date_debut && t.date_fin) {
        const debut = t.date_debut.slice(0, 10);
        const fin = t.date_fin.slice(0, 10);
        if (dateStr < debut || dateStr > fin) return false;
      }
      if (t.jours_semaine && t.jours_semaine.length > 0) {
        if (!t.jours_semaine.includes(dow)) return false;
      }
      const start = hhmmToMinutes(t.heure_debut);
      const end = hhmmToMinutes(t.heure_fin);
      if (start !== null && end !== null) {
        if (start <= end) {
          if (minutes < start || minutes > end) return false;
        } else {
          if (!(minutes >= start || minutes <= end)) return false;
        }
      }
      return true;
    })
    .sort((a, b) => (b.priorite - a.priorite) || (b.date_creation > a.date_creation ? 1 : -1));

  return candidates.length > 0 ? candidates[0].prix_vente : produit.prix_vente;
}

/** Construit la table produit_id → prix courant pour une liste de produits. */
export function buildPrixMap(
  produits: ProduitTarifiable[] | null | undefined,
  tarifs: Tarif[] | null | undefined,
  now: Date = new Date(),
): Map<string, number> {
  const map = new Map<string, number>();
  for (const produit of produits || []) {
    map.set(produit.id, computePrix(produit, tarifs || [], now));
  }
  return map;
}
