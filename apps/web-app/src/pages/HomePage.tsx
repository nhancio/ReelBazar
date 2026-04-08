import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { InstaPostCard, AuthModal } from '@reelbazaar/ui';
import { LoadingSpinner } from '@reelbazaar/ui';
import { reelsApi, usersApi } from '@reelbazaar/api';
import type { Reel, User } from '@reelbazaar/config';
import { useAuth } from '../context/AuthContext';
import { signInWithGoogle } from '../auth/googleSignIn';
import { useTheme } from '../context/ThemeContext';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs, 
  startAfter, 
  doc, 
  getDoc,
  where,
  updateDoc,
  increment,
  setDoc,
  deleteDoc
} from 'firebase/firestore';
import { auth, db } from '../firebase';

// Global cache to prevent lag when navigating between tabs
let cachedReels: Reel[] = [];
let cachedHasMore = true;
let cachedLastDoc: any = null;
let cachedApiCursor: string | undefined = undefined;

export default function HomePage() {
  const { guestMode, exitGuestMode, clearAuthError, refreshUser, user: currentUser } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [reels, setReels] = useState<Reel[]>(cachedReels);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [likedReels, setLikedReels] = useState<Set<string>>(new Set());
  const [savedReels, setSavedReels] = useState<Set<string>>(new Set());
  const [likePending, setLikePending] = useState<Set<string>>(new Set());
  const [savePending, setSavePending] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(cachedReels.length === 0);
  const [hasMore, setHasMore] = useState(cachedHasMore);
  const [error, setError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [reelMutedState, setReelMutedState] = useState<Record<string, boolean>>({});

  const loadUserState = useCallback(async () => {
    if (guestMode || !currentUser) {
      setFollowing(new Set());
      setLikedReels(new Set());
      setSavedReels(new Set());
      return;
    }

    try {
      const [{ followingIds }, likesSnapshot, savesSnapshot] = await Promise.all([
        usersApi.getFollowing().catch(() => ({ followingIds: [] })),
        getDocs(query(collection(db, 'reelLikes'), where('userId', '==', currentUser.id))),
        getDocs(query(collection(db, 'reelSaves'), where('userId', '==', currentUser.id))),
      ]);

      setFollowing(new Set(followingIds));
      setLikedReels(new Set(likesSnapshot.docs.map((snapshot) => snapshot.data().reelId as string)));
      setSavedReels(new Set(savesSnapshot.docs.map((snapshot) => snapshot.data().reelId as string)));
    } catch (err) {
      console.error('Failed to load user reel state:', err);
    }
  }, [guestMode, currentUser]);

  useEffect(() => {
    loadUserState();
  }, [loadUserState]);

  const loadReels = useCallback(async (reset = false) => {
    const loadViaApi = async () => {
      const response = await reelsApi.getFeed(undefined, reset ? undefined : cachedApiCursor);
      const newReels = response.reels || [];
      setReels((prev) => {
        const next = reset ? newReels : [...prev, ...newReels.filter((nr) => !prev.some((pr) => pr.id === nr.id))];
        cachedReels = next;
        return next;
      });
      const more = Boolean(response.hasMore);
      setHasMore(more);
      cachedHasMore = more;
      cachedApiCursor = response.nextCursor;
      cachedLastDoc = null;
    };

    try {
      if (reset) cachedApiCursor = undefined;
      const reelsCol = collection(db, 'reels');
      let q = query(reelsCol, orderBy('createdAt', 'desc'), limit(10));

      if (!reset && cachedLastDoc) {
        q = query(reelsCol, orderBy('createdAt', 'desc'), startAfter(cachedLastDoc), limit(10));
      }

      const snapshot = await getDocs(q);
      
      if (snapshot.empty && reset) {
        setReels([]);
        cachedReels = [];
        setHasMore(false);
        cachedHasMore = false;
        setLoading(false);
        return;
      }

      const newReels: Reel[] = [];
      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        let creator = null;
        if (data.creatorId) {
          const userDoc = await getDoc(doc(db, 'users', data.creatorId));
          if (userDoc.exists()) {
            creator = { id: userDoc.id, ...userDoc.data() };
          }
        }
        
        newReels.push({
          id: docSnapshot.id,
          ...data,
          creator,
        } as Reel);
      }

      setReels((prev) => {
        const next = reset ? newReels : [...prev, ...newReels.filter(nr => !prev.some(pr => pr.id === nr.id))];
        cachedReels = next;
        return next;
      });
      
      const more = snapshot.docs.length === 10;
      setHasMore(more);
      cachedHasMore = more;
      cachedLastDoc = snapshot.docs[snapshot.docs.length - 1];
      cachedApiCursor = undefined;
    } catch (err) {
      console.error('Failed to load reels from Firestore, trying API feed:', err);
      try {
        await loadViaApi();
      } catch (apiErr) {
        console.error('Failed to load reels from API fallback:', apiErr);
        if (cachedReels.length === 0) {
          setReels([]);
          cachedReels = [];
          setHasMore(false);
          cachedHasMore = false;
        }
        setError('Failed to load reels.');
        setTimeout(() => setError(null), 3000);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (cachedReels.length === 0) {
      setLoading(true);
      loadReels(true);
    }
  }, [loadReels]);

  useEffect(() => {
    cachedReels = reels;
  }, [reels]);

  const handleRequireAuth = () => {
    setShowAuthModal(true);
  };

  const handleSignIn = async () => {
    clearAuthError();
    exitGuestMode();
    try {
      await signInWithGoogle(auth);
      await refreshUser();
      setShowAuthModal(false);
    } catch (err: any) {
      console.error('Google sign-in failed:', err);
    }
  };

  const handleLike = async (reelId: string) => {
    if (guestMode || !currentUser) return handleRequireAuth();
    if (likePending.has(reelId)) return;

    const wasLiked = likedReels.has(reelId);
    setLikePending((prev) => new Set(prev).add(reelId));
    setLikedReels((prev) => {
      const next = new Set(prev);
      if (wasLiked) next.delete(reelId);
      else next.add(reelId);
      return next;
    });
    setReels((prev) =>
      prev.map((reel) =>
        reel.id === reelId
          ? { ...reel, likesCount: Math.max(0, (reel.likesCount || 0) + (wasLiked ? -1 : 1)) }
          : reel
      )
    );

    try {
      const likeId = `${currentUser.id}_${reelId}`;
      const likeRef = doc(db, 'reelLikes', likeId);
      if (wasLiked) {
        await deleteDoc(likeRef);
        await updateDoc(doc(db, 'reels', reelId), {
          likesCount: increment(-1)
        });
      } else {
        await setDoc(likeRef, {
          userId: currentUser.id,
          reelId,
          createdAt: new Date().toISOString()
        });
        await updateDoc(doc(db, 'reels', reelId), {
          likesCount: increment(1)
        });
      }
    } catch (err) {
      console.error('Failed to like reel:', err);
      setLikedReels((prev) => {
        const next = new Set(prev);
        if (wasLiked) next.add(reelId);
        else next.delete(reelId);
        return next;
      });
      setReels((prev) =>
        prev.map((reel) =>
          reel.id === reelId
            ? { ...reel, likesCount: Math.max(0, (reel.likesCount || 0) + (wasLiked ? 1 : -1)) }
            : reel
        )
      );
    } finally {
      setLikePending((prev) => {
        const next = new Set(prev);
        next.delete(reelId);
        return next;
      });
    }
  };

  const handleSave = async (reelId: string) => {
    if (guestMode || !currentUser) return handleRequireAuth();
    if (savePending.has(reelId)) return;

    const wasSaved = savedReels.has(reelId);
    setSavePending((prev) => new Set(prev).add(reelId));
    setSavedReels((prev) => {
      const next = new Set(prev);
      if (wasSaved) next.delete(reelId);
      else next.add(reelId);
      return next;
    });
    setReels((prev) =>
      prev.map((reel) =>
        reel.id === reelId
          ? { ...reel, savesCount: Math.max(0, (reel.savesCount || 0) + (wasSaved ? -1 : 1)) }
          : reel
      )
    );

    try {
      const saveId = `${currentUser.id}_${reelId}`;
      const saveRef = doc(db, 'reelSaves', saveId);
      if (wasSaved) {
        await deleteDoc(saveRef);
        await updateDoc(doc(db, 'reels', reelId), {
          savesCount: increment(-1)
        });
      } else {
        await setDoc(saveRef, {
          userId: currentUser.id,
          reelId,
          createdAt: new Date().toISOString()
        });
        await updateDoc(doc(db, 'reels', reelId), {
          savesCount: increment(1)
        });
      }
    } catch (err) {
      console.error('Failed to save reel:', err);
      setSavedReels((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.add(reelId);
        else next.delete(reelId);
        return next;
      });
      setReels((prev) =>
        prev.map((reel) =>
          reel.id === reelId
            ? { ...reel, savesCount: Math.max(0, (reel.savesCount || 0) + (wasSaved ? 1 : -1)) }
            : reel
        )
      );
    } finally {
      setSavePending((prev) => {
        const next = new Set(prev);
        next.delete(reelId);
        return next;
      });
    }
  };

  const handleShare = async (reelId: string) => {
    const url = `${window.location.origin}/reel/${reelId}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Check out this reel on ReelBazaar!',
          url: url,
        });
      } catch (err) {
        console.error('Failed to share:', err);
      }
    } else {
      navigator.clipboard.writeText(url);
      window.alert('Link copied to clipboard!');
    }
  };

  const profileUsers = useMemo(() => {
    const out: User[] = [];
    const seen = new Set<string>();
    for (const reel of reels) {
      const c = reel.creator;
      const cid = reel.creatorId;
      if (c && cid && !seen.has(cid)) {
        seen.add(cid);
        out.push(c);
        if (out.length >= 8) break;
      }
    }
    return out;
  }, [reels]);

  const setReelMuted = useCallback((reelId: string, muted: boolean) => {
    setReelMutedState((prev) => ({ ...prev, [reelId]: muted }));
  }, []);

  return (
    <div className={`relative h-full w-full overflow-y-auto hide-scrollbar ${theme === 'light' ? 'bg-[#f6f7fb] text-black' : 'bg-black text-white'}`}>
      {/* Instagram Header */}
      <div className={`sticky top-0 z-40 flex items-center justify-between px-4 py-2.5 border-b ${theme === 'light' ? 'bg-white border-black/10' : 'bg-black border-white/10'}`}>
        <h1 className={`text-2xl font-bold tracking-tight ${theme === 'light' ? 'text-black' : 'text-white'}`} style={{ fontFamily: 'cursive' }}>ReelBazaar</h1>
        <button
          type="button"
          aria-label="Settings"
          className={`p-2 -mr-2 rounded-lg transition-colors ${theme === 'light' ? 'hover:bg-black/10 active:bg-black/5' : 'hover:bg-white/10 active:bg-white/5'}`}
          onClick={() => navigate('/profile', { state: { openSettings: true } })}
        >
            <svg className={`w-6 h-6 ${theme === 'light' ? 'text-black' : 'text-white'}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Profiles Bar */}
      <div className={`flex overflow-x-auto py-2.5 px-2 border-b hide-scrollbar shrink-0 ${theme === 'light' ? 'border-black/10' : 'border-white/10'}`}>
        <div className="flex items-center gap-3">
          {profileUsers.map((user) => (
            <div key={user.id} className="flex flex-col items-center gap-1 w-[72px] shrink-0 cursor-pointer" onClick={() => navigate(`/profile/${user.id}`)}>
              <div className={`h-16 w-16 rounded-full p-[2.5px] ${theme === 'light' ? 'bg-gradient-to-tr from-slate-200 to-slate-400' : 'bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500'}`}>
                <div className={`h-full w-full rounded-full border-2 overflow-hidden ${theme === 'light' ? 'border-white bg-white' : 'border-black bg-[#1a1a1a]'}`}>
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className={`flex h-full w-full items-center justify-center font-bold text-lg ${theme === 'light' ? 'text-black' : 'text-white'}`}>
                      {(user.name || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
              <span className={`text-[11px] truncate w-full text-center tracking-tight ${theme === 'light' ? 'text-black/80' : 'text-white/90'}`}>{(user.name || 'User').split(' ')[0]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div className="w-full pb-10">
        {loading && reels.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner />
          </div>
        ) : (
          reels.map((reel) => (
            <InstaPostCard
              key={reel.id}
              reel={reel}
              muted={reelMutedState[reel.id] ?? false}
              onMutedChange={(muted) => setReelMuted(reel.id, muted)}
              liked={likedReels.has(reel.id)}
              saved={savedReels.has(reel.id)}
              likeDisabled={likePending.has(reel.id)}
              saveDisabled={savePending.has(reel.id)}
              guestMode={guestMode}
              onRequireAuth={handleRequireAuth}
              onLike={() => handleLike(reel.id)}
              onSave={() => handleSave(reel.id)}
              onShare={() => handleShare(reel.id)}
              onProfileClick={() => {
                if (reel.creatorId) navigate(`/profile/${reel.creatorId}`);
              }}
              theme={theme}
            />
          ))
        )}
        
        {hasMore && !loading && (
          <div className="flex justify-center py-6">
            <button onClick={() => loadReels()} className="px-4 py-2 bg-white/10 rounded-full text-sm font-semibold">
              Load More
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 rounded-full bg-red-600/90 px-5 py-2 text-sm text-white shadow-lg backdrop-blur-sm">
          {error}
        </div>
      )}

      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
        onSignIn={handleSignIn} 
      />
    </div>
  );
}
