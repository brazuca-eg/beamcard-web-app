import type { AccentColor } from '../../api/profile';

/**
 * The curated accent palette. Each entry carries the base color and a darker "strong"
 * shade for hover, matching the backend AccentColor enum. Values are Tailwind's 600/700
 * hues so the themed card stays consistent with the rest of the UI.
 */
export const ACCENTS: Record<AccentColor, { base: string; strong: string; soft: string }> = {
  INDIGO: { base: '#4f46e5', strong: '#4338ca', soft: '#eef2ff' },
  VIOLET: { base: '#7c3aed', strong: '#6d28d9', soft: '#f5f3ff' },
  BLUE: { base: '#2563eb', strong: '#1d4ed8', soft: '#eff6ff' },
  TEAL: { base: '#0d9488', strong: '#0f766e', soft: '#f0fdfa' },
  EMERALD: { base: '#059669', strong: '#047857', soft: '#ecfdf5' },
  AMBER: { base: '#d97706', strong: '#b45309', soft: '#fffbeb' },
  ROSE: { base: '#e11d48', strong: '#be123c', soft: '#fff1f2' },
  SLATE: { base: '#475569', strong: '#334155', soft: '#f8fafc' },
};

export const ACCENT_ORDER: AccentColor[] = ['INDIGO', 'VIOLET', 'BLUE', 'TEAL', 'EMERALD', 'AMBER', 'ROSE', 'SLATE'];

export const DEFAULT_ACCENT: AccentColor = 'INDIGO';

/** CSS custom properties for a chosen accent — spread onto a container's `style`. */
export function accentVars(accent: AccentColor | undefined): Record<string, string> {
  const c = ACCENTS[accent ?? DEFAULT_ACCENT] ?? ACCENTS[DEFAULT_ACCENT];
  return {
    '--accent': c.base,
    '--accent-strong': c.strong,
    '--accent-soft': c.soft,
  };
}
