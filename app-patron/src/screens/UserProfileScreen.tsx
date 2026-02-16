import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../config/supabase';
import { User, Lock, Save } from 'lucide-react';

export function UserProfileScreen() {
  const { profile, user, initialize } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [formData, setFormData] = useState({
    nom: profile?.nom || '',
    prenom: profile?.prenom || '',
  });

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;
    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          nom: formData.nom,
          prenom: formData.prenom,
          date_modification: new Date().toISOString() // Assuming this field exists or ignored
        })
        .eq('id', profile.id);

      if (error) throw error;
      
      await initialize(); // Refresh store
      setMessage({ type: 'success', text: 'Profile updated successfully' });
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: 'Error updating profile' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-20 md:pb-6 max-w-5xl mx-auto px-4 md:px-6">
      {/* Header */}
      <div className="py-6 mb-2">
        <h1 className="text-3xl font-bold text-primary dark:text-white font-display tracking-tight">Mon Profil</h1>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">
          Gérez vos informations personnelles et la sécurité de votre compte
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Profile Card */}
        <div className="lg:col-span-4">
          <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-2xl border border-neutral-200 dark:border-white/5 shadow-xl shadow-neutral-200/40 dark:shadow-none p-8 text-center relative overflow-hidden group">
            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-br from-primary/5 to-primary/10 dark:from-dark-accent/5 dark:to-dark-accent/10 -z-0"></div>
            
            <div className="relative z-10">
              <div className="size-28 mx-auto bg-white dark:bg-dark-card/60 rounded-full p-1.5 shadow-lg mb-6 border border-neutral-100 dark:border-white/10 group-hover:scale-105 transition-transform duration-300">
                <div className="size-full bg-primary/10 dark:bg-dark-accent/10 rounded-full flex items-center justify-center text-3xl font-bold text-primary dark:text-dark-accent border border-primary/20 dark:border-dark-accent/20">
                  {profile?.prenom?.[0]}{profile?.nom?.[0]}
                </div>
              </div>
              
              <h2 className="text-2xl font-bold text-primary dark:text-white mb-1">
                {profile?.prenom} {profile?.nom}
              </h2>
              <p className="text-sm font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-4">
                {profile?.role === 'admin' ? 'Administrateur' : 
                 profile?.role === 'patron' ? 'Propriétaire' : 
                 profile?.role === 'comptable' ? 'Comptable' : profile?.role}
              </p>
              
              <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
                <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                Compte Actif
              </div>
              
              <div className="mt-8 pt-8 border-t border-neutral-100 dark:border-white/5 text-left space-y-4">
                 <div>
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mb-1 uppercase tracking-[0.2em] font-bold">Email professionnel</p>
                    <p className="text-sm font-semibold text-primary dark:text-white truncate">{user?.email}</p>
                 </div>
                 <div>
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mb-1 uppercase tracking-[0.2em] font-bold">ID Utilisateur</p>
                    <p className="text-xs font-mono text-neutral-500 dark:text-neutral-400 truncate">{profile?.id}</p>
                 </div>
              </div>
            </div>
          </div>
        </div>

        {/* Forms */}
        <div className="lg:col-span-8 space-y-8">
          {message && (
            <div className={`p-4 rounded-xl text-sm font-medium border flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${
              message.type === 'success' 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' 
                : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20'
            }`}>
              <div className={`size-2 rounded-full ${message.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
              {message.text}
            </div>
          )}

          {/* Personal Info */}
          <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-2xl border border-neutral-200 dark:border-white/5 shadow-xl shadow-neutral-200/40 dark:shadow-none p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-primary/10 dark:bg-dark-accent/10 rounded-lg text-primary dark:text-dark-accent border border-primary/20 dark:border-dark-accent/20">
                <User className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-primary dark:text-white">Informations Personnelles</h3>
            </div>
            
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest ml-1">
                    Prénom
                  </label>
                  <input
                    type="text"
                    value={formData.prenom}
                    onChange={(e) => setFormData({...formData, prenom: e.target.value})}
                    className="w-full px-4 py-3 bg-neutral-100 dark:bg-dark-card/60 border border-transparent focus:border-primary/20 dark:focus:border-white/10 rounded-xl text-primary dark:text-white placeholder-neutral-400 focus:ring-4 focus:ring-primary/5 dark:focus:ring-white/5 transition-all outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest ml-1">
                    Nom
                  </label>
                  <input
                    type="text"
                    value={formData.nom}
                    onChange={(e) => setFormData({...formData, nom: e.target.value})}
                    className="w-full px-4 py-3 bg-neutral-100 dark:bg-dark-card/60 border border-transparent focus:border-primary/20 dark:focus:border-white/10 rounded-xl text-primary dark:text-white placeholder-neutral-400 focus:ring-4 focus:ring-primary/5 dark:focus:ring-white/5 transition-all outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3 bg-primary dark:bg-dark-accent text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 dark:shadow-dark-accent/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Enregistrer les modifications
                </button>
              </div>
            </form>
          </div>

          {/* Security Note */}
          <div className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-2xl border border-neutral-200 dark:border-white/5 shadow-xl shadow-neutral-200/40 dark:shadow-none p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-semantic-amber/10 rounded-lg text-semantic-amber border border-semantic-amber/20">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-primary dark:text-white">Sécurité du Compte</h3>
            </div>
            
            <p className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed">
              Pour des raisons de sécurité, la modification de vos identifiants (email) et de votre mot de passe est gérée exclusivement par l'administrateur. Veuillez contacter le support pour toute demande de modification.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
