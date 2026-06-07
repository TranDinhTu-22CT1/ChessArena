import {
  createVerifiedFirebaseUser,
  firebaseUserExists,
  getPasswordResetEligibility,
  updateFirebaseUserPassword
} from '../../../../../lib/firebaseAdmin';
import { consumeOtp, normalizeOtpEmail, verifyOtp } from '../../../../../lib/otp';
import { distributedRateLimit } from '../../../../../lib/rateLimit';
import { readJsonPayload } from '../../../../../lib/validation';

export const runtime = 'nodejs';

function validPassword(password) {
  return typeof password === 'string' && password.length >= 6 && password.length <= 128;
}

function validOtp(otp) {
  return /^\d{6}$/.test(String(otp || ''));
}

function socialPasswordResetError(provider) {
  if (provider === 'google.com') {
    return 'Tài khoản này chỉ dùng đăng nhập Google. Không thể đặt lại mật khẩu ChessArena.';
  }

  if (provider === 'github.com') {
    return 'Tài khoản này chỉ dùng đăng nhập GitHub. Không thể đặt lại mật khẩu ChessArena.';
  }

  return 'Tài khoản này không hỗ trợ đặt lại mật khẩu.';
}

export async function POST(request) {
  try {
    const blocked = await distributedRateLimit(request, { scope: 'otp-verify', limit: 20, windowMs: 60_000 });
    if (blocked) return blocked;

    const payload = await readJsonPayload(request);
    if (!payload) {
      return Response.json({ ok: false, error: 'Invalid JSON payload.' }, { status: 400 });
    }

    const email = normalizeOtpEmail(payload?.email);
    const purpose = payload?.purpose;
    const otp = String(payload?.otp || '').trim();

    if (!['register', 'reset'].includes(purpose) || !email || !validOtp(otp)) {
      return Response.json({ ok: false, error: 'Thông tin OTP không hợp lệ.' }, { status: 400 });
    }

    const result = await verifyOtp({ email, purpose, otp, consume: false });

    if (!result.ok) {
      return Response.json({ ok: false, error: result.error }, { status: 400 });
    }

    if (purpose === 'register') {
      if (!validPassword(payload?.password)) {
        return Response.json({ ok: false, error: 'Mật khẩu phải có ít nhất 6 ký tự.' }, { status: 400 });
      }

      await createVerifiedFirebaseUser({
        email,
        password: payload.password,
        displayName: String(payload.displayName || '').trim() || email
      });
      await consumeOtp({ email, purpose });

      return Response.json({ ok: true, purpose, email });
    }

    if (!validPassword(payload?.newPassword)) {
      return Response.json({ ok: false, error: 'Mật khẩu mới phải có ít nhất 6 ký tự.' }, { status: 400 });
    }

    const existingUser = await firebaseUserExists(email);
    if (!existingUser) {
      return Response.json({ ok: false, error: 'Không tìm thấy tài khoản.' }, { status: 404 });
    }

    const eligibility = getPasswordResetEligibility(existingUser);
    if (!eligibility.allowed) {
      return Response.json({
        ok: false,
        code: 'SOCIAL_PROVIDER_ONLY',
        provider: eligibility.provider,
        error: socialPasswordResetError(eligibility.provider)
      }, { status: 409 });
    }

    const updatedUser = await updateFirebaseUserPassword(email, payload.newPassword);

    if (!updatedUser) {
      return Response.json({ ok: false, error: 'Không tìm thấy tài khoản.' }, { status: 404 });
    }

    await consumeOtp({ email, purpose });

    return Response.json({ ok: true, purpose, email });
  } catch (error) {
    return Response.json(
      { ok: false, error: error.message || 'Không thể xác nhận OTP.' },
      { status: 500 }
    );
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
