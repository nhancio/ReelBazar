import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User as FirebaseUser } from 'firebase/auth';
import { Button } from '@reelbazaar/ui';
import { APP_NAME, PERSONAS, type Persona } from '@reelbazaar/config';
import { authApi } from '@reelbazaar/api';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const OPTIONS = ['Electronics', 'Fashion', 'Beauty', 'Lifestyle'];

const PERSONA_INFO: Record<Persona, { icon: string; desc: string }> = {
  Creator: { icon: '🎬', desc: 'Create reels & grow your audience' },
  Brand: { icon: '🏢', desc: 'Showcase products & find creators' },
  User: { icon: '👤', desc: 'Discover & shop trending products' },
};

async function syncProfileToBackend(
  firebaseUser: FirebaseUser,
  payload: {
    username: string;
    name: string;
    interests: string[];
    productCategories: string[];
    persona: Persona;
  }
) {
  try {
    await authApi.updateProfile({
      username: payload.username,
      name: payload.name,
      interests: payload.interests,
      productCategories: payload.productCategories,
      persona: payload.persona,
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
      persona: payload.persona,
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
  const [selectedPersona, setSelectedPersona] = useState<Persona>(user?.persona || 'Creator');
  const [selectedInterests, setSelectedInterests] = useState<string[]>(existingInterests);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!user) return;
    setUsername(user.username || (user.name ? user.name.replace(/\s+/g, '').toLowerCase() : ''));
    setSelectedInterests(existingInterests);
    if (user.persona) setSelectedPersona(user.persona);
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
        persona: selectedPersona,
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'users', firebaseUser.uid), payload, { merge: true });
      await refreshUser(firebaseUser);
      navigate('/', { replace: true });

      void syncProfileToBackend(firebaseUser, payload).catch((err) => {
        console.warn('[onboarding] backend sync failed (profile saved in app):', err);
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save profile. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const selectionRequired = selectedInterests.length === 0;
  const showSelectionError = submitted && selectionRequired;
  const isDark = theme !== 'light';

  return (
    <div className={`min-h-[100dvh] w-full px-4 py-8 flex items-center justify-center ${isDark ? 'bg-black' : 'bg-[#f6f7fb]'}`}>
      <div className={`w-full max-w-sm rounded-[32px] p-8 shadow-2xl ${isDark ? 'bg-[#121212] border border-white/10 text-white' : 'bg-white border border-black/10 text-black'}`}>
        <h2 className="text-2xl font-bold mb-2">Welcome to {APP_NAME}! 👋</h2>
        <p className={`text-sm mb-8 ${isDark ? 'text-white/50' : 'text-black/60'}`}>Let's set up your profile quickly.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ml-1 ${isDark ? 'text-white/40' : 'text-black/50'}`}>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s+/g, '').toLowerCase())}
              placeholder="e.g. fashionguru"
              className={`w-full rounded-2xl px-5 py-4 text-lg focus:outline-none transition-all ${
                isDark
                  ? 'bg-white/5 border border-white/10 text-white placeholder:text-white/20 focus:border-blue-500/50 focus:bg-white/10'
                  : 'bg-black/5 border border-black/10 text-black placeholder:text-black/30 focus:border-blue-500/50'
              }`}
              required
              autoFocus
            />
          </div>

          <div>
            <label className={`block text-xs font-bold uppercase tracking-wider mb-3 ml-1 ${isDark ? 'text-white/40' : 'text-black/50'}`}>Select your persona</label>
            <div className="flex flex-col gap-2">
              {PERSONAS.map((p) => {
                const isSelected = selectedPersona === p;
                const info = PERSONA_INFO[p];
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setSelectedPersona(p)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all border-2 ${
                      isSelected
                        ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500 shadow-lg shadow-purple-500/10'
                        : isDark
                          ? 'bg-white/5 border-white/5 hover:border-white/20'
                          : 'bg-black/5 border-black/10 hover:border-black/30'
                    }`}
                  >
                    <span className="text-2xl">{info.icon}</span>
                    <div className="flex-1">
                      <p className={`text-sm font-bold ${isSelected ? (isDark ? 'text-white' : 'text-black') : isDark ? 'text-white/70' : 'text-black/70'}`}>{p}</p>
                      <p className={`text-xs ${isSelected ? (isDark ? 'text-white/60' : 'text-black/60') : isDark ? 'text-white/40' : 'text-black/40'}`}>{info.desc}</p>
                    </div>
                    {isSelected && (
                      <svg className="w-5 h-5 text-purple-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className={`block text-xs font-bold uppercase tracking-wider mb-3 ml-1 ${isDark ? 'text-white/40' : 'text-black/50'}`}>What are you interested in?</label>
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
                        : isDark
                          ? 'bg-white/5 text-white/60 border-white/5 hover:border-white/20 hover:text-white'
                          : 'bg-black/5 text-black/70 border-black/10 hover:border-black/30 hover:text-black'
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

