import { syncAchievements } from '../../../../lib/achievements';
import { requireOnlineUser } from '../../../../lib/online';
import { rateLimit } from '../../../../lib/rateLimit';
import { readJsonPayload } from '../../../../lib/validation';

export const runtime = 'nodejs';

const MODES = new Set(['rated', 'daily', 'rush', 'streak', 'custom', 'personal']);

function intValue(value, fallback = 0) {
  return Math.max(0, Math.floor(Number(value) || fallback));
}

function cleanMode(value) {
  const mode = String(value || '').trim();
  return MODES.has(mode) ? mode : 'rated';
}

function dateValue(value) {
  const date = new Date(`${String(value || '').slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
}

function isoOrNow(value, fallback) {
  const date = new Date(value || '');
  return Number.isFinite(date.getTime()) ? date.toISOString() : fallback;
}

export async function POST(request) {
  const blocked = rateLimit(request, { scope: 'puzzle-session-write', limit: 80, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireOnlineUser();
  if (context.error) return context.error;

  const payload = await readJsonPayload(request);
  if (!payload) return Response.json({ ok: false, error: 'Invalid JSON payload.' }, { status: 400 });

  const mode = cleanMode(payload.mode);
  const now = new Date().toISOString();
  const session = {
    user_id: context.user.id,
    mode,
    score: intValue(payload.score),
    correct: intValue(payload.correct),
    attempted: intValue(payload.attempted),
    best_streak: intValue(payload.bestStreak),
    duration_seconds: intValue(payload.durationSeconds),
    started_at: isoOrNow(payload.startedAt, now),
    finished_at: now,
    metadata: payload.metadata && typeof payload.metadata === 'object' && !Array.isArray(payload.metadata)
      ? payload.metadata
      : {}
  };

  const { data, error } = await context.supabase
    .from('puzzle_sessions')
    .insert(session)
    .select('*')
    .single();

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  if (mode === 'daily' && payload.puzzleId) {
    const puzzleDate = dateValue(payload.date);
    const yesterday = new Date(`${puzzleDate}T00:00:00Z`);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const previousKey = yesterday.toISOString().slice(0, 10);
    const { data: previous } = await context.supabase
      .from('daily_puzzle_claims')
      .select('streak')
      .eq('user_id', context.user.id)
      .eq('puzzle_date', previousKey)
      .maybeSingle();
    const streak = previous?.streak ? previous.streak + 1 : 1;
    await context.supabase
      .from('daily_puzzle_claims')
      .upsert({
        user_id: context.user.id,
        puzzle_date: puzzleDate,
        puzzle_id: String(payload.puzzleId).slice(0, 120),
        solved_at: now,
        streak
      }, { onConflict: 'user_id,puzzle_date' });
  }

  const achievements = await syncAchievements(context.supabase, context.user.id);
  return Response.json({ ok: true, session: data, achievements });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
