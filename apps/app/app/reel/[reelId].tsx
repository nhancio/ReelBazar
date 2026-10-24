import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  deleteDoc,
  doc,
  getDoc,
  increment,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { commentsApi, reelsApi, type Comment } from '@reelbazaar/api';
import { APP_NAME, APP_ORIGIN, type BrandProduct, type Reel, type User } from '@reelbazaar/config';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ProductPurchaseDrawer } from '@/components/ProductPurchaseDrawer';
import { ReelPostCard } from '@/components/ReelPostCard';
import { timeAgo } from '@/lib/timeAgo';
import { radius, spacing, typography } from '@/theme';

export default function SingleReelScreen() {
  const { reelId } = useLocalSearchParams<{ reelId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const { user: currentUser, guestMode } = useAuth();
  const { showToast } = useToast();

  const [reel, setReel] = useState<Reel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [likePending, setLikePending] = useState(false);
  const [savePending, setSavePending] = useState(false);
  const [followPending, setFollowPending] = useState(false);
  const [muted, setMuted] = useState(false);

  // Instant Checkout Drawer state
  const [drawerVisible, setDrawerVisible] = useState(false);

  // Comments drawer state
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [hasMoreComments, setHasMoreComments] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const commentInputRef = useRef<TextInput>(null);

  const loadReel = useCallback(async () => {
    if (!reelId) {
      setError('Reel not found');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Try Firestore
      const reelDoc = await getDoc(doc(db, 'reels', reelId));
      if (reelDoc.exists()) {
        const data = reelDoc.data();
        let creator: User | null = null;
        let product: BrandProduct | undefined = undefined;
        if (data.creatorId) {
          const userDoc = await getDoc(doc(db, 'users', data.creatorId));
          if (userDoc.exists()) {
            creator = { id: userDoc.id, ...userDoc.data() } as User;
          }
        }
        if (data.productId && data.productId !== 'sample_prod_1') {
          try {
            const prodDoc = await getDoc(doc(db, 'products', data.productId));
            if (prodDoc.exists()) {
              product = { id: prodDoc.id, ...prodDoc.data() } as BrandProduct;
            }
          } catch {
            /* ignore */
          }
        }
        setReel({ id: reelDoc.id, ...data, creator, product } as Reel);
        return;
      }

      // 2. Fallback to API
      const res = await reelsApi.getById(reelId);
      if (res.reel) {
        setReel(res.reel);
        return;
      }

      setError('Reel not found');
    } catch (err) {
      console.error('Error fetching single reel:', err);
      try {
        const res = await reelsApi.getById(reelId);
        if (res.reel) {
          setReel(res.reel);
          return;
        }
      } catch (apiErr) {
        console.error('API single reel fallback failed:', apiErr);
      }
      setError('Failed to load reel');
    } finally {
      setLoading(false);
    }
  }, [reelId]);

  useEffect(() => {
    void loadReel();
  }, [loadReel]);

  // Load interaction state (likes, saves, follows)
  useEffect(() => {
    const loadInteractionState = async () => {
      if (!reelId || !currentUser || guestMode) {
        setLiked(false);
        setSaved(false);
        setIsFollowing(false);
        return;
      }

      try {
        const [likeDoc, saveDoc, followDoc] = await Promise.all([
          getDoc(doc(db, 'reelLikes', `${currentUser.id}_${reelId}`)),
          getDoc(doc(db, 'reelSaves', `${currentUser.id}_${reelId}`)),
          reel?.creatorId && reel.creatorId !== currentUser.id
            ? getDoc(doc(db, 'follows', `${currentUser.id}_${reel.creatorId}`))
            : Promise.resolve(null),
        ]);

        setLiked(likeDoc.exists());
        setSaved(saveDoc.exists());
        setIsFollowing(Boolean(followDoc?.exists()));
      } catch (err) {
        console.error('Failed to load reel interaction state:', err);
      }
    };

    void loadInteractionState();
  }, [currentUser, guestMode, reelId, reel?.creatorId]);

  const requireAuth = useCallback(() => {
    showToast('Sign in to interact with reels', 'info');
    router.push('/auth');
  }, [router, showToast]);

  const handleLike = async () => {
    if (!reel) return;
    if (guestMode || !currentUser) return requireAuth();
    if (likePending) return;

    const wasLiked = liked;
    setLikePending(true);
    setLiked(!wasLiked);
    setReel((prev) =>
      prev ? { ...prev, likesCount: Math.max(0, (prev.likesCount || 0) + (wasLiked ? -1 : 1)) } : prev
    );

    try {
      const likeRef = doc(db, 'reelLikes', `${currentUser.id}_${reel.id}`);
      if (wasLiked) {
        await deleteDoc(likeRef);
        await updateDoc(doc(db, 'reels', reel.id), { likesCount: increment(-1) });
      } else {
        await setDoc(likeRef, {
          userId: currentUser.id,
          reelId: reel.id,
          createdAt: new Date().toISOString(),
        });
        await updateDoc(doc(db, 'reels', reel.id), { likesCount: increment(1) });
      }
    } catch (err) {
      console.error('Failed to like reel:', err);
      setLiked(wasLiked);
      setReel((prev) =>
        prev ? { ...prev, likesCount: Math.max(0, (prev.likesCount || 0) + (wasLiked ? 1 : -1)) } : prev
      );
    } finally {
      setLikePending(false);
    }
  };

  const handleSave = async () => {
    if (!reel) return;
    if (guestMode || !currentUser) return requireAuth();
    if (savePending) return;

    const wasSaved = saved;
    setSavePending(true);
    setSaved(!wasSaved);
    setReel((prev) =>
      prev ? { ...prev, savesCount: Math.max(0, (prev.savesCount || 0) + (wasSaved ? -1 : 1)) } : prev
    );

    try {
      const saveRef = doc(db, 'reelSaves', `${currentUser.id}_${reel.id}`);
      if (wasSaved) {
        await deleteDoc(saveRef);
        await updateDoc(doc(db, 'reels', reel.id), { savesCount: increment(-1) });
      } else {
        await setDoc(saveRef, {
          userId: currentUser.id,
          reelId: reel.id,
          createdAt: new Date().toISOString(),
        });
        await updateDoc(doc(db, 'reels', reel.id), { savesCount: increment(1) });
      }
    } catch (err) {
      console.error('Failed to save reel:', err);
      setSaved(wasSaved);
      setReel((prev) =>
        prev ? { ...prev, savesCount: Math.max(0, (prev.savesCount || 0) + (wasSaved ? 1 : -1)) } : prev
      );
    } finally {
      setSavePending(false);
    }
  };

  const handleFollow = async () => {
    if (!reel?.creatorId || !currentUser || reel.creatorId === currentUser.id) return;
    if (guestMode) return requireAuth();
    if (followPending) return;

    const wasFollowing = isFollowing;
    setFollowPending(true);
    setIsFollowing(!wasFollowing);

    try {
      const followRef = doc(db, 'follows', `${currentUser.id}_${reel.creatorId}`);
      if (wasFollowing) {
        await deleteDoc(followRef);
      } else {
        await setDoc(followRef, {
          followerId: currentUser.id,
          followingId: reel.creatorId,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('Failed to update follow state:', err);
      setIsFollowing(wasFollowing);
    } finally {
      setFollowPending(false);
    }
  };

  const handleShare = async () => {
    if (!reel) return;
    try {
      await Share.share({
        message: `Check out this reel on ${APP_NAME}! ${APP_ORIGIN}/reel/${reel.id}`,
        url: `${APP_ORIGIN}/reel/${reel.id}`,
      });
    } catch {
      /* cancelled */
    }
  };

  // Comments logic
  const loadComments = useCallback(
    async (reset = false) => {
      if (!reelId) return;
      setCommentsLoading(true);
      try {
        const cursor = reset ? undefined : nextCursor;
        const res = await commentsApi.getForReel(reelId, cursor);
        setComments((prev) => (reset ? res.comments : [...prev, ...res.comments]));
        setHasMoreComments(Boolean(res.hasMore));
        setNextCursor(res.nextCursor);
      } catch (err) {
        console.warn('Failed to load comments from API:', err);
      } finally {
        setCommentsLoading(false);
      }
    },
    [reelId, nextCursor]
  );

  const openComments = () => {
    setCommentsVisible(true);
    void loadComments(true);
  };

  const handlePostComment = async () => {
    if (!commentText.trim() || !reelId) return;
    if (guestMode || !currentUser) {
      requireAuth();
      return;
    }

    setPostingComment(true);
    try {
      const res = await commentsApi.post(reelId, commentText.trim());
      setComments((prev) => [res.comment, ...prev]);
      setCommentText('');
      setReel((prev) =>
        prev ? { ...prev, commentsCount: (prev.commentsCount || 0) + 1 } : prev
      );
      showToast('Comment posted', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to post comment';
      showToast(msg, 'error');
    } finally {
      setPostingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await commentsApi.delete(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setReel((prev) =>
        prev ? { ...prev, commentsCount: Math.max(0, (prev.commentsCount || 0) - 1) } : prev
      );
      showToast('Comment deleted', 'success');
    } catch {
      showToast('Failed to delete comment', 'error');
    }
  };

  if (loading) {
    return (
      <View style={[styles.fill, { backgroundColor: palette.background }]}>
        <LoadingSpinner size="lg" label="Loading reel..." fullscreen />
      </View>
    );
  }

  if (error || !reel) {
    return (
      <View style={[styles.fill, styles.centered, { backgroundColor: palette.background }]}>
        <Ionicons name="alert-circle-outline" size={56} color={palette.danger} />
        <Text style={[styles.errorTitle, { color: palette.text }]}>{error || 'Reel not found'}</Text>
        <Button label="Go Back" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  const showFollowButton =
    reel.creatorId && currentUser?.id && reel.creatorId !== currentUser.id && !guestMode;

  const creatorDisplay =
    reel.creator?.username ||
    reel.creator?.name ||
    reel.brandTag?.replace(/^@/, '') ||
    'rava.creator';

  const navigateToCreator = () => {
    const targetId = reel.creatorId || reel.brandTag?.replace(/^@/, '') || 'rava-creator';
    const params = new URLSearchParams();
    if (reel.creator?.name) params.set('name', reel.creator.name);
    if (reel.creator?.username) params.set('username', reel.creator.username);
    if (reel.brandTag) params.set('brandTag', reel.brandTag);
    const qs = params.toString();
    router.push(`/profile/${targetId}${qs ? `?${qs}` : ''}`);
  };

  return (
    <View style={[styles.fill, { backgroundColor: palette.background, paddingTop: insets.top }]}>
      {/* Top bar with back button & creator details */}
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.headerBtn}
        >
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </Pressable>

        <Pressable
          onPress={navigateToCreator}
          style={styles.headerCreator}
        >
          <Avatar uri={reel.creator?.avatarUrl} name={creatorDisplay} size={32} ring />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={[styles.headerCreatorName, { color: palette.text }]} numberOfLines={1}>
                @{creatorDisplay.replace(/^@/, '')}
              </Text>
              <Ionicons name="checkmark-circle" size={14} color={palette.accent} />
            </View>
          </View>
        </Pressable>

        {showFollowButton ? (
          <Pressable
            onPress={handleFollow}
            disabled={followPending}
            style={[
              styles.followBtn,
              {
                backgroundColor: isFollowing ? palette.cardElevated : palette.accent,
                borderColor: isFollowing ? palette.borderStrong : palette.accent,
                borderWidth: 1,
              },
            ]}
          >
            <Text
              style={[
                styles.followBtnText,
                { color: isFollowing ? palette.text : palette.textOnAccent },
              ]}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.headerBtn} />
        )}
      </View>

      {/* Main Reel Card */}
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        <ReelPostCard
          reel={reel}
          active={true}
          muted={muted}
          onToggleMuted={() => setMuted((prev) => !prev)}
          liked={liked}
          saved={saved}
          likeDisabled={likePending}
          saveDisabled={savePending}
          guestMode={guestMode}
          onRequireAuth={requireAuth}
          onLike={handleLike}
          onSave={handleSave}
          onShare={handleShare}
          onComment={openComments}
          onProfilePress={navigateToCreator}
          onProductLinkPress={() => {
            updateDoc(doc(db, 'reels', reel.id), { clicksCount: increment(1) }).catch(() => {});
            if (reel.product && reel.product.id !== 'sample_prod_1') {
              setDrawerVisible(true);
            }
          }}
        />
      </ScrollView>

      {/* Shoppable Purchase Drawer */}
      <ProductPurchaseDrawer
        visible={drawerVisible && Boolean(reel.product)}
        product={reel.product ?? null}
        reel={reel}
        onClose={() => setDrawerVisible(false)}
      />

      {/* Comments Drawer / Modal */}
      <Modal
        visible={commentsVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCommentsVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalBackdrop, { backgroundColor: palette.scrim }]}
        >
          <Pressable style={styles.modalDismissArea} onPress={() => setCommentsVisible(false)} />
          <View
            style={[
              styles.drawerCard,
              {
                backgroundColor: palette.sheet,
                borderTopColor: palette.borderStrong,
                paddingBottom: insets.bottom + spacing.md,
              },
            ]}
          >
            {/* Drawer Header */}
            <View style={styles.drawerHandleWrap}>
              <View
                style={[
                  styles.drawerHandle,
                  { backgroundColor: palette.borderStrong },
                ]}
              />
              <View style={styles.drawerHeaderRow}>
                <Text style={[styles.drawerTitle, { color: palette.text }]}>Comments</Text>
                <Pressable
                  onPress={() => setCommentsVisible(false)}
                  hitSlop={8}
                  accessibilityLabel="Close comments"
                >
                  <Ionicons name="close" size={22} color={palette.textMuted} />
                </Pressable>
              </View>
            </View>

            {/* Comments List */}
            {commentsLoading && comments.length === 0 ? (
              <View style={styles.commentsLoader}>
                <LoadingSpinner size="lg" />
              </View>
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(item) => item.id}
                style={styles.commentsList}
                contentContainerStyle={styles.commentsListContent}
                ListEmptyComponent={
                  <View style={styles.emptyComments}>
                    <Ionicons name="chatbubble-outline" size={36} color={palette.textMuted} />
                    <Text style={[styles.emptyCommentsText, { color: palette.textMuted }]}>
                      No comments yet. Be the first!
                    </Text>
                  </View>
                }
                renderItem={({ item }) => {
                  const isAuthor = currentUser?.id === item.authorId;
                  const authorName = item.author?.username || item.author?.name || 'User';

                  return (
                    <View style={[styles.commentRow, { borderBottomColor: palette.border }]}>
                      <Avatar uri={item.author?.avatarUrl} name={authorName} size={32} />
                      <View style={styles.commentContent}>
                        <View style={styles.commentMeta}>
                          <Text style={[styles.commentAuthor, { color: palette.text }]}>
                            {authorName}
                          </Text>
                          <Text style={[styles.commentTime, { color: palette.textMuted }]}>
                            {item.createdAt ? timeAgo(item.createdAt) : ''}
                          </Text>
                        </View>
                        <Text style={[styles.commentBody, { color: palette.text }]}>
                          {item.text}
                        </Text>
                      </View>
                      {isAuthor ? (
                        <Pressable
                          onPress={() => handleDeleteComment(item.id)}
                          hitSlop={8}
                          style={styles.deleteCommentBtn}
                        >
                          <Ionicons name="trash-outline" size={16} color={palette.danger} />
                        </Pressable>
                      ) : null}
                    </View>
                  );
                }}
                ListFooterComponent={
                  hasMoreComments && !commentsLoading ? (
                    <Pressable
                      onPress={() => void loadComments()}
                      style={styles.loadMoreBtn}
                    >
                      <Text style={[styles.loadMoreText, { color: palette.accent }]}>
                        Load more comments
                      </Text>
                    </Pressable>
                  ) : null
                }
              />
            )}

            {/* Comment Input Bar */}
            <View
              style={[
                styles.commentInputRow,
                {
                  borderTopColor: palette.border,
                  backgroundColor: palette.sheet,
                },
              ]}
            >
              <TextInput
                ref={commentInputRef}
                value={commentText}
                onChangeText={setCommentText}
                placeholder={guestMode ? 'Sign in to comment…' : 'Add a comment…'}
                placeholderTextColor={palette.textMuted}
                editable={!guestMode && !postingComment}
                style={[
                  styles.commentInput,
                  {
                    backgroundColor: palette.inputBg,
                    borderColor: palette.borderStrong,
                    color: palette.text,
                  },
                ]}
              />
              <Pressable
                onPress={handlePostComment}
                disabled={!commentText.trim() || postingComment || guestMode}
                style={({ pressed }) => [
                  styles.postBtn,
                  { backgroundColor: palette.accent },
                  (!commentText.trim() || postingComment || guestMode) && styles.postBtnDisabled,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[styles.postBtnText, { color: palette.textOnAccent }]}>
                  {postingComment ? '…' : 'Post'}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  errorTitle: { ...typography.heading, fontSize: 18, textAlign: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCreator: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, paddingHorizontal: spacing.sm },
  headerCreatorName: { fontSize: 14, fontWeight: '700' },
  followBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  followBtnText: { fontSize: 12, fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalDismissArea: { flex: 1 },
  drawerCard: {
    maxHeight: '80%',
    minHeight: '45%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  drawerHandleWrap: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: spacing.lg,
  },
  drawerHandle: { width: 36, height: 4, borderRadius: 2, marginBottom: 10 },
  drawerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  drawerTitle: { fontSize: 15, fontWeight: '700' },
  commentsLoader: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 140 },
  commentsList: { flex: 1 },
  commentsListContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  emptyComments: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: spacing.sm,
  },
  emptyCommentsText: { fontSize: 13 },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  commentContent: { flex: 1, gap: 2 },
  commentMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  commentAuthor: { fontSize: 13, fontWeight: '600' },
  commentTime: { fontSize: 11 },
  commentBody: { fontSize: 13, lineHeight: 18 },
  deleteCommentBtn: { padding: 4 },
  loadMoreBtn: { paddingVertical: spacing.md, alignItems: 'center' },
  loadMoreText: { fontSize: 13, fontWeight: '600' },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  commentInput: {
    flex: 1,
    height: 42,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    fontSize: 14,
  },
  postBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  postBtnDisabled: { opacity: 0.35 },
  postBtnText: { fontSize: 13, fontWeight: '800' },
});
