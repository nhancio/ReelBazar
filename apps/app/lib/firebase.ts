/**
 * Firebase initialisation — single source of truth for app/auth/firestore/storage.
 *
 * This uses the Firebase **web JS SDK** on all three platforms rather than
 * @react-native-firebase. That is the decision that makes this migration cheap: every
 * Firestore/Auth call already written for the Vite app works unchanged on iOS and Android.
 * The only thing that genuinely differs per platform is auth persistence, handled below.
 *
 * The config values here are intentionally client-side. Firebase web config is NOT secret —
 * access is gated by Auth plus the Firestore/Storage security rules, not by hiding these.
 * The Admin service account key is the real secret and lives only in backend/server.
 */
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';
import type { Auth } from 'firebase/auth';
import { getAuth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

/**
 * True only when a real project is configured. The app can still boot for local UI work
 * without these values, but auth, the feed, and uploads all need them.
 */
export const firebaseEnabled = !!firebaseConfig.apiKey && !!firebaseConfig.projectId;

// Reuse the app across Fast Refresh reloads.
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

/**
 * Auth needs platform-specific persistence:
 *  - web    -> default browser (IndexedDB/local) persistence via getAuth
 *  - native -> AsyncStorage via initializeAuth + getReactNativePersistence.
 *    getReactNativePersistence only exists in firebase's react-native bundle, so it is
 *    required lazily inside the native branch to keep the web build clean.
 *
 * Without this, native sign-in appears to work and then silently signs the person out on
 * every cold start.
 */
function makeAuth(): Auth {
  if (Platform.OS === 'web') {
    return getAuth(app);
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { initializeAuth, getReactNativePersistence } = require('firebase/auth');
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // initializeAuth throws if auth was already initialised (e.g. Fast Refresh).
    return getAuth(app);
  }
}

export const auth: Auth = makeAuth();

/**
 * Firestore offline cache.
 *
 * The web app called the deprecated `enableIndexedDbPersistence(db)`. The modern
 * equivalent is a `localCache` passed at init — but persistent cache is IndexedDB-backed
 * and therefore web-only. On native the SDK's in-memory cache is used, which is correct:
 * React Native has no IndexedDB, and passing persistentLocalCache there throws at startup.
 */
function makeFirestore() {
  if (Platform.OS !== 'web') {
    return getFirestore(app);
  }
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    // Already initialised (Fast Refresh), or the browser blocks storage entirely
    // (private mode / disabled cookies). Fall back to the default in-memory instance.
    return getFirestore(app);
  }
}

export const db = makeFirestore();
export const storage = getStorage(app);

/**
 * Kept for source parity with the Vite app, which exported a promise the AuthContext
 * awaited before reading redirect results. Persistence is now configured synchronously at
 * init on both platforms, so this resolves immediately.
 */
export const authPersistenceReady: Promise<void> = Promise.resolve();
