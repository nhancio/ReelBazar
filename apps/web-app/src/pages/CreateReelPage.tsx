import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SUPPORTED_VIDEO_TYPES, MAX_FILE_SIZE } from '@reelbazaar/config';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, storage } from '../firebase';
import { v4 as uuidv4 } from 'uuid';

export default function CreateReelPage() {
  const { guestMode, user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [productLink, setProductLink] = useState('');
  const [caption, setCaption] = useState('');
  const [brandTag, setBrandTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!SUPPORTED_VIDEO_TYPES.includes(selected.type)) {
      setError('Please upload an MP4, WebM, or QuickTime video');
      return;
    }

    if (selected.size > MAX_FILE_SIZE) {
      setError('File size must be under 50MB');
      return;
    }

    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !productLink || !user) return;

    setLoading(true);
    setError('');
    setProgress(0);

    try {
      if (guestMode) {
        // In guest mode, just mock it
        await new Promise(r => setTimeout(r, 1000));
        navigate('/profile');
        return;
      }

      // 1. Upload video to Firebase Storage
      const fileId = uuidv4();
      const storageRef = ref(storage, `reels/${fileId}-${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      const videoUrl = await new Promise<string>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const p = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            setProgress(p);
          },
          (err) => reject(err),
          async () => {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(url);
          }
        );
      });

      // 2. Save metadata to Firestore
      await addDoc(collection(db, 'reels'), {
        videoUrl,
        thumbnailUrl: null,
        productLink,
        caption: caption || null,
        brandTag: brandTag || null,
        creatorId: auth.currentUser?.uid ?? user.id,
        likesCount: 0,
        viewsCount: 0,
        savesCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        serverCreatedAt: serverTimestamp(),
      });

      navigate('/profile');
    } catch (err: any) {
      console.error('Upload failed:', err);
      let errorMessage = err.message || 'Failed to upload reel';
      if (errorMessage === 'Load failed' || errorMessage.includes('fetch')) {
        errorMessage = 'Network error: This is likely a CORS issue or missing Storage permissions in Firebase. Make sure your Firebase Storage bucket has CORS configured for your domain.';
      } else if (err.code === 'storage/unauthorized') {
        errorMessage = 'Permission denied: You do not have permission to upload to this Firebase Storage bucket. Check your Firebase Security Rules.';
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  /* ! overrides globals.css base input/textarea (rounded glass style) */
  const fieldClass =
    theme === 'light'
      ? 'w-full !rounded-lg !border !border-black/12 !bg-white !px-3 !py-2.5 text-[15px] text-black placeholder:text-black/35 !shadow-none focus:!border-black/25 focus:!outline-none focus:!ring-1 focus:!ring-black/20'
      : 'w-full !rounded-lg !border !border-white/12 !bg-[#262626] !px-3 !py-2.5 text-[15px] text-white placeholder:text-white/35 !shadow-none focus:!border-white/25 focus:!outline-none focus:!ring-1 focus:!ring-white/20';

  return (
    <div className={`min-h-full w-full pb-28 ${theme === 'light' ? 'bg-[#f6f7fb] text-black' : 'bg-black text-white'}`}>
      {/* Instagram-style header */}
      <header className={`sticky top-0 z-10 flex items-center justify-center border-b px-2 py-3 ${theme === 'light' ? 'border-black/10 bg-white' : 'border-white/10 bg-black'}`}>
        <button
          type="button"
          aria-label="Go back"
          onClick={() => navigate(-1)}
          className={`absolute left-2 p-2 rounded-full ${theme === 'light' ? 'hover:bg-black/10 active:bg-black/5' : 'hover:bg-white/10 active:bg-white/5'}`}
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-base font-semibold tracking-tight">New reel</h1>
      </header>

      <form onSubmit={handleSubmit} className="mx-auto max-w-lg space-y-5 px-4 pt-4">
        {guestMode && (
          <p className="text-center text-[13px] text-white/45">Browse mode — sign in to publish reels.</p>
        )}

        <div
          role="button"
          tabIndex={0}
          onClick={() => !loading && fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (!loading) fileInputRef.current?.click();
            }
          }}
          className={`relative flex min-h-[200px] w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed border-white/20 bg-[#121212] transition-colors hover:border-white/30 hover:bg-[#161616] ${loading ? 'pointer-events-none opacity-70' : ''}`}
        >
          {preview ? (
            <video src={preview} className="max-h-[280px] w-full object-contain" playsInline muted />
          ) : (
            <div className="px-6 py-10 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/5">
                <svg className="h-7 w-7 text-[#0095f6]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-[15px] font-semibold text-white">Add video</p>
              <p className="mt-1 text-xs text-white/45">MP4, WebM or QuickTime · up to 50MB</p>
            </div>
          )}

          {loading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
              <div className="relative flex h-20 w-20 items-center justify-center">
                <svg className="h-full w-full -rotate-90">
                  <circle cx="40" cy="40" r="36" stroke="white" strokeWidth="4" fill="transparent" className="opacity-20" />
                  <circle
                    cx="40"
                    cy="40"
                    r="36"
                    stroke="white"
                    strokeWidth="4"
                    fill="transparent"
                    strokeDasharray={226.19}
                    strokeDashoffset={226.19 * (1 - progress / 100)}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute text-sm font-bold text-white">{progress}%</span>
              </div>
              <p className="mt-4 text-sm font-semibold text-white">Posting…</p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={loading}
          />
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-white/45">Product link</label>
            <input
              type="url"
              value={productLink}
              onChange={(e) => setProductLink(e.target.value)}
              placeholder="https://"
              required
              className={fieldClass}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-white/45">Caption</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write a caption…"
              rows={3}
              className={`${fieldClass} min-h-[88px] resize-none`}
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-white/45">Brand tag</label>
          <input
            type="text"
            value={brandTag}
            onChange={(e) => setBrandTag(e.target.value)}
            placeholder="@brand"
            className={fieldClass}
          />
        </div>

        {error && <p className="text-sm text-[#ed4956]">{error}</p>}

        <button
          type="submit"
          disabled={!file || !productLink || loading}
          className="w-full rounded-lg bg-[#0095f6] py-3 text-[15px] font-semibold text-white transition-opacity hover:bg-[#1877f2] disabled:cursor-not-allowed disabled:opacity-40 active:opacity-90"
        >
          {loading ? 'Sharing…' : 'Share'}
        </button>
      </form>
    </div>
  );
}
