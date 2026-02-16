import { create } from 'zustand';
import { supabase } from '../config/supabase';
import type { Profile } from '../types/database.types';

interface AuthState {
  user: any | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  loading: true,

  initialize: async () => {
    try {
      const {
        data: { session },
        error: sessionError
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (session?.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
          
        if (profileError) {
            console.error('Error fetching profile:', profileError);
            await supabase.auth.signOut();
            set({ user: null, profile: null, loading: false });
            return;
        }

        // Vérifier que l'utilisateur est gérant ou patron
        if (profile && (profile.role === 'gerant' || profile.role === 'patron')) {
          // Vérifier le statut de l'établissement
          if (profile.etablissement_id) {
            const { data: etablissement, error: etabError } = await supabase
              .from('etablissements')
              .select('actif, statut_abonnement')
              .eq('id', profile.etablissement_id)
              .single();
            
            if (etabError) {
                console.error('Error fetching establishment:', etabError);
                // On continue quand même si erreur de récupération (robustesse)
            } else if (!etablissement?.actif || etablissement?.statut_abonnement !== 'actif') {
              await supabase.auth.signOut();
              set({ user: null, profile: null, loading: false });
              throw new Error('Votre abonnement a expiré ou votre établissement est suspendu. Contactez l\'administrateur.');
            }
          }

          set({ user: session.user, profile, loading: false });
        } else {
          console.warn('Unauthorized role:', profile?.role);
          await supabase.auth.signOut();
          set({ user: null, profile: null, loading: false });
          throw new Error('Accès non autorisé. Cette application est réservée aux gérants et patrons.');
        }
      } else {
        set({ user: null, profile: null, loading: false });
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
      set({ user: null, profile: null, loading: false });
    }
  },

  signIn: async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (profileError) throw profileError;

        // Vérifier que l'utilisateur est gérant ou patron
        if (profile.role !== 'gerant' && profile.role !== 'patron') {
          await supabase.auth.signOut();
          throw new Error('Accès non autorisé. Cette application est réservée aux gérants et patrons.');
        }

        if (!profile.actif) {
          await supabase.auth.signOut();
          throw new Error('Votre compte est désactivé. Contactez l\'administrateur.');
        }

        // Vérifier le statut de l'établissement
        if (profile.etablissement_id) {
          const { data: etablissement, error: etabError } = await supabase
            .from('etablissements')
            .select('actif, statut_abonnement')
            .eq('id', profile.etablissement_id)
            .single();
            
          if (etabError) {
             console.error('Error fetching establishment during sign in:', etabError);
          } else if (!etablissement?.actif || etablissement?.statut_abonnement !== 'actif') {
            await supabase.auth.signOut();
            throw new Error('Votre abonnement a expiré ou votre établissement est suspendu. Contactez l\'administrateur.');
          }
        }

        set({ user: data.user, profile });
      }
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
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
