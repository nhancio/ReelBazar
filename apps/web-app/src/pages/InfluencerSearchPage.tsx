import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, LoadingSpinner } from '@reelbazaar/ui';
import { collaborationsApi, type InfluencerMatch } from '@reelbazaar/api';
import { AGE_GROUPS, GENDER_OPTIONS, type AgeGroup, type Gender, type ProductListing, type User } from '@reelbazaar/config';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import ChatModal from '../components/ChatModal';
import { NavigationArrows } from '../components/NavigationArrows';
import { storage } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

type AnyGender = Gender | 'Any';
type AnyAge = AgeGroup | 'Any';

export default function InfluencerSearchPage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [gender, setGender] = useState<AnyGender>('Any');
  const [ageGroup, setAgeGroup] = useState<AnyAge>('Any');
  const [productName, setProductName] = useState('');
  const [productLink, setProductLink] = useState('');
  const [listings, setListings] = useState<ProductListing[]>([]);
  const [matches, setMatches] = useState<InfluencerMatch[]>([]);
  const [activeListing, setActiveListing] = useState<ProductListing | null>(null);
  const [chatInfluencer, setChatInfluencer] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  const isDark = theme !== 'light';

  useEffect(() => {
    if (!user) navigate('/', { replace: true });
  }, [navigate, user]);

  const loadListings = async () => {
    try {
      const response = await collaborationsApi.getProductListings();
      setListings(response.listings);
    } catch (err) {
      console.error('Failed to load product listings:', err);
    }
  };

  useEffect(() => {
    loadListings();
  }, []);

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!imageFile || loading) return;
    setLoading(true);
    try {
      const imageRef = ref(storage, `product-listings/${uuidv4()}-${imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
      await uploadBytes(imageRef, imageFile, { contentType: imageFile.type || 'image/jpeg' });
      const imageUrl = await getDownloadURL(imageRef);
      await collaborationsApi.createProductListing({
        imageUrl,
        gender,
        ageGroup,
        ...(productName.trim() && { productName: productName.trim() }),
        ...(productLink.trim() && { productLink: productLink.trim() }),
      });
      setImageFile(null);
      setPreview('');
      setProductName('');
      setProductLink('');
      await loadListings();
    } catch (err) {
      console.error('Failed to save listing:', err);
    } finally {
      setLoading(false);
    }
  };

  const searchInfluencers = async (listing: ProductListing) => {
    setActiveListing(listing);
    setLoading(true);
    try {
      const response = await collaborationsApi.getInfluencerMatches(listing.id);
      setMatches(response.matches);
    } catch (err) {
      console.error('Failed to search influencers:', err);
      setMatches([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-[100dvh] pb-24 ${isDark ? 'bg-black text-white' : 'bg-[#f6f7fb] text-black'}`}>
      <header className={`sticky top-0 z-10 flex items-center gap-3 border-b px-3 py-3 ${isDark ? 'border-white/10 bg-black' : 'border-black/10 bg-white'}`}>
        <NavigationArrows />
        <h1 className="text-base font-semibold">Find creators</h1>
      </header>

      <main className="mx-auto max-w-xl px-4 py-4">
        <section className={`rounded-lg border p-3 ${isDark ? 'border-white/10 bg-white/5' : 'border-black/10 bg-white'}`}>
          <button type="button" onClick={() => fileInputRef.current?.click()} className={`flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-lg border border-dashed ${isDark ? 'border-white/15 bg-black/30' : 'border-black/15 bg-black/5'}`}>
            {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <span className="text-sm font-semibold">Add product image</span>}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <select value={gender} onChange={(e) => setGender(e.target.value as AnyGender)} className={`rounded-lg border px-3 py-3 text-sm ${isDark ? 'border-white/10 bg-[#1c1c1c] text-white' : 'border-black/10 bg-white text-black'}`}>
              <option value="Any">Any gender</option>
              {GENDER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <select value={ageGroup} onChange={(e) => setAgeGroup(e.target.value as AnyAge)} className={`rounded-lg border px-3 py-3 text-sm ${isDark ? 'border-white/10 bg-[#1c1c1c] text-white' : 'border-black/10 bg-white text-black'}`}>
              <option value="Any">Any age</option>
              {AGE_GROUPS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Product name" className={`mt-2 w-full rounded-lg border px-3 py-3 text-sm ${isDark ? 'border-white/10 bg-[#1c1c1c] text-white placeholder:text-white/35' : 'border-black/10 bg-white text-black placeholder:text-black/35'}`} />
          <input value={productLink} onChange={(e) => setProductLink(e.target.value)} placeholder="Product link" className={`mt-2 w-full rounded-lg border px-3 py-3 text-sm ${isDark ? 'border-white/10 bg-[#1c1c1c] text-white placeholder:text-white/35' : 'border-black/10 bg-white text-black placeholder:text-black/35'}`} />
          <button onClick={handleSave} disabled={!imageFile || loading} className="mt-3 w-full rounded-lg bg-[#0095f6] py-3 text-sm font-bold text-white disabled:opacity-60">
            {loading ? 'Saving...' : 'Save'}
          </button>
        </section>

        <section className="mt-5 space-y-3">
          {listings.map((listing) => (
            <article key={listing.id} className={`overflow-hidden rounded-lg border ${isDark ? 'border-white/10 bg-white/5' : 'border-black/10 bg-white'}`}>
              <img src={listing.imageUrl} alt={listing.productName || 'Product'} className="aspect-[16/10] w-full object-cover" />
              <div className="p-3">
                <p className="text-sm font-bold">{listing.productName || 'Product listing'}</p>
                <p className={`text-xs ${isDark ? 'text-white/50' : 'text-black/50'}`}>{listing.gender} · {listing.ageGroup}</p>
                <button onClick={() => searchInfluencers(listing)} className="mt-3 w-full rounded-lg bg-white text-sm font-bold text-black py-2.5">
                  Search influencers for this listing
                </button>
              </div>
            </article>
          ))}
        </section>

        {activeListing && (
          <section className="mt-5 space-y-3">
            <h2 className="text-sm font-bold">Top influencers</h2>
            {loading && <LoadingSpinner />}
            {!loading && matches.length === 0 && <p className={`text-sm ${isDark ? 'text-white/45' : 'text-black/45'}`}>No influencer matches found yet.</p>}
            {matches.map((match) => (
              <div key={match.influencer.id} className={`flex items-center gap-3 rounded-lg border p-3 ${isDark ? 'border-white/10 bg-white/5' : 'border-black/10 bg-white'}`}>
                <Avatar name={match.influencer.username || match.influencer.name} src={match.influencer.avatarUrl} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">@{match.influencer.username || match.influencer.name}</p>
                  <p className={`truncate text-xs ${isDark ? 'text-white/50' : 'text-black/50'}`}>{match.reason} · {match.score}%</p>
                </div>
                <button onClick={() => setChatInfluencer(match.influencer)} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0095f6] text-white">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h8M8 14h5m8-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              </div>
            ))}
          </section>
        )}
      </main>

      {chatInfluencer && user && activeListing && (
        <ChatModal
          otherUser={chatInfluencer}
          onClose={() => setChatInfluencer(null)}
          dealContext={{ brandId: user.id, influencerId: chatInfluencer.id, productListingId: activeListing.id }}
        />
      )}
    </div>
  );
}
