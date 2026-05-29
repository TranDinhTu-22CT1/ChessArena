import { rateLimit } from '../../../../../../lib/rateLimit';
import { requireOnlineUser } from '../../../../../../lib/online';
import { activeMuteForUser } from '../../../../../../lib/admin';

export const runtime = 'nodejs';

const REPORT_CATEGORIES = new Set([
  'cheating',
  'toxic',
  'stalling',
  'sandbagging',
  'username',
  'avatar',
  'harassment',
  'match_abuse',
  'other'
]);

function cleanCategory(value) {
  const category = String(value || '').trim();
  return REPORT_CATEGORIES.has(category) ? category : 'other';
}

function cleanDescription(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 1200);
}

function severityFor(category) {
  if (['cheating', 'harassment', 'match_abuse'].includes(category)) return 'high';
  if (['toxic', 'stalling', 'sandbagging'].includes(category)) return 'medium';
  return 'low';
}

export async function POST(request, context) {
  const blocked = rateLimit(request, { scope: 'online-report', limit: 8, windowMs: 60_000 });
  if (blocked) return blocked;

  const auth = await requireOnlineUser();
  if (auth.error) return auth.error;
  const activeMute = await activeMuteForUser(auth.supabase, auth.user.id);
  if (activeMute && (activeMute.scopes || []).includes('reports')) {
    return Response.json({ ok: false, error: activeMute.reason || 'You are muted from submitting reports.' }, { status: 403 });
  }

  const gameId = String((await context.params)?.gameId || '').trim();
  const payload = await request.json().catch(() => null);
  const category = cleanCategory(payload?.category);
  const description = cleanDescription(payload?.description);

  if (!gameId) {
    return Response.json({ ok: false, error: 'Missing game id.' }, { status: 400 });
  }

  if (description.length < 8) {
    return Response.json({ ok: false, error: 'Report description is too short.' }, { status: 400 });
  }

  const { data: game, error: gameError } = await auth.supabase
    .from('online_games')
    .select('id, white_user_id, black_user_id, status, result, time_control, created_at, finished_at')
    .eq('id', gameId)
    .maybeSingle();

  if (gameError) return Response.json({ ok: false, error: gameError.message }, { status: 500 });
  if (!game) return Response.json({ ok: false, error: 'Game not found.' }, { status: 404 });

  const isWhite = game.white_user_id === auth.user.id;
  const isBlack = game.black_user_id === auth.user.id;
  if (!isWhite && !isBlack) {
    return Response.json({ ok: false, error: 'You can only report games you played.' }, { status: 403 });
  }

  const reportedUserId = isWhite ? game.black_user_id : game.white_user_id;
  if (!reportedUserId) {
    return Response.json({ ok: false, error: 'Opponent is not available for this report.' }, { status: 400 });
  }

  const { data: moves = [] } = await auth.supabase
    .from('online_game_moves')
    .select('ply, san, color, created_at')
    .eq('game_id', gameId)
    .order('ply', { ascending: true });

  const { data: report, error } = await auth.supabase
    .from('player_reports')
    .upsert({
      game_id: gameId,
      reporter_user_id: auth.user.id,
      reported_user_id: reportedUserId,
      category,
      severity: severityFor(category),
      description,
      status: 'pending',
      evidence: {
        gameStatus: game.status,
        result: game.result,
        timeControl: game.time_control,
        moveCount: moves.length,
        lastMoves: moves.slice(-12)
      },
      updated_at: new Date().toISOString()
    }, { onConflict: 'game_id,reporter_user_id,category' })
    .select('*')
    .single();

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, report });
}
