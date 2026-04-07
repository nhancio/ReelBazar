import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User as FirebaseUser } from 'firebase/auth';
import { Button } from '@reelbazaar/ui';
import { authApi } from '@reelbazaar/api';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const OPTIONS = ['Electronics', 'Fashion', 'Beauty', 'Lifestyle'];

/** Server sync is best-effort; Firestore is the source of truth for the client after onboarding. */
async function syncProfileToBackend(
  firebaseUser: FirebaseUser,
  payload: {
    username: string;
    name: string;
    interests: string[];
    productCategories: string[];
  }
) {
  try {
    await authApi.updateProfile({
      username: payload.username,
      name: payload.name,
      interests: payload.interests,
      productCategories: payload.productCategories,
    });
  } catch (apiErr: unknown) {
    const msg = apiErr instanceof Error ? apiErr.message : String(apiErr);
    if (!msg.includes('User not registered')) throw apiErr;
    await authApi.register({
      firebaseUid: firebaseUser.uid,
      email: firebaseUser.email ?? null,
      name: payload.name,
      username: payload.username,
      interests: payload.interests,
      productCategories: payload.productCategories,
    });
  }
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, firebaseUser, guestMode, refreshUser } = useAuth();
  const { theme } = useTheme();

  const existingInterests = useMemo(
    () => (user?.interests?.length ? user.interests : user?.productCategories || []),
    [user?.interests, user?.productCategories]
  );

  const [username, setUsername] = useState(
    user?.username || (user?.name ? user.name.replace(/\s+/g, '').toLowerCase() : '')
  );
  const [selectedInterests, setSelectedInterests] = useState<string[]>(existingInterests);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!user) return;
    setUsername(user.username || (user.name ? user.name.replace(/\s+/g, '').toLowerCase() : ''));
    setSelectedInterests(existingInterests);
  }, [user?.id]);

  useEffect(() => {
    if (!firebaseUser && !guestMode) navigate('/', { replace: true });
  }, [firebaseUser, guestMode, navigate]);

  const toggleInterest = (interest: string) => {
    setSelectedInterests((current) =>
      current.includes(interest) ? current.filter((i) => i !== interest) : [...current, interest]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setError('');
    if (!username.trim() || selectedInterests.length === 0 || !firebaseUser) return;

    setLoading(true);
    try {
      const sanitizedUsername = username.toLowerCase().replace(/\s+/g, '');
      const payload = {
        username: sanitizedUsername,
        name: sanitizedUsername,
        interests: selectedInterests,
        productCategories: selectedInterests,
        updatedAt: new Date().toISOString(),
      };

      // 1) Firestore first — completes on-device; no hung cross-origin fetch.
      await setDoc(doc(db, 'users', firebaseUser.uid), payload, { merge: true });
      await refreshUser(firebaseUser);
      navigate('/', { replace: true });

      // 2) Vercel API in background (optional for other clients / server logic)
      void syncProfileToBackend(firebaseUser, payload).catch((err) => {
        console.warn('[onboarding] backend sync failed (profile saved in app):', err);
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectionRequired = selectedInterests.length === 0;
  const showSelectionError = submitted && selectionRequired;

  return (
    <div className={`min-h-[100dvh] w-full px-4 py-8 flex items-center justify-center ${theme === 'light' ? 'bg-[#f6f7fb]' : 'bg-black'}`}>
      <div className={`w-full max-w-sm rounded-[32px] p-8 shadow-2xl ${theme === 'light' ? 'bg-white border border-black/10 text-black' : 'bg-[#121212] border border-white/10 text-white'}`}>
        <h2 className="text-2xl font-bold mb-2">Welcome to ReelBazaar! 👋</h2>
        <p className={`text-sm mb-8 ${theme === 'light' ? 'text-black/60' : 'text-white/50'}`}>Let's set up your profile quickly.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ml-1 ${theme === 'light' ? 'text-black/50' : 'text-white/40'}`}>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s+/g, '').toLowerCase())}
              placeholder="e.g. fashionguru"
              className={`w-full rounded-2xl px-5 py-4 text-lg focus:outline-none transition-all ${
                theme === 'light'
                  ? 'bg-black/5 border border-black/10 text-black placeholder:text-black/30 focus:border-blue-500/50'
                  : 'bg-white/5 border border-white/10 text-white placeholder:text-white/20 focus:border-blue-500/50 focus:bg-white/10'
              }`}
              required
              autoFocus
            />
          </div>

          <div>
            <label className={`block text-xs font-bold uppercase tracking-wider mb-3 ml-1 ${theme === 'light' ? 'text-black/50' : 'text-white/40'}`}>What are you interested in?</label>
            <div className="flex flex-wrap gap-3">
              {OPTIONS.map((opt) => {
                const isSelected = selectedInterests.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggleInterest(opt)}
                    className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all border-2 ${
                      isSelected
                        ? 'bg-white text-black border-white scale-105 shadow-lg shadow-white/10'
                        : theme === 'light'
                          ? 'bg-black/5 text-black/70 border-black/10 hover:border-black/30 hover:text-black'
                          : 'bg-white/5 text-white/60 border-white/5 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            {showSelectionError && <p className="text-red-400 text-xs mt-3 ml-1">Please select at least one interest.</p>}
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <Button type="submit" fullWidth loading={loading} disabled={!username.trim()} className="mt-4 h-14 text-base">
            Save & Continue
          </Button>
        </form>
      </div>
    </div>
  );
}

