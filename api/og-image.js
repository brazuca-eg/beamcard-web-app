// Vercel Edge function that renders a branded 1200x630 OpenGraph image for a public
// card: avatar + name + tagline + the profile's accent color. Referenced as og:image
// from /api/og so shared links show a proper preview card.
//
// Fonts: Inter is loaded with BOTH latin and cyrillic subsets so Ukrainian/Russian
// names render as glyphs instead of tofu boxes. Satori (under @vercel/og) parses
// woff/ttf/otf — NOT woff2 — so we fetch the .woff files.
import { ImageResponse } from '@vercel/og';
import { createElement as h } from 'react';

export const config = { runtime: 'edge' };

const API_URL = process.env.API_URL || process.env.VITE_API_URL || 'http://localhost:8080';

// Accent hex map — mirrors src/features/profile/accents.ts (kept inline; this edge
// function can't import the client's TS module).
const ACCENTS = {
  INDIGO: { base: '#4f46e5', soft: '#eef2ff' },
  VIOLET: { base: '#7c3aed', soft: '#f5f3ff' },
  BLUE: { base: '#2563eb', soft: '#eff6ff' },
  TEAL: { base: '#0d9488', soft: '#f0fdfa' },
  EMERALD: { base: '#059669', soft: '#ecfdf5' },
  AMBER: { base: '#d97706', soft: '#fffbeb' },
  ROSE: { base: '#e11d48', soft: '#fff1f2' },
  SLATE: { base: '#475569', soft: '#f8fafc' },
};

const FONT = 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5/files';
const fetchBuf = (url) => fetch(url).then((r) => r.arrayBuffer());

export default async function handler(request) {
  const username = (new URL(request.url).searchParams.get('username') || '').trim();

  let profile = null;
  if (username) {
    try {
      const r = await fetch(`${API_URL}/profiles/@${encodeURIComponent(username)}`, {
        headers: { accept: 'application/json' },
      });
      if (r.ok) profile = await r.json();
    } catch {
      // ignore — render a generic Beamcard card
    }
  }

  const name = profile?.display_name || (username ? `@${username}` : 'Beamcard');
  const bio = (profile?.bio || '').trim().slice(0, 120);
  const handle = username ? `@${username}` : '';
  const accent = ACCENTS[profile?.accent_color] || ACCENTS.INDIGO;
  const avatar = profile?.avatar_url || '';
  const initial = (profile?.display_name || username || 'B').replace(/^@/, '').charAt(0).toUpperCase();

  const [latin700, cyr700, latin400, cyr400] = await Promise.all([
    fetchBuf(`${FONT}/inter-latin-700-normal.woff`),
    fetchBuf(`${FONT}/inter-cyrillic-700-normal.woff`),
    fetchBuf(`${FONT}/inter-latin-400-normal.woff`),
    fetchBuf(`${FONT}/inter-cyrillic-400-normal.woff`),
  ]);

  const avatarEl = avatar
    ? h('img', {
        src: avatar,
        width: 220,
        height: 220,
        style: { borderRadius: '9999px', objectFit: 'cover' },
      })
    : h(
        'div',
        {
          style: {
            display: 'flex',
            width: '220px',
            height: '220px',
            borderRadius: '9999px',
            backgroundColor: accent.soft,
            color: accent.base,
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '120px',
            fontWeight: 700,
          },
        },
        initial,
      );

  const nameBlock = h(
    'div',
    { style: { display: 'flex', flexDirection: 'column' } },
    h('div', { style: { fontSize: '72px', fontWeight: 700, color: '#0f172a', lineHeight: 1.1 } }, name),
    handle
      ? h('div', { style: { fontSize: '34px', fontWeight: 700, color: accent.base, marginTop: '10px' } }, handle)
      : null,
    bio
      ? h(
          'div',
          { style: { fontSize: '30px', fontWeight: 400, color: '#475569', marginTop: '22px', maxWidth: '640px' } },
          bio,
        )
      : null,
  );

  const tree = h(
    'div',
    { style: { display: 'flex', width: '100%', height: '100%', backgroundColor: '#ffffff', fontFamily: 'Inter' } },
    // Left accent stripe for a branded edge.
    h('div', { style: { display: 'flex', width: '24px', height: '100%', backgroundColor: accent.base } }),
    h(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flex: 1,
          padding: '72px',
        },
      },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '48px' } }, avatarEl, nameBlock),
      // Wordmark footer.
      h(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: '16px' } },
        h(
          'div',
          {
            style: {
              display: 'flex',
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: accent.base,
              color: '#ffffff',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '30px',
              fontWeight: 700,
            },
          },
          'B',
        ),
        h('div', { style: { fontSize: '32px', fontWeight: 700, color: '#0f172a' } }, 'Beamcard'),
      ),
    ),
  );

  return new ImageResponse(tree, {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Inter', data: latin700, weight: 700, style: 'normal' },
      { name: 'Inter', data: cyr700, weight: 700, style: 'normal' },
      { name: 'Inter', data: latin400, weight: 400, style: 'normal' },
      { name: 'Inter', data: cyr400, weight: 400, style: 'normal' },
    ],
    headers: { 'cache-control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800' },
  });
}
