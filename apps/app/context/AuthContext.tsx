/**
 * Ported from apps/web-app/src/context/AuthContext.tsx.
 *
 * Behaviour is deliberately identical — same auto-registration, same guest mode, same
 * cached-user fallback. Three things changed for the port:
 *   1. `localStorage` -> the synchronous AsyncStorage-backed `store` (see lib/storage.ts).
 *   2. `getRedirectResult` is web-only. Native never does an OAuth *redirect*; Google
 *      Sign-In returns a credential in-process, so that whole branch is skipped there.
 *   3. The web-only `agentDebugLog` instrumentation was dropped.
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { setAuthToken, streaksApi } from '@reelbazaar/api';
import type { User, UserType } from '@reelbazaar/config';
import { auth, authPersistenceReady, db } from '@/lib/firebase';
import { store, STORAGE_KEYS } from '@/lib/storage';

const OAUTH_REDIRECT_PENDING_KEY = 'reelbazaar-oauth-redirect-pending';

const clearOauthPending = () => store.removeItem(OAUTH_REDIRECT_PENDING_KEY);

export interface RegisterData {
  name: string;
  email?: string | null;
  phone?: string;
  gender?: string;
  dob?: string;
  country?: string;
  websiteLink?: string;
  brandName?: string;
  productCategories?: string[];
}

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  user: User | null;
  loading: boolean;
  isRegistered: boolean;
  isNewUser: boolean;
  guestMode: boolean;
  authError: string | null;
  register: (data: RegisterData) => Promise<void>;
  refreshUser: (fbUserParam?: FirebaseUser | null) => Promise<void>;
  signOut: () => Promise<void>;
  enterGuestMode: (userType?: UserType) => void;
  exitGuestMode: () => void;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function usernameFrom(name: string | null | undefined, fallback = 'user'): string {
  return (name || fallback).replace(/\s+/g, '').toLowerCase();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(() => store.getJSON<User>(STORAGE_KEYS.userCache));
  const [loading, setLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState<boolean>(
    () => store.getItem(STORAGE_KEYS.newUser) === 'true'
  );
  const [guestMode, setGuestMode] = useState<boolean>(() => {
    if (auth.currentUser) {
      store.removeItem(STORAGE_KEYS.guestMode);
      store.removeItem(STORAGE_KEYS.guestRole);
      return false;
    }
    return store.getItem(STORAGE_KEYS.guestMode) === 'true';
  });
  const [authError, setAuthError] = useState<string | null>(null);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const enterGuestMode = useCallback((userType: UserType = 'influencer') => {
    store.setItem(STORAGE_KEYS.guestMode, 'true');
    store.setItem(STORAGE_KEYS.guestRole, userType);
    setGuestMode(true);
    setFirebaseUser(null);
    setAuthToken(null);
    setUser(null);
    setLoading(false);
  }, []);

  const exitGuestMode = useCallback(() => {
    store.removeItem(STORAGE_KEYS.guestMode);
    store.removeItem(STORAGE_KEYS.guestRole);
    setGuestMode(false);
  }, []);

  const refreshUser = useCallback(
    async (fbUserParam?: FirebaseUser | null) => {
      if (guestMode) return;
      const currentFbUser = fbUserParam !== undefined ? fbUserParam : auth.currentUser;

      if (!currentFbUser) {
        setUser(null);
        setIsNewUser(false);
        store.removeItem(STORAGE_KEYS.userCache);
        store.removeItem(STORAGE_KEYS.newUser);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', currentFbUser.uid));

        if (userDoc.exists()) {
          const rawData = userDoc.data();
          const normalizedInterests = (rawData.interests as string[] | undefined)?.length
            ? (rawData.interests as string[])
            : (rawData.productCategories as string[] | undefined) || [];

          const userData = {
            id: userDoc.id,
            ...rawData,
            username:
              (rawData.username as string | undefined) ||
              usernameFrom(rawData.name as string | undefined),
            interests: normalizedInterests,
            avatarUrl: (rawData.avatarUrl as string | null | undefined) || currentFbUser.photoURL,
          } as User;

          setIsNewUser(false);
          store.setItem(STORAGE_KEYS.newUser, 'false');
          setUser(userData);
          store.setJSON(STORAGE_KEYS.userCache, userData);
          setAuthError(null);

          // Fire-and-forget streak check-in on every login.
          streaksApi
            .checkin()
            .then((result) => {
              setUser((prev) =>
                prev
                  ? {
                      ...prev,
                      streakCount: result.streakCount,
                      longestStreak: result.longestStreak,
                      lastCheckinDate: result.lastCheckinDate,
                    }
                  : prev
              );
            })
            .catch(() => {
              /* non-critical */
            });
        } else {
          // Auto-register: first sign-in with no Firestore profile yet.
          const newUser: User = {
            id: currentFbUser.uid,
            firebaseUid: currentFbUser.uid,
            email: currentFbUser.email,
            name: currentFbUser.displayName || 'User',
            username: usernameFrom(currentFbUser.displayName),
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
          } catch (setErr) {
            console.warn(
              'Could not auto-register user to Firestore (likely rules), continuing locally:',
              setErr
            );
          }

          setIsNewUser(true);
          store.setItem(STORAGE_KEYS.newUser, 'true');
          setUser(newUser);
          store.setJSON(STORAGE_KEYS.userCache, newUser);
          setAuthError(null);
        }
      } catch (error) {
        console.error('Error refreshing user from Firestore:', error);
        setAuthError('Failed to load profile.');

        // Fallback: don't leave them hanging if Firestore fails entirely.
        const fallbackUser: User = {
          id: currentFbUser.uid,
          firebaseUid: currentFbUser.uid,
          email: currentFbUser.email,
          name: currentFbUser.displayName || 'User',
          username: usernameFrom(currentFbUser.displayName),
          avatarUrl: currentFbUser.photoURL,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setUser(fallbackUser);
        setIsNewUser(false);
        store.setItem(STORAGE_KEYS.newUser, 'false');
        store.setJSON(STORAGE_KEYS.userCache, fallbackUser);
      }
    },
    [guestMode]
  );

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

        // Web-only: signInWithRedirect parks the result until the page comes back. Native
        // Google Sign-In hands back a credential in-process, so there is nothing to collect.
        if (Platform.OS === 'web') {
          try {
            const { getRedirectResult } = await import('firebase/auth');
            const redirectResult = await getRedirectResult(auth);
            if (redirectResult?.user) {
              redirectHadUser = true;
              setFirebaseUser(redirectResult.user);
              setAuthToken(await redirectResult.user.getIdToken());
              await refreshUser(redirectResult.user);
              clearOauthPending();
            }
          } catch (e) {
            console.warn('[auth] getRedirectResult', e);
          }
        }

        if (cancelled) return;

        unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
          try {
            setFirebaseUser(fbUser);
            if (fbUser) {
              clearOauthPending();
              setAuthToken(await fbUser.getIdToken());
              await refreshUser(fbUser);
            } else {
              const oauthPending = store.getItem(OAUTH_REDIRECT_PENDING_KEY) === 'true';
              if (oauthPending && !redirectHadUser) {
                // Redirect flow can resolve a moment later on mobile browsers.
                setLoading(true);
                return;
              }
              setAuthToken(null);
              setUser(null);
              setIsNewUser(false);
              store.removeItem(STORAGE_KEYS.userCache);
              store.removeItem(STORAGE_KEYS.newUser);
            }
          } finally {
            if (!cancelled) setLoading(false);
          }
        });

        if (
          Platform.OS === 'web' &&
          !redirectHadUser &&
          store.getItem(OAUTH_REDIRECT_PENDING_KEY) === 'true'
        ) {
          setTimeout(() => {
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
    async (data: RegisterData) => {
      if (!firebaseUser) throw new Error('Not authenticated');

      const userType = (store.getItem(STORAGE_KEYS.pendingUserType) as UserType) || 'viewer';

      const userData: Partial<User> = {
        name: data.name,
        username: usernameFrom(data.name),
        email: data.email || firebaseUser.email,
        phone: data.phone,
        gender: data.gender as User['gender'],
        dob: data.dob,
        country: data.country,
        websiteLink: data.websiteLink,
        brandName: data.brandName,
        productCategories: data.productCategories as User['productCategories'],
        userType,
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'users', firebaseUser.uid), userData, { merge: true });

      const updatedDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (updatedDoc.exists()) {
        const updatedUser = { id: updatedDoc.id, ...updatedDoc.data() } as User;
        setUser(updatedUser);
        store.setJSON(STORAGE_KEYS.userCache, updatedUser);
      }
    },
    [firebaseUser]
  );

  const signOut = useCallback(async () => {
    store.removeItem(STORAGE_KEYS.userCache);
    if (guestMode) {
      store.removeItem(STORAGE_KEYS.guestMode);
      store.removeItem(STORAGE_KEYS.guestRole);
      setGuestMode(false);
      setFirebaseUser(null);
      setAuthToken(null);
      setUser(null);
      setIsNewUser(false);
      setLoading(false);
      store.removeItem(STORAGE_KEYS.newUser);
      return;
    }

    await auth.signOut();
    setAuthToken(null);
    setUser(null);
    setIsNewUser(false);
    store.removeItem(STORAGE_KEYS.newUser);
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
