export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

export const AI_LEVELS = [
  { elo: 400, label: '400 Beginner', depth: 1, blunderRate: 0.48, candidatePool: 7 },
  { elo: 800, label: '800 Casual', depth: 1, blunderRate: 0.28, candidatePool: 5 },
  { elo: 1200, label: '1200 Club', depth: 2, blunderRate: 0.18, candidatePool: 4 },
  { elo: 1600, label: '1600 Strong', depth: 2, blunderRate: 0.08, candidatePool: 3 },
  { elo: 2000, label: '2000 Expert', depth: 3, blunderRate: 0.03, candidatePool: 2 },
  { elo: 2400, label: '2400 Master', depth: 3, blunderRate: 0, candidatePool: 1 }
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

export const DEFAULT_THEME = {
  accent: '#a7c957',
  lightSquare: '#f0ead2',
  darkSquare: '#86a666',
  surface: '#24231e',
  page: '#181713'
};
