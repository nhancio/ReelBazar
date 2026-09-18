import { useWindowDimensions, StyleSheet, View, Platform } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { deviceFrame, radius } from '@/theme';

/**
 * Reproduces the web app's desktop treatment: above a 480px viewport it rendered inside a
 * simulated iPhone Pro Max shell (430x932, 40px corners, 8px bezel) so the mobile-first
 * layout didn't stretch across a monitor — see the @media block in the old globals.css.
 *
 * On iOS and Android this is a no-op passthrough: the device IS the frame.
 */
export function AppFrame({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const { palette } = useTheme();

  const framed = Platform.OS === 'web' && width >= deviceFrame.breakpoint;

  if (!framed) {
    return <View style={[styles.fill, { backgroundColor: palette.surface }]}>{children}</View>;
  }

  return (
    <View style={[styles.backdrop, { backgroundColor: palette.background }]}>
      <View
        style={[
          styles.device,
          {
            backgroundColor: palette.surface,
            borderColor: palette.bezel,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  device: {
    width: '100%',
    maxWidth: deviceFrame.maxWidth,
    maxHeight: deviceFrame.maxHeight,
    height: '90%',
    borderRadius: radius.device,
    borderWidth: deviceFrame.bezelWidth,
    overflow: 'hidden',
  },
});
