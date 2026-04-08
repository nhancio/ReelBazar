import React, { useRef, useEffect, useState } from 'react';
import type { Reel } from '@reelbazaar/config';

interface ReelCardProps {
  reel: Reel;
  isActive: boolean;
  onLike?: () => void;
  onSave?: () => void;
  onShare?: () => void;
  onFollow?: () => void;
  onProfileClick?: () => void;
  onProductClick?: () => void;
  liked?: boolean;
  saved?: boolean;
  likeDisabled?: boolean;
  saveDisabled?: boolean;
  isFollowing?: boolean;
  guestMode?: boolean;
  onRequireAuth?: () => void;
  theme?: 'light' | 'dark';
}

const getDisplayName = (user?: Reel['creator']) => user?.username || user?.name || 'Unknown Creator';

export function ReelCard({ reel, isActive, onLike, onSave, onShare, onFollow, onProfileClick, onProductClick, liked, saved, likeDisabled, saveDisabled, isFollowing, guestMode, onRequireAuth, theme = 'dark' }: ReelCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);
  const [overlayBlocked, setOverlayBlocked] = useState(false);

  useEffect(() => {
    const handleOverlayPlayback = (event: Event) => {
      const detail = (event as CustomEvent<{ blocked?: boolean }>).detail;
      setOverlayBlocked(Boolean(detail?.blocked));
    };
    window.addEventListener('rb:overlay-playback', handleOverlayPlayback as EventListener);
    return () => window.removeEventListener('rb:overlay-playback', handleOverlayPlayback as EventListener);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const attemptPlay = async () => {
      try {
        if (isActive && !document.hidden && !overlayBlocked) {
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
        if (isActive && !document.hidden && !overlayBlocked) {
          video.muted = true;
          setMuted(true);
          await video.play().catch(e => console.error('Muted autoplay also failed:', e));
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        video.pause();
      } else if (isActive && !overlayBlocked) {
        attemptPlay();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    attemptPlay();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isActive, muted, overlayBlocked]);

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
    if (likeDisabled) return;
    if (guestMode) {
      if (onRequireAuth) onRequireAuth();
      return;
    }
    if (onLike) onLike();
  };

  const handleLocalSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (saveDisabled) return;
    if (guestMode) {
      if (onRequireAuth) onRequireAuth();
      return;
    }
    if (onSave) onSave();
  };

  return (
    <div className={`relative h-full w-full flex-shrink-0 snap-start overflow-hidden ${theme === 'light' ? 'bg-white' : 'bg-black'}`} onClick={handleToggleMute}>
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

      <div className={`pointer-events-none absolute inset-0 ${theme === 'light' ? 'bg-gradient-to-t from-white/60 via-transparent to-white/10' : 'bg-gradient-to-t from-black/80 via-transparent to-black/20'}`} />

      {/* Mute/Unmute Button */}
      <button 
        onClick={handleToggleMute}
        className={`absolute right-4 top-20 flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-md border transition-transform hover:active:scale-90 z-10 ${
          theme === 'light'
            ? 'bg-white/40 border-slate-300/30 text-slate-800 hover:bg-white/60'
            : 'bg-black/40 border-white/20 text-white hover:bg-black/60'
        }`}
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
               getDisplayName(reel.creator).slice(0, 1).toUpperCase()
            )}
          </div>
          <div 
            onClick={(e) => handleInteraction(e, onProfileClick, true)}
            className={`flex flex-col drop-shadow-md cursor-pointer active:scale-95 transition-transform ${
              theme === 'light' ? 'text-slate-800' : 'text-white'
            }`}
          >
            <span className={`text-sm font-semibold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
              {getDisplayName(reel.creator)}
            </span>
          </div>
          {onFollow && (
            <button
              className={`ml-2 rounded-full border px-3 py-1 text-[11px] font-semibold backdrop-blur-sm transition ${
                isFollowing
                  ? theme === 'light'
                    ? 'border-slate-300 bg-slate-200/60 text-slate-900 hover:bg-slate-300/80'
                    : 'border-white/20 bg-white/20 text-white hover:bg-white/30'
                  : theme === 'light'
                    ? 'border-slate-400 text-slate-900 hover:bg-slate-100/80'
                    : 'border-white/80 text-white hover:bg-white hover:text-black'
              }`}
              onClick={(e) => handleInteraction(e, onFollow)}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
        </div>

        {reel.caption && (
          <p className={`line-clamp-2 text-sm drop-shadow-md ${
            theme === 'light'
              ? 'text-slate-800'
              : 'text-white/90'
          }`}>
            {reel.caption}
          </p>
        )}
      </div>

      {/* Shop Button — Instagram-style gradient */}
      <div className="absolute bottom-12 left-4 right-20">
        <button
          onClick={(e) => handleInteraction(e, onProductClick, true)}
          className="flex w-full max-w-[280px] items-center justify-center gap-2 rounded-[16px] px-4 py-3 text-sm font-bold text-white shadow-lg border border-white/15 transition-transform active:scale-95 bg-[linear-gradient(45deg,#f09433_0%,#e6683c_25%,#dc2743_50%,#cc2366_75%,#bc1888_100%)]"
        >
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
          View product
        </button>
      </div>

      {/* Action Buttons - Bottom Right */}
      <div className="absolute bottom-12 right-2 flex flex-col items-center gap-5">
        <button onClick={handleLocalLike} disabled={likeDisabled} className="group flex flex-col items-center gap-1 transition-transform active:scale-90 disabled:opacity-60">
          <div className="flex h-10 w-10 items-center justify-center">
            {liked ? (
              <svg className="h-8 w-8 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
              </svg>
            ) : (
              <svg className={`h-8 w-8 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] ${
                theme === 'light' ? 'text-slate-800' : 'text-white'
              }`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
            )}
          </div>
          <span className={`text-xs font-semibold drop-shadow-md ${
            theme === 'light' ? 'text-slate-800' : 'text-white'
          }`}>{reel.likesCount || 0}</span>
        </button>

        <button onClick={handleLocalSave} disabled={saveDisabled} className="group flex flex-col items-center gap-1 transition-transform active:scale-90 disabled:opacity-60">
          <div className="flex h-10 w-10 items-center justify-center">
            {saved ? (
              <svg className="h-8 w-8 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M6.32 2.577a49.255 49.255 0 0111.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 01-1.085.67L12 18.089l-7.165 3.583A.75.75 0 013.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className={`h-8 w-8 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] ${
                theme === 'light' ? 'text-slate-800' : 'text-white'
              }`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
              </svg>
            )}
          </div>
          <span className={`text-xs font-semibold drop-shadow-md ${
            theme === 'light' ? 'text-slate-800' : 'text-white'
          }`}>{reel.savesCount || 0}</span>
        </button>

        <button onClick={(e) => handleInteraction(e, onShare, true)} className="group flex flex-col items-center gap-1 transition-transform active:scale-90">
          <div className="flex h-10 w-10 items-center justify-center">
            <svg className={`h-8 w-8 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] transition-colors active:text-slate-300 ${
              theme === 'light' ? 'text-slate-800' : 'text-white'
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
            </svg>
          </div>
        </button>
      </div>
    </div>
  );
}
