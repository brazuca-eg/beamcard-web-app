import { apiFetch } from '../../api/client';

/**
 * Showcases = before→after case studies. Each showcase has a title, an optional
 * intro (the problem), and ordered steps (image + caption). Wire shapes are
 * snake_case to match profile-service. Own endpoints (not part of the profile
 * payload) since they're image-heavy.
 */

export interface ShowcaseStep {
  image_key: string;
  image_url?: string; // present on reads; absent for freshly-uploaded (local preview used instead)
  description?: string;
}

export interface Showcase {
  title?: string;
  intro?: string;
  steps: ShowcaseStep[];
}

export const SHOWCASE_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/** GET /me/profile/showcases — the owner's showcases. */
export function getMyShowcases(): Promise<Showcase[]> {
  return apiFetch<Showcase[]>('/me/profile/showcases');
}

/** GET /profiles/@{username}/showcases — public. */
export function getPublicShowcases(username: string): Promise<Showcase[]> {
  return apiFetch<Showcase[]>(`/profiles/@${encodeURIComponent(username)}/showcases`);
}

/** PUT /me/profile/showcases — replace the whole set. Returns the saved list (with image URLs). */
export function saveShowcases(showcases: Showcase[]): Promise<Showcase[]> {
  return apiFetch<Showcase[]>('/me/profile/showcases', {
    method: 'PUT',
    body: JSON.stringify({ showcases }),
  });
}

interface UploadTarget {
  upload_url: string;
  key: string;
  expires_at: string;
}

/** Presign → PUT the bytes straight to storage → return the object key to reference in a step. */
export async function uploadShowcaseImage(file: File): Promise<string> {
  const target = await apiFetch<UploadTarget>('/me/profile/showcases/upload-url', {
    method: 'POST',
    body: JSON.stringify({ content_type: file.type }),
  });
  const response = await fetch(target.upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!response.ok) {
    throw new Error(`Upload failed (${response.status})`);
  }
  return target.key;
}
