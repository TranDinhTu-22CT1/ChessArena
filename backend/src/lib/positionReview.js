import { withStockfishEngine } from './stockfishEngine.js';
import { enginePosition } from './enginePosition.js';
import { sacrificeCandidates } from './moveSacrifice.js';

const cacheKey = Symbol.for('chess-arena.position-reviews-v2');
const cache = globalThis[cacheKey] ??= new Map();

// A pair of searches is one short job. A 24-ply review yields the worker between
// positions, leaving room for other players' moves and puzzle checks.
export async function reviewPosition(fen, move, { movetime = 180, quality = 'quick', signal } = {}) {
  enginePosition(fen, [move]);
  const key = JSON.stringify([fen, move, movetime, quality]);
  const cached = cache.get(key);
  if (cached && cached.until > Date.now()) return cached.result;
  const started=Date.now();
  const result = await withStockfishEngine({ signal, priority:quality==='quick'?'interactive':undefined }, async (engine) => {
    await engine.configure({multiPv:quality==='deep'?3:2});
    let best = await engine.analyze({ fen, movetime, depth: 30 });
    await engine.configure({multiPv:1});
    // Compare at the same root; a separate after-position search can overstate loss.
    const searched=best.variations?.find(line=>line.pv?.[0]===move && line.depth>=best.depth-1);
    let played = move === best.bestMove ? best : searched || await engine.analyze({ fen, searchMoves:[move], movetime, depth:30 });
    if (played.score > best.score + 35) {
      const confirmation=await engine.analyze({fen,movetime:Math.min(600,movetime*1.5),depth:32});
      if(confirmation.score>=best.score)best=confirmation;
      if(move===best.bestMove)played=best;
    }
    if (!Number.isFinite(best.score) || !Number.isFinite(played.score)) {
      throw Object.assign(new Error('Stockfish chưa đánh giá đủ thế cờ này. Hãy thử lại.'), { status: 503 });
    }
    let sacrifice=null;
    // Only exceptional candidate moves pay for an extra tactical verification.
    if(move===best.bestMove && played.score>=-30 && (best.score<500 || best.mate>0)) {
      for(const capture of sacrificeCandidates(fen,move)) {
        const proof=await engine.analyze({fen,moves:[move,capture],movetime:Math.max(180,movetime),depth:26});
        if(proof.score>=-30 && (best.mate==null || proof.mate>0)) {
          sacrifice={capture,score:proof.score,mate:proof.mate,line:[move,capture,...proof.pv.slice(0,6)],depth:proof.depth};break;
        }
      }
    }
    const afterPlayed={...played,score:-played.score,pv:played.pv.slice(1),bestMove:played.pv[1]||null};
    return { best, played, afterPlayed, playedScore:played.score, sacrifice, quality, engine:engine.capabilities.name,elapsedMs:Date.now()-started };
  });
  if (cache.size >= 256) cache.delete(cache.keys().next().value);
  cache.set(key, { result, until: Date.now() + 5 * 60_000 });
  return result;
}
