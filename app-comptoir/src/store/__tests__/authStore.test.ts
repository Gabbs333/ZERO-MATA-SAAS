import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '../authStore';
import { supabase } from '../../config/supabase';

describe('authStore', () => {
  beforeEach(() => {
    // Reset store
    useAuthStore.setState({
      user: null,
      session: null,
      profile: null,
      loading: true,
    });
    vi.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.session).toBeNull();
    expect(state.profile).toBeNull();
    expect(state.loading).toBe(true);
  });

  it('should sign in successfully', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' };
    const mockSession = { user: mockUser, access_token: 'token' };
    const mockProfile = { id: 'user-1', role: 'comptoir', nom: 'Test', prenom: 'User', actif: true };

    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: mockUser, session: mockSession },
      error: null,
    } as any);

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockProfile,
            error: null,
          }),
        }),
      }),
    } as any);

    await useAuthStore.getState().signIn('test@example.com', 'password');

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.session).toEqual(mockSession);
    expect(state.profile).toEqual(mockProfile);
  });

  it('should reject sign in for non-comptoir users', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' };
    const mockSession = { user: mockUser, access_token: 'token' };
    const mockProfile = { id: 'user-1', role: 'serveuse', nom: 'Test', prenom: 'User', actif: true };

    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: mockUser, session: mockSession },
      error: null,
    } as any);

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockProfile,
            error: null,
          }),
        }),
      }),
    } as any);

    await expect(
      useAuthStore.getState().signIn('test@example.com', 'password')
    ).rejects.toThrow('Accès non autorisé');
  });

  it('should sign out successfully', async () => {
    // Set initial state
    useAuthStore.setState({
      user: { id: 'user-1' } as any,
      session: { access_token: 'token' } as any,
      profile: { id: 'user-1', role: 'comptoir' } as any,
      loading: false,
    });

    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });

    await useAuthStore.getState().signOut();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.session).toBeNull();
    expect(state.profile).toBeNull();
  });
});
