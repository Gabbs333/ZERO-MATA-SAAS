import { create } from 'zustand';
import { supabase } from '../config/supabase';
import type { User, Session } from '@supabase/supabase-js';
import type { Profile } from '../types/database.types';

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  profile: null,
  loading: true,
  error: null,

  initialize: async () => {
    // Set up auth state change listener
    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);
      
      if (event === 'SIGNED_OUT') {
        set({ user: null, session: null, profile: null, loading: false });
        return;
      }
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session) {
          // Re-fetch profile if needed
          const currentProfile = useAuthStore.getState().profile;
          if (!currentProfile || currentProfile.id !== session.user.id) {
             // We can reuse the profile fetching logic here, or just trigger a reload
             // For simplicity, we'll let the initial fetch handle it, but update the session
             // If we are already initialized, we might need to refresh the profile
          }
          set({ session, user: session.user });
        }
      }
    });

    // Avoid double initialization of data fetching if we already have a user
    if (useAuthStore.getState().user) return;
    
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        set({ loading: false });
        return;
      }
      
      if (session) {
        try {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          if (profileError) {
            // Log but don't break - allow app to load in limited state
            console.error('Error fetching profile:', profileError);
            set({ error: `Erreur profil: ${profileError.message}` });
          }

          let fullProfile = profileData;
          
          if (profileData?.etablissement_id) {
            try {
              const { data: etablissement } = await supabase
                .from('etablissements')
                .select('*')
                .eq('id', profileData.etablissement_id)
                .maybeSingle();
                
              if (etablissement) {
                fullProfile = { ...profileData, etablissement };
              }
            } catch (etabError) {
              console.error('Error fetching establishment:', etabError);
              // Continue without establishment data
            }
          }

          const profile = fullProfile;

          // Vérifier le statut de l'établissement
          if (profile?.etablissement) {
            const etablissement = profile.etablissement;

            if (!etablissement?.actif || etablissement?.statut_abonnement !== 'actif') {
              // Instead of signing out immediately which causes loops on error
              // just set a flag or handle in UI
              console.warn('Establishment inactive or subscription expired');
            }
          }

          set({
            user: session.user,
            session,
            profile: profile || null,
            loading: false,
          });
        } catch (dataError) {
          console.error('Data fetching error:', dataError);
          set({ 
            user: session.user, 
            session, 
            profile: null, 
            loading: false,
            error: 'Erreur chargement données'
          });
        }
      } else {
        set({ loading: false });
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session) {
          // Simplified fetch for auth state change to reduce load/errors
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          if (profileError) {
             console.error('Error fetching profile on auth change:', profileError);
          }

          let fullProfile = profileData;
          
          if (profileData?.etablissement_id) {
            const { data: etablissement } = await supabase
              .from('etablissements')
              .select('*')
              .eq('id', profileData.etablissement_id)
              .maybeSingle();
              
            if (etablissement) {
              fullProfile = { ...profileData, etablissement };
            }
          }

          set({
            user: session.user,
            session,
            profile: fullProfile || null,
          });
        } else {
          set({
            user: null,
            session: null,
            profile: null,
          });
        }
      });
    } catch (error) {
      console.error('Error initializing auth:', error);
      set({ loading: false });
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
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError) {
         console.error('Error fetching profile on login:', profileError);
         throw new Error(`Erreur lors de la récupération du profil: ${profileError.message}`);
      }

      let fullProfile = profileData;
      
      if (profileData?.etablissement_id) {
        const { data: etablissement } = await supabase
          .from('etablissements')
          .select('*')
          .eq('id', profileData.etablissement_id)
          .maybeSingle();
          
        if (etablissement) {
          fullProfile = { ...profileData, etablissement };
        }
      }

      const profile = fullProfile;

      // Vérifier le statut de l'établissement

      // Vérifier que l'utilisateur a le rôle comptoir, gérant ou patron
      if (profile && !['comptoir', 'gerant', 'patron'].includes(profile.role)) {
        await supabase.auth.signOut();
        throw new Error('Accès non autorisé. Cette application est réservée au personnel du comptoir.');
      }

      // Vérifier le statut de l'établissement
      if (profile?.etablissement) {
        const etablissement = profile.etablissement;

        if (!etablissement?.actif || etablissement?.statut_abonnement !== 'actif') {
          await supabase.auth.signOut();
          throw new Error('Votre abonnement a expiré ou votre établissement est suspendu. Contactez l\'administrateur.');
        }
      }

      set({
        user: data.user,
        session: data.session,
        profile: profile || null,
      });
    }
  } catch (err) {
    throw err;
  }
},

signOut: async () => {
    await supabase.auth.signOut();
    set({
      user: null,
      session: null,
      profile: null,
    });
  },
}));
