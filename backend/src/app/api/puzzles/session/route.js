import { syncAchievements } from '../../../../lib/achievements';
import { requireOnlineUser } from '../../../../lib/online';
import { distributedRateLimit } from '../../../../lib/rateLimit';
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
  const blocked = await distributedRateLimit(request, { scope: 'puzzle-session-write', limit: 80, windowMs: 60_000 });
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

export async function GET(request) {
  const blocked = await distributedRateLimit(request, { scope: 'puzzle-progress-read', limit: 80, windowMs: 60_000 });
  if (blocked) return blocked;
  const context = await requireOnlineUser();
  if (context.error) return context.error;
  const [{ data: progress }, { data: dailyClaims = [] }] = await Promise.all([
    context.supabase.from('puzzle_progress').select('*').eq('user_id', context.user.id).maybeSingle(),
    context.supabase.from('daily_puzzle_claims').select('*').eq('user_id', context.user.id).order('puzzle_date', { ascending: false }).limit(90)
  ]);
  return Response.json({
    ok: true,
    progress: progress ? {
      rating: progress.rating,
      points: progress.points,
      correct: progress.correct,
      attempted: progress.attempted,
      rushBest: progress.rush_best,
      streakBest: progress.streak_best,
      dailyStreak: progress.daily_streak,
      seen: Array.isArray(progress.seen_puzzle_ids) ? progress.seen_puzzle_ids : []
    } : null,
    dailyClaims
  });
}

export async function PUT(request) {
  const blocked = await distributedRateLimit(request, { scope: 'puzzle-progress-write', limit: 120, windowMs: 60_000 });
  if (blocked) return blocked;
  const context = await requireOnlineUser();
  if (context.error) return context.error;
  const payload = await readJsonPayload(request);
  if (!payload) return Response.json({ ok: false, error: 'Invalid JSON payload.' }, { status: 400 });
  const seen = Array.isArray(payload.seen)
    ? [...new Set(payload.seen.map((item) => String(item).slice(0, 120)).filter(Boolean))].slice(-500)
    : [];
  const row = {
    user_id: context.user.id,
    rating: Math.max(100, Math.min(4000, intValue(payload.rating, 800))),
    points: intValue(payload.points),
    correct: intValue(payload.correct),
    attempted: intValue(payload.attempted),
    rush_best: intValue(payload.rushBest),
    streak_best: intValue(payload.streakBest),
    daily_streak: intValue(payload.dailyStreak),
    seen_puzzle_ids: seen,
    updated_at: new Date().toISOString()
  };
  const { data, error } = await context.supabase
    .from('puzzle_progress')
    .upsert(row, { onConflict: 'user_id' })
    .select('*')
    .single();
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, progress: data });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
