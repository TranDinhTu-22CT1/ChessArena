import React from 'react';
import { BOARD_PRESETS, DEFAULT_THEME } from '../game/constants';

function loadStoredTheme() {
  return DEFAULT_THEME;
}

export function useThemeSettings(authUser) {
  const [theme, setTheme] = React.useState(() => loadStoredTheme());
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [pieceSet, setPieceSet] = React.useState('classic');
  const themeSaveTimerRef = React.useRef(null);

  const themeStyle = {
    '--accent': theme.accent,
    '--light-square': theme.lightSquare,
    '--dark-square': theme.darkSquare,
    '--surface': theme.surface,
    '--page': theme.page
  };

  React.useEffect(() => {
    if (!authUser) return;

    if (themeSaveTimerRef.current) {
      window.clearTimeout(themeSaveTimerRef.current);
    }

    themeSaveTimerRef.current = window.setTimeout(() => {
      fetch(`${import.meta.env.VITE_API_URL}/api/user/preferences`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme })
      }).catch(() => {});
    }, 180);
  }, [authUser, theme]);

  React.useEffect(() => {
    if (!authUser) return;

    fetch(`${import.meta.env.VITE_API_URL}/api/user/preferences`, { credentials: 'include' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.preferences?.theme) {
          setTheme({ ...DEFAULT_THEME, ...data.preferences.theme });
        }
      })
      .catch(() => {});
  }, [authUser]);

  React.useEffect(() => () => {
    if (themeSaveTimerRef.current) {
      window.clearTimeout(themeSaveTimerRef.current);
    }
  }, []);

  const updateTheme = (key, value) => {
    setTheme((currentTheme) => ({
      ...currentTheme,
      [key]: value
    }));
  };

  const resetTheme = () => {
    setTheme(DEFAULT_THEME);
  };

  const applyBoardPreset = (presetId) => {
    const preset = BOARD_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    setTheme((currentTheme) => ({
      ...currentTheme,
      lightSquare: preset.lightSquare,
      darkSquare: preset.darkSquare
    }));
  };

  return {
    theme,
    setTheme,
    themeStyle,
    settingsOpen,
    setSettingsOpen,
    pieceSet,
    setPieceSet,
    updateTheme,
    resetTheme,
    applyBoardPreset
  };
}
