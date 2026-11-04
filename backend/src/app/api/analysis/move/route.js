import { rateLimit } from '../../../../lib/rateLimit';
import { withStockfishEngine } from '../../../../lib/stockfishEngine';
import { engineStrength, chooseBeginnerMove, resolvePlayingElo } from '../../../../lib/enginePolicy';
import { enginePosition, engineInputError } from '../../../../lib/enginePosition';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { readJsonPayload } from '../../../../lib/validation';

export const runtime = 'nodejs';

async function loadBot(id) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw Object.assign(new Error('Chưa kết nối được dữ liệu bot.'), { status: 503 });
  const { data, error } = await supabase.from('bot_personas')
    .select('id,elo,active,starts_at,ends_at').eq('id', id).maybeSingle();
  if (error) throw Object.assign(new Error('Không đọc được cấu hình bot. Hãy thử lại.'), { status: 503 });
  return data;
}

export async function POST(request) {
  const blocked = rateLimit(request, { scope: 'stockfish-move', limit: 160, windowMs: 60_000 });
  if (blocked) return blocked;
  const payload = await readJsonPayload(request);
  if (!payload) return Response.json({ ok: false, error: 'Dữ liệu không hợp lệ.' }, { status: 400 });
  try {
    const board = enginePosition(payload.fen);
    if (board.isGameOver()) throw Object.assign(new Error('Ván cờ đã kết thúc.'), { status: 409 });
    const root = payload.initialFen || board.fen();
    const moves = payload.initialFen ? payload.moves || [] : [];
    if (enginePosition(root, moves).fen() !== board.fen()) throw engineInputError('Lịch sử nước đi không khớp bàn cờ.');
    const elo = await resolvePlayingElo(payload, loadBot);
    const fullStrength = payload.fullStrength === true;
    const result = await withStockfishEngine({ signal: request.signal, priority: 'interactive' }, async (engine) => {
      const range = engine.capabilities.options.UCI_Elo;
      const strength = engineStrength(elo, fullStrength, range);
      await engine.configure(strength);
      const analysis = await engine.analyze({ fen: root, moves, movetime: strength.movetime, depth: strength.depth });
      const lan = fullStrength ? analysis.bestMove : chooseBeginnerMove(board, analysis.bestMove, strength);
      return { ...analysis, bestMove: lan, score: lan === analysis.bestMove ? analysis.score : null, strength };
    });
    const lan = result.bestMove;
    return Response.json({ ok: true, engine: result.engine, elo, strength: result.strength,
      move: { from: lan.slice(0, 2), to: lan.slice(2, 4), promotion: lan[4] || undefined, lan },
      score: result.score, depth: result.depth });
  } catch (error) {
    return Response.json({ ok: false, error: error.message || 'Chưa lấy được nước đi.' }, { status: error.status || 500 });
  }
}

export function OPTIONS() { return new Response(null, { status: 204 }); }
