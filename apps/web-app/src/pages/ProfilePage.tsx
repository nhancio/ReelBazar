import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Avatar, LoadingSpinner } from '@reelbazaar/ui';
import type { User, Reel } from '@reelbazaar/config';
import { demoReels, demoUsers } from '../demoData';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  updateDoc,
  setDoc,
  deleteDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';

const THEME_KEY = 'reelbazaar-theme-preference';

const getProfileHandle = (user: User | null | undefined) => user?.username || user?.name?.replace(/\s+/g, '').toLowerCase() || 'user';
const getProfileName = (user: User | null | undefined) => user?.username || user?.name || 'User';

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser, signOut, guestMode } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [reels, setReels] = useState<Reel[]>([]);
  const [savedReels, setSavedReels] = useState<Reel[]>([]);
  const [activeTab, setActiveTab] = useState<'my' | 'saved'>('my');
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [themePreference, setThemePreference] = useState<'dark' | 'light'>(() => {
    const stored = localStorage.getItem(THEME_KEY);
    return stored === 'light' ? 'light' : 'dark';
  });

  const [followersList, setFollowersList] = useState<User[]>([]);
  const [followingList, setFollowingList] = useState<User[]>([]);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [currentUserFollowingMap, setCurrentUserFollowingMap] = useState<Record<string, boolean>>({});
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followPendingIds, setFollowPendingIds] = useState<Set<string>>(new Set());

  const isOwnProfile = !userId || userId === currentUser?.id;
  const displayUser = isOwnProfile ? currentUser : profileUser;

  useEffect(() => {
    localStorage.setItem(THEME_KEY, themePreference);
  }, [themePreference]);

  const loadUserList = useCallback(async (userIds: string[]) => {
    const users = await Promise.all(
      userIds.map(async (uid) => {
        const userDoc = await getDoc(doc(db, 'users', uid));
        return userDoc.exists() ? ({ id: userDoc.id, ...userDoc.data() } as User) : null;
      })
    );

    return users.filter(Boolean) as User[];
  }, []);

  const loadFollowers = useCallback(async () => {
    if (guestMode || !displayUser) return;
    setLoadingUsers(true);
    setShowFollowers(true);

    try {
      const snap = await getDocs(query(collection(db, 'follows'), where('followingId', '==', displayUser.id)));
      const users = await loadUserList(snap.docs.map((item) => item.data().followerId));
      setFollowersList(users);
    } catch (err) {
      console.error('Failed to load followers:', err);
    } finally {
      setLoadingUsers(false);
    }
  }, [displayUser, guestMode, loadUserList]);

  const loadFollowing = useCallback(async () => {
    if (guestMode || !displayUser) return;
    setLoadingUsers(true);
    setShowFollowing(true);

    try {
      const snap = await getDocs(query(collection(db, 'follows'), where('followerId', '==', displayUser.id)));
      const users = await loadUserList(snap.docs.map((item) => item.data().followingId));
      setFollowingList(users);
    } catch (err) {
      console.error('Failed to load following:', err);
    } finally {
      setLoadingUsers(false);
    }
  }, [displayUser, guestMode, loadUserList]);

  useEffect(() => {
    const load = async () => {
      if (!currentUser && !guestMode) return;

      setLoading(true);
      try {
        if (guestMode) {
          const fallbackUser =
            userId === demoUsers.brand.id
              ? demoUsers.brand
              : userId === demoUsers.brandAlt.id
                ? demoUsers.brandAlt
                : currentUser;

          setProfileUser(!isOwnProfile && fallbackUser ? fallbackUser : null);
          const targetId = isOwnProfile ? currentUser?.id : fallbackUser?.id;
          setReels(demoReels.filter((reel) => reel.creatorId === targetId));
          setSavedReels(isOwnProfile ? demoReels.slice(0, 2) : []);
          setFollowersCount(fallbackUser?.followersCount || 0);
          setFollowingCount(fallbackUser?.followingCount || 0);
          return;
        }

        const targetId = isOwnProfile ? currentUser!.id : userId!;

        const [
          targetUserDoc,
          userReelsSnapshot,
          followersSnapshot,
          followingSnapshot,
          currentFollowingSnapshot,
        ] = await Promise.all([
          isOwnProfile ? Promise.resolve(null) : getDoc(doc(db, 'users', targetId)),
          getDocs(query(collection(db, 'reels'), where('creatorId', '==', targetId), orderBy('createdAt', 'desc'))),
          getDocs(query(collection(db, 'follows'), where('followingId', '==', targetId))),
          getDocs(query(collection(db, 'follows'), where('followerId', '==', targetId))),
          getDocs(query(collection(db, 'follows'), where('followerId', '==', currentUser!.id))),
        ]);

        if (!isOwnProfile && targetUserDoc?.exists()) {
          setProfileUser({ id: targetUserDoc.id, ...targetUserDoc.data() } as User);
        } else if (!isOwnProfile) {
          setProfileUser(null);
        }

        setReels(userReelsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Reel)));
        setFollowersCount(followersSnapshot.size);
        setFollowingCount(followingSnapshot.size);

        const followingMap: Record<string, boolean> = {};
        currentFollowingSnapshot.docs.forEach((item) => {
          followingMap[item.data().followingId] = true;
        });
        setCurrentUserFollowingMap(followingMap);

        if (isOwnProfile) {
          const savedSnapshot = await getDocs(query(collection(db, 'reelSaves'), where('userId', '==', targetId)));
          const savedIds = savedSnapshot.docs.map((item) => item.data().reelId as string);

          if (savedIds.length === 0) {
            setSavedReels([]);
          } else {
            const savedDocs = await Promise.all(savedIds.map((id) => getDoc(doc(db, 'reels', id))));
            const loadedSavedReels = savedDocs
              .filter((item) => item.exists())
              .map((item) => ({ id: item.id, ...item.data() } as Reel));
            setSavedReels(loadedSavedReels);
          }
        } else {
          setSavedReels([]);
        }
      } catch (err) {
        console.error('Error loading profile data:', err);
        const targetId = isOwnProfile ? currentUser?.id : userId;
        setReels(demoReels.filter((reel) => reel.creatorId === targetId));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [currentUser, guestMode, isOwnProfile, userId]);

  const toggleFollow = async (targetUserId: string) => {
    if (guestMode || !currentUser) return;
    if (followPendingIds.has(targetUserId)) return;

    const isCurrentlyFollowing = Boolean(currentUserFollowingMap[targetUserId]);
    setFollowPendingIds((prev) => new Set(prev).add(targetUserId));
    setCurrentUserFollowingMap((prev) => ({
      ...prev,
      [targetUserId]: !isCurrentlyFollowing
    }));

    if (displayUser?.id === targetUserId) {
      setFollowersCount((prev) => Math.max(0, prev + (isCurrentlyFollowing ? -1 : 1)));
      setFollowersList((prev) => {
        if (isCurrentlyFollowing) {
          return prev.filter((user) => user.id !== currentUser.id);
        }
        return currentUser ? [currentUser, ...prev.filter((user) => user.id !== currentUser.id)] : prev;
      });
    }

    try {
      const followRef = doc(db, 'follows', `${currentUser.id}_${targetUserId}`);
      if (isCurrentlyFollowing) {
        await deleteDoc(followRef);
      } else {
        await setDoc(followRef, {
          followerId: currentUser.id,
          followingId: targetUserId,
          createdAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('Failed to toggle follow:', err);
      setCurrentUserFollowingMap((prev) => ({
        ...prev,
        [targetUserId]: isCurrentlyFollowing
      }));
      if (displayUser?.id === targetUserId) {
        setFollowersCount((prev) => Math.max(0, prev + (isCurrentlyFollowing ? 1 : -1)));
      }
    } finally {
      setFollowPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(targetUserId);
        return next;
      });
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !isOwnProfile || guestMode || !currentUser) return;

    setUploadingAvatar(true);
    try {
      const storageRef = ref(storage, `avatars/${currentUser.id}`);
      await uploadBytes(storageRef, file);
      const avatarUrl = await getDownloadURL(storageRef);

      await updateDoc(doc(db, 'users', currentUser.id), {
        avatarUrl,
        updatedAt: new Date().toISOString()
      });

      window.location.reload();
    } catch (err) {
      console.error('Failed to update avatar', err);
      alert('Failed to update profile picture.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const renderUserListModal = (title: string, list: User[], isVisible: boolean, onClose: () => void) => {
    if (!isVisible) return null;

    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white animate-in slide-in-from-bottom-2">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <div className="w-8" />
          <h2 className="text-base font-bold">{title}</h2>
          <button onClick={onClose} className="p-1 w-8 flex justify-end">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingUsers ? (
            <div className="pt-20"><LoadingSpinner /></div>
          ) : list.length === 0 ? (
            <div className="pt-20 text-center text-white/50 text-sm">No users found</div>
          ) : (
            <div className="flex flex-col">
              {list.map((user) => {
                const isMe = user.id === currentUser?.id;
                const isFollowingUser = Boolean(currentUserFollowingMap[user.id]);

                return (
                  <div key={user.id} className="flex items-center justify-between px-4 py-3 hover:bg-white/5 active:bg-white/10 transition-colors">
                    <button
                      className="flex items-center flex-1 min-w-0 text-left"
                      onClick={() => {
                        onClose();
                        navigate(`/profile/${user.id}`);
                      }}
                    >
                      <Avatar name={getProfileName(user)} src={user.avatarUrl} size="md" />
                      <div className="ml-3 flex flex-col justify-center overflow-hidden pr-2">
                        <span className="font-semibold text-[14px] truncate">{getProfileHandle(user)}</span>
                        <span className="text-[13px] text-white/50 truncate">{user.name}</span>
                      </div>
                    </button>

                    {!isMe && !guestMode && (
                      <button
                        onClick={() => toggleFollow(user.id)}
                        disabled={followPendingIds.has(user.id)}
                        className={`px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-colors shrink-0 disabled:opacity-60 ${
                          isFollowingUser
                            ? 'bg-[#333] text-white hover:bg-[#444]'
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                        }`}
                      >
                        {isFollowingUser ? 'Following' : 'Follow'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading && !displayUser) {
    return <div className="min-h-screen bg-black pt-20"><LoadingSpinner /></div>;
  }

  if (!displayUser) {
    return (
      <div className="min-h-[100dvh] bg-black flex flex-col items-center justify-center text-white p-6">
        <p className="text-lg font-semibold">Profile not found</p>
      </div>
    );
  }

  const displayReels = activeTab === 'my' ? reels : savedReels;
  const postsCount = reels.length;
  const profileIsFollowed = displayUser.id ? Boolean(currentUserFollowingMap[displayUser.id]) : false;
  const profilePending = displayUser.id ? followPendingIds.has(displayUser.id) : false;

  return (
    <div className={`min-h-[100dvh] pb-24 ${themePreference === 'light' ? 'bg-[#f6f7fb] text-[#111827]' : 'bg-black text-white'}`}>
      <div className={`flex items-center justify-between px-4 py-3 border-b ${themePreference === 'light' ? 'border-black/10' : 'border-white/10'}`}>
        <div className="flex flex-col">
          <h1 className="text-xl font-bold">{getProfileHandle(displayUser)}</h1>
          <p className={`text-xs ${themePreference === 'light' ? 'text-black/50' : 'text-white/50'}`}>{displayUser.name}</p>
        </div>
        {isOwnProfile && (
          <button onClick={() => setShowSettings(true)} className="p-2 -mr-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
      </div>

      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <div className="relative">
            <Avatar name={getProfileName(displayUser)} src={displayUser.avatarUrl} size="lg" />
            {isOwnProfile && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-1.5 rounded-full bg-white shadow-md border border-slate-200 text-black hover:text-blue-500 transition-colors z-10"
                disabled={uploadingAvatar}
              >
                {uploadingAvatar ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                )}
              </button>
            )}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleAvatarUpload}
            />
          </div>

          <div className="flex flex-1 justify-around ml-6 mr-2">
            <div className="text-center">
              <p className="text-lg font-bold">{postsCount}</p>
              <p className={`text-[13px] ${themePreference === 'light' ? 'text-black/70' : 'text-white/80'}`}>posts</p>
            </div>
            <button className="text-center active:opacity-50" onClick={loadFollowers}>
              <p className="text-lg font-bold">{followersCount}</p>
              <p className={`text-[13px] ${themePreference === 'light' ? 'text-black/70' : 'text-white/80'}`}>followers</p>
            </button>
            <button className="text-center active:opacity-50" onClick={loadFollowing}>
              <p className="text-lg font-bold">{followingCount}</p>
              <p className={`text-[13px] ${themePreference === 'light' ? 'text-black/70' : 'text-white/80'}`}>following</p>
            </button>
          </div>
        </div>

        <div className="mt-4">
          <p className="font-bold text-[15px]">@{getProfileHandle(displayUser)}</p>
          <p className={`text-[14px] mt-1 ${themePreference === 'light' ? 'text-black/70' : 'text-white/80'}`}>{displayUser.name}</p>
          {displayUser.brandName && (
            <p className={`text-[14px] mt-1 ${themePreference === 'light' ? 'text-black/70' : 'text-white/90'}`}>
              Building <span className="font-medium">{displayUser.brandName}</span>
            </p>
          )}
          {displayUser.country && (
            <p className={`text-[14px] mt-1 ${themePreference === 'light' ? 'text-black/70' : 'text-white/90'}`}>{displayUser.country}</p>
          )}
          {displayUser.interests && displayUser.interests.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {displayUser.interests.map((interest) => (
                <span
                  key={interest}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${themePreference === 'light' ? 'bg-black/5 text-black/70' : 'bg-white/10 text-white/80'}`}
                >
                  {interest}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          {isOwnProfile ? (
            <>
              <button
                onClick={() => navigate('/create')}
                className={`flex-1 font-semibold rounded-lg py-2 text-[14px] transition-colors ${themePreference === 'light' ? 'bg-black text-white hover:bg-black/90' : 'bg-white/10 hover:bg-white/20 text-white'}`}
              >
                Create reel
              </button>
              <button
                onClick={() => window.alert('Share profile coming soon!')}
                className={`flex-1 font-semibold rounded-lg py-2 text-[14px] transition-colors ${themePreference === 'light' ? 'bg-black/5 hover:bg-black/10 text-black' : 'bg-white/10 hover:bg-white/20 text-white'}`}
              >
                Share profile
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => toggleFollow(displayUser.id)}
                disabled={profilePending}
                className={`flex-1 font-semibold rounded-lg py-2 text-[14px] transition-colors disabled:opacity-60 ${
                  profileIsFollowed
                    ? themePreference === 'light'
                      ? 'bg-black/5 text-black hover:bg-black/10'
                      : 'bg-white/10 hover:bg-white/20 text-white'
                    : 'bg-[#1877f2] hover:bg-[#1668d8] text-white'
                }`}
              >
                {profileIsFollowed ? 'Following' : 'Follow'}
              </button>
              <button
                onClick={() => navigate('/')}
                className={`flex-1 font-semibold rounded-lg py-2 text-[14px] transition-colors ${themePreference === 'light' ? 'bg-black/5 hover:bg-black/10 text-black' : 'bg-white/10 hover:bg-white/20 text-white'}`}
              >
                View reels
              </button>
            </>
          )}
        </div>
      </div>

      <div className={`flex mt-2 border-t ${themePreference === 'light' ? 'border-black/10' : 'border-white/20'}`}>
        <button
          onClick={() => setActiveTab('my')}
          className={`flex-1 flex justify-center items-center py-3 relative ${activeTab === 'my' ? '' : themePreference === 'light' ? 'text-black/40' : 'text-white/50'}`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
          {activeTab === 'my' && <div className={`absolute top-0 left-0 right-0 h-[2px] ${themePreference === 'light' ? 'bg-black' : 'bg-white'}`} />}
        </button>
        {isOwnProfile && (
          <button
            onClick={() => setActiveTab('saved')}
            className={`flex-1 flex justify-center items-center py-3 relative ${activeTab === 'saved' ? '' : themePreference === 'light' ? 'text-black/40' : 'text-white/50'}`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            {activeTab === 'saved' && <div className={`absolute top-0 left-0 right-0 h-[2px] ${themePreference === 'light' ? 'bg-black' : 'bg-white'}`} />}
          </button>
        )}
      </div>

      {displayReels.length === 0 ? (
        <div className={`py-12 text-center ${themePreference === 'light' ? 'text-black/40' : 'text-white/50'}`}>
          <p className="font-medium">{activeTab === 'saved' ? 'No saved reels yet' : 'No reels found'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-0.5">
          {displayReels.map((reel) => (
            <button
              key={reel.id}
              className="relative aspect-[3/4] bg-white/10 cursor-pointer overflow-hidden"
              onClick={() => navigate(`/reel/${reel.id}`)}
            >
              <video
                src={reel.videoUrl}
                className="w-full h-full object-cover"
                muted
                preload="metadata"
              />
              <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/30 px-1.5 py-0.5 rounded backdrop-blur-sm">
                <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                </svg>
                <span className="text-[11px] font-bold text-white">{reel.viewsCount || 0}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
          <div className="bg-[#1a1a1a] w-full rounded-t-3xl p-6 flex flex-col gap-4 animate-in slide-in-from-bottom-10" onClick={(event) => event.stopPropagation()}>
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-2" />
            <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-4">
              <div>
                <p className="text-sm font-semibold text-white">Appearance</p>
                <p className="text-xs text-white/50">Switch between dark and light profile styling</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setThemePreference('dark')}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${themePreference === 'dark' ? 'bg-white text-black' : 'bg-white/10 text-white/70'}`}
                >
                  Dark
                </button>
                <button
                  onClick={() => setThemePreference('light')}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${themePreference === 'light' ? 'bg-white text-black' : 'bg-white/10 text-white/70'}`}
                >
                  Light
                </button>
              </div>
            </div>
            <button
              className="w-full text-left py-3 text-red-500 text-lg font-bold flex items-center gap-3"
              onClick={() => {
                setShowSettings(false);
                signOut();
              }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      )}

      {renderUserListModal('Followers', followersList, showFollowers, () => setShowFollowers(false))}
      {renderUserListModal('Following', followingList, showFollowing, () => setShowFollowing(false))}
    </div>
  );
}
