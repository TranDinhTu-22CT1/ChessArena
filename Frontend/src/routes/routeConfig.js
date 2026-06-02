export const ROUTES = {
  home: '/',
  online: '/play/online',
  bot: '/play/bot',
  coach: '/coach',
  local: '/play/local',
  profile: '/profile',
  friends: '/friends',
  notifications: '/notifications',
  history: '/history',
  onlineReview: '/history/review',
  leaderboard: '/leaderboard',
  achievements: '/achievements',
  tournaments: '/tournaments',
  coachLab: '/training/coach',
  membership: '/membership',
  admin: '/admin',
  notFound: '/404',
  review: '/review',
  puzzles: '/puzzles',
  'daily-puzzle': '/puzzles/daily',
  'puzzle-rush': '/puzzles/rush',
  'puzzle-streak': '/puzzles/streak',
  'puzzle-battle': '/puzzles/battle',
  'custom-puzzles': '/puzzles/custom',
  'personal-puzzles': '/puzzles/personal'
};

const GAME_ROUTES = new Set(['online', 'bot', 'coach', 'local']);
const PUZZLE_ROUTES = new Set(['puzzles', 'daily-puzzle', 'puzzle-rush', 'puzzle-streak', 'puzzle-battle', 'custom-puzzles', 'personal-puzzles']);

export function isGameRoute(route) {
  return GAME_ROUTES.has(route);
}

export function isPuzzleRoute(route) {
  return PUZZLE_ROUTES.has(route);
}

export function routeFromPath(pathname) {
  if (pathname === '/404') return 'notFound';
  if (pathname === '/profile') return 'profile';
  if (pathname.startsWith('/profile/')) return 'profile';
  if (pathname === '/friends') return 'friends';
  if (pathname === '/notifications') return 'notifications';
  if (pathname === '/history') return 'history';
  if (pathname.startsWith('/history/review/')) return 'onlineReview';
  if (pathname === '/leaderboard') return 'leaderboard';
  if (pathname === '/achievements') return 'achievements';
  if (pathname === '/tournaments') return 'tournaments';
  if (pathname === '/training/coach' || pathname === '/coach-lab') return 'coachLab';
  if (pathname === '/membership' || pathname === '/premium') return 'membership';
  if (pathname === '/admin' || pathname.startsWith('/admin/') || pathname === '/amdin') return 'admin';
  if (pathname === '/review') return 'review';
  if (pathname === '/puzzles/daily') return 'daily-puzzle';
  if (pathname === '/puzzles/rush') return 'puzzle-rush';
  if (pathname === '/puzzles/streak') return 'puzzle-streak';
  if (pathname === '/puzzles/battle') return 'puzzle-battle';
  if (pathname === '/puzzles/custom') return 'custom-puzzles';
  if (pathname === '/puzzles/personal') return 'personal-puzzles';
  if (pathname === '/puzzles') return 'puzzles';
  if (pathname === '/play/online' || pathname === '/online') return 'online';
  if (pathname === '/coach' || pathname === '/learn/coach' || pathname === '/play/coach') return 'coach';
  if (pathname === '/play/local' || pathname === '/play/friend') return 'local';
  if (pathname === '/play/bot' || pathname === '/game') return 'bot';
  if (pathname === '/') return 'home';
  return 'notFound';
}

export function pathForRoute(route) {
  return ROUTES[route] ?? ROUTES.home;
}

export function gameModeFromRoute(route) {
  return route === 'online' ? null : GAME_ROUTES.has(route) ? route : null;
}
