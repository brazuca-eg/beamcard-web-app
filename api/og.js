// Vercel serverless function that server-renders OpenGraph / Twitter Card meta tags
// for public card URLs (/@username). Social crawlers (WhatsApp, Facebook/Instagram,
// LinkedIn, X, Slack) don't run the SPA's JavaScript, so the per-profile tags must be
// present in the initial HTML. This function starts from the built index.html shell
// (so the page still boots normally for real users) and injects the profile's tags.
//
// Routing: vercel.json rewrites /@:username -> /api/og?username=:username.
// Data: the existing public endpoint GET {API_URL}/profiles/@{username}.

const API_URL = process.env.API_URL || process.env.VITE_API_URL || 'http://localhost:8080';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Trim a bio to a preview-friendly length (social cards clamp anyway). */
function clamp(text, max) {
  const s = String(text ?? '').trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

export default async function handler(req, res) {
  const username = String(req.query.username || '').trim();
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = String(req.headers['x-forwarded-proto'] || 'https');
  const origin = `${proto}://${host}`;

  // Start from the built SPA shell (correct hashed asset paths) so the page still
  // hydrates for real visitors. /index.html is a static file, so this can't loop
  // back into this function.
  let html;
  try {
    const shell = await fetch(`${origin}/index.html`);
    if (!shell.ok) throw new Error(`shell ${shell.status}`);
    html = await shell.text();
  } catch {
    res.status(502).send('Bad gateway');
    return;
  }

  // Best-effort profile lookup — any failure just returns the default shell.
  let profile = null;
  if (username) {
    try {
      const r = await fetch(`${API_URL}/profiles/@${encodeURIComponent(username)}`, {
        headers: { accept: 'application/json' },
      });
      if (r.ok) profile = await r.json();
    } catch {
      // ignore — fall through with the default shell
    }
  }

  if (profile) {
    const name = profile.display_name || `@${profile.username}`;
    const title = `${name} — Beamcard`;
    const description = clamp(
      profile.bio || 'View my Beamcard — links, credentials, and services on one shareable page.',
      200,
    );
    const url = `${origin}/@${profile.username}`;
    // Branded 1200x630 card rendered by the companion edge function (avatar + name +
    // tagline + accent), so previews look like a real card, not a tiny avatar.
    const image = `${origin}/api/og-image?username=${encodeURIComponent(profile.username)}`;

    const tags = [
      '<meta property="og:type" content="profile" />',
      '<meta property="og:site_name" content="Beamcard" />',
      `<meta property="og:title" content="${escapeHtml(title)}" />`,
      `<meta property="og:description" content="${escapeHtml(description)}" />`,
      `<meta property="og:url" content="${escapeHtml(url)}" />`,
      `<meta property="og:image" content="${escapeHtml(image)}" />`,
      '<meta property="og:image:width" content="1200" />',
      '<meta property="og:image:height" content="630" />',
      '<meta property="og:image:type" content="image/png" />',
      '<meta name="twitter:card" content="summary_large_image" />',
      `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
      `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
      `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
    ]
      .filter(Boolean)
      .join('\n    ');

    html = html
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
      .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${escapeHtml(description)}" />`)
      .replace('</head>', `    ${tags}\n  </head>`);
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Cache at the CDN edge; profiles change rarely and crawlers re-scrape on demand.
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=86400');
  res.status(200).send(html);
}
