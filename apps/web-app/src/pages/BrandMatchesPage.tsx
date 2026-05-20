import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, LoadingSpinner } from '@reelbazaar/ui';
import { collaborationsApi, type BrandMatch } from '@reelbazaar/api';
import { AGE_GROUPS, GENDER_OPTIONS, type AgeGroup, type Gender, type User } from '@reelbazaar/config';
import ChatModal from '../components/ChatModal';
import { NavigationArrows } from '../components/NavigationArrows';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

type AnyGender = Gender | 'Any';
type AnyAge = AgeGroup | 'Any';

export default function BrandMatchesPage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [gender, setGender] = useState<AnyGender>('Any');
  const [ageGroup, setAgeGroup] = useState<AnyAge>('Any');
  const [matches, setMatches] = useState<BrandMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [chatBrand, setChatBrand] = useState<User | null>(null);

  useEffect(() => {
    if (!user) navigate('/', { replace: true });
  }, [navigate, user]);

  const handleSearch = async () => {
    setLoading(true);
    try {
      await collaborationsApi.saveBrandSearch({ gender, ageGroup });
      const response = await collaborationsApi.getBrandMatches();
      setMatches(response.matches);
      setSearched(true);
    } catch (err) {
      console.error('Failed to search brands:', err);
    } finally {
      setLoading(false);
    }
  };

  const isDark = theme !== 'light';

  return (
    <div className={`min-h-[100dvh] pb-24 ${isDark ? 'bg-black text-white' : 'bg-[#f6f7fb] text-black'}`}>
      <header className={`sticky top-0 z-10 flex items-center gap-3 border-b px-3 py-3 ${isDark ? 'border-white/10 bg-black' : 'border-black/10 bg-white'}`}>
        <NavigationArrows />
        <h1 className="text-base font-semibold">Find brands</h1>
      </header>

      <main className="mx-auto max-w-xl px-4 py-4">
        <section className="space-y-3">
          <label className="block">
            <span className={`mb-1.5 block text-xs font-semibold uppercase ${isDark ? 'text-white/45' : 'text-black/45'}`}>Gender</span>
            <select value={gender} onChange={(e) => setGender(e.target.value as AnyGender)} className={`w-full rounded-lg border px-3 py-3 text-sm ${isDark ? 'border-white/10 bg-[#1c1c1c] text-white' : 'border-black/10 bg-white text-black'}`}>
              <option value="Any">Any</option>
              {GENDER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={`mb-1.5 block text-xs font-semibold uppercase ${isDark ? 'text-white/45' : 'text-black/45'}`}>Age</span>
            <select value={ageGroup} onChange={(e) => setAgeGroup(e.target.value as AnyAge)} className={`w-full rounded-lg border px-3 py-3 text-sm ${isDark ? 'border-white/10 bg-[#1c1c1c] text-white' : 'border-black/10 bg-white text-black'}`}>
              <option value="Any">Any</option>
              {AGE_GROUPS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <button onClick={handleSearch} disabled={loading} className="w-full rounded-lg bg-[#0095f6] py-3 text-sm font-bold text-white disabled:opacity-60">
            {loading ? 'Searching...' : 'Search'}
          </button>
        </section>

        <section className="mt-5 space-y-3">
          {loading && <LoadingSpinner />}
          {!loading && searched && matches.length === 0 && (
            <p className={`py-10 text-center text-sm ${isDark ? 'text-white/45' : 'text-black/45'}`}>No brand matches found yet.</p>
          )}
          {matches.map((match) => {
            const product = match.products[0];
            return (
              <article key={match.brand.id} className={`overflow-hidden rounded-lg border ${isDark ? 'border-white/10 bg-white/5' : 'border-black/10 bg-white'}`}>
                <button type="button" onClick={() => navigate(`/profile/${match.brand.id}`)} className="block w-full text-left">
                  <div className={`aspect-[16/10] ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
                    {product?.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name || match.brand.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Avatar name={match.brand.brandName || match.brand.name} src={match.brand.avatarUrl} size="lg" />
                      </div>
                    )}
                  </div>
                </button>
                <div className="flex items-center gap-3 p-3">
                  <Avatar name={match.brand.brandName || match.brand.name} src={match.brand.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{match.brand.brandName || match.brand.name}</p>
                    <p className={`truncate text-xs ${isDark ? 'text-white/50' : 'text-black/50'}`}>{match.reason} · {match.score}%</p>
                  </div>
                  <button onClick={() => setChatBrand(match.brand)} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0095f6] text-white">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h8M8 14h5m8-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      </main>

      {chatBrand && user && (
        <ChatModal
          otherUser={chatBrand}
          onClose={() => setChatBrand(null)}
          dealContext={{ brandId: chatBrand.id, influencerId: user.id }}
        />
      )}
    </div>
  );
}
