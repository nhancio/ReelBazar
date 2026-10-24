import type { ViewStyle } from 'react-native';

// react-native-web maps `boxShadow` straight through to CSS, which reproduces the original
// Tailwind shadows exactly. The native shadow* props are ignored here, and passing
// `elevation` on web logs a deprecation warning — so this variant sets neither.
export type ShadowStyle = ViewStyle;

export const shadows: Record<'card' | 'chrome' | 'floating' | 'glow', ShadowStyle> = {
  card: { boxShadow: '0 8px 28px rgba(0, 0, 0, 0.24)' } as ViewStyle,
  chrome: { boxShadow: '0 4px 20px rgba(0, 0, 0, 0.18)' } as ViewStyle,
  floating: { boxShadow: '0 12px 28px rgba(0, 0, 0, 0.35)' } as ViewStyle,
  glow: { boxShadow: '0 6px 20px rgba(255, 45, 120, 0.32)' } as ViewStyle,
};
