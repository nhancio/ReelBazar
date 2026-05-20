import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '@reelbazaar/ui';
import { collaborationsApi } from '@reelbazaar/api';
import type { Reel } from '@reelbazaar/config';
import { NavigationArrows } from '../components/NavigationArrows';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function BrandPerformancePage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const isDark = theme !== 'light';

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const response = await collaborationsApi.getBrandPerformance(user.id);
        setReels(response.reels);
      } catch (err) {
        console.error('Failed to load brand performance:', err);
        setReels([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  return (
    <div className={`min-h-[100dvh] pb-24 ${isDark ? 'bg-black text-white' : 'bg-[#f6f7fb] text-black'}`}>
      <header className={`sticky top-0 z-10 flex items-center gap-3 border-b px-3 py-3 ${isDark ? 'border-white/10 bg-black' : 'border-black/10 bg-white'}`}>
        <NavigationArrows />
        <h1 className="text-base font-semibold">Product performance</h1>
      </header>
      <main className="px-4 py-4">
        {loading ? (
          <LoadingSpinner />
        ) : reels.length === 0 ? (
          <p className={`py-16 text-center text-sm ${isDark ? 'text-white/45' : 'text-black/45'}`}>No tagged reels found yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {reels.map((reel) => (
              <button key={reel.id} onClick={() => navigate(`/reel/${reel.id}`)} className={`overflow-hidden rounded-lg border text-left ${isDark ? 'border-white/10 bg-white/5' : 'border-black/10 bg-white'}`}>
                <video src={reel.videoUrl} className="aspect-[3/4] w-full object-cover" muted playsInline preload="metadata" />
                <div className="p-2">
                  <p className="line-clamp-2 text-xs font-semibold">{reel.caption || 'Tagged reel'}</p>
                  <p className={`mt-1 text-[11px] ${isDark ? 'text-white/50' : 'text-black/50'}`}>
                    {(reel.viewsCount || 0).toLocaleString()} views · {(reel.likesCount || 0).toLocaleString()} likes
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
