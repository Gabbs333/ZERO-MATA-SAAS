import { useState, useMemo, useCallback } from 'react';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';
import { formatPrice } from '../lib/utils';
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

  // ── Render helpers ─────────────────────────────────────────────────────

  const renderModal = () => {
    if (!showModal) return null;
    const isEdit = !!editingClient;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={handleCloseModal}
        />

        {/* Dialog */}
        <div className="relative bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-white/10 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-neutral-200 dark:border-white/10">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
              {isEdit ? 'Modifier le client' : 'Nouveau client'}
            </h2>
            <button
              onClick={handleCloseModal}
              className="p-1.5 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-neutral-500" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            {formError && (
              <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg text-sm text-red-700 dark:text-red-400">
                {formError}
              </div>
            )}

            {/* Nom (required) */}
            <div>
              <label className="block text-sm font-bold text-neutral-900 dark:text-white mb-1.5">
                Nom <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formNom}
                onChange={(e) => setFormNom(e.target.value)}
                placeholder="Nom du client"
                className="w-full px-4 py-2.5 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary dark:focus:border-dark-accent rounded-xl text-neutral-900 dark:text-white placeholder-neutral-400 focus:ring-4 focus:ring-primary/10 dark:focus:ring-dark-accent/10 transition-all outline-none"
              />
            </div>

            {/* Prénom */}
            <div>
              <label className="block text-sm font-bold text-neutral-900 dark:text-white mb-1.5">
                Prénom
              </label>
              <input
                type="text"
                value={formPrenom}
                onChange={(e) => setFormPrenom(e.target.value)}
                placeholder="Prénom du client"
                className="w-full px-4 py-2.5 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary dark:focus:border-dark-accent rounded-xl text-neutral-900 dark:text-white placeholder-neutral-400 focus:ring-4 focus:ring-primary/10 dark:focus:ring-dark-accent/10 transition-all outline-none"
              />
            </div>

            {/* Téléphone */}
            <div>
              <label className="block text-sm font-bold text-neutral-900 dark:text-white mb-1.5">
                Téléphone
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="tel"
                  value={formTelephone}
                  onChange={(e) => setFormTelephone(e.target.value)}
                  placeholder="+225 XX XX XX XX XX"
                  className="w-full pl-10 pr-4 py-2.5 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary dark:focus:border-dark-accent rounded-xl text-neutral-900 dark:text-white placeholder-neutral-400 focus:ring-4 focus:ring-primary/10 dark:focus:ring-dark-accent/10 transition-all outline-none"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-bold text-neutral-900 dark:text-white mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="client@email.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary dark:focus:border-dark-accent rounded-xl text-neutral-900 dark:text-white placeholder-neutral-400 focus:ring-4 focus:ring-primary/10 dark:focus:ring-dark-accent/10 transition-all outline-none"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-bold text-neutral-900 dark:text-white mb-1.5">
                Notes
              </label>
              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Notes ou remarques…"
                rows={3}
                className="w-full px-4 py-2.5 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary dark:focus:border-dark-accent rounded-xl text-neutral-900 dark:text-white placeholder-neutral-400 focus:ring-4 focus:ring-primary/10 dark:focus:ring-dark-accent/10 transition-all outline-none resize-none"
              />
            </div>

            {/* Crédit toggle */}
            <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-neutral-900 dark:text-white">
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
                <label className="block text-sm font-bold text-neutral-900 dark:text-white mb-1.5">
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
                    className="w-full pl-10 pr-4 py-2.5 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary dark:focus:border-dark-accent rounded-xl text-neutral-900 dark:text-white placeholder-neutral-400 focus:ring-4 focus:ring-primary/10 dark:focus:ring-dark-accent/10 transition-all outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 p-5 border-t border-neutral-200 dark:border-white/10">
            <button
              onClick={handleCloseModal}
              className="flex-1 py-2.5 px-4 bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-400 rounded-xl font-bold hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSaveClient}
              disabled={isSaving || !formNom.trim()}
              className="flex-1 py-2.5 px-4 bg-primary dark:bg-dark-accent text-white rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
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
    );
  };

  // ── Render: Client detail ──────────────────────────────────────────────

  const renderDetail = () => {
    if (!selectedClient) return null;

    const client = mergedClients.find((c) => c.id === selectedClient.id) ?? selectedClient;
    const displayName = [client.prenom, client.nom].filter(Boolean).join(' ') || '—';

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Client info card */}
        <div className="bg-white dark:bg-neutral-800/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary dark:text-dark-accent flex-shrink-0">
                <Users className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
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
              <Edit className="w-5 h-5 text-neutral-500" />
            </button>
          </div>

          {client.notes && (
            <div className="mt-4 p-3 bg-neutral-50 dark:bg-white/5 rounded-lg">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">{client.notes}</p>
            </div>
          )}

          <div className="mt-2 text-xs text-neutral-400">
            Client depuis le{' '}
            {format(new Date(client.date_creation), 'dd MMMM yyyy', { locale: fr })}
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-neutral-800/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 p-4">
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
              Commandes
            </p>
            <p className="text-2xl font-bold text-neutral-900 dark:text-white">
              {client.nombre_commandes ?? 0}
            </p>
          </div>
          <div className="bg-white dark:bg-neutral-800/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 p-4">
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
              Chiffre d'affaires
            </p>
            <p className="text-2xl font-bold text-primary dark:text-dark-accent">
              {formatPrice(client.chiffre_affaires_total ?? 0)}
            </p>
          </div>
          <div className="bg-white dark:bg-neutral-800/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 p-4">
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
              {formatPrice(client.solde_restant ?? 0)}
            </p>
          </div>
          <div className="bg-white dark:bg-neutral-800/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 p-4">
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
              Dernière commande
            </p>
            <p className="text-sm font-bold text-neutral-900 dark:text-white">
              {client.derniere_commande
                ? format(new Date(client.derniere_commande), 'dd/MM/yy', { locale: fr })
                : '—'}
            </p>
          </div>
        </div>

        {/* Note journalière */}
        <div className="bg-white dark:bg-neutral-800/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary dark:text-dark-accent" />
              Note du jour
              <span className="text-sm font-normal text-neutral-400">
                {format(new Date(), 'dd MMMM yyyy', { locale: fr })}
              </span>
            </h3>
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

          {noteError && (
            <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg text-sm text-red-700 dark:text-red-400">
              {noteError}
            </div>
          )}

          {noteJournaliere ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <span className="text-neutral-500 dark:text-neutral-400">
                  Commandes aujourd'hui:{' '}
                  <span className="font-bold text-neutral-900 dark:text-white">
                    {noteJournaliere.nombre_commandes}
                  </span>
                </span>
                <span className="text-neutral-500 dark:text-neutral-400">
                  Total:{' '}
                  <span className="font-bold text-neutral-900 dark:text-white">
                    {formatPrice(noteJournaliere.total_commande)}
                  </span>
                </span>
                <span className="text-neutral-500 dark:text-neutral-400">
                  Payé:{' '}
                  <span className="font-bold text-green-600 dark:text-green-400">
                    {formatPrice(noteJournaliere.total_paye)}
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
                    {formatPrice(noteJournaliere.solde_restant)}
                  </span>
                </span>
              </div>

              {noteJournaliere.lignes.length > 0 && (
                <div className="border border-neutral-200 dark:border-white/10 rounded-lg overflow-hidden">
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
                          <td className="px-4 py-2.5 text-neutral-900 dark:text-white">
                            <div>{ligne.nom_produit}</div>
                            <div className="text-xs text-neutral-400">{ligne.numero_commande}</div>
                          </td>
                          <td className="px-4 py-2.5 text-center text-neutral-700 dark:text-neutral-300">
                            {ligne.quantite}
                          </td>
                          <td className="px-4 py-2.5 text-right text-neutral-700 dark:text-neutral-300">
                            {formatPrice(ligne.prix_unitaire)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-neutral-900 dark:text-white">
                            {formatPrice(ligne.montant_ligne)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {noteJournaliere.lignes.length === 0 && (
                <p className="text-sm text-neutral-400 text-center py-4">
                  Aucune ligne de commande aujourd'hui.
                </p>
              )}
            </div>
          ) : !noteError && (
            <p className="text-sm text-neutral-400">
              Cliquez sur "Voir la note du jour" pour afficher la note consolidée des commandes
              d'aujourd'hui pour ce client.
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
            className="w-full pl-10 pr-4 py-2.5 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary dark:focus:border-dark-accent rounded-xl text-neutral-900 dark:text-white placeholder-neutral-400 focus:ring-4 focus:ring-primary/10 dark:focus:ring-dark-accent/10 transition-all outline-none"
          />
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary dark:bg-dark-accent text-white rounded-xl font-bold hover:opacity-90 transition-opacity flex-shrink-0"
        >
          <UserPlus className="w-5 h-5" />
          Nouveau client
        </button>
      </div>

      {/* Loading */}
      {clientsLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary dark:border-white" />
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
                className="bg-white dark:bg-neutral-800/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 shadow-soft overflow-hidden cursor-pointer transition-all hover:border-neutral-300 dark:hover:border-white/10 hover:shadow-md group"
              >
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary dark:text-dark-accent flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {initials.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm text-neutral-900 dark:text-white truncate">
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
                      <ChevronRight className="w-5 h-5 text-neutral-300 dark:text-neutral-600 group-hover:text-neutral-500 transition-colors" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        Chiffre d'affaires
                      </p>
                      <p className="text-sm font-bold text-neutral-900 dark:text-white">
                        {formatPrice(client.chiffre_affaires_total ?? 0)}
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
                        {formatPrice(client.solde_restant ?? 0)}
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
                          {formatPrice(client.solde_restant ?? 0)}
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
        <div className="flex flex-col items-center justify-center py-12 text-neutral-400 dark:text-neutral-500">
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
    <div className="min-h-screen bg-background-light dark:bg-background-dark pb-20 md:pb-6">
      {/* Header */}
      <div className="p-4 md:p-6 bg-white/80 dark:bg-neutral-900/60 backdrop-blur-xl border-b border-neutral-200/50 dark:border-white/5">
        <div className="flex items-center gap-4">
          {viewMode === 'detail' && (
            <button
              onClick={handleBackToList}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white font-display">
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

      {/* Modal */}
      {renderModal()}
    </div>
  );
}
