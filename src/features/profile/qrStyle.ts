import { useState } from 'react';
import type { QrColorMode, QrModuleStyle } from './qr';

/**
 * The owner's QR styling preference. Persisted in localStorage (per-browser): the QR is
 * a private sharing tool the owner sees on their Account page — it is never rendered on
 * the public card — so it doesn't need to round-trip the backend. (A future server-side
 * field could make it sync across devices.)
 */
export interface QrStyle {
  colorMode: QrColorMode;
  moduleStyle: QrModuleStyle;
  logo: boolean;
}

export const DEFAULT_QR_STYLE: QrStyle = { colorMode: 'accent', moduleStyle: 'rounded', logo: true };

const KEY = 'beamcard:qr-style';

export function loadQrStyle(): QrStyle {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_QR_STYLE, ...(JSON.parse(raw) as Partial<QrStyle>) } : DEFAULT_QR_STYLE;
  } catch {
    return DEFAULT_QR_STYLE;
  }
}

function saveQrStyle(style: QrStyle): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(style));
  } catch {
    // storage unavailable (private mode / quota) — style just won't persist
  }
}

/** Stateful QR style that auto-persists to localStorage on every change. */
export function useQrStyle(): [QrStyle, (patch: Partial<QrStyle>) => void] {
  const [style, setStyle] = useState<QrStyle>(() => loadQrStyle());
  const update = (patch: Partial<QrStyle>) => {
    setStyle((prev) => {
      const next = { ...prev, ...patch };
      saveQrStyle(next);
      return next;
    });
  };
  return [style, update];
}
