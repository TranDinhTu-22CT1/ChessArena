export const ROUTES = {
  home: '/',
  bot: '/play/bot',
  coach: '/coach',
  local: '/play/local',
  review: '/review'
};

const GAME_ROUTES = new Set(['bot', 'coach', 'local']);

export function isGameRoute(route) {
  return GAME_ROUTES.has(route);
}

export function routeFromPath(pathname) {
  if (pathname === '/review') return 'review';
  if (pathname === '/coach' || pathname === '/learn/coach' || pathname === '/play/coach') return 'coach';
  if (pathname === '/play/local' || pathname === '/play/friend') return 'local';
  if (pathname === '/play/bot' || pathname === '/game') return 'bot';
  return 'home';
}

export function pathForRoute(route) {
  return ROUTES[route] ?? ROUTES.home;
}

export function gameModeFromRoute(route) {
  return GAME_ROUTES.has(route) ? route : null;
}
