import type { ViewStyle } from 'react-native';

// react-native-web maps `boxShadow` straight through to CSS, which reproduces the original
// Tailwind shadows exactly. The native shadow* props are ignored here, and passing
// `elevation` on web logs a deprecation warning — so this variant sets neither.
export type ShadowStyle = ViewStyle;

export const shadows: Record<'card' | 'chrome' | 'floating', ShadowStyle> = {
  card: { boxShadow: '0 8px 32px rgba(131,149,193,0.15)' } as ViewStyle,
  chrome: { boxShadow: '0 4px 24px rgba(131,149,193,0.15)' } as ViewStyle,
  floating: { boxShadow: '0 10px 20px rgba(0,0,0,0.25)' } as ViewStyle,
};
