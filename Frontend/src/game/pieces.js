import { DEFAULT_PIECE_SET, normalizePieceSet } from './constants';

const PIECE_CODES = ['wk', 'wq', 'wr', 'wb', 'wn', 'wp', 'bk', 'bq', 'br', 'bb', 'bn', 'bp'];

function chesscomSet(folder) {
  return PIECE_CODES.reduce((images, code) => ({
    ...images,
    [code]: new URL(`../assets/chesscom/pieces/${folder}/${code}.png`, import.meta.url).href
  }), {});
}

export const PIECE_IMAGES = {
  neo: chesscomSet('neo'),
  gothic: chesscomSet('gothic'),
  glass: chesscomSet('glass'),
  metal: chesscomSet('metal'),
  space: chesscomSet('space'),
  eightBit: chesscomSet('8_bit'),
  tournament: chesscomSet('tournament'),
  staunton: chesscomSet('3d_staunton'),
  wood3d: chesscomSet('3d_wood')
};

export function getPieceImage(pieceSet, code) {
  const normalizedSet = normalizePieceSet(pieceSet);
  return PIECE_IMAGES[normalizedSet]?.[code] ?? PIECE_IMAGES[DEFAULT_PIECE_SET][code];
}
