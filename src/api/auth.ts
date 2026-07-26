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
}

/**
 * Auth error bodies share the platform-wide RFC 7807 shape. The full `code`
 * union (incl. `validation_failed` / `internal_error`) lives in ./problem.
 */
export type { ApiProblem, ProblemCode } from './problem';

export function signup(req: SignupRequest): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/signup', {
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
