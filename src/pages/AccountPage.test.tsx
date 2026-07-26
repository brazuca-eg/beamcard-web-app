import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AccountPage } from './AccountPage';
import { changePassword, deleteAccount, getCurrentAccount } from '../api/auth';
import { deleteMyProfile, getMyProfile } from '../api/profile';
import { useAuthStore } from '../stores/authStore';

vi.mock('../api/auth', () => ({
  getCurrentAccount: vi.fn(),
  changePassword: vi.fn(),
  deleteAccount: vi.fn(),
  updateAccount: vi.fn(),
}));

vi.mock('../api/profile', () => ({
  getMyProfile: vi.fn(),
  getMyProfileQr: vi.fn(() => Promise.resolve('<svg></svg>')),
  deleteMyProfile: vi.fn(),
  publicCardUrl: (u: string) => `http://localhost/@${u}`,
}));

const ACCOUNT = {
  id: 'u1',
  email: 'alice@example.com',
  username: 'alice',
  plan: 'free' as const,
  locale: 'en',
  created_at: '2026-01-01T00:00:00Z',
  has_password: true,
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AccountPage — account lifecycle', () => {
  beforeEach(() => {
    vi.mocked(getCurrentAccount).mockReset().mockResolvedValue(ACCOUNT);
    vi.mocked(getMyProfile).mockReset().mockResolvedValue({
      id: 'p1',
      username: 'alice',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      links: [],
      awards: [],
      locale: 'en',
    });
    vi.mocked(changePassword).mockReset();
    vi.mocked(deleteAccount).mockReset();
    vi.mocked(deleteMyProfile).mockReset();
    useAuthStore.getState().setSession('test-token', 'test-refresh');
  });

  it('changes the password and stores the new tokens', async () => {
    vi.mocked(changePassword).mockResolvedValue({
      access_token: 'new-access',
      token_type: 'Bearer',
      expires_in: 900,
      refresh_token: 'new-refresh',
      user: { id: 'u1', email: 'alice@example.com', username: 'alice', plan: 'free', locale: 'en' },
    });
    renderPage();
    await screen.findByText('alice@example.com');

    await userEvent.type(screen.getByLabelText('Current password'), 'old-password-1');
    await userEvent.type(screen.getByLabelText('New password'), 'brand-new-password');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'brand-new-password');
    await userEvent.click(screen.getByRole('button', { name: /change password/i }));

    await waitFor(() =>
      expect(vi.mocked(changePassword)).toHaveBeenCalledWith({
        current_password: 'old-password-1',
        new_password: 'brand-new-password',
      }),
    );
    await waitFor(() => expect(useAuthStore.getState().token).toBe('new-access'));
  });

  it('blocks the change when the new passwords do not match', async () => {
    renderPage();
    await screen.findByText('alice@example.com');

    await userEvent.type(screen.getByLabelText('Current password'), 'old-password-1');
    await userEvent.type(screen.getByLabelText('New password'), 'brand-new-password');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'different-password');
    // The button gates on matching + length, so it stays disabled.
    expect(screen.getByRole('button', { name: /change password/i })).toBeDisabled();
    expect(vi.mocked(changePassword)).not.toHaveBeenCalled();
  });

  it('deletes the profile then the account, and clears the session', async () => {
    vi.mocked(deleteMyProfile).mockResolvedValue(undefined);
    vi.mocked(deleteAccount).mockResolvedValue(undefined);
    renderPage();
    await screen.findByText('alice@example.com');

    await userEvent.click(screen.getByRole('button', { name: /^delete account$/i }));
    // Confirmation gate: must type the exact handle.
    await userEvent.type(screen.getByLabelText(/type your handle/i), 'alice');
    await userEvent.click(screen.getByRole('button', { name: /permanently delete/i }));

    await waitFor(() => expect(vi.mocked(deleteMyProfile)).toHaveBeenCalled());
    await waitFor(() => expect(vi.mocked(deleteAccount)).toHaveBeenCalled());
    await waitFor(() => expect(useAuthStore.getState().token).toBeNull());
  });

  it('hides the change-password panel for Google-only accounts (no password)', async () => {
    vi.mocked(getCurrentAccount).mockResolvedValue({ ...ACCOUNT, has_password: false });
    renderPage();
    await screen.findByText('alice@example.com');

    expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /change password/i })).not.toBeInTheDocument();
    // Delete account stays available.
    expect(screen.getByRole('button', { name: /^delete account$/i })).toBeInTheDocument();
  });

  it('keeps the permanent-delete button disabled until the handle matches', async () => {
    renderPage();
    await screen.findByText('alice@example.com');

    await userEvent.click(screen.getByRole('button', { name: /^delete account$/i }));
    expect(screen.getByRole('button', { name: /permanently delete/i })).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/type your handle/i), 'wrong');
    expect(screen.getByRole('button', { name: /permanently delete/i })).toBeDisabled();
    expect(vi.mocked(deleteAccount)).not.toHaveBeenCalled();
  });
});
