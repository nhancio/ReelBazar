import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ReelCard, LoadingSpinner } from '@reelbazaar/ui';
import { reelsApi } from '@reelbazaar/api';
import type { Reel } from '@reelbazaar/config';
import { useAuth } from '../context/AuthContext';
import { demoReels } from '../demoData';

export default function SingleReelPage() {
  const { reelId } = useParams<{ reelId: string }>();
  const { guestMode } = useAuth();
  const navigate = useNavigate();
  
  const [reel, setReel] = useState<Reel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadReel = async () => {
      setLoading(true);
      try {
        if (guestMode) {
          const found = demoReels.find(r => r.id === reelId);
          if (found) setReel(found);
          else setError("Reel not found");
          return;
        }
        
        if (reelId) {
          const { reel: fetchedReel } = await reelsApi.getById(reelId);
          setReel(fetchedReel);
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load reel");
      } finally {
        setLoading(false);
      }
    };
    
    loadReel();
  }, [reelId, guestMode]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-black flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !reel) {
    return (
      <div className="min-h-[100dvh] bg-black flex flex-col items-center justify-center text-white p-6">
        <p className="text-xl font-bold mb-4">{error || "Reel not found"}</p>
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
    <div className="relative h-[100dvh] w-full bg-black">
      {/* Back Button Overlay */}
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
          guestMode={guestMode}
          onProductClick={() => window.open(reel.productLink, '_blank')}
          onShare={() => {
            if (navigator.share) {
              navigator.share({ url: window.location.href });
            } else {
              navigator.clipboard.writeText(window.location.href);
              alert("Copied link!");
            }
          }}
        />
      </div>
    </div>
  );
}