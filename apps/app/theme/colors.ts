/**
 * Single source of truth for every colour in the Rava app.
 *
 * Brand Identity: "Obsidian & Electric Rose" — High-contrast luxury fashion social-commerce.
 * Signature Rava Pink (#FF2D78 -> #E11D62) paired with deep couture obsidian surfaces
 * in dark mode and warm alabaster ivory in light mode. Zero blue/slate-blue hues.
 */

export type ThemeName = 'dark' | 'light';

export interface Palette {
  /** Page canvas behind everything. */
  background: string;
  /** The scrollable app surface (the "phone screen" on desktop web). */
  surface: string;
  /** Opaque elevated surface for bottom drawers, sheets, and modals (never see-through). */
  sheet: string;
  /** Raised card surface. */
  card: string;
  /** Solid elevated card surface inside sheets/modals and featured cards. */
  cardElevated: string;
  /** Solid input field fill. */
  inputBg: string;
  /** Nav bars and floating chrome. */
  chrome: string;
  /** Stronger chrome variant. */
  chromeStrong: string;
  /** Hairline borders on cards and chrome. */
  border: string;
  /** Stronger border for inputs and elevated cards. */
  borderStrong: string;
  /** Border on interactive chips and active inputs. */
  borderInteractive: string;

  /** Aura Liquid Glass material tokens */
  glassFill: string;
  glassFillStrong: string;
  glassBorder: string;
  glassEdge: string;
  glassEdgeSoft: string;
  glassSheen: string;
  glassShadow: string;

  text: string;
  textSecondary: string;
  textMuted: string;
  /** Text drawn on top of an accent fill. */
  textOnAccent: string;

  accent: string;
  accentStrong: string;
  /** [start, end] for primary CTA & active chip gradients. */
  accentGradient: readonly [string, string];
  accentSoft: string;
  accentGlow: string;

  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  /** Streak flame + hot badges. */
  streak: string;

  /** Full-bleed video backdrop. Always black — video letterboxing must not show a tint. */
  videoBackdrop: string;
  /** Scrim over video so overlaid text stays legible. */
  scrim: string;
  /** Device bezel drawn around the app on wide web viewports. */
  bezel: string;
}

const darkAccentGradient = ['#ff2d78', '#e11d62'] as const;
const lightAccentGradient = ['#ff2d78', '#d61f69'] as const;

export const darkPalette: Palette = {
  background: '#08080a',
  surface: '#0d0d11',
  sheet: '#121217',
  card: '#14141a',
  cardElevated: '#1a1a22',
  inputBg: '#181820',
  chrome: 'rgba(14, 14, 19, 0.88)',
  chromeStrong: 'rgba(8, 8, 10, 0.96)',
  border: 'rgba(255, 255, 255, 0.09)',
  borderStrong: 'rgba(255, 255, 255, 0.16)',
  borderInteractive: 'rgba(255, 45, 120, 0.38)',

  glassFill: 'rgba(255, 255, 255, 0.07)',
  glassFillStrong: 'rgba(255, 255, 255, 0.14)',
  glassBorder: 'rgba(255, 255, 255, 0.18)',
  glassEdge: 'rgba(255, 255, 255, 0.28)',
  glassEdgeSoft: 'rgba(255, 255, 255, 0.10)',
  glassSheen: 'rgba(255, 255, 255, 0.45)',
  glassShadow: 'rgba(8, 8, 12, 0.55)',

  text: '#fafafc',
  textSecondary: '#d4d4dc',
  textMuted: '#8e8e9e',
  textOnAccent: '#ffffff',

  accent: '#ff2d78',
  accentStrong: '#e11d62',
  accentGradient: darkAccentGradient,
  accentSoft: 'rgba(255, 45, 120, 0.15)',
  accentGlow: 'rgba(255, 45, 120, 0.28)',

  success: '#10b981',
  successSoft: 'rgba(16, 185, 129, 0.15)',
  danger: '#f43f5e',
  dangerSoft: 'rgba(244, 63, 94, 0.15)',
  warning: '#f59e0b',
  warningSoft: 'rgba(245, 158, 11, 0.15)',
  streak: '#ff5533',

  videoBackdrop: '#000000',
  scrim: 'rgba(0, 0, 0, 0.55)',
  bezel: '#18181f',
};

export const lightPalette: Palette = {
  background: '#faf7f8',
  surface: '#ffffff',
  sheet: '#ffffff',
  card: '#ffffff',
  cardElevated: '#f6f1f4',
  inputBg: '#f4eef1',
  chrome: 'rgba(255, 255, 255, 0.92)',
  chromeStrong: 'rgba(250, 247, 248, 0.97)',
  border: 'rgba(24, 16, 22, 0.09)',
  borderStrong: 'rgba(24, 16, 22, 0.16)',
  borderInteractive: 'rgba(225, 29, 98, 0.32)',

  glassFill: 'rgba(255, 255, 255, 0.42)',
  glassFillStrong: 'rgba(255, 255, 255, 0.62)',
  glassBorder: 'rgba(255, 255, 255, 0.68)',
  glassEdge: 'rgba(255, 255, 255, 0.88)',
  glassEdgeSoft: 'rgba(24, 16, 22, 0.08)',
  glassSheen: 'rgba(255, 255, 255, 0.78)',
  glassShadow: 'rgba(225, 29, 98, 0.16)',

  text: '#120e12',
  textSecondary: '#4a4248',
  textMuted: '#786e76',
  textOnAccent: '#ffffff',

  accent: '#e11d62',
  accentStrong: '#be1250',
  accentGradient: lightAccentGradient,
  accentSoft: 'rgba(225, 29, 98, 0.12)',
  accentGlow: 'rgba(225, 29, 98, 0.22)',

  success: '#059669',
  successSoft: 'rgba(5, 150, 105, 0.12)',
  danger: '#e11d48',
  dangerSoft: 'rgba(225, 29, 72, 0.12)',
  warning: '#d97706',
  warningSoft: 'rgba(217, 119, 6, 0.12)',
  streak: '#ea580c',

  videoBackdrop: '#000000',
  scrim: 'rgba(0, 0, 0, 0.55)',
  bezel: '#272026',
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
