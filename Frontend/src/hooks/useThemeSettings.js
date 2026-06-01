import React from 'react';
import { apiUrl } from '../api/config';
import { BOARD_PRESETS, DARK_THEME, DEFAULT_PIECE_SET, DEFAULT_THEME, LIGHT_THEME, normalizePieceSet } from '../game/constants';

function loadStoredTheme() {
  return DEFAULT_THEME;
}

export function useThemeSettings(authUser) {
  const [theme, setTheme] = React.useState(() => loadStoredTheme());
  const [systemDark, setSystemDark] = React.useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [pieceSet, setPieceSetState] = React.useState(DEFAULT_PIECE_SET);
  const [preferencesReady, setPreferencesReady] = React.useState(false);
  const themeSaveTimerRef = React.useRef(null);

  const appearance = ['system', 'dark', 'light', 'custom'].includes(theme.appearance) ? theme.appearance : 'custom';
  const colorScheme = appearance === 'system' ? (systemDark ? 'dark' : 'light') : appearance === 'light' ? 'light' : 'dark';
  const palette = appearance === 'custom'
    ? theme
    : colorScheme === 'dark'
      ? DARK_THEME
      : LIGHT_THEME;
  const resolvedTheme = { ...theme, ...palette, appearance };
  const themeStyle = {
    '--accent': resolvedTheme.accent,
    '--light-square': resolvedTheme.lightSquare,
    '--dark-square': resolvedTheme.darkSquare,
    '--surface': resolvedTheme.surface,
    '--page': resolvedTheme.page,
    colorScheme
  };

  React.useEffect(() => {
    const preference = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!preference) return undefined;
    const updateSystemTheme = (event) => setSystemDark(event.matches);
    preference.addEventListener('change', updateSystemTheme);
    return () => preference.removeEventListener('change', updateSystemTheme);
  }, []);

  React.useEffect(() => {
    const root = document.documentElement;
    root.dataset.colorScheme = colorScheme;
    root.style.setProperty('--accent', resolvedTheme.accent);
    root.style.setProperty('--light-square', resolvedTheme.lightSquare);
    root.style.setProperty('--dark-square', resolvedTheme.darkSquare);
    root.style.setProperty('--surface', resolvedTheme.surface);
    root.style.setProperty('--page', resolvedTheme.page);
  }, [colorScheme, resolvedTheme.accent, resolvedTheme.darkSquare, resolvedTheme.lightSquare, resolvedTheme.page, resolvedTheme.surface]);

  React.useEffect(() => {
    if (!authUser || !preferencesReady) return;

    if (themeSaveTimerRef.current) {
      window.clearTimeout(themeSaveTimerRef.current);
    }

    themeSaveTimerRef.current = window.setTimeout(() => {
      fetch(apiUrl('/api/user/preferences'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: { ...theme, pieceSet } })
      }).catch(() => {});
    }, 180);
  }, [authUser, preferencesReady, theme, pieceSet]);

  React.useEffect(() => {
    if (!authUser) {
      setPreferencesReady(false);
      return;
    }

    setPreferencesReady(false);

    fetch(apiUrl('/api/user/preferences'), { credentials: 'include' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.preferences?.theme) {
          const { pieceSet: storedPieceSet, ...storedTheme } = data.preferences.theme;
          setTheme({
            ...DEFAULT_THEME,
            ...storedTheme,
            appearance: storedTheme.appearance || 'custom'
          });
          setPieceSetState(normalizePieceSet(storedPieceSet));
        }
      })
      .catch(() => {})
      .finally(() => setPreferencesReady(true));
  }, [authUser]);

  React.useEffect(() => () => {
    if (themeSaveTimerRef.current) {
      window.clearTimeout(themeSaveTimerRef.current);
    }
  }, []);

  const updateTheme = (key, value) => {
    setTheme((currentTheme) => ({
      ...currentTheme,
      appearance: 'custom',
      [key]: value
    }));
  };

  const resetTheme = () => {
    setTheme(DEFAULT_THEME);
    setPieceSetState(DEFAULT_PIECE_SET);
  };

  const setPieceSet = (nextPieceSet) => {
    setPieceSetState(normalizePieceSet(nextPieceSet));
  };

  const setAppearance = (nextAppearance) => {
    if (!['system', 'dark', 'light', 'custom'].includes(nextAppearance)) return;
    setTheme((currentTheme) => ({ ...currentTheme, appearance: nextAppearance }));
  };

  const applyBoardPreset = (presetId) => {
    const preset = BOARD_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    setTheme((currentTheme) => ({
      ...currentTheme,
      appearance: 'custom',
      lightSquare: preset.lightSquare,
      darkSquare: preset.darkSquare
    }));
  };

  return {
    theme: resolvedTheme,
    appearance,
    colorScheme,
    setTheme,
    themeStyle,
    settingsOpen,
    setSettingsOpen,
    pieceSet,
    setPieceSet,
    updateTheme,
    setAppearance,
    resetTheme,
    applyBoardPreset
  };
}
