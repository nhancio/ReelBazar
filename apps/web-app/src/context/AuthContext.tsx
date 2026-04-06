import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '../firebase';
import { setAuthToken, authApi } from '@reelbazaar/api';
import type { User, UserType } from '@reelbazaar/config';
import { getDemoUser } from '../demoData';

const GUEST_MODE_KEY = 'reelbazaar-guest-mode';
const USER_CACHE_KEY = 'reelbazaar-user-cache';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(() => {
    const cached = localStorage.getItem(USER_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  });
  const [loading, setLoading] = useState(true);
  const [guestMode, setGuestMode] = useState<boolean>(() => localStorage.getItem(GUEST_MODE_KEY) === 'true');
  const [authError, setAuthError] = useState<string | null>(null);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const enterGuestMode = useCallback((userType: UserType = 'influencer') => {
    localStorage.setItem(GUEST_MODE_KEY, 'true');
    localStorage.setItem(`${GUEST_MODE_KEY}-role`, userType);
    setGuestMode(true);
    setFirebaseUser(null);
    setAuthToken('demo-token');
    setUser(getDemoUser(userType));
    setLoading(false);
  }, []);

  const exitGuestMode = useCallback(() => {
    localStorage.removeItem(GUEST_MODE_KEY);
    localStorage.removeItem(`${GUEST_MODE_KEY}-role`);
    setGuestMode(false);
  }, []);

  const refreshUser = useCallback(async (fbUserParam?: FirebaseUser | null) => {
    if (guestMode) return;
    const currentFbUser = fbUserParam !== undefined ? fbUserParam : firebaseUser;
    try {
      const { user } = await authApi.getProfile();
      setUser(user);
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
      setAuthError(null);
    } catch (error: any) {
      // Only auto-register if it's a 404 (User not registered)
      const isNotRegistered = error.message?.includes('404') || error.status === 404 || error.message?.includes('not registered');
      
      if (currentFbUser && isNotRegistered) {
        try {
          const { user } = await authApi.register({
            firebaseUid: currentFbUser.uid,
            email: currentFbUser.email,
            name: currentFbUser.displayName || 'User',
          });
          setUser(user);
          localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
          localStorage.removeItem('pending-user-type');
          setAuthError(null);
        } catch (e: any) {
          console.error('Auto-registration failed:', e);
          setAuthError(e.message || 'Failed to create profile. Please try again.');
          setUser(null);
          localStorage.removeItem(USER_CACHE_KEY);
          localStorage.removeItem('pending-user-type');
          await auth.signOut();
        }
      } else if (!currentFbUser) {
        setUser(null);
        localStorage.removeItem(USER_CACHE_KEY);
      }
      // If it's a 500 or network error, keep the cached user for now but log it
    }
  }, [guestMode, firebaseUser]);

  useEffect(() => {
    if (guestMode) {
      const storedRole = (localStorage.getItem(`${GUEST_MODE_KEY}-role`) as UserType | null) || 'influencer';
      setFirebaseUser(null);
      setAuthToken('demo-token');
      setUser(getDemoUser(storedRole));
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        const token = await fbUser.getIdToken();
        setAuthToken(token);
        await refreshUser(fbUser);
      } else {
        setAuthToken(null);
        setUser(null);
        localStorage.removeItem(USER_CACHE_KEY);
      }
      setLoading(false);
    });

    return unsubscribe;
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
      const { user } = await authApi.register({
        firebaseUid: firebaseUser.uid,
        email: data.email || firebaseUser.email,
        name: data.name,
        phone: data.phone,
        gender: data.gender as any,
        dob: data.dob,
        country: data.country,
        websiteLink: data.websiteLink,
        brandName: data.brandName,
        productCategories: data.productCategories as any,
      });
      setUser(user);
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
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
      setLoading(false);
      return;
    }

    await auth.signOut();
    setAuthToken(null);
    setUser(null);
  }, [guestMode]);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        user,
        loading,
        isRegistered: !!user,
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
