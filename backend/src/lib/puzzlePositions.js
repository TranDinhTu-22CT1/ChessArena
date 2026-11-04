import { Chess } from 'chess.js';

// Authored exercises with explicit legal solutions. Ratings describe local
// exercise difficulty; they are not ratings imported from an online service.
// The catalog is verified with Stockfish by npm run test:integration.
function position(id, fen, theme, rating, line, stage = 'endgame') {
  return { id, fen, theme, rating, line: line.split(' '), stage };
}
const legalTrap = new Chess();
['e4', 'e5', 'Nf3', 'd6', 'Bc4', 'Bg4', 'Nc3', 'g6', 'Nxe5', 'Bxd1'].forEach((move) => legalTrap.move(move));
const originals = [
  position('mg-fools-mate-black', 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2', 'mate', 600, 'd8h4', 'middlegame'),
  position('eg-back-rank-rook-white', '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', 'mate', 650, 'd1d8'),
  position('mg-scholars-mate-white', 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', 'mate', 700, 'h5f7', 'middlegame'),
  position('eg-loose-queen-rook-white', '6k1/5ppp/8/8/4q3/8/5PPP/4R1K1 w - - 0 1', 'material', 750, 'e1e4'),
  position('eg-supported-promotion-white', '7k/P7/8/8/4B3/8/8/1K4R1 w - - 0 1', 'promotion', 800, 'a7a8q'),
  position('mg-knight-wins-queen', 'r1bqkb1r/pppp1Npp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNBQK2R w KQkq - 0 5', 'material', 850, 'f7d8', 'middlegame'),
  position('eg-back-rank-rook-black', '3r2k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1', 'mate', 700, 'd8d1'),
  position('eg-loose-queen-bishop-white', '6k1/1q3ppp/8/8/8/8/6BP/R5K1 w - - 0 1', 'material', 850, 'g2b7'),
  position('eg-loose-queen-knight-white', '6k1/5ppp/8/3q4/8/2N5/5PPP/6K1 w - - 0 1', 'material', 900, 'c3d5'),
  position('eg-queen-back-rank', '6k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1', 'mate', 750, 'd1d8'),
  position('eg-queen-bishop-h7-white', '6k1/6pp/8/7Q/8/3B4/8/5RK1 w - - 0 1', 'mate', 950, 'h5h7'),
  position('eg-queen-bishop-h2-black', '5rk1/8/3b4/8/7q/8/6PP/6K1 b - - 0 1', 'mate', 950, 'h4h2'),
  position('eg-loose-queen-bishop-black', 'r5k1/6bp/8/8/8/8/1Q5P/6K1 b - - 0 1', 'material', 850, 'g7b2'),
  position('eg-supported-promotion-black', '1k4r1/8/8/4b3/8/8/p7/7K b - - 0 1', 'promotion', 850, 'a2a1q'),
  position('eg-loose-rook-queen-white', '6k1/5ppp/8/8/3r4/8/3Q1PPP/6K1 w - - 0 1', 'material', 700, 'd2d4'),
  position('eg-loose-queen-knight-black', '6k1/5ppp/2n5/8/3Q4/8/5PPP/6K1 b - - 0 1', 'material', 950, 'c6d4'),
  position('mg-legal-mate-two', legalTrap.fen(), 'mate', 1250, 'c4f7 e8e7 c3d5', 'middlegame'),
  position('eg-smothered-mate-two', '5r1k/6pp/4Q2N/8/8/8/8/6K1 w - - 0 1', 'mate', 1450, 'e6g8 f8g8 h6f7'),
  position('eg-knight-fork-rook', 'r3k3/6pp/4N3/8/8/8/5PPP/6K1 w - - 0 1', 'material', 1150, 'e6c7 e8d7 c7a8'),
  position('eg-bishop-skewer-queen', '7q/8/8/4k3/8/8/5PPP/2B3K1 w - - 0 1', 'material', 1200, 'c1b2 e5f4 b2h8'),
  position('eg-promotion-with-check', '8/4P1k1/8/8/8/8/5PPP/6K1 w - - 0 1', 'promotion', 1000, 'e7e8q'),
  position('eg-promotion-capture', '1r5k/P5pp/8/8/8/8/5PPP/6K1 w - - 0 1', 'promotion', 1050, 'a7b8q')
];

function reverseColors(puzzle) {
  const parts = puzzle.fen.split(' ');
  const swap = (value) => value.replace(/[a-zA-Z]/g, (c) => c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase());
  const square = (value) => value.replace(/[1-8]/g, (rank) => String(9 - Number(rank)));
  parts[0] = swap(parts[0].split('/').reverse().join('/'));
  parts[1] = parts[1] === 'w' ? 'b' : 'w';
  parts[2] = swap(parts[2]);
  parts[3] = square(parts[3]);
  return { ...puzzle, id: `${puzzle.id}-reversed`, fen: parts.join(' '), line: puzzle.line.map(square) };
}

export const PUZZLE_POSITIONS = [...originals, ...originals.slice(-6).map(reverseColors)];
export const PUZZLE_THEMES = [
  { id: 'all', label: 'Tất cả chủ đề' }, { id: 'mate', label: 'Chiếu hết' },
  { id: 'material', label: 'Thắng quân' }, { id: 'promotion', label: 'Phong cấp' }
];
export const PUZZLE_STAGES = [
  { id: 'all', label: 'Tất cả giai đoạn' },
  { id: 'middlegame', label: 'Trung cuộc' }, { id: 'endgame', label: 'Tàn cuộc' }
];
