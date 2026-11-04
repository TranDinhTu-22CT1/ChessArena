import { rateLimit } from '../../../../lib/rateLimit';
import { analyzeReviewBatch } from '../../../../lib/reviewAnalysis';
import { readJsonPayload } from '../../../../lib/validation';
import { requireOnlineUser } from '../../../../lib/online';
import { userEntitlements } from '../../../../lib/entitlements';
import { isSchemaMismatch, SCHEMA_UPDATE_MESSAGE } from '../../../../lib/schemaReadiness';

export const runtime = 'nodejs';

const DEFAULT_MOVETIME = Number(process.env.STOCKFISH_REVIEW_MOVETIME || 180);

async function saveOnlineReview({ context, payload, results }) {
  const successfulResults = results.filter((item) => !item.analysisError);
  if (!payload.gameId || !successfulResults.length) return null;
  const {data,error}=await context.supabase.rpc('save_game_review_batch',{
    p_user:context.user.id,p_game:payload.gameId,
    p_results:successfulResults.map(item=>({...item,fen:payload.positions.find(position=>position.ply===item.ply)?.fen}))
  });
  if(error)throw Object.assign(new Error(isSchemaMismatch(error) ? SCHEMA_UPDATE_MESSAGE : error.code==='22023'?'Dữ liệu phân tích không khớp ván đấu.':'Chưa lưu được phân tích. Hãy thử lại.'),{status:error.code==='22023'?400:503, code:isSchemaMismatch(error)?'DATABASE_UPGRADE_REQUIRED':undefined});
  return data;
}

export async function POST(request) {
  const blocked = rateLimit(request, { scope: 'stockfish-review', limit: 120, windowMs: 60_000 });
  if (blocked) return blocked;

  const payload = await readJsonPayload(request);
  if (!payload) {
    return Response.json({ ok: false, error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const { positions = [] } = payload;
  if (!Array.isArray(positions) || positions.length < 1 || positions.length > 24) {
    return Response.json({ ok: false, error: 'Mỗi lần phân tích tối đa 24 nước.' }, { status: 400 });
  }
  const context = await requireOnlineUser();
  if (context.error) return context.error;
  const gameId = /^[0-9a-f-]{36}$/i.test(String(payload.gameId || '')) ? payload.gameId : null;
  const reviewSessionId = String(payload.reviewSessionId || '').trim().slice(0, 160);
  if (!gameId && reviewSessionId.length < 8) {
    return Response.json({ ok: false, error: 'Thiếu phiên Review hợp lệ.' }, { status: 400 });
  }
  const quality = payload.quality === 'deep' ? 'deep' : 'quick';
  const movetime = quality === 'deep' ? 450 : Math.max(120, Math.min(450, Number(payload.movetime) || DEFAULT_MOVETIME));
  const limitedPositions = positions.slice(0, 24);
  const liveAnalysis = payload.analysisMode === 'live';
  if (liveAnalysis && (gameId || quality !== 'quick' || limitedPositions.length !== 1 || movetime > 220)) {
    return Response.json({ ok: false, error: 'Yêu cầu phân tích trực tiếp không hợp lệ.' }, { status: 400 });
  }
  let quota = null;
  let entitlements = null;
  let reviewCommitted = false;
  try {
    if (!liveAnalysis) {
      entitlements = await userEntitlements(context.supabase, context.user);
      const reservation = await context.supabase.rpc('reserve_game_review', {
        p_user: context.user.id,
        p_game: gameId,
        p_review_key: gameId ? null : reviewSessionId,
        p_daily_limit: entitlements.reviewDailyLimit
      });
      quota = reservation.data;
      const quotaError = reservation.error;
      if (quotaError) {
        const status = quotaError.code === '42501' ? 403 : quotaError.code === '22023' ? 400 : quotaError.code === '55000' ? 409 : 503;
        throw Object.assign(new Error(
          isSchemaMismatch(quotaError) ? SCHEMA_UPDATE_MESSAGE : quotaError.code === '42501' ? 'Bạn không có quyền Review ván đấu này.'
            : quotaError.code === '55000' ? 'Chỉ có thể Review sau khi ván đấu kết thúc.'
              : 'Chưa kiểm tra được lượt Review. Hãy thử lại.'
        ), { status, code: isSchemaMismatch(quotaError) ? 'DATABASE_UPGRADE_REQUIRED' : 'QUOTA_FAILURE' });
      }
      if (!quota?.allowed) {
        throw Object.assign(new Error('Bạn đã dùng hết lượt Review hôm nay. Hãy nâng cấp gói để tiếp tục.'), {
          status: 429,
          code: 'REVIEW_QUOTA_EXHAUSTED'
        });
      }
    }
    const results = await analyzeReviewBatch(limitedPositions, { movetime, quality, signal: request.signal });

    const savedReview = await saveOnlineReview({ context, payload: { ...payload, gameId }, results });
    reviewCommitted = true;
    return Response.json({
      ok: true,
      engine: 'stockfish',
      quality,
      movetime,
      results,
      partial: results.some((item) => item.analysisError),
      savedReview,
      quota: liveAnalysis ? { consumed: false, mode: 'live' } : {
        consumed: true,
        remaining: quota.remaining,
        unlimited: entitlements.hasUnlimitedReview,
        tier: entitlements.tier
      }
    });
  } catch (error) {
    if (!liveAnalysis && quota?.allowed && !quota.alreadyReserved && !reviewCommitted) {
      try {
        await context.supabase.rpc('release_game_review_reservation', {
          p_user: context.user.id,
          p_game: gameId,
          p_review_key: gameId ? null : reviewSessionId
        });
      } catch {
        // Preserve the original controlled analysis error. Maintenance can
        // reconcile the reservation if the database itself is unavailable.
      }
    }
    return Response.json(
      { ok: false, error: error.message || 'Stockfish review failed.', code: error.code || undefined },
      { status: error.status || 500 }
    );
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
