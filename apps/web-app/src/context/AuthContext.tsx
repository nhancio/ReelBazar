import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { setAuthToken } from '@reelbazaar/api';
import type { User, UserType } from '@reelbazaar/config';
import { getDemoUser } from '../demoData';

const GUEST_MODE_KEY = 'reelbazaar-guest-mode';
const USER_CACHE_KEY = 'reelbazaar-user-cache';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  user: User | null;
  loading: boolean;
  isRegistered: boolean;
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
    
    if (!currentFbUser) {
      setUser(null);
      localStorage.removeItem(USER_CACHE_KEY);
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', currentFbUser.uid));
      
      if (userDoc.exists()) {
        const userData = { id: userDoc.id, ...userDoc.data() } as User;
        setUser(userData);
        localStorage.setItem(USER_CACHE_KEY, JSON.stringify(userData));
        setAuthError(null);
      } else {
        // Auto-register
        const newUser: User = {
          id: currentFbUser.uid,
          firebaseUid: currentFbUser.uid,
          email: currentFbUser.email,
          name: currentFbUser.displayName || 'User',
          userType: 'viewer', // Default type
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        await setDoc(doc(db, 'users', currentFbUser.uid), {
          ...newUser,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        
        setUser(newUser);
        localStorage.setItem(USER_CACHE_KEY, JSON.stringify(newUser));
        setAuthError(null);
      }
    } catch (error: any) {
      console.error('Error refreshing user from Firestore:', error);
      setAuthError('Failed to load profile.');
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
      
      const userType = (localStorage.getItem('pending-user-type') as UserType) || 'viewer';
      
      const userData: Partial<User> = {
        name: data.name,
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
