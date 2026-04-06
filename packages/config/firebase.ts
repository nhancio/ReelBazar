const getEnvVar = (key: string): string | undefined => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    return (import.meta as any).env[key];
  }
  return undefined;
};

export const firebaseConfig = {
  apiKey: getEnvVar('NEXT_PUBLIC_FIREBASE_API_KEY') || getEnvVar('VITE_FIREBASE_API_KEY') || '',
  authDomain: getEnvVar('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN') || getEnvVar('VITE_FIREBASE_AUTH_DOMAIN') || '',
  projectId: getEnvVar('NEXT_PUBLIC_FIREBASE_PROJECT_ID') || getEnvVar('VITE_FIREBASE_PROJECT_ID') || '',
  storageBucket: getEnvVar('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET') || getEnvVar('VITE_FIREBASE_STORAGE_BUCKET') || '',
  messagingSenderId: getEnvVar('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID') || getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID') || '',
  appId: getEnvVar('NEXT_PUBLIC_FIREBASE_APP_ID') || getEnvVar('VITE_FIREBASE_APP_ID') || '',
};
