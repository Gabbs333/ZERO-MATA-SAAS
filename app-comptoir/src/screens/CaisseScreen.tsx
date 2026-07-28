import { useState } from 'react';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';
import { formatPrice } from '../lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Plus, Minus, Wallet, ArrowUpCircle, ArrowDownCircle,
  Calendar, Clock, Search, DollarSign, CreditCard,
  Banknote, Smartphone, Receipt, TrendingUp, TrendingDown
} from 'lucide-react';

interface MouvementCaisse {
  id: string;
  type: 'entree' | 'sortie';
  montant: number;
  motif: string;
  mode_paiement: string;
  commentaire: string | null;
  utilisateur_id: string;
  date_creation: string;
  profiles?: { nom: string; prenom: string };
}

interface SoldeCaisse {
  date: string;
  entrees_caisse: number;
  sorties_caisse: number;
  encaissements_ventes: number;
  solde_theorique: number;
}

const MOTIFS_PREDEFINIS = {
  entree: [
    'Fond de caisse initial',
    'Apport personnel',
    'Remboursement fournisseur',
    'Avance client',
    'Autre entrée'
  ],
  sortie: [
    'Dépense diverse',
    'Achat fournitures',
    'Retrait personnel',
    'Remboursement client',
    'Paiement fournisseur',
    'Autre sortie'
  ]
};

export function CaisseScreen() {
  const { profile } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [typeMouvement, setTypeMouvement] = useState<'entree' | 'sortie'>('entree');
  const [montant, setMontant] = useState('');
  const [motif, setMotif] = useState('');
  const [motifCustom, setMotifCustom] = useState('');
  const [modePaiement, setModePaiement] = useState('especes');
  const [commentaire, setCommentaire] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch solde
  const { data: solde, refetch: refetchSolde } = useSupabaseQuery<SoldeCaisse>(
    ['solde_caisse', selectedDate, profile?.etablissement_id],
    async () => {
      if (!profile?.etablissement_id) return { data: null, error: null };
      const { data, error } = await supabase.rpc('get_solde_caisse', {
        p_date: selectedDate
      });
      return { data: data as unknown as SoldeCaisse, error };
    },
    { enabled: !!profile?.etablissement_id }
  );

  // Fetch mouvements
  const { data: mouvements, refetch: refetchMouvements } = useSupabaseQuery<MouvementCaisse[]>(
    ['mouvements_caisse', selectedDate, profile?.etablissement_id],
    async () => {
      if (!profile?.etablissement_id) return { data: [], error: null };
      const startDate = `${selectedDate}T00:00:00`;
      const endDate = `${selectedDate}T23:59:59`;

      const { data, error } = await supabase
        .from('mouvements_caisse')
        .select('*, profiles!utilisateur_id (nom, prenom)')
        .eq('etablissement_id', profile.etablissement_id)
        .gte('date_creation', startDate)
        .lte('date_creation', endDate)
        .order('date_creation', { ascending: false });

      return { data: data as unknown as MouvementCaisse[], error };
    },
    { enabled: !!profile?.etablissement_id }
  );

  const totalEntrees = mouvements?.reduce((sum, m) => sum + (m.type === 'entree' ? m.montant : 0), 0) || 0;
  const totalSorties = mouvements?.reduce((sum, m) => sum + (m.type === 'sortie' ? m.montant : 0), 0) || 0;

  const handleSubmit = async () => {
    if (!montant || !motif) return;
    setIsSubmitting(true);
    try {
      const montantNum = parseInt(montant);
      if (isNaN(montantNum) || montantNum <= 0) throw new Error('Montant invalide');

      const motifFinal = motif === 'Autre entrée' || motif === 'Autre sortie' ? motifCustom : motif;

      const { error } = await supabase.rpc('creer_mouvement_caisse', {
        p_type: typeMouvement,
        p_montant: montantNum,
        p_motif: motifFinal,
        p_mode_paiement: modePaiement,
        p_commentaire: commentaire || null
      });

      if (error) throw error;

      setSuccessMsg(`${typeMouvement === 'entree' ? 'Entrée' : 'Sortie'} de ${formatPrice(montantNum)} enregistrée avec succès !`);
      setMontant('');
      setMotif('');
      setMotifCustom('');
      setCommentaire('');
      setShowForm(false);

      refetchMouvements();
      refetchSolde();

      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error: any) {
      alert(error.message || 'Erreur');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'especes': return <Banknote className="w-3.5 h-3.5" />;
      case 'mobile_money': return <Smartphone className="w-3.5 h-3.5" />;
      case 'carte_bancaire': return <CreditCard className="w-3.5 h-3.5" />;
      case 'cheque': return <Receipt className="w-3.5 h-3.5" />;
      default: return <DollarSign className="w-3.5 h-3.5" />;
    }
  };

  const motifsActuels = typeMouvement === 'entree' ? MOTIFS_PREDEFINIS.entree : MOTIFS_PREDEFINIS.sortie;

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark pb-20 md:pb-6">
      {/* Header */}
      <div className="p-4 md:p-6 bg-white/80 dark:bg-neutral-900/60 backdrop-blur-xl border-b border-neutral-200/50 dark:border-white/5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white font-display">Caisse</h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">Gestion des mouvements de caisse</p>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setTypeMouvement('entree'); setMotif(''); }}
            className="px-4 py-2.5 bg-primary dark:bg-dark-accent text-white rounded-xl font-bold text-sm hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nouveau mouvement
          </button>
        </div>

        {/* Sélecteur de date */}
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-neutral-400" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary rounded-xl text-neutral-900 dark:text-white outline-none"
          />
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {selectedDate === format(new Date(), 'yyyy-MM-dd') ? "Aujourd'hui" : format(new Date(selectedDate + 'T12:00:00'), 'dd MMM yyyy', { locale: fr })}
          </span>
        </div>
      </div>

      <div className="p-4 md:p-6">
        {/* Success message */}
        {successMsg && (
          <div className="mb-4 bg-green-100 dark:bg-green-500/20 border border-green-200 dark:border-green-500/30 rounded-xl p-4 text-green-700 dark:text-green-300 font-medium text-sm">
            {successMsg}
          </div>
        )}

        {/* Solde Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-neutral-800/40 backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-green-100 dark:bg-green-500/20 rounded-full p-1.5">
                <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">Entrées caisse</span>
            </div>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatPrice(solde?.entrees_caisse || 0)}</p>
          </div>

          <div className="bg-white dark:bg-neutral-800/40 backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-semantic-red/10 rounded-full p-1.5">
                <TrendingDown className="w-4 h-4 text-semantic-red" />
              </div>
              <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">Sorties caisse</span>
            </div>
            <p className="text-2xl font-bold text-semantic-red">{formatPrice(solde?.sorties_caisse || 0)}</p>
          </div>

          <div className="bg-white dark:bg-neutral-800/40 backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-primary/10 rounded-full p-1.5">
                <Wallet className="w-4 h-4 text-primary" />
              </div>
              <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">Solde théorique</span>
            </div>
            <p className={`text-2xl font-bold ${(solde?.solde_theorique || 0) >= 0 ? 'text-neutral-900 dark:text-white' : 'text-semantic-red'}`}>
              {formatPrice(solde?.solde_theorique || 0)}
            </p>
          </div>
        </div>

        {/* Formulaire nouveau mouvement */}
        {showForm && (
          <div className="bg-white dark:bg-neutral-800/40 backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 p-6 mb-6">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-4">Nouveau mouvement</h3>

            {/* Type */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => { setTypeMouvement('entree'); setMotif(''); }}
                className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                  typeMouvement === 'entree'
                    ? 'bg-green-600 text-white'
                    : 'bg-neutral-100 dark:bg-white/5 text-neutral-500'
                }`}
              >
                <ArrowUpCircle className="w-4 h-4" /> Entrée
              </button>
              <button
                onClick={() => { setTypeMouvement('sortie'); setMotif(''); }}
                className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                  typeMouvement === 'sortie'
                    ? 'bg-semantic-red text-white'
                    : 'bg-neutral-100 dark:bg-white/5 text-neutral-500'
                }`}
              >
                <ArrowDownCircle className="w-4 h-4" /> Sortie
              </button>
            </div>

            {/* Montant */}
            <div className="mb-4">
              <label className="block text-sm font-bold text-neutral-900 dark:text-white mb-1.5">Montant (FCFA)</label>
              <input
                type="number"
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                placeholder="0"
                className="w-full px-4 py-3 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary rounded-xl text-neutral-900 dark:text-white text-lg font-bold outline-none"
              />
            </div>

            {/* Mode de paiement */}
            <div className="mb-4">
              <label className="block text-sm font-bold text-neutral-900 dark:text-white mb-1.5">Mode</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'especes', label: 'Espèces', icon: Banknote },
                  { value: 'mobile_money', label: 'Mobile', icon: Smartphone },
                  { value: 'carte_bancaire', label: 'Carte', icon: CreditCard },
                ].map(mode => (
                  <button
                    key={mode.value}
                    onClick={() => setModePaiement(mode.value)}
                    className={`py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                      modePaiement === mode.value
                        ? 'bg-primary text-white'
                        : 'bg-neutral-100 dark:bg-white/5 text-neutral-500'
                    }`}
                  >
                    <mode.icon className="w-3.5 h-3.5" />
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Motif */}
            <div className="mb-4">
              <label className="block text-sm font-bold text-neutral-900 dark:text-white mb-1.5">Motif</label>
              <div className="grid grid-cols-2 gap-2">
                {motifsActuels.map(m => (
                  <button
                    key={m}
                    onClick={() => setMotif(m)}
                    className={`py-2 px-3 rounded-xl font-medium text-xs transition-all text-left ${
                      motif === m
                        ? 'bg-primary/10 text-primary border border-primary/30'
                        : 'bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-400 border border-transparent'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              {(motif === 'Autre entrée' || motif === 'Autre sortie') && (
                <input
                  type="text"
                  value={motifCustom}
                  onChange={(e) => setMotifCustom(e.target.value)}
                  placeholder="Précisez le motif..."
                  className="w-full mt-2 px-3 py-2 bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg text-sm outline-none"
                />
              )}
            </div>

            {/* Commentaire */}
            <div className="mb-4">
              <label className="block text-sm font-bold text-neutral-900 dark:text-white mb-1.5">Commentaire (optionnel)</label>
              <textarea
                value={commentaire}
                onChange={(e) => setCommentaire(e.target.value)}
                placeholder="Détails supplémentaires..."
                className="w-full px-3 py-2 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary rounded-xl text-neutral-900 dark:text-white placeholder-neutral-400 outline-none resize-none"
                rows={2}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-3 bg-neutral-100 dark:bg-white/5 text-neutral-500 rounded-xl font-bold text-sm"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !montant || !motif}
                className={`flex-1 py-3 text-white rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2 ${
                  typeMouvement === 'entree' ? 'bg-green-600' : 'bg-semantic-red'
                }`}
              >
                {isSubmitting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Enregistrer
              </button>
            </div>
          </div>
        )}

        {/* Liste des mouvements */}
        <div className="bg-white dark:bg-neutral-800/40 backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 overflow-hidden">
          <div className="p-4 border-b border-neutral-200 dark:border-white/5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-neutral-900 dark:text-white">Mouvements du jour</h3>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-green-600 font-bold">+{formatPrice(totalEntrees)}</span>
                <span className="text-semantic-red font-bold">−{formatPrice(totalSorties)}</span>
              </div>
            </div>
          </div>

          <div className="divide-y divide-neutral-200 dark:divide-white/5 max-h-[50vh] overflow-y-auto">
            {mouvements?.map(m => (
              <div key={m.id} className="p-4 flex items-center gap-4 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors">
                <div className={`rounded-full p-2 ${
                  m.type === 'entree' ? 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-semantic-red/10 text-semantic-red'
                }`}>
                  {m.type === 'entree' ? <ArrowUpCircle className="w-4 h-4" /> : <ArrowDownCircle className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm text-neutral-900 dark:text-white">{m.motif}</p>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-neutral-100 dark:bg-white/10 rounded text-xs text-neutral-500">
                      {getModeIcon(m.mode_paiement)}
                      {m.mode_paiement}
                    </span>
                  </div>
                  {m.commentaire && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">{m.commentaire}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="w-3 h-3 text-neutral-400" />
                    <span className="text-xs text-neutral-400">
                      {format(new Date(m.date_creation), 'HH:mm', { locale: fr })} • {m.profiles?.prenom} {m.profiles?.nom}
                    </span>
                  </div>
                </div>
                <span className={`font-bold text-sm whitespace-nowrap ${
                  m.type === 'entree' ? 'text-green-600' : 'text-semantic-red'
                }`}>
                  {m.type === 'entree' ? '+' : '−'}{formatPrice(m.montant)}
                </span>
              </div>
            ))}

            {(!mouvements || mouvements.length === 0) && (
              <div className="text-center py-12 text-neutral-400">
                <Wallet className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucun mouvement pour cette date</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
