import { distributedRateLimit } from '../../../lib/rateLimit';
import { requireOnlineUser } from '../../../lib/online';
import { readJsonPayload, safeArray } from '../../../lib/validation';
import { uploadDataAssets } from '../../../lib/storage';
import { listReportsForReporter } from '../../../lib/reportAccess';

export const runtime = 'nodejs';

const CATEGORIES = new Set(['toxic', 'stalling', 'username', 'avatar', 'harassment', 'match_abuse', 'other']);
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

function cleanText(value, limit = 1200) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, limit);
}

function cleanAttachments(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 3).map((item) => ({
    name: cleanText(item?.name, 160) || 'evidence',
    mimeType: cleanText(item?.mimeType || item?.type, 80).toLowerCase(),
    dataUrl: String(item?.dataUrl || '').trim()
  })).filter((item) => IMAGE_TYPES.has(item.mimeType) && item.dataUrl.startsWith(`data:${item.mimeType};base64,`) && item.dataUrl.length <= 7_000_000);
}

function severityFor(category) {
  if (category === 'harassment' || category === 'match_abuse') return 'high';
  if (category === 'toxic' || category === 'stalling') return 'medium';
  return 'low';
}

async function sharedGames(supabase, reporterId, reportedId, limit = 20) {
  const pair = `and(white_user_id.eq.${reporterId},black_user_id.eq.${reportedId}),and(white_user_id.eq.${reportedId},black_user_id.eq.${reporterId})`;
  const { data, error } = await supabase
    .from('online_games')
    .select('id, white_user_id, black_user_id, white_name, black_name, result, status, time_control, finished_at, created_at')
    .or(pair)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return safeArray(data);
}

export async function GET(request) {
  const blocked = await distributedRateLimit(request, { scope: 'player-report-options', limit: 40, windowMs: 60_000 });
  if (blocked) return blocked;
  const context = await requireOnlineUser();
  if (context.error) return context.error;
  const reportedUserId = cleanText(new URL(request.url).searchParams.get('reportedUserId'), 80);
  if (!reportedUserId) {
    try {
      return Response.json({ ok: true, reports: await listReportsForReporter(context.supabase, context.user.id) });
    } catch {
      return Response.json({ ok: false, error: 'Chưa tải được các báo cáo của bạn.' }, { status: 500 });
    }
  }
  if (reportedUserId === context.user.id) {
    return Response.json({ ok: false, error: 'Bạn không thể báo cáo chính mình.' }, { status: 400 });
  }
  try {
    return Response.json({ ok: true, games: await sharedGames(context.supabase, context.user.id, reportedUserId) });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const blocked = await distributedRateLimit(request, { scope: 'player-report-create', limit: 6, windowMs: 60_000 });
  if (blocked) return blocked;
  const context = await requireOnlineUser();
  if (context.error) return context.error;
  const payload = await readJsonPayload(request);
  if (!payload) return Response.json({ ok: false, error: 'Dữ liệu không hợp lệ.' }, { status: 400 });

  const reportedUserId = cleanText(payload.reportedUserId, 80);
  const category = CATEGORIES.has(payload.category) ? payload.category : '';
  const description = cleanText(payload.description, 1600);
  const evidenceUrl = cleanText(payload.evidenceUrl, 500);
  const gameId = cleanText(payload.gameId, 80) || null;
  if (!reportedUserId || reportedUserId === context.user.id) {
    return Response.json({ ok: false, error: 'Bạn không thể báo cáo chính mình.' }, { status: 400 });
  }
  if (!category || description.length < 12) {
    return Response.json({ ok: false, error: 'Hãy chọn lý do và mô tả ít nhất 12 ký tự.' }, { status: 400 });
  }
  const { data: reportedUser } = await context.supabase.from('users').select('id, display_name, username').eq('id', reportedUserId).maybeSingle();
  if (!reportedUser) return Response.json({ ok: false, error: 'Người chơi không tồn tại.' }, { status: 404 });

  let game = null;
  if (gameId) {
    const games = await sharedGames(context.supabase, context.user.id, reportedUserId, 50).catch(() => []);
    game = games.find((candidate) => candidate.id === gameId) || null;
    if (!game) return Response.json({ ok: false, error: 'Trận đấu không hợp lệ hoặc không thuộc hai người chơi.' }, { status: 400 });
  }

  const { data: duplicate } = await context.supabase
    .from('player_reports')
    .select('id')
    .eq('reporter_user_id', context.user.id)
    .eq('reported_user_id', reportedUserId)
    .eq('category', category)
    .in('status', ['pending', 'in_review', 'escalated'])
    .limit(1)
    .maybeSingle();
  if (duplicate) return Response.json({ ok: false, error: 'Bạn đã có báo cáo cùng loại đang được xem xét.' }, { status: 409 });

  let images = [];
  try {
    images = await uploadDataAssets(cleanAttachments(payload.attachments), {
      ownerUserId: context.user.id,
      purpose: 'report-evidence',
      maxBytes: 5 * 1024 * 1024
    });
  } catch (error) {
    return Response.json({ ok: false, error: error.message || 'Không thể tải ảnh bằng chứng.' }, { status: 400 });
  }

  const { data: report, error } = await context.supabase.from('player_reports').insert({
    game_id: game?.id || null,
    reporter_user_id: context.user.id,
    reported_user_id: reportedUserId,
    category,
    severity: severityFor(category),
    description,
    status: 'pending',
    evidence: {
      images,
      url: /^https?:\/\//i.test(evidenceUrl) ? evidenceUrl : null,
      game: game ? { id: game.id, result: game.result, status: game.status, timeControl: game.time_control } : null
    }
  }).select('*').single();
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, report }, { status: 201 });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
