import React from 'react';
import { apiUrl } from '../api/config';
import { BOARD_PRESETS, DARK_THEME, DEFAULT_PIECE_SET, DEFAULT_THEME, LIGHT_THEME, normalizePieceSet } from '../game/constants';

function loadStoredTheme() {
  return {};
}

export function useThemeSettings(authUser, websiteSettings) {
  const [theme, setTheme] = React.useState(() => loadStoredTheme());
  const [systemDark, setSystemDark] = React.useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [pieceSet, setPieceSetState] = React.useState(DEFAULT_PIECE_SET);
  const [preferencesOwner, setPreferencesOwner] = React.useState('');
  const preferenceSession = React.useRef(null);
  const identity = authUser?.uid || authUser?.id || authUser?.email || '';

  const defaultAppearance = websiteSettings?.defaultAppearance || DEFAULT_THEME.appearance;
  const appearance = ['system', 'dark', 'light', 'custom'].includes(theme.appearance) ? theme.appearance : defaultAppearance;
  const colorScheme = appearance === 'system' ? (systemDark ? 'dark' : 'light') : appearance === 'light' ? 'light' : 'dark';
  const palette = appearance === 'custom'
    ? theme
    : colorScheme === 'dark'
      ? DARK_THEME
      : LIGHT_THEME;
  const boardPreset = BOARD_PRESETS.find(item => item.id === websiteSettings?.defaultBoardTheme);
  const resolvedTheme = {
    ...DEFAULT_THEME, ...palette,
    accent: theme.accent || websiteSettings?.accentColor || palette.accent || DEFAULT_THEME.accent,
    lightSquare: theme.lightSquare || boardPreset?.lightSquare || palette.lightSquare || DEFAULT_THEME.lightSquare,
    darkSquare: theme.darkSquare || boardPreset?.darkSquare || palette.darkSquare || DEFAULT_THEME.darkSquare,
    appearance
  };
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
    const session = preferenceSession.current;
    if (!identity || preferencesOwner !== identity || session?.id !== identity) return undefined;
    session.desired = JSON.stringify({ theme: { ...theme, pieceSet } });
    if (session.saved === session.desired) return undefined;
    const timer = window.setTimeout(async () => {
      if (session.saving || session.controller.signal.aborted) return;
      session.saving = true;
      try {
        // Serialize saves so a slow older request cannot overwrite the latest choice.
        while (session.desired !== session.saved && !session.controller.signal.aborted) {
          const body = session.desired;
          const response = await fetch(apiUrl('/api/user/preferences'), {
            method: 'POST', credentials: 'include', signal: session.controller.signal,
            headers: { 'Content-Type': 'application/json' }, body
          });
          if (!response.ok) break;
          session.saved = body;
        }
      } catch { /* Retry on the next user change, never loop on failed writes. */ }
      finally { session.saving = false; }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [identity, preferencesOwner, theme, pieceSet]);

  React.useEffect(() => {
    setPreferencesOwner('');
    preferenceSession.current = null;
    setTheme({});
    setPieceSetState(DEFAULT_PIECE_SET);
    if (!identity) return undefined;
    const controller = new AbortController();
    fetch(apiUrl('/api/user/preferences'), { credentials: 'include', signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data || controller.signal.aborted) return;
        const stored = data.preferences?.theme;
        const { pieceSet: storedPieceSet, ...storedTheme } = stored || {};
        const nextTheme = storedTheme;
        const nextPieceSet = normalizePieceSet(storedPieceSet);
        const saved = JSON.stringify({ theme: { ...nextTheme, pieceSet: nextPieceSet } });
        preferenceSession.current = { id: identity, controller, saved, desired: saved, saving: false };
        setTheme(nextTheme);
        setPieceSetState(nextPieceSet);
        setPreferencesOwner(identity);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [identity]);

  const updateTheme = (key, value) => {
    setTheme((currentTheme) => ({
      ...resolvedTheme, ...currentTheme,
      appearance: 'custom',
      [key]: value
    }));
  };

  const resetTheme = () => {
    setTheme({});
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
