import { create } from 'zustand';
import { Profile } from '../types/database.types';
import { supabase } from '../config/supabase';

interface AuthState {
  user: Profile | null;
  session: any | null;
  loading: boolean;
  setUser: (user: Profile | null) => void;
  setSession: (session: any | null) => void;
  setLoading: (loading: boolean) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,
  
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setLoading: (loading) => set({ loading }),
  
  signIn: async (email, password) => {
    try {
      set({ loading: true });
      
      // Connexion avec Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.session) {
        // Récupérer le profil utilisateur avec les détails de l'établissement
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*, etablissement:etablissements(*)')
          .eq('id', data.session.user.id)
          .single();

        if (profileError) throw profileError;

        // Vérifier que l'utilisateur est une serveuse
        if (profile.role !== 'serveuse') {
          await supabase.auth.signOut();
          throw new Error('Cette application est réservée aux serveuses.');
        }

        // Vérifier que le compte est actif
        if (!profile.actif) {
          await supabase.auth.signOut();
          throw new Error('Votre compte a été désactivé. Contactez votre gérant.');
        }

        // Vérifier le statut de l'établissement
        if (profile.etablissement) {
          const etablissement = profile.etablissement;
          if (!etablissement.actif || etablissement.statut_abonnement !== 'actif') {
            await supabase.auth.signOut();
            throw new Error('L\'abonnement de votre établissement a expiré. Contactez l\'administrateur.');
          }
        } else if (profile.etablissement_id) {
          // Fallback si la jointure a échoué mais que l'ID existe (ne devrait pas arriver avec la bonne requête)
           const { data: etablissement } = await supabase
            .from('etablissements')
            .select('actif, statut_abonnement')
            .eq('id', profile.etablissement_id)
            .single();

          if (!etablissement?.actif || etablissement?.statut_abonnement !== 'actif') {
            await supabase.auth.signOut();
            throw new Error('L\'abonnement de votre établissement a expiré. Contactez l\'administrateur.');
          }
        }

        // Mettre à jour le store
        set({ session: data.session, user: profile });
      }
    } catch (error) {
      console.error('Login error details:', JSON.stringify(error, null, 2));
      set({ session: null, user: null });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null });
  },
  
  initialize: async () => {
    try {
      set({ loading: true });
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw sessionError;
      }

      if (session?.user) {
        // Fetch profile with error handling
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*, etablissement:etablissements(*)')
          .eq('id', session.user.id)
          .single();
          
        if (profileError) {
          console.error('Error fetching profile:', profileError);
          // If we can't get the profile, sign out
          await supabase.auth.signOut();
          set({ session: null, user: null });
          return;
        }

        // Vérifier si le profil existe
        if (!profile) {
           console.error('No profile found for user');
           await supabase.auth.signOut();
           set({ session: null, user: null });
           return;
        }

        // Vérifier que l'utilisateur est une serveuse
        if (profile.role !== 'serveuse') {
          console.error('Invalid role:', profile.role);
          await supabase.auth.signOut();
          set({ session: null, user: null });
          return;
        }
        
        // Vérifier le statut de l'établissement
        if (profile.etablissement) {
          const etablissement = profile.etablissement;
          if (!etablissement.actif || etablissement.statut_abonnement !== 'actif') {
            await supabase.auth.signOut();
            set({ session: null, user: null });
            throw new Error('L\'abonnement de votre établissement a expiré. Contactez l\'administrateur.');
          }
        }

        set({ session, user: profile });
      } else {
        set({ session: null, user: null });
      }
    } catch (error) {
      console.error('Initialization error:', error);
      set({ session: null, user: null });
    } finally {
      set({ loading: false });
    }
  },
}));
