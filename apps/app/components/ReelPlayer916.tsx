import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Animated,
  Dimensions,
  Linking,
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
import * as WebBrowser from 'expo-web-browser';
import type { Reel, BrandProduct } from '@reelbazaar/config';
import { useTheme } from '@/context/ThemeContext';
import { Avatar } from '@/components/Avatar';
import { GlassSurface } from '@/components/GlassSurface';
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

  const product = reel.product && reel.product.id !== 'sample_prod_1' ? reel.product : undefined;
  const showProduct = Boolean(product);
  const externalProductUrl =
    !product && reel.productLink && /^https?:\/\//i.test(reel.productLink.trim())
      ? reel.productLink.trim()
      : null;

  const openExternalLink = useCallback(async (url: string) => {
    if (Platform.OS === 'web') {
      void Linking.openURL(url);
      return;
    }
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      void Linking.openURL(url).catch(() => {});
    }
  }, []);

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
            <Ionicons name="heart" size={100} color="#ff2d78" />
          </Animated.View>
        </View>
      )}

      {/* Mute indicator pill */}
      <Pressable
        onPress={() => {
          if (Platform.OS !== 'web') {
            void Haptics.selectionAsync().catch(() => {});
          }
          onToggleMuted();
        }}
        style={styles.muteIndicator}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={muted ? 'Unmute video' : 'Mute video'}
      >
        <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={17} color="#ffffff" />
      </Pressable>

      {/* Right Action Rail */}
      <View style={styles.rightRail}>
        {/* Creator avatar */}
        <Pressable onPress={onProfilePress} style={styles.creatorRailBtn}>
          <Avatar
            uri={reel.creator?.avatarUrl}
            name={reel.creator?.name || reel.brandTag?.replace(/^@/, '') || 'Rava'}
            size={44}
            ring
          />
          <View style={[styles.creatorPlusBadge, { backgroundColor: palette.accent }]}>
            <Ionicons name="sparkles" size={9} color="#ffffff" />
          </View>
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
          <View style={[styles.actionIconWrap, liked && styles.actionIconActive]}>
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={26}
              color={liked ? '#ff2d78' : '#ffffff'}
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
            <Ionicons name="chatbubble-ellipses-outline" size={24} color="#ffffff" />
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
          <View style={[styles.actionIconWrap, saved && styles.actionIconActive]}>
            <Ionicons
              name={saved ? 'bookmark' : 'bookmark-outline'}
              size={24}
              color={saved ? '#ff2d78' : '#ffffff'}
            />
          </View>
          <Text style={styles.actionText}>{formatCount(reel.savesCount || 0)}</Text>
        </Pressable>

        {/* Share */}
        <Pressable onPress={onShare} style={styles.actionBtn} hitSlop={6}>
          <View style={styles.actionIconWrap}>
            <Ionicons name="paper-plane-outline" size={22} color="#ffffff" />
          </View>
          <Text style={styles.actionText}>Share</Text>
        </Pressable>

        {/* Buy / Shop Button */}
        {(showProduct || externalProductUrl) && (
          <Pressable
            onPress={() => {
              if (product) {
                onProductPress?.(product);
              } else if (externalProductUrl) {
                void openExternalLink(externalProductUrl);
              }
            }}
            style={[styles.shopBtnRail, { borderColor: 'rgba(255, 255, 255, 0.35)' }]}
            hitSlop={6}
          >
            <LinearGradient
              colors={[...palette.accentGradient]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons name="bag-handle" size={20} color="#ffffff" />
            <Text style={styles.shopRailText}>Shop</Text>
          </Pressable>
        )}
      </View>

      {/* Bottom Left Info & Shoppable Product Pill */}
      <View style={styles.bottomOverlay}>
        {/* Creator Handle & Category */}
        <View style={styles.creatorRow}>
          <Pressable onPress={onProfilePress} style={styles.handlePress}>
            <Text style={styles.creatorHandle}>
              @{reel.creator?.username || reel.creator?.name?.replace(/\s+/g, '').toLowerCase() || reel.brandTag?.replace(/^@/, '').toLowerCase() || 'rava.creator'}
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

        {/* Floating Shoppable Product Pill (Aura Liquid Glass) */}
        {showProduct && product && (
          <Pressable
            onPress={() => onProductPress?.(product)}
            style={({ pressed }) => [
              pressed && { opacity: 0.92, transform: [{ scale: 0.985 }] },
            ]}
          >
            <GlassSurface
              interactive
              raised
              colorScheme="dark"
              intensity={78}
              cornerRadius={radius.md}
              style={styles.productPill}
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
                    {product.brandName || 'Rava Boutique'}
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
                  colors={[...palette.accentGradient]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={styles.pillCtaText}>Buy Now</Text>
                <Ionicons name="arrow-forward" size={13} color="#ffffff" />
              </View>
            </GlassSurface>
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
    backgroundColor: '#121217',
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
    height: 320,
  },
  heartAnimContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  heartAnim: {
    shadowColor: '#ff2d78',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
  },
  muteIndicator: {
    position: 'absolute',
    top: 52,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(12, 12, 16, 0.65)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  rightRail: {
    position: 'absolute',
    right: 12,
    bottom: 106,
    alignItems: 'center',
    gap: 14,
    zIndex: 10,
  },
  creatorRailBtn: {
    marginBottom: 6,
    position: 'relative',
  },
  creatorPlusBadge: {
    position: 'absolute',
    bottom: -4,
    alignSelf: 'center',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#08080a',
  },
  actionBtn: {
    alignItems: 'center',
    gap: 3,
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(12, 12, 16, 0.48)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconActive: {
    backgroundColor: 'rgba(255, 45, 120, 0.20)',
    borderColor: 'rgba(255, 45, 120, 0.45)',
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
    width: 46,
    height: 54,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    marginTop: 4,
    shadowColor: '#ff2d78',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
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
    right: 74,
    bottom: 92,
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
    letterSpacing: -0.2,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  categoryPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  categoryText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  brandTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 45, 120, 0.32)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 45, 120, 0.6)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  brandTagText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  captionWrap: {
    maxWidth: '100%',
  },
  captionText: {
    color: '#fafafc',
    fontSize: 13,
    lineHeight: 18,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  productPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    padding: 8,
    gap: 10,
    maxWidth: '100%',
  },
  pillImageWrap: {
    width: 46,
    height: 46,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: '#1e1e28',
  },
  pillImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff2d78',
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
    color: '#d4d4dc',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  pillCommBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  pillCommText: {
    color: '#34d399',
    fontSize: 9,
    fontWeight: '800',
  },
  pillProductName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  pillPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillPrice: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  pillMrp: {
    color: '#8e8e9e',
    fontSize: 11,
    textDecorationLine: 'line-through',
  },
  pillCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  pillCtaText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
});
