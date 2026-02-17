import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  CreditCard, 
  Play, 
  Ban, 
  Calendar, 
  Mail, 
  Phone, 
  MapPin, 
  Clock,
  AlertTriangle,
  CheckCircle,
  Loader,
  User,
  Edit2,
  Save,
  X,
  Key,
  UserPlus
} from 'lucide-react';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { supabase } from '../config/supabase';
import { format } from '../utils/format';
import { useAuthStore } from '../store/authStore';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';

interface Etablissement {
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

interface Profile {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  role: string;
  actif: boolean;
  date_creation: string;
}

interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string;
  details: any;
  date_creation: string;
}

export default function EtablissementDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [confirmPaymentDialogOpen, setConfirmPaymentDialogOpen] = useState(false);
  const [createPatronOpen, setCreatePatronOpen] = useState(false);
  const [createPatronError, setCreatePatronError] = useState<string | null>(null);
  const [createPatronData, setCreatePatronData] = useState({
    nom: '',
    prenom: '',
    email: '',
    password: ''
  });
  const [editingPatronEmail, setEditingPatronEmail] = useState(false);
  const [newPatronEmail, setNewPatronEmail] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [newPatronPassword, setNewPatronPassword] = useState('');

  // Fetch establishment details
  const { data: etablissement, isPending: etabLoading, error: etabError, refetch: refetchEtab } = useSupabaseQuery<Etablissement>(
    ['etablissements', id!],
    (supabase) =>
      supabase
        .from('etablissements')
        .select('*')
        .eq('id', id)
        .single()
  );

  // Fetch users for this establishment
  const { data: users, isPending: usersLoading } = useSupabaseQuery<Profile[]>(
    ['profiles', 'etablissement', id!],
    (supabase) =>
      supabase
        .from('profiles')
        .select('*')
        .eq('etablissement_id', id)
        .order('date_creation', { ascending: false })
  );

  const patron = users?.find(u => u.role === 'patron' || u.role === 'admin_etablissement');

  // Fetch recent audit logs
  const { data: auditLogs, isPending: logsLoading } = useSupabaseQuery<AuditLog[]>(
    ['audit_logs', 'etablissement', id!],
    (supabase) =>
      supabase
        .from('audit_logs')
        .select('*')
        .eq('etablissement_id', id)
        .order('date_creation', { ascending: false })
        .limit(20)
  );

  // Suspend mutation
  const suspendMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('suspend_etablissement', {
        p_etablissement_id: id,
        p_admin_user_id: user?.id,
        p_reason: suspendReason,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setSuspendDialogOpen(false);
      setSuspendReason('');
      refetchEtab();
      queryClient.invalidateQueries({ queryKey: ['etablissements'] });
    },
  });

  // Reactivate mutation
  const reactivateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('reactivate_etablissement', {
        p_etablissement_id: id,
        p_admin_user_id: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refetchEtab();
      queryClient.invalidateQueries({ queryKey: ['etablissements'] });
    },
  });

  // Confirm payment mutation
  const confirmPaymentMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('confirm_payment_and_extend_subscription', {
        p_etablissement_id: id,
        p_admin_user_id: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setConfirmPaymentDialogOpen(false);
      refetchEtab();
      queryClient.invalidateQueries({ queryKey: ['etablissements'] });
    },
  });

  // Create patron mutation
  const createPatronMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('admin_create_user', {
        p_email: createPatronData.email,
        p_password: createPatronData.password,
        p_role: 'patron',
        p_etablissement_id: id,
        p_nom: createPatronData.nom,
        p_prenom: createPatronData.prenom
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setCreatePatronOpen(false);
      setCreatePatronData({ nom: '', prenom: '', email: '', password: '' });
      setCreatePatronError(null);
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      refetchEtab();
    },
    onError: (error) => {
      setCreatePatronError(error.message);
    }
  });

  const updatePatronEmailMutation = useMutation({
    mutationFn: async ({ userId, email }: { userId: string, email: string }) => {
      const { error } = await supabase.rpc('admin_update_user_email', {
        target_user_id: userId,
        new_email: email
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setEditingPatronEmail(false);
      setNewPatronEmail('');
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    }
  });

  const updatePatronPasswordMutation = useMutation({
    mutationFn: async ({ userId, password }: { userId: string, password: string }) => {
      const { error } = await supabase.rpc('admin_update_user_password', {
        target_user_id: userId,
        new_password: password
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setShowPasswordInput(false);
      setNewPatronPassword('');
    }
  });

  const handleSuspend = () => {
    suspendMutation.mutate();
  };

  const handleReactivate = () => {
    reactivateMutation.mutate();
  };

  const handleConfirmPayment = () => {
    confirmPaymentMutation.mutate();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'actif':
        return 'bg-semantic-green/10 text-semantic-green border-semantic-green/20';
      case 'expire':
        return 'bg-semantic-red/10 text-semantic-red border-semantic-red/20';
      case 'suspendu':
        return 'bg-semantic-amber/10 text-semantic-amber border-semantic-amber/20';
      default:
        return 'bg-neutral-100 text-neutral-800 border-neutral-200 dark:bg-neutral-700 dark:text-neutral-300 dark:border-neutral-600';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'actif':
        return 'Actif';
      case 'expire':
        return 'Expiré';
      case 'suspendu':
        return 'Suspendu';
      default:
        return status;
    }
  };

  if (etabLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="animate-spin text-primary dark:text-white" size={32} />
      </div>
    );
  }

  if (etabError || !etablissement) {
    return (
      <div className="bg-semantic-red/10 p-4 rounded-lg flex items-center gap-3 text-semantic-red border border-semantic-red/20">
        <AlertTriangle size={20} />
        <p>Erreur: {etabError?.message || 'Établissement non trouvé'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-12 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <button
          onClick={() => navigate('/etablissements')}
          className="p-2 hover:bg-white/50 dark:hover:bg-white/10 rounded-full transition-all group"
        >
          <ArrowLeft size={24} className="text-neutral-600 dark:text-neutral-400 group-hover:-translate-x-1 transition-transform duration-300" />
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-display font-bold text-primary dark:text-white flex flex-wrap items-center gap-3">
            {etablissement.nom}
            <span className={clsx(
              "px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap flex-shrink-0 shadow-sm",
              getStatusColor(etablissement.statut_abonnement)
            )}>
              {getStatusLabel(etablissement.statut_abonnement)}
            </span>
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Informations Générales */}
        <div className="bg-white/50 dark:bg-neutral-800/50 backdrop-blur-md rounded-2xl shadow-lg border border-neutral-200 dark:border-white/5 p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-5">
            <MapPin size={120} />
          </div>
          <h2 className="text-xl font-bold text-primary dark:text-white mb-6 flex items-center gap-2 relative z-10">
            <div className="w-1 h-6 bg-gradient-to-b from-primary to-blue-600 rounded-full"></div>
            Informations Générales
          </h2>
          
          <div className="space-y-6 relative z-10">
            <div className="flex items-start gap-4 p-4 bg-white/50 dark:bg-black/20 rounded-xl border border-neutral-100 dark:border-white/5 hover:border-primary/20 transition-colors">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <MapPin size={20} />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">Adresse</p>
                <p className="text-primary dark:text-white font-medium">{etablissement.adresse || 'Non renseigné'}</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-white/50 dark:bg-black/20 rounded-xl border border-neutral-100 dark:border-white/5 hover:border-primary/20 transition-colors">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Phone size={20} />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">Téléphone</p>
                <p className="text-primary dark:text-white font-medium">{etablissement.telephone || 'Non renseigné'}</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-white/50 dark:bg-black/20 rounded-xl border border-neutral-100 dark:border-white/5 hover:border-primary/20 transition-colors">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Mail size={20} />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">Email</p>
                <p className="text-primary dark:text-white font-medium">{etablissement.email || 'Non renseigné'}</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-white/50 dark:bg-black/20 rounded-xl border border-neutral-100 dark:border-white/5 hover:border-primary/20 transition-colors">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Clock size={20} />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">Date de création</p>
                <p className="text-primary dark:text-white font-medium">{format.date(etablissement.date_creation)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Compte Patron */}
        <div className="bg-white/50 dark:bg-neutral-800/50 backdrop-blur-md rounded-2xl shadow-lg border border-neutral-200 dark:border-white/5 p-8 relative overflow-hidden">
           <div className="absolute top-0 right-0 p-6 opacity-5">
            <User size={120} />
          </div>
          <h2 className="text-xl font-bold text-primary dark:text-white mb-6 flex items-center gap-2 relative z-10">
            <div className="w-1 h-6 bg-gradient-to-b from-primary to-blue-600 rounded-full"></div>
            Compte Patron
          </h2>
          
          <div className="space-y-6 relative z-10">
            {patron ? (
              <>
                <div className="p-4 bg-white/50 dark:bg-black/20 rounded-xl border border-neutral-100 dark:border-white/5 hover:border-primary/20 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                        <Mail size={16} />
                      </div>
                      <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Identifiant (Email)</span>
                    </div>
                    {!editingPatronEmail ? (
                      <button 
                        onClick={() => {
                          setNewPatronEmail(patron.email);
                          setEditingPatronEmail(true);
                        }}
                        className="p-1.5 text-neutral-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                      >
                        <Edit2 size={16} />
                      </button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => setEditingPatronEmail(false)}
                          className="p-1.5 text-neutral-400 hover:text-semantic-red hover:bg-semantic-red/5 rounded-lg transition-all"
                        >
                          <X size={16} />
                        </button>
                        <button 
                          onClick={() => updatePatronEmailMutation.mutate({ userId: patron.id, email: newPatronEmail })}
                          disabled={updatePatronEmailMutation.isPending}
                          className="p-1.5 text-primary hover:bg-primary/5 rounded-lg transition-all"
                        >
                          <Save size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {editingPatronEmail ? (
                    <input
                      type="email"
                      value={newPatronEmail}
                      onChange={(e) => setNewPatronEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono text-sm"
                    />
                  ) : (
                    <p className="text-primary dark:text-white font-medium pl-9 font-mono">{patron.email}</p>
                  )}
                </div>

                <div className="p-4 bg-white/50 dark:bg-black/20 rounded-xl border border-neutral-100 dark:border-white/5 hover:border-primary/20 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                        <Key size={16} />
                      </div>
                      <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Mot de passe</span>
                    </div>
                    {!showPasswordInput && (
                      <button 
                        onClick={() => setShowPasswordInput(true)}
                        className="text-xs font-bold text-primary hover:text-primary-dark hover:underline transition-all"
                      >
                        Réinitialiser
                      </button>
                    )}
                  </div>
                  
                  {showPasswordInput ? (
                    <div className="mt-3 space-y-3">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newPatronPassword}
                          onChange={(e) => setNewPatronPassword(e.target.value)}
                          placeholder="Nouveau mot de passe"
                          className="flex-1 px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono text-sm"
                        />
                         <button
                          type="button"
                          onClick={() => setNewPatronPassword(Math.random().toString(36).slice(-8) + 'A!')}
                          className="p-2 text-neutral-400 hover:text-primary dark:hover:text-white transition-colors border border-neutral-200 dark:border-white/10 rounded-lg"
                          title="Générer"
                        >
                          <Clock size={16} />
                        </button>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button 
                          onClick={() => setShowPasswordInput(false)}
                          className="px-3 py-1.5 text-xs font-bold text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                        >
                          Annuler
                        </button>
                        <button 
                          onClick={() => updatePatronPasswordMutation.mutate({ userId: patron.id, password: newPatronPassword })}
                          disabled={!newPatronPassword || updatePatronPasswordMutation.isPending}
                          className="px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-dark transition-all disabled:opacity-50"
                        >
                          Enregistrer
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-neutral-400 text-sm italic pl-9">Mot de passe masqué pour sécurité</p>
                  )}
                </div>
              </>
            ) : (
              <div className="p-4 bg-semantic-amber/10 text-semantic-amber rounded-xl border border-semantic-amber/20">
                <div className="flex items-center gap-3 mb-3">
                  <AlertTriangle size={20} />
                  <p className="font-medium">Aucun compte patron trouvé pour cet établissement.</p>
                </div>
                
                {!createPatronOpen ? (
                  <button
                    onClick={() => {
                      const cleanName = etablissement.nom.toLowerCase().replace(/[^a-z0-9]/g, '');
                      setCreatePatronData({
                        nom: 'Patron',
                        prenom: etablissement.nom,
                        email: `patron.${cleanName}@verrouillage.com`,
                        password: Math.random().toString(36).slice(-8) + 'A!'
                      });
                      setCreatePatronOpen(true);
                      setCreatePatronError(null);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-semantic-amber text-white rounded-lg text-sm font-bold hover:bg-semantic-amber/90 transition-colors"
                  >
                    <UserPlus size={16} />
                    Créer un compte Patron
                  </button>
                ) : (
                  <div className="bg-white/50 dark:bg-black/10 p-4 rounded-lg space-y-3 border border-semantic-amber/20">
                    {createPatronError && (
                      <div className="p-2 bg-semantic-red/10 text-semantic-red text-xs rounded border border-semantic-red/20 mb-2">
                        {createPatronError}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-neutral-500 uppercase">Nom</label>
                        <input
                          type="text"
                          value={createPatronData.nom}
                          onChange={(e) => setCreatePatronData({...createPatronData, nom: e.target.value})}
                          className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-neutral-500 uppercase">Prénom</label>
                        <input
                          type="text"
                          value={createPatronData.prenom}
                          onChange={(e) => setCreatePatronData({...createPatronData, prenom: e.target.value})}
                          className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-neutral-500 uppercase">Email</label>
                      <input
                        type="email"
                        value={createPatronData.email}
                        onChange={(e) => setCreatePatronData({...createPatronData, email: e.target.value})}
                        className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-lg text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-neutral-500 uppercase">Mot de passe</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={createPatronData.password}
                          onChange={(e) => setCreatePatronData({...createPatronData, password: e.target.value})}
                          className="flex-1 px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-lg text-sm font-mono"
                        />
                         <button
                          type="button"
                          onClick={() => setCreatePatronData({...createPatronData, password: Math.random().toString(36).slice(-8) + 'A!'})}
                          className="p-2 text-neutral-400 hover:text-primary transition-colors border border-neutral-200 dark:border-white/10 rounded-lg"
                        >
                          <Clock size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-2">
                      <button
                        onClick={() => setCreatePatronOpen(false)}
                        className="px-3 py-1.5 text-xs font-bold text-neutral-500 hover:text-neutral-700"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={() => createPatronMutation.mutate()}
                        disabled={createPatronMutation.isPending || !createPatronData.email || !createPatronData.password}
                        className="px-3 py-1.5 bg-semantic-amber text-white text-xs font-bold rounded-lg hover:bg-semantic-amber/90 transition-all disabled:opacity-50"
                      >
                        {createPatronMutation.isPending ? 'Création...' : 'Créer le compte'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Abonnement */}
        <div className="bg-white/50 dark:bg-neutral-800/50 backdrop-blur-md rounded-2xl shadow-lg border border-neutral-200 dark:border-white/5 p-8 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-5">
            <CreditCard size={120} />
          </div>
          <h2 className="text-xl font-bold text-primary dark:text-white mb-6 flex items-center gap-2 relative z-10">
            <div className="w-1 h-6 bg-gradient-to-b from-primary to-blue-600 rounded-full"></div>
            Abonnement
          </h2>

          <div className="space-y-6 flex-grow relative z-10">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white/50 dark:bg-black/20 rounded-xl border border-neutral-100 dark:border-white/5">
                <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-2">Début</p>
                <div className="flex items-center gap-2 text-primary dark:text-white font-bold text-lg">
                  <Calendar size={20} className="text-primary/50" />
                  {format.date(etablissement.date_debut)}
                </div>
              </div>
              <div className="p-4 bg-white/50 dark:bg-black/20 rounded-xl border border-neutral-100 dark:border-white/5">
                <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-2">Fin</p>
                <div className="flex items-center gap-2 text-primary dark:text-white font-bold text-lg">
                  <Calendar size={20} className="text-primary/50" />
                  {format.date(etablissement.date_fin)}
                </div>
              </div>
            </div>

            {etablissement.dernier_paiement_date && (
              <div className="bg-gradient-to-br from-neutral-50 to-white dark:from-neutral-800 dark:to-neutral-700 p-4 rounded-xl border border-neutral-100 dark:border-white/5">
                <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">Dernier paiement</p>
                <p className="text-primary dark:text-white font-mono">{format.date(etablissement.dernier_paiement_date)}</p>
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-wrap gap-4 relative z-10">
            <button
              onClick={() => setConfirmPaymentDialogOpen(true)}
              disabled={confirmPaymentMutation.isPending}
              className="flex-1 flex items-center justify-center px-6 py-3 bg-gradient-to-r from-primary to-blue-600 text-white rounded-xl hover:shadow-lg hover:shadow-primary/25 font-bold transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {confirmPaymentMutation.isPending ? (
                <Loader className="animate-spin mr-2" size={20} />
              ) : (
                <CreditCard size={20} className="mr-2" />
              )}
              Confirmer Paiement
            </button>

            {etablissement.statut_abonnement === 'suspendu' ? (
              <button
                onClick={handleReactivate}
                disabled={reactivateMutation.isPending}
                className="flex-1 flex items-center justify-center px-6 py-3 bg-gradient-to-r from-semantic-green to-emerald-600 text-white rounded-xl hover:shadow-lg hover:shadow-semantic-green/25 font-bold transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                <Play size={20} className="mr-2" />
                Réactiver
              </button>
            ) : (
              <button
                onClick={() => setSuspendDialogOpen(true)}
                disabled={suspendMutation.isPending}
                className="flex-1 flex items-center justify-center px-6 py-3 bg-white dark:bg-neutral-800 border border-semantic-amber text-semantic-amber rounded-xl hover:bg-semantic-amber/5 hover:shadow-lg hover:shadow-semantic-amber/10 font-bold transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                <Ban size={20} className="mr-2" />
                Suspendre
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Utilisateurs */}
      <div className="bg-white/50 dark:bg-neutral-800/50 backdrop-blur-md rounded-2xl shadow-lg border border-neutral-200 dark:border-white/5 overflow-hidden">
        <div className="p-6 border-b border-neutral-200/50 dark:border-white/5">
          <h2 className="text-xl font-bold text-primary dark:text-white flex items-center gap-2">
            <div className="w-1 h-6 bg-gradient-to-b from-primary to-blue-600 rounded-full"></div>
            Utilisateurs ({users?.length || 0})
          </h2>
        </div>
        
        {usersLoading ? (
          <div className="p-12 flex justify-center">
            <Loader className="animate-spin text-primary" size={32} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-neutral-50/50 dark:bg-neutral-900/30">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Nom</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Rôle</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Statut</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Date de création</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/50 dark:divide-white/5">
                {users?.map((user) => (
                  <tr key={user.id} className="hover:bg-white/40 dark:hover:bg-neutral-700/40 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-primary dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {user.prenom} {user.nom}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">{user.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400 capitalize">
                      <span className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-md border border-neutral-200 dark:border-neutral-700 font-medium text-xs">
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={clsx(
                        "px-2 py-1 rounded-full text-xs font-medium border shadow-sm",
                        user.actif 
                          ? "bg-semantic-green/10 text-semantic-green border-semantic-green/20" 
                          : "bg-neutral-100 text-neutral-600 border-neutral-200 dark:bg-neutral-700 dark:text-neutral-300 dark:border-neutral-600"
                      )}>
                        {user.actif ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500 dark:text-neutral-400">
                      {format.dateShort(user.date_creation)}
                    </td>
                  </tr>
                ))}
                {(!users || users.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-neutral-500 dark:text-neutral-400">
                      Aucun utilisateur trouvé
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Logs d'audit récents */}
      <div className="bg-white/50 dark:bg-neutral-800/50 backdrop-blur-md rounded-2xl shadow-lg border border-neutral-200 dark:border-white/5 overflow-hidden">
        <div className="p-6 border-b border-neutral-200/50 dark:border-white/5">
          <h2 className="text-xl font-bold text-primary dark:text-white flex items-center gap-2">
            <div className="w-1 h-6 bg-gradient-to-b from-primary to-blue-600 rounded-full"></div>
            Activité Récente
          </h2>
        </div>
        
        {logsLoading ? (
          <div className="p-12 flex justify-center">
            <Loader className="animate-spin text-primary" size={32} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-neutral-50/50 dark:bg-neutral-900/30">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Action</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Table</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Détails</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/50 dark:divide-white/5">
                {auditLogs?.map((log) => (
                  <tr key={log.id} className="hover:bg-white/40 dark:hover:bg-neutral-700/40 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500 dark:text-neutral-400 font-mono">
                      {format.dateTime(log.date_creation)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-primary dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {log.action}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                      <span className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-md border border-neutral-200 dark:border-neutral-700 font-medium text-xs font-mono">
                        {log.table_name}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-500 dark:text-neutral-400 font-mono text-xs max-w-xs truncate">
                      {JSON.stringify(log.details)}
                    </td>
                  </tr>
                ))}
                {(!auditLogs || auditLogs.length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-neutral-500 dark:text-neutral-400">
                      Aucune activité récente
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Suspend Dialog */}
      {suspendDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setSuspendDialogOpen(false)}
          />
          <div className="relative bg-white dark:bg-neutral-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden transform transition-all border border-neutral-200 dark:border-neutral-700">
            <div className="p-6">
              <h3 className="text-lg font-bold text-primary dark:text-white mb-4">Suspendre l'établissement</h3>
              
              <div className="bg-semantic-amber/10 text-semantic-amber p-4 rounded-lg flex items-start gap-3 mb-4 border border-semantic-amber/20">
                <AlertTriangle className="shrink-0 mt-0.5" size={18} />
                <p className="text-sm">Cette action empêchera tous les utilisateurs de cet établissement d'accéder au système.</p>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Raison de la suspension
                </label>
                <textarea
                  autoFocus
                  rows={3}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-semantic-amber/20 focus:border-semantic-amber transition-colors text-primary dark:text-white"
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder="Expliquez la raison..."
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setSuspendDialogOpen(false)}
                  className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 font-medium transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSuspend}
                  disabled={!suspendReason || suspendMutation.isPending}
                  className="px-4 py-2 bg-semantic-amber text-white rounded-lg hover:bg-semantic-amber/90 font-medium transition-colors disabled:opacity-50 flex items-center"
                >
                  {suspendMutation.isPending ? (
                    <>
                      <Loader className="animate-spin mr-2" size={16} />
                      Suspension...
                    </>
                  ) : (
                    'Suspendre'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Payment Dialog */}
      {confirmPaymentDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setConfirmPaymentDialogOpen(false)}
          />
          <div className="relative bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all border border-neutral-200 dark:border-white/10">
            <div className="p-8">
              <h3 className="text-2xl font-bold text-primary dark:text-white mb-6 flex items-center gap-3">
                <div className="p-2 bg-semantic-green/10 rounded-xl text-semantic-green">
                  <CreditCard size={24} />
                </div>
                Confirmer le paiement
              </h3>
              
              <div className="bg-semantic-green/10 text-semantic-green p-4 rounded-xl flex items-start gap-3 mb-6 border border-semantic-green/20 shadow-sm">
                <CheckCircle className="shrink-0 mt-0.5" size={20} />
                <p className="text-sm font-medium">Cette action prolongera l'abonnement de 12 mois à partir de la date de fin actuelle.</p>
              </div>
              
              <div className="space-y-3 mb-8 text-sm">
                <div className="flex justify-between py-3 border-b border-neutral-100 dark:border-white/5">
                  <span className="text-neutral-500 dark:text-neutral-400">Date de fin actuelle</span>
                  <span className="font-bold text-primary dark:text-white">{format.date(etablissement.date_fin)}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-neutral-100 dark:border-white/5 bg-primary/5 -mx-4 px-4">
                  <span className="text-primary dark:text-white font-medium">Nouvelle date de fin</span>

                  <span className="font-bold text-primary dark:text-white">
                    {format.date(
                      new Date(new Date(etablissement.date_fin).getTime() + 365 * 24 * 60 * 60 * 1000).toISOString()
                    )}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirmPaymentDialogOpen(false)}
                  className="px-6 py-3 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-xl transition-colors font-bold"
                >
                  Annuler
                </button>
                <button
                  onClick={handleConfirmPayment}
                  disabled={confirmPaymentMutation.isPending}
                  className="px-6 py-3 bg-gradient-to-r from-primary to-blue-600 text-white rounded-xl hover:shadow-lg hover:shadow-primary/25 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none font-bold"
                >
                  {confirmPaymentMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <Loader className="animate-spin" size={18} />
                      Confirmation...
                    </span>
                  ) : 'Confirmer le Paiement'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
