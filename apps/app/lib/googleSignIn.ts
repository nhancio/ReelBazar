// Platform-split: Metro picks .web.ts on web and .native.ts on iOS/Android. This file only
// exists so imports and TypeScript resolve.
export { signInWithGoogle } from './googleSignIn.native';
