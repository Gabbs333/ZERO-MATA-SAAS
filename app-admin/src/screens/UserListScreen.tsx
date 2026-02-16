import { useState } from 'react';
import { useAllUsers } from '../hooks/useSupabaseQuery';
import { Search, Filter, User, Building2, Shield, Mail } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function UserListScreen() {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const { data: users, isPending: loading, error } = useAllUsers();

  const filteredUsers = users?.filter((user: any) => {
    const matchesSearch = 
      (user.nom?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (user.prenom?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (user.email?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20';
      case 'patron': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20';
      case 'gerant': return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20';
      case 'comptoir': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
      case 'serveuse': return 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20';
      default: return 'bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border border-neutral-500/20';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary dark:border-white"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-semantic-red/10 border border-semantic-red/20 text-semantic-red p-4 rounded-xl backdrop-blur-sm">
        <div className="flex items-center gap-2">
            <Shield size={20} />
            <span className="font-bold">Erreur de chargement</span>
        </div>
        <p className="mt-1 ml-7">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-primary dark:text-white">
            Utilisateurs
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-2 text-lg">
            Gérez tous les utilisateurs de la plateforme
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 bg-white/50 dark:bg-neutral-800/50 px-4 py-2 rounded-full border border-neutral-200 dark:border-neutral-700 backdrop-blur-sm">
            <User size={16} />
            <span className="font-bold text-primary dark:text-white">{filteredUsers?.length || 0}</span> utilisateurs trouvés
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-grow group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-neutral-400 group-focus-within:text-primary dark:group-focus-within:text-white transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Rechercher par nom, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-11 pr-4 py-3 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary dark:focus:border-white text-neutral-900 dark:text-white placeholder-neutral-400 transition-all shadow-sm group-hover:shadow-md"
          />
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
          <div className="flex items-center gap-2 p-1.5 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200 dark:border-white/10 rounded-xl shadow-sm">
            <Filter size={18} className="text-neutral-400 ml-2" />
            <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-700 mx-1" />
            {['all', 'patron', 'gerant', 'comptoir', 'serveuse'].map((role) => (
                <button
                key={role}
                onClick={() => setRoleFilter(role)}
                className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap",
                    roleFilter === role
                    ? "bg-primary dark:bg-white text-white dark:text-primary shadow-md shadow-primary/20 dark:shadow-white/10"
                    : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5"
                )}
                >
                {role === 'all' ? 'Tous' : role.charAt(0).toUpperCase() + role.slice(1)}
                </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 dark:border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: '1000px' }}>
            <thead>
              <tr className="border-b border-neutral-200 dark:border-white/5 bg-neutral-50/50 dark:bg-white/5">
                <th className="px-6 py-5 text-left text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Utilisateur</th>
                <th className="px-6 py-5 text-left text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Rôle</th>
                <th className="px-6 py-5 text-left text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Établissement</th>
                <th className="px-6 py-5 text-left text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Date d'inscription</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-white/5">
              {filteredUsers?.map((user: any) => (
                <tr key={user.id} className="group hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors">
                  <td className="px-6 py-5 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-gradient-to-br from-primary/10 to-blue-500/10 dark:from-white/10 dark:to-white/5 flex items-center justify-center text-primary dark:text-white font-bold ring-1 ring-black/5 dark:ring-white/10 shadow-sm group-hover:scale-110 transition-transform duration-200">
                        {user.nom?.charAt(0) || <User size={20} />}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-bold text-neutral-900 dark:text-white group-hover:text-primary dark:group-hover:text-white transition-colors">
                          {user.prenom} {user.nom}
                        </div>
                        <div className="text-sm text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5 mt-0.5">
                          <Mail size={12} />
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap">
                    <span className={cn(
                      "px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full uppercase tracking-wide shadow-sm",
                      getRoleColor(user.role)
                    )}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap">
                    {user.etablissement ? (
                      <div className="flex items-center text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-white/5 px-3 py-1.5 rounded-lg w-fit">
                        <Building2 size={14} className="mr-2 text-neutral-400" />
                        {user.etablissement.nom}
                      </div>
                    ) : (
                      <span className="text-sm text-neutral-400 italic flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-neutral-300 dark:bg-neutral-600"></span>
                        Aucun
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap text-sm text-neutral-500 dark:text-neutral-400">
                    {new Date(user.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredUsers?.length === 0 && (
          <div className="text-center py-16">
            <div className="bg-neutral-50 dark:bg-white/5 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                <User className="h-10 w-10 text-neutral-300 dark:text-neutral-600" />
            </div>
            <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">Aucun utilisateur trouvé</h3>
            <p className="text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto">
                Aucun utilisateur ne correspond à vos critères de recherche. Essayez de modifier vos filtres.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
