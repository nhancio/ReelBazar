import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usersApi, reelsApi } from '@reelbazaar/api';
import { Avatar, Button, LoadingSpinner } from '@reelbazaar/ui';
import type { User, Reel } from '@reelbazaar/config';
import { demoReels, demoUsers } from '../demoData';

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser, signOut, guestMode } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [reels, setReels] = useState<Reel[]>([]);
  const [savedReels, setSavedReels] = useState<Reel[]>([]);
  const [activeTab, setActiveTab] = useState<'my' | 'saved'>('my');
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const isOwnProfile = !userId || userId === currentUser?.id;
  const displayUser = isOwnProfile ? currentUser : profileUser;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (guestMode) {
          const fallbackUser =
            userId === demoUsers.brand.id
              ? demoUsers.brand
              : userId === demoUsers.brandAlt.id
                ? demoUsers.brandAlt
                : currentUser;
          setProfileUser(!isOwnProfile && fallbackUser ? fallbackUser : null);
          const targetId = isOwnProfile ? currentUser!.id : fallbackUser!.id;
          
          // In guest mode, just use demo data
          setReels(demoReels.filter((reel) => reel.creatorId === targetId));
          setSavedReels(demoReels.slice(0, 2)); // Mock saved reels for guest
          return;
        }

        if (!isOwnProfile && userId) {
          const { user } = await usersApi.getById(userId);
          setProfileUser(user);
        } else if (currentUser) {
          // Refresh current user stats
          const { user } = await usersApi.getById(currentUser.id);
          setProfileUser(user);
        }

        const targetId = isOwnProfile ? currentUser!.id : userId!;
        
        // Load user's reels
        const { reels: userReels } = await reelsApi.getUserReels(targetId);
        setReels(userReels);

        // Load saved reels if it's own profile
        if (isOwnProfile) {
          const { reels: saved } = await reelsApi.getSavedReels(targetId);
          setSavedReels(saved);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId, isOwnProfile, currentUser, guestMode]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isOwnProfile || guestMode) return;

    setUploadingAvatar(true);
    try {
      await usersApi.updateAvatar(file);
      window.location.reload(); // Refresh to see the new avatar everywhere
    } catch (err) {
      console.error('Failed to update avatar', err);
      alert('Failed to update profile picture.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (loading || !displayUser) return <div className="min-h-screen bg-black pt-20"><LoadingSpinner /></div>;

  const displayReels = activeTab === 'my' ? reels : savedReels;

  // We rely on backend providing followersCount and followingCount if available.
  const postsCount = reels.length;
  // Use 'any' type casting safely to access newly added properties that might not be in config yet
  const followersCount = (displayUser as any).followersCount || 0;
  const followingCount = (displayUser as any).followingCount || 0;

  return (
    <div className="min-h-[100dvh] bg-black text-white pb-24">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <h1 className="text-xl font-bold">{displayUser.name}</h1>
        {isOwnProfile && (
           <button onClick={() => setShowSettings(true)} className="p-2 -mr-2">
             <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
             </svg>
           </button>
        )}
      </div>

      {/* Profile Info Section */}
      <div className="px-4 pt-4 pb-2">
        {/* DP & Stats Row */}
        <div className="flex items-center justify-between">
          <div className="relative">
            <Avatar name={displayUser.name} src={displayUser.avatarUrl} size="lg" />
            {isOwnProfile && (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-1.5 rounded-full bg-white shadow-md border border-slate-200 text-black hover:text-blue-500 transition-colors z-10"
                disabled={uploadingAvatar}
              >
                {uploadingAvatar ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                )}
              </button>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleAvatarUpload}
            />
          </div>
          
          <div className="flex flex-1 justify-around ml-6 mr-2">
            <div className="text-center">
              <p className="text-lg font-bold">{postsCount}</p>
              <p className="text-[13px] text-white/80">posts</p>
            </div>
            <div className="text-center cursor-pointer active:opacity-50" onClick={() => alert("Followers list coming soon!")}>
              <p className="text-lg font-bold">{followersCount}</p>
              <p className="text-[13px] text-white/80">followers</p>
            </div>
            <div className="text-center cursor-pointer active:opacity-50" onClick={() => alert("Following list coming soon!")}>
              <p className="text-lg font-bold">{followingCount}</p>
              <p className="text-[13px] text-white/80">following</p>
            </div>
          </div>
        </div>

        {/* Bio */}
        <div className="mt-3">
          <p className="font-bold text-[14px]">{displayUser.name}</p>
          {displayUser.brandName && (
            <p className="text-[14px] text-white/90 mt-1">Building: <span className="font-medium">{displayUser.brandName}</span></p>
          )}
          {displayUser.country && (
            <p className="text-[14px] text-white/90">{displayUser.country}</p>
          )}
        </div>

        {/* Actions Row */}
        <div className="mt-4 flex gap-2">
          {isOwnProfile && (
            <>
              <button 
                onClick={() => navigate('/create')}
                className="flex-1 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg py-1.5 text-[14px] transition-colors"
              >
                Create
              </button>
              <button 
                onClick={() => alert("Share Profile coming soon!")}
                className="flex-1 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg py-1.5 text-[14px] transition-colors"
              >
                Share profile
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-t border-white/20 mt-2">
        <button
          onClick={() => setActiveTab('my')}
          className={`flex-1 flex justify-center items-center py-3 relative ${
            activeTab === 'my' ? 'text-white' : 'text-white/50'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
          {activeTab === 'my' && <div className="absolute top-0 left-0 right-0 h-[1px] bg-white" />}
        </button>
        {isOwnProfile && (
          <button
            onClick={() => setActiveTab('saved')}
            className={`flex-1 flex justify-center items-center py-3 relative ${
              activeTab === 'saved' ? 'text-white' : 'text-white/50'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            {activeTab === 'saved' && <div className="absolute top-0 left-0 right-0 h-[1px] bg-white" />}
          </button>
        )}
      </div>

      {/* Grid */}
      {displayReels.length === 0 ? (
        <div className="py-12 text-center text-white/50">
          <p className="font-medium">No reels found</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-0.5">
          {displayReels.map((reel) => (
            <div 
              key={reel.id} 
              className="relative aspect-[3/4] bg-white/10 cursor-pointer overflow-hidden"
              onClick={() => navigate(`/reel/${reel.id}`)}
            >
              <video                src={reel.videoUrl}
                className="w-full h-full object-cover"
                muted
                preload="metadata"
              />
              <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/30 px-1.5 py-0.5 rounded backdrop-blur-sm">
                <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                </svg>
                <span className="text-[11px] font-bold text-white">{reel.viewsCount || 0}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
          <div className="bg-[#1a1a1a] w-full rounded-t-3xl p-6 flex flex-col gap-4 animate-in slide-in-from-bottom-10" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-2" />
            <button 
              className="w-full text-left py-3 text-red-500 text-lg font-bold flex items-center gap-3"
              onClick={() => {
                setShowSettings(false);
                signOut();
              }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}