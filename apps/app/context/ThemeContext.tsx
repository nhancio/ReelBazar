import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as SystemUI from 'expo-system-ui';
import { palettes, type Palette, type ThemeName } from '@/theme';
import { store, STORAGE_KEYS } from '@/lib/storage';

interface ThemeContextType {
  theme: ThemeName;
  /** Resolved colour set for the active theme — read this instead of importing `colors`. */
  palette: Palette;
  setTheme: (theme: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Safe to read synchronously: the root layout awaits hydrateStorage() before mounting.
  const [theme, setTheme] = useState<ThemeName>(() =>
    store.getItem(STORAGE_KEYS.theme) === 'light' ? 'light' : 'dark'
  );

  useEffect(() => {
    store.setItem(STORAGE_KEYS.theme, theme);
    // Paints the window background behind the React tree, so rotating the device or
    // over-scrolling never flashes the wrong colour. Replaces the web app's
    // `document.documentElement.setAttribute('data-theme', ...)`.
    void SystemUI.setBackgroundColorAsync(palettes[theme].background).catch(() => {
      // Not supported on every platform/version; purely cosmetic if it fails.
    });
  }, [theme]);

  const value = useMemo(
    () => ({ theme, palette: palettes[theme], setTheme }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
