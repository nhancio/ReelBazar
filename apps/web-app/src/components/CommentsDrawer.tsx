import { useState, useEffect, useRef, useCallback } from 'react';
import { commentsApi, type Comment } from '@reelbazaar/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';

interface Props {
  reelId: string;
  isOpen: boolean;
  onClose: () => void;
  onCommentCountChange?: (delta: number) => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
}

export default function CommentsDrawer({ reelId, isOpen, onClose, onCommentCountChange }: Props) {
  const { user, guestMode } = useAuth();
  const { showToast } = useToast();
  const { theme } = useTheme();
  const [comments, setComments] = useState<Comment[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadComments = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const cursor = reset ? undefined : nextCursor;
      const res = await commentsApi.getForReel(reelId, cursor);
      setComments((prev) => reset ? res.comments : [...prev, ...res.comments]);
      setHasMore(res.hasMore);
      setNextCursor(res.nextCursor);
    } catch {
      showToast('Failed to load comments', 'error');
    } finally {
      setLoading(false);
    }
  }, [reelId, nextCursor, showToast]);

  useEffect(() => {
    if (isOpen) {
      setComments([]);
      setNextCursor(undefined);
      loadComments(true);
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, reelId]);

  const handlePost = async () => {
    if (!text.trim()) return;
    if (guestMode || !user) { showToast('Sign in to comment', 'info'); return; }
    setPosting(true);
    try {
      const res = await commentsApi.post(reelId, text.trim());
      setComments((prev) => [res.comment, ...prev]);
      setText('');
      onCommentCountChange?.(1);
      showToast('Comment posted', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to post comment', 'error');
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await commentsApi.delete(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      onCommentCountChange?.(-1);
      showToast('Comment deleted', 'success');
    } catch {
      showToast('Failed to delete comment', 'error');
    }
  };

  const dark = theme !== 'light';

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />

      {/* Drawer */}
      <div
        className={`fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-[430px] rounded-t-3xl shadow-2xl flex flex-col
          ${dark ? 'bg-[#111] text-white' : 'bg-white text-black'}`}
        style={{ maxHeight: '75dvh' }}
      >
        {/* Handle + Header */}
        <div className="flex flex-col items-center pt-3 pb-2 shrink-0">
          <div className={`w-10 h-1 rounded-full mb-3 ${dark ? 'bg-white/20' : 'bg-black/10'}`} />
          <span className="text-sm font-semibold">Comments</span>
        </div>

        {/* Comment list */}
        <div className="flex-1 overflow-y-auto px-4 pb-2">
          {loading && comments.length === 0 && (
            <div className="flex justify-center py-8">
              <div className={`w-5 h-5 rounded-full border-2 border-t-transparent animate-spin ${dark ? 'border-white/40' : 'border-black/30'}`} />
            </div>
          )}
          {!loading && comments.length === 0 && (
            <p className={`text-center py-10 text-sm ${dark ? 'text-white/40' : 'text-black/40'}`}>No comments yet. Be the first!</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3 py-3 border-b border-white/5">
              <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold overflow-hidden ${dark ? 'bg-white/10' : 'bg-black/10'}`}>
                {c.author?.avatarUrl ? (
                  <img src={c.author.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  (c.author?.name || 'U').charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold truncate">{c.author?.username || c.author?.name || 'User'}</span>
                  <span className={`text-[10px] ${dark ? 'text-white/30' : 'text-black/30'}`}>{timeAgo(c.createdAt)}</span>
                </div>
                <p className="text-sm mt-0.5 break-words">{c.text}</p>
              </div>
              {user?.id === c.authorId && (
                <button
                  onClick={() => handleDelete(c.id)}
                  className={`text-xs shrink-0 self-start mt-1 ${dark ? 'text-white/30 hover:text-red-400' : 'text-black/30 hover:text-red-500'}`}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {hasMore && !loading && (
            <button
              onClick={() => loadComments()}
              className={`w-full py-3 text-xs font-semibold ${dark ? 'text-white/50' : 'text-black/40'}`}
            >
              Load more
            </button>
          )}
        </div>

        {/* Input */}
        <div className={`shrink-0 flex items-center gap-2 px-4 py-3 border-t ${dark ? 'border-white/10' : 'border-black/10'}`}>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 500))}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handlePost()}
            placeholder={guestMode ? 'Sign in to comment…' : 'Add a comment…'}
            disabled={guestMode || posting}
            className={`flex-1 rounded-full px-4 py-2 text-sm outline-none border
              ${dark
                ? 'bg-white/10 border-white/10 text-white placeholder:text-white/30 focus:border-white/30'
                : 'bg-black/5 border-black/10 text-black placeholder:text-black/30 focus:border-black/20'
              }`}
          />
          <button
            onClick={handlePost}
            disabled={!text.trim() || posting || guestMode}
            className="text-sm font-semibold text-blue-400 disabled:opacity-30 px-1"
          >
            {posting ? '…' : 'Post'}
          </button>
        </div>
      </div>
    </>
  );
}
