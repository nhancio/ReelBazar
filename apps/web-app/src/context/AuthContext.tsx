import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getRedirectResult, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, authPersistenceReady, db } from '../firebase';
import { setAuthToken } from '@reelbazaar/api';
import type { User, UserType } from '@reelbazaar/config';
import { agentDebugLog } from '../debug/agentDebugLog';

const GUEST_MODE_KEY = 'reelbazaar-guest-mode';
const USER_CACHE_KEY = 'reelbazaar-user-cache';
const NEW_USER_KEY = 'reelbazaar-new-user';
const OAUTH_REDIRECT_PENDING_KEY = 'reelbazaar-oauth-redirect-pending';

const clearOauthPending = () => {
  try {
    localStorage.removeItem(OAUTH_REDIRECT_PENDING_KEY);
  } catch {
    // Ignore storage errors.
  }
};

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  user: User | null;
  loading: boolean;
  isRegistered: boolean;
  isNewUser: boolean;
  guestMode: boolean;
  authError: string | null;
  register: (data: {
    name: string;
    email?: string | null;
    phone?: string;
    gender?: string;
    dob?: string;
    country?: string;
    websiteLink?: string;
    brandName?: string;
    productCategories?: string[];
  }) => Promise<void>;
  refreshUser: (fbUserParam?: FirebaseUser | null) => Promise<void>;
  signOut: () => Promise<void>;
  enterGuestMode: (userType?: UserType) => void;
  exitGuestMode: () => void;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(() => {
    const cached = localStorage.getItem(USER_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  });
  const [loading, setLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState<boolean>(() => localStorage.getItem(NEW_USER_KEY) === 'true');
  const [guestMode, setGuestMode] = useState<boolean>(() => {
    if (auth.currentUser) {
      localStorage.removeItem(GUEST_MODE_KEY);
      localStorage.removeItem(`${GUEST_MODE_KEY}-role`);
      return false;
    }
    return localStorage.getItem(GUEST_MODE_KEY) === 'true';
  });
  const [authError, setAuthError] = useState<string | null>(null);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const enterGuestMode = useCallback((userType: UserType = 'influencer') => {
    localStorage.setItem(GUEST_MODE_KEY, 'true');
    localStorage.setItem(`${GUEST_MODE_KEY}-role`, userType);
    setGuestMode(true);
    setFirebaseUser(null);
    setAuthToken(null);
    setUser(null);
    setLoading(false);
  }, []);

  const exitGuestMode = useCallback(() => {
    localStorage.removeItem(GUEST_MODE_KEY);
    localStorage.removeItem(`${GUEST_MODE_KEY}-role`);
    setGuestMode(false);
  }, []);

  const refreshUser = useCallback(async (fbUserParam?: FirebaseUser | null) => {
    if (guestMode) return;
    const currentFbUser = fbUserParam !== undefined ? fbUserParam : auth.currentUser;
    
    if (!currentFbUser) {
      setUser(null);
      setIsNewUser(false);
      localStorage.removeItem(USER_CACHE_KEY);
      localStorage.removeItem(NEW_USER_KEY);
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', currentFbUser.uid));
      // #region agent log
      agentDebugLog({
        runId: 'post-fix',
        hypothesisId: 'H3',
        location: 'AuthContext.tsx:refreshUser:afterGetDoc',
        message: 'firestore user doc',
        data: { uid: currentFbUser.uid, exists: userDoc.exists(), guestMode },
      });
      // #endregion
      
      if (userDoc.exists()) {
        const rawData = userDoc.data();
        const normalizedInterests =
          (rawData.interests as string[] | undefined)?.length
            ? (rawData.interests as string[])
            : ((rawData.productCategories as string[] | undefined) || []);

        const userData = {
          id: userDoc.id,
          ...rawData,
          username: (rawData.username as string | undefined) || (rawData.name as string | undefined)?.replace(/\s+/g, '').toLowerCase(),
          interests: normalizedInterests,
          avatarUrl: (rawData.avatarUrl as string | null | undefined) || currentFbUser.photoURL,
        } as User;
        console.info('[auth] refreshUser:loaded', {
          userId: userData.id,
          username: userData.username,
          interests: userData.interests,
          productCategories: rawData.productCategories,
        });
        setIsNewUser(false);
        localStorage.setItem(NEW_USER_KEY, 'false');
        setUser(userData);
        localStorage.setItem(USER_CACHE_KEY, JSON.stringify(userData));
        setAuthError(null);
        // #region agent log
        agentDebugLog({
          runId: 'post-fix',
          hypothesisId: 'H4',
          location: 'AuthContext.tsx:refreshUser:docExists',
          message: 'profile loaded',
          data: {
            isNewUserFlag: false,
            username: userData.username,
            interestsLen: (userData.interests || []).length,
          },
        });
        // #endregion
      } else {
        // Auto-register
        const newUser: User = {
          id: currentFbUser.uid,
          firebaseUid: currentFbUser.uid,
          email: currentFbUser.email,
          name: currentFbUser.displayName || 'User',
          username: (currentFbUser.displayName || 'user').replace(/\s+/g, '').toLowerCase(),
          avatarUrl: currentFbUser.photoURL,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        try {
          await setDoc(doc(db, 'users', currentFbUser.uid), {
            ...newUser,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          console.info('[auth] refreshUser:autoRegistered', { userId: currentFbUser.uid });
        } catch (setErr) {
          console.warn('Could not auto-register user to Firestore (likely rules/CORS), continuing locally:', setErr);
        }
        
        setIsNewUser(true);
        localStorage.setItem(NEW_USER_KEY, 'true');
        setUser(newUser);
        localStorage.setItem(USER_CACHE_KEY, JSON.stringify(newUser));
        setAuthError(null);
        // #region agent log
        agentDebugLog({
          runId: 'post-fix',
          hypothesisId: 'H3',
          location: 'AuthContext.tsx:refreshUser:newUserPath',
          message: 'no firestore doc auto-register path',
          data: { uid: currentFbUser.uid, isNewUserFlag: true },
        });
        // #endregion
      }
    } catch (error: any) {
      console.error('Error refreshing user from Firestore:', error);
      setAuthError('Failed to load profile.');
      
      // Fallback: don't leave them hanging if Firestore fails entirely
      const fallbackUser: User = {
        id: currentFbUser.uid,
        firebaseUid: currentFbUser.uid,
        email: currentFbUser.email,
        name: currentFbUser.displayName || 'User',
        username: (currentFbUser.displayName || 'user').replace(/\s+/g, '').toLowerCase(),
        avatarUrl: currentFbUser.photoURL,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setUser(fallbackUser);
      setIsNewUser(false);
      localStorage.setItem(NEW_USER_KEY, 'false');
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(fallbackUser));
      // #region agent log
      agentDebugLog({
        runId: 'post-fix',
        hypothesisId: 'H3',
        location: 'AuthContext.tsx:refreshUser:catch',
        message: 'firestore read failed fallback',
        data: {
          errName: error?.name,
          errMessage: String(error?.message || '').slice(0, 200),
        },
      });
      // #endregion
    }
  }, [guestMode]);

  useEffect(() => {
    if (guestMode && auth.currentUser) {
      exitGuestMode();
    }
  }, [guestMode, exitGuestMode]);

  useEffect(() => {
    if (guestMode) {
      setFirebaseUser(null);
      setAuthToken(null);
      setUser(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const initAuth = async () => {
      setLoading(true);
      try {
        let redirectHadUser = false;
        await authPersistenceReady;
        try {
          const redirectResult = await getRedirectResult(auth);
          if (redirectResult?.user) {
            redirectHadUser = true;
            setFirebaseUser(redirectResult.user);
            const token = await redirectResult.user.getIdToken();
            setAuthToken(token);
            await refreshUser(redirectResult.user);
            clearOauthPending();
          }
        } catch (e) {
          console.warn('[auth] getRedirectResult', e);
        }

        if (cancelled) return;

        unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
          try {
            setFirebaseUser(fbUser);
            if (fbUser) {
              clearOauthPending();
              const token = await fbUser.getIdToken();
              setAuthToken(token);
              await refreshUser(fbUser);
            } else {
              const oauthPending = localStorage.getItem(OAUTH_REDIRECT_PENDING_KEY) === 'true';
              if (oauthPending && !redirectHadUser) {
                // Redirect flow can resolve a moment later on mobile browsers.
                setLoading(true);
                return;
              }
              setAuthToken(null);
              setUser(null);
              setIsNewUser(false);
              localStorage.removeItem(USER_CACHE_KEY);
              localStorage.removeItem(NEW_USER_KEY);
            }
          } finally {
            if (!cancelled) setLoading(false);
          }
        });

        if (!redirectHadUser && localStorage.getItem(OAUTH_REDIRECT_PENDING_KEY) === 'true') {
          window.setTimeout(() => {
            if (cancelled) return;
            if (!auth.currentUser) {
              clearOauthPending();
              setLoading(false);
            }
          }, 6000);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };

    void initAuth();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [guestMode, refreshUser]);

  const register = useCallback(
    async (data: {
      name: string;
      email?: string | null;
      phone?: string;
      gender?: string;
      dob?: string;
      country?: string;
      websiteLink?: string;
      brandName?: string;
      productCategories?: string[];
    }) => {
      if (!firebaseUser) throw new Error('Not authenticated');
      
      const userType = (localStorage.getItem('pending-user-type') as UserType) || 'viewer';
      
      const userData: Partial<User> = {
        name: data.name,
        username: data.name.replace(/\s+/g, '').toLowerCase(),
        email: data.email || firebaseUser.email,
        phone: data.phone,
        gender: data.gender as any,
        dob: data.dob,
        country: data.country,
        websiteLink: data.websiteLink,
        brandName: data.brandName,
        productCategories: data.productCategories as any,
        userType,
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'users', firebaseUser.uid), userData, { merge: true });
      
      const updatedDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (updatedDoc.exists()) {
        const updatedUser = { id: updatedDoc.id, ...updatedDoc.data() } as User;
        setUser(updatedUser);
        localStorage.setItem(USER_CACHE_KEY, JSON.stringify(updatedUser));
      }
    },
    [firebaseUser]
  );

  const signOut = useCallback(async () => {
    localStorage.removeItem(USER_CACHE_KEY);
    if (guestMode) {
      localStorage.removeItem(GUEST_MODE_KEY);
      localStorage.removeItem(`${GUEST_MODE_KEY}-role`);
      setGuestMode(false);
      setFirebaseUser(null);
      setAuthToken(null);
      setUser(null);
      setIsNewUser(false);
      setLoading(false);
      localStorage.removeItem(NEW_USER_KEY);
      return;
    }

    await auth.signOut();
    setAuthToken(null);
    setUser(null);
    setIsNewUser(false);
    localStorage.removeItem(NEW_USER_KEY);
  }, [guestMode]);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        user,
        loading,
        isRegistered: !!user,
        isNewUser,
        guestMode,
        authError,
        register,
        refreshUser,
        signOut,
        enterGuestMode,
        exitGuestMode,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
