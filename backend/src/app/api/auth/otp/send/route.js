import { firebaseUserExists } from '../../../../../lib/firebaseAdmin';
import { sendOtpEmail } from '../../../../../lib/mailer';
import { createOtpCode, normalizeOtpEmail, storeOtp } from '../../../../../lib/otp';
import { rateLimit } from '../../../../../lib/rateLimit';

export const runtime = 'nodejs';

const PURPOSES = new Set(['register', 'reset']);

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
}

export async function POST(request) {
  try {
    const blocked = rateLimit(request, { scope: 'otp-send', limit: 8, windowMs: 60_000 });
    if (blocked) return blocked;

    const payload = await request.json();
    const email = normalizeOtpEmail(payload?.email);
    const purpose = payload?.purpose;

    if (!PURPOSES.has(purpose) || !validEmail(email)) {
      return Response.json({ ok: false, error: 'Email hoặc mục đích OTP không hợp lệ.' }, { status: 400 });
    }

    const existingUser = await firebaseUserExists(email);

    if (purpose === 'register' && existingUser) {
      return Response.json({ ok: false, error: 'Email này đã có tài khoản. Vui lòng đăng nhập.' }, { status: 409 });
    }

    if (purpose === 'reset' && !existingUser) {
      return Response.json({ ok: false, error: 'Không tìm thấy tài khoản với email này.' }, { status: 404 });
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
