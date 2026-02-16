import { create } from 'zustand';
import { supabase } from '../config/supabase';
import type { Profile } from '../types/database.types';

interface AuthState {
  user: any | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  loading: true,

  initialize: async () => {
    // BYPASS MODE ACTIF: Authentification automatique pour le développement
    console.warn('⚠️ AUTH BYPASS ENABLED: Auto-login as Admin');
    const mockUser = { id: 'a0000000-0000-0000-0000-000000000001', email: 'admin@snackbar.cm' };
    const mockProfile: Profile = {
      id: mockUser.id,
      nom: 'Admin',
      prenom: 'System',
      role: 'admin',
      actif: true,
      etablissement_id: null,
      date_creation: new Date().toISOString()
    };
    set({ user: mockUser, profile: mockProfile, loading: false });
    return;

    /* CODE ORIGINAL DÉSACTIVÉ
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
    ...
    } catch (error) {
      ...
    }
    */
  },

  signIn: async (email: string) => {
    // BYPASS MODE ACTIF
    console.warn('⚠️ AUTH BYPASS ENABLED: Logging in with any credentials');
    const mockUser = { id: 'a0000000-0000-0000-0000-000000000001', email: email || 'admin@snackbar.cm' };
    const mockProfile: Profile = {
      id: mockUser.id,
      nom: 'Admin',
      prenom: 'System',
      role: 'admin',
      actif: true,
      etablissement_id: null,
      date_creation: new Date().toISOString()
    };
    set({ user: mockUser, profile: mockProfile, loading: false });
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
      set({ user: null, profile: null });
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  },
}));
