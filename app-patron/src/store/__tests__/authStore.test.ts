import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../authStore';

describe('authStore', () => {
  beforeEach(() => {
    const store = useAuthStore.getState();
    store.user = null;
    store.profile = null;
  });

  it('should initialize with null user and profile', () => {
    const { user, profile } = useAuthStore.getState();
    expect(user).toBeNull();
    expect(profile).toBeNull();
  });

  it('should have signIn method', () => {
    const { signIn } = useAuthStore.getState();
    expect(typeof signIn).toBe('function');
  });

  it('should have signOut method', () => {
    const { signOut } = useAuthStore.getState();
    expect(typeof signOut).toBe('function');
  });

  it('should have initialize method', () => {
    const { initialize } = useAuthStore.getState();
    expect(typeof initialize).toBe('function');
  });
});
