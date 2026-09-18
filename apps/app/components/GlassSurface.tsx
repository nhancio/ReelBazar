import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/context/ThemeContext';

interface Props {
  children?: React.ReactNode;
  /** Blur strength, 0-100. iOS honours this closely; Android approximates. */
  intensity?: number;
  style?: ViewStyle | ViewStyle[];
  /** Fills the parent instead of laying out inline — for tab-bar backgrounds. */
  absolute?: boolean;
}

/**
 * Frosted-glass surface, the iOS material used by the tab bar, sheets and floating chrome.
 *
 * expo-blur maps to UIVisualEffectView on iOS and a real blur on Android 12+. On older
 * Android and on web the blur degrades to a translucent fill, so a tinted fallback colour is
 * always painted underneath — otherwise text over the "glass" becomes unreadable on the
 * platforms where the blur silently does nothing.
 */
export function GlassSurface({ children, intensity = 60, style, absolute = false }: Props) {
  const { theme } = useTheme();

  // Web's backdrop-filter is real but weaker than the native material; nudge the tint up so
  // contrast holds either way.
  const fallbackTint = theme === 'light' ? 'rgba(255,255,255,0.82)' : 'rgba(10,12,20,0.78)';

  return (
    <View style={[absolute && StyleSheet.absoluteFill, styles.clip, style]}>
      <BlurView
        intensity={intensity}
        tint={theme === 'light' ? 'light' : 'dark'}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: fallbackTint }]} />
      {/* Hairline top edge — the detail that makes iOS chrome read as a distinct layer. */}
      <View
        style={[
          styles.hairline,
          { backgroundColor: theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)' },
        ]}
      />
      {children ? <View style={styles.content}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
    // Android needs an explicit background for the blur to composite against.
    ...(Platform.OS === 'android' ? { backgroundColor: 'transparent' } : null),
  },
  hairline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  content: { flex: 1 },
});
