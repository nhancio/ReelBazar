import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import type { Reel, BrandProduct } from '@reelbazaar/config';
import { useTheme } from '@/context/ThemeContext';
import { Avatar } from '@/components/Avatar';
import { formatCount } from '@/lib/timeAgo';
import { radius, spacing } from '@/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Props {
  reel: Reel;
  active: boolean;
  height: number;
  width?: number;
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
  onProductPress?: (product: BrandProduct) => void;
}

export function ReelPlayer916({
  reel,
  active,
  height,
  width = SCREEN_WIDTH,
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
  onProductPress,
}: Props) {
  const { palette } = useTheme();
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [showHeartAnim, setShowHeartAnim] = useState(false);
  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;
  const lastTapRef = useRef<number>(0);

  const player = useVideoPlayer(reel.videoUrl || '', (p) => {
    p.loop = true;
    p.muted = muted;
  });

  useEffect(() => {
    player.muted = muted;
  }, [player, muted]);

  useEffect(() => {
    if (active) {
      player.play();
      onView?.();
    } else {
      player.pause();
      player.currentTime = 0;
    }
  }, [active, player, onView]);

  const triggerHeartAnimation = useCallback(() => {
    setShowHeartAnim(true);
    heartScale.setValue(0.3);
    heartOpacity.setValue(1);

    Animated.parallel([
      Animated.spring(heartScale, {
        toValue: 1.3,
        friction: 3,
        useNativeDriver: true,
      }),
      Animated.timing(heartOpacity, {
        toValue: 0,
        duration: 800,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowHeartAnim(false);
    });
  }, [heartScale, heartOpacity]);

  const handleDoubleTapOrSingle = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap -> Like
      if (Platform.OS !== 'web') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
      triggerHeartAnimation();
      if (!liked) {
        onLike?.();
      }
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
      setTimeout(() => {
        if (lastTapRef.current === now) {
          // Single tap -> Toggle mute
          onToggleMuted();
        }
      }, DOUBLE_TAP_DELAY);
    }
  };

  const product = reel.product;
  const showProduct = Boolean(product || (reel.productId && reel.productLink));

  return (
    <View style={[styles.container, { width, height }]}>
      {/* Background Poster fallback */}
      {reel.thumbnailUrl ? (
        <Image
          source={{ uri: reel.thumbnailUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      ) : null}

      {/* Video View */}
      {reel.videoUrl ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
          allowsPictureInPicture={false}
        />
      ) : (
        <View style={styles.noVideoPlaceholder}>
          <Ionicons name="videocam-outline" size={48} color="rgba(255,255,255,0.4)" />
          <Text style={styles.noVideoText}>Video not available</Text>
        </View>
      )}

      {/* Full Tap Area */}
      <Pressable style={StyleSheet.absoluteFill} onPress={handleDoubleTapOrSingle} />

      {/* Top Gradient Vignette */}
      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.2)', 'transparent']}
        style={styles.topVignette}
        pointerEvents="none"
      />

      {/* Bottom Gradient Vignette */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.92)']}
        style={styles.bottomVignette}
        pointerEvents="none"
      />

      {/* Double tap heart animation overlay */}
      {showHeartAnim && (
        <View style={styles.heartAnimContainer} pointerEvents="none">
          <Animated.View
            style={[
              styles.heartAnim,
              {
                transform: [{ scale: heartScale }],
                opacity: heartOpacity,
              },
            ]}
          >
            <Ionicons name="heart" size={100} color="#ff3366" />
          </Animated.View>
        </View>
      )}

      {/* Mute indicator pill */}
      <Pressable onPress={onToggleMuted} style={styles.muteIndicator} hitSlop={8}>
        <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={15} color="#ffffff" />
      </Pressable>

      {/* Right Action Rail */}
      <View style={styles.rightRail}>
        {/* Creator avatar */}
        <Pressable onPress={onProfilePress} style={styles.creatorRailBtn}>
          <Avatar uri={reel.creator?.avatarUrl} name={reel.creator?.name} size={44} ring />
        </Pressable>

        {/* Like */}
        <Pressable
          onPress={() => {
            if (guestMode) onRequireAuth?.();
            else onLike?.();
          }}
          disabled={likeDisabled}
          style={styles.actionBtn}
          hitSlop={6}
        >
          <View style={styles.actionIconWrap}>
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={30}
              color={liked ? '#ff3040' : '#ffffff'}
            />
          </View>
          <Text style={styles.actionText}>{formatCount(reel.likesCount)}</Text>
        </Pressable>

        {/* Comment */}
        <Pressable
          onPress={() => {
            if (guestMode) onRequireAuth?.();
            else onComment?.();
          }}
          style={styles.actionBtn}
          hitSlop={6}
        >
          <View style={styles.actionIconWrap}>
            <Ionicons name="chatbubble-ellipses-outline" size={28} color="#ffffff" />
          </View>
          <Text style={styles.actionText}>{formatCount(reel.commentsCount || 0)}</Text>
        </Pressable>

        {/* Save */}
        <Pressable
          onPress={() => {
            if (guestMode) onRequireAuth?.();
            else onSave?.();
          }}
          disabled={saveDisabled}
          style={styles.actionBtn}
          hitSlop={6}
        >
          <View style={styles.actionIconWrap}>
            <Ionicons
              name={saved ? 'bookmark' : 'bookmark-outline'}
              size={28}
              color={saved ? '#facc15' : '#ffffff'}
            />
          </View>
          <Text style={styles.actionText}>{formatCount(reel.savesCount || 0)}</Text>
        </Pressable>

        {/* Share */}
        <Pressable onPress={onShare} style={styles.actionBtn} hitSlop={6}>
          <View style={styles.actionIconWrap}>
            <Ionicons name="paper-plane-outline" size={26} color="#ffffff" />
          </View>
          <Text style={styles.actionText}>Share</Text>
        </Pressable>

        {/* Buy / Shop Button */}
        {showProduct && (
          <Pressable
            onPress={() => product && onProductPress?.(product)}
            style={[styles.shopBtnRail, { borderColor: palette.accent }]}
            hitSlop={6}
          >
            <LinearGradient
              colors={['#ff3366', '#ff6b3d']}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons name="bag-handle" size={22} color="#ffffff" />
            <Text style={styles.shopRailText}>Buy</Text>
          </Pressable>
        )}
      </View>

      {/* Bottom Left Info & Shoppable Product Pill */}
      <View style={styles.bottomOverlay}>
        {/* Creator Handle & Category */}
        <View style={styles.creatorRow}>
          <Pressable onPress={onProfilePress} style={styles.handlePress}>
            <Text style={styles.creatorHandle}>
              @{reel.creator?.username || reel.creator?.name || 'creator'}
            </Text>
          </Pressable>

          {reel.category && (
            <View style={styles.categoryPill}>
              <Text style={styles.categoryText}>{reel.category}</Text>
            </View>
          )}

          {reel.brandTag && (
            <View style={styles.brandTagPill}>
              <Ionicons name="pricetag" size={10} color="#ffffff" />
              <Text style={styles.brandTagText}>{reel.brandTag}</Text>
            </View>
          )}
        </View>

        {/* Caption */}
        {reel.caption ? (
          <Pressable onPress={() => setCaptionExpanded((e) => !e)} style={styles.captionWrap}>
            <Text
              style={styles.captionText}
              numberOfLines={captionExpanded ? undefined : 2}
            >
              {reel.caption}
            </Text>
          </Pressable>
        ) : null}

        {/* Floating Shoppable Product Pill */}
        {showProduct && product && (
          <Pressable
            onPress={() => onProductPress?.(product)}
            style={({ pressed }) => [
              styles.productPill,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
          >
            <View style={styles.pillImageWrap}>
              {product.imageUrl ? (
                <Image source={{ uri: product.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <View style={[StyleSheet.absoluteFill, styles.pillImageFallback]}>
                  <Ionicons name="bag-handle" size={16} color="#ffffff" />
                </View>
              )}
            </View>

            <View style={styles.pillDetails}>
              <View style={styles.pillBrandRow}>
                <Text style={styles.pillBrandName} numberOfLines={1}>
                  {product.brandName || 'Brand'}
                </Text>
                {product.commissionRate ? (
                  <View style={styles.pillCommBadge}>
                    <Text style={styles.pillCommText}>{product.commissionRate}% comm</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.pillProductName} numberOfLines={1}>
                {product.name}
              </Text>
              <View style={styles.pillPriceRow}>
                <Text style={styles.pillPrice}>₹{product.price?.toLocaleString('en-IN')}</Text>
                {product.originalPrice && product.originalPrice > product.price && (
                  <Text style={styles.pillMrp}>₹{product.originalPrice?.toLocaleString('en-IN')}</Text>
                )}
              </View>
            </View>

            <View style={styles.pillCta}>
              <LinearGradient
                colors={['#ff3366', '#ff6b3d']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.pillCtaText}>Buy Now</Text>
              <Ionicons name="arrow-forward" size={13} color="#ffffff" />
            </View>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000000',
    overflow: 'hidden',
    position: 'relative',
  },
  noVideoPlaceholder: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#11141a',
    gap: spacing.sm,
  },
  noVideoText: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  topVignette: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  bottomVignette: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 300,
  },
  heartAnimContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  heartAnim: {
    shadowColor: '#ff3366',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  muteIndicator: {
    position: 'absolute',
    top: 54,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  rightRail: {
    position: 'absolute',
    right: 12,
    bottom: 110,
    alignItems: 'center',
    gap: 16,
    zIndex: 10,
  },
  creatorRailBtn: {
    marginBottom: 4,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 3,
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  shopBtnRail: {
    width: 44,
    height: 52,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    marginTop: 4,
    shadowColor: '#ff3366',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  shopRailText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 1,
  },
  bottomOverlay: {
    position: 'absolute',
    left: 14,
    right: 76,
    bottom: 96,
    zIndex: 10,
    gap: 8,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  handlePress: {},
  creatorHandle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  categoryPill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  categoryText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  brandTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(236,72,153,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  brandTagText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  captionWrap: {
    maxWidth: '100%',
  },
  captionText: {
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 18,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  productPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 24, 33, 0.92)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    padding: 6,
    gap: 10,
    maxWidth: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  pillImageWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: '#2a303c',
  },
  pillImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff3366',
  },
  pillDetails: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  pillBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillBrandName: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  pillCommBadge: {
    backgroundColor: 'rgba(34,197,94,0.2)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  pillCommText: {
    color: '#22c55e',
    fontSize: 9,
    fontWeight: '800',
  },
  pillProductName: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  pillPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillPrice: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  pillMrp: {
    color: '#94a3b8',
    fontSize: 10,
    textDecorationLine: 'line-through',
  },
  pillCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  pillCtaText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
});
