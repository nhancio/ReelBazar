import React, { useRef, useEffect, useState } from 'react';
import type { Reel } from '@reelbazaar/config';

interface ReelCardProps {
  reel: Reel;
  isActive: boolean;
  onLike?: () => void;
  onSave?: () => void;
  onComment?: () => void;
  onShare?: () => void;
  onFollow?: () => void;
  onProfileClick?: () => void;
  onProductClick?: () => void;
  liked?: boolean;
  saved?: boolean;
  isFollowing?: boolean;
  guestMode?: boolean;
  onRequireAuth?: () => void;
}

export function ReelCard({ reel, isActive, onLike, onSave, onComment, onShare, onFollow, onProfileClick, onProductClick, liked, saved, isFollowing, guestMode, onRequireAuth }: ReelCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const [localLiked, setLocalLiked] = useState(!!liked);
  const [localSaved, setLocalSaved] = useState(!!saved);
  const [localLikesCount, setLocalLikesCount] = useState(reel.likesCount || 0);
  const [localSavesCount, setLocalSavesCount] = useState(reel.savesCount || 0);

  // Sync with props if they are explicitly provided
  useEffect(() => {
    if (liked !== undefined) {
      setLocalLiked(!!liked);
    }
  }, [liked]);

  useEffect(() => {
    if (saved !== undefined) {
      setLocalSaved(!!saved);
    }
  }, [saved]);

  useEffect(() => {
    setLocalLikesCount(reel.likesCount || 0);
  }, [reel.id, reel.likesCount]);

  useEffect(() => {
    setLocalSavesCount(reel.savesCount || 0);
  }, [reel.id, reel.savesCount]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const attemptPlay = async () => {
      try {
        if (isActive && !document.hidden) {
          // Try to play with sound first
          video.muted = muted;
          await video.play();
        } else {
          video.pause();
          video.currentTime = 0;
        }
      } catch (err) {
        console.warn('Autoplay with sound blocked, trying muted:', err);
        // If blocked, we might need to mute to allow autoplay
        if (isActive && !document.hidden) {
          video.muted = true;
          setMuted(true);
          await video.play().catch(e => console.error('Muted autoplay also failed:', e));
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        video.pause();
      } else if (isActive) {
        attemptPlay();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    attemptPlay();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isActive, muted]);

  const handleToggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newMuted = !muted;
    setMuted(newMuted);
    if (videoRef.current) {
      videoRef.current.muted = newMuted;
    }
  };

  const handleInteraction = (e: React.MouseEvent, action?: () => void, allowGuest?: boolean) => {
    e.stopPropagation();
    if (guestMode && !allowGuest) {
      if (onRequireAuth) onRequireAuth();
      else window.alert('Please sign in to perform this action.');
    } else if (action) {
      action();
    }
  };

  const handleLocalLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (guestMode) {
      if (onRequireAuth) onRequireAuth();
      return;
    }
    const newLiked = !localLiked;
    setLocalLiked(newLiked);
    setLocalLikesCount(prev => prev + (newLiked ? 1 : -1));
    if (onLike) onLike();
  };

  const handleLocalSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (guestMode) {
      if (onRequireAuth) onRequireAuth();
      return;
    }
    const newSaved = !localSaved;
    setLocalSaved(newSaved);
    setLocalSavesCount(prev => prev + (newSaved ? 1 : -1));
    if (onSave) onSave();
  };

  return (
    <div className="relative h-full w-full flex-shrink-0 snap-start overflow-hidden bg-black" onClick={handleToggleMute}>
      <video
        ref={videoRef}
        src={reel.videoUrl}
        className="h-full w-full object-cover"
        loop
        muted={muted}
        playsInline
        preload="auto"
        poster={reel.thumbnailUrl || undefined}
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

      {/* Mute/Unmute Button */}
      <button 
        onClick={handleToggleMute}
        className="absolute right-4 top-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white transition-transform hover:bg-black/60 active:scale-90 z-10"
      >
        {muted ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
        )}
      </button>

      {/* Creator Info - Bottom Left */}
      <div className="absolute bottom-28 left-4 right-20 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div 
            onClick={(e) => handleInteraction(e, onProfileClick, true)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#f1b3dd] via-[#a0bfff] to-[#6d8deb] text-sm font-semibold text-white border-2 border-white/20 cursor-pointer active:scale-95 transition-transform"
          >
            {reel.creator?.avatarUrl ? (
               <img src={reel.creator.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
               (reel.creator?.name || 'U').slice(0, 1).toUpperCase()
            )}
          </div>
          <div 
            onClick={(e) => handleInteraction(e, onProfileClick, true)}
            className="flex flex-col drop-shadow-md cursor-pointer active:scale-95 transition-transform"
          >
            <span className="text-sm font-semibold text-white">
              {reel.creator?.name || 'Unknown Creator'}
            </span>
          </div>
          <button 
            className={`ml-2 rounded-full border px-3 py-1 text-[11px] font-semibold backdrop-blur-sm transition ${
              isFollowing 
                ? 'border-white/20 bg-white/20 text-white hover:bg-white/30' 
                : 'border-white/80 text-white hover:bg-white hover:text-black'
            }`} 
            onClick={(e) => handleInteraction(e, onFollow)}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </button>
        </div>

        {reel.caption && (
          <p className="line-clamp-2 text-sm text-white/90 drop-shadow-md">
            {reel.caption}
          </p>
        )}
      </div>

      {/* Shop Button */}
      <div className="absolute bottom-12 left-4 right-20">
        <button
          onClick={(e) => handleInteraction(e, onProductClick, true)}
          className="flex w-full max-w-[280px] items-center justify-center gap-2 rounded-[16px] bg-white/20 px-4 py-3 text-sm font-semibold text-white shadow-lg backdrop-blur-xl border border-white/30 transition-transform hover:bg-white/30 active:scale-95"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
          View Product
        </button>
      </div>

      {/* Action Buttons - Bottom Right */}
      <div className="absolute bottom-12 right-2 flex flex-col items-center gap-5">
        <button onClick={handleLocalLike} className="group flex flex-col items-center gap-1 transition-transform active:scale-90">
          <div className="flex h-10 w-10 items-center justify-center">
            {localLiked ? (
              <svg className="h-8 w-8 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
              </svg>
            ) : (
              <svg className="h-8 w-8 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
            )}
          </div>
          <span className="text-xs font-semibold text-white drop-shadow-md">{localLikesCount}</span>
        </button>

        <button onClick={handleLocalSave} className="group flex flex-col items-center gap-1 transition-transform active:scale-90">
          <div className="flex h-10 w-10 items-center justify-center">
            {localSaved ? (
              <svg className="h-8 w-8 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M6.32 2.577a49.255 49.255 0 0111.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 01-1.085.67L12 18.089l-7.165 3.583A.75.75 0 013.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="h-8 w-8 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
              </svg>
            )}
          </div>
          <span className="text-xs font-semibold text-white drop-shadow-md">{localSavesCount}</span>
        </button>

        <button onClick={(e) => handleInteraction(e, onShare, true)} className="group flex flex-col items-center gap-1 transition-transform active:scale-90">
          <div className="flex h-10 w-10 items-center justify-center">
            <svg className="h-8 w-8 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] transition-colors active:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
            </svg>
          </div>
        </button>
      </div>
    </div>
  );
}
