import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Layout from '../Layout';
import { useAuthStore } from '../../store/authStore';

vi.mock('../../store/authStore');

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('Layout', () => {
  it('should render children', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      profile: { id: '1', role: 'comptoir', nom: 'Test', prenom: 'User', actif: true, date_creation: '' },
      signOut: vi.fn(),
    } as any);

    renderWithRouter(
      <Layout>
        <div>Test Content</div>
      </Layout>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should display user profile', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      profile: { id: '1', role: 'comptoir', nom: 'Dupont', prenom: 'Jean', actif: true, date_creation: '' },
      signOut: vi.fn(),
    } as any);

    renderWithRouter(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    expect(screen.getByText(/Jean Dupont/)).toBeInTheDocument();
    expect(screen.getByText(/comptoir/)).toBeInTheDocument();
  });

  it('should open drawer when menu button is clicked', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      profile: { id: '1', role: 'comptoir', nom: 'Test', prenom: 'User', actif: true, date_creation: '' },
      signOut: vi.fn(),
    } as any);

    renderWithRouter(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    const menuButton = screen.getByRole('button', { name: /menu/i });
    fireEvent.click(menuButton);

    expect(screen.getByText('Validation')).toBeInTheDocument();
    expect(screen.getByText('Factures')).toBeInTheDocument();
    expect(screen.getByText('Stock')).toBeInTheDocument();
  });

  it('should call signOut when logout button is clicked', () => {
    const mockSignOut = vi.fn();
    vi.mocked(useAuthStore).mockReturnValue({
      profile: { id: '1', role: 'comptoir', nom: 'Test', prenom: 'User', actif: true, date_creation: '' },
      signOut: mockSignOut,
    } as any);

    renderWithRouter(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    const logoutButton = screen.getByRole('button', { name: /déconnexion/i });
    fireEvent.click(logoutButton);

    expect(mockSignOut).toHaveBeenCalled();
  });
});
