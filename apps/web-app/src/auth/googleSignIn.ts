import type { Auth } from 'firebase/auth';
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect } from 'firebase/auth';

const OAUTH_REDIRECT_PENDING_KEY = 'reelbazaar-oauth-redirect-pending';

function markRedirectPending() {
  try {
    localStorage.setItem(OAUTH_REDIRECT_PENDING_KEY, 'true');
  } catch {
    // Ignore storage errors; auth flow should still proceed.
  }
}

function prefersRedirectFlow(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // Redirect is more reliable in in-app browsers/webviews.
  // For regular mobile browsers, popup-first usually provides a cleaner flow.
  return /Instagram|FBAN|FBAV|Line\/|wv\)|; wv|WebView/i.test(ua);
}

/**
 * Use popup for desktop localhost/dev, redirect for iOS/in-app browsers.
 * Popup failures fallback to redirect.
 */
export async function signInWithGoogle(auth: Auth): Promise<void> {
  const provider = new GoogleAuthProvider();
  if (prefersRedirectFlow()) {
    markRedirectPending();
    await signInWithRedirect(auth, provider);
    return;
  }
  try {
    await signInWithPopup(auth, provider);
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/cancelled-popup-request' ||
      code === 'auth/operation-not-supported-in-this-environment'
    ) {
      markRedirectPending();
      await signInWithRedirect(auth, provider);
      return;
    }
    throw e;
  }
}
