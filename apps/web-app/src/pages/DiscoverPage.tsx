import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Avatar, LoadingSpinner } from '@reelbazaar/ui';
import { NavigationArrows } from '../components/NavigationArrows';
import type { User, BrandProduct } from '@reelbazaar/config';
import { collection, query, where, getDocs, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

const getProfileHandle = (user: User | null | undefined) => user?.username || user?.name?.replace(/\s+/g, '').toLowerCase() || 'user';

export default function DiscoverPage() {
  const { user: currentUser, guestMode } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const isDark = theme !== 'light';

  const [activeTab, setActiveTab] = useState<'creators' | 'brands'>('creators');
  const [creators, setCreators] = useState<User[]>([]);
  const [brands, setBrands] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState<User | null>(null);
  const [brandProducts, setBrandProducts] = useState<BrandProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const [followPending, setFollowPending] = useState<Set<string>>(new Set());

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as User));

      const creatorList = allUsers.filter(u => u.persona === 'Creator' || (!u.persona && u.id !== currentUser?.id));
      const brandList = allUsers.filter(u => u.persona === 'Brand');

      setCreators(creatorList);
      setBrands(brandList);

      if (currentUser) {
        const followSnap = await getDocs(query(collection(db, 'follows'), where('followerId', '==', currentUser.id)));
        const map: Record<string, boolean> = {};
        followSnap.docs.forEach(d => { map[d.data().followingId] = true; });
        setFollowingMap(map);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const loadBrandProducts = async (brand: User) => {
    setSelectedBrand(brand);
    setLoadingProducts(true);
    try {
      const snap = await getDocs(query(collection(db, 'brandProducts'), where('brandId', '==', brand.id)));
      const products = snap.docs.map(d => ({ id: d.id, ...d.data() } as BrandProduct));
      setBrandProducts(products);
    } catch (err) {
      console.error('Failed to load products:', err);
      setBrandProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  const toggleFollow = async (targetId: string) => {
    if (guestMode || !currentUser || followPending.has(targetId)) return;
    const isFollowing = Boolean(followingMap[targetId]);

    setFollowPending(prev => new Set(prev).add(targetId));
    setFollowingMap(prev => ({ ...prev, [targetId]: !isFollowing }));

    try {
      const followRef = doc(db, 'follows', `${currentUser.id}_${targetId}`);
      if (isFollowing) {
        await deleteDoc(followRef);
      } else {
        await setDoc(followRef, { followerId: currentUser.id, followingId: targetId, createdAt: new Date().toISOString() });
      }
    } catch {
      setFollowingMap(prev => ({ ...prev, [targetId]: isFollowing }));
    } finally {
      setFollowPending(prev => { const n = new Set(prev); n.delete(targetId); return n; });
    }
  };

  const renderCreatorCard = (user: User) => {
    const isMe = user.id === currentUser?.id;
    const isFollowing = Boolean(followingMap[user.id]);
    return (
      <div key={user.id} className={`flex items-center justify-between px-4 py-3 rounded-2xl transition-colors ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'}`}>
        <button className="flex items-center flex-1 min-w-0 text-left gap-3" onClick={() => navigate(`/profile/${user.id}`)}>
          <Avatar name={user.username || user.name} src={user.avatarUrl} size="md" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[14px] truncate">@{getProfileHandle(user)}</p>
            <p className={`text-[13px] truncate ${isDark ? 'text-white/50' : 'text-black/50'}`}>{user.name}</p>
            <div className={`flex items-center gap-3 text-xs mt-0.5 ${isDark ? 'text-white/40' : 'text-black/40'}`}>
              <span>{user.followersCount || 0} followers</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-[10px] font-bold">Creator</span>
            </div>
          </div>
        </button>
        {!isMe && !guestMode && (
          <button
            onClick={() => toggleFollow(user.id)}
            disabled={followPending.has(user.id)}
            className={`px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-colors shrink-0 disabled:opacity-60 ${
              isFollowing
                ? isDark ? 'bg-[#333] text-white hover:bg-[#444]' : 'bg-black/10 text-black hover:bg-black/20'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </button>
        )}
      </div>
    );
  };

  const renderBrandCard = (brand: User) => (
    <button
      key={brand.id}
      onClick={() => loadBrandProducts(brand)}
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors text-left w-full ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'}`}
    >
      <Avatar name={brand.brandName || brand.name} src={brand.avatarUrl} size="md" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[14px] truncate">{brand.brandName || brand.name}</p>
        <p className={`text-[13px] truncate ${isDark ? 'text-white/50' : 'text-black/50'}`}>@{getProfileHandle(brand)}</p>
        {brand.websiteLink && (
          <p className="text-[11px] text-blue-400 truncate">{brand.websiteLink}</p>
        )}
      </div>
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-400 text-[10px] font-bold shrink-0">Brand</span>
      <svg className={`w-5 h-5 shrink-0 ${isDark ? 'text-white/30' : 'text-black/30'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );

  const renderBrandDetail = () => {
    if (!selectedBrand) return null;
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white animate-in slide-in-from-bottom-2">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <button onClick={() => setSelectedBrand(null)} className="p-1">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-base font-bold">{selectedBrand.brandName || selectedBrand.name}</h2>
          <div className="w-8" />
        </div>

        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-4">
            <Avatar name={selectedBrand.brandName || selectedBrand.name} src={selectedBrand.avatarUrl} size="lg" />
            <div>
              <p className="font-bold text-lg">{selectedBrand.brandName || selectedBrand.name}</p>
              <p className="text-white/50 text-sm">@{getProfileHandle(selectedBrand)}</p>
              {selectedBrand.websiteLink && (
                <a href={selectedBrand.websiteLink} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-sm hover:underline">
                  {selectedBrand.websiteLink}
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 pt-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/40 mb-3">Products</h3>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-20">
          {loadingProducts ? (
            <div className="pt-10"><LoadingSpinner /></div>
          ) : brandProducts.length === 0 ? (
            <p className="text-center text-white/40 text-sm pt-10">No products listed yet</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {brandProducts.map(product => (
                <a
                  key={product.id}
                  href={product.productLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden hover:bg-white/10 transition-colors"
                >
                  {product.imageUrl && (
                    <div className="aspect-square bg-white/5">
                      <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-3">
                    <p className="font-semibold text-sm truncate">{product.name}</p>
                    {product.price && <p className="text-green-400 text-sm font-bold mt-1">{product.price}</p>}
                    {product.description && <p className="text-white/50 text-xs mt-1 line-clamp-2">{product.description}</p>}
                    <p className="text-blue-400 text-xs mt-2 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      View product
                    </p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`min-h-[100dvh] pb-24 ${isDark ? 'bg-black text-white' : 'bg-[#f6f7fb] text-[#111827]'}`}>
      <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-white/10' : 'border-black/10'}`}>
        <NavigationArrows />
        <h1 className="text-xl font-bold ml-3 flex-1">Discover</h1>
      </div>

      <div className={`flex border-b ${isDark ? 'border-white/10' : 'border-black/10'}`}>
        <button
          onClick={() => setActiveTab('creators')}
          className={`flex-1 py-3 text-center text-sm font-bold relative transition-colors ${
            activeTab === 'creators' ? '' : isDark ? 'text-white/40' : 'text-black/40'
          }`}
        >
          Creators
          {activeTab === 'creators' && <div className={`absolute bottom-0 left-0 right-0 h-[2px] ${isDark ? 'bg-white' : 'bg-black'}`} />}
        </button>
        <button
          onClick={() => setActiveTab('brands')}
          className={`flex-1 py-3 text-center text-sm font-bold relative transition-colors ${
            activeTab === 'brands' ? '' : isDark ? 'text-white/40' : 'text-black/40'
          }`}
        >
          Brands
          {activeTab === 'brands' && <div className={`absolute bottom-0 left-0 right-0 h-[2px] ${isDark ? 'bg-white' : 'bg-black'}`} />}
        </button>
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <div className="pt-20"><LoadingSpinner /></div>
        ) : activeTab === 'creators' ? (
          <div className="flex flex-col gap-2">
            {creators.length === 0 ? (
              <p className={`text-center pt-10 text-sm ${isDark ? 'text-white/40' : 'text-black/40'}`}>No creators found</p>
            ) : (
              creators.map(renderCreatorCard)
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {brands.length === 0 ? (
              <p className={`text-center pt-10 text-sm ${isDark ? 'text-white/40' : 'text-black/40'}`}>No brands found</p>
            ) : (
              brands.map(renderBrandCard)
            )}
          </div>
        )}
      </div>

      {renderBrandDetail()}
    </div>
  );
}
