import React, { useRef, useEffect, useState } from 'react';
import type { Reel } from '@reelbazaar/config';

interface InstaPostCardProps {
  reel: Reel;
  onLike?: () => void;
  onSave?: () => void;
  onShare?: () => void;
  onProfileClick?: () => void;
  /** If omitted, opens `reel.productLink` in a new tab when valid. */
  onProductClick?: () => void;
  liked?: boolean;
  saved?: boolean;
  likeDisabled?: boolean;
  saveDisabled?: boolean;
  guestMode?: boolean;
  onRequireAuth?: () => void;
  muted?: boolean;
  onMutedChange?: (muted: boolean) => void;
}

const getDisplayName = (user?: Reel['creator']) => user?.username || user?.name || 'User';

function isHttpUrl(s: string | undefined | null): s is string {
  return Boolean(s && /^https?:\/\//i.test(s.trim()));
}

export function InstaPostCard({
  reel,
  onLike,
  onSave,
  onShare,
  onProfileClick,
  onProductClick,
  liked,
  saved,
  likeDisabled,
  saveDisabled,
  guestMode,
  onRequireAuth,
  muted: controlledMuted,
  onMutedChange,
}: InstaPostCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalMuted, setInternalMuted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [overlayBlocked, setOverlayBlocked] = useState(false);
  const muted = controlledMuted ?? internalMuted;
  const setMuted = (next: boolean) => {
    if (onMutedChange) onMutedChange(next);
    else setInternalMuted(next);
  };

  useEffect(() => {
    setVideoFailed(false);
  }, [reel.id, reel.videoUrl]);

  useEffect(() => {
    const handleOverlayPlayback = (event: Event) => {
      const detail = (event as CustomEvent<{ blocked?: boolean }>).detail;
      setOverlayBlocked(Boolean(detail?.blocked));
    };
    window.addEventListener('rb:overlay-playback', handleOverlayPlayback as EventListener);
    return () => window.removeEventListener('rb:overlay-playback', handleOverlayPlayback as EventListener);
  }, []);

  // Intersection Observer for auto-play
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.6 } // Play when 60% visible
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isVisible && !document.hidden && !overlayBlocked) {
      video.muted = muted;
      video.play().catch(() => {
        video.muted = true;
        setMuted(true);
        video.play().catch(e => console.log('Autoplay prevented:', e));
      });
    } else {
      video.pause();
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        video.pause();
      } else if (isVisible && !overlayBlocked) {
        video.play().catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isVisible, muted, overlayBlocked]);

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
    if (guestMode) return onRequireAuth?.();
    if (onLike) onLike();
  };

  const handleLocalSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (saveDisabled) return;
    if (guestMode) return onRequireAuth?.();
    if (onSave) onSave();
  };

  const handleProductClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onProductClick) {
      onProductClick();
      return;
    }
    if (isHttpUrl(reel.productLink)) {
      window.open(reel.productLink.trim(), '_blank', 'noopener,noreferrer');
    }
  };

  const showProductCta = isHttpUrl(reel.productLink);

  return (
    <div ref={containerRef} className="w-full bg-black text-white border-b border-white/10 pb-3">
      {/* Header */}
      <div className="flex items-center px-3 py-2.5">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={(e) => handleInteraction(e, onProfileClick, true)}>
          <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500 p-[2px]">
            <div className="h-full w-full rounded-full border border-black bg-[#1a1a1a] overflow-hidden">
              {reel.creator?.avatarUrl ? (
                <img src={reel.creator.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-bold text-xs">
                  {getDisplayName(reel.creator).charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-[13px] font-semibold tracking-tight">{getDisplayName(reel.creator)}</span>
            {reel.creator?.brandName && <span className="text-[11px] text-white/60">{reel.creator.brandName}</span>}
          </div>
        </div>
      </div>

      {/* Media Content */}
      <div className="relative w-full aspect-[4/5] bg-black flex items-center justify-center overflow-hidden" onClick={() => setMuted(!muted)}>
        {reel.videoUrl ? (
          <video
            ref={videoRef}
            key={reel.videoUrl}
            src={reel.videoUrl}
            className="w-full h-full object-cover"
            loop
            muted={muted}
            playsInline
            preload="metadata"
            poster={reel.thumbnailUrl || undefined}
            onError={() => setVideoFailed(true)}
          />
        ) : null}
        {videoFailed || !reel.videoUrl ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black px-6 text-center">
            <p className="text-sm text-white/80">
              {!reel.videoUrl ? 'No video URL for this reel.' : 'This video could not be loaded (broken link, private file, or network issue).'}
            </p>
            {showProductCta && (
              <p className="text-xs text-white/50">Use View product to open the link.</p>
            )}
          </div>
        ) : null}
        {/* Sound Toggle Icon */}
        <div className="absolute bottom-3 right-3 h-7 w-7 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-md">
          {muted ? (
            <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
          ) : (
            <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
          )}
        </div>
      </div>

      {/* View product — above like row, Instagram-style gradient */}
      {showProductCta ? (
        <div className="px-3 pt-3 pb-1">
          <button
            type="button"
            onClick={handleProductClick}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white shadow-lg active:opacity-90 border border-white/10 bg-[linear-gradient(45deg,#f09433_0%,#e6683c_25%,#dc2743_50%,#cc2366_75%,#bc1888_100%)]"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            View product
          </button>
        </div>
      ) : null}

      {/* Action Bar */}
      <div className="flex items-center justify-between px-3 pt-2 pb-2">
        <div className="flex items-center gap-4">
          <button onClick={handleLocalLike} disabled={likeDisabled} className="active:opacity-50 transition-opacity disabled:opacity-60">
            {liked ? (
              <svg className="w-[26px] h-[26px] text-[#ff3040]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            ) : (
              <svg className="w-[26px] h-[26px] text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            )}
          </button>
          <button onClick={(e) => handleInteraction(e, onShare, true)} className="active:opacity-50 transition-opacity">
            <svg className="w-[22px] h-[22px] text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
          </button>
        </div>
        <button onClick={handleLocalSave} disabled={saveDisabled} className="active:opacity-50 transition-opacity disabled:opacity-60">
          {saved ? (
            <svg className="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>
          ) : (
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
          )}
        </button>
      </div>

      {/* Likes */}
      <div className="px-3 mb-1">
        <span className="text-[13px] font-semibold">{(reel.likesCount || 0).toLocaleString()} likes</span>
      </div>

      {/* Caption */}
      <div className="px-3 text-[13px] leading-[18px]">
        <span className="font-semibold mr-1.5">{getDisplayName(reel.creator)}</span>
        <span>{reel.caption}</span>
      </div>
    </div>
  );
}
