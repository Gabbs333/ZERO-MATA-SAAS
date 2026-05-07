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
    // Avoid double initialization
    if (useAuthStore.getState().user && !useAuthStore.getState().loading) return;

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
            }
          }

          const profile = fullProfile;

          if (profile?.etablissement_id) {
            const etablissement = profile.etablissement;

            if (!etablissement) {
              console.error('Establishment not found for ID:', profile.etablissement_id);
              await supabase.auth.signOut();
              set({ user: null, session: null, profile: null, loading: false, error: 'Votre établissement est introuvable ou a été supprimé.' });
              return;
            }

            if (!etablissement.actif || etablissement.statut_abonnement !== 'actif') {
              console.warn('Establishment inactive or subscription expired');
              await supabase.auth.signOut();
              set({ user: null, session: null, profile: null, loading: false, error: 'Abonnement expiré ou suspendu' });
              return;
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
    } catch (error) {
      console.error('Error initializing auth:', error);
      set({ loading: false });
    }

    // SINGLE auth state change listener (no duplicates)
    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);

      if (event === 'SIGNED_OUT') {
        set({ user: null, session: null, profile: null, loading: false });
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        if (session) {
          const currentProfile = useAuthStore.getState().profile;
          // Only re-fetch profile if it changed or doesn't exist
          if (!currentProfile || currentProfile.id !== session.user.id) {
            try {
              const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .maybeSingle();

              let fullProfile = profileData;
              if (profileData?.etablissement_id) {
                const { data: etablissement } = await supabase
                  .from('etablissements')
                  .select('*')
                  .eq('id', profileData.etablissement_id)
                  .maybeSingle();
                if (etablissement) fullProfile = { ...profileData, etablissement };
              }

              set({ session, user: session.user, profile: fullProfile || null });
            } catch {
              set({ session, user: session.user });
            }
          } else {
            set({ session, user: session.user });
          }
        }
      }
    });
  },

  signIn: async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      if (data.user) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profileError) throw new Error(`Erreur lors de la récupération du profil: ${profileError.message}`);

        let fullProfile = profileData;
        if (profileData?.etablissement_id) {
          const { data: etablissement } = await supabase
            .from('etablissements')
            .select('*')
            .eq('id', profileData.etablissement_id)
            .maybeSingle();
          if (etablissement) fullProfile = { ...profileData, etablissement };
        }

        const profile = fullProfile;

        if (profile && !['comptoir', 'gerant', 'patron'].includes(profile.role)) {
          await supabase.auth.signOut();
          throw new Error('Accès non autorisé. Cette application est réservée au personnel du comptoir.');
        }

        if (profile?.etablissement_id) {
          const etablissement = profile.etablissement;
          if (!etablissement) {
            await supabase.auth.signOut();
            throw new Error('Votre établissement est introuvable ou a été supprimé.');
          }
          if (!etablissement.actif || etablissement.statut_abonnement !== 'actif') {
            await supabase.auth.signOut();
            throw new Error('Votre abonnement a expiré ou votre établissement est suspendu.');
          }
        }

        set({ user: data.user, session: data.session, profile: profile || null });
      }
    } catch (err) {
      throw err;
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null, profile: null });
  },
}));
