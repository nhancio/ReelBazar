import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReelCard, AuthModal } from '@reelbazaar/ui';
import { LoadingSpinner } from '@reelbazaar/ui';
import { reelsApi, usersApi } from '@reelbazaar/api';
import type { Reel } from '@reelbazaar/config';
import { useAuth } from '../context/AuthContext';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebase';

export default function HomePage() {
  const { guestMode, exitGuestMode, clearAuthError, refreshUser, user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [reels, setReels] = useState<Reel[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<string | undefined>(undefined);

  const loadFollowing = useCallback(async () => {
    if (guestMode) return;
    try {
      const { followingIds } = await usersApi.getFollowing();
      setFollowing(new Set(followingIds));
    } catch (err) {
      console.error('Failed to load following list:', err);
    }
  }, [guestMode]);

  useEffect(() => {
    loadFollowing();
  }, [loadFollowing]);

  const loadReels = useCallback(async (reset = false) => {
    if (reset) {
      cursorRef.current = undefined;
    } else {
      // Don't show full screen loader when paginating
    }
    
    try {
      const data = await reelsApi.getFeed(undefined, reset ? undefined : cursorRef.current);
      setReels((prev) => {
        // Prevent duplicates
        const newReels = data.reels.filter(nr => !prev.some(pr => pr.id === nr.id));
        return reset ? data.reels : [...prev, ...newReels];
      });
      setHasMore(data.hasMore);
      cursorRef.current = data.nextCursor;
    } catch (err) {
      console.error('Failed to load reels:', err);
      setError('Failed to load reels. Pull down to retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (reels.length === 0) {
      setLoading(true);
      loadReels(true);
    }
  }, [loadReels, reels.length]);

  // Track which reel is active based on scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const height = container.clientHeight;
      const index = Math.round(scrollTop / height);
      setActiveIndex(index);

      // Infinite scroll: load more when near the end
      if (scrollTop + height * 1.5 >= container.scrollHeight && hasMore && !loading) {
        loadReels();
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasMore, loading, loadReels]);

  // Record view when reel becomes active
  useEffect(() => {
    const reel = reels[activeIndex];
    if (reel && !guestMode) {
      reelsApi.view(reel.id).catch(() => {});
    }
  }, [activeIndex, guestMode, reels]);

  const handleRequireAuth = () => {
    setShowAuthModal(true);
  };

  const handleSignIn = async () => {
    clearAuthError();
    exitGuestMode(); // Must exit first so onAuthStateChanged runs
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      await refreshUser();
      setShowAuthModal(false);
    } catch (err: any) {
      console.error('Google sign-in failed:', err);
      // Fallback: If they cancel, they might need to be put back into guest mode?
      // For now, if they cancel, they just aren't logged in. They can refresh or click sign in again.
    }
  };

  const handleLike = async (reelId: string) => {
    if (guestMode) return handleRequireAuth();
    try {
      const { liked } = await reelsApi.like(reelId);
      setReels((prev) =>
        prev.map((r) =>
          r.id === reelId
            ? { ...r, likesCount: Math.max(0, r.likesCount + (liked ? 1 : -1)) }
            : r
        )
      );
    } catch (err) {
      console.error('Failed to like reel:', err);
      setError('Failed to like. Please try again.');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleSave = async (reelId: string) => {
    if (guestMode) return handleRequireAuth();
    try {
      const { saved } = await reelsApi.save(reelId);
      setReels((prev) =>
        prev.map((r) =>
          r.id === reelId
            ? { ...r, savesCount: Math.max(0, r.savesCount + (saved ? 1 : -1)) }
            : r
        )
      );
    } catch (err) {
      console.error('Failed to save reel:', err);
      setError('Failed to save. Please try again.');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleShare = async (reelId: string) => {
    if (guestMode) return handleRequireAuth();
    const url = `https://rb-app.nhancio.com/reel/${reelId}`;
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

  const handleFollow = async (creatorId: string) => {
    if (guestMode) return handleRequireAuth();
    try {
      const { following: isFollowingNow } = await usersApi.toggleFollow(creatorId);
      setFollowing((prev) => {
        const next = new Set(prev);
        if (isFollowingNow) next.add(creatorId);
        else next.delete(creatorId);
        return next;
      });
    } catch (err) {
      console.error('Failed to toggle follow:', err);
      setError('Failed to follow. Please try again.');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleProductClick = (productLink: string) => {
    window.open(productLink, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="relative h-full w-full bg-black">
      {/* Header Overlay */}
      <div className="absolute top-0 left-0 w-full z-40 pt-6 pb-4 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
        <div className="flex items-center justify-between px-6 mb-4 pointer-events-auto">
          <h1 className="text-xl font-bold text-white drop-shadow-md">For you</h1>
        </div>
      </div>

      {/* Full Screen Snapping Container */}
      <div
        ref={containerRef}
        className="absolute inset-0 h-full w-full overflow-y-scroll snap-y snap-mandatory hide-scrollbar"
      >
        {reels.length === 0 && !loading ? (
          <div className="flex h-full items-center justify-center bg-slate-900">
            <div className="px-8 py-10 text-center">
              <p className="text-lg font-semibold text-white">No reels yet</p>
              <p className="mt-1 text-sm text-slate-400">Be the first to create one.</p>
            </div>
          </div>
        ) : (
          reels.map((reel, index) => (
            <div key={reel.id} className="h-full w-full snap-start snap-always">
              <ReelCard
                reel={reel}
                isActive={index === activeIndex}
                guestMode={guestMode}
                onRequireAuth={handleRequireAuth}
                isFollowing={reel.creatorId ? following.has(reel.creatorId) : false}
                onLike={() => handleLike(reel.id)}
                onSave={() => handleSave(reel.id)}
                onShare={() => handleShare(reel.id)}
                onFollow={reel.creatorId && reel.creatorId !== currentUser?.id ? () => handleFollow(reel.creatorId!) : undefined}
                onProfileClick={() => {
                  if (reel.creatorId) navigate(`/profile/${reel.creatorId}`);
                }}
                onProductClick={() => handleProductClick(reel.productLink)}
              />
            </div>
          ))
        )}
        {loading && reels.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-50 bg-black">
            <LoadingSpinner />
          </div>
        )}
      </div>

      {error && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-50 rounded-full bg-red-600/90 px-5 py-2 text-sm text-white shadow-lg backdrop-blur-sm">
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
