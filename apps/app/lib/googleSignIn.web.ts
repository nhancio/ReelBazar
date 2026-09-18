// Ported from apps/web-app/src/auth/googleSignIn.ts, unchanged.
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { auth } from './firebase';
import { store } from './storage';

const OAUTH_REDIRECT_PENDING_KEY = 'reelbazaar-oauth-redirect-pending';

function prefersRedirectFlow(): boolean {
  if (typeof navigator === 'undefined') return false;
  // Redirect is more reliable in in-app browsers/webviews; popup is cleaner elsewhere.
  return /Instagram|FBAN|FBAV|Line\/|wv\)|; wv|WebView/i.test(navigator.userAgent);
}

export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  if (prefersRedirectFlow()) {
    store.setItem(OAUTH_REDIRECT_PENDING_KEY, 'true');
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
      store.setItem(OAUTH_REDIRECT_PENDING_KEY, 'true');
      await signInWithRedirect(auth, provider);
      return;
    }
    throw e;
  }
}
