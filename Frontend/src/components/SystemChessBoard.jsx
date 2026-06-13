import React from 'react';
import blackBishop from '../assets/chesscom/pieces/neo/bb.png';
import blackKing from '../assets/chesscom/pieces/neo/bk.png';
import blackKnight from '../assets/chesscom/pieces/neo/bn.png';
import blackPawn from '../assets/chesscom/pieces/neo/bp.png';
import blackQueen from '../assets/chesscom/pieces/neo/bq.png';
import blackRook from '../assets/chesscom/pieces/neo/br.png';
import whiteBishop from '../assets/chesscom/pieces/neo/wb.png';
import whiteKing from '../assets/chesscom/pieces/neo/wk.png';
import whiteKnight from '../assets/chesscom/pieces/neo/wn.png';
import whitePawn from '../assets/chesscom/pieces/neo/wp.png';
import whiteQueen from '../assets/chesscom/pieces/neo/wq.png';
import whiteRook from '../assets/chesscom/pieces/neo/wr.png';

const PIECES = {
  a8: blackRook,
  c8: blackBishop,
  d8: blackQueen,
  f8: blackRook,
  g8: blackKing,
  a7: blackPawn,
  b7: blackPawn,
  c7: blackPawn,
  d6: blackPawn,
  e6: blackPawn,
  f7: blackPawn,
  g7: blackPawn,
  h7: blackPawn,
  c6: blackKnight,
  f6: blackKnight,
  e7: blackBishop,
  a1: whiteRook,
  d1: whiteQueen,
  f1: whiteRook,
  g1: whiteKing,
  a2: whitePawn,
  b2: whitePawn,
  c2: whitePawn,
  d4: whitePawn,
  e4: whitePawn,
  f2: whitePawn,
  g2: whitePawn,
  h2: whitePawn,
  c3: whiteKnight,
  f3: whiteKnight,
  c1: whiteBishop,
  e2: whiteBishop
};

export default function SystemChessBoard({ animated = false, compact = false }) {
  return (
    <div className={`system-chess-board ${animated ? 'animated' : ''} ${compact ? 'compact' : ''}`} aria-hidden="true">
      {Array.from({ length: 64 }, (_, index) => {
        const rankIndex = Math.floor(index / 8);
        const fileIndex = index % 8;
        const rank = 8 - rankIndex;
        const file = String.fromCharCode(97 + fileIndex);
        const square = `${file}${rank}`;
        const piece = PIECES[square];

        return (
          <span className={(rankIndex + fileIndex) % 2 === 0 ? 'light' : 'dark'} key={square}>
            {fileIndex === 0 && <small className="rank-label">{rank}</small>}
            {rankIndex === 7 && <small className="file-label">{file}</small>}
            {piece && <img src={piece} alt="" />}
          </span>
        );
      })}
      <i className="system-board-focus" />
    </div>
  );
}
