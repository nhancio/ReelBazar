import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { reelsApi, usersApi } from '@reelbazaar/api';
import type { Reel, User } from '@reelbazaar/config';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { UserListModal } from '@/components/UserListModal';
import { formatCount } from '@/lib/timeAgo';
import { radius, spacing, typography } from '@/theme';

function reelCreatedAtMs(createdAt: unknown): number {
  if (createdAt == null) return 0;
  if (typeof createdAt === 'string') {
    const t = Date.parse(createdAt);
    return Number.isFinite(t) ? t : 0;
  }
  if (
    typeof createdAt === 'object' &&
    createdAt !== null &&
    'toMillis' in createdAt &&
    typeof (createdAt as { toMillis: unknown }).toMillis === 'function'
  ) {
    return (createdAt as { toMillis: () => number }).toMillis();
  }
  return 0;
}

export default function PublicProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { palette, theme } = useTheme();
  const { user: currentUser, guestMode } = useAuth();
  const { showToast } = useToast();

  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followPending, setFollowPending] = useState(false);

  // Follower/Following modal lists
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [followersList, setFollowersList] = useState<User[]>([]);
  const [followingList, setFollowingList] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [currentUserFollowingMap, setCurrentUserFollowingMap] = useState<Record<string, boolean>>({});
  const [followPendingIds, setFollowPendingIds] = useState<Set<string>>(new Set());

  const isDark = theme !== 'light';
  const isOwnProfile = !userId || userId === currentUser?.id;
  const targetUserId = userId || currentUser?.id;

  const itemSize = (width - 4) / 3;

  const loadUserList = useCallback(async (uids: string[]) => {
    if (!uids.length) return [];
    const users = await Promise.all(
      uids.map(async (uid) => {
        try {
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) {
            return { id: userDoc.id, ...userDoc.data() } as User;
          }
          return null;
        } catch {
          return null;
        }
      })
    );
    return users.filter(Boolean) as User[];
  }, []);

  const loadProfile = useCallback(async () => {
    if (!targetUserId) {
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch user doc
      let fetchedUser: User | null = null;
      if (isOwnProfile && currentUser) {
        fetchedUser = currentUser;
      } else {
        const userDoc = await getDoc(doc(db, 'users', targetUserId));
        if (userDoc.exists()) {
          fetchedUser = { id: userDoc.id, ...userDoc.data() } as User;
        } else {
          try {
            const apiRes = await usersApi.getById(targetUserId);
            if (apiRes.user) fetchedUser = apiRes.user;
          } catch (e) {
            console.warn('API getById failed:', e);
          }
        }
      }
      setProfileUser(fetchedUser);

      // 2. Fetch user's reels
      try {
        const reelsSnap = await getDocs(
          query(collection(db, 'reels'), where('creatorId', '==', targetUserId))
        );
        const userReels = reelsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Reel));
        userReels.sort((a, b) => reelCreatedAtMs(b.createdAt) - reelCreatedAtMs(a.createdAt));
        setReels(userReels);
      } catch (err) {
        console.warn('Firestore reels query failed, trying API:', err);
        const res = await reelsApi.getUserReels(targetUserId);
        setReels(res.reels || []);
      }

      // 3. Fetch followers/following count
      const [followersSnap, followingSnap] = await Promise.all([
        getDocs(query(collection(db, 'follows'), where('followingId', '==', targetUserId))),
        getDocs(query(collection(db, 'follows'), where('followerId', '==', targetUserId))),
      ]);
      setFollowersCount(followersSnap.size);
      setFollowingCount(followingSnap.size);

      // 4. Check if current user is following this profile
      if (currentUser && currentUser.id !== targetUserId) {
        const myFollowSnap = await getDoc(
          doc(db, 'follows', `${currentUser.id}_${targetUserId}`)
        );
        setIsFollowing(myFollowSnap.exists());
      }

      // 5. Current user's global following map for modal items
      if (currentUser) {
        const currentFollowingSnap = await getDocs(
          query(collection(db, 'follows'), where('followerId', '==', currentUser.id))
        );
        const fMap: Record<string, boolean> = {};
        currentFollowingSnap.docs.forEach((item) => {
          fMap[item.data().followingId] = true;
        });
        setCurrentUserFollowingMap(fMap);
      }
    } catch (err) {
      console.error('Error loading public profile:', err);
      showToast('Failed to load profile', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [targetUserId, isOwnProfile, currentUser, showToast]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const toggleFollow = async (targetId: string) => {
    if (guestMode || !currentUser) {
      showToast('Sign in to follow users', 'info');
      router.push('/auth');
      return;
    }
    if (followPendingIds.has(targetId)) return;

    const isTargetMainProfile = targetId === targetUserId;
    const currentlyFollowing = isTargetMainProfile
      ? isFollowing
      : Boolean(currentUserFollowingMap[targetId]);

    setFollowPendingIds((prev) => new Set(prev).add(targetId));

    if (isTargetMainProfile) {
      setFollowPending(true);
      setIsFollowing(!currentlyFollowing);
      setFollowersCount((prev) => Math.max(0, prev + (currentlyFollowing ? -1 : 1)));
    } else {
      setCurrentUserFollowingMap((prev) => ({
        ...prev,
        [targetId]: !currentlyFollowing,
      }));
    }

    try {
      const followRef = doc(db, 'follows', `${currentUser.id}_${targetId}`);
      if (currentlyFollowing) {
        await deleteDoc(followRef);
      } else {
        await setDoc(followRef, {
          followerId: currentUser.id,
          followingId: targetId,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('Failed to toggle follow:', err);
      showToast('Failed to update follow status', 'error');
      if (isTargetMainProfile) {
        setIsFollowing(currentlyFollowing);
        setFollowersCount((prev) => Math.max(0, prev + (currentlyFollowing ? 1 : -1)));
      } else {
        setCurrentUserFollowingMap((prev) => ({
          ...prev,
          [targetId]: currentlyFollowing,
        }));
      }
    } finally {
      setFollowPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
      if (isTargetMainProfile) setFollowPending(false);
    }
  };

  const openFollowers = async () => {
    if (!targetUserId) return;
    setLoadingUsers(true);
    setShowFollowers(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'follows'), where('followingId', '==', targetUserId))
      );
      const followerIds = snap.docs.map((d) => d.data().followerId as string);
      const users = await loadUserList(followerIds);
      setFollowersList(users);
    } catch (err) {
      console.error('Failed to fetch followers list:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const openFollowing = async () => {
    if (!targetUserId) return;
    setLoadingUsers(true);
    setShowFollowing(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'follows'), where('followerId', '==', targetUserId))
      );
      const followingIds = snap.docs.map((d) => d.data().followingId as string);
      const users = await loadUserList(followingIds);
      setFollowingList(users);
    } catch (err) {
      console.error('Failed to fetch following list:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  if (loading && !profileUser) {
    return (
      <View style={[styles.fill, { backgroundColor: palette.background }]}>
        <LoadingSpinner size="lg" label="Loading profile..." fullscreen />
      </View>
    );
  }

  if (!profileUser) {
    return (
      <View style={[styles.fill, styles.centered, { backgroundColor: palette.background }]}>
        <Ionicons name="person-circle-outline" size={64} color={palette.textMuted} />
        <Text style={[styles.notFoundTitle, { color: palette.text }]}>Profile Not Found</Text>
        <Text style={[styles.notFoundSub, { color: palette.textMuted }]}>
          This account does not exist or has been removed.
        </Text>
        <Button label="Go Back" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  const handle = profileUser.username || profileUser.name?.replace(/\s+/g, '').toLowerCase() || 'user';
  const name = profileUser.name || 'User';

  return (
    <View style={[styles.fill, { backgroundColor: palette.background, paddingTop: insets.top }]}>
      {/* Top Header */}
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
        <View style={styles.headerTitles}>
          <Text style={[styles.headerHandle, { color: palette.text }]} numberOfLines={1}>
            @{handle}
          </Text>
          <Text style={[styles.headerName, { color: palette.textMuted }]} numberOfLines={1}>
            {name}
          </Text>
        </View>
        <View style={styles.headerBtn} />
      </View>

      <FlatList
        data={reels}
        keyExtractor={(item) => item.id}
        numColumns={3}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void loadProfile();
            }}
            tintColor={palette.accent}
          />
        }
        ListHeaderComponent={
          <View style={styles.profileHeader}>
            {/* Top row: Avatar + Stats */}
            <View style={styles.avatarStatsRow}>
              <Avatar uri={profileUser.avatarUrl} name={name} size={76} ring />
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statNumber, { color: palette.text }]}>
                    {reels.length}
                  </Text>
                  <Text style={[styles.statLabel, { color: palette.textMuted }]}>Posts</Text>
                </View>

                <Pressable style={styles.statItem} onPress={openFollowers} hitSlop={6}>
                  <Text style={[styles.statNumber, { color: palette.text }]}>
                    {formatCount(followersCount)}
                  </Text>
                  <Text style={[styles.statLabel, { color: palette.textMuted }]}>Followers</Text>
                </Pressable>

                <Pressable style={styles.statItem} onPress={openFollowing} hitSlop={6}>
                  <Text style={[styles.statNumber, { color: palette.text }]}>
                    {formatCount(followingCount)}
                  </Text>
                  <Text style={[styles.statLabel, { color: palette.textMuted }]}>Following</Text>
                </Pressable>

                {(profileUser.streakCount ?? 0) > 0 ? (
                  <View style={styles.statItem}>
                    <Text style={[styles.statNumber, { color: palette.streak }]}>
                      🔥{profileUser.streakCount}
                    </Text>
                    <Text style={[styles.statLabel, { color: palette.textMuted }]}>Streak</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Profile Bio Details */}
            <View style={styles.bioSection}>
              <View style={styles.nameRow}>
                <Text style={[styles.bioName, { color: palette.text }]}>{name}</Text>
                {profileUser.persona ? (
                  <View
                    style={[
                      styles.personaBadge,
                      {
                        backgroundColor:
                          profileUser.persona === 'Brand'
                            ? 'rgba(236,72,153,0.15)'
                            : profileUser.persona === 'User'
                              ? 'rgba(59,130,246,0.15)'
                              : 'rgba(168,85,247,0.15)',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.personaBadgeText,
                        {
                          color:
                            profileUser.persona === 'Brand'
                              ? '#ec4899'
                              : profileUser.persona === 'User'
                                ? '#3b82f6'
                                : '#a855f7',
                        },
                      ]}
                    >
                      {profileUser.persona}
                    </Text>
                  </View>
                ) : null}
              </View>

              {profileUser.brandName ? (
                <Text style={[styles.brandText, { color: palette.textSecondary }]}>
                  Building <Text style={{ fontWeight: '700' }}>{profileUser.brandName}</Text>
                </Text>
              ) : null}

              {profileUser.country ? (
                <Text style={[styles.countryText, { color: palette.textMuted }]}>
                  📍 {profileUser.country}
                </Text>
              ) : null}

              {profileUser.interests && profileUser.interests.length > 0 ? (
                <View style={styles.interestsWrap}>
                  {profileUser.interests.map((interest) => (
                    <View
                      key={interest}
                      style={[
                        styles.interestPill,
                        {
                          backgroundColor: isDark
                            ? 'rgba(255,255,255,0.08)'
                            : 'rgba(0,0,0,0.05)',
                        },
                      ]}
                    >
                      <Text style={[styles.interestText, { color: palette.textSecondary }]}>
                        {interest}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            {/* Action buttons */}
            <View style={styles.actionsRow}>
              {isOwnProfile ? (
                <Button
                  label="Create Reel"
                  onPress={() => router.push('/create')}
                  fullWidth
                  style={styles.actionBtn}
                />
              ) : targetUserId ? (
                <Button
                  label={isFollowing ? 'Following' : 'Follow'}
                  variant={isFollowing ? 'secondary' : 'primary'}
                  loading={followPending}
                  onPress={() => toggleFollow(targetUserId)}
                  fullWidth
                  style={styles.actionBtn}
                />
              ) : null}
            </View>

            {/* Grid Header Tabs */}
            <View style={[styles.gridTabHeader, { borderBottomColor: palette.border }]}>
              <View style={[styles.gridActiveIndicator, { backgroundColor: palette.text }]}>
                <Ionicons name="grid" size={20} color={palette.text} />
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyGrid}>
            <Ionicons name="film-outline" size={44} color={palette.textMuted} />
            <Text style={[styles.emptyGridText, { color: palette.textMuted }]}>
              No reels posted yet
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/reel/${item.id}`)}
            style={[
              styles.gridItem,
              {
                width: itemSize,
                height: itemSize * (4 / 3),
                backgroundColor: isDark ? '#141416' : '#f0f2f5',
              },
            ]}
          >
            {item.thumbnailUrl ? (
              <Image
                source={{ uri: item.thumbnailUrl }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.videoPlaceholder]}>
                <Ionicons name="play" size={24} color="rgba(255,255,255,0.5)" />
              </View>
            )}
            <View style={styles.gridOverlay}>
              <Ionicons name="eye" size={12} color="#ffffff" />
              <Text style={styles.viewsCountText}>{formatCount(item.viewsCount)}</Text>
            </View>
          </Pressable>
        )}
      />

      {/* Followers Modal */}
      <UserListModal
        visible={showFollowers}
        title="Followers"
        users={followersList}
        loading={loadingUsers}
        currentUserId={currentUser?.id}
        followingMap={currentUserFollowingMap}
        followPendingIds={followPendingIds}
        guestMode={guestMode}
        onClose={() => setShowFollowers(false)}
        onUserPress={(id) => router.push(`/profile/${id}`)}
        onToggleFollow={toggleFollow}
      />

      {/* Following Modal */}
      <UserListModal
        visible={showFollowing}
        title="Following"
        users={followingList}
        loading={loadingUsers}
        currentUserId={currentUser?.id}
        followingMap={currentUserFollowingMap}
        followPendingIds={followPendingIds}
        guestMode={guestMode}
        onClose={() => setShowFollowing(false)}
        onUserPress={(id) => router.push(`/profile/${id}`)}
        onToggleFollow={toggleFollow}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  notFoundTitle: { ...typography.heading, fontSize: 18, fontWeight: '700' },
  notFoundSub: { fontSize: 13, textAlign: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitles: { flex: 1, alignItems: 'center' },
  headerHandle: { fontSize: 15, fontWeight: '700' },
  headerName: { fontSize: 11 },
  profileHeader: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  avatarStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statsRow: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'space-around',
    marginLeft: spacing.lg,
  },
  statItem: { alignItems: 'center', gap: 2 },
  statNumber: { fontSize: 17, fontWeight: '700' },
  statLabel: { fontSize: 12 },
  bioSection: { marginTop: spacing.md, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bioName: { fontSize: 15, fontWeight: '700' },
  personaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  personaBadgeText: { fontSize: 11, fontWeight: '700' },
  brandText: { fontSize: 13, marginTop: 2 },
  countryText: { fontSize: 12, marginTop: 2 },
  interestsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  interestPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  interestText: { fontSize: 11, fontWeight: '600' },
  actionsRow: { marginTop: spacing.md, marginBottom: spacing.sm },
  actionBtn: { minHeight: 42 },
  gridTabHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.sm,
  },
  gridActiveIndicator: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: 2,
  },
  emptyGrid: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: spacing.sm,
  },
  emptyGridText: { fontSize: 14 },
  gridItem: {
    margin: 0.5,
    overflow: 'hidden',
    position: 'relative',
  },
  videoPlaceholder: {
    backgroundColor: '#1f242d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridOverlay: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  viewsCountText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
});
