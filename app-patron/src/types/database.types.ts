// Types de base de données Supabase

export interface Etablissement {
  id: string;
  nom: string;
  adresse: string | null;
  telephone: string | null;
  email: string | null;
  statut_abonnement: 'actif' | 'expire' | 'suspendu';
  date_debut: string;
  date_fin: string;
  actif: boolean;
  dernier_paiement_date: string | null;
  dernier_paiement_confirme_par: string | null;
  date_creation: string;
  date_modification: string;
}

export interface Profile {
  id: string;
  role: 'serveuse' | 'comptoir' | 'gerant' | 'patron' | 'admin' | 'comptable';
  nom: string;
  prenom: string;
  etablissement_id: string | null; // NULL for admin users
  actif: boolean;
  date_creation: string;
  etablissement?: Etablissement;
}

export interface Table {
  id: string;
  numero: number;
  capacite: number;
  statut: 'libre' | 'occupee' | 'commande_en_attente';
  etablissement_id: string;
}

export interface Produit {
  id: string;
  nom: string;
  categorie: 'boisson' | 'nourriture' | 'autre';
  prix_vente: number;
  prix_achat?: number;
  actif: boolean;
  etablissement_id: string;
  date_creation: string;
  date_modification?: string;
}

export interface Stock {
  id: string;
  produit_id: string;
  quantite_actuelle: number;
  seuil_alerte: number;
  etablissement_id: string;
  produits?: Produit;
}

export interface Commande {
  id: string;
  numero_commande: string;
  table_id: string;
  serveuse_id: string;
  statut: 'en_attente' | 'validee' | 'annulee';
  montant_total: number;
  etablissement_id: string;
  date_creation: string;
  date_validation?: string;
}

export interface CommandeItem {
  id: string;
  commande_id: string;
  produit_id: string;
  nom_produit: string;
  quantite: number;
  prix_unitaire: number;
  etablissement_id: string;
}

export interface Facture {
  id: string;
  numero_facture: string;
  commande_id: string;
  montant_total: number;
  statut: 'en_attente_paiement' | 'partiellement_payee' | 'payee';
  montant_paye: number;
  etablissement_id: string;
  date_generation: string;
}

export interface Encaissement {
  id: string;
  facture_id: string;
  montant: number;
  mode_paiement: 'especes' | 'carte' | 'mobile_money' | 'cheque';
  reference?: string;
  etablissement_id: string;
  date_encaissement: string;
  utilisateur_id: string;
}

export interface MouvementStock {
  id: string;
  produit_id: string;
  quantite: number;
  type: 'entree' | 'sortie';
  type_reference: 'commande' | 'ravitaillement' | 'ajustement';
  reference?: string;
  etablissement_id: string;
  date_creation: string;
  produits?: Produit;
}

export interface Ravitaillement {
  id: string;
  numero_ravitaillement: string;
  fournisseur: string;
  montant_total: number;
  etablissement_id: string;
  date_ravitaillement: string;
  gerant_id: string;
  date_creation: string;
}

export interface RavitaillementItem {
  id: string;
  ravitaillement_id: string;
  produit_id: string;
  nom_produit: string;
  quantite: number;
  prix_unitaire: number;
  etablissement_id: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  table_name: string;
  record_id?: string;
  details?: any;
  etablissement_id: string | null;
  date_action: string;
  profiles?: Profile;
}

// Types pour les requêtes avec relations
export interface CommandeWithDetails extends Commande {
  commande_items: CommandeItem[];
  tables: Table;
  profiles: Profile;
}

export interface FactureWithDetails extends Facture {
  commandes: Commande;
  encaissements: Encaissement[];
}

export interface StockWithProduit extends Stock {
  produits: Produit;
}

export interface RavitaillementWithDetails extends Ravitaillement {
  ravitaillement_items: RavitaillementItem[];
  profiles: Profile;
}

// Types pour les analytics
export interface KPIs {
  ca_total: number;
  encaissements_total: number;
  creances: number;
  benefice: number;
  nombre_commandes: number;
  panier_moyen: number;
}

export interface AnalyticsCAEncaissements {
  periode: string;
  ca: number;
  encaissements: number;
  creances: number;
}

export interface VentesProduit {
  produit_id: string;
  nom_produit: string;
  quantite_vendue: number;
  ca_produit: number;
}

export interface EncaissementsByMode {
  mode_paiement: string;
  montant_total: number;
  nombre_transactions: number;
}
