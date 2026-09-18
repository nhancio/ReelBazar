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
import { APP_NAME, APP_ORIGIN, CATEGORIES, SAMPLE_PRODUCT, type Category, type Reel, type User, type BrandProduct } from '@reelbazaar/config';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ReelPlayer916 } from '@/components/ReelPlayer916';
import { ProductPurchaseDrawer } from '@/components/ProductPurchaseDrawer';
import { radius, spacing } from '@/theme';

const PAGE_SIZE = 10;

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
        let q = query(reelsCol, orderBy('createdAt', 'desc'), limit(PAGE_SIZE));

        if (selectedCategory !== 'All') {
          q = !reset && lastDocRef.current
            ? query(
                reelsCol,
                where('category', '==', selectedCategory),
                orderBy('createdAt', 'desc'),
                startAfter(lastDocRef.current),
                limit(PAGE_SIZE)
              )
            : query(reelsCol, where('category', '==', selectedCategory), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
        } else if (!reset && lastDocRef.current) {
          q = query(reelsCol, orderBy('createdAt', 'desc'), startAfter(lastDocRef.current), limit(PAGE_SIZE));
        }

        const snapshot = await getDocs(q);

        const creatorIds = [
          ...new Set(snapshot.docs.map((d) => d.data().creatorId as string).filter(Boolean)),
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

        // Fetch tagged products for reels
        const productIds = [
          ...new Set(snapshot.docs.map((d) => d.data().productId as string).filter(Boolean)),
        ];
        const productsMap = new Map<string, BrandProduct>();
        await Promise.all(
          productIds.map(async (id) => {
            if (id === SAMPLE_PRODUCT.id) {
              productsMap.set(id, SAMPLE_PRODUCT as BrandProduct);
              return;
            }
            try {
              const snap = await getDoc(doc(db, 'products', id));
              if (snap.exists()) productsMap.set(id, { id: snap.id, ...snap.data() } as BrandProduct);
            } catch {
              /* ignore */
            }
          })
        );

        const page = snapshot.docs.map((d) => {
          const data = d.data();
          const prod = data.productId ? (productsMap.get(data.productId) || null) : null;
          return {
            id: d.id,
            ...data,
            creator: creators.get(data.creatorId) ?? null,
            product: prod || (data.productLink ? (SAMPLE_PRODUCT as BrandProduct) : undefined),
          } as Reel;
        });

        if (page.length > 0 && (!activeId || reset)) {
          setActiveId(page[0]?.id || null);
        }

        setReels((prev) =>
          reset ? page : [...prev, ...page.filter((n) => !prev.some((p) => p.id === n.id))]
        );
        setHasMore(snapshot.docs.length === PAGE_SIZE);
        lastDocRef.current = snapshot.docs[snapshot.docs.length - 1] ?? null;
      } catch (err) {
        console.warn('Firestore feed query failed, fallback to API:', err);
        try {
          const res = await reelsApi.getFeed(
            selectedCategory === 'All' ? undefined : selectedCategory,
            reset ? undefined : apiCursorRef.current
          );
          const page = (res.reels || []).map((r) => ({
            ...r,
            product: r.product || (SAMPLE_PRODUCT as BrandProduct),
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
      {/* Top Floating Glass Header */}
      <View
        style={[
          styles.topHeader,
          {
            paddingTop: insets.top + (Platform.OS === 'ios' ? 4 : 8),
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.brandTitle}>{APP_NAME}</Text>
          {currentUser?.streakCount ? (
            <View style={styles.streakBadge}>
              <Text style={styles.streakText}>🔥 {currentUser.streakCount}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.headerRight}>
          <Pressable
            onPress={() => router.push('/search')}
            hitSlop={8}
            style={styles.headerIconBtn}
            accessibilityLabel="Search"
          >
            <Ionicons name="search" size={22} color="#ffffff" />
          </Pressable>

          <Pressable
            onPress={() => router.push('/orders')}
            hitSlop={8}
            style={styles.headerIconBtn}
            accessibilityLabel="My Orders"
          >
            <Ionicons name="bag-handle-outline" size={22} color="#ffffff" />
          </Pressable>
        </View>
      </View>

      {/* Floating Category Filters */}
      <View style={[styles.categoryBar, { top: insets.top + 48 }]}>
        <FlatList
          horizontal
          data={['All', ...CATEGORIES]}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryContent}
          renderItem={({ item }) => {
            const active = selectedCategory === item;
            return (
              <Pressable
                onPress={() => setSelectedCategory(item as Category | 'All')}
                style={[
                  styles.categoryPill,
                  active && styles.categoryPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.categoryText,
                    active && styles.categoryTextActive,
                  ]}
                >
                  {item}
                </Text>
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
            onProfilePress={() => item.creatorId && router.push(`/profile/${item.creatorId}`)}
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
  brandTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  streakBadge: {
    backgroundColor: 'rgba(255, 107, 61, 0.3)',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 61, 0.6)',
  },
  streakText: { color: '#ff6b3d', fontSize: 11, fontWeight: '800' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.4)',
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
  categoryPill: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  categoryPillActive: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  categoryText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
  },
  categoryTextActive: {
    color: '#000000',
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
