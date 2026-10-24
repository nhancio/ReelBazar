import type { ViewStyle } from 'react-native';

export type ShadowStyle = Pick<
  ViewStyle,
  'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'
>;

/**
 * Native shadows. `elevation` is what actually draws on Android; the shadow* props are iOS.
 * Both are set on every entry so a card looks the same on either platform.
 */
export const shadows: Record<'card' | 'chrome' | 'floating' | 'glow', ShadowStyle> = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 24,
    elevation: 6,
  },
  chrome: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 4,
  },
  floating: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
  glow: {
    shadowColor: '#ff2d78',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 8,
  },
};
