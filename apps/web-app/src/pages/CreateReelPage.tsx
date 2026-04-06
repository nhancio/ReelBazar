import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '@reelbazaar/ui';
import { CATEGORIES, type Category, SUPPORTED_VIDEO_TYPES, MAX_FILE_SIZE } from '@reelbazaar/config';
import { useAuth } from '../context/AuthContext';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, storage } from '../firebase';
import { v4 as uuidv4 } from 'uuid';

export default function CreateReelPage() {
  const { guestMode, user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [productLink, setProductLink] = useState('');
  const [category, setCategory] = useState<Category>('Women');
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
        category,
        caption: caption || null,
        brandTag: brandTag || null,
        creatorId: user.id,
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

  return (
    <div className="rb-page pb-24">
        <div className="mb-6 px-1">
          <p className="text-sm font-medium text-slate-500">Creator studio</p>
          <h1 className="rb-title text-[2rem]">Create Reel</h1>
          {guestMode && <p className="mt-1 text-sm text-slate-500">Demo mode: uploads stay local and are not sent anywhere.</p>}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-lg mx-auto px-1">
        <div
          onClick={() => !loading && fileInputRef.current?.click()}
          className={`rb-card relative flex h-40 w-full cursor-pointer items-center justify-center overflow-hidden border-2 border-dashed border-slate-300 bg-slate-50 p-2 transition-colors hover:bg-slate-100 ${loading ? 'opacity-70 pointer-events-none' : ''}`}
        >
          {preview ? (
            <video src={preview} className="h-full w-full rounded-xl object-cover" />
          ) : (
            <div className="text-center p-4">
              <svg className="mx-auto mb-2 h-8 w-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p className="font-medium text-slate-700 text-sm">Tap to upload video</p>
              <p className="mt-1 text-[11px] text-slate-500">MP4, WebM, QuickTime up to 50MB</p>
            </div>
          )}
          
          {loading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="relative h-20 w-20 flex items-center justify-center">
                 <svg className="h-full w-full rotate-[-90deg]">
                    <circle 
                      cx="40" cy="40" r="36" stroke="white" strokeWidth="4" fill="transparent" opacity="0.2"
                    />
                    <circle 
                      cx="40" cy="40" r="36" stroke="white" strokeWidth="4" fill="transparent"
                      strokeDasharray={226.19}
                      strokeDashoffset={226.19 * (1 - progress / 100)}
                      strokeLinecap="round"
                    />
                 </svg>
                 <span className="absolute text-sm font-bold text-white">{progress}%</span>
              </div>
              <p className="mt-4 text-sm font-semibold text-white">Uploading reel...</p>
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

        <div className="space-y-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <Input
            label="Product Link *"
            type="url"
            value={productLink}
            onChange={(e) => setProductLink(e.target.value)}
            placeholder="https://example.com/product"
            required
            className="border-slate-200 focus:border-blue-500 focus:ring-blue-500/20"
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Caption</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Describe your reel..."
              className="w-full min-h-[60px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-1.5 px-1">
            <label className="text-sm font-medium text-slate-700">Category *</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    category === cat 
                      ? 'bg-black text-white' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <Input
            label="Brand Tag"
            value={brandTag}
            onChange={(e) => setBrandTag(e.target.value)}
            placeholder="@BrandName"
            className="bg-white border-slate-200"
          />
        </div>

        {error && <p className="text-sm text-red-500 px-1">{error}</p>}

        <div className="pt-2">
          <Button type="submit" fullWidth loading={loading} disabled={!file || !productLink}>
            Upload
          </Button>
        </div>
      </form>
    </div>
  );
}
