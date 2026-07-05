import type { FieldPath, FieldValues, UseFormSetError } from 'react-hook-form';
import { ApiError } from './client';

/**
 * RFC 7807 ProblemDetail as emitted by every Beamcard service's
 * GlobalExceptionHandler, plus our `code`/`errors` extensions. Shared across
 * services so all 4xx/5xx bodies share one shape.
 *
 * `code` is a stable, machine-readable discriminator. The union lists the
 * codes the backend emits today but stays open (`string & {}`) so an
 * unrecognised code from a newer service still type-checks.
 */
export type ProblemCode =
  // generic — any service (GlobalExceptionHandler base)
  | 'validation_failed'
  | 'internal_error'
  // user-service (auth)
  | 'email_taken'
  | 'username_taken'
  | 'invalid_credentials'
  | 'account_inactive'
  | 'user_not_found'
  | 'invalid_google_token'
  | 'email_password_account'
  // profile-service
  | 'profile_not_found'
  | 'link_not_found'
  | 'invalid_avatar'
  // keep literal autocomplete while still accepting codes from newer services
  | (string & {});

export interface ApiProblem {
  type?: string;
  title?: string;
  status: number;
  detail?: string;
  instance?: string;
  code?: ProblemCode;
  /** Field → message map attached on `validation_failed` (per-field errors). */
  errors?: Record<string, string>;
}

/** Narrow an unknown `ApiError.body` to an ApiProblem (any JSON object body). */
export function isApiProblem(body: unknown): body is ApiProblem {
  return typeof body === 'object' && body !== null;
}

/** Pull the ProblemDetail out of a thrown error, if it carries one. */
export function problemOf(err: unknown): ApiProblem | undefined {
  return err instanceof ApiError && isApiProblem(err.body) ? err.body : undefined;
}

/**
 * Map a `validation_failed` problem's `errors` onto react-hook-form fields.
 * Only fields in `allowed` are set — the server may report fields that have no
 * matching input. Returns true if at least one field error was applied.
 */
export function applyFieldErrors<T extends FieldValues>(
  problem: ApiProblem | undefined,
  setError: UseFormSetError<T>,
  allowed: readonly FieldPath<T>[],
): boolean {
  if (!problem?.errors) return false;
  let applied = false;
  for (const field of allowed) {
    const message = problem.errors[field as string];
    if (message) {
      setError(field, { message });
      applied = true;
    }
  }
  return applied;
}
