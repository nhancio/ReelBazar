/**
 * React Native port of packages/ui/src/InstaPostCard.tsx.
 *
 * Structural differences from the web original, all forced by the platform:
 *  - IntersectionObserver -> the feed drives an `active` prop from FlatList viewability.
 *  - `window.open(productLink)` -> expo-web-browser, which presents an in-app browser
 *    (SFSafariViewController / Custom Tabs) instead of ejecting to the system browser.
 *  - Inline SVGs -> Ionicons.
 */
import { useCallback } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import type { Reel } from '@reelbazaar/config';
import { useTheme } from '@/context/ThemeContext';
import { radius, spacing } from '@/theme';
import { formatCount, timeAgo } from '@/lib/timeAgo';
import { Avatar } from './Avatar';
import { ReelVideo } from './ReelVideo';

/** Instagram's brand gradient, reused by the web build for the product CTA. */
const PRODUCT_CTA_GRADIENT = ['#f09433', '#e6683c', '#dc2743', '#cc2366', '#bc1888'] as const;
/** The web card rendered media at aspect-[4/5]. */
const MEDIA_ASPECT = 5 / 4;

interface Props {
  reel: Reel;
  active: boolean;
  muted: boolean;
  onToggleMuted: () => void;
  liked?: boolean;
  saved?: boolean;
  likeDisabled?: boolean;
  saveDisabled?: boolean;
  guestMode?: boolean;
  onRequireAuth?: () => void;
  onLike?: () => void;
  onSave?: () => void;
  onShare?: () => void;
  onComment?: () => void;
  onProfilePress?: () => void;
  onView?: () => void;
  onProductLinkPress?: () => void;
}

const displayName = (user?: Reel['creator']) => user?.username || user?.name || 'User';

function isHttpUrl(s: string | undefined | null): s is string {
  return Boolean(s && /^https?:\/\//i.test(s.trim()));
}

export function ReelPostCard({
  reel,
  active,
  muted,
  onToggleMuted,
  liked,
  saved,
  likeDisabled,
  saveDisabled,
  guestMode,
  onRequireAuth,
  onLike,
  onSave,
  onShare,
  onComment,
  onProfilePress,
  onView,
  onProductLinkPress,
}: Props) {
  const { palette, theme } = useTheme();
  const { width } = useWindowDimensions();

  // The card is full-bleed, but on wide web viewports the AppFrame clamps the app to 430px.
  const cardWidth = Math.min(width, 430);
  const mediaHeight = cardWidth * MEDIA_ASPECT;

  const gated = useCallback(
    (action?: () => void, allowGuest = false) =>
      () => {
        if (guestMode && !allowGuest) {
          onRequireAuth?.();
          return;
        }
        action?.();
      },
    [guestMode, onRequireAuth]
  );

  const handleProductPress = useCallback(async () => {
    onProductLinkPress?.();
    const url = reel.productLink?.trim();
    if (!isHttpUrl(url)) return;

    if (Platform.OS === 'web') {
      // openBrowserAsync on web just calls window.open, but going through Linking keeps
      // the same-tab/new-tab decision with the platform.
      void Linking.openURL(url);
      return;
    }
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      void Linking.openURL(url).catch(() => {});
    }
  }, [onProductLinkPress, reel.productLink]);

  const showProductCta = isHttpUrl(reel.productLink);
  const iconColor = palette.text;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme === 'light' ? '#ffffff' : '#000000', borderBottomColor: palette.border },
      ]}
    >
      {/* Header */}
      <Pressable style={styles.header} onPress={onProfilePress} accessibilityRole="button">
        <Avatar uri={reel.creator?.avatarUrl} name={displayName(reel.creator)} size={32} ring />
        <View style={styles.headerText}>
          <Text style={[styles.username, { color: palette.text }]} numberOfLines={1}>
            {displayName(reel.creator)}
          </Text>
          <Text style={[styles.meta, { color: palette.textMuted }]} numberOfLines={1}>
            {reel.creator?.brandName ? `${reel.creator.brandName} · ` : ''}
            {reel.createdAt ? timeAgo(reel.createdAt) : ''}
          </Text>
        </View>
      </Pressable>

      {/* Media */}
      <View style={[styles.media, { height: mediaHeight, backgroundColor: palette.videoBackdrop }]}>
        {reel.videoUrl ? (
          <ReelVideo
            uri={reel.videoUrl}
            thumbnailUri={reel.thumbnailUrl}
            active={active}
            muted={muted}
            onToggleMuted={onToggleMuted}
            onFirstPlay={onView}
            height={mediaHeight}
          />
        ) : (
          <View style={styles.mediaFallback}>
            <Text style={[styles.fallbackText, { color: palette.textSecondary }]}>
              No video URL for this reel.
            </Text>
            {showProductCta ? (
              <Text style={[styles.fallbackHint, { color: palette.textMuted }]}>
                Use View product to open the link.
              </Text>
            ) : null}
          </View>
        )}

        <Pressable
          onPress={onToggleMuted}
          style={styles.muteToggle}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={muted ? 'Unmute video' : 'Mute video'}
        >
          <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={14} color="#ffffff" />
        </Pressable>
      </View>

      {/* Product CTA */}
      {showProductCta ? (
        <View style={styles.ctaWrap}>
          <Pressable
            onPress={handleProductPress}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
            accessibilityRole="button"
          >
            <LinearGradient
              colors={[...PRODUCT_CTA_GRADIENT]}
              start={{ x: 0, y: 1 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons name="bag-handle-outline" size={16} color="#ffffff" />
            <Text style={styles.ctaText}>View product</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Actions */}
      <View style={styles.actions}>
        <View style={styles.actionsLeft}>
          <Pressable
            onPress={gated(onLike)}
            disabled={likeDisabled}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={liked ? 'Unlike' : 'Like'}
            style={({ pressed }) => [pressed && styles.pressed, likeDisabled && styles.disabled]}
          >
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={26}
              color={liked ? '#ff3040' : iconColor}
            />
          </Pressable>

          <Pressable
            onPress={gated(onComment)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Comments"
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            <Ionicons name="chatbubble-outline" size={24} color={iconColor} />
          </Pressable>

          <Pressable
            onPress={gated(onShare, true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Share"
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            <Ionicons name="paper-plane-outline" size={22} color={iconColor} />
          </Pressable>
        </View>

        <Pressable
          onPress={gated(onSave)}
          disabled={saveDisabled}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Remove from saved' : 'Save'}
          style={({ pressed }) => [pressed && styles.pressed, saveDisabled && styles.disabled]}
        >
          <Ionicons
            name={saved ? 'bookmark' : 'bookmark-outline'}
            size={24}
            color={saved ? '#facc15' : iconColor}
          />
        </Pressable>
      </View>

      {/* Counts */}
      <View style={styles.counts}>
        <Text style={[styles.countStrong, { color: palette.text }]}>
          {formatCount(reel.likesCount)} likes
        </Text>
        <Text style={[styles.dot, { color: palette.textMuted }]}>·</Text>
        <View style={styles.viewRow}>
          <Ionicons name="eye" size={14} color={palette.textSecondary} />
          <Text style={[styles.countMuted, { color: palette.textSecondary }]}>
            {formatCount(reel.viewsCount)} views
          </Text>
        </View>
        {(reel.commentsCount ?? 0) > 0 ? (
          <>
            <Text style={[styles.dot, { color: palette.textMuted }]}>·</Text>
            <Pressable onPress={gated(onComment)} hitSlop={6}>
              <Text style={[styles.countMuted, { color: palette.textSecondary }]}>
                {formatCount(reel.commentsCount)} comments
              </Text>
            </Pressable>
          </>
        ) : null}
      </View>

      {/* Caption */}
      {reel.caption ? (
        <Text style={[styles.caption, { color: palette.text }]}>
          <Text style={styles.captionName}>{displayName(reel.creator)} </Text>
          {reel.caption}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  headerText: { flex: 1 },
  username: { fontSize: 13, fontWeight: '600', letterSpacing: -0.2 },
  meta: { fontSize: 11, marginTop: 1 },
  media: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  mediaFallback: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  fallbackText: { fontSize: 14, textAlign: 'center' },
  fallbackHint: { fontSize: 12, textAlign: 'center' },
  muteToggle: {
    position: 'absolute',
    bottom: spacing.md,
    right: spacing.md,
    height: 28,
    width: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  ctaWrap: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xs },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  ctaText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  actionsLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  pressed: { opacity: 0.5 },
  disabled: { opacity: 0.6 },
  counts: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  countStrong: { fontSize: 13, fontWeight: '600' },
  countMuted: { fontSize: 13, fontWeight: '600' },
  viewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { fontSize: 13 },
  caption: { paddingHorizontal: spacing.md, fontSize: 13, lineHeight: 18 },
  captionName: { fontWeight: '600' },
});
