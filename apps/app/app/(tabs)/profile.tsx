import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  reelsApi,
  usersApi,
  productsApi,
  ordersApi,
  payoutsApi,
  type UploadSource,
  type Order,
  type PayoutsSummary,
  type CreateProductInput,
} from '@reelbazaar/api';
import { APP_NAME, APP_ORIGIN, CATEGORIES, type Reel, type User, type Category, type BrandProduct } from '@reelbazaar/config';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import {
  NativeSegmentedPicker,
  NativeSwitch,
} from '@/components/NativeUI';
import { UserListModal } from '@/components/UserListModal';
import { LEGAL_LAST_UPDATED } from '@/lib/legalContent';
import { formatCount, timeAgo } from '@/lib/timeAgo';
import { radius, spacing, TAB_BAR_HEIGHT, typography } from '@/theme';

const DELETE_WARNING =
  'This permanently removes your profile, your reels and their videos, and your likes, saves, comments and follows. It cannot be undone.';

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

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { palette, theme, setTheme } = useTheme();
  const { user, guestMode, signOut, refreshUser } = useAuth();
  const { showToast } = useToast();

  const [myReels, setMyReels] = useState<Reel[]>([]);
  const [savedReels, setSavedReels] = useState<Reel[]>([]);
  const [brandProducts, setBrandProducts] = useState<BrandProduct[]>([]);
  const [brandOrders, setBrandOrders] = useState<Order[]>([]);
  const [payoutSummary, setPayoutSummary] = useState<PayoutsSummary | null>(null);

  const [activeTab, setActiveTab] = useState<'my' | 'saved' | 'creator_hub' | 'brand_hub'>('my');
  const [, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Stats
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Modals
  const [showSettings, setShowSettings] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [showFulfillmentModal, setShowFulfillmentModal] = useState(false);
  const [selectedFulfillmentOrder, setSelectedFulfillmentOrder] = useState<Order | null>(null);

  // User lists for modals
  const [followersList, setFollowersList] = useState<User[]>([]);
  const [followingList, setFollowingList] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const [followPendingIds, setFollowPendingIds] = useState<Set<string>>(new Set());

  // Edit profile form state
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editBrandName, setEditBrandName] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Add Product form state
  const [prodName, setProdName] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodCategory, setProdCategory] = useState<Category>(CATEGORIES[0]);
  const [prodPrice, setProdPrice] = useState('');
  const [prodMrp, setProdMrp] = useState('');
  const [prodCommission, setProdCommission] = useState('15');
  const [prodInventory, setProdInventory] = useState('50');
  const [prodInStock, setProdInStock] = useState(true);
  const [prodImage, setProdImage] = useState<{ uri: string; name: string; type: string; webFile?: File } | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);

  // Payout request form state
  const [payoutAmount, setPayoutAmount] = useState('500');
  const [payoutUpi, setPayoutUpi] = useState('');
  const [requestingPayout, setRequestingPayout] = useState(false);

  // Fulfillment form state
  const [fulfillStatus, setFulfillStatus] = useState<'packed' | 'shipped' | 'delivered'>('packed');
  const [courierName, setCourierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [savingFulfillment, setSavingFulfillment] = useState(false);

  const isDark = theme !== 'light';
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

  const loadProfileData = useCallback(async () => {
    if (guestMode || !user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      // 1. Fetch own reels
      try {
        const reelsSnap = await getDocs(
          query(collection(db, 'reels'), where('creatorId', '==', user.id))
        );
        const userReels = reelsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Reel));
        userReels.sort((a, b) => reelCreatedAtMs(b.createdAt) - reelCreatedAtMs(a.createdAt));
        setMyReels(userReels);
      } catch (err) {
        console.warn('Firestore own reels query failed, trying API:', err);
        const res = await reelsApi.getUserReels(user.id);
        setMyReels(res.reels || []);
      }

      // 2. Fetch saved reels
      try {
        const savedSnap = await getDocs(
          query(collection(db, 'reelSaves'), where('userId', '==', user.id))
        );
        const saveRows = savedSnap.docs.map((docSnap) => ({
          reelId: docSnap.data().reelId as string,
          createdAt: String(docSnap.data().createdAt ?? ''),
        }));
        saveRows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

        const seen = new Set<string>();
        const orderedIds = saveRows
          .map((r) => r.reelId)
          .filter((id) => {
            if (!id || seen.has(id)) return false;
            seen.add(id);
            return true;
          });

        const loadedSaved = (
          await Promise.all(
            orderedIds.map(async (id) => {
              const snap = await getDoc(doc(db, 'reels', id));
              return snap.exists() ? ({ id: snap.id, ...snap.data() } as Reel) : null;
            })
          )
        ).filter((r): r is Reel => r !== null);

        setSavedReels(loadedSaved);
      } catch (saveErr) {
        console.warn('Failed to load saved reels:', saveErr);
        const res = await reelsApi.getSavedReels(user.id).catch(() => ({ reels: [] }));
        setSavedReels(res.reels || []);
      }

      // 3. Followers / Following count
      const [followersSnap, followingSnap] = await Promise.all([
        getDocs(query(collection(db, 'follows'), where('followingId', '==', user.id))),
        getDocs(query(collection(db, 'follows'), where('followerId', '==', user.id))),
      ]);
      setFollowersCount(followersSnap.size);
      setFollowingCount(followingSnap.size);

      // 4. Following map
      const fMap: Record<string, boolean> = {};
      followingSnap.docs.forEach((item) => {
        fMap[item.data().followingId] = true;
      });
      setFollowingMap(fMap);

      // 5. Creator Payouts Summary
      try {
        const pSummary = await payoutsApi.getMe();
        setPayoutSummary(pSummary);
      } catch {
        /* non-critical */
      }

      // 6. Brand Products & Orders if Brand
      try {
        const [prodRes, ordersRes] = await Promise.all([
          productsApi.getBrandProducts(user.id),
          ordersApi.getBrandOrders(),
        ]);
        setBrandProducts(prodRes.products || []);
        setBrandOrders(ordersRes.orders || []);
      } catch {
        /* non-critical */
      }
    } catch (err) {
      console.error('Error loading profile data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [guestMode, user]);

  useEffect(() => {
    void loadProfileData();
  }, [loadProfileData]);

  // Sync edit form fields when user object changes
  useEffect(() => {
    if (user) {
      setEditName(user.name || '');
      setEditUsername(user.username || '');
      setEditBrandName(user.brandName || '');
      setEditWebsite(user.websiteLink || '');
    }
  }, [user]);

  const toggleFollow = async (targetId: string) => {
    if (guestMode || !user) return;
    if (followPendingIds.has(targetId)) return;

    const isCurrentlyFollowing = Boolean(followingMap[targetId]);
    setFollowPendingIds((prev) => new Set(prev).add(targetId));
    setFollowingMap((prev) => ({ ...prev, [targetId]: !isCurrentlyFollowing }));
    setFollowingCount((prev) => Math.max(0, prev + (isCurrentlyFollowing ? -1 : 1)));

    try {
      const followRef = doc(db, 'follows', `${user.id}_${targetId}`);
      if (isCurrentlyFollowing) {
        await deleteDoc(followRef);
      } else {
        await setDoc(followRef, {
          followerId: user.id,
          followingId: targetId,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('Failed to toggle follow:', err);
      setFollowingMap((prev) => ({ ...prev, [targetId]: isCurrentlyFollowing }));
      setFollowingCount((prev) => Math.max(0, prev + (isCurrentlyFollowing ? 1 : -1)));
      showToast('Failed to update follow status', 'error');
    } finally {
      setFollowPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
    }
  };

  const openFollowers = async () => {
    if (!user) return;
    setLoadingUsers(true);
    setShowFollowers(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'follows'), where('followingId', '==', user.id))
      );
      const followerIds = snap.docs.map((d) => d.data().followerId as string);
      const users = await loadUserList(followerIds);
      setFollowersList(users);
    } catch (err) {
      console.error('Failed to load followers:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const openFollowing = async () => {
    if (!user) return;
    setLoadingUsers(true);
    setShowFollowing(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'follows'), where('followerId', '==', user.id))
      );
      const followingIds = snap.docs.map((d) => d.data().followingId as string);
      const users = await loadUserList(followingIds);
      setFollowingList(users);
    } catch (err) {
      console.error('Failed to load following:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handlePickAvatar = async () => {
    if (guestMode || !user) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showToast('Permission required to select avatar', 'info');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];

      setUploadingAvatar(true);
      try {
        let avatarUrl: string | null = null;
        try {
          const uploadSource: UploadSource =
            Platform.OS === 'web' && (asset as { file?: File }).file
              ? (asset as { file?: File }).file!
              : {
                  uri: asset.uri,
                  name: asset.fileName || 'avatar.jpg',
                  type: asset.mimeType || 'image/jpeg',
                };
          const res = await usersApi.updateAvatar(uploadSource);
          avatarUrl = res.avatarUrl;
        } catch (apiErr) {
          console.warn('Avatar API upload failed, using Firebase Storage:', apiErr);
          const storageRef = ref(
            storage,
            `avatars/${user.id}/${Date.now()}_${(asset.fileName || 'avatar.jpg').replace(/[^a-zA-Z0-9._-]/g, '_')}`
          );
          let uploadBlob: Blob;
          if (Platform.OS === 'web' && (asset as { file?: File }).file) {
            uploadBlob = (asset as { file?: File }).file!;
          } else {
            const resp = await fetch(asset.uri);
            uploadBlob = await resp.blob();
          }
          await uploadBytes(storageRef, uploadBlob, {
            contentType: asset.mimeType || 'image/jpeg',
          });
          avatarUrl = await getDownloadURL(storageRef);
        }

        if (avatarUrl) {
          await updateDoc(doc(db, 'users', user.id), {
            avatarUrl,
            updatedAt: new Date().toISOString(),
          });
          await refreshUser();
          showToast('Profile photo updated', 'success');
        }
      } catch (uploadErr) {
        console.error('Failed to update avatar:', uploadErr);
        showToast('Failed to update profile photo', 'error');
      } finally {
        setUploadingAvatar(false);
      }
    } catch (err) {
      console.error('Avatar picker error:', err);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    const sanitizedUsername = editUsername.toLowerCase().replace(/[^a-z0-9_.]/g, '');
    if (!editName.trim()) {
      showToast('Name cannot be empty', 'error');
      return;
    }
    if (!sanitizedUsername.trim()) {
      showToast('Username cannot be empty', 'error');
      return;
    }

    setSavingProfile(true);
    try {
      const payload = {
        name: editName.trim(),
        username: sanitizedUsername,
        brandName: editBrandName.trim() || null,
        websiteLink: editWebsite.trim() || null,
        updatedAt: new Date().toISOString(),
      };

      await updateDoc(doc(db, 'users', user.id), payload);
      await refreshUser();
      showToast('Profile updated', 'success');
      setShowEditProfile(false);
    } catch (err) {
      console.error('Failed to save profile:', err);
      showToast('Failed to update profile', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePickProductImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!res.canceled && res.assets?.[0]) {
      const asset = res.assets[0];
      setProdImage({
        uri: asset.uri,
        name: asset.fileName || 'product.jpg',
        type: asset.mimeType || 'image/jpeg',
        webFile: (asset as { file?: File }).file,
      });
    }
  };

  const handleCreateProduct = async () => {
    if (!prodName.trim()) {
      showToast('Product name is required', 'error');
      return;
    }
    const priceNum = Number.parseFloat(prodPrice);
    if (!Number.isFinite(priceNum) || priceNum < 1) {
      showToast('Please enter a valid price in INR', 'error');
      return;
    }

    setSavingProduct(true);
    try {
      const input: CreateProductInput = {
        name: prodName.trim(),
        description: prodDesc.trim() || undefined,
        category: prodCategory,
        price: priceNum,
        originalPrice: prodMrp ? Number.parseFloat(prodMrp) : undefined,
        commissionRate: prodCommission ? Number.parseFloat(prodCommission) : 10,
        inventoryCount: prodInventory ? Number.parseInt(prodInventory, 10) : 50,
        inStock: prodInStock,
      };

      const uploadSource: UploadSource | undefined =
        prodImage ? (Platform.OS === 'web' && prodImage.webFile ? prodImage.webFile : prodImage) : undefined;

      const res = await productsApi.createProduct(input, uploadSource);
      setBrandProducts((prev) => [res.product, ...prev]);
      showToast('Product added to catalog! 🎉', 'success');
      setShowAddProduct(false);
      setProdName('');
      setProdDesc('');
      setProdPrice('');
      setProdMrp('');
      setProdImage(null);
    } catch (err: unknown) {
      console.error('Failed to create product:', err);
      const msg = err instanceof Error ? err.message : 'Failed to add product';
      showToast(msg, 'error');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await productsApi.deleteProduct(id);
      setBrandProducts((prev) => prev.filter((p) => p.id !== id));
      showToast('Product removed', 'success');
    } catch (err) {
      console.error('Delete product failed:', err);
      showToast('Could not delete product', 'error');
    }
  };

  const handleRequestPayout = async () => {
    const amt = Number.parseFloat(payoutAmount);
    if (!Number.isFinite(amt) || amt < 500) {
      showToast('Minimum payout amount is ₹500', 'info');
      return;
    }
    if (!payoutUpi.trim()) {
      showToast('Please enter your UPI ID', 'info');
      return;
    }
    if ((payoutSummary?.totals.pendingBalance ?? 0) < amt) {
      showToast('Insufficient pending balance', 'error');
      return;
    }

    setRequestingPayout(true);
    try {
      const res = await payoutsApi.requestPayout({
        amount: amt,
        payoutMethod: 'upi',
        upiId: payoutUpi.trim(),
      });
      showToast(res.message || 'Payout request submitted! 🎉', 'success');
      setShowPayoutModal(false);
      void loadProfileData();
    } catch (err: unknown) {
      console.error('Payout request error:', err);
      const msg = err instanceof Error ? err.message : 'Payout request failed';
      showToast(msg, 'error');
    } finally {
      setRequestingPayout(false);
    }
  };

  const handleUpdateFulfillment = async () => {
    if (!selectedFulfillmentOrder) return;
    setSavingFulfillment(true);
    try {
      const res = await ordersApi.updateFulfillment(selectedFulfillmentOrder.id, {
        status: fulfillStatus,
        courierName: courierName.trim() || undefined,
        trackingNumber: trackingNumber.trim() || undefined,
      });
      setBrandOrders((prev) =>
        prev.map((o) => (o.id === res.order.id ? res.order : o))
      );
      showToast(`Order marked as ${fulfillStatus}! 🎉`, 'success');
      setShowFulfillmentModal(false);
      setSelectedFulfillmentOrder(null);
    } catch (err: unknown) {
      console.error('Update fulfillment error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to update fulfillment';
      showToast(msg, 'error');
    } finally {
      setSavingFulfillment(false);
    }
  };

  const handleShareProfile = async () => {
    if (!user) return;
    const handle = user.username || user.name.replace(/\s+/g, '').toLowerCase();
    try {
      await Share.share({
        message: `Check out @${handle} on ${APP_NAME}! ${APP_ORIGIN}/profile/${user.id}`,
        url: `${APP_ORIGIN}/profile/${user.id}`,
      });
    } catch {
      /* dismiss */
    }
  };

  const confirmDelete = useCallback(() => {
    const proceed = async () => {
      setDeleting(true);
      try {
        await usersApi.deleteAccount();
        showToast('Account deleted', 'success');
        await signOut();
      } catch (err) {
        console.error('Account deletion failed:', err);
        showToast('Could not delete account. Contact support.', 'error');
      } finally {
        setDeleting(false);
      }
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(DELETE_WARNING)) void proceed();
      return;
    }

    Alert.alert('Delete account?', DELETE_WARNING, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void proceed() },
    ]);
  }, [showToast, signOut]);

  if (guestMode || !user) {
    return (
      <View style={[styles.fill, { backgroundColor: palette.background, paddingTop: insets.top }]}>
        <View style={[styles.header, { borderBottomColor: palette.border }]}>
          <Text style={[styles.headerHandle, { color: palette.text }]}>Profile</Text>
          <Pressable onPress={() => setShowSettings(true)} hitSlop={8}>
            <Ionicons name="settings-outline" size={24} color={palette.text} />
          </Pressable>
        </View>

        <View style={styles.guestContainer}>
          <View style={[styles.guestIconWrap, { backgroundColor: palette.accentSoft }]}>
            <Ionicons name="person" size={44} color={palette.accent} />
          </View>
          <Text style={[styles.guestHeading, { color: palette.text }]}>Sign in to view your profile</Text>
          <Text style={[styles.guestSubtitle, { color: palette.textMuted }]}>
            Create reels, manage brand products, earn sales commissions, and track orders.
          </Text>
          <Button
            label="Sign in"
            onPress={() => router.push('/auth')}
            style={styles.signInBtn}
            fullWidth
          />
        </View>
      </View>
    );
  }

  const handle = user.username || user.name.replace(/\s+/g, '').toLowerCase();

  return (
    <View style={[styles.fill, { backgroundColor: palette.background, paddingTop: insets.top }]}>
      {/* Header bar */}
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <View style={styles.headerTitles}>
          <Text style={[styles.headerHandle, { color: palette.text }]} numberOfLines={1}>
            @{handle}
          </Text>
          <Text style={[styles.headerName, { color: palette.textMuted }]} numberOfLines={1}>
            {user.name}
          </Text>
        </View>

        <View style={styles.headerRightActions}>
          <Pressable
            onPress={() => router.push('/orders')}
            hitSlop={8}
            accessibilityLabel="My Orders"
            style={styles.headerBtn}
          >
            <Ionicons name="bag-handle-outline" size={22} color={palette.text} />
          </Pressable>

          <Pressable
            onPress={() => setShowSettings(true)}
            hitSlop={8}
            accessibilityLabel="Settings"
            style={styles.headerBtn}
          >
            <Ionicons name="menu-outline" size={26} color={palette.text} />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={activeTab === 'my' ? myReels : activeTab === 'saved' ? savedReels : []}
        keyExtractor={(item) => item.id}
        numColumns={3}
        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + spacing.xl }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void loadProfileData();
            }}
            tintColor={palette.accent}
          />
        }
        ListHeaderComponent={
          <View style={styles.profileHeader}>
            {/* Avatar & Stats */}
            <View style={styles.avatarStatsRow}>
              <Pressable
                onPress={handlePickAvatar}
                disabled={uploadingAvatar}
                style={styles.avatarWrap}
              >
                <Avatar uri={user.avatarUrl} name={user.name} size={76} ring />
                <View style={[styles.avatarBadge, { backgroundColor: palette.card }]}>
                  {uploadingAvatar ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <Ionicons name="camera" size={13} color={palette.text} />
                  )}
                </View>
              </Pressable>

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statNumber, { color: palette.text }]}>{myReels.length}</Text>
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

                {(user.streakCount ?? 0) > 0 ? (
                  <View style={styles.statItem}>
                    <Text style={[styles.statNumber, { color: palette.streak }]}>
                      🔥{user.streakCount}
                    </Text>
                    <Text style={[styles.statLabel, { color: palette.textMuted }]}>Streak</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* User details */}
            <View style={styles.bioSection}>
              <View style={styles.nameRow}>
                <Text style={[styles.bioName, { color: palette.text }]}>{user.name}</Text>
                <Ionicons name="checkmark-circle" size={16} color={palette.accent} />
                {user.persona ? (
                  <View
                    style={[
                      styles.personaBadge,
                      {
                        backgroundColor: palette.accentSoft,
                        borderColor: palette.accentGlow,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.personaBadgeText,
                        { color: palette.accent },
                      ]}
                    >
                      {user.persona}
                    </Text>
                  </View>
                ) : null}
              </View>

              {user.brandName ? (
                <Text style={[styles.brandText, { color: palette.textSecondary }]}>
                  Building <Text style={{ fontWeight: '700', color: palette.text }}>{user.brandName}</Text>
                </Text>
              ) : null}

              {user.country ? (
                <Text style={[styles.countryText, { color: palette.textMuted }]}>
                  📍 {user.country}
                </Text>
              ) : null}
            </View>

            {/* Quick Actions */}
            <View style={styles.actionsRow}>
              <Button
                label="Edit Profile"
                variant="secondary"
                onPress={() => setShowEditProfile(true)}
                style={styles.actionBtn}
              />
              <Button
                label="Create Reel"
                icon="add-circle-outline"
                variant="primary"
                onPress={() => router.push('/create')}
                style={styles.actionBtn}
              />
              <Pressable
                onPress={handleShareProfile}
                hitSlop={6}
                accessibilityLabel="Share profile"
                style={[
                  styles.iconBtn,
                  {
                    backgroundColor: palette.cardElevated,
                    borderColor: palette.borderStrong,
                  },
                ]}
              >
                <Ionicons name="share-social-outline" size={18} color={palette.text} />
              </Pressable>
            </View>

            {/* 4 Multi-Sided Marketplace Tabs */}
            <View style={[styles.hubTabsRow, { borderBottomColor: palette.border }]}>
              <Pressable
                onPress={() => setActiveTab('my')}
                style={[
                  styles.hubTab,
                  activeTab === 'my' && [styles.hubTabActive, { borderBottomColor: palette.accent }],
                ]}
              >
                <Ionicons
                  name={activeTab === 'my' ? 'grid' : 'grid-outline'}
                  size={19}
                  color={activeTab === 'my' ? palette.accent : palette.textMuted}
                />
                <Text style={[styles.hubTabText, { color: activeTab === 'my' ? palette.text : palette.textMuted }]}>
                  Posts
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setActiveTab('saved')}
                style={[
                  styles.hubTab,
                  activeTab === 'saved' && [styles.hubTabActive, { borderBottomColor: palette.accent }],
                ]}
              >
                <Ionicons
                  name={activeTab === 'saved' ? 'bookmark' : 'bookmark-outline'}
                  size={19}
                  color={activeTab === 'saved' ? palette.accent : palette.textMuted}
                />
                <Text style={[styles.hubTabText, { color: activeTab === 'saved' ? palette.text : palette.textMuted }]}>
                  Saved
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setActiveTab('creator_hub')}
                style={[
                  styles.hubTab,
                  activeTab === 'creator_hub' && [styles.hubTabActive, { borderBottomColor: palette.accent }],
                ]}
              >
                <Ionicons
                  name={activeTab === 'creator_hub' ? 'wallet' : 'wallet-outline'}
                  size={19}
                  color={activeTab === 'creator_hub' ? palette.accent : palette.textMuted}
                />
                <Text style={[styles.hubTabText, { color: activeTab === 'creator_hub' ? palette.text : palette.textMuted }]}>
                  Earnings
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setActiveTab('brand_hub')}
                style={[
                  styles.hubTab,
                  activeTab === 'brand_hub' && [styles.hubTabActive, { borderBottomColor: palette.accent }],
                ]}
              >
                <Ionicons
                  name={activeTab === 'brand_hub' ? 'storefront' : 'storefront-outline'}
                  size={19}
                  color={activeTab === 'brand_hub' ? palette.accent : palette.textMuted}
                />
                <Text style={[styles.hubTabText, { color: activeTab === 'brand_hub' ? palette.text : palette.textMuted }]}>
                  Brand Hub
                </Text>
              </Pressable>
            </View>

            {/* Creator Hub Tab Content */}
            {activeTab === 'creator_hub' && (
              <View style={styles.hubContainer}>
                {/* Total Earnings Hero Card */}
                <View style={[styles.earningsHero, { backgroundColor: palette.accentSoft, borderColor: palette.accent }]}>
                  <Text style={[styles.earningsLabel, { color: palette.accent }]}>TOTAL CREATOR EARNINGS</Text>
                  <Text style={[styles.earningsAmount, { color: palette.text }]}>
                    ₹{(payoutSummary?.totals.totalEarnings ?? 0).toLocaleString('en-IN')}
                  </Text>
                  <View style={styles.pendingRow}>
                    <Text style={[styles.pendingText, { color: palette.textSecondary }]}>
                      Pending Balance: ₹{(payoutSummary?.totals.pendingBalance ?? 0).toLocaleString('en-IN')}
                    </Text>
                    <Pressable
                      onPress={() => setShowPayoutModal(true)}
                      style={[styles.withdrawPill, { backgroundColor: palette.accent }]}
                    >
                      <Text style={styles.withdrawPillText}>Withdraw UPI</Text>
                      <Ionicons name="arrow-forward" size={12} color="#ffffff" />
                    </Pressable>
                  </View>
                </View>

                {/* 3 Split Breakdown Cards */}
                <View style={styles.breakdownGrid}>
                  <View style={[styles.breakdownItem, { backgroundColor: palette.cardElevated, borderColor: palette.border }]}>
                    <Ionicons name="eye" size={18} color={palette.accent} />
                    <Text style={[styles.breakdownItemTitle, { color: palette.textMuted }]}>Views (₹1/view)</Text>
                    <Text style={[styles.breakdownItemAmt, { color: palette.text }]}>
                      ₹{(payoutSummary?.totals.viewEarnings ?? 0).toLocaleString('en-IN')}
                    </Text>
                    <Text style={[styles.breakdownItemSub, { color: palette.textMuted }]}>
                      {payoutSummary?.totals.views ?? 0} views
                    </Text>
                  </View>

                  <View style={[styles.breakdownItem, { backgroundColor: palette.cardElevated, borderColor: palette.border }]}>
                    <Ionicons name="finger-print" size={18} color={palette.warning} />
                    <Text style={[styles.breakdownItemTitle, { color: palette.textMuted }]}>Clicks (₹5/click)</Text>
                    <Text style={[styles.breakdownItemAmt, { color: palette.text }]}>
                      ₹{(payoutSummary?.totals.clickEarnings ?? 0).toLocaleString('en-IN')}
                    </Text>
                    <Text style={[styles.breakdownItemSub, { color: palette.textMuted }]}>
                      {payoutSummary?.totals.clicks ?? 0} clicks
                    </Text>
                  </View>

                  <View style={[styles.breakdownItem, { backgroundColor: palette.cardElevated, borderColor: palette.border }]}>
                    <Ionicons name="sparkles" size={18} color={palette.success} />
                    <Text style={[styles.breakdownItemTitle, { color: palette.textMuted }]}>Product Comm.</Text>
                    <Text style={[styles.breakdownItemAmt, { color: palette.success }]}>
                      ₹{(payoutSummary?.totals.salesCommissions ?? 0).toLocaleString('en-IN')}
                    </Text>
                    <Text style={[styles.breakdownItemSub, { color: palette.textMuted }]}>
                      {payoutSummary?.totals.salesCount ?? 0} orders
                    </Text>
                  </View>
                </View>

                {/* Payout Requests History */}
                <View style={styles.historySection}>
                  <Text style={[styles.sectionHeading, { color: palette.text }]}>Payout History</Text>
                  {(payoutSummary?.payoutHistory || []).length === 0 ? (
                    <Text style={[styles.emptyNotice, { color: palette.textMuted }]}>
                      No withdrawal requests yet. Minimum withdrawal is ₹500.
                    </Text>
                  ) : (
                    (payoutSummary?.payoutHistory || []).map((p) => (
                      <View
                        key={p.id}
                        style={[styles.historyRow, { backgroundColor: palette.card, borderColor: palette.border }]}
                      >
                        <View>
                          <Text style={[styles.historyAmt, { color: palette.text }]}>
                            ₹{p.amount.toLocaleString('en-IN')}
                          </Text>
                          <Text style={[styles.historyDate, { color: palette.textMuted }]}>
                            {timeAgo(p.createdAt)}
                          </Text>
                        </View>
                        <View style={[styles.payoutStatusBadge, { backgroundColor: p.status === 'completed' ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)' }]}>
                          <Text style={[styles.payoutStatusText, { color: p.status === 'completed' ? '#22c55e' : '#eab308' }]}>
                            {p.status || 'Pending'}
                          </Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              </View>
            )}

            {/* Brand Hub Tab Content */}
            {activeTab === 'brand_hub' && (
              <View style={styles.hubContainer}>
                {/* Brand Hub Header Bar */}
                <View style={styles.brandHubBar}>
                  <View>
                    <Text style={[styles.brandHubTitle, { color: palette.text }]}>Brand Storefront</Text>
                    <Text style={[styles.brandHubSub, { color: palette.textMuted }]}>
                      {brandProducts.length} Live Products · {brandOrders.length} Orders
                    </Text>
                  </View>

                  <Button
                    label="+ Add Product"
                    variant="primary"
                    onPress={() => setShowAddProduct(true)}
                    style={styles.addProdBtn}
                  />
                </View>

                {/* Catalog List */}
                <View style={styles.brandSection}>
                  <Text style={[styles.sectionHeading, { color: palette.text }]}>Product Catalog</Text>
                  {brandProducts.length === 0 ? (
                    <View style={[styles.emptyCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                      <Ionicons name="shirt-outline" size={32} color={palette.textMuted} />
                      <Text style={[styles.emptyCardText, { color: palette.textMuted }]}>
                        No products in catalog yet. Add products to allow creators to tag them.
                      </Text>
                    </View>
                  ) : (
                    brandProducts.map((p) => (
                      <View
                        key={p.id}
                        style={[styles.brandProductRow, { backgroundColor: palette.card, borderColor: palette.border }]}
                      >
                        <View style={styles.brandProdThumb}>
                          {p.imageUrl ? (
                            <Image source={{ uri: p.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
                          ) : (
                            <Ionicons name="bag" size={20} color={palette.textMuted} />
                          )}
                        </View>

                        <View style={styles.brandProdDetails}>
                          <Text style={[styles.brandProdName, { color: palette.text }]} numberOfLines={1}>
                            {p.name}
                          </Text>
                          <Text style={[styles.brandProdMeta, { color: palette.textMuted }]}>
                            ₹{p.price} · {p.commissionRate || 10}% Commission · {p.inventoryCount || 0} in stock
                          </Text>
                        </View>

                        <Pressable onPress={() => handleDeleteProduct(p.id)} hitSlop={8}>
                          <Ionicons name="trash-outline" size={18} color={palette.danger} />
                        </Pressable>
                      </View>
                    ))
                  )}
                </View>

                {/* Incoming Orders Fulfillment */}
                <View style={styles.brandSection}>
                  <Text style={[styles.sectionHeading, { color: palette.text }]}>Orders Fulfillment</Text>
                  {brandOrders.length === 0 ? (
                    <View style={[styles.emptyCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                      <Ionicons name="cube-outline" size={32} color={palette.textMuted} />
                      <Text style={[styles.emptyCardText, { color: palette.textMuted }]}>
                        No customer orders to fulfill yet.
                      </Text>
                    </View>
                  ) : (
                    brandOrders.map((o) => (
                      <View
                        key={o.id}
                        style={[styles.brandOrderCard, { backgroundColor: palette.card, borderColor: palette.border }]}
                      >
                        <View style={styles.brandOrderTop}>
                          <View>
                            <Text style={[styles.brandOrderId, { color: palette.text }]}>
                              Order #{o.id.slice(0, 8).toUpperCase()}
                            </Text>
                            <Text style={[styles.brandOrderBuyer, { color: palette.textSecondary }]}>
                              {o.buyerName || 'Buyer'} · ₹{o.amount}
                            </Text>
                          </View>

                          <View style={[styles.payoutStatusBadge, { backgroundColor: o.status === 'delivered' ? palette.successSoft : palette.accentSoft }]}>
                            <Text style={[styles.payoutStatusText, { color: o.status === 'delivered' ? palette.success : palette.accent }]}>
                              {o.status.toUpperCase()}
                            </Text>
                          </View>
                        </View>

                        <Button
                          label="Update Fulfillment"
                          variant="secondary"
                          onPress={() => {
                            setSelectedFulfillmentOrder(o);
                            setFulfillStatus(
                              o.status === 'confirmed' ? 'packed' : o.status === 'packed' ? 'shipped' : 'delivered'
                            );
                            setCourierName(o.courierName || '');
                            setTrackingNumber(o.trackingNumber || '');
                            setShowFulfillmentModal(true);
                          }}
                          style={{ minHeight: 36 }}
                        />
                      </View>
                    ))
                  )}
                </View>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          (activeTab === 'my' || activeTab === 'saved') ? (
            <View style={styles.emptyGrid}>
              <Ionicons
                name={activeTab === 'my' ? 'videocam-outline' : 'bookmark-outline'}
                size={44}
                color={palette.textMuted}
              />
              <Text style={[styles.emptyGridText, { color: palette.textMuted }]}>
                {activeTab === 'my' ? 'No reels posted yet' : 'No saved reels yet'}
              </Text>
            </View>
          ) : null
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
              <Image source={{ uri: item.thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
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

      {/* Add Product Modal */}
      <Modal visible={showAddProduct} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAddProduct(false)}>
        <View style={[styles.modalContainer, { backgroundColor: palette.background, paddingTop: insets.top + spacing.xs, paddingBottom: insets.bottom + spacing.md }]}>
          <View style={[styles.modalHeader, { borderBottomColor: palette.border }]}>
            <Pressable onPress={() => setShowAddProduct(false)} hitSlop={8}>
              <Text style={[styles.cancelText, { color: palette.textMuted }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.modalTitle, { color: palette.text }]}>Add Product</Text>
            <Pressable onPress={handleCreateProduct} disabled={savingProduct} hitSlop={8}>
              <Text style={[styles.doneText, { color: palette.accent }]}>{savingProduct ? 'Saving…' : 'Publish'}</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
            {/* Image Picker */}
            <Pressable onPress={handlePickProductImage} style={[styles.prodImgPicker, { borderColor: palette.border, backgroundColor: isDark ? '#141416' : '#f0f2f5' }]}>
              {prodImage ? (
                <Image source={{ uri: prodImage.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <View style={styles.prodImgPrompt}>
                  <Ionicons name="image-outline" size={32} color={palette.accent} />
                  <Text style={[styles.prodImgText, { color: palette.text }]}>Upload Product Image</Text>
                </View>
              )}
            </Pressable>

            <View style={styles.editField}>
              <Text style={[styles.editLabel, { color: palette.textMuted }]}>PRODUCT TITLE *</Text>
              <TextInput
                value={prodName}
                onChangeText={setProdName}
                placeholder="e.g. Oversized Heavyweight Tee"
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                style={[styles.editInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderColor: palette.borderInteractive, color: palette.text }]}
              />
            </View>

            <View style={styles.editField}>
              <Text style={[styles.editLabel, { color: palette.textMuted }]}>DESCRIPTION</Text>
              <TextInput
                value={prodDesc}
                onChangeText={setProdDesc}
                placeholder="Fabric details, sizing, material…"
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                multiline
                numberOfLines={3}
                style={[styles.editInput, { height: 74, paddingTop: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderColor: palette.borderInteractive, color: palette.text }]}
              />
            </View>

            <View style={styles.editField}>
              <Text style={[styles.editLabel, { color: palette.textMuted }]}>CATEGORY *</Text>
              <View style={styles.chipsRow}>
                {CATEGORIES.map((category) => (
                  <Pressable
                    key={category}
                    onPress={() => setProdCategory(category)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: prodCategory === category ? palette.accent : 'transparent',
                        borderColor: prodCategory === category ? palette.accent : palette.border,
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: prodCategory === category ? '#ffffff' : palette.text }]}>
                      {category}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={[styles.editField, { flex: 1 }]}>
                <Text style={[styles.editLabel, { color: palette.textMuted }]}>PRICE (INR ₹) *</Text>
                <TextInput
                  value={prodPrice}
                  onChangeText={setProdPrice}
                  placeholder="999"
                  keyboardType="numeric"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                  style={[styles.editInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderColor: palette.borderInteractive, color: palette.text }]}
                />
              </View>

              <View style={[styles.editField, { flex: 1 }]}>
                <Text style={[styles.editLabel, { color: palette.textMuted }]}>MRP (INR ₹)</Text>
                <TextInput
                  value={prodMrp}
                  onChangeText={setProdMrp}
                  placeholder="1499"
                  keyboardType="numeric"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                  style={[styles.editInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderColor: palette.borderInteractive, color: palette.text }]}
                />
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={[styles.editField, { flex: 1 }]}>
                <Text style={[styles.editLabel, { color: palette.textMuted }]}>CREATOR COMMISSION %</Text>
                <TextInput
                  value={prodCommission}
                  onChangeText={setProdCommission}
                  placeholder="15"
                  keyboardType="numeric"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                  style={[styles.editInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderColor: palette.borderInteractive, color: palette.text }]}
                />
              </View>

              <View style={[styles.editField, { flex: 1 }]}>
                <Text style={[styles.editLabel, { color: palette.textMuted }]}>STOCK INVENTORY</Text>
                <TextInput
                  value={prodInventory}
                  onChangeText={setProdInventory}
                  placeholder="50"
                  keyboardType="numeric"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                  style={[styles.editInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderColor: palette.borderInteractive, color: palette.text }]}
                />
              </View>
            </View>

            <View style={styles.switchRow}>
              <Text style={[styles.editLabel, { color: palette.text }]}>IN STOCK & AVAILABLE FOR PURCHASE</Text>
              <NativeSwitch value={prodInStock} onValueChange={setProdInStock} />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Payout Withdrawal Modal */}
      <Modal visible={showPayoutModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPayoutModal(false)}>
        <View style={[styles.modalContainer, { backgroundColor: palette.background, paddingTop: insets.top + spacing.xs, paddingBottom: insets.bottom + spacing.md }]}>
          <View style={[styles.modalHeader, { borderBottomColor: palette.border }]}>
            <Pressable onPress={() => setShowPayoutModal(false)} hitSlop={8}>
              <Text style={[styles.cancelText, { color: palette.textMuted }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.modalTitle, { color: palette.text }]}>Withdraw Earnings</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.formScroll}>
            <View style={[styles.balanceCard, { backgroundColor: palette.accentSoft, borderColor: palette.accent }]}>
              <Text style={[styles.balanceCardLabel, { color: palette.accent }]}>AVAILABLE PENDING BALANCE</Text>
              <Text style={[styles.balanceCardVal, { color: palette.text }]}>
                ₹{(payoutSummary?.totals.pendingBalance ?? 0).toLocaleString('en-IN')}
              </Text>
            </View>

            <View style={styles.editField}>
              <Text style={[styles.editLabel, { color: palette.textMuted }]}>WITHDRAWAL AMOUNT (INR ₹)</Text>
              <TextInput
                value={payoutAmount}
                onChangeText={setPayoutAmount}
                placeholder="500"
                keyboardType="numeric"
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                style={[styles.editInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderColor: palette.borderInteractive, color: palette.text }]}
              />
            </View>

            <View style={styles.editField}>
              <Text style={[styles.editLabel, { color: palette.textMuted }]}>RECEIVING UPI ID</Text>
              <TextInput
                value={payoutUpi}
                onChangeText={setPayoutUpi}
                placeholder="e.g. yourname@okhdfcbank"
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                style={[styles.editInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderColor: palette.borderInteractive, color: palette.text }]}
              />
            </View>

            <Button
              label={requestingPayout ? 'Processing…' : 'Submit Withdrawal Request'}
              variant="primary"
              loading={requestingPayout}
              onPress={handleRequestPayout}
              fullWidth
              style={{ marginTop: spacing.md }}
            />
          </View>
        </View>
      </Modal>

      {/* Fulfillment Modal */}
      <Modal visible={showFulfillmentModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowFulfillmentModal(false)}>
        <View style={[styles.modalContainer, { backgroundColor: palette.background, paddingTop: insets.top + spacing.xs, paddingBottom: insets.bottom + spacing.md }]}>
          <View style={[styles.modalHeader, { borderBottomColor: palette.border }]}>
            <Pressable onPress={() => setShowFulfillmentModal(false)} hitSlop={8}>
              <Text style={[styles.cancelText, { color: palette.textMuted }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.modalTitle, { color: palette.text }]}>Update Fulfillment</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.formScroll}>
            <View style={styles.editField}>
              <Text style={[styles.editLabel, { color: palette.textMuted }]}>STATUS</Text>
              <NativeSegmentedPicker<'packed' | 'shipped' | 'delivered'>
                options={[
                  { label: 'Packed', value: 'packed' },
                  { label: 'Shipped', value: 'shipped' },
                  { label: 'Delivered', value: 'delivered' },
                ]}
                selectedValue={fulfillStatus}
                onValueChange={setFulfillStatus}
              />
            </View>

            <View style={styles.editField}>
              <Text style={[styles.editLabel, { color: palette.textMuted }]}>COURIER PARTNER</Text>
              <TextInput
                value={courierName}
                onChangeText={setCourierName}
                placeholder="e.g. BlueDart, Delhivery, DTDC"
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                style={[styles.editInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderColor: palette.borderInteractive, color: palette.text }]}
              />
            </View>

            <View style={styles.editField}>
              <Text style={[styles.editLabel, { color: palette.textMuted }]}>TRACKING AWB NUMBER</Text>
              <TextInput
                value={trackingNumber}
                onChangeText={setTrackingNumber}
                placeholder="e.g. BLUEDART-9847291"
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                style={[styles.editInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderColor: palette.borderInteractive, color: palette.text }]}
              />
            </View>

            <Button
              label={savingFulfillment ? 'Saving…' : 'Update Status & Notify Buyer'}
              variant="primary"
              loading={savingFulfillment}
              onPress={handleUpdateFulfillment}
              fullWidth
              style={{ marginTop: spacing.md }}
            />
          </View>
        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal visible={showEditProfile} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowEditProfile(false)}>
        <View style={[styles.modalContainer, { backgroundColor: palette.background, paddingTop: insets.top + spacing.xs, paddingBottom: insets.bottom + spacing.md }]}>
          <View style={[styles.modalHeader, { borderBottomColor: palette.border }]}>
            <Pressable onPress={() => setShowEditProfile(false)} hitSlop={8}>
              <Text style={[styles.cancelText, { color: palette.textMuted }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.modalTitle, { color: palette.text }]}>Edit Profile</Text>
            <Pressable onPress={handleSaveProfile} disabled={savingProfile} hitSlop={8}>
              <Text style={[styles.doneText, { color: palette.accent }]}>{savingProfile ? 'Saving…' : 'Done'}</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.editAvatarSection}>
              <Pressable onPress={handlePickAvatar} disabled={uploadingAvatar} style={styles.avatarWrap}>
                <Avatar uri={user.avatarUrl} name={user.name} size={84} ring />
                {uploadingAvatar && (
                  <View style={styles.avatarLoadingOverlay}>
                    <LoadingSpinner size="sm" />
                  </View>
                )}
              </Pressable>
              <Pressable onPress={handlePickAvatar} disabled={uploadingAvatar} style={{ marginTop: 8 }}>
                <Text style={[styles.changePhotoText, { color: palette.accent }]}>Change profile photo</Text>
              </Pressable>
            </View>

            <View style={styles.editField}>
              <Text style={[styles.editLabel, { color: palette.textMuted }]}>NAME</Text>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                placeholder="Your Name"
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                style={[styles.editInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderColor: palette.borderInteractive, color: palette.text }]}
              />
            </View>

            <View style={styles.editField}>
              <Text style={[styles.editLabel, { color: palette.textMuted }]}>USERNAME</Text>
              <TextInput
                value={editUsername}
                onChangeText={(t) => setEditUsername(t.replace(/[^a-zA-Z0-9_.]/g, '').toLowerCase())}
                placeholder="username"
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.editInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderColor: palette.borderInteractive, color: palette.text }]}
              />
            </View>

            <View style={styles.editField}>
              <Text style={[styles.editLabel, { color: palette.textMuted }]}>BRAND NAME</Text>
              <TextInput
                value={editBrandName}
                onChangeText={setEditBrandName}
                placeholder="e.g. Acme Studio"
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                style={[styles.editInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderColor: palette.borderInteractive, color: palette.text }]}
              />
            </View>

            <View style={styles.editField}>
              <Text style={[styles.editLabel, { color: palette.textMuted }]}>WEBSITE</Text>
              <TextInput
                value={editWebsite}
                onChangeText={setEditWebsite}
                placeholder="https://yourwebsite.com"
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.editInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderColor: palette.borderInteractive, color: palette.text }]}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={showSettings} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowSettings(false)}>
        <View style={[styles.modalContainer, { backgroundColor: palette.background, paddingTop: insets.top + spacing.xs, paddingBottom: insets.bottom + spacing.md }]}>
          <View style={[styles.modalHeader, { borderBottomColor: palette.border }]}>
            <View style={{ width: 40 }} />
            <Text style={[styles.modalTitle, { color: palette.text }]}>Settings</Text>
            <Pressable onPress={() => setShowSettings(false)} hitSlop={8}>
              <Ionicons name="close" size={24} color={palette.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.settingsContent}>
            <Section title="Marketplace & Orders" palette={palette}>
              <Row
                icon="bag-handle-outline"
                label="My Orders History"
                onPress={() => {
                  setShowSettings(false);
                  router.push('/orders');
                }}
                palette={palette}
              />
              <Row
                icon="people-outline"
                label="Brand Collaborations"
                onPress={() => {
                  setShowSettings(false);
                  router.push('/collaborations');
                }}
                palette={palette}
                last
              />
            </Section>

            <Section title="Appearance" palette={palette}>
              <View style={{ padding: spacing.md }}>
                <NativeSegmentedPicker<'dark' | 'light'>
                  options={[
                    { label: 'Obsidian Dark', value: 'dark' },
                    { label: 'Alabaster Light', value: 'light' },
                  ]}
                  selectedValue={theme === 'light' ? 'light' : 'dark'}
                  onValueChange={(next) => setTheme(next)}
                />
              </View>
            </Section>

            <Section title="Safety & Privacy" palette={palette}>
              <Row
                icon="ban-outline"
                label="Blocked accounts"
                onPress={() => {
                  setShowSettings(false);
                  router.push('/blocked');
                }}
                palette={palette}
                last
              />
            </Section>

            <Section title="Legal" palette={palette}>
              <Row
                icon="document-text-outline"
                label="Terms & Conditions"
                onPress={() => {
                  setShowSettings(false);
                  router.push('/legal?doc=terms');
                }}
                palette={palette}
              />
              <Row
                icon="lock-closed-outline"
                label="Privacy Policy"
                onPress={() => {
                  setShowSettings(false);
                  router.push('/legal?doc=privacy');
                }}
                palette={palette}
                last
              />
            </Section>

            <View style={styles.settingsActions}>
              <Button
                label="Sign out"
                variant="secondary"
                onPress={async () => {
                  setShowSettings(false);
                  await signOut();
                }}
                fullWidth
              />
              <Button
                label="Delete account"
                variant="danger"
                loading={deleting}
                onPress={confirmDelete}
                fullWidth
              />
            </View>

            <Text style={[styles.footnote, { color: palette.textMuted }]}>
              Rava 1.0.0 · Policies updated {LEGAL_LAST_UPDATED}
            </Text>
          </ScrollView>
        </View>
      </Modal>

      {/* Followers list modal */}
      <UserListModal
        visible={showFollowers}
        title="Followers"
        users={followersList}
        loading={loadingUsers}
        currentUserId={user.id}
        followingMap={followingMap}
        followPendingIds={followPendingIds}
        guestMode={guestMode}
        onClose={() => setShowFollowers(false)}
        onUserPress={(id) => router.push(`/profile/${id}`)}
        onToggleFollow={toggleFollow}
      />

      {/* Following list modal */}
      <UserListModal
        visible={showFollowing}
        title="Following"
        users={followingList}
        loading={loadingUsers}
        currentUserId={user.id}
        followingMap={followingMap}
        followPendingIds={followPendingIds}
        guestMode={guestMode}
        onClose={() => setShowFollowing(false)}
        onUserPress={(id) => router.push(`/profile/${id}`)}
        onToggleFollow={toggleFollow}
      />
    </View>
  );
}

function Section({
  title,
  children,
  palette,
}: {
  title: string;
  children: React.ReactNode;
  palette: { textMuted: string; card: string };
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: palette.textMuted }]}>{title.toUpperCase()}</Text>
      <View style={[styles.group, { backgroundColor: palette.card }]}>{children}</View>
    </View>
  );
}

function Row({
  icon,
  label,
  onPress,
  palette,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  palette: { text: string; border: string };
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
        pressed && { opacity: 0.55 },
      ]}
    >
      <Ionicons name={icon} size={21} color={palette.text} />
      <Text style={[styles.rowLabel, { color: palette.text }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={17} color={palette.text} style={styles.chevron} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerTitles: { flex: 1 },
  headerHandle: { fontSize: 16, fontWeight: '700' },
  headerName: { fontSize: 11 },
  headerRightActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  profileHeader: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  avatarStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatarWrap: { position: 'relative' },
  avatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
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
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  actionBtn: { flex: 1, minHeight: 40 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubTabsRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.sm,
  },
  hubTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  hubTabActive: {},
  hubTabText: { fontSize: 12, fontWeight: '700' },
  hubContainer: { paddingVertical: spacing.md, gap: spacing.lg },
  earningsHero: {
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    gap: 4,
  },
  earningsLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  earningsAmount: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  pendingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  pendingText: { fontSize: 13 },
  withdrawPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  withdrawPillText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  breakdownGrid: { flexDirection: 'row', gap: spacing.sm },
  breakdownItem: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 2,
  },
  breakdownItemTitle: { fontSize: 10, fontWeight: '700' },
  breakdownItemAmt: { fontSize: 15, fontWeight: '800' },
  breakdownItemSub: { fontSize: 10 },
  historySection: { gap: spacing.sm },
  sectionHeading: { fontSize: 15, fontWeight: '700' },
  emptyNotice: { fontSize: 13, fontStyle: 'italic' },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  historyAmt: { fontSize: 14, fontWeight: '700' },
  historyDate: { fontSize: 11 },
  payoutStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  payoutStatusText: { fontSize: 11, fontWeight: '700' },
  brandHubBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandHubTitle: { fontSize: 16, fontWeight: '700' },
  brandHubSub: { fontSize: 12 },
  addProdBtn: { minHeight: 36 },
  brandSection: { gap: spacing.sm },
  emptyCard: { padding: spacing.xl, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', gap: spacing.xs },
  emptyCardText: { fontSize: 13, textAlign: 'center' },
  brandProductRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
  },
  brandProdThumb: { width: 44, height: 44, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: '#1a1a22', alignItems: 'center', justifyContent: 'center' },
  brandProdDetails: { flex: 1, gap: 2 },
  brandProdName: { fontSize: 13, fontWeight: '700' },
  brandProdMeta: { fontSize: 11 },
  brandOrderCard: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, gap: spacing.sm },
  brandOrderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandOrderId: { fontSize: 13, fontWeight: '700' },
  brandOrderBuyer: { fontSize: 12 },
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
    backgroundColor: '#1a1a22',
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
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { ...typography.heading, fontSize: 16, fontWeight: '700' },
  cancelText: { fontSize: 15 },
  doneText: { fontSize: 15, fontWeight: '700' },
  formScroll: { padding: spacing.lg, gap: spacing.md },
  prodImgPicker: {
    width: '100%',
    height: 160,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prodImgPrompt: { alignItems: 'center', gap: 6 },
  prodImgText: { fontSize: 13, fontWeight: '700' },
  editField: { gap: spacing.xs },
  editLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, paddingLeft: 2 },
  editInput: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    fontSize: 15,
  },
  inputRow: { flexDirection: 'row', gap: spacing.sm },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xs },
  balanceCard: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, gap: 4 },
  balanceCardLabel: { fontSize: 11, fontWeight: '700' },
  balanceCardVal: { fontSize: 24, fontWeight: '800' },
  chipsRow: { flexDirection: 'row', gap: spacing.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1 },
  chipText: { fontSize: 12 },
  editAvatarSection: { alignItems: 'center', justifyContent: 'center' },
  changePhotoText: { fontSize: 13, fontWeight: '600' },
  settingsContent: { padding: spacing.lg, gap: spacing.xl },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, paddingLeft: spacing.md },
  group: { borderRadius: radius.md, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  rowLabel: { ...typography.body, flex: 1, fontSize: 15 },
  chevron: { opacity: 0.35 },
  settingsActions: { gap: spacing.md, marginTop: spacing.sm },
  footnote: { ...typography.caption, fontSize: 11, textAlign: 'center' },
  guestContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  guestIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  guestHeading: { ...typography.heading, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  guestSubtitle: { ...typography.body, fontSize: 14, textAlign: 'center' },
  signInBtn: { marginTop: spacing.md, minHeight: 50 },
});
