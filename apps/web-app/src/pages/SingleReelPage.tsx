import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ReelCard, LoadingSpinner, AuthModal } from '@reelbazaar/ui';
import type { Reel } from '@reelbazaar/config';
import { useAuth } from '../context/AuthContext';
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  increment,
} from 'firebase/firestore';
import { signInWithGoogle } from '../auth/googleSignIn';
import { auth, db } from '../firebase';
import { useTheme } from '../context/ThemeContext';

export default function SingleReelPage() {
  const { reelId } = useParams<{ reelId: string }>();
  const { guestMode, user: currentUser, exitGuestMode, clearAuthError, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { theme } = useTheme();

  const [reel, setReel] = useState<Reel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [likePending, setLikePending] = useState(false);
  const [savePending, setSavePending] = useState(false);
  const [followPending, setFollowPending] = useState(false);

  const loadReel = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!reelId) {
        setError('Reel not found');
        return;
      }

      const reelDoc = await getDoc(doc(db, 'reels', reelId));
      if (reelDoc.exists()) {
        const data = reelDoc.data();
        let creator = null;
        if (data.creatorId) {
          const userDoc = await getDoc(doc(db, 'users', data.creatorId));
          if (userDoc.exists()) {
            creator = { id: userDoc.id, ...userDoc.data() };
          }
        }
        setReel({ id: reelDoc.id, ...data, creator } as Reel);
        return;
      }

      setError('Reel not found');
    } catch (err) {
      console.error('Error fetching reel from Firestore:', err);
      setError('Failed to load reel');
    } finally {
      setLoading(false);
    }
  }, [reelId]);

  useEffect(() => {
    loadReel();
  }, [loadReel]);

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
        console.error('Failed to load single reel interaction state:', err);
      }
    };

    loadInteractionState();
  }, [currentUser, guestMode, reelId, reel?.creatorId]);

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
    } catch (err) {
      console.error('Google sign-in failed:', err);
    }
  };

  const handleLike = async () => {
    if (!reel) return;
    if (guestMode || !currentUser) return handleRequireAuth();
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
    if (guestMode || !currentUser) return handleRequireAuth();
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
    if (guestMode) return handleRequireAuth();
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
    const url = `${window.location.origin}/reel/${reel.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Check out this reel on ReelBazaar!', url });
      } catch (err) {
        console.error('Failed to share reel:', err);
      }
      return;
    }

    await navigator.clipboard.writeText(url);
    window.alert('Link copied to clipboard!');
  };

  if (loading) {
    return (
      <div className={`min-h-[100dvh] flex items-center justify-center ${theme === 'light' ? 'bg-[#f6f7fb]' : 'bg-black'}`}>
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !reel) {
    return (
      <div className={`min-h-[100dvh] flex flex-col items-center justify-center p-6 ${theme === 'light' ? 'bg-[#f6f7fb] text-black' : 'bg-black text-white'}`}>
        <p className="text-xl font-bold mb-4">{error || 'Reel not found'}</p>
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-2 bg-white/20 rounded-full font-semibold hover:bg-white/30 transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className={`relative h-full w-full ${theme === 'light' ? 'bg-[#f6f7fb]' : 'bg-black'}`}>
      <button
        onClick={() => navigate(-1)}
        className="absolute top-6 left-4 z-50 p-2 bg-black/40 backdrop-blur-md rounded-full text-white"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      </button>

      <div className="h-full w-full">
        <ReelCard
          reel={reel}
          isActive={true}
          liked={liked}
          saved={saved}
          likeDisabled={likePending}
          saveDisabled={savePending}
          isFollowing={isFollowing}
          guestMode={guestMode}
          onRequireAuth={handleRequireAuth}
          onLike={handleLike}
          onSave={handleSave}
          onShare={handleShare}
          onFollow={reel.creatorId !== currentUser?.id ? handleFollow : undefined}
          onProfileClick={() => reel.creatorId && navigate(`/profile/${reel.creatorId}`)}
          onProductClick={() => window.open(reel.productLink, '_blank')}
          theme={theme}
        />
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSignIn={handleSignIn}
      />
    </div>
  );
}
