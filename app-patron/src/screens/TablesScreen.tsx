import React, { useState } from 'react';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';
import { Table } from '../types/database.types';
import { 
  Search, 
  Plus, 
  LayoutGrid, 
  Users, 
  Edit, 
  X, 
  Trash2
} from 'lucide-react';
import { twMerge } from 'tailwind-merge';

type TableFormData = Omit<Table, 'id' | 'etablissement_id' | 'statut'>;

const INITIAL_FORM_DATA: TableFormData = {
  numero: 0,
  capacite: 4
};

export function TablesScreen() {
  const profile = useAuthStore((state) => state.profile);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [formData, setFormData] = useState<TableFormData>(INITIAL_FORM_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: tables, isPending: isLoading, refetch } = useSupabaseQuery<Table[]>(
    ['tables', profile?.etablissement_id],
    async () => {
      if (!profile?.etablissement_id) return { data: [] as Table[], error: null };
      
      return await supabase
        .from('tables')
        .select('*')
        .eq('etablissement_id', profile.etablissement_id)
        .order('numero');
    },
    { enabled: !!profile?.etablissement_id }
  );

  const handleOpenModal = (table?: Table) => {
    if (table) {
      setEditingTable(table);
      setFormData({
        numero: table.numero,
        capacite: table.capacite
      });
    } else {
      setEditingTable(null);
      // Auto-increment number suggestion
      const maxNum = tables?.reduce((max, t) => Math.max(max, t.numero), 0) || 0;
      setFormData({
        numero: maxNum + 1,
        capacite: 4
      });
    }
    setError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTable(null);
    setFormData(INITIAL_FORM_DATA);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.etablissement_id) return;

    setIsSubmitting(true);
    setError(null);
    try {
      if (editingTable) {
        const { error } = await supabase
          .from('tables')
          .update({
            ...formData
          })
          .eq('id', editingTable.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tables')
          .insert({
            ...formData,
            etablissement_id: profile.etablissement_id,
            statut: 'libre'
          });
        if (error) throw error;
      }
      refetch();
      handleCloseModal();
    } catch (error: any) {
      console.error('Error saving table:', error);
      setError(error.message || 'Erreur lors de l\'enregistrement de la table');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTable = async (table: Table) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer la table ${table.numero} ?`)) return;

    try {
      const { error } = await supabase
        .from('tables')
        .delete()
        .eq('id', table.id);
      
      if (error) throw error;
      refetch();
    } catch (error: any) {
      console.error('Error deleting table:', error);
      alert('Impossible de supprimer cette table. Elle est peut-être liée à des commandes existantes.');
    }
  };

  const filteredTables = tables?.filter(table => {
    const matchesSearch = table.numero.toString().includes(searchTerm);
    return matchesSearch;
  });

  return (
    <div className="pb-20 md:pb-6 relative bg-neutral-50 dark:bg-dark-bg min-h-screen">
      {/* Header */}
      <div className="p-4 md:p-6 bg-white dark:bg-dark-card/30 dark:backdrop-blur-xl border-b border-neutral-200 dark:border-white/5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary dark:text-white font-display">Tables</h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">
              Gérez la disposition de votre salle
            </p>
          </div>
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-primary dark:bg-dark-accent text-white rounded-lg font-bold text-sm hover:opacity-90 transition-opacity self-start md:self-auto"
          >
            <Plus className="w-5 h-5" />
            <span>Nouvelle Table</span>
          </button>
        </div>

        {/* Filters */}
        <div className="mt-6 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Rechercher par numéro..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-neutral-100 dark:bg-dark-card/40 border-none rounded-lg text-primary dark:text-white placeholder-neutral-400 focus:ring-2 focus:ring-primary dark:focus:ring-dark-accent transition-all outline-none"
            />
          </div>
        </div>
      </div>

      {/* Tables List */}
      <div className="p-4 md:p-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary dark:border-white"></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredTables?.map((table) => (
              <div key={table.id} className="bg-white dark:bg-dark-card/40 dark:backdrop-blur-md rounded-xl border border-neutral-200 dark:border-white/5 shadow-soft overflow-hidden group hover:border-primary/20 dark:hover:border-dark-accent/30 transition-all">
                <div className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center size-12 rounded-lg bg-primary/10 text-primary dark:bg-dark-accent/10 dark:text-white">
                        <span className="text-xl font-bold">{table.numero}</span>
                      </div>
                      <div>
                        <h3 className="font-bold text-primary dark:text-white text-sm">Table {table.numero}</h3>
                        <div className="flex items-center gap-1.5 text-xs text-neutral-500 mt-0.5">
                            <Users className="w-3.5 h-3.5" />
                            <span>{table.capacite} places</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className={twMerge(
                      "px-2.5 py-1 rounded-md text-xs font-medium capitalize",
                      table.statut === 'libre' ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400" :
                      table.statut === 'occupee' ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400" :
                      "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400"
                    )}>
                      {table.statut.replace(/_/g, ' ')}
                    </div>

                    <div className="flex gap-2">
                        <button 
                            onClick={() => handleOpenModal(table)}
                            className="p-1.5 text-neutral-400 hover:text-primary dark:hover:text-white transition-colors bg-neutral-50 dark:bg-white/5 rounded-lg"
                        >
                            <Edit className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => handleDeleteTable(table)}
                            className="p-1.5 text-neutral-400 hover:text-semantic-red transition-colors bg-neutral-50 dark:bg-white/5 rounded-lg"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {filteredTables?.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-12 text-neutral-400">
                    <LayoutGrid className="w-12 h-12 mb-2 opacity-50" />
                    <p>Aucune table trouvée</p>
                    <button 
                        onClick={() => handleOpenModal()}
                        className="mt-4 text-primary dark:text-white font-bold text-sm hover:underline"
                    >
                        Créer une nouvelle table
                    </button>
                </div>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-dark-card/90 dark:backdrop-blur-xl rounded-2xl w-full max-w-sm shadow-2xl border border-neutral-200 dark:border-white/5 overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
            <div className="p-4 md:p-6 border-b border-neutral-100 dark:border-white/5 flex justify-between items-center">
              <h2 className="text-xl font-bold text-primary dark:text-white font-display">
                {editingTable ? 'Modifier Table' : 'Nouvelle Table'}
              </h2>
              <button 
                onClick={handleCloseModal}
                className="text-neutral-400 hover:text-primary dark:hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {error && (
              <div className="mx-4 md:mx-6 mt-4 p-3 bg-semantic-red/10 border border-semantic-red/20 rounded-lg flex items-center gap-2 text-semantic-red text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-semantic-red" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-primary dark:text-white mb-1.5">Numéro de Table</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.numero}
                  onChange={e => setFormData({...formData, numero: parseInt(e.target.value) || 0})}
                  className="w-full px-4 py-2 bg-neutral-100 dark:bg-dark-card/40 border-none rounded-lg text-primary dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-dark-accent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-primary dark:text-white mb-1.5">Capacité (personnes)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.capacite}
                  onChange={e => setFormData({...formData, capacite: parseInt(e.target.value) || 1})}
                  className="w-full px-4 py-2 bg-neutral-100 dark:bg-dark-card/40 border-none rounded-lg text-primary dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-dark-accent outline-none"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-dark-card/40 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-primary dark:bg-dark-accent text-white rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
