import React, { useEffect, useMemo, useState } from 'react';
import { APP_NAME, PERSONAS, type User, type Persona } from '@reelbazaar/config';
import { useAuth } from '../context/AuthContext';
import { Button } from '@reelbazaar/ui';
import { authApi } from '@reelbazaar/api';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { agentDebugLog } from '../debug/agentDebugLog';

const OPTIONS = ['Electronics', 'Fashion', 'Beauty', 'Lifestyle'];

const PERSONA_INFO: Record<Persona, { icon: string; desc: string }> = {
  Creator: { icon: '🎬', desc: 'Create reels & grow your audience' },
  Brand: { icon: '🏢', desc: 'Showcase products & find creators' },
  User: { icon: '👤', desc: 'Discover & shop trending products' },
};

function isProfileComplete(user: User): boolean {
  const interests = user.interests?.length ? user.interests : user.productCategories || [];
  const usernameOk = Boolean(user.username?.trim());
  return usernameOk && interests.length > 0;
}

export default function OnboardingModal() {
  const { user, guestMode, refreshUser, firebaseUser, isNewUser } = useAuth();
  const existingInterests = useMemo(
    () => user?.interests?.length ? user.interests : user?.productCategories || [],
    [user?.interests, user?.productCategories]
  );

  // First visit: collect username + categories. Returning users (doc has both) go straight to the app.
  const shouldShow = Boolean(
    user && firebaseUser && !guestMode && !isProfileComplete(user)
  );

  const [username, setUsername] = useState(user?.username || (user?.name ? user.name.replace(/\s+/g, '').toLowerCase() : ''));
  const [selectedPersona, setSelectedPersona] = useState<Persona>(user?.persona || 'Creator');
  const [selectedInterests, setSelectedInterests] = useState<string[]>(existingInterests);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!shouldShow || !user) return;
    setUsername(user.username || (user.name ? user.name.replace(/\s+/g, '').toLowerCase() : ''));
    setSelectedInterests(existingInterests);
    if (user.persona) setSelectedPersona(user.persona);
  }, [shouldShow, user?.id]);

  useEffect(() => {
    if (!user) return;
      console.info('[onboarding] render', {
        shouldShow,
        isNewUser,
        profileComplete: user ? isProfileComplete(user) : null,
        userId: user.id,
        username: user.username,
        interests: user.interests,
      productCategories: user.productCategories,
      localSelectedInterests: selectedInterests,
      guestMode,
    });
  }, [guestMode, isNewUser, selectedInterests, shouldShow, user]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('rb:overlay-playback', { detail: { blocked: shouldShow } }));
    return () => {
      window.dispatchEvent(new CustomEvent('rb:overlay-playback', { detail: { blocked: false } }));
    };
  }, [shouldShow]);

  if (!shouldShow) return null;

  const toggleInterest = (e: React.MouseEvent, interest: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedInterests(current => {
      const exists = current.includes(interest);
      const next = exists ? current.filter(i => i !== interest) : [...current, interest];
      console.info('[onboarding] toggleInterest', { interest, next });
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.info('[onboarding] submit:start', { username, selectedInterests, firebaseUid: firebaseUser?.uid });
    if (!username.trim() || selectedInterests.length === 0 || !firebaseUser) return;
    
    setLoading(true);
    try {
      // #region agent log
      agentDebugLog({
        runId: 'post-fix',
        hypothesisId: 'H4',
        location: 'OnboardingModal.tsx:handleSubmit:beforePayload',
        message: 'submit context',
        data: {
          usernameLen: username.trim().length,
          interestsCount: selectedInterests.length,
          hasFirebaseUser: !!firebaseUser,
          isNewUser,
        },
      });
      // #endregion
      const sanitizedUsername = username.toLowerCase().replace(/\s+/g, '');
      const payload = {
        username: sanitizedUsername,
        name: sanitizedUsername,
        interests: selectedInterests,
        productCategories: selectedInterests,
        persona: selectedPersona,
        updatedAt: new Date().toISOString()
      };

      console.info('[onboarding] submit:backendAttempt', payload);
      // #region agent log
      agentDebugLog({
        runId: 'post-fix',
        hypothesisId: 'H1',
        location: 'OnboardingModal.tsx:handleSubmit:beforeUpdateProfile',
        message: 'calling PATCH /auth/me',
        data: { nameLen: payload.name.length, usernameLen: payload.username.length },
      });
      // #endregion
      let backendResponse: Awaited<ReturnType<typeof authApi.updateProfile>>;
      try {
        backendResponse = await authApi.updateProfile({
          username: payload.username,
          name: payload.name,
          interests: payload.interests,
          productCategories: payload.productCategories,
          persona: payload.persona,
        });
      } catch (apiErr: unknown) {
        const msg = apiErr instanceof Error ? apiErr.message : String(apiErr);
        if (!msg.includes('User not registered')) throw apiErr;
        // #region agent log
        agentDebugLog({
          runId: 'post-fix',
          hypothesisId: 'H1',
          location: 'OnboardingModal.tsx:handleSubmit:registerFallback',
          message: 'PATCH 403 — registering user on API',
          data: {},
        });
        // #endregion
        backendResponse = await authApi.register({
          firebaseUid: firebaseUser.uid,
          email: firebaseUser.email ?? null,
          name: payload.name,
          username: payload.username,
          interests: payload.interests,
          productCategories: payload.productCategories,
          persona: payload.persona,
        });
      }
      console.info('[onboarding] submit:backendSuccess', backendResponse);
      // #region agent log
      agentDebugLog({
        runId: 'post-fix',
        hypothesisId: 'H1',
        location: 'OnboardingModal.tsx:handleSubmit:backendOk',
        message: 'backend profile sync succeeded',
        data: {},
      });
      // #endregion

      await setDoc(doc(db, 'users', firebaseUser.uid), payload, { merge: true });
      const userSnapshot = await getDoc(doc(db, 'users', firebaseUser.uid));
      console.info('[onboarding] submit:firestoreVerification', {
        exists: userSnapshot.exists(),
        data: userSnapshot.exists() ? userSnapshot.data() : null,
      });

      if (user) {
        localStorage.setItem('reelbazaar-user-cache', JSON.stringify({
          ...user,
          ...payload,
        }));
      }

      await refreshUser();
      console.info('[onboarding] submit:refreshUserComplete');
    } catch (err: any) {
      // #region agent log
      agentDebugLog({
        runId: 'post-fix',
        hypothesisId: 'H2',
        location: 'OnboardingModal.tsx:handleSubmit:catch',
        message: 'submit error',
        data: {
          errMessage: String(err?.message || '').slice(0, 300),
          errName: err?.name,
        },
      });
      // #endregion
      console.warn('[onboarding] submit:firestoreError', {
        code: err?.code,
        message: err?.message,
        stack: err?.stack,
      });
      if (user) {
        const fallbackUser = {
          ...user,
          username: username.toLowerCase().replace(/\s+/g, ''),
          name: username.toLowerCase().replace(/\s+/g, ''),
          interests: selectedInterests,
          productCategories: selectedInterests,
        };
        localStorage.setItem('reelbazaar-user-cache', JSON.stringify(fallbackUser));
        await refreshUser(firebaseUser);
        console.info('[onboarding] submit:fallbackLocalCacheApplied');
      }
    } finally {
      setLoading(false);
    }
  };

  const selectionRequired = selectedInterests.length === 0;

  return (
    <div data-rb-onboarding-open="true" className="fixed inset-0 z-[100] flex items-center justify-center bg-black px-4" onClick={(e) => e.stopPropagation()}>
      <div className="w-full max-w-sm rounded-[32px] bg-[#121212] border border-white/10 p-8 animate-in zoom-in-95 duration-200 shadow-2xl">
        <h2 className="text-2xl font-bold text-white mb-2">Welcome to {APP_NAME}! 👋</h2>
        <p className="text-sm text-white/50 mb-8">Let's set up your profile quickly.</p>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-white/40 mb-2 ml-1">Username</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s+/g, '').toLowerCase())}
              placeholder="e.g. fashionguru"
              className="w-full rounded-2xl bg-white/5 border border-white/10 px-5 py-4 text-white text-lg placeholder:text-white/20 focus:border-blue-500/50 focus:bg-white/10 focus:outline-none transition-all"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-white/40 mb-3 ml-1">Select your persona</label>
            <div className="flex flex-col gap-2">
              {PERSONAS.map((p) => {
                const isSelected = selectedPersona === p;
                const info = PERSONA_INFO[p];
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedPersona(p); }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all border-2 ${
                      isSelected
                        ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500 shadow-lg shadow-purple-500/10'
                        : 'bg-white/5 border-white/5 hover:border-white/20'
                    }`}
                  >
                    <span className="text-2xl">{info.icon}</span>
                    <div className="flex-1">
                      <p className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-white/70'}`}>{p}</p>
                      <p className={`text-xs ${isSelected ? 'text-white/60' : 'text-white/40'}`}>{info.desc}</p>
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
            <label className="block text-xs font-bold uppercase tracking-wider text-white/40 mb-3 ml-1">What are you interested in?</label>
            <div className="flex flex-wrap gap-3">
              {OPTIONS.map(opt => {
                const isSelected = selectedInterests.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={(e) => toggleInterest(e, opt)}
                    className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all border-2 ${
                      isSelected
                        ? 'bg-white text-black border-white scale-105 shadow-lg shadow-white/10'
                        : 'bg-white/5 text-white/60 border-white/5 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            {selectionRequired && (
              <p className="text-red-400 text-xs mt-3 ml-1">Please select at least one interest.</p>
            )}
          </div>

          <Button 
            type="submit" 
            fullWidth 
            loading={loading}
            disabled={!username.trim() || selectionRequired}
            className="mt-4 h-14 text-base"
          >
            Save & Continue
          </Button>
        </form>
      </div>
    </div>
  );
}
