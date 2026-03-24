import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const ThemeContext = createContext(null);
const THEME_MODE_KEY = 'rwanda_fda_theme_mode';

export function ThemeProvider({ children }) {
  const [themeMode, setThemeModeState] = useState('system'); // system | light | dark
  const [systemTheme, setSystemTheme] = useState(Appearance.getColorScheme() === 'dark' ? 'dark' : 'light');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(THEME_MODE_KEY);
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setThemeModeState(stored);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemTheme(colorScheme === 'dark' ? 'dark' : 'light');
    });
    return () => sub.remove();
  }, []);

  const setThemeMode = async (mode) => {
    const next = mode === 'light' || mode === 'dark' ? mode : 'system';
    setThemeModeState(next);
    await SecureStore.setItemAsync(THEME_MODE_KEY, next).catch(() => {});
  };

  const resolvedTheme = themeMode === 'system' ? systemTheme : themeMode;

  const value = useMemo(
    () => ({ themeMode, resolvedTheme, isDark: resolvedTheme === 'dark', loading, setThemeMode }),
    [themeMode, resolvedTheme, loading]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      themeMode: 'system',
      resolvedTheme: 'light',
      isDark: false,
      loading: false,
      setThemeMode: async () => {},
    };
  }
  return ctx;
}

