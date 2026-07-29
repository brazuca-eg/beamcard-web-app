import QRCode from 'qrcode';
import type { AccentColor } from '../../api/profile';
import { ACCENTS, DEFAULT_ACCENT } from './accents';

export type QrModuleStyle = 'rounded' | 'square' | 'dots';
export type QrColorMode = 'accent' | 'black';

export interface QrRenderOptions {
  /** Accent used when colorMode is 'accent'. */
  accent?: AccentColor;
  colorMode?: QrColorMode;
  moduleStyle?: QrModuleStyle;
  /** Show the center Beamcard logo (requires the knockout area). */
  logo?: boolean;
}

const RADIUS: Record<QrModuleStyle, number> = { rounded: 0.28, square: 0, dots: 0.5 };

/**
 * Builds a self-contained, branded QR code as an SVG string. Style is configurable
 * (color, module shape, center logo) but always high-contrast on white with EC-H, so
 * every variant stays scannable. The SVG feeds the preview / PNG-rasterize / print
 * pipeline unchanged.
 */
export function buildQrSvg(text: string, opts: QrRenderOptions = {}): string {
  const accentDef = ACCENTS[opts.accent ?? DEFAULT_ACCENT] ?? ACCENTS[DEFAULT_ACCENT];
  const dark = opts.colorMode === 'black' ? '#0f172a' : accentDef.strong;
  const rx = RADIUS[opts.moduleStyle ?? 'rounded'];
  const showLogo = opts.logo !== false;

  const qr = QRCode.create(text, { errorCorrectionLevel: 'H' });
  const n = qr.modules.size;
  const data = qr.modules.data; // 1 = dark module
  const margin = 4; // quiet zone (modules) — required for reliable scanning
  const dim = n + margin * 2;

  // Clear a square in the center for the logo (~24% of the code); EC-H tolerates it.
  const logoN = Math.round(n * 0.24);
  const logoStart = Math.floor((n - logoN) / 2);
  const logoEnd = logoStart + logoN;

  let modules = '';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!data[y * n + x]) continue;
      if (showLogo && x >= logoStart && x < logoEnd && y >= logoStart && y < logoEnd) continue; // logo knockout
      modules += `<rect x="${x + margin}" y="${y + margin}" width="1" height="1" rx="${rx}" ry="${rx}"/>`;
    }
  }

  let logo = '';
  if (showLogo) {
    const lx = logoStart + margin;
    const ly = logoStart + margin;
    const pad = 0.7; // white ring around the logo so it reads cleanly
    logo =
      `<rect x="${lx - pad}" y="${ly - pad}" width="${logoN + pad * 2}" height="${logoN + pad * 2}" rx="${logoN * 0.3}" fill="#ffffff"/>` +
      `<rect x="${lx}" y="${ly}" width="${logoN}" height="${logoN}" rx="${logoN * 0.26}" fill="${dark}"/>` +
      `<text x="${lx + logoN / 2}" y="${ly + logoN / 2}" font-family="Inter, system-ui, -apple-system, sans-serif" font-weight="700" font-size="${logoN * 0.62}" fill="#ffffff" text-anchor="middle" dominant-baseline="central">B</text>`;
  }

  const px = dim * 20; // intrinsic size (square) for crisp rasterization
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${px}" height="${px}">` +
    `<rect width="${dim}" height="${dim}" fill="#ffffff"/>` +
    `<g fill="${dark}">${modules}</g>` +
    logo +
    `</svg>`
  );
}
