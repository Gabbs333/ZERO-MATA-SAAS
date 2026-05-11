import { useState, useMemo, useCallback } from 'react';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';
import { formatMontant } from '../utils/format';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Users,
  UserPlus,
  Phone,
  Mail,
  Search,
  X,
  Plus,
  Edit,
  ChevronRight,
  ArrowLeft,
  Receipt,
  Clock,
  Wallet,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import type { Client } from '../types/database.types';

// ─── Types locaux ──────────────────────────────────────────────────────────

interface ClientWithStats extends Client {
  nombre_commandes?: number;
  chiffre_affaires_total?: number;
  solde_restant?: number;
  derniere_commande?: string;
  credit_active?: boolean;
  credit_limit?: number;
  depassement_credit?: boolean;
  jours_retard?: number;
}

interface ClientStatsRow {
  client_id: string;
  nombre_commandes: number;
  chiffre_affaires_total: number;
  solde_restant: number;
  derniere_commande: string | null;
}

interface NoteJournaliere {
  client_id: string;
  client_nom: string;
  date_note: string;
  nombre_commandes: number;
  total_commande: number;
  total_paye: number;
  solde_restant: number;
  lignes: NoteLigne[];
}

interface NoteLigne {
  commande_id: string;
  numero_commande: string;
  produit_id: string;
  nom_produit: string;
  quantite: number;
  prix_unitaire: number;
  montant_ligne: number;
}

type ViewMode = 'list' | 'detail';

// ─── Composant ─────────────────────────────────────────────────────────────

export function ClientsScreen() {
  const profile = useAuthStore((s) => s.profile);
  const etablissementId = profile?.etablissement_id;

  // ── View state ─────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedClient, setSelectedClient] = useState<ClientWithStats | null>(null);

  // ── Modal state ────────────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formNom, setFormNom] = useState('');
  const [formPrenom, setFormPrenom] = useState('');
  const [formTelephone, setFormTelephone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formCreditActive, setFormCreditActive] = useState(false);
  const [formCreditLimit, setFormCreditLimit] = useState(0);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // ── Search state ───────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');

  // ── Note journalière state ────────────────────────────────────────────
  const [noteJournaliere, setNoteJournaliere] = useState<NoteJournaliere | null>(null);
  const [isLoadingNote, setIsLoadingNote] = useState(false);
  const [noteError, setNoteError] = useState('');

  // ── Credit payment modal state ────────────────────────────────────────
  const [showCreditPaymentModal, setShowCreditPaymentModal] = useState(false);
  const [creditPaymentAmount, setCreditPaymentAmount] = useState('');
  const [creditPaymentMode, setCreditPaymentMode] = useState<'especes' | 'mobile_money' | 'carte_bancaire'>('especes');
  const [creditPaymentReference, setCreditPaymentReference] = useState('');
  const [creditPaymentNotes, setCreditPaymentNotes] = useState('');
  const [creditPaymentError, setCreditPaymentError] = useState('');
  const [isPayingCredit, setIsPayingCredit] = useState(false);

  // ── Credit history state ──────────────────────────────────────────────
  const [creditPayments, setCreditPayments] = useState<any[]>([]);
  const [creditHistoryLoading, setCreditHistoryLoading] = useState(false);
  const [creditHistoryError, setCreditHistoryError] = useState('');

  // ── Data: Clients ──────────────────────────────────────────────────────
  const {
    data: clients,
    isLoading: clientsLoading,
    refetch: refetchClients,
  } = useSupabaseQuery<Client[]>(
    ['clients', etablissementId],
    async () => {
      if (!etablissementId) return { data: [], error: null };
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('etablissement_id', etablissementId)
        .eq('actif', true)
        .order('nom', { ascending: true });
      return { data: data as Client[], error };
    },
    { enabled: !!etablissementId },
  );

  // ── Data: Client stats ─────────────────────────────────────────────────
  const { data: clientStats } = useSupabaseQuery<ClientStatsRow[]>(
    ['client_stats', etablissementId],
    async () => {
      if (!etablissementId) return { data: [], error: null };
      const { data, error } = await supabase
        .from('client_stats')
        .select('*')
        .eq('etablissement_id', etablissementId);
      return { data: data as ClientStatsRow[], error };
    },
    { enabled: !!etablissementId },
  );

  // ── Merge clients + stats ──────────────────────────────────────────────
  const mergedClients = useMemo<ClientWithStats[]>(() => {
    if (!clients) return [];
    const statsMap = new Map<string, ClientStatsRow>();
    if (clientStats) {
      for (const stat of clientStats) {
        statsMap.set(stat.client_id, stat);
      }
    }
    return clients.map((c) => {
      const stats = statsMap.get(c.id);
      return {
        ...c,
        nombre_commandes: stats?.nombre_commandes ?? 0,
        chiffre_affaires_total: stats?.chiffre_affaires_total ?? 0,
        solde_restant: stats?.solde_restant ?? 0,
        derniere_commande: stats?.derniere_commande ?? undefined,
      };
    });
  }, [clients, clientStats]);

  // ── Filtered clients ───────────────────────────────────────────────────
  const filteredClients = useMemo(() => {
    if (!mergedClients) return [];
    const term = searchTerm.toLowerCase().trim();
    if (!term) return mergedClients;
    return mergedClients.filter((c) => {
      const nom = c.nom?.toLowerCase() ?? '';
      const prenom = c.prenom?.toLowerCase() ?? '';
      const telephone = c.telephone?.toLowerCase() ?? '';
      const email = c.email?.toLowerCase() ?? '';
      return (
        nom.includes(term) ||
        prenom.includes(term) ||
        telephone.includes(term) ||
        email.includes(term)
      );
    });
  }, [mergedClients, searchTerm]);

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleOpenCreate = useCallback(() => {
    setEditingClient(null);
    setFormNom('');
    setFormPrenom('');
    setFormTelephone('');
    setFormEmail('');
    setFormNotes('');
    setFormCreditActive(false);
    setFormCreditLimit(0);
    setFormError('');
    setShowModal(true);
  }, []);

  const handleOpenEdit = useCallback(
    (client: ClientWithStats, e?: React.MouseEvent) => {
      e?.stopPropagation();
      setEditingClient(client);
      setFormNom(client.nom);
      setFormPrenom(client.prenom);
      setFormTelephone(client.telephone ?? '');
      setFormEmail(client.email ?? '');
      setFormNotes(client.notes ?? '');
      setFormCreditActive(client.credit_active ?? false);
      setFormCreditLimit(client.credit_limit ?? 0);
      setFormError('');
      setShowModal(true);
    },
    [],
  );

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setEditingClient(null);
    setFormError('');
    setFormCreditActive(false);
    setFormCreditLimit(0);
  }, []);

  const handleSaveClient = useCallback(async () => {
    const nom = formNom.trim();
    if (!nom) {
      setFormError('Le nom du client est requis.');
      return;
    }
    if (!etablissementId) {
      setFormError('Établissement introuvable.');
      return;
    }
    setIsSaving(true);
    setFormError('');

    try {
      const payload = {
        nom,
        prenom: formPrenom.trim() || null,
        telephone: formTelephone.trim() || null,
        email: formEmail.trim() || null,
        notes: formNotes.trim() || null,
        credit_active: formCreditActive,
        credit_limit: formCreditActive ? formCreditLimit : 0,
        etablissement_id: etablissementId,
      };

      if (editingClient) {
        // Update
        const { error } = await supabase
          .from('clients')
          .update({
            ...payload,
            date_modification: new Date().toISOString(),
          })
          .eq('id', editingClient.id);
        if (error) throw error;
      } else {
        // Create
        const { error } = await supabase.from('clients').insert({
          ...payload,
          actif: true,
          date_creation: new Date().toISOString(),
          date_modification: new Date().toISOString(),
        });
        if (error) throw error;
      }

      handleCloseModal();
      refetchClients();
    } catch (err: any) {
      console.error('Error saving client:', err);
      setFormError(err.message || 'Erreur lors de l\'enregistrement.');
    } finally {
      setIsSaving(false);
    }
  }, [
    formNom,
    formPrenom,
    formTelephone,
    formEmail,
    formNotes,
    formCreditActive,
    formCreditLimit,
    etablissementId,
    editingClient,
    handleCloseModal,
    refetchClients,
  ]);

  const handleSelectClient = useCallback((client: ClientWithStats) => {
    setSelectedClient(client);
    setNoteJournaliere(null);
    setNoteError('');
    setViewMode('detail');
  }, []);

  const handleBackToList = useCallback(() => {
    setViewMode('list');
    setSelectedClient(null);
    setNoteJournaliere(null);
    setNoteError('');
  }, []);

  const handleViewNoteJournaliere = useCallback(async () => {
    if (!selectedClient) return;
    setIsLoadingNote(true);
    setNoteError('');
    setNoteJournaliere(null);

    try {
      const { data, error } = await supabase.rpc('get_note_client', {
        p_client_id: selectedClient.id,
      });
      if (error) throw error;
      setNoteJournaliere(data as unknown as NoteJournaliere);
    } catch (err: any) {
      console.error('Error fetching note journaliere:', err);
      setNoteError(err.message || 'Erreur lors du chargement de la note.');
    } finally {
      setIsLoadingNote(false);
    }
  }, [selectedClient]);

  const handleSubmitCreditPayment = useCallback(async () => {
    if (!selectedClient) return;
    const amount = parseInt(creditPaymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setCreditPaymentError('Veuillez saisir un montant valide.');
      return;
    }
    setIsPayingCredit(true);
    setCreditPaymentError('');
    try {
      const { data, error } = await supabase.rpc('record_credit_payment', {
        p_client_id: selectedClient.id,
        p_montant: amount,
        p_mode_paiement: creditPaymentMode,
        p_reference: creditPaymentReference || null,
        p_notes: creditPaymentNotes || null,
      });
      if (error) throw error;
      setShowCreditPaymentModal(false);
      setCreditPaymentAmount('');
      setCreditPaymentReference('');
      setCreditPaymentNotes('');
      refetchClients();
      alert(`Paiement de ${formatMontant(amount)} enregistré. ${data?.factures_soldees || 0} facture(s) soldée(s).`);
    } catch (err: any) {
      setCreditPaymentError(err.message || 'Erreur lors du paiement.');
    } finally {
      setIsPayingCredit(false);
    }
  }, [selectedClient, creditPaymentAmount, creditPaymentMode, creditPaymentReference, creditPaymentNotes, refetchClients]);

  const handleLoadCreditHistory = useCallback(async () => {
    if (!selectedClient) return;
    setCreditHistoryLoading(true);
    setCreditHistoryError('');
    try {
      const { data, error } = await supabase
        .from('credit_payments')
        .select('*')
        .eq('client_id', selectedClient.id)
        .order('date_paiement', { ascending: false });
      if (error) throw error;
      setCreditPayments(data || []);
    } catch (err: any) {
      console.error('Error fetching credit history:', err);
      setCreditHistoryError(err.message || 'Erreur lors du chargement de l\'historique.');
    } finally {
      setCreditHistoryLoading(false);
    }
  }, [selectedClient]);

  // ── Render helpers ─────────────────────────────────────────────────────

  const renderModal = () => {
    if (!showModal) return null;
    const isEdit = !!editingClient;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        <div
          className="absolute inset-0"
          onClick={handleCloseModal}
        />

        {/* Dialog */}
        <div className="relative bg-white dark:bg-dark-card/90 dark:backdrop-blur-xl rounded-2xl w-full max-w-lg shadow-2xl border border-neutral-200 dark:border-white/5 overflow-hidden">
          {/* Header */}
          <div className="p-4 md:p-6 border-b border-neutral-100 dark:border-white/5 flex justify-between items-center">
            <h2 className="text-xl font-bold text-primary dark:text-white font-display">
              {isEdit ? 'Modifier le client' : 'Nouveau client'}
            </h2>
            <button
              onClick={handleCloseModal}
              className="p-1.5 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-neutral-400" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 md:p-6 space-y-5">
            {formError && (
              <div className="bg-semantic-red/10 border border-semantic-red/20 rounded-lg text-semantic-red text-sm p-3">
                {formError}
              </div>
            )}

            {/* Nom (required) */}
            <div>
              <label className="block text-sm font-bold text-primary dark:text-white mb-1.5">
                Nom <span className="text-semantic-red">*</span>
              </label>
              <input
                type="text"
                value={formNom}
                onChange={(e) => setFormNom(e.target.value)}
                placeholder="Nom du client"
                className="w-full px-4 py-2 bg-neutral-100 dark:bg-dark-card/40 border-none rounded-lg text-primary dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-dark-accent outline-none"
              />
            </div>

            {/* Prénom */}
            <div>
              <label className="block text-sm font-bold text-primary dark:text-white mb-1.5">
                Prénom
              </label>
              <input
                type="text"
                value={formPrenom}
                onChange={(e) => setFormPrenom(e.target.value)}
                placeholder="Prénom du client"
                className="w-full px-4 py-2 bg-neutral-100 dark:bg-dark-card/40 border-none rounded-lg text-primary dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-dark-accent outline-none"
              />
            </div>

            {/* Téléphone */}
            <div>
              <label className="block text-sm font-bold text-primary dark:text-white mb-1.5">
                Téléphone
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="tel"
                  value={formTelephone}
                  onChange={(e) => setFormTelephone(e.target.value)}
                  placeholder="+225 XX XX XX XX XX"
                  className="w-full pl-10 pr-4 py-2 bg-neutral-100 dark:bg-dark-card/40 border-none rounded-lg text-primary dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-dark-accent outline-none"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-bold text-primary dark:text-white mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="client@email.com"
                  className="w-full pl-10 pr-4 py-2 bg-neutral-100 dark:bg-dark-card/40 border-none rounded-lg text-primary dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-dark-accent outline-none"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-bold text-primary dark:text-white mb-1.5">
                Notes
              </label>
              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Notes ou remarques…"
                rows={3}
                className="w-full px-4 py-2 bg-neutral-100 dark:bg-dark-card/40 border-none rounded-lg text-primary dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-dark-accent outline-none resize-none"
              />
            </div>

            {/* Crédit toggle */}
            <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-primary dark:text-white">
                    Activer le crédit
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Autoriser les ventes à crédit pour ce client
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFormCreditActive(!formCreditActive)}
                className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
                  formCreditActive
                    ? 'bg-primary dark:bg-dark-accent'
                    : 'bg-neutral-300 dark:bg-neutral-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ${
                    formCreditActive ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>

            {/* Crédit limit */}
            {formCreditActive && (
              <div>
                <label className="block text-sm font-bold text-primary dark:text-white mb-1.5">
                  Plafond de crédit (XAF)
                </label>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                  0 = illimité
                </p>
                <div className="relative">
                  <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="number"
                    min={0}
                    value={formCreditLimit || ''}
                    onChange={(e) => setFormCreditLimit(Number(e.target.value))}
                    placeholder="Montant maximum du crédit"
                    className="w-full pl-10 pr-4 py-2 bg-neutral-100 dark:bg-dark-card/40 border-none rounded-lg text-primary dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-dark-accent outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 md:p-6 border-t border-neutral-100 dark:border-white/5">
            <div className="flex gap-3">
              <button
                onClick={handleCloseModal}
                className="flex-1 px-4 py-3 rounded-xl font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-dark-card/40 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveClient}
                disabled={isSaving || !formNom.trim()}
                className="flex-1 px-4 py-3 bg-primary dark:bg-dark-accent text-white rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {isEdit ? 'Modifier' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Render: Credit payment modal ─────────────────────────────────────

  const renderCreditPaymentModal = () => {
    if (!showCreditPaymentModal || !selectedClient) return null;
    const displayName = [selectedClient.prenom, selectedClient.nom].filter(Boolean).join(' ') || 'Client';

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        <div
          className="absolute inset-0"
          onClick={() => {
            setShowCreditPaymentModal(false);
            setCreditPaymentError('');
          }}
        />

        {/* Dialog */}
        <div className="relative bg-white dark:bg-dark-card/90 dark:backdrop-blur-xl rounded-2xl w-full max-w-lg shadow-2xl border border-neutral-200 dark:border-white/5 overflow-hidden">
          {/* Header */}
          <div className="p-4 md:p-6 border-b border-neutral-100 dark:border-white/5 flex justify-between items-center">
            <h2 className="text-xl font-bold text-primary dark:text-white font-display">
              Paiement crédit - {displayName}
            </h2>
            <button
              onClick={() => {
                setShowCreditPaymentModal(false);
                setCreditPaymentError('');
              }}
              className="p-1.5 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-neutral-400" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 md:p-6 space-y-5">
            {creditPaymentError && (
              <div className="bg-semantic-red/10 border border-semantic-red/20 rounded-lg text-semantic-red text-sm p-3">
                {creditPaymentError}
              </div>
            )}

            {/* Montant (required) */}
            <div>
              <label className="block text-sm font-bold text-primary dark:text-white mb-1.5">
                Montant <span className="text-semantic-red">*</span>
              </label>
              <div className="relative">
                <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="number"
                  min={1}
                  value={creditPaymentAmount}
                  onChange={(e) => setCreditPaymentAmount(e.target.value)}
                  placeholder="Montant en XAF"
                  className="w-full pl-10 pr-4 py-2 bg-neutral-100 dark:bg-dark-card/40 border-none rounded-lg text-primary dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-dark-accent outline-none"
                />
              </div>
            </div>

            {/* Mode de paiement */}
            <div>
              <label className="block text-sm font-bold text-primary dark:text-white mb-1.5">
                Mode de paiement
              </label>
              <select
                value={creditPaymentMode}
                onChange={(e) => setCreditPaymentMode(e.target.value as typeof creditPaymentMode)}
                className="px-3 py-1.5 bg-neutral-100 dark:bg-dark-card/40 border border-neutral-200 dark:border-white/10 rounded-lg text-sm font-bold text-primary dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-dark-accent outline-none w-full"
              >
                <option value="especes">Espèces</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="carte_bancaire">Carte bancaire</option>
              </select>
            </div>

            {/* Référence */}
            <div>
              <label className="block text-sm font-bold text-primary dark:text-white mb-1.5">
                Référence
              </label>
              <input
                type="text"
                value={creditPaymentReference}
                onChange={(e) => setCreditPaymentReference(e.target.value)}
                placeholder="N° de transaction, chèque..."
                className="w-full px-4 py-2 bg-neutral-100 dark:bg-dark-card/40 border-none rounded-lg text-primary dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-dark-accent outline-none"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-bold text-primary dark:text-white mb-1.5">
                Notes
              </label>
              <textarea
                value={creditPaymentNotes}
                onChange={(e) => setCreditPaymentNotes(e.target.value)}
                placeholder="Notes ou remarques…"
                rows={3}
                className="w-full px-4 py-2 bg-neutral-100 dark:bg-dark-card/40 border-none rounded-lg text-primary dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-dark-accent outline-none resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 md:p-6 border-t border-neutral-100 dark:border-white/5">
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCreditPaymentModal(false);
                  setCreditPaymentError('');
                }}
                className="flex-1 px-4 py-3 rounded-xl font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-dark-card/40 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmitCreditPayment}
                disabled={isPayingCredit || !creditPaymentAmount.trim()}
                className="flex-1 px-4 py-3 bg-primary dark:bg-dark-accent text-white rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isPayingCredit ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Render: Client detail ──────────────────────────────────────────────

  const renderDetail = () => {
    if (!selectedClient) return null;

    const client = mergedClients.find((c) => c.id === selectedClient.id) ?? selectedClient;
    const displayName = [client.prenom, client.nom].filter(Boolean).join(' ') || '—';

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Credit overrun warning */}
        {client.depassement_credit && (
          <div className="p-4 bg-semantic-red/10 border-2 border-semantic-red/20 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-semantic-red flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-semantic-red">
                ⚠️ Dépassement de crédit
              </p>
              <p className="text-sm text-semantic-red/80">
                Plafond: {formatMontant(client.credit_limit ?? 0)} — Dû: {formatMontant(client.solde_restant ?? 0)}
              </p>
            </div>
          </div>
        )}

        {/* Client info card */}
        <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 shadow-soft overflow-hidden group hover:border-primary/20 dark:hover:border-dark-accent/30 transition-all p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary dark:text-dark-accent flex-shrink-0">
                <Users className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-primary dark:text-white font-display">
                  {displayName}
                </h2>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  {client.telephone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" />
                      {client.telephone}
                    </span>
                  )}
                  {client.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" />
                      {client.email}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={(e) => handleOpenEdit(client, e)}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg transition-colors"
              title="Modifier le client"
            >
              <Edit className="w-5 h-5 text-neutral-400" />
            </button>
          </div>

          {client.notes && (
            <div className="mt-4 p-3 bg-neutral-50 dark:bg-white/5 rounded-lg">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">{client.notes}</p>
            </div>
          )}

          <div className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
            Client depuis le{' '}
            {format(new Date(client.date_creation), 'dd MMMM yyyy', { locale: fr })}
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-2xl border border-neutral-200 dark:border-white/5 shadow-soft p-4">
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
              Commandes
            </p>
            <p className="text-2xl font-bold text-primary dark:text-white">
              {client.nombre_commandes ?? 0}
            </p>
          </div>
          <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-2xl border border-neutral-200 dark:border-white/5 shadow-soft p-4">
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
              Chiffre d'affaires
            </p>
            <p className="text-2xl font-bold text-primary dark:text-dark-accent">
              {formatMontant(client.chiffre_affaires_total ?? 0)}
            </p>
          </div>
          <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-2xl border border-neutral-200 dark:border-white/5 shadow-soft p-4">
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
              Solde restant
            </p>
            <p
              className={`text-2xl font-bold ${
                (client.solde_restant ?? 0) > 0
                  ? 'text-semantic-red'
                  : 'text-green-600 dark:text-green-400'
              }`}
            >
              {formatMontant(client.solde_restant ?? 0)}
            </p>
          </div>
          <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-2xl border border-neutral-200 dark:border-white/5 shadow-soft p-4">
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
              Dernière commande
            </p>
            <p className="text-sm font-bold text-primary dark:text-white">
              {client.derniere_commande
                ? format(new Date(client.derniere_commande), 'dd/MM/yy', { locale: fr })
                : '—'}
            </p>
          </div>
        </div>

        {/* Note journalière */}
        <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 shadow-soft overflow-hidden group hover:border-primary/20 dark:hover:border-dark-accent/30 transition-all p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-primary dark:text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary dark:text-dark-accent" />
              Note du jour
              <span className="text-sm font-normal text-neutral-400 dark:text-neutral-500">
                {format(new Date(), 'dd MMMM yyyy', { locale: fr })}
              </span>
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setShowCreditPaymentModal(true);
                  setCreditPaymentAmount('');
                  setCreditPaymentReference('');
                  setCreditPaymentNotes('');
                  setCreditPaymentError('');
                }}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-2 ${
                  (client.solde_restant ?? 0) > 0
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-500/30'
                    : 'bg-primary/10 text-primary dark:bg-dark-accent/10 dark:text-dark-accent hover:bg-primary/20 dark:hover:bg-dark-accent/20'
                }`}
              >
                <Wallet className="w-4 h-4" />
                Paiement crédit
              </button>
              <button
                onClick={handleViewNoteJournaliere}
                disabled={isLoadingNote}
                className="px-4 py-2 bg-primary/10 text-primary dark:bg-dark-accent/10 dark:text-dark-accent rounded-lg text-sm font-bold hover:bg-primary/20 dark:hover:bg-dark-accent/20 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isLoadingNote ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                ) : (
                  <Receipt className="w-4 h-4" />
                )}
                Voir la note du jour
              </button>
            </div>
          </div>

          {noteError && (
            <div className="bg-semantic-red/10 border border-semantic-red/20 rounded-lg text-semantic-red text-sm p-3">
              {noteError}
            </div>
          )}

          {noteJournaliere ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <span className="text-neutral-500 dark:text-neutral-400">
                  Commandes aujourd'hui:{' '}
                  <span className="font-bold text-primary dark:text-white">
                    {noteJournaliere.nombre_commandes}
                  </span>
                </span>
                <span className="text-neutral-500 dark:text-neutral-400">
                  Total:{' '}
                  <span className="font-bold text-primary dark:text-white">
                    {formatMontant(noteJournaliere.total_commande)}
                  </span>
                </span>
                <span className="text-neutral-500 dark:text-neutral-400">
                  Payé:{' '}
                  <span className="font-bold text-green-600 dark:text-green-400">
                    {formatMontant(noteJournaliere.total_paye)}
                  </span>
                </span>
                <span className="text-neutral-500 dark:text-neutral-400">
                  Reste à payer:{' '}
                  <span
                    className={`font-bold ${
                      noteJournaliere.solde_restant > 0
                        ? 'text-semantic-red'
                        : 'text-green-600 dark:text-green-400'
                    }`}
                  >
                    {formatMontant(noteJournaliere.solde_restant)}
                  </span>
                </span>
              </div>

              {noteJournaliere.lignes.length > 0 && (
                <div className="border border-neutral-200 dark:border-white/5 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-50 dark:bg-white/5">
                      <tr>
                        <th className="text-left px-4 py-2.5 text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                          Produit
                        </th>
                        <th className="text-center px-4 py-2.5 text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                          Qté
                        </th>
                        <th className="text-right px-4 py-2.5 text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                          Prix unit.
                        </th>
                        <th className="text-right px-4 py-2.5 text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
                      {noteJournaliere.lignes.map((ligne, idx) => (
                        <tr key={`${ligne.commande_id}-${ligne.produit_id}-${idx}`}>
                          <td className="px-4 py-2.5 text-primary dark:text-white">
                            <div>{ligne.nom_produit}</div>
                            <div className="text-xs text-neutral-400 dark:text-neutral-500">{ligne.numero_commande}</div>
                          </td>
                          <td className="px-4 py-2.5 text-center text-neutral-500 dark:text-neutral-400">
                            {ligne.quantite}
                          </td>
                          <td className="px-4 py-2.5 text-right text-neutral-500 dark:text-neutral-400">
                            {formatMontant(ligne.prix_unitaire)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-primary dark:text-white">
                            {formatMontant(ligne.montant_ligne)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {noteJournaliere.lignes.length === 0 && (
                <p className="text-sm text-neutral-400 dark:text-neutral-500 text-center py-4">
                  Aucune ligne de commande aujourd'hui.
                </p>
              )}
            </div>
          ) : !noteError && (
            <p className="text-sm text-neutral-400 dark:text-neutral-500">
              Cliquez sur "Voir la note du jour" pour afficher la note consolidée des commandes
              d'aujourd'hui pour ce client.
            </p>
          )}
        </div>

        {/* Historique des paiements crédit */}
        <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 shadow-soft overflow-hidden group hover:border-primary/20 dark:hover:border-dark-accent/30 transition-all p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-primary dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary dark:text-dark-accent" />
              Historique des paiements crédit
            </h3>
            <button
              onClick={handleLoadCreditHistory}
              disabled={creditHistoryLoading}
              className="px-4 py-2 bg-primary/10 text-primary dark:bg-dark-accent/10 dark:text-dark-accent rounded-lg text-sm font-bold hover:bg-primary/20 dark:hover:bg-dark-accent/20 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {creditHistoryLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
              ) : (
                <Clock className="w-4 h-4" />
              )}
              Charger l'historique
            </button>
          </div>

          {creditHistoryError && (
            <div className="bg-semantic-red/10 border border-semantic-red/20 rounded-lg text-semantic-red text-sm p-3">
              {creditHistoryError}
            </div>
          )}

          {creditPayments.length > 0 ? (
            <div className="border border-neutral-200 dark:border-white/5 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 dark:bg-white/5">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="text-right px-4 py-2.5 text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                      Montant
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                      Mode
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                      Référence
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
                  {creditPayments.map((payment, idx) => (
                    <tr
                      key={payment.id}
                      className={idx % 2 === 0 ? 'bg-white dark:bg-transparent' : 'bg-neutral-50 dark:bg-white/5'}
                    >
                      <td className="px-4 py-2.5 text-primary dark:text-white">
                        {payment.date_paiement
                          ? format(new Date(payment.date_paiement), 'dd/MM/yyyy HH:mm', { locale: fr })
                          : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-green-600 dark:text-green-400">
                        {formatMontant(payment.montant ?? 0)}
                      </td>
                      <td className="px-4 py-2.5 text-neutral-500 dark:text-neutral-400 capitalize">
                        {(payment.mode_paiement || '').replace('_', ' ')}
                      </td>
                      <td className="px-4 py-2.5 text-neutral-400 dark:text-neutral-500">
                        {payment.reference || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : !creditHistoryError && (
            <p className="text-sm text-neutral-400 dark:text-neutral-500">
              Cliquez sur "Charger l'historique" pour afficher les paiements crédit de ce client.
            </p>
          )}
        </div>
      </div>
    );
  };

  // ── Render: Client list ────────────────────────────────────────────────

  const renderList = () => (
    <div className="space-y-6">
      {/* Search + Add */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Rechercher un client (nom, téléphone, email)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary dark:focus:border-dark-accent rounded-xl text-primary dark:text-white placeholder-neutral-400 focus:ring-4 focus:ring-primary/10 dark:focus:ring-dark-accent/10 transition-all outline-none"
          />
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary dark:bg-dark-accent text-white rounded-lg font-bold text-sm hover:opacity-90 transition-opacity flex-shrink-0"
        >
          <UserPlus className="w-5 h-5" />
          Nouveau client
        </button>
      </div>

      {/* Loading */}
      {clientsLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary dark:border-dark-accent" />
        </div>
      ) : filteredClients.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => {
            const displayName =
              [client.prenom, client.nom].filter(Boolean).join(' ') || 'Sans nom';
            const initials = (client.prenom?.[0] ?? '') + (client.nom?.[0] ?? 'C');

            return (
              <div
                key={client.id}
                onClick={() => handleSelectClient(client)}
                className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 shadow-soft overflow-hidden cursor-pointer group hover:border-primary/20 dark:hover:border-dark-accent/30 transition-all"
              >
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary dark:text-dark-accent flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {initials.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm text-primary dark:text-white truncate">
                        {displayName}
                      </h3>
                      <div className="flex flex-col gap-0.5 mt-0.5">
                        {client.telephone && (
                          <span className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1 truncate">
                            <Phone className="w-3 h-3 flex-shrink-0" />
                            {client.telephone}
                          </span>
                        )}
                        {client.email && (
                          <span className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1 truncate">
                            <Mail className="w-3 h-3 flex-shrink-0" />
                            {client.email}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleOpenEdit(client, e)}
                        className="p-1.5 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4 text-neutral-400" />
                      </button>
                      <ChevronRight className="w-5 h-5 text-neutral-300 dark:text-neutral-600 group-hover:text-neutral-400 dark:group-hover:text-neutral-500 transition-colors" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        Chiffre d'affaires
                      </p>
                      <p className="text-sm font-bold text-primary dark:text-white">
                        {formatMontant(client.chiffre_affaires_total ?? 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">Solde restant</p>
                      <p
                        className={`text-sm font-bold ${
                          (client.solde_restant ?? 0) > 0
                            ? 'text-semantic-red'
                            : 'text-green-600 dark:text-green-400'
                        }`}
                      >
                        {formatMontant(client.solde_restant ?? 0)}
                      </p>
                    </div>
                  </div>

                  {/* Credit badges */}
                  {(client.credit_active || (client.solde_restant ?? 0) > 0) && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {client.credit_active && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded-full text-xs font-medium">
                          <Wallet className="w-3 h-3" />
                          Crédit
                        </span>
                      )}
                      {(client.solde_restant ?? 0) > 0 && (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            client.depassement_credit
                              ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
                              : 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'
                          }`}
                        >
                          {formatMontant(client.solde_restant ?? 0)}
                        </span>
                      )}
                      {(client.nombre_commandes ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-neutral-100 dark:bg-white/10 text-neutral-600 dark:text-neutral-400 rounded-full text-xs font-medium">
                          {client.nombre_commandes} commande{(client.nombre_commandes ?? 0) > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-neutral-400 dark:text-neutral-500">
          <Users className="w-12 h-12 mb-2 opacity-50" />
          {searchTerm ? (
            <p>Aucun client ne correspond à votre recherche</p>
          ) : (
            <>
              <p>Aucun client enregistré</p>
              <button
                onClick={handleOpenCreate}
                className="mt-3 flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary dark:bg-dark-accent/10 dark:text-dark-accent rounded-lg text-sm font-bold hover:bg-primary/20 dark:hover:bg-dark-accent/20 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Ajouter un client
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );

  // ── Main render ─────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-dark-bg pb-20 md:pb-6">
      {/* Header */}
      <div className="p-4 md:p-6 bg-white dark:bg-dark-card/30 dark:backdrop-blur-xl border-b border-neutral-200 dark:border-white/5">
        <div className="flex items-center gap-4">
          {viewMode === 'detail' && (
            <button
              onClick={handleBackToList}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-neutral-500 dark:text-neutral-400" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-primary dark:text-white font-display">
              {viewMode === 'detail'
                ? [selectedClient?.prenom, selectedClient?.nom].filter(Boolean).join(' ') || 'Client'
                : 'Clients'}
            </h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">
              {viewMode === 'detail'
                ? 'Détail du client et note journalière'
                : `${filteredClients.length} client${filteredClients.length > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 md:p-6">
        {viewMode === 'detail' ? renderDetail() : renderList()}
      </div>

      {/* Modals */}
      {renderModal()}
      {renderCreditPaymentModal()}
    </div>
  );
}
