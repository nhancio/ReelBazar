/**
 * Synchronous key/value store backed by AsyncStorage.
 *
 * Why this exists: the web app read `localStorage` synchronously inside `useState`
 * initialisers (cached user, guest mode, theme preference). AsyncStorage is async, so a
 * direct swap would have meant rewriting every one of those call sites into an effect and
 * accepting a frame of wrong state on every launch.
 *
 * Instead the whole namespace is hydrated into an in-memory Map once at boot — the root
 * layout awaits `hydrateStorage()` before rendering anything — after which reads are
 * synchronous and writes are fire-and-forget. Same ergonomics as localStorage, and it
 * behaves identically on web (where AsyncStorage is localStorage under the hood).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Every key this app owns is namespaced, so hydration can filter cheaply. */
const NAMESPACE = 'reelbazaar-';
/** Not namespaced in the original web app; carried over verbatim to keep parity. */
const EXTRA_KEYS = ['pending-user-type'];

const cache = new Map<string, string>();
let hydrated = false;
let hydration: Promise<void> | null = null;

function isOwnedKey(key: string): boolean {
  return key.startsWith(NAMESPACE) || EXTRA_KEYS.includes(key);
}

/**
 * Load persisted values into memory. Idempotent, and safe to call concurrently — every
 * caller shares the same in-flight promise.
 */
export function hydrateStorage(): Promise<void> {
  if (hydrated) return Promise.resolve();
  if (hydration) return hydration;

  hydration = (async () => {
    try {
      const keys = (await AsyncStorage.getAllKeys()).filter(isOwnedKey);
      if (keys.length) {
        for (const [key, value] of await AsyncStorage.multiGet(keys)) {
          if (value !== null) cache.set(key, value);
        }
      }
    } catch (err) {
      // A failed hydrate must not block launch — the app just starts signed-out and
      // re-persists as the person uses it.
      console.warn('[storage] hydrate failed, continuing with an empty cache', err);
    } finally {
      hydrated = true;
    }
  })();

  return hydration;
}

export const store = {
  getItem(key: string): string | null {
    return cache.has(key) ? (cache.get(key) as string) : null;
  },

  setItem(key: string, value: string): void {
    cache.set(key, value);
    void AsyncStorage.setItem(key, value).catch((err) =>
      console.warn(`[storage] failed to persist "${key}"`, err)
    );
  },

  removeItem(key: string): void {
    cache.delete(key);
    void AsyncStorage.removeItem(key).catch((err) =>
      console.warn(`[storage] failed to remove "${key}"`, err)
    );
  },

  /** Read and JSON.parse in one step, returning null on absent or malformed values. */
  getJSON<T>(key: string): T | null {
    const raw = this.getItem(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // Corrupt entry — drop it rather than crashing on every launch from here on.
      this.removeItem(key);
      return null;
    }
  },

  setJSON(key: string, value: unknown): void {
    this.setItem(key, JSON.stringify(value));
  },
};

/** Storage keys, centralised so a typo can't silently split state across two keys. */
export const STORAGE_KEYS = {
  guestMode: 'reelbazaar-guest-mode',
  guestRole: 'reelbazaar-guest-mode-role',
  userCache: 'reelbazaar-user-cache',
  newUser: 'reelbazaar-new-user',
  theme: 'reelbazaar-theme-preference',
  pendingUserType: 'pending-user-type',
} as const;
