import nodemailer from 'nodemailer';

let cachedTransporter;

function smtpConfig() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    throw new Error('Missing SMTP_USER or SMTP_PASS in backend environment.');
  }

  return { user, pass };
}

function transporter() {
  if (!cachedTransporter) {
    const { user, pass } = smtpConfig();
    cachedTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass }
    });
  }

  return cachedTransporter;
}

function otpEmailHtml({ otp, purpose }) {
  const title = purpose === 'reset' ? 'Khôi phục mật khẩu' : 'Xác minh tài khoản';
  const subtitle = purpose === 'reset'
    ? 'Dùng mã này để đặt lại mật khẩu Chess Arena của bạn.'
    : 'Dùng mã này để hoàn tất đăng ký và bắt đầu lưu ván đấu.';

  return `<!doctype html>
<html lang="vi">
  <body style="margin:0;background:#10110e;font-family:Arial,'Segoe UI',sans-serif;color:#f5f6ee;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#10110e;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#1c1f18;border:1px solid #34392e;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:28px;background:linear-gradient(135deg,#27301f,#11130f);">
                <div style="font-size:14px;color:#b7d56a;font-weight:700;">Chess Arena</div>
                <h1 style="margin:10px 0 8px;font-size:30px;line-height:1.1;color:#ffffff;">${title}</h1>
                <p style="margin:0;color:#c7cdbc;line-height:1.6;">${subtitle}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 28px;">
                <div style="background:#10120f;border:1px solid #394033;border-radius:12px;padding:22px;text-align:center;">
                  <div style="font-size:13px;color:#aeb6a0;margin-bottom:10px;">Mã OTP của bạn</div>
                  <div style="letter-spacing:10px;font-size:42px;font-weight:800;color:#d4f06a;">${otp}</div>
                  <div style="font-size:13px;color:#b9c0ad;margin-top:12px;">Mã này sẽ hết hạn sau 5 phút.</div>
                </div>
                <p style="margin:22px 0 0;color:#b7bfad;line-height:1.6;font-size:14px;">
                  Nếu bạn không yêu cầu mã này, hãy bỏ qua email. Không chia sẻ mã OTP cho bất kỳ ai.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendOtpEmail({ to, otp, purpose }) {
  const subject = purpose === 'reset'
    ? `Chess Arena - Mã khôi phục mật khẩu ${otp}`
    : `Chess Arena - Mã xác minh đăng ký ${otp}`;

  await transporter().sendMail({
    from: `"Chess Arena" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text: `Mã OTP Chess Arena của bạn là ${otp}. Mã hết hạn sau 5 phút.`,
    html: otpEmailHtml({ otp, purpose })
  });
}
