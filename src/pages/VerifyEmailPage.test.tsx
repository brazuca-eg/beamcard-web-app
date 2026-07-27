import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { VerifyEmailPage } from './VerifyEmailPage';
import { confirmEmailVerification } from '../api/auth';

vi.mock('../api/auth', () => ({
  confirmEmailVerification: vi.fn(),
}));

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/verify-email" element={<VerifyEmailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('VerifyEmailPage', () => {
  beforeEach(() => {
    vi.mocked(confirmEmailVerification).mockReset();
  });

  it('confirms the token and shows success', async () => {
    vi.mocked(confirmEmailVerification).mockResolvedValue(undefined);
    renderAt('/verify-email?token=good-token');

    expect(await screen.findByText(/your email is verified/i)).toBeInTheDocument();
    expect(vi.mocked(confirmEmailVerification)).toHaveBeenCalledWith('good-token');
  });

  it('shows an error when the token is rejected', async () => {
    vi.mocked(confirmEmailVerification).mockRejectedValue(new Error('bad'));
    renderAt('/verify-email?token=bad-token');

    expect(await screen.findByText(/invalid or has expired/i)).toBeInTheDocument();
  });

  it('shows an error with no token and never calls the API', async () => {
    renderAt('/verify-email');

    expect(await screen.findByText(/invalid or has expired/i)).toBeInTheDocument();
    expect(vi.mocked(confirmEmailVerification)).not.toHaveBeenCalled();
  });
});
