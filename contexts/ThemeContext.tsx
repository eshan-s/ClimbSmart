/**
 * ThemeContext — provides a reactive color palette that switches between
 * dark and light.  Screens that want themed styles should call `useTheme()`
 * instead of importing `C` from `@/constants/Theme` directly.
 *
 * Existing screens that still import `C` statically will stay dark — that
 * is intentional: only the screens we update to use `useTheme()` adopt the
 * dynamic palette.
 */

import React, { createContext, useCallback, useContext, useState } from 'react';
import { DARK_COLORS, LIGHT_COLORS, type ColorPalette } from '@/constants/Theme';

interface ThemeContextType {
  isDark: boolean;
  colors: ColorPalette;
  /** Call this to toggle the palette immediately (UI-side only).
   *  The caller is responsible for persisting the choice to user_preferences. */
  setDark: (dark: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: true,
  colors: DARK_COLORS,
  setDark: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true);

  const setDark = useCallback((dark: boolean) => {
    setIsDark(dark);
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        isDark,
        colors: isDark ? DARK_COLORS : LIGHT_COLORS,
        setDark,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  return useContext(ThemeContext);
}
