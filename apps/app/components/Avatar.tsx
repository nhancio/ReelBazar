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
  const cleanName = (name || '').trim();
  const initial = cleanName && cleanName !== '?' ? cleanName.charAt(0).toUpperCase() : 'R';

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: radius.pill,
          backgroundColor: palette.cardElevated,
          borderWidth: ring ? 2 : 1,
          borderColor: ring ? palette.accent : palette.borderStrong,
        },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
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
