export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

export const AI_LEVELS = [
  { elo: 1320, label: '1320 Stockfish Club', search: 'UCI limited strength' },
  { elo: 1600, label: '1600 Stockfish Strong', search: 'UCI limited strength' },
  { elo: 2000, label: '2000 Stockfish Expert', search: 'UCI limited strength' },
  { elo: 2400, label: '2400 Stockfish Master', search: 'UCI limited strength' },
  { elo: 2800, label: '2800 Stockfish Elite', search: 'UCI limited strength' },
  { elo: 3190, label: 'Maximum Stockfish', search: 'Unlimited engine strength' }
];

export const PIECE_VALUES = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0
};

export const PROMOTION_PIECES = ['q', 'r', 'b', 'n'];

export const PIECE_NAMES = {
  q: 'Queen',
  r: 'Rook',
  b: 'Bishop',
  n: 'Knight'
};

export const TIME_CONTROLS = [
  { id: '60+0', label: 'Bullet 1+0', baseSeconds: 60, incrementSeconds: 0 },
  { id: '180+0', label: 'Blitz 3+0', baseSeconds: 180, incrementSeconds: 0 },
  { id: '300+0', label: 'Blitz 5+0', baseSeconds: 300, incrementSeconds: 0 },
  { id: '600+0', label: 'Rapid 10+0', baseSeconds: 600, incrementSeconds: 0 },
  { id: '900+10', label: 'Rapid 15+10', baseSeconds: 900, incrementSeconds: 10 }
];

export const BOARD_PRESETS = [
  { id: 'classic', label: 'Classic green', lightSquare: '#f0ead2', darkSquare: '#86a666' },
  { id: 'wood', label: 'Walnut wood', lightSquare: '#d7b98c', darkSquare: '#8a5a37' },
  { id: 'blue', label: 'Tournament blue', lightSquare: '#dce8ef', darkSquare: '#668da8' },
  { id: 'slate', label: 'Slate focus', lightSquare: '#d8ded4', darkSquare: '#6e7b73' }
];

export const PIECE_SETS = [
  { id: 'classic', label: 'Classic' },
  { id: 'glass', label: 'Glass' },
  { id: 'bold', label: 'Bold' }
];

export const DARK_THEME = {
  accent: '#a7c957',
  lightSquare: '#f0ead2',
  darkSquare: '#86a666',
  surface: '#24231e',
  page: '#181713'
};

export const LIGHT_THEME = {
  accent: '#6f9d37',
  lightSquare: '#f3eedc',
  darkSquare: '#7c9b60',
  surface: '#ffffff',
  page: '#eef2e8'
};

export const DEFAULT_THEME = {
  ...DARK_THEME,
  appearance: 'system'
};
