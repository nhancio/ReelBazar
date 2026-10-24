import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  setDoc,
  startAfter,
  updateDoc,
  where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { reelsApi } from '@reelbazaar/api';
import { APP_NAME, APP_ORIGIN, CATEGORIES, type Category, type Reel, type User, type BrandProduct } from '@reelbazaar/config';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ReelPlayer916 } from '@/components/ReelPlayer916';
import { ProductPurchaseDrawer } from '@/components/ProductPurchaseDrawer';
import { GlassSurface } from '@/components/GlassSurface';
import { LinearGradient } from 'expo-linear-gradient';
import { radius, spacing } from '@/theme';

const PAGE_SIZE = 10;

function toCreatedAtMs(val: unknown): number {
  if (!val) return 0;
  if (typeof val === 'string') {
    const t = Date.parse(val);
    return Number.isFinite(t) ? t : 0;
  }
  if (typeof val === 'object' && val !== null && 'toMillis' in val && typeof (val as { toMillis: unknown }).toMillis === 'function') {
    return (val as { toMillis: () => number }).toMillis();
  }
  return 0;
}

export default function FeedScreen() {
  const { guestMode, user: currentUser } = useAuth();
  const { palette } = useTheme();
  const { showToast } = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();

  // Full 9:16 vertical viewport height
  const reelHeight = windowHeight;
  const reelWidth = Math.min(windowWidth, 480);

  const [reels, setReels] = useState<Reel[]>([]);
  const [likedReels, setLikedReels] = useState<Set<string>>(new Set());
  const [savedReels, setSavedReels] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [muted, setMuted] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');

  // Purchase Drawer state
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<BrandProduct | null>(null);
  const [selectedReel, setSelectedReel] = useState<Reel | null>(null);

  const lastDocRef = useRef<QueryDocumentSnapshot | null>(null);
  const apiCursorRef = useRef<string | undefined>(undefined);
  const viewedRef = useRef(new Set<string>());
  const loadingMoreRef = useRef(false);

  // ---- data loading -----------------------------------------------------------------

  const loadReels = useCallback(
    async (reset = false) => {
      if (loadingMoreRef.current) return;
      loadingMoreRef.current = true;

      try {
        if (reset) {
          lastDocRef.current = null;
          apiCursorRef.current = undefined;
        }

        const reelsCol = collection(db, 'reels');
        let docs: QueryDocumentSnapshot[] = [];
        let usedFallbackNoIndex = false;

        if (selectedCategory !== 'All') {
          try {
            const q = !reset && lastDocRef.current
              ? query(
                  reelsCol,
                  where('category', '==', selectedCategory),
                  orderBy('createdAt', 'desc'),
                  startAfter(lastDocRef.current),
                  limit(PAGE_SIZE)
                )
              : query(reelsCol, where('category', '==', selectedCategory), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
            const snapshot = await getDocs(q);
            docs = [...snapshot.docs];
          } catch {
            // Fallback when Firestore composite index (category + createdAt) is not yet built
            usedFallbackNoIndex = true;
            if (reset) {
              const snapshot = await getDocs(query(reelsCol, where('category', '==', selectedCategory)));
              docs = [...snapshot.docs].sort(
                (a, b) => toCreatedAtMs(b.data().createdAt) - toCreatedAtMs(a.data().createdAt)
              );
            } else {
              docs = [];
            }
          }
        } else {
          const q = !reset && lastDocRef.current
            ? query(reelsCol, orderBy('createdAt', 'desc'), startAfter(lastDocRef.current), limit(PAGE_SIZE))
            : query(reelsCol, orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
          const snapshot = await getDocs(q);
          docs = [...snapshot.docs];
        }

        const creatorIds = [
          ...new Set(docs.map((d) => d.data().creatorId as string).filter(Boolean)),
        ];
        const creators = new Map<string, User>();
        await Promise.all(
          creatorIds.map(async (id) => {
            try {
              const snap = await getDoc(doc(db, 'users', id));
              if (snap.exists()) creators.set(id, { id: snap.id, ...snap.data() } as User);
            } catch {
              /* ignore */
            }
          })
        );

        // Fetch tagged products for reels (only real products from Firestore)
        const productIds = [
          ...new Set(
            docs
              .map((d) => d.data().productId as string)
              .filter((id): id is string => Boolean(id && id !== 'sample_prod_1'))
          ),
        ];
        const productsMap = new Map<string, BrandProduct>();
        await Promise.all(
          productIds.map(async (id) => {
            try {
              const snap = await getDoc(doc(db, 'products', id));
              if (snap.exists()) productsMap.set(id, { id: snap.id, ...snap.data() } as BrandProduct);
            } catch {
              /* ignore */
            }
          })
        );

        const page = docs.map((d) => {
          const data = d.data();
          const prod = data.productId ? (productsMap.get(data.productId) || undefined) : undefined;
          return {
            id: d.id,
            ...data,
            creator: creators.get(data.creatorId) ?? null,
            product: prod,
          } as Reel;
        });

        if (page.length > 0 && (!activeId || reset)) {
          setActiveId(page[0]?.id || null);
        }

        setReels((prev) =>
          reset ? page : [...prev, ...page.filter((n) => !prev.some((p) => p.id === n.id))]
        );
        setHasMore(!usedFallbackNoIndex && docs.length === PAGE_SIZE);
        lastDocRef.current = !usedFallbackNoIndex ? (docs[docs.length - 1] ?? null) : null;
      } catch (err) {
        console.warn('Firestore feed query failed, fallback to API:', err);
        try {
          const res = await reelsApi.getFeed(
            selectedCategory === 'All' ? undefined : selectedCategory,
            reset ? undefined : apiCursorRef.current
          );
          const page = (res.reels || []).map((r) => ({
            ...r,
            product: r.product && r.product.id !== 'sample_prod_1' ? r.product : undefined,
          }));

          if (page.length > 0 && (!activeId || reset)) {
            setActiveId(page[0]?.id || null);
          }

          setReels((prev) =>
            reset ? page : [...prev, ...page.filter((n) => !prev.some((p) => p.id === n.id))]
          );
          setHasMore(Boolean(res.hasMore));
          apiCursorRef.current = res.nextCursor;
          lastDocRef.current = null;
        } catch (apiErr) {
          console.error('API feed fallback failed:', apiErr);
          showToast('Failed to load reels', 'error');
          if (reset) setHasMore(false);
        }
      } finally {
        loadingMoreRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedCategory, activeId, showToast]
  );

  useEffect(() => {
    void loadReels(true);
  }, [loadReels]);

  // Load liked & saved sets
  useEffect(() => {
    if (guestMode || !currentUser) {
      setLikedReels(new Set());
      setSavedReels(new Set());
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [likes, saves] = await Promise.all([
          getDocs(query(collection(db, 'reelLikes'), where('userId', '==', currentUser.id))),
          getDocs(query(collection(db, 'reelSaves'), where('userId', '==', currentUser.id))),
        ]);
        if (cancelled) return;
        setLikedReels(new Set(likes.docs.map((d) => d.data().reelId as string)));
        setSavedReels(new Set(saves.docs.map((d) => d.data().reelId as string)));
      } catch (err) {
        console.error('Failed to load like/save state:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [guestMode, currentUser]);

  const requireAuth = useCallback(() => {
    showToast('Sign in to do that', 'info');
    router.push('/auth');
  }, [router, showToast]);

  const toggle = useCallback(
    async (kind: 'like' | 'save', reelId: string) => {
      if (guestMode || !currentUser) return requireAuth();
      if (pending.has(reelId + kind)) return;

      const isLike = kind === 'like';
      const set = isLike ? likedReels : savedReels;
      const setSet = isLike ? setLikedReels : setSavedReels;
      const countKey = isLike ? 'likesCount' : 'savesCount';
      const collectionName = isLike ? 'reelLikes' : 'reelSaves';
      const was = set.has(reelId);
      const delta = was ? -1 : 1;

      const applyLocal = (d: number) => {
        setSet((prev) => {
          const next = new Set(prev);
          if (d > 0) next.add(reelId);
          else next.delete(reelId);
          return next;
        });
        setReels((prev) =>
          prev.map((r) =>
            r.id === reelId ? { ...r, [countKey]: Math.max(0, (r[countKey] || 0) + d) } : r
          )
        );
      };

      setPending((prev) => new Set(prev).add(reelId + kind));
      applyLocal(delta);

      try {
        const ref = doc(db, collectionName, `${currentUser.id}_${reelId}`);
        if (was) {
          await deleteDoc(ref);
        } else {
          await setDoc(ref, {
            userId: currentUser.id,
            reelId,
            createdAt: new Date().toISOString(),
          });
        }
        await updateDoc(doc(db, 'reels', reelId), { [countKey]: increment(delta) });
      } catch (err) {
        console.error(`Failed to ${kind} reel:`, err);
        showToast(`Failed to update ${kind}`, 'error');
        applyLocal(-delta);
      } finally {
        setPending((prev) => {
          const next = new Set(prev);
          next.delete(reelId + kind);
          return next;
        });
      }
    },
    [guestMode, currentUser, pending, likedReels, savedReels, requireAuth, showToast]
  );

  const trackView = useCallback((reelId: string) => {
    if (viewedRef.current.has(reelId)) return;
    viewedRef.current.add(reelId);
    updateDoc(doc(db, 'reels', reelId), { viewsCount: increment(1) }).catch(() => {});
    setReels((prev) =>
      prev.map((r) => (r.id === reelId ? { ...r, viewsCount: (r.viewsCount || 0) + 1 } : r))
    );
  }, []);

  const handleShare = useCallback(async (reelId: string) => {
    try {
      await Share.share({
        message: `Check out this shoppable reel on ${APP_NAME}! ${APP_ORIGIN}/reel/${reelId}`,
        url: `${APP_ORIGIN}/reel/${reelId}`,
      });
    } catch {
      /* dismiss */
    }
  }, []);

  const handleOpenProduct = (product: BrandProduct, reel: Reel) => {
    setSelectedProduct(product);
    setSelectedReel(reel);
    setDrawerVisible(true);
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.find((v) => v.isViewable);
    if (first?.item) setActiveId((first.item as Reel).id);
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 }).current;

  return (
    <View style={[styles.fill, { backgroundColor: '#000000' }]}>
      {/* Top Floating Glass Header (pointerEvents="box-none" so right-side mute button is never blocked) */}
      <View
        pointerEvents="box-none"
        style={[
          styles.topHeader,
          {
            paddingTop: insets.top + (Platform.OS === 'ios' ? 4 : 8),
          },
        ]}
      >
        <View style={styles.headerLeft} pointerEvents="auto">
          <View style={[styles.brandDot, { backgroundColor: palette.accent }]} />
          <Text style={styles.brandTitle}>{APP_NAME}</Text>
          {currentUser?.streakCount ? (
            <View style={styles.streakBadge}>
              <Text style={styles.streakText}>🔥 {currentUser.streakCount}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Floating Category Filters (Aura Liquid Glass Chips) */}
      <View style={[styles.categoryBar, { top: insets.top + 50 }]} pointerEvents="box-none">
        <FlatList
          horizontal
          data={['All', ...CATEGORIES]}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryContent}
          renderItem={({ item }) => {
            const active = selectedCategory === item;
            if (active) {
              return (
                <Pressable
                  onPress={() => setSelectedCategory(item as Category | 'All')}
                  style={[styles.categoryPill, styles.categoryPillActive]}
                >
                  <LinearGradient
                    colors={[...palette.accentGradient]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <LinearGradient
                    colors={['rgba(255,255,255,0.35)', 'transparent']}
                    locations={[0, 0.5]}
                    style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}
                  />
                  <Text style={[styles.categoryText, styles.categoryTextActive]}>
                    {item}
                  </Text>
                </Pressable>
              );
            }
            return (
              <Pressable
                onPress={() => setSelectedCategory(item as Category | 'All')}
              >
                <GlassSurface
                  interactive
                  colorScheme="dark"
                  intensity={55}
                  cornerRadius={radius.pill}
                  style={styles.categoryGlassPill}
                >
                  <Text style={styles.categoryText}>{item}</Text>
                </GlassSurface>
              </Pressable>
            );
          }}
        />
      </View>

      {/* 9:16 Full-bleed Vertical Feed */}
      <FlatList
        data={reels}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ReelPlayer916
            reel={item}
            active={activeId === item.id}
            height={reelHeight}
            width={reelWidth}
            muted={muted[item.id] ?? true}
            onToggleMuted={() =>
              setMuted((prev) => ({ ...prev, [item.id]: !(prev[item.id] ?? true) }))
            }
            liked={likedReels.has(item.id)}
            saved={savedReels.has(item.id)}
            likeDisabled={pending.has(item.id + 'like')}
            saveDisabled={pending.has(item.id + 'save')}
            guestMode={guestMode}
            onRequireAuth={requireAuth}
            onLike={() => void toggle('like', item.id)}
            onSave={() => void toggle('save', item.id)}
            onShare={() => void handleShare(item.id)}
            onComment={() => router.push(`/reel/${item.id}`)}
            onProfilePress={() => {
              const targetId = item.creatorId || item.brandTag?.replace(/^@/, '') || 'rava-creator';
              const params = new URLSearchParams();
              if (item.creator?.name) params.set('name', item.creator.name);
              if (item.creator?.username) params.set('username', item.creator.username);
              if (item.brandTag) params.set('brandTag', item.brandTag);
              const qs = params.toString();
              router.push(`/profile/${targetId}${qs ? `?${qs}` : ''}`);
            }}
            onView={() => trackView(item.id)}
            onProductPress={(prod) => handleOpenProduct(prod, item)}
          />
        )}
        pagingEnabled
        snapToInterval={reelHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading ? (
            <View style={[styles.emptyContainer, { height: reelHeight }]}>
              <LoadingSpinner size="lg" label="Loading Reels..." fullscreen />
            </View>
          ) : (
            <View style={[styles.emptyContainer, { height: reelHeight }]}>
              <Ionicons name="videocam-outline" size={56} color="rgba(255,255,255,0.4)" />
              <Text style={styles.emptyText}>No reels in this category yet.</Text>
            </View>
          )
        }
        onEndReached={() => {
          if (hasMore && !loading) void loadReels();
        }}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void loadReels(true);
            }}
            tintColor={palette.accent}
          />
        }
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        windowSize={3}
        maxToRenderPerBatch={2}
        initialNumToRender={2}
        removeClippedSubviews
        style={styles.fill}
      />

      {/* Shoppable Purchase Drawer */}
      <ProductPurchaseDrawer
        visible={drawerVisible}
        product={selectedProduct}
        reel={selectedReel}
        onClose={() => setDrawerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  topHeader: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: 6,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  brandTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.6,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  streakBadge: {
    backgroundColor: 'rgba(255, 45, 120, 0.25)',
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 45, 120, 0.6)',
  },
  streakText: { color: '#ff8ab5', fontSize: 11, fontWeight: '800' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerCreateBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(10,10,14,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 20,
  },
  categoryContent: {
    paddingHorizontal: spacing.lg,
    gap: 8,
    paddingVertical: 4,
  },
  categoryGlassPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  categoryPillActive: {
    shadowColor: '#ff2d78',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  categoryText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 12,
    fontWeight: '700',
  },
  categoryTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    fontWeight: '600',
  },
});
