import { useState } from 'react';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';
import { formatMontant } from '../utils/format';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Wallet, Calendar, ArrowUpCircle, ArrowDownCircle,
  TrendingUp, TrendingDown, Banknote, Smartphone,
  CreditCard, Receipt, Clock, DollarSign
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

export function CaisseScreen() {
  const profile = useAuthStore((state) => state.profile);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Fetch solde
  const { data: solde } = useSupabaseQuery<SoldeCaisse>(
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
  const { data: mouvements } = useSupabaseQuery<MouvementCaisse[]>(
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

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'especes': return <Banknote className="w-3.5 h-3.5" />;
      case 'mobile_money': return <Smartphone className="w-3.5 h-3.5" />;
      case 'carte_bancaire': return <CreditCard className="w-3.5 h-3.5" />;
      case 'cheque': return <Receipt className="w-3.5 h-3.5" />;
      default: return <DollarSign className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-dark-bg pb-20 md:pb-6">
      {/* Header */}
      <div className="p-4 md:p-6 bg-white dark:bg-dark-card/30 dark:backdrop-blur-xl border-b border-neutral-200 dark:border-white/5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-primary dark:text-white font-display">Suivi de Caisse</h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">
              Consultation et rapprochement des mouvements
            </p>
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
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6">
        {/* Solde Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="text-xs font-bold text-neutral-500 uppercase">Entrées caisse</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{formatMontant(solde?.entrees_caisse || 0)}</p>
          </div>

          <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-semantic-red" />
              <span className="text-xs font-bold text-neutral-500 uppercase">Sorties caisse</span>
            </div>
            <p className="text-2xl font-bold text-semantic-red">{formatMontant(solde?.sorties_caisse || 0)}</p>
          </div>

          <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 p-5">
            <div className="flex items-center gap-2 mb-2">
              <Banknote className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-neutral-500 uppercase">Encaissements ventes</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{formatMontant(solde?.encaissements_ventes || 0)}</p>
          </div>

          <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-xl border-2 border-primary/30 p-5">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-neutral-500 uppercase">Solde théorique</span>
            </div>
            <p className={`text-2xl font-bold ${(solde?.solde_theorique || 0) >= 0 ? 'text-neutral-900 dark:text-white' : 'text-semantic-red'}`}>
              {formatMontant(solde?.solde_theorique || 0)}
            </p>
          </div>
        </div>

        {/* Résumé */}
        {solde && (
          <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 p-5 mb-6">
            <h3 className="font-bold text-neutral-900 dark:text-white mb-3">Récapitulatif du {format(new Date(selectedDate + 'T12:00:00'), 'dd MMMM yyyy', { locale: fr })}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-neutral-500">Entrées caisse</span>
                <p className="font-bold text-green-600">+{formatMontant(solde.entrees_caisse)}</p>
              </div>
              <div>
                <span className="text-neutral-500">Ventes encaissées</span>
                <p className="font-bold text-blue-600">+{formatMontant(solde.encaissements_ventes)}</p>
              </div>
              <div>
                <span className="text-neutral-500">Sorties caisse</span>
                <p className="font-bold text-semantic-red">−{formatMontant(solde.sorties_caisse)}</p>
              </div>
              <div className="col-span-2 md:col-span-3 pt-3 border-t border-neutral-200 dark:border-white/10">
                <span className="text-neutral-500">Solde théorique</span>
                <p className={`text-xl font-bold ${solde.solde_theorique >= 0 ? 'text-neutral-900 dark:text-white' : 'text-semantic-red'}`}>
                  {formatMontant(solde.solde_theorique)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Liste des mouvements */}
        <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 overflow-hidden">
          <div className="p-4 border-b border-neutral-200 dark:border-white/5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-neutral-900 dark:text-white">Mouvements du jour</h3>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-green-600 font-bold">+{formatMontant(totalEntrees)}</span>
                <span className="text-semantic-red font-bold">−{formatMontant(totalSorties)}</span>
              </div>
            </div>
          </div>

          <div className="divide-y divide-neutral-200 dark:divide-white/5 max-h-[60vh] overflow-y-auto">
            {mouvements?.map(m => (
              <div key={m.id} className="p-4 flex items-center gap-4 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors">
                <div className={`rounded-full p-2 ${
                  m.type === 'entree' ? 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
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
                <span className={`font-bold text-sm whitespace-nowrap ${m.type === 'entree' ? 'text-green-600' : 'text-semantic-red'}`}>
                  {m.type === 'entree' ? '+' : '−'}{formatMontant(m.montant)}
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
