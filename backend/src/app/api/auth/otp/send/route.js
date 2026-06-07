import {
  firebaseUserExists,
  getPasswordResetEligibility
} from '../../../../../lib/firebaseAdmin';
import { sendOtpEmail } from '../../../../../lib/mailer';
import { createOtpCode, normalizeOtpEmail, storeOtp } from '../../../../../lib/otp';
import { distributedRateLimit } from '../../../../../lib/rateLimit';
import { getSupabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { readJsonPayload } from '../../../../../lib/validation';

export const runtime = 'nodejs';

const PURPOSES = new Set(['register', 'reset']);

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
}

function socialPasswordResetError(provider) {
  if (provider === 'google.com') {
    return 'Tài khoản này đăng nhập bằng Google và không có mật khẩu ChessArena. Vui lòng chọn Đăng nhập bằng Google.';
  }

  if (provider === 'github.com') {
    return 'Tài khoản này đăng nhập bằng GitHub và không có mật khẩu ChessArena. Vui lòng chọn Đăng nhập bằng GitHub.';
  }

  return 'Tài khoản này không dùng mật khẩu ChessArena. Vui lòng đăng nhập bằng nhà cung cấp bạn đã dùng khi tạo tài khoản.';
}

async function chessArenaUserExists(email) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return true;

  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

export async function POST(request) {
  try {
    const blocked = await distributedRateLimit(request, { scope: 'otp-send', limit: 8, windowMs: 60_000 });
    if (blocked) return blocked;

    const payload = await readJsonPayload(request);
    if (!payload) {
      return Response.json({ ok: false, error: 'Invalid JSON payload.' }, { status: 400 });
    }

    const email = normalizeOtpEmail(payload?.email);
    const purpose = payload?.purpose;

    if (!PURPOSES.has(purpose) || !validEmail(email)) {
      return Response.json({ ok: false, error: 'Email hoặc mục đích OTP không hợp lệ.' }, { status: 400 });
    }

    const existingUser = await firebaseUserExists(email);
    const existingChessArenaUser = existingUser ? await chessArenaUserExists(email) : false;

    if (purpose === 'register' && existingUser) {
      return Response.json({ ok: false, error: 'Email này đã có tài khoản. Vui lòng đăng nhập.' }, { status: 409 });
    }

    if (purpose === 'reset' && (!existingUser || !existingChessArenaUser)) {
      return Response.json({ ok: false, error: 'Không tìm thấy tài khoản với email này.' }, { status: 404 });
    }

    if (purpose === 'reset' && existingUser.disabled) {
      return Response.json({
        ok: false,
        error: 'Tài khoản này đang bị vô hiệu hóa. Vui lòng liên hệ hỗ trợ.'
      }, { status: 403 });
    }

    if (purpose === 'reset') {
      const eligibility = getPasswordResetEligibility(existingUser);
      if (!eligibility.allowed) {
        return Response.json({
          ok: false,
          code: 'SOCIAL_PROVIDER_ONLY',
          provider: eligibility.provider,
          error: socialPasswordResetError(eligibility.provider)
        }, { status: 409 });
      }
    }

    const otp = createOtpCode();
    const { expiresAt } = await storeOtp({ email, purpose, otp });
    await sendOtpEmail({ to: email, otp, purpose });

    return Response.json({
      ok: true,
      email,
      purpose,
      expiresAt: expiresAt.toISOString()
    });
  } catch (error) {
    return Response.json(
      { ok: false, error: error.message || 'Không thể gửi OTP.' },
      { status: 500 }
    );
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
