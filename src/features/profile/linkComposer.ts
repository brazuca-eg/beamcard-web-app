import type { LinkType } from '../../api/profile';

/**
 * Handle-based platforms: the user types only the handle/number and we prepend
 * the canonical base URL. Platforms with no clean profile URL (GENERIC) and
 * EMAIL take the raw value as-is. Composed URLs satisfy the backend's
 * per-type LinkUrlValidator.
 */
export const LINK_PREFIX: Record<LinkType, string> = {
  GENERIC: '',
  EMAIL: '',
  WHATSAPP: 'https://wa.me/',
  TELEGRAM: 'https://t.me/',
  INSTAGRAM: 'https://instagram.com/',
  TWITTER: 'https://x.com/',
  LINKEDIN: 'https://linkedin.com/in/',
};

/** Placeholder for the value field (the part after any prefix). */
export const VALUE_PLACEHOLDER: Record<LinkType, string> = {
  GENERIC: 'https://…',
  EMAIL: 'you@example.com',
  WHATSAPP: '15551234567',
  TELEGRAM: 'yourname',
  INSTAGRAM: 'yourname',
  TWITTER: 'yourname',
  LINKEDIN: 'yourname',
};

/** True when the type prepends a fixed base URL (so the UI shows a prefix). */
export function hasPrefix(type: LinkType): boolean {
  return LINK_PREFIX[type] !== '';
}

/** Build the URL to store from what the user typed in the value field. */
export function composeUrl(type: LinkType, input: string): string {
  const value = input.trim();
  if (!hasPrefix(type)) return value;
  return LINK_PREFIX[type] + extractHandle(type, value);
}

/** Inverse of composeUrl for editing: a stored URL → the bare handle/value. */
export function toHandle(type: LinkType, url: string): string {
  if (!hasPrefix(type)) return url;
  return extractHandle(type, url);
}

/**
 * Pull the bare handle out of whatever the user pasted — tolerates a full URL,
 * a leading "@", or just the handle. WhatsApp is reduced to digits.
 */
function extractHandle(type: LinkType, value: string): string {
  let v = value.trim().replace(/^https?:\/\//i, '');
  const bare = LINK_PREFIX[type].replace(/^https?:\/\//i, ''); // e.g. "t.me/"
  if (bare && v.toLowerCase().startsWith(bare.toLowerCase())) {
    v = v.slice(bare.length);
  }
  if (type === 'WHATSAPP') return v.replace(/[^\d]/g, '');
  return v.replace(/^@/, '');
}
