// Native has no popup or redirect: the Google SDK returns an ID token in-process, which is
// then exchanged for a Firebase credential.
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from './firebase';

let configured = false;

function configure() {
  if (configured) return;
  GoogleSignin.configure({
    // The WEB client id is correct here on both platforms — it is the audience Firebase
    // validates the ID token against. The iOS/Android client ids are only used by the
    // native SDKs themselves and are wired through google-services.json / Info.plist.
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });
  configured = true;
}

export async function signInWithGoogle(): Promise<void> {
  configure();
  await GoogleSignin.hasPlayServices();
  const result = await GoogleSignin.signIn();
  const idToken = result.data?.idToken;
  if (!idToken) throw new Error('Google sign-in returned no ID token.');
  await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
}
