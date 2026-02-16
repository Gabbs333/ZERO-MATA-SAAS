import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, AlertCircle, Loader, User, RefreshCw } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../config/supabase';
import clsx from 'clsx';

interface FormData {
  nom: string;
  adresse: string;
  telephone: string;
  email: string;
  patronEmail: string;
  patronPassword: string;
  patronNom: string;
  patronPrenom: string;
}

interface FormErrors {
  nom?: string;
  email?: string;
  patronEmail?: string;
  patronPassword?: string;
  patronNom?: string;
}

export default function CreateEtablissementScreen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<FormData>({
    nom: '',
    adresse: '',
    telephone: '',
    email: '',
    patronEmail: '',
    patronPassword: Math.random().toString(36).slice(-8) + 'A!', // Default random password
    patronNom: 'Patron',
    patronPrenom: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  // Auto-generate patron email based on establishment name
  useEffect(() => {
    if (formData.nom) {
      const slug = formData.nom
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 10);
      const generatedEmail = `patron.${slug}@verrouillage.com`;
      
      // Only update if the current email is empty or looks like a generated one
      if (!formData.patronEmail || formData.patronEmail.startsWith('patron.')) {
        setFormData(prev => ({ ...prev, patronEmail: generatedEmail }));
      }
      
      // Also update patron prenom if empty
      if (!formData.patronPrenom) {
        setFormData(prev => ({ ...prev, patronPrenom: formData.nom }));
      }
    }
  }, [formData.nom]);

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      // Calculate dates
      const dateDebut = new Date();
      const dateFin = new Date();
      dateFin.setFullYear(dateFin.getFullYear() + 1); // +12 months

      // 1. Create Establishment
      const { data: etablissement, error: etablissementError } = await supabase
        .from('etablissements')
        .insert({
          nom: data.nom,
          adresse: data.adresse || null,
          telephone: data.telephone || null,
          email: data.email || null,
          statut_abonnement: 'actif',
          date_debut: dateDebut.toISOString(),
          date_fin: dateFin.toISOString(),
          actif: true,
        })
        .select()
        .single();

      if (etablissementError) throw etablissementError;

      // 2. Create Patron User
      const { error: userError } = await supabase.rpc('admin_create_user', {
        p_email: data.patronEmail,
        p_password: data.patronPassword,
        p_role: 'patron',
        p_etablissement_id: etablissement.id,
        p_nom: data.patronNom,
        p_prenom: data.patronPrenom
      });

      if (userError) {
        // Optional: Delete establishment if user creation fails
        // await supabase.from('etablissements').delete().eq('id', etablissement.id);
        throw new Error(`Erreur création patron: ${userError.message}`);
      }

      return etablissement;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['etablissements'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
      navigate(`/etablissements/${data.id}`);
    },
  });

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.nom.trim()) {
      newErrors.nom = 'Le nom est requis';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email invalide';
    }

    if (!formData.patronEmail.trim()) {
      newErrors.patronEmail = "L'email du patron est requis";
    }

    if (!formData.patronPassword || formData.patronPassword.length < 6) {
      newErrors.patronPassword = 'Le mot de passe doit contenir au moins 6 caractères';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      createMutation.mutate(formData);
    }
  };

  const handleChange = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    // Clear error for this field
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/etablissements')}
          className="group p-3 hover:bg-white/10 rounded-full transition-all text-neutral-600 dark:text-neutral-400 border border-transparent hover:border-white/10"
        >
          <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
        </button>
        <h1 className="text-3xl font-display font-bold text-neutral-900 dark:text-white tracking-tight">
          Nouvel Établissement
        </h1>
      </div>

      <div className="bg-white/50 dark:bg-neutral-800/50 backdrop-blur-md rounded-2xl shadow-lg border border-neutral-200 dark:border-white/5 overflow-hidden">
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            {createMutation.isError && (
              <div className="bg-semantic-red/10 text-semantic-red p-4 rounded-xl flex items-start gap-3 border border-semantic-red/20 shadow-glow-error">
                <AlertCircle className="shrink-0 mt-0.5" size={20} />
                <p className="font-medium">Erreur lors de la création: {(createMutation.error as Error).message}</p>
              </div>
            )}

            <div className="bg-gradient-to-br from-primary/10 to-primary/5 text-primary dark:text-white p-6 rounded-xl flex items-start gap-4 border border-primary/10 dark:border-white/10 relative overflow-hidden group">
              <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm shrink-0">
                 <AlertCircle className="shrink-0" size={24} />
              </div>
              <div className="relative z-10">
                <h3 className="font-bold text-lg mb-1">Configuration Automatique</h3>
                <p className="text-primary/80 dark:text-white/80 leading-relaxed">L'abonnement sera automatiquement configuré pour <span className="font-bold">12 mois</span> à partir d'aujourd'hui.</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="group">
                <label htmlFor="nom" className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2 uppercase tracking-wider">
                  Nom de l'établissement <span className="text-semantic-red">*</span>
                </label>
                <input
                  type="text"
                  id="nom"
                  value={formData.nom}
                  onChange={handleChange('nom')}
                  disabled={createMutation.isPending}
                  className={clsx(
                    "w-full px-4 py-3 bg-white dark:bg-neutral-900/50 border rounded-xl focus:outline-none focus:ring-2 transition-all text-primary dark:text-white placeholder-neutral-400/70 shadow-sm",
                    errors.nom
                      ? "border-semantic-red/50 focus:border-semantic-red focus:ring-semantic-red/20"
                      : "border-neutral-200 dark:border-white/10 focus:border-primary dark:focus:border-primary/50 focus:ring-primary/20 dark:focus:ring-primary/20 group-hover:border-neutral-300 dark:group-hover:border-white/20"
                  )}
                  placeholder="Ex: Restaurant Le Gourmet"
                />
                {errors.nom && (
                  <p className="mt-2 text-sm text-semantic-red font-medium flex items-center gap-1">
                    <AlertCircle size={14} />
                    {errors.nom}
                  </p>
                )}
              </div>

              <div className="group">
                <label htmlFor="adresse" className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2 uppercase tracking-wider">
                  Adresse
                </label>
                <textarea
                  id="adresse"
                  rows={2}
                  value={formData.adresse}
                  onChange={handleChange('adresse')}
                  disabled={createMutation.isPending}
                  className="w-full px-4 py-3 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-primary/20 focus:border-primary dark:focus:border-primary/50 transition-all resize-none text-primary dark:text-white placeholder-neutral-400/70 shadow-sm group-hover:border-neutral-300 dark:group-hover:border-white/20"
                  placeholder="Adresse complète"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="group">
                    <label htmlFor="telephone" className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2 uppercase tracking-wider">
                    Téléphone
                    </label>
                    <input
                    type="tel"
                    id="telephone"
                    value={formData.telephone}
                    onChange={handleChange('telephone')}
                    disabled={createMutation.isPending}
                    className="w-full px-4 py-3 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-primary/20 focus:border-primary dark:focus:border-primary/50 transition-all text-primary dark:text-white placeholder-neutral-400/70 shadow-sm group-hover:border-neutral-300 dark:group-hover:border-white/20 font-mono"
                    placeholder="+237 6XX XX XX XX"
                    />
                </div>

                <div className="group">
                    <label htmlFor="email" className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2 uppercase tracking-wider">
                    Email de l'établissement
                    </label>
                    <input
                    type="email"
                    id="email"
                    value={formData.email}
                    onChange={handleChange('email')}
                    disabled={createMutation.isPending}
                    className={clsx(
                        "w-full px-4 py-3 bg-white dark:bg-neutral-900/50 border rounded-xl focus:outline-none focus:ring-2 transition-all text-primary dark:text-white placeholder-neutral-400/70 shadow-sm group-hover:border-neutral-300 dark:group-hover:border-white/20",
                        errors.email
                        ? "border-semantic-red/50 focus:border-semantic-red focus:ring-semantic-red/20"
                        : "border-neutral-200 dark:border-white/10 focus:border-primary dark:focus:border-primary/50 focus:ring-primary/20 dark:focus:ring-primary/20"
                    )}
                    placeholder="contact@exemple.com"
                    />
                    {errors.email && (
                    <p className="mt-2 text-sm text-semantic-red font-medium flex items-center gap-1">
                        <AlertCircle size={14} />
                        {errors.email}
                    </p>
                    )}
                </div>
              </div>

              {/* Patron Credentials Section */}
              <div className="bg-white/30 dark:bg-white/5 p-6 rounded-xl border border-neutral-200 dark:border-white/10 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <User size={20} className="text-primary dark:text-white" />
                  </div>
                  <h3 className="font-bold text-lg text-neutral-900 dark:text-white">Compte Patron</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="group">
                    <label htmlFor="patronNom" className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2 uppercase tracking-wider">
                      Nom Patron
                    </label>
                    <input
                      type="text"
                      id="patronNom"
                      value={formData.patronNom}
                      onChange={handleChange('patronNom')}
                      disabled={createMutation.isPending}
                      className="w-full px-4 py-3 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-primary/20 focus:border-primary dark:focus:border-primary/50 transition-all text-primary dark:text-white placeholder-neutral-400/70 shadow-sm"
                    />
                  </div>
                  <div className="group">
                    <label htmlFor="patronPrenom" className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2 uppercase tracking-wider">
                      Prénom Patron
                    </label>
                    <input
                      type="text"
                      id="patronPrenom"
                      value={formData.patronPrenom}
                      onChange={handleChange('patronPrenom')}
                      disabled={createMutation.isPending}
                      className="w-full px-4 py-3 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-primary/20 focus:border-primary dark:focus:border-primary/50 transition-all text-primary dark:text-white placeholder-neutral-400/70 shadow-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="group">
                    <label htmlFor="patronEmail" className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2 uppercase tracking-wider">
                      Identifiant (Email) <span className="text-semantic-red">*</span>
                    </label>
                    <input
                      type="email"
                      id="patronEmail"
                      value={formData.patronEmail}
                      onChange={handleChange('patronEmail')}
                      disabled={createMutation.isPending}
                      className={clsx(
                        "w-full px-4 py-3 bg-white dark:bg-neutral-900/50 border rounded-xl focus:outline-none focus:ring-2 transition-all text-primary dark:text-white placeholder-neutral-400/70 shadow-sm font-mono",
                        errors.patronEmail
                        ? "border-semantic-red/50 focus:border-semantic-red focus:ring-semantic-red/20"
                        : "border-neutral-200 dark:border-white/10 focus:border-primary dark:focus:border-primary/50 focus:ring-primary/20 dark:focus:ring-primary/20"
                      )}
                    />
                    {errors.patronEmail && (
                      <p className="mt-2 text-sm text-semantic-red font-medium flex items-center gap-1">
                        <AlertCircle size={14} />
                        {errors.patronEmail}
                      </p>
                    )}
                  </div>

                  <div className="group">
                    <label htmlFor="patronPassword" className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2 uppercase tracking-wider">
                      Mot de passe <span className="text-semantic-red">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        id="patronPassword"
                        value={formData.patronPassword}
                        onChange={handleChange('patronPassword')}
                        disabled={createMutation.isPending}
                        className={clsx(
                          "w-full px-4 py-3 bg-white dark:bg-neutral-900/50 border rounded-xl focus:outline-none focus:ring-2 transition-all text-primary dark:text-white placeholder-neutral-400/70 shadow-sm font-mono",
                          errors.patronPassword
                          ? "border-semantic-red/50 focus:border-semantic-red focus:ring-semantic-red/20"
                          : "border-neutral-200 dark:border-white/10 focus:border-primary dark:focus:border-primary/50 focus:ring-primary/20 dark:focus:ring-primary/20"
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, patronPassword: Math.random().toString(36).slice(-8) + 'A!' }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-neutral-400 hover:text-primary dark:hover:text-white transition-colors"
                        title="Générer un nouveau mot de passe"
                      >
                        <RefreshCw size={16} />
                      </button>
                    </div>
                    {errors.patronPassword && (
                      <p className="mt-2 text-sm text-semantic-red font-medium flex items-center gap-1">
                        <AlertCircle size={14} />
                        {errors.patronPassword}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4 justify-end pt-6 border-t border-neutral-100 dark:border-white/5">
              <button
                type="button"
                onClick={() => navigate('/etablissements')}
                disabled={createMutation.isPending}
                className="px-6 py-3 border border-neutral-200 dark:border-white/10 text-neutral-700 dark:text-neutral-300 rounded-xl hover:bg-neutral-50 dark:hover:bg-white/5 font-bold transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="flex items-center px-6 py-3 bg-gradient-to-r from-primary to-blue-600 text-white rounded-xl hover:shadow-lg hover:shadow-primary/25 font-bold transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader className="animate-spin mr-2" size={20} />
                    Création...
                  </>
                ) : (
                  <>
                    <Save className="mr-2" size={20} />
                    Créer l'Établissement
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
