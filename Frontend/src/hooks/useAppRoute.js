import React from 'react';
import { gameModeFromRoute, pathForRoute, routeFromPath } from '../routes/routeConfig';

function routeFromLocation() {
  if (window.location.pathname === '/support' && new URLSearchParams(window.location.search).has('tab')) return 'supportTickets';
  return routeFromPath(window.location.pathname);
}

export function useAppRoute({ gameMode, setGameMode }) {
  const [route, setRoute] = React.useState(() => routeFromLocation());
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);
  const gameModeRef = React.useRef(gameMode);
  gameModeRef.current = gameMode;

  React.useEffect(() => {
    if (window.location.pathname === '/game') {
      window.history.replaceState(null, '', pathForRoute('bot'));
    }

    const onPopState = () => {
      const nextRoute = routeFromLocation();
      setRoute(nextRoute);
      const nextMode = gameModeFromRoute(nextRoute);
      if (nextMode) setGameMode(nextMode);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [setGameMode]);

  const navigate = React.useCallback((nextRoute) => {
    const resolvedRoute = nextRoute === 'game' ? gameModeRef.current : nextRoute;
    const path = pathForRoute(resolvedRoute);

    window.history.pushState(null, '', path);
    setRoute(resolvedRoute);

    const nextMode = gameModeFromRoute(resolvedRoute);
    if (nextMode) setGameMode(nextMode);
    setMobileSidebarOpen(false);
  }, [setGameMode]);

  return {
    route,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    navigate
  };
}
