import { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../context/AuthContext';

export default function AuthPage() {
  const { enterGuestMode, authError, clearAuthError } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError('');
    clearAuthError();
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed');
      setLoading(false);
    }
  };

  const displayError = error || authError;

  return (
    <div className="flex flex-col min-h-[100dvh] w-full bg-white items-center px-6">
      <div className="flex-1 flex flex-col justify-center w-full max-w-[340px] pb-20 pt-12">
        <div className="flex flex-col items-center mb-16 text-center">
          <div className="mb-6 h-20 w-20 bg-gradient-to-tr from-[#f6bedf] via-[#90b5ff] to-[#6c8aea] rounded-3xl flex items-center justify-center shadow-[0_20px_40px_rgba(144,181,255,0.3)]">
            <span className="text-white text-4xl font-bold font-serif italic">R</span>
          </div>
          <h1 className="text-4xl font-bold text-black tracking-tight" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
            ReelBazaar
          </h1>
          <p className="mt-3 text-[16px] text-gray-400 font-semibold tracking-wide uppercase">scroll · tap · shop</p>
        </div>

        {displayError && (
          <div className="mb-8 p-4 rounded-2xl bg-red-50 text-center text-[13px] text-red-600 border border-red-100 animate-in fade-in slide-in-from-top-4 duration-300">
            {displayError}
          </div>
        )}

        <div className="space-y-6 w-full">
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className={`w-full flex items-center justify-center gap-3 rounded-2xl bg-black py-5 text-[16px] font-bold text-white transition-all hover:bg-gray-900 active:scale-95 shadow-xl shadow-black/10 ${loading ? 'opacity-70' : ''}`}
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <>
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </>
            )}
          </button>

          <button
            type="button"
            className="w-full flex items-center justify-center gap-3 rounded-2xl bg-white border border-gray-200 py-5 text-[16px] font-bold text-black transition-all hover:bg-gray-50 active:scale-95 shadow-xl shadow-black/5"
            onClick={() => enterGuestMode()}
          >
            Guest Mode
          </button>
        </div>
      </div>

      <div className="py-8 w-full text-center mt-auto">
        <p className="text-[12px] text-gray-400 font-medium">
          By continuing, you agree to our <span className="text-gray-900 underline">Terms of Service</span>
        </p>
      </div>
    </div>
  );
}
