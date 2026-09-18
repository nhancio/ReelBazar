/**
 * Single source of truth for every colour in the app.
 *
 * These values are lifted directly from the Vite app's Tailwind layer
 * (apps/web-app/src/styles/globals.css) so the Expo port is visually identical to what
 * shipped on web. Nothing should hard-code a hex outside this file — if a screen needs a
 * colour that isn't here, add it here first.
 *
 * The app is dark-first (the web build defaulted `data-theme` to 'dark'), but both palettes
 * are complete so the existing user-level `themePreference` keeps working.
 */

export type ThemeName = 'dark' | 'light';

export interface Palette {
  /** Page canvas behind everything. */
  background: string;
  /** The scrollable app surface (the "phone screen" on desktop web). */
  surface: string;
  /** Raised card surface — the old `.rb-card`. */
  card: string;
  /** Nav bars and floating chrome — the old `.rb-surface`. */
  chrome: string;
  /** Stronger chrome variant — the old `.rb-surface-strong`. */
  chromeStrong: string;
  /** Hairline borders on cards and chrome. */
  border: string;
  /** Border on interactive chips. */
  borderInteractive: string;

  text: string;
  textSecondary: string;
  textMuted: string;
  /** Text drawn on top of an accent fill. */
  textOnAccent: string;

  accent: string;
  accentStrong: string;
  /** [start, end] for the `.rb-chip-active` gradient. */
  accentGradient: readonly [string, string];
  accentSoft: string;

  success: string;
  danger: string;
  warning: string;
  /** Streak flame + hot badges. */
  streak: string;

  /** Full-bleed video backdrop. Always black — video letterboxing must not show a tint. */
  videoBackdrop: string;
  /** Scrim over video so overlaid text stays legible. */
  scrim: string;
  /** Device bezel drawn around the app on wide web viewports. */
  bezel: string;
}

const accentGradient = ['#8fb7ff', '#718ce8'] as const;

export const darkPalette: Palette = {
  background: '#020617',
  surface: '#000000',
  card: 'rgba(255,255,255,0.06)',
  chrome: 'rgba(15,23,42,0.72)',
  chromeStrong: 'rgba(2,6,23,0.88)',
  border: 'rgba(255,255,255,0.12)',
  borderInteractive: 'rgba(127,156,224,0.35)',

  text: '#f8fafc',
  textSecondary: '#cbd5e1',
  textMuted: '#94a3b8',
  textOnAccent: '#ffffff',

  accent: '#8fb7ff',
  accentStrong: '#718ce8',
  accentGradient,
  accentSoft: 'rgba(143,183,255,0.16)',

  success: '#16a34a',
  danger: '#dc2626',
  warning: '#d97706',
  streak: '#f97316',

  videoBackdrop: '#000000',
  scrim: 'rgba(0,0,0,0.45)',
  bezel: '#1e293b',
};

export const lightPalette: Palette = {
  background: '#f1f5f9',
  surface: '#f8fafc',
  card: 'rgba(255,255,255,0.60)',
  chrome: 'rgba(255,255,255,0.70)',
  chromeStrong: 'rgba(255,255,255,0.85)',
  border: 'rgba(255,255,255,0.80)',
  borderInteractive: 'rgba(127,156,224,0.30)',

  text: '#1e293b',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  textOnAccent: '#ffffff',

  accent: '#8fb7ff',
  accentStrong: '#718ce8',
  accentGradient,
  accentSoft: 'rgba(143,183,255,0.16)',

  success: '#16a34a',
  danger: '#dc2626',
  warning: '#d97706',
  streak: '#f97316',

  videoBackdrop: '#000000',
  scrim: 'rgba(0,0,0,0.45)',
  bezel: '#1e293b',
};

export const palettes: Record<ThemeName, Palette> = {
  dark: darkPalette,
  light: lightPalette,
};

/**
 * Static default for module-scope StyleSheet.create calls, which run before any provider
 * mounts and therefore cannot read the active theme. Anything that must respond to a theme
 * change has to read the palette from `useTheme()` at render time instead.
 */
export const colors = darkPalette;
