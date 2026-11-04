import { cookies } from 'next/headers';
import { requireOnlineUser } from './online';
import { userEntitlements } from './entitlements';
import { isSchemaMismatch } from './schemaReadiness';

export async function puzzleContext() {
  const store = await cookies();
  return store.get('firebase_id_token')?.value || store.get('admin_session_token')?.value ? requireOnlineUser() : null;
}

export async function puzzleAccess(context, mode) {
  const { tier } = await userEntitlements(context.supabase, context.user);
  if ((mode === 'rush' && tier === 'free') || (mode === 'custom' && !['pro', 'master'].includes(tier))) {
    throw Object.assign(new Error('Gói hiện tại chưa mở chế độ câu đố này.'), { status: 403 });
  }
  return tier === 'free' ? 5 : tier === 'plus' ? 80 : null;
}

export function puzzleFailure(error) {
  const upgrade = isSchemaMismatch(error);
  const status = upgrade ? 503 : error.status || ({ '42501': 403, '22023': 400, '40001': 409, '55000': 409, '54000': 429 }[error.code]) || 503;
  return Response.json({ ok: false, error: upgrade ? 'Cần chạy backend/supabase/SecurityUpgrade.sql để cập nhật câu đố.'
    : error.code === '54000' ? 'Bạn đã hết lượt câu đố hôm nay.'
      : status === 409 ? 'Phiên câu đố đã thay đổi hoặc kết thúc. Hãy tải lại.'
        : error.status ? error.message : 'Không thể xử lý phiên câu đố. Hãy thử lại.' }, { status });
}
