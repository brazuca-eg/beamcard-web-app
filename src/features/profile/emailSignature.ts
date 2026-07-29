import type { ProfileResponse } from '../../api/profile';

/** A short role/location line under the name — first activity, else the primary location. */
function signatureRole(profile: ProfileResponse): string {
  const activity = profile.activities?.find((a) => a.trim());
  if (activity) return activity.trim();
  const loc = profile.location;
  return loc ? [loc.city, loc.country].filter(Boolean).join(', ') : '';
}

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Inline-styled HTML email signature (a <table>, since email clients strip <style>/classes).
 * Avatar embeds via its public URL; the card link uses the profile's accent color.
 */
export function buildSignatureHtml(profile: ProfileResponse, url: string, accentHex: string): string {
  const name = escapeHtml(profile.display_name?.trim() || `@${profile.username}`);
  const role = escapeHtml(signatureRole(profile));
  const linkLabel = escapeHtml(url.replace(/^https?:\/\//, ''));
  const safeUrl = escapeHtml(url);
  const avatar = profile.avatar_url;

  const avatarCell = avatar
    ? `<td style="padding-right:12px;vertical-align:middle;">` +
      `<img src="${escapeHtml(avatar)}" width="48" height="48" alt="${name}" ` +
      `style="width:48px;height:48px;border-radius:9999px;object-fit:cover;display:block;" /></td>`
    : '';

  const roleRow = role
    ? `<div style="font-size:13px;color:#475569;margin-top:2px;">${role}</div>`
    : '';

  return (
    `<table cellpadding="0" cellspacing="0" border="0" ` +
    `style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;line-height:1.3;"><tbody><tr>` +
    avatarCell +
    `<td style="vertical-align:middle;">` +
    `<div style="font-size:15px;font-weight:bold;color:#0f172a;">${name}</div>` +
    roleRow +
    `<div style="margin-top:4px;">` +
    `<a href="${safeUrl}" style="font-size:13px;color:${accentHex};text-decoration:none;font-weight:600;">` +
    `${linkLabel} &rarr;</a></div>` +
    `</td></tr></tbody></table>`
  );
}

/** Plain-text fallback for editors that don't accept rich clipboard content. */
export function buildSignatureText(profile: ProfileResponse, url: string): string {
  const name = profile.display_name?.trim() || `@${profile.username}`;
  const role = signatureRole(profile);
  return `${name}${role ? ` — ${role}` : ''}\n${url}`;
}

/**
 * Copies the signature so it pastes formatted into Gmail/Outlook: writes both a `text/html`
 * and a `text/plain` flavor. Falls back to plain-text copy where ClipboardItem is unsupported.
 */
export async function copySignature(html: string, text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        }),
      ]);
      return true;
    }
  } catch {
    // fall through to plain-text copy
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
