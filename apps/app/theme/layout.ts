/**
 * Spacing, radii and type scale — derived from the Tailwind values the web app used, so
 * the port keeps the same rhythm. See theme/colors.ts for the colour half of the system.
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 16,
  /** Inputs — the old `.rounded-[22px]`. */
  input: 22,
  /** Cards — the old `.rb-card` `.rounded-[32px]`. */
  card: 32,
  /** Device bezel on wide web viewports. */
  device: 40,
  pill: 999,
} as const;

export const typography = {
  /** `.rb-title` — 2rem bold, tight leading. */
  title: { fontSize: 32, fontWeight: '700', lineHeight: 36, letterSpacing: -0.5 },
  heading: { fontSize: 22, fontWeight: '700', lineHeight: 28 },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 24 },
  /** `.rb-subtitle`. */
  subtitle: { fontSize: 16, fontWeight: '400', lineHeight: 26 },
  label: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  caption: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  micro: { fontSize: 11, fontWeight: '700', lineHeight: 14 },
} as const;

/**
 * On wide web viewports the old app rendered inside a simulated iPhone Pro Max frame
 * (430x932, 40px radius, 8px bezel). Native ignores all of this — it IS the phone.
 */
export const deviceFrame = {
  maxWidth: 430,
  maxHeight: 932,
  breakpoint: 480,
  bezelWidth: 8,
} as const;

/** Height of the floating bottom tab bar, so screens can pad their content past it. */
export const TAB_BAR_HEIGHT = 64;
