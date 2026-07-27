import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginForm } from './LoginForm';
import { login, type AuthResponse } from '../../api/auth';
import { ApiError } from '../../api/client';

vi.mock('../../api/auth', () => ({
  login: vi.fn(),
  resendVerificationEmail: vi.fn(),
}));

const loginMock = vi.mocked(login);

function renderForm(onSuccess = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <LoginForm onSuccess={onSuccess} />
    </QueryClientProvider>,
  );
  return { onSuccess };
}

describe('LoginForm', () => {
  beforeEach(() => {
    loginMock.mockReset();
  });

  it('shows validation errors when fields are empty', async () => {
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
    expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('calls login API and reports success', async () => {
    const fakeResponse: AuthResponse = {
      refresh_token: 'refresh.value',
      access_token: 'token.value',
      token_type: 'Bearer',
      expires_in: 900,
      user: { id: 'uuid', email: 'alice@example.com', username: 'alice', plan: 'free', locale: 'en' },
    };
    loginMock.mockResolvedValue(fakeResponse);

    const { onSuccess } = renderForm();
    await userEvent.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'correcthorsebatterystaple');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith(
        { email: 'alice@example.com', password: 'correcthorsebatterystaple' },
        expect.anything(),
      );
      expect(onSuccess).toHaveBeenCalled();
      expect(onSuccess.mock.calls[0][0]).toEqual(fakeResponse);
    });
  });

  it('shows a generic message on 401 without revealing which field was wrong', async () => {
    loginMock.mockRejectedValue(new ApiError(401, 'Unauthorized', { code: 'invalid_credentials' }));

    renderForm();
    await userEvent.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrongpassword1');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument();
  });

  it('shows a verify-your-email message and a resend action on 403 email_not_verified', async () => {
    loginMock.mockRejectedValue(new ApiError(403, 'Forbidden', { code: 'email_not_verified' }));

    renderForm();
    await userEvent.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'correcthorsebatterystaple');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/verify your email address before signing in/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resend verification email/i })).toBeInTheDocument();
  });

  it('shows the inactive-account message on 403', async () => {
    loginMock.mockRejectedValue(new ApiError(403, 'Forbidden', { code: 'account_inactive' }));

    renderForm();
    await userEvent.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'correcthorsebatterystaple');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/not active/i)).toBeInTheDocument();
  });
});
