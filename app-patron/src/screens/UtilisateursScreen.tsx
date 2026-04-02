import { useState } from 'react';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';
import { UserPlus, Search, Edit, UserX, X, Trash2 } from 'lucide-react';
import type { Profile } from '../types/database.types';

// Get Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

export function UtilisateursScreen() {
  const profile = useAuthStore((state) => state.profile);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'serveuse' | 'comptoir' | 'gerant'>('all');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    role: 'serveuse' as 'serveuse' | 'comptoir' | 'gerant',
    email: '', // Only for display/new user (if supported)
    password: '' // Only for new user
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: users, isLoading, refetch } = useSupabaseQuery<Profile[]>(
    ['users', profile?.etablissement_id],
    async () => {
      if (!profile?.etablissement_id) return { data: [] as Profile[], error: null };
      
      return supabase
        .from('profiles')
        .select('*')
        .eq('etablissement_id', profile.etablissement_id)
        .order('nom')
        .then(({ data, error }) => ({ data: data as Profile[], error }));
    },
    { enabled: !!profile?.etablissement_id }
  );

  const filteredUsers = users?.filter(user => {
    const matchesSearch = 
      user.nom.toLowerCase().includes(searchTerm.toLowerCase()) || 
      user.prenom.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleEdit = (user: Profile) => {
    setEditingUser(user);
    setFormData({
      nom: user.nom,
      prenom: user.prenom,
      role: user.role as any,
      email: user.email || '', // Email from profile
      password: '' // Leave empty for security
    });
    setIsModalOpen(true);
  };

  const handleOpenNew = () => {
    setEditingUser(null);
    setFormData({
      nom: '',
      prenom: '',
      role: 'serveuse',
      email: '',
      password: ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.etablissement_id) {
      alert('Erreur: Votre profil n\'est pas lié à un établissement. Veuillez vous reconnecter.');
      return;
    }
    setIsSubmitting(true);

    try {
      if (editingUser) {
        // Update existing profile
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            nom: formData.nom,
            prenom: formData.prenom,
            role: formData.role,
            email: formData.email
          })
          .eq('id', editingUser.id);
        
        if (profileError) {
          console.error('Profile update error:', profileError);
          throw new Error(profileError.message);
        }

        // Update email and/or password via Auth Admin API if changed
        if (supabaseServiceRoleKey) {
          const authUpdate: any = {};
          
          if (formData.email && formData.email !== editingUser.email) {
            authUpdate.email = formData.email;
          }
          
          if (formData.password) {
            authUpdate.password = formData.password;
          }

          if (Object.keys(authUpdate).length > 0) {
            console.log('Updating auth for user:', editingUser.id, authUpdate);
            const authResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${editingUser.id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceRoleKey}`,
                'apikey': supabaseServiceRoleKey
              },
              body: JSON.stringify(authUpdate)
            });

            if (!authResponse.ok) {
              const authResult = await authResponse.json();
              console.error('Auth update error:', authResult);
              // Don't fail the whole update, profile was updated
            } else {
              console.log('Auth updated successfully');
            }
          }
        }

        alert('Utilisateur mis à jour avec succès');
      } else {
        // Create new user using Supabase Auth Admin API directly
        // This uses proper bcrypt password hashing
        console.log('Creating user with Auth Admin API:', {
          email: formData.email,
          role: formData.role,
          nom: formData.nom,
          prenom: formData.prenom,
          etablissement_id: profile.etablissement_id
        });
        
        // Check if service role key is available
        if (!supabaseServiceRoleKey) {
          throw new Error('Configuration error: Service role key not found. Please contact administrator.');
        }
        
        // Step 1: Create user with Supabase Auth Admin API
        const authResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceRoleKey}`,
            'apikey': supabaseServiceRoleKey
          },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            email_confirm: true,
            user_metadata: {
              role: formData.role,
              nom: formData.nom,
              prenom: formData.prenom,
              etablissement_id: profile.etablissement_id
            }
          })
        });
        
        const authResult = await authResponse.json();
        console.log('Auth API response:', authResult);
        
        if (!authResponse.ok || authResult.error) {
          console.error('Auth API error:', authResult);
          throw new Error(authResult.error?.message || 'Erreur lors de la création de l\'utilisateur');
        }
        
        console.log('User created with ID:', authResult.id);
        
        // Note: The profile is automatically created by the trigger with etablissement_id
        // No need to update it manually
        
        alert('Membre du personnel créé avec succès! Il peut maintenant se connecter avec ses identifiants.');
      }
      
      setIsModalOpen(false);
      refetch();
    } catch (error: any) {
      console.error('Error saving user:', error);
      alert(error.message || 'Erreur lors de l\'enregistrement du membre du personnel');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleUserStatus = async (user: Profile) => {
    if (!confirm(`Are you sure you want to ${user.actif ? 'deactivate' : 'activate'} this user?`)) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ actif: !user.actif })
        .eq('id', user.id);
        
      if (error) throw error;
      refetch();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error updating status');
    }
  };

  const handleDelete = async (user: Profile) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${user.prenom} ${user.nom} ? Cette action est irréversible.`)) return;
    
    try {
      // Check if service role key is available
      if (!supabaseServiceRoleKey) {
        throw new Error('Configuration error: Service role key not found. Please contact administrator.');
      }

      // Step 1: Delete user from auth.users using Admin API (this should cascade to profiles)
      console.log('Deleting user from auth:', user.id);
      const authResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${user.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${supabaseServiceRoleKey}`,
          'apikey': supabaseServiceRoleKey
        }
      });

      if (!authResponse.ok) {
        const authResult = await authResponse.json();
        console.error('Auth API error:', authResult);
        console.error('Response status:', authResponse.status);
        
        // If auth deletion fails with 500, try to delete profile directly
        if (authResponse.status === 500) {
          console.warn('Auth deletion returned 500, trying to delete profile directly');
          const { error: profileError } = await supabase
            .from('profiles')
            .delete()
            .eq('id', user.id);
          
          if (profileError) {
            console.error('Profile deletion also failed:', profileError);
            throw new Error('Erreur lors de la suppression du membre du personnel');
          }
          
          alert('Membre du personnel supprimé avec succès');
          refetch();
          return;
        }
        
        throw new Error(authResult.error?.message || 'Erreur lors de la suppression de l\'utilisateur');
      }

      console.log('User deleted successfully from auth');

      // Step 2: Also delete profile from profiles table (in case cascade didn't work)
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id);

      if (profileError) {
        console.log('Profile already deleted by cascade or does not exist:', profileError);
      }

      alert('Membre du personnel supprimé avec succès');
      refetch();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      alert(error.message || 'Erreur lors de la suppression du membre du personnel');
    }
  };

  return (
    <div className="pb-20 md:pb-6 min-h-screen bg-neutral-50 dark:bg-dark-bg transition-colors duration-300">
      {/* Header */}
      <div className="p-4 md:p-6 bg-white dark:bg-dark-card/50 dark:backdrop-blur-md border-b border-neutral-200 dark:border-white/5 sticky top-0 z-30 transition-colors duration-300">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary dark:text-white font-display">Gestion du Personnel</h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">
              Gérez les membres de votre équipe et leurs permissions
            </p>
          </div>
          <button 
            onClick={handleOpenNew}
            className="flex items-center gap-2 px-4 py-2 bg-primary dark:bg-dark-accent text-white rounded-lg font-bold text-sm hover:opacity-90 transition-all shadow-lg shadow-primary/20 dark:shadow-dark-accent/20 active:scale-95 self-start md:self-auto"
          >
            <UserPlus className="w-5 h-5" />
            <span>Ajouter un Membre</span>
          </button>
        </div>

        {/* Filters */}
        <div className="mt-6 flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input 
                    type="text" 
                    placeholder="Rechercher par nom..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary dark:focus:border-dark-accent rounded-xl text-primary dark:text-white placeholder-neutral-400 focus:ring-4 focus:ring-primary/10 dark:focus:ring-dark-accent/10 transition-all outline-none"
                />
            </div>
            <div className="flex p-1 bg-neutral-100 dark:bg-white/5 rounded-xl overflow-x-auto border border-neutral-200 dark:border-white/5">
                {(['all', 'serveuse', 'comptoir', 'gerant'] as const).map((role) => (
                    <button 
                        key={role}
                        onClick={() => setRoleFilter(role)}
                        className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap capitalize ${
                            roleFilter === role
                                ? 'bg-white dark:bg-dark-accent text-primary dark:text-white shadow-md' 
                                : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                        }`}
                    >
                        {role === 'all' ? 'Tous les Rôles' : role}
                    </button>
                ))}
            </div>
        </div>
      </div>

      {/* List */}
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary dark:border-dark-accent"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredUsers?.map((user) => (
               <div key={user.id} className={`bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-2xl border ${user.actif ? 'border-neutral-200 dark:border-white/5' : 'border-neutral-200 dark:border-white/5 opacity-75'} shadow-soft overflow-hidden group hover:border-primary/20 dark:hover:border-dark-accent/30 transition-all hover:shadow-xl relative`}>
                 <div className="p-6">
                   <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-4 flex-1 min-w-0 pr-2">
                         <div className={`size-14 rounded-2xl flex items-center justify-center text-xl font-black shadow-inner group-hover:scale-110 transition-transform flex-shrink-0 ${
                             user.role === 'patron' || user.role === 'gerant' ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' :
                             user.role === 'comptoir' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' :
                             'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400'
                         }`}>
                            {user.prenom[0]}{user.nom[0]}
                         </div>
                          <div className="min-w-0">
                             <h3 className="font-bold text-lg text-primary dark:text-white group-hover:text-primary dark:group-hover:text-dark-accent transition-colors truncate" title={`${user.prenom} ${user.nom}`}>
                                {user.prenom} {user.nom}
                             </h3>
                            <span className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${
                                 !user.actif ? 'text-red-500' : 'text-neutral-500 dark:text-neutral-400'
                            }`}>
                               <span className={`size-1.5 rounded-full ${user.actif ? 'bg-semantic-green' : 'bg-red-500'}`}></span>
                               {user.actif ? user.role : 'Inactif'}
                            </span>
                         </div>
                      </div>
                      {/* Boutons d'action visibles uniquement au survol */}
                      <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-lg p-1 shadow-lg">
                        <button 
                           onClick={(e) => { e.stopPropagation(); handleEdit(user); }}
                           className="p-2 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg text-neutral-400 hover:text-primary dark:hover:text-dark-accent transition-all active:scale-90"
                           title="Modifier"
                        >
                           <Edit className="w-4 h-4" />
                        </button>
                        {user.role !== 'patron' && (
                          <button 
                             onClick={(e) => { e.stopPropagation(); handleDelete(user); }}
                             className="p-2 hover:bg-red-100 dark:hover:bg-red-500/10 rounded-lg text-neutral-400 hover:text-red-600 dark:hover:text-red-400 transition-all active:scale-90"
                             title="Supprimer"
                          >
                             <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                   </div>

                  <div className="flex gap-2 mt-6">
                     <button 
                        onClick={() => toggleUserStatus(user)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border transition-all active:scale-95 ${
                            user.actif 
                                ? 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-500/20 dark:text-red-400 dark:hover:bg-red-500/10' 
                                : 'border-green-200 text-green-600 hover:bg-green-50 dark:border-green-500/20 dark:text-green-400 dark:hover:bg-green-500/10'
                        }`}
                     >
                        {user.actif ? 'Désactiver' : 'Activer'}
                     </button>
                  </div>
                </div>
              </div>
            ))}

            {filteredUsers?.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-20 bg-white dark:bg-dark-card/20 rounded-2xl border border-dashed border-neutral-300 dark:border-white/10">
                <UserX className="w-16 h-16 mb-4 opacity-20 text-primary dark:text-white" />
                <p className="text-neutral-500 dark:text-neutral-400 font-medium">Aucun membre trouvé</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-dark-card/95 dark:backdrop-blur-xl rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl border border-neutral-200 dark:border-white/10 overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-neutral-200 dark:border-white/5 flex justify-between items-center bg-white dark:bg-transparent z-10">
              <div>
                <h2 className="text-xl font-bold text-primary dark:text-white">
                  {editingUser ? 'Modifier Membre' : 'Ajouter un Membre'}
                </h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">Informations du profil personnel</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                      Prénom
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.prenom}
                      onChange={(e) => setFormData({...formData, prenom: e.target.value})}
                      className="w-full px-4 py-2.5 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary dark:focus:border-dark-accent rounded-xl text-primary dark:text-white focus:ring-4 focus:ring-primary/10 dark:focus:ring-dark-accent/10 outline-none transition-all"
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                      Nom
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.nom}
                      onChange={(e) => setFormData({...formData, nom: e.target.value})}
                      className="w-full px-4 py-2.5 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary dark:focus:border-dark-accent rounded-xl text-primary dark:text-white focus:ring-4 focus:ring-primary/10 dark:focus:ring-dark-accent/10 outline-none transition-all"
                    />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Rôle / Fonction
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value as any})}
                  className="w-full px-4 py-2.5 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary dark:focus:border-dark-accent rounded-xl text-primary dark:text-white focus:ring-4 focus:ring-primary/10 dark:focus:ring-dark-accent/10 outline-none transition-all appearance-none"
                >
                  <option value="serveuse">Serveuse</option>
                  <option value="comptoir">Comptoir</option>
                  <option value="gerant">Gérant</option>
                </select>
              </div>

              {/* Email - visible en mode modification et creation */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Email professionnel
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-2.5 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary dark:focus:border-dark-accent rounded-xl text-primary dark:text-white focus:ring-4 focus:ring-primary/10 dark:focus:ring-dark-accent/10 outline-none transition-all"
                />
              </div>

              {/* Password - visible en mode modification et creation */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Mot de passe {editingUser && '(laisser vide pour conserver l\'actuel)'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  placeholder={editingUser ? 'Nouveau mot de passe (optionnel)' : ''}
                  className="w-full px-4 py-2.5 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-primary dark:focus:border-dark-accent rounded-xl text-primary dark:text-white focus:ring-4 focus:ring-primary/10 dark:focus:ring-dark-accent/10 outline-none transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-4 px-6 py-4 bg-primary dark:bg-dark-accent text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-primary/20 dark:shadow-dark-accent/20 hover:opacity-90 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                ) : (
                  <>Enregistrer le Membre</>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
