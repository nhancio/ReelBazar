import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '@/context/ThemeContext';
import { radius } from '@/theme';

interface Props {
  uri?: string | null;
  /** Used for the initial when there is no image. */
  name?: string | null;
  size?: number;
  /** Draw an accent ring, e.g. for a creator with an active streak. */
  ring?: boolean;
}

export function Avatar({ uri, name, size = 40, ring = false }: Props) {
  const { palette } = useTheme();
  const initial = (name || '?').trim().charAt(0).toUpperCase();

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: radius.pill,
          backgroundColor: palette.accentSoft,
        },
        ring && { borderWidth: 2, borderColor: palette.accent },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          // Blur up from a tiny placeholder instead of popping in — matters in the feed
          // where dozens of avatars load while scrolling.
          transition={150}
          cachePolicy="memory-disk"
          accessibilityLabel={name ? `${name}'s profile picture` : 'Profile picture'}
        />
      ) : (
        <Text style={[styles.initial, { color: palette.accent, fontSize: size * 0.42 }]}>
          {initial}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initial: { fontWeight: '700' },
});
