import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Reel } from '@reelbazaar/config';
import { useTheme } from '@/context/ThemeContext';
import { formatCount } from '@/lib/timeAgo';
import { radius, spacing } from '@/theme';

/**
 * Compact 9:16 tile for grids — search results and the AI answer list.
 *
 * Sized from the live window width rather than a fixed pixel value so it fits a small phone,
 * a tablet, and the 430px desktop frame without three sets of hardcoded numbers.
 */
export function ReelResultCard({ reel, onPress }: { reel: Reel; onPress: () => void }) {
  const { palette } = useTheme();
  const { width } = useWindowDimensions();

  // Two columns inside the app canvas, whatever that canvas happens to be.
  const canvas = Math.min(width, 430);
  const tileWidth = (canvas - spacing.lg * 2 - spacing.md) / 2;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={reel.caption ? `Reel: ${reel.caption}` : 'Open reel'}
      style={({ pressed }) => [
        styles.tile,
        { width: tileWidth, height: tileWidth * (16 / 9), backgroundColor: palette.card },
        pressed && styles.pressed,
      ]}
    >
      {reel.thumbnailUrl ? (
        <Image
          source={{ uri: reel.thumbnailUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
        />
      ) : (
        // thumbnailUrl is still null for every reel server-side (app.MD, gap #13), so this
        // placeholder is the common path, not the edge case.
        <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
          <Ionicons name="play-circle-outline" size={30} color={palette.textMuted} />
        </View>
      )}

      <View style={styles.scrim} />

      <View style={styles.meta}>
        {reel.category ? <Text style={styles.category}>{reel.category}</Text> : null}
        {reel.caption ? (
          <Text style={styles.caption} numberOfLines={2}>
            {reel.caption}
          </Text>
        ) : null}
        <View style={styles.stats}>
          <Ionicons name="heart" size={11} color="#fff" />
          <Text style={styles.statText}>{formatCount(reel.likesCount)}</Text>
          <Ionicons name="eye" size={11} color="#fff" style={styles.statGap} />
          <Text style={styles.statText}>{formatCount(reel.viewsCount)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  meta: { position: 'absolute', left: 8, right: 8, bottom: 8, gap: 3 },
  category: { color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '700' },
  caption: { color: '#fff', fontSize: 12, fontWeight: '600', lineHeight: 15 },
  stats: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  statText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  statGap: { marginLeft: 6 },
});
