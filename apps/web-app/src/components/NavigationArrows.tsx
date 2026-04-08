import { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';

export function NavigationArrows() {
  const { theme } = useTheme();
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  useEffect(() => {
    // Check if navigation is available
    const updateNavState = () => {
      setCanGoBack(window.history.length > 1);
    };

    updateNavState();
    window.addEventListener('popstate', updateNavState);
    return () => window.removeEventListener('popstate', updateNavState);
  }, []);

  const handleGoBack = () => {
    window.history.back();
  };

  const handleGoForward = () => {
    window.history.forward();
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={handleGoBack}
        disabled={!canGoBack}
        className={`p-2 rounded-lg transition-colors ${
          canGoBack
            ? theme === 'light'
              ? 'hover:bg-black/10 text-black'
              : 'hover:bg-white/10 text-white'
            : theme === 'light'
              ? 'text-black/30 cursor-not-allowed'
              : 'text-white/30 cursor-not-allowed'
        }`}
        title="Go back"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        onClick={handleGoForward}
        disabled={!canGoForward}
        className={`p-2 rounded-lg transition-colors ${
          canGoForward
            ? theme === 'light'
              ? 'hover:bg-black/10 text-black'
              : 'hover:bg-white/10 text-white'
            : theme === 'light'
              ? 'text-black/30 cursor-not-allowed'
              : 'text-white/30 cursor-not-allowed'
        }`}
        title="Go forward"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
