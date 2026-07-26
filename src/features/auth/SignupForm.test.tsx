import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { SignupForm } from './SignupForm';
import { signup, type AuthResponse, type SignupResponse } from '../../api/auth';
import { ApiError } from '../../api/client';
import i18n from '../../i18n';

// Module-level mock — replaces `signup` with a vi.fn(). Using vi.spyOn on the
// named export doesn't work here because Vite/esbuild rewrites imports to
// direct refs, bypassing the namespace object.
vi.mock('../../api/auth', () => ({
  signup: vi.fn(),
  resendVerificationEmail: vi.fn(),
}));

const signupMock = vi.mocked(signup);

const AUTH: AuthResponse = {
  access_token: 'token.value',
  refresh_token: 'refresh.value',
  token_type: 'Bearer',
  expires_in: 900,
  user: { id: 'uuid', email: 'alice@example.com', username: 'alice', plan: 'free', locale: 'en' },
};

/** A signup response that auto-logs in (verification disabled). */
const authenticated = (auth: AuthResponse = AUTH): SignupResponse => ({
  verification_required: false,
  email: auth.user.email,
  auth,
});

function renderForm(onAuthenticated = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SignupForm onAuthenticated={onAuthenticated} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onAuthenticated };
}

describe('SignupForm', () => {
  beforeEach(() => {
    signupMock.mockReset();
  });

  afterEach(async () => {
    await i18n.changeLanguage('en'); // the language selector switches i18n live; reset for other tests
  });

  it('switches the UI language live and submits the chosen locale', async () => {
    signupMock.mockResolvedValue(
      authenticated({ ...AUTH, user: { ...AUTH.user, locale: 'de' } }),
    );

    renderForm();
    await userEvent.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await userEvent.type(screen.getByLabelText(/username/i), 'alice');
    await userEvent.type(screen.getByLabelText(/password/i), 'correcthorsebatterystaple');

    // Switching the language selector re-translates the page immediately (no reload).
    await userEvent.selectOptions(screen.getByLabelText('Language'), 'de');
    const submit = await screen.findByRole('button', { name: /konto erstellen/i });
    await userEvent.click(submit);

    await waitFor(() =>
      expect(signupMock).toHaveBeenCalledWith(expect.objectContaining({ locale: 'de' }), expect.anything()),
    );
  });

  it('shows client-side validation errors when fields are empty', async () => {
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
    expect(screen.getByText(/at least 12 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/at least 3 characters/i)).toBeInTheDocument();
    expect(signupMock).not.toHaveBeenCalled();
  });

  it('auto-logs in when verification is disabled', async () => {
    signupMock.mockResolvedValue(authenticated());

    const { onAuthenticated } = renderForm();
    await userEvent.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await userEvent.type(screen.getByLabelText(/username/i), 'alice');
    await userEvent.type(screen.getByLabelText(/password/i), 'correcthorsebatterystaple');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(signupMock).toHaveBeenCalledWith(
        {
          email: 'alice@example.com',
          username: 'alice',
          password: 'correcthorsebatterystaple',
          locale: 'en',
        },
        expect.anything(),
      );
      expect(onAuthenticated).toHaveBeenCalled();
      expect(onAuthenticated.mock.calls[0][0]).toEqual(AUTH); // the auth payload, not the wrapper
    });
  });

  it('shows check-your-inbox and does NOT log in when verification is required', async () => {
    signupMock.mockResolvedValue({ verification_required: true, email: 'alice@example.com', auth: null });

    const { onAuthenticated } = renderForm();
    await userEvent.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await userEvent.type(screen.getByLabelText(/username/i), 'alice');
    await userEvent.type(screen.getByLabelText(/password/i), 'correcthorsebatterystaple');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/check your inbox/i)).toBeInTheDocument();
    expect(onAuthenticated).not.toHaveBeenCalled();
  });

  it('maps a 409 email_taken response into a field-level error', async () => {
    signupMock.mockRejectedValue(new ApiError(409, 'Conflict', { code: 'email_taken' }));

    renderForm();
    await userEvent.type(screen.getByLabelText(/email/i), 'taken@example.com');
    await userEvent.type(screen.getByLabelText(/username/i), 'newname');
    await userEvent.type(screen.getByLabelText(/password/i), 'correcthorsebatterystaple');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/already registered/i)).toBeInTheDocument();
  });

  it('maps a 409 username_taken response into a field-level error', async () => {
    signupMock.mockRejectedValue(new ApiError(409, 'Conflict', { code: 'username_taken' }));

    renderForm();
    await userEvent.type(screen.getByLabelText(/email/i), 'fresh@example.com');
    await userEvent.type(screen.getByLabelText(/username/i), 'alice');
    await userEvent.type(screen.getByLabelText(/password/i), 'correcthorsebatterystaple');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/already taken/i)).toBeInTheDocument();
  });
});
