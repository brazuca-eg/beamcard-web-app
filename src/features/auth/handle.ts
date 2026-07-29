/**
 * Normalize a raw handle into what a Beamcard username may contain: lowercase, and only
 * letters/digits/dot/underscore/hyphen, capped at 20 chars (mirrors the signup rule).
 * Used by the landing "claim your @username" hero and the signup prefill so they agree.
 */
export function sanitizeHandle(raw: string): string {
  return (raw ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 20);
}
