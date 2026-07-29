import { API_BASE_URL, apiFetch, apiFetchText } from './client';

/**
 * Wire shapes for profile-service. snake_case to match its Jackson config
 * (spring.jackson.property-naming-strategy: SNAKE_CASE). Nullable fields are
 * optional because the service omits nulls (default-property-inclusion:
 * non_null). Backend: com.beamcard.profile.rest.model.{request,response}.*
 */

export type LinkType =
  | 'GENERIC'
  | 'WHATSAPP'
  | 'TELEGRAM'
  | 'INSTAGRAM'
  | 'TWITTER'
  | 'LINKEDIN'
  | 'EMAIL';

export interface LinkResponse {
  id: string;
  label: string;
  url: string;
  type: LinkType;
  position: number;
}

/** The single currency chosen for the whole profile's price list. */
export type Currency = 'USD' | 'EUR' | 'UAH';

/** Preset accent color for the public card (must match the backend AccentColor enum). */
export type AccentColor = 'INDIGO' | 'VIOLET' | 'BLUE' | 'TEAL' | 'EMERALD' | 'AMBER' | 'ROSE' | 'SLATE';

/**
 * How a service is priced:
 * EXACT/FROM use only amount_min; RANGE uses both amount_min and amount_max.
 */
export type PriceType = 'EXACT' | 'FROM' | 'RANGE';

/** One line of the price list: a service name (≤500 chars) + its price. */
export interface PriceItem {
  name: string;
  price_type: PriceType;
  /** The price (EXACT / FROM) or the lower bound (RANGE). */
  amount_min?: number;
  /** The upper bound — RANGE only. */
  amount_max?: number;
}

/** The profile's primary location (country + city); omitted when none is set. */
export interface Location {
  country?: string;
  city?: string;
}

/** Weekday keys as the backend emits them (java.time.DayOfWeek). */
export type DayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

/** One opening interval, e.g. { day: 'MONDAY', open: '09:00', close: '13:00' }. */
export interface OpeningHours {
  day: DayOfWeek;
  open: string;
  close: string;
}

/** One workplace: a role at an organization + its street address (within the primary city). */
export interface Affiliation {
  role?: string;
  organization?: string;
  address?: string;
  /** Optional free-text "how to find it" note. */
  description?: string;
  /** This workplace's weekly opening hours (flat list of intervals; empty = none set). */
  opening_hours?: OpeningHours[];
}

/** One uploaded certificate/diploma image; image_url is a public storage URL. */
export interface AwardResponse {
  id: string;
  image_url: string;
  /** Optional caption (e.g. issuing institution / what it certifies). */
  description?: string;
  position: number;
}

export interface ProfileResponse {
  id: string;
  username: string;
  display_name?: string;
  bio?: string;
  /** Contact phone in E.164 (e.g. +380671234567). */
  phone?: string;
  location?: Location;
  affiliations?: Affiliation[];
  /** Main directions of professional activity — a plain list of strings. */
  activities?: string[];
  /** Profile-wide currency for the price list; defaults to USD server-side. */
  currency?: Currency;
  /** Price list — services with names and prices, ordered. */
  price_items?: PriceItem[];
  /** Accent color for the public card; defaults to INDIGO server-side. */
  accent_color?: AccentColor;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
  links: LinkResponse[];
  awards: AwardResponse[];
  /** The creator's chosen UI language (en/de/uk) — the public card renders in it. */
  locale: string;
}

/** PUT body — partial; an omitted field leaves the stored value unchanged. */
export interface UpdateProfileRequest {
  display_name?: string;
  bio?: string;
  /** E.164 phone, or '' to clear. */
  phone?: string;
  location?: Location;
  affiliations?: Affiliation[];
  activities?: string[];
  currency?: Currency;
  price_items?: PriceItem[];
  accent_color?: AccentColor;
}

/**
 * GET /me/profile — the caller's own profile. Auto-provisions an empty profile
 * (from the JWT claims) on first call, so this never 404s for a logged-in user.
 */
export function getMyProfile(): Promise<ProfileResponse> {
  return apiFetch<ProfileResponse>('/me/profile');
}

/** PUT /me/profile — update the caller's display name / bio. */
export function updateMyProfile(req: UpdateProfileRequest): Promise<ProfileResponse> {
  return apiFetch<ProfileResponse>('/me/profile', {
    method: 'PUT',
    body: JSON.stringify(req),
  });
}

/**
 * GET /profiles/@{username} — the public card. Anonymous (no token). An unknown
 * username throws ApiError(404) carrying `code: 'profile_not_found'`.
 */
export function getPublicProfile(username: string): Promise<ProfileResponse> {
  return apiFetch<ProfileResponse>(`/profiles/@${encodeURIComponent(username)}`);
}

/**
 * DELETE /me/profile — permanently delete the caller's card: all rows (cascade)
 * plus every stored image (avatar, certificates, showcases). 204 on success.
 * Idempotent. Call this before deleting the account (needs a still-valid token).
 */
export function deleteMyProfile(): Promise<void> {
  return apiFetch<void>('/me/profile', { method: 'DELETE' });
}

/* ------------------------------- links -------------------------------- */

/** POST body for a new link. */
export interface CreateLinkRequest {
  label: string;
  url: string;
  type: LinkType;
}

/** PUT body — partial; an omitted field is left unchanged. */
export interface UpdateLinkRequest {
  label?: string;
  url?: string;
  type?: LinkType;
}

/** POST /me/profile/links — append a link to the caller's card. */
export function createLink(req: CreateLinkRequest): Promise<LinkResponse> {
  return apiFetch<LinkResponse>('/me/profile/links', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

/** PUT /me/profile/links/{id} — edit one of the caller's links. */
export function updateLink(id: string, req: UpdateLinkRequest): Promise<LinkResponse> {
  return apiFetch<LinkResponse>(`/me/profile/links/${id}`, {
    method: 'PUT',
    body: JSON.stringify(req),
  });
}

/** DELETE /me/profile/links/{id} — remove one of the caller's links. */
export function deleteLink(id: string): Promise<void> {
  return apiFetch<void>(`/me/profile/links/${id}`, { method: 'DELETE' });
}

/** PUT /me/profile/links/order — reorder the caller's links to match `ids`. */
export function reorderLinks(ids: string[]): Promise<LinkResponse[]> {
  return apiFetch<LinkResponse[]>('/me/profile/links/order', {
    method: 'PUT',
    body: JSON.stringify({ ids }),
  });
}

/* ------------------------------ avatar -------------------------------- */

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // mirrors backend beamcard.avatar.max-size-bytes
export const AVATAR_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

interface UploadTarget {
  upload_url: string;
  key: string;
  expires_at: string;
}

/** Step 1 — ask the service for a presigned PUT target for the given content type. */
function requestAvatarUploadUrl(contentType: string): Promise<UploadTarget> {
  return apiFetch<UploadTarget>('/me/profile/avatar/upload-url', {
    method: 'POST',
    body: JSON.stringify({ content_type: contentType }),
  });
}

/** Step 2 — PUT the bytes straight to object storage (NOT the gateway): no auth header, raw body. */
async function putBytes(uploadUrl: string, file: File): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!response.ok) {
    throw new Error(`Upload failed (${response.status})`);
  }
}

/** Step 3 — confirm the upload; the service validates and saves the avatar key. */
function confirmAvatar(key: string): Promise<ProfileResponse> {
  return apiFetch<ProfileResponse>('/me/profile/avatar', {
    method: 'PUT',
    body: JSON.stringify({ key }),
  });
}

/** Full avatar upload: presign → PUT bytes → confirm. Returns the updated profile. */
export async function uploadAvatar(file: File): Promise<ProfileResponse> {
  const target = await requestAvatarUploadUrl(file.type);
  await putBytes(target.upload_url, file);
  return confirmAvatar(target.key);
}

/** DELETE /me/profile/avatar — clear the avatar. */
export function removeAvatar(): Promise<ProfileResponse> {
  return apiFetch<ProfileResponse>('/me/profile/avatar', { method: 'DELETE' });
}

/* ------------------------------- awards ------------------------------- */

export const AWARD_MAX_BYTES = 5 * 1024 * 1024; // mirrors backend beamcard.award.max-size-bytes
export const AWARD_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/** Step 1 — presigned PUT target for an award image. */
function requestAwardUploadUrl(contentType: string): Promise<UploadTarget> {
  return apiFetch<UploadTarget>('/me/profile/awards/upload-url', {
    method: 'POST',
    body: JSON.stringify({ content_type: contentType }),
  });
}

/** Step 3 — confirm the upload; the service validates and creates the award row. */
function confirmAward(key: string): Promise<AwardResponse> {
  return apiFetch<AwardResponse>('/me/profile/awards', {
    method: 'POST',
    body: JSON.stringify({ key }),
  });
}

/** Full award upload: presign → PUT bytes → confirm. Returns the new award. */
export async function uploadAward(file: File): Promise<AwardResponse> {
  const target = await requestAwardUploadUrl(file.type);
  await putBytes(target.upload_url, file);
  return confirmAward(target.key);
}

/** PUT /me/profile/awards/{id} — set or clear the caption on one award. */
export function updateAward(id: string, description: string): Promise<AwardResponse> {
  return apiFetch<AwardResponse>(`/me/profile/awards/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ description }),
  });
}

/** DELETE /me/profile/awards/{id} — remove one award (and its stored image). */
export function deleteAward(id: string): Promise<void> {
  return apiFetch<void>(`/me/profile/awards/${id}`, { method: 'DELETE' });
}

/** PUT /me/profile/awards/order — reorder the caller's awards to match `ids`. */
export function reorderAwards(ids: string[]): Promise<AwardResponse[]> {
  return apiFetch<AwardResponse[]>('/me/profile/awards/order', {
    method: 'PUT',
    body: JSON.stringify({ ids }),
  });
}

/* ------------------------------- share -------------------------------- */

/** The public, shareable URL for a card (same origin as the SPA). */
export function publicCardUrl(username: string): string {
  return `${window.location.origin}/@${username}`;
}

/**
 * Direct link to the downloadable vCard (.vcf) for a public card. Points at the
 * gateway, not the SPA; the server sends Content-Disposition: attachment, so
 * the browser downloads it.
 */
export function publicVcardUrl(username: string): string {
  return `${API_BASE_URL}/profiles/@${encodeURIComponent(username)}/vcard`;
}

/** GET /me/profile/qr — the caller's QR code as an SVG string (authenticated). */
export function getMyProfileQr(): Promise<string> {
  return apiFetchText('/me/profile/qr');
}
