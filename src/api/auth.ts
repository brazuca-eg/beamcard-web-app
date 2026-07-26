import { apiFetch } from './client';

/**
 * Wire shapes — must match user-service's REST DTOs exactly (snake_case).
 * Backend: com.beamcard.user.auth.rest.model.{request,response}.*
 */

export interface SignupRequest {
  email: string;
  password: string;
  username: string;
  /** UI language chosen at signup (en/de/uk). */
  locale: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
  /** True when a Google sign-in just created the account with a placeholder handle. */
  needs_username?: boolean;
  user: {
    id: string;
    email: string;
    username: string;
    plan: 'free' | 'premium';
    locale: string;
  };
}

/** Body of GET /auth/me (AccountResponse). */
export interface AccountResponse {
  id: string;
  email: string;
  username: string;
  plan: 'free' | 'premium';
  locale: string;
  created_at: string;
  /** False for Google-only accounts (no password) — used to hide the change-password panel. */
  has_password: boolean;
  /** Whether the email address has been confirmed — drives the "verify your email" banner. */
  email_verified: boolean;
}

/**
 * Auth error bodies share the platform-wide RFC 7807 shape. The full `code`
 * union (incl. `validation_failed` / `internal_error`) lives in ./problem.
 */
export type { ApiProblem, ProblemCode } from './problem';

/**
 * Signup outcome. When `verification_required` is true the user must verify their email before
 * signing in, so `auth` is null (no session). Otherwise `auth` carries the token pair (auto-login).
 */
export interface SignupResponse {
  verification_required: boolean;
  email: string;
  auth: AuthResponse | null;
}

export function signup(req: SignupRequest): Promise<SignupResponse> {
  return apiFetch<SignupResponse>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export function login(req: LoginRequest): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

/**
 * POST /auth/oauth/google — exchange a Google ID token (from Google Identity
 * Services) for a Beamcard session. `locale` seeds a brand-new user's language.
 */
export function loginWithGoogle(idToken: string, locale: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/oauth/google', {
    method: 'POST',
    body: JSON.stringify({ id_token: idToken, locale }),
  });
}

export function getCurrentAccount(): Promise<AccountResponse> {
  return apiFetch<AccountResponse>('/auth/me');
}

/**
 * PATCH /auth/account — change handle and/or language. Omitted fields are left
 * unchanged. Returns a fresh token pair carrying the updated claims, so the
 * caller must persist the new tokens (setSession).
 */
export function updateAccount(patch: { username?: string; locale?: string }): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/account', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

/**
 * POST /auth/me/password — change password. Requires the current password;
 * revokes all other sessions and returns a fresh token pair for this device, so
 * the caller must persist the new tokens (setSession).
 */
export function changePassword(req: {
  current_password: string;
  new_password: string;
}): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/me/password', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

/**
 * DELETE /auth/me — permanently delete the account (soft-delete + revoke tokens
 * + release the handle). 204 on success. Delete the profile (card + media) first.
 */
export function deleteAccount(): Promise<void> {
  return apiFetch<void>('/auth/me', { method: 'DELETE' });
}

/** POST /auth/email/verify/request — re-send the verification email to the signed-in user. 202. */
export function requestEmailVerification(): Promise<void> {
  return apiFetch<void>('/auth/email/verify/request', { method: 'POST' });
}

/** POST /auth/email/verify/confirm — confirm the email using the emailed token. Public. 204 on success. */
export function confirmEmailVerification(token: string): Promise<void> {
  return apiFetch<void>('/auth/email/verify/confirm', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

/**
 * POST /auth/email/verify/resend — public resend by email, for a blocked/logged-out user.
 * Always 202 (no account enumeration).
 */
export function resendVerificationEmail(email: string): Promise<void> {
  return apiFetch<void>('/auth/email/verify/resend', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

/** POST /auth/refresh — exchange a refresh token for a fresh access + refresh pair (rotation). */
export function refresh(refreshToken: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

/** POST /auth/logout — revoke the refresh token server-side (JWT-protected). 204 on success. */
export function logout(refreshToken: string): Promise<void> {
  return apiFetch<void>('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

/**
 * POST /auth/password/forgot — request a reset link. Always 202 (no body),
 * even for an unknown email, so it can't be used to probe for registered
 * addresses.
 */
export function requestPasswordReset(email: string): Promise<void> {
  return apiFetch<void>('/auth/password/forgot', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

/** POST /auth/password/reset — set a new password using the emailed token. 204 on success. */
export function resetPassword(req: { token: string; password: string }): Promise<void> {
  return apiFetch<void>('/auth/password/reset', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}
