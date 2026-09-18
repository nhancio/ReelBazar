import type { ViewStyle } from 'react-native';

export type ShadowStyle = Pick<
  ViewStyle,
  'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'
>;

/**
 * Native shadows. `elevation` is what actually draws on Android; the shadow* props are iOS.
 * Both are set on every entry so a card looks the same on either platform.
 */
export const shadows: Record<'card' | 'chrome' | 'floating', ShadowStyle> = {
  // `.rb-card` — 0 8px 32px rgba(131,149,193,0.15)
  card: {
    shadowColor: '#8395c1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 32,
    elevation: 6,
  },
  // `.rb-surface-strong` — 0 4px 24px rgba(131,149,193,0.15)
  chrome: {
    shadowColor: '#8395c1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 4,
  },
  // Toasts and anything that floats above the tab bar.
  floating: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
};
